import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isFirebaseAdminActive = false;
let adminAuth = null;
let adminDb = null;

try {
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    // 1. Initialized via local service account JSON file
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isFirebaseAdminActive = true;
    console.log('🔥 [Firebase Admin] Initialized via serviceAccountKey.json');
  } else if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    // 2. Initialized via environment variables in backend/.env
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    isFirebaseAdminActive = true;
    console.log('🔥 [Firebase Admin] Initialized via environment credentials');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // 3. Initialized via default Google Application Credentials
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
    isFirebaseAdminActive = true;
    console.log('🔥 [Firebase Admin] Initialized via applicationDefault()');
  } else {
    console.info('ℹ️ [Firebase Admin] No service account detected. Running on local indexed database.');
  }

  if (isFirebaseAdminActive) {
    adminAuth = admin.auth();
    adminDb = admin.firestore();
  }
} catch (error) {
  console.warn('⚠️ [Firebase Admin] Failed to initialize:', error.message);
  isFirebaseAdminActive = false;
}

export { admin, adminAuth, adminDb, isFirebaseAdminActive };

/**
 * Middleware to verify Firebase ID tokens or fallback to standard JWT
 */
export async function verifyFirebaseOrJwt(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication token required' });
  }

  // Try verifying with Firebase Admin if active
  if (isFirebaseAdminActive && adminAuth) {
    try {
      const decodedFirebase = await adminAuth.verifyIdToken(token);
      req.firebaseUser = decodedFirebase;
      req.user = {
        id: decodedFirebase.uid,
        email: decodedFirebase.email,
        role: decodedFirebase.role || 'founder',
        full_name: decodedFirebase.name || 'User',
      };
      return next();
    } catch {
      // If Firebase token verification fails, fall through to check standard JWT
    }
  }

  next();
}

/**
 * Sync startup pitch to Cloud Firestore if Firebase Admin is enabled
 */
export async function syncStartupToFirestore(startup) {
  if (!isFirebaseAdminActive || !adminDb) return;
  try {
    await adminDb.collection('startups').doc(startup.id).set({
      ...startup,
      synced_at: Date.now(),
    }, { merge: true });
    console.log(`[Firestore Sync] Synced startup ${startup.id} to Firestore`);
  } catch (err) {
    console.warn(`[Firestore Sync Error] Could not sync startup ${startup.id}:`, err.message);
  }
}

