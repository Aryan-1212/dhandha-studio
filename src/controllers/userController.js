/**
 * User Controller
 * -----------------
 * Handles user dashboard endpoints.
 * Protected by requireRole('user', 'admin').
 *
 * Endpoints:
 *   GET  /user/profile           — Get user profile
 *   PUT  /user/profile           — Update profile
 *   GET  /user/history           — Paginated job history
 *   GET  /user/credits           — Current credit balance
 *   POST /user/refund            — Request a refund
 */

import { db } from '../config/firebase.js';
import admin from '../config/firebase.js';
import { getJobsByUser } from '../services/jobService.js';
import { getUserStats } from '../services/analyticsService.js';

/**
 * GET /user/profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.userId).get();

    if (!userDoc.exists) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    const data = userDoc.data();
    const stats = await getUserStats(req.user.userId);

    res.status(200).json({
      status: 'ok',
      data: {
        userId: userDoc.id,
        name: data.name || null,
        email: data.email || null,
        role: data.role || 'user',
        credits: data.credits || 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        stats,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /user/profile
 * Body: { name, email }
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = String(name).trim();
    if (email !== undefined) updates.email = String(email).trim();

    if (Object.keys(updates).length === 0) {
      const err = new Error('No updatable fields provided.');
      err.statusCode = 400;
      throw err;
    }

    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('users').doc(req.user.userId).update(updates);

    res.status(200).json({
      status: 'ok',
      message: 'Profile updated.',
      updated: Object.keys(updates).filter((k) => k !== 'updatedAt'),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /user/history?limit=20&startAfter=<job_id>
 */
export const getHistory = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const startAfter = req.query.startAfter || null;

    const jobs = await getJobsByUser(req.user.userId, { limit, startAfter });

    const formatted = jobs.map((job) => ({
      jobId: job.job_id,
      status: job.pipelineStage || job.status,
      category: job.normalizedConfig?.category || null,
      outputUrl: job.outputUrl || job.output_url || null,
      inputImageUrl: job.input_image_url || null,
      aspectRatio: job.aspectRatio || null,
      resolution: job.resolution || null,
      createdAt: job.created_at?.toDate?.()?.toISOString() || null,
      metadata: {
        width: job.metadata?.width || job.metadata?.requestedWidth || null,
        height: job.metadata?.height || job.metadata?.requestedHeight || null,
        durationMs: job.metadata?.durationMs || null,
      },
    }));

    res.status(200).json({
      status: 'ok',
      count: formatted.length,
      data: formatted,
      pagination: {
        limit,
        hasMore: formatted.length === limit,
        nextCursor: formatted.length === limit ? formatted[formatted.length - 1].jobId : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /user/credits
 */
export const getCredits = async (req, res, next) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.userId).get();

    if (!userDoc.exists) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    res.status(200).json({
      status: 'ok',
      data: {
        credits: userDoc.data().credits || 0,
        userId: req.user.userId,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /user/refund
 * Body: { jobId, reason }
 */
export const requestRefund = async (req, res, next) => {
  try {
    const { jobId, reason } = req.body;

    if (!jobId) {
      const err = new Error('jobId is required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify the job belongs to the user
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      const err = new Error('Job not found.');
      err.statusCode = 404;
      throw err;
    }

    if (jobDoc.data().user_id !== req.user.userId) {
      const err = new Error('Job does not belong to this user.');
      err.statusCode = 403;
      throw err;
    }

    // Check for existing refund request
    const existingRefund = await db.collection('refund_requests')
      .where('job_id', '==', jobId)
      .where('status', '==', 'pending')
      .limit(1)
      .get();

    if (!existingRefund.empty) {
      const err = new Error('A refund request for this job is already pending.');
      err.statusCode = 409;
      throw err;
    }

    // Create refund request
    const refundId = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const jobData = jobDoc.data();
    await db.collection('refund_requests').doc(refundId).set({
      refund_id: refundId,
      job_id: jobId,
      user_id: req.user.userId,
      credits_requested: 1,
      reason: reason || 'No reason provided.',
      status: 'pending',
      input_image_url: jobData.input_image_url || null,
      output_url: jobData.outputUrl || jobData.output_url || null,
      prompt: jobData.finalPrompt?.instruction ?? JSON.stringify(jobData.finalPrompt || {}),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      status: 'ok',
      message: 'Refund request submitted.',
      refundId,
    });
  } catch (error) {
    next(error);
  }
};

export default { getProfile, updateProfile, getHistory, getCredits, requestRefund };
