/**
 * Firebase Admin SDK Configuration
 * ---------------------------------
 * Initializes the Firebase Admin SDK using either:
 *   1. A service-account JSON file (FIREBASE_SERVICE_ACCOUNT_PATH), or
 *   2. Inline credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
 *
 * Exports the Firestore database instance and the admin SDK itself.
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const initializeFirebase = () => {
  // Avoid re-initialization if already done (e.g. in tests)
  if (admin.apps.length) return admin;

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountPath) {
    // Option A — JSON key file on disk
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // Option B — individual env vars (useful for containerised deployments)
    const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

    if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
      throw new Error(
        'Firebase credentials missing. Provide FIREBASE_SERVICE_ACCOUNT_PATH or all of FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        // The private key comes as a single-line string with literal "\n" — restore real newlines
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }

  return admin;
};

initializeFirebase();

/** Firestore database handle — use this across all services */
export const db = admin.firestore();

export default admin;
