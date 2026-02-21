/**
 * Job Service
 * ------------
 * CRUD operations for Firestore `jobs` collection.
 *
 * Job lifecycle:  queued → processing → completed | failed
 */

import { db } from '../config/firebase.js';
import admin from '../config/firebase.js';

/**
 * Create a new job document.
 *
 * @param {object} jobData
 * @param {string} jobData.job_id
 * @param {"generation"|"refinement"} jobData.type
 * @param {string} jobData.user_id
 * @param {string|null} jobData.original_job_id
 * @param {string} jobData.input_image_url
 * @param {string} jobData.instruction
 * @param {string} jobData.text_overlay
 * @param {string} jobData.model_type
 * @returns {Promise<object>}
 */
export const createJob = async (jobData) => {
  const job = {
    job_id: jobData.job_id,
    type: jobData.type,
    status: 'queued',
    user_id: jobData.user_id,
    original_job_id: jobData.original_job_id || null,
    input_image_url: jobData.input_image_url,
    output_url: null,
    instruction: jobData.instruction || '',
    text_overlay: jobData.text_overlay || '',
    model_type: jobData.model_type || '',
    metadata: {},
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('jobs').doc(job.job_id).set(job);
  return job;
};

/**
 * Partial update of an existing job.
 *
 * @param {string} jobId
 * @param {object} updates  Fields to merge
 * @returns {Promise<void>}
 */
export const updateJob = async (jobId, updates) => {
  await db.collection('jobs').doc(jobId).update(updates);
};

/**
 * Fetch a single job by ID.
 *
 * @param {string} jobId
 * @returns {Promise<object|null>}
 */
export const getJob = async (jobId) => {
  const doc = await db.collection('jobs').doc(jobId).get();
  if (!doc.exists) return null;
  return doc.data();
};

export default { createJob, updateJob, getJob };
