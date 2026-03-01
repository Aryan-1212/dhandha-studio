/**
 * Credit Service
 * ---------------
 * Manages the prepaid credit system.
 *
 * - Finds a user by their API key
 * - Atomically deducts 1 credit inside a Firestore transaction
 * - Returns the remaining credit balance
 *
 * The transaction guarantees that concurrent requests for the
 * same user cannot race past a zero-credit balance.
 */

import admin, { db } from '../config/firebase.js';

/**
 * Look up a user document by API key.
 * @param {string} apiKey
 * @returns {Promise<{ userId: string, credits: number, clientId: string } | null>}
 */
export const findUserByApiKey = async (apiKey) => {
  const snapshot = await db
    .collection('users')
    .where('apiKey', '==', apiKey)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return { userId: doc.id, ...doc.data() };
};

/**
 * Validate that the user has >= 1 credit and atomically deduct 1.
 *
 * @param {string} userId  Firestore document ID
 * @returns {Promise<number>}  Credits remaining AFTER deduction
 * @throws {{ statusCode: number, message: string }}
 */
export const validateAndDeductCredit = async (userId) => {
  const userRef = db.collection('users').doc(userId);

  const newCredits = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);

    if (!userDoc.exists) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const currentCredits = userDoc.data().credits ?? 0;

    if (currentCredits < 1) {
      const err = new Error('Insufficient credits. Please top up your account.');
      err.statusCode = 402;
      throw err;
    }

    const updatedCredits = currentCredits - 1;
    transaction.update(userRef, { credits: updatedCredits });

    return updatedCredits;
  });

  return newCredits;
};

/**
 * Add credits to a user (e.g. rollback on generation failure).
 *
 * @param {string} userId  Firestore document ID
 * @param {number} amount  Credits to add (positive)
 * @returns {Promise<number>}  Credits after addition
 */
export const addCredits = async (userId, amount = 1) => {
  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    credits: admin.firestore.FieldValue.increment(amount),
  });
  const doc = await userRef.get();
  return doc.data().credits ?? 0;
};

export default { findUserByApiKey, validateAndDeductCredit, addCredits };
