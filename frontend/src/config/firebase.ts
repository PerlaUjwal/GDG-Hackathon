import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type Auth,
  type UserCredential,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  type Firestore,
} from 'firebase/firestore';
import type { User, UserRole } from '../types';

// Read Firebase Studio / Console Web App Config from Vite Environment Variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
};

// Check if valid Firebase configuration is present
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey.length > 5 &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId.length > 2
);

// Initialize Firebase App
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
    db = getFirestore(app);
    console.log('🔥 [Firebase Studio] Connected successfully to project:', firebaseConfig.projectId);
  } catch (err) {
    console.warn('⚠️ [Firebase Studio] Initialization failed:', err);
  }
} else {
  console.info('ℹ️ [Firebase Studio] No Firebase credentials detected in frontend/.env. Running on local full-stack engine.');
}

export { auth, db };

// ==============================================================================
// AUTHENTICATION HELPERS
// ==============================================================================

/**
 * Sign in user with Firebase Email & Password
 */
export async function firebaseSignIn(email: string, pass: string): Promise<User | null> {
  if (!auth) return null;
  const cred: UserCredential = await signInWithEmailAndPassword(auth, email, pass);
  const uid = cred.user.uid;

  // Retrieve user document from Firestore safely if available
  if (db) {
    try {
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        return {
          id: uid,
          email: cred.user.email || email,
          full_name: data.full_name || cred.user.displayName || 'FoundersGate User',
          role: (data.role as UserRole) || 'founder',
          country_code: data.country_code || '+1',
          phone_number: data.phone_number || '',
          created_at: data.created_at || Date.now(),
        };
      }
    } catch (fsErr) {
      console.warn('Firestore profile fetch failed (Firestore may not be enabled):', fsErr);
    }
  }

  // Fallback if firestore document hasn't been created yet or firestore is disabled
  return {
    id: uid,
    email: cred.user.email || email,
    full_name: cred.user.displayName || 'FoundersGate User',
    role: 'founder',
    country_code: '+1',
    phone_number: '',
    created_at: Date.now(),
  };
}

/**
 * Register new user with Firebase Auth & save profile to Cloud Firestore
 */
export async function firebaseSignUp(params: {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  country_code: string;
  phone_number: string;
}): Promise<User | null> {
  if (!auth) return null;

  const cred: UserCredential = await createUserWithEmailAndPassword(auth, params.email, params.password);
  const uid = cred.user.uid;

  const userProfile: User = {
    id: uid,
    email: params.email.toLowerCase(),
    full_name: params.full_name,
    role: params.role,
    country_code: params.country_code,
    phone_number: params.phone_number,
    created_at: Date.now(),
  };

  // Save profile document in Firestore: /users/{uid} safely
  if (db) {
    try {
      await setDoc(doc(db, 'users', uid), {
        ...userProfile,
        updated_at: Date.now(),
      });
    } catch (fsErr) {
      console.warn('Firestore setDoc failed (Firestore may not be enabled):', fsErr);
    }
  }

  return userProfile;
}

/**
 * Send password reset email via Firebase Auth
 */
export async function firebaseResetPassword(email: string): Promise<boolean> {
  if (!auth) return false;
  await sendPasswordResetEmail(auth, email);
  return true;
}

/**
 * Sign out of Firebase
 */
export async function firebaseSignOut(): Promise<void> {
  if (auth) {
    await signOut(auth);
  }
}

// ==============================================================================
// FIRESTORE COLLECTIONS & REALTIME SUBSCRIPTIONS
// ==============================================================================

/**
 * Listen for real-time startup updates from Firestore
 */
export function subscribeToFirestoreStartups(callback: (startups: any[]) => void) {
  if (!db) return () => {};
  const startupsRef = collection(db, 'startups');
  const q = query(startupsRef, orderBy('created_at', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(items);
  }, (err) => {
    console.warn('Firestore startups subscription error:', err);
  });
}

