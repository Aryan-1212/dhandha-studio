/**
 * Demo Account Seed Script
 * -------------------------
 * Creates a demo user for B2C testing.
 *
 * Usage: node scripts/seed-demo-user.js
 *
 * Demo credentials:
 *   Email:    aryanparvani12@gmail.com
 *   API Key:  demo_dhandha_aryan_2026  (set in localStorage as ds_api_key)
 *   Credits:  500
 *
 * To "login": Set localStorage.ds_api_key = 'demo_dhandha_aryan_2026' in browser.
 */

import 'dotenv/config';
import { db } from '../src/config/firebase.js';

const DEMO_API_KEY = 'demo_dhandha_aryan_2026';
const DEMO_EMAIL = 'aryanparvani12@gmail.com';
const DEMO_CREDITS = 500;

async function seed() {
  const snapshot = await db.collection('users').where('email', '==', DEMO_EMAIL).limit(1).get();

  const userData = {
    email: DEMO_EMAIL,
    name: 'Demo User',
    apiKey: DEMO_API_KEY,
    credits: DEMO_CREDITS,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  if (snapshot.empty) {
    const ref = await db.collection('users').add(userData);
    console.log(`✅ Demo user created: ${ref.id}`);
  } else {
    const ref = snapshot.docs[0].ref;
    await ref.update({
      ...userData,
      updatedAt: new Date(),
    });
    console.log(`✅ Demo user updated: ${ref.id}`);
  }

  console.log(`
Demo account ready:
  Email:    ${DEMO_EMAIL}
  API Key:  ${DEMO_API_KEY}
  Credits:  ${DEMO_CREDITS}

To use: In browser DevTools → Application → Local Storage → set:
  ds_api_key = ${DEMO_API_KEY}
`);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  if (err.code === 5 || err.code === 'NOT_FOUND') {
    console.error(`
Firestore NOT_FOUND usually means:
  1. Firestore database not created — Create it in Firebase Console → Firestore Database
  2. Wrong project — Check FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_PROJECT_ID
  3. Firestore API not enabled — Enable "Cloud Firestore API" in Google Cloud Console
`);
  }
  if (err.details) console.error('Details:', err.details);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
