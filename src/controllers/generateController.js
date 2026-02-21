/**
 * Generate Controller
 * ---------------------
 * Handles POST /generate
 *
 * Synchronous phase (before response):
 *   1. Validate base64 input
 *   2. Validate & deduct credit (atomic)
 *   3. Generate a unique job ID
 *   4. Upload input image to Cloudinary
 *   5. Create Firestore job record (status: queued)
 *   6. Return immediate response with job_id + ETA
 *
 * Asynchronous phase (after response via setImmediate):
 *   1. Mark job as "processing"
 *   2. Call Gemini API
 *   3. Upload generated image to Cloudinary
 *   4. Update job to "completed" with output_url + metadata
 *   5. On failure → update job to "failed"
 */

import { validateBase64 } from '../utils/validateBase64.js';
import { generateJobId } from '../utils/generateJobId.js';
import { validateAndDeductCredit } from '../services/creditService.js';
import { createJob, updateJob } from '../services/jobService.js';
import { uploadBase64, uploadBuffer } from '../services/cloudinaryService.js';
import { generateImage } from '../services/geminiService.js';

export const handleGenerate = async (req, res, next) => {
  try {
    const { image_b64, model_type, background_theme, clothing_category, lighting_style } = req.body;

    // ── 1. Validate base64 ──────────────────────────────────────
    const validation = validateBase64(image_b64);
    if (!validation.valid) {
      const err = new Error('Invalid or missing base64 image. Provide a data URI (data:image/jpeg;base64,...).');
      err.statusCode = 400;
      throw err;
    }

    // ── 2. Validate & deduct credit ─────────────────────────────
    const creditsRemaining = await validateAndDeductCredit(req.user.userId);

    // ── 3. Generate job ID ──────────────────────────────────────
    const jobId = generateJobId();

    // ── 4. Upload input image to Cloudinary ─────────────────────
    const uploaded = await uploadBase64(image_b64, 'dhandha-studio/inputs');

    // ── 5. Create Firestore job (status: queued) ────────────────
    await createJob({
      job_id: jobId,
      type: 'generation',
      user_id: req.user.userId,
      original_job_id: null,
      input_image_url: uploaded.url,
      instruction: req.instruction,
      text_overlay: req.textOverlay,
      model_type: model_type || '',
    });

    // ── 6. Respond immediately ──────────────────────────────────
    res.status(202).json({
      status: 'queued',
      job_id: jobId,
      credits_remaining: creditsRemaining,
      eta_seconds: 45,
      check_status: `/status/${jobId}`,
    });

    // ── 7. Async background processing ──────────────────────────
    setImmediate(async () => {
      try {
        // Mark as processing
        await updateJob(jobId, { status: 'processing' });

        // Call Gemini
        const generated = await generateImage({
          inputImageUrl: uploaded.url,
          instruction: req.instruction,
          textOverlay: req.textOverlay,
          model_type,
          background_theme,
          clothing_category,
          lighting_style,
        });

        // Upload generated image to Cloudinary
        const outputUpload = await uploadBuffer(generated.buffer, 'dhandha-studio/outputs');

        // Update job to completed
        await updateJob(jobId, {
          status: 'completed',
          output_url: outputUpload.url,
          metadata: {
            width: outputUpload.width,
            height: outputUpload.height,
            text_applied: req.textOverlay || null,
          },
        });

        console.log(`[JOB] ${jobId} completed successfully.`);
      } catch (asyncError) {
        console.error(`[JOB] ${jobId} failed:`, asyncError.message);

        // Mark job as failed — do NOT refund credit automatically
        try {
          await updateJob(jobId, {
            status: 'failed',
            metadata: { error: asyncError.message },
          });
        } catch (updateError) {
          console.error(`[JOB] ${jobId} failed to update status:`, updateError.message);
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

export default { handleGenerate };
