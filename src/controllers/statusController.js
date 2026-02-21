/**
 * Status Controller
 * -------------------
 * Handles GET /status/:job_id
 *
 * Returns the current state of a job:
 *   - completed  → includes output URL + metadata
 *   - processing / queued → status only
 *   - not found  → 404
 */

import { getJob } from '../services/jobService.js';

export const handleStatus = async (req, res, next) => {
  try {
    const { job_id: jobId } = req.params;

    const job = await getJob(jobId);

    if (!job) {
      const err = new Error('Job not found.');
      err.statusCode = 404;
      throw err;
    }

    // ── Completed ───────────────────────────────────────────────
    if (job.status === 'completed') {
      return res.status(200).json({
        job_id: job.job_id,
        status: 'completed',
        url: job.output_url,
        metadata: {
          width: job.metadata?.width || null,
          height: job.metadata?.height || null,
          text_applied: job.metadata?.text_applied || null,
        },
      });
    }

    // ── Failed ──────────────────────────────────────────────────
    if (job.status === 'failed') {
      return res.status(200).json({
        job_id: job.job_id,
        status: 'failed',
        error: job.metadata?.error || 'Image generation failed.',
      });
    }

    // ── Queued / Processing ─────────────────────────────────────
    return res.status(200).json({
      job_id: job.job_id,
      status: job.status,
    });
  } catch (error) {
    next(error);
  }
};

export default { handleStatus };
