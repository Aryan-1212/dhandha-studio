/**
 * Refine Controller
 * -------------------
 * Handles GET /refine/:job_id/:refinement_instructions
 *
 * Flow:
 *   1. Fetch the original job from Firestore (404 if missing)
 *   2. Validate & deduct credit
 *   3. Create a new refinement job
 *   4. Respond immediately
 *   5. Async: run Gemini with the original image + refinement instructions
 */

import { generateJobId } from '../utils/generateJobId.js';
import { validateAndDeductCredit } from '../services/creditService.js';
import { createJob, updateJob, getJob } from '../services/jobService.js';
import { uploadBuffer } from '../services/cloudinaryService.js';
import { generateImage } from '../services/geminiService.js';

export const handleRefine = async (req, res, next) => {
  try {
    const { job_id: originalJobId, refinement_instructions: refinementInstructions } = req.params;

    // ── 1. Fetch the original job ───────────────────────────────
    const originalJob = await getJob(originalJobId);

    if (!originalJob) {
      const err = new Error('Original job not found.');
      err.statusCode = 404;
      throw err;
    }

    // Use the output URL if the original job is completed, otherwise the input
    const inputImageUrl = originalJob.output_url || originalJob.input_image_url;

    if (!inputImageUrl) {
      const err = new Error('Original job has no image available for refinement.');
      err.statusCode = 400;
      throw err;
    }

    // ── 2. Validate & deduct credit ─────────────────────────────
    const creditsRemaining = await validateAndDeductCredit(req.user.userId);

    // ── 3. Create refinement job ────────────────────────────────
    const refinementJobId = generateJobId();

    await createJob({
      job_id: refinementJobId,
      type: 'refinement',
      user_id: req.user.userId,
      original_job_id: originalJobId,
      input_image_url: inputImageUrl,
      instruction: decodeURIComponent(refinementInstructions),
      text_overlay: req.textOverlay || '',
      model_type: originalJob.model_type || '',
    });

    // ── 4. Respond immediately ──────────────────────────────────
    res.status(202).json({
      status: 'refining',
      original_job: originalJobId,
      refinement_job_id: refinementJobId,
      credits_remaining: creditsRemaining,
      instruction_received: decodeURIComponent(refinementInstructions),
      check_status: `/status/${refinementJobId}`,
    });

    // ── 5. Async background processing ──────────────────────────
    setImmediate(async () => {
      try {
        await updateJob(refinementJobId, { status: 'processing' });

        const generated = await generateImage({
          inputImageUrl,
          instruction: decodeURIComponent(refinementInstructions),
          textOverlay: req.textOverlay || '',
          model_type: originalJob.model_type,
          background_theme: null,
          clothing_category: null,
          lighting_style: null,
        });

        const outputUpload = await uploadBuffer(generated.buffer, 'dhandha-studio/outputs');

        await updateJob(refinementJobId, {
          status: 'completed',
          output_url: outputUpload.url,
          metadata: {
            width: outputUpload.width,
            height: outputUpload.height,
            text_applied: req.textOverlay || null,
          },
        });

        console.log(`[JOB] Refinement ${refinementJobId} completed successfully.`);
      } catch (asyncError) {
        console.error(`[JOB] Refinement ${refinementJobId} failed:`, asyncError.message);

        try {
          await updateJob(refinementJobId, {
            status: 'failed',
            metadata: { error: asyncError.message },
          });
        } catch (updateError) {
          console.error(`[JOB] ${refinementJobId} failed to update status:`, updateError.message);
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export default { handleRefine };
