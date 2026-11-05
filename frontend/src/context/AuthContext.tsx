import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { INITIAL_USERS } from '../utils/mockData';
import { API_BASE_URL } from '../utils/apiClient';
import {
  isFirebaseConfigured,
  firebaseSignIn,
  firebaseSignUp,
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
      // 1. Try local Express backend API first
      let backendError: string | null = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

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
          // Sync with Firebase in background if configured and email is provided
          if (isFirebaseConfigured && payload.email && payload.password) {
            firebaseSignIn(payload.email, payload.password).catch(() => {});
          }
          return;
        }

        if (res.status === 429) {
          throw new Error('Too many authentication attempts. Please wait a few moments.');
        }

        backendError = data.message;
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          throw new Error('Request timed out while connecting to the server. Please check your connection.');
        }
        backendError = fetchErr.message;
      }

      // 2. If backend did not authenticate, try Firebase Auth if configured & email provided
      if (isFirebaseConfigured && payload.email) {
        try {
          const fbUser = await firebaseSignIn(payload.email, payload.password || fallbackPassword);
          if (fbUser) {
            setUser(fbUser);
            setToken(`fb-${fbUser.id}`);
            return;
          }
        } catch (fbErr: any) {
          console.warn('Firebase authentication attempt:', fbErr.message);
        }
      }

      // 3. Check local mock users if backend & Firebase return error
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
        setUser(found);
        setToken(`mock-token-${found.id}`);
        return;
      }

      throw new Error(backendError || 'Invalid credentials. Please verify your mobile number or email and password.');
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
      // 1. Primary Registration via Express Backend
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

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

        // Also sync registration to Firebase if configured
        if (isFirebaseConfigured && data.email && data.password) {
          firebaseSignUp({
            email: data.email,
            password: data.password,
            full_name: data.full_name,
            role: data.role,
            country_code: data.country_code,
            phone_number: data.phone_number,
          }).catch((err) => console.warn('Firebase sync note:', err.message));
        }
        return;
      }

      if (res.status === 429) {
        throw new Error('Rate limit reached. Please wait a moment before creating another account.');
      }

      if (res.status === 400 || res.status === 409 || res.status === 403) {
        throw new Error(respData.message || 'Registration failed. Please check your details.');
      }

      // 2. If backend endpoint returned unexpected status, try Firebase Studio directly
      if (isFirebaseConfigured && data.email && data.password) {
        try {
          const fbUser = await firebaseSignUp({
            email: data.email,
            password: data.password,
            full_name: data.full_name,
            role: data.role,
            country_code: data.country_code,
            phone_number: data.phone_number,
          });
          if (fbUser) {
            setUser(fbUser);
            setToken(`fb-${fbUser.id}`);
            return;
          }
        } catch (fbErr: any) {
          console.warn('Firebase direct registration fallback note:', fbErr.message);
          if (fbErr.code === 'auth/email-already-in-use') {
            throw new Error('This email is already registered. Please sign in instead.');
          }
        }
      }

      // 3. Fallback client-side user
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
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error('Server took too long to respond. Please check your internet connection.');
      }
      throw err;
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
