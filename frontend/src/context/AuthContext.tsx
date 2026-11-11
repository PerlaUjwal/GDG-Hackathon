import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { INITIAL_USERS } from '../utils/mockData';
import { API_BASE_URL } from '../utils/apiClient';
import {
  isFirebaseConfigured,
  firebaseSignIn,
  firebaseSignUp,
  firebaseGoogleSignIn,
  firebaseSignOut,
} from '../config/firebase';

export interface LoginParams {
  email?: string;
  phone_number?: string;
  country_code?: string;
  password?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isFirebaseConnected: boolean;
  login: (params: LoginParams | string, password?: string) => Promise<void>;
  loginWithGoogle: (preferredRole?: UserRole) => Promise<void>;
  register: (data: {
    email: string;
    password?: string;
    full_name: string;
    role: UserRole;
    country_code: string;
    phone_number: string;
  }) => Promise<void>;
  logout: () => void;
  switchUserRoleDemo: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY_USER = 'foundersgate_user_session';
const STORAGE_KEY_TOKEN = 'foundersgate_auth_token';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // At the start, require login/signup unless session exists in storage
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_TOKEN) || null;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Sync to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
    } else {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
  }, [token]);

  const login = async (params: LoginParams | string, fallbackPassword = 'Password123!') => {
    setIsLoading(true);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsLoading(false);
      throw new Error('No internet connection. Please verify your network and try again.');
    }

    let payload: LoginParams;
    if (typeof params === 'string') {
      payload = { email: params, password: fallbackPassword };
    } else {
      payload = {
        ...params,
        password: params.password || fallbackPassword,
      };
    }

    try {
      // 1. If Firebase Studio is configured, try authenticate via Firebase Auth with timeout
      if (isFirebaseConfigured && payload.email) {
        try {
          const fbUser = await Promise.race([
            firebaseSignIn(payload.email, payload.password || fallbackPassword),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Firebase Auth timeout')), 3500)),
          ]);
          if (fbUser) {
            setUser(fbUser);
            setToken(`fb-${fbUser.id}`);
            return;
          }
        } catch (fbErr: any) {
          console.warn('Firebase authentication attempt notice:', fbErr.message);
          if (fbErr.code === 'auth/wrong-password') {
            throw new Error('Incorrect password entered for this Firebase account.');
          }
          // For other errors (e.g. user not found in Firebase), fall through to Express backend & seed accounts
        }
      }

      // 2. Try Local Express Backend
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = await res.json().catch(() => ({}));

        if (res.ok && data.user) {
          setUser(data.user);
          setToken(data.token);
          return;
        }

        if (res.status === 429) {
          throw new Error('Too many authentication attempts. Rate limit reached; please wait a few moments.');
        }

        if (res.status === 401 && data.message && data.message.includes('Incorrect password')) {
          throw new Error('Incorrect password entered.');
        }
      } catch (backendErr: any) {
        if (backendErr.message && (backendErr.message.includes('Rate limit') || backendErr.message.includes('Incorrect password'))) {
          throw backendErr;
        }
      }

      // 3. Fallback: check initial demo seed users (Alex, Sarah, Maria, Kenji, David, Elena)
      const cleanPhone = payload.phone_number ? payload.phone_number.replace(/\D/g, '') : null;
      const found = INITIAL_USERS.find((u) => {
        if (cleanPhone && u.phone_number.replace(/\D/g, '') === cleanPhone) {
          return true;
        }
        if (payload.email && u.email.toLowerCase() === payload.email.toLowerCase()) {
          return true;
        }
        return false;
      });

      if (found) {
        if (payload.password && payload.password !== 'Password123!') {
          throw new Error('Incorrect password entered.');
        }
        setUser(found);
        setToken(`mock-token-${found.id}`);
        return;
      }

      throw new Error('Invalid credentials. Please verify your mobile number or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: {
    email: string;
    password?: string;
    full_name: string;
    role: UserRole;
    country_code: string;
    phone_number: string;
  }) => {
    setIsLoading(true);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsLoading(false);
      throw new Error('No internet connection. Please reconnect to register.');
    }

    try {
      // 1. If Firebase Studio is configured, try create in Firebase Auth with timeout
      if (isFirebaseConfigured && data.email) {
        try {
          const fbUser = await Promise.race([
            firebaseSignUp({
              email: data.email,
              password: data.password || 'Password123!',
              full_name: data.full_name,
              role: data.role,
              country_code: data.country_code,
              phone_number: data.phone_number,
            }),
            new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Firebase timeout')), 4000)),
          ]);
          if (fbUser) {
            setUser(fbUser);
            setToken(`fb-${fbUser.id}`);
            // Also notify local Express backend in background (fire-and-forget)
            fetch(`${API_BASE_URL}/auth/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            }).catch(() => {});
            return;
          }
        } catch (fbErr: any) {
          console.warn('Firebase registration notice:', fbErr.message);
          if (fbErr.code === 'auth/email-already-in-use') {
            throw new Error('This email is already registered. Please sign in instead.');
          }
        }
      }

      // 2. Try Local Express Backend
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const respData = await res.json().catch(() => ({}));

        if (res.ok && respData.user) {
          setUser(respData.user);
          setToken(respData.token);
          return;
        }

        if (res.status === 429) {
          throw new Error('Rate limit reached (max 5 registrations per minute). Please wait a moment.');
        }

        if (res.status === 400 || res.status === 409) {
          throw new Error(respData.message || 'Registration failed. Please check your details.');
        }
      } catch (backendErr: any) {
        if (backendErr.message && (backendErr.message.includes('Rate limit') || backendErr.message.includes('already exists'))) {
          throw backendErr;
        }
        console.warn('Backend registration notice, using resilient local session:', backendErr.message);
      }

      // 3. Resilient fallback registration locally (ensures user always enters dashboard)
      const newUser: User = {
        id: crypto.randomUUID ? crypto.randomUUID() : `usr-${Date.now()}`,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        country_code: data.country_code,
        phone_number: data.phone_number,
        created_at: Date.now(),
      };

      setUser(newUser);
      setToken(`mock-token-${newUser.id}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (preferredRole: UserRole = 'founder') => {
    setIsLoading(true);
    try {
      if (!isFirebaseConfigured) {
        throw new Error('Google Sign-In requires Firebase configuration. You can use standard Sign In below.');
      }
      const fbUser = await firebaseGoogleSignIn();
      if (!fbUser) {
        throw new Error('Google Sign-In was cancelled or not completed.');
      }
      fbUser.role = preferredRole;

      // Sync user to Express backend to obtain JWT and ensure DB has this user
      try {
        const res = await fetch(`${API_BASE_URL}/auth/sync-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: fbUser.id,
            email: fbUser.email,
            full_name: fbUser.full_name,
            role: fbUser.role,
            country_code: fbUser.country_code,
            phone_number: fbUser.phone_number,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.token) {
          setToken(data.token);
          setUser(data.user || fbUser);
          return;
        }
      } catch {}

      setUser(fbUser);
      setToken(`fb-${fbUser.id}`);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Google Sign-In popup was closed. Please try again or use direct login.');
      }
      if (err.code === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized in Firebase Console -> Auth -> Settings -> Authorized domains.');
      }
      if (err.code === 'auth/operation-not-allowed') {
        throw new Error('Google provider is not enabled in Firebase Console. Please enable it in Authentication > Sign-in method.');
      }
      throw new Error(err.message || 'Google Sign-In failed. Please try standard sign-in.');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    if (isFirebaseConfigured) {
      firebaseSignOut().catch(() => {});
    }
    setUser(null);
    setToken(null);
    localStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
  };

  const switchUserRoleDemo = (role: UserRole) => {
    const targetUser = INITIAL_USERS.find(u => u.role === role);
    if (targetUser) {
      setUser(targetUser);
      setToken(`mock-token-${targetUser.id}`);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isFirebaseConnected: isFirebaseConfigured,
        login,
        loginWithGoogle,
        register,
        logout,
        switchUserRoleDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
