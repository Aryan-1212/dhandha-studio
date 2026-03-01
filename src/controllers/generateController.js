/**
 * Generate Controller — KIE-Centric Pipeline
 * ----------------------------------------------
 * Handles POST /generate
 *
 * Synchronous phase (before HTTP response):
 *   1. Validate & normalize config
 *   2. Apply ecommerce compliance rules
 *   3. Validate & deduct credit
 *   4. Upload input image to Cloudinary
 *   5. Create job record (pipelineStage: intake)
 *   6. Return immediate 202 response
 *
 * Asynchronous phase (setImmediate — after response):
 *   Step 2 → Gemini image analysis (ALWAYS)
 *   Step 3 → Gemini instruction refinement (CONDITIONAL)
 *   Step 4 → Prompt compilation
 *   Step 5 → KIE generation call (PRIMARY ENGINE)
 *   Step 6 → Upload to Cloudinary → mark completed
 *
 * Gemini is ONLY preprocessing intelligence.
 * KIE is the ONLY image generation engine.
 */

import { validateBase64 } from '../utils/validateBase64.js';
import { generateJobId } from '../utils/generateJobId.js';
import { validateAndDeductCredit, addCredits } from '../services/creditService.js';
import { createJob, updatePipelineStage } from '../services/jobService.js';
import { uploadBase64, uploadBuffer } from '../services/cloudinaryService.js';
import { validateConfig } from '../services/configValidator.js';
import { applyRules } from '../services/ruleEngine.js';
import { analyzeImage } from '../services/geminiAnalysisService.js';
import { processInstruction } from '../services/geminiInstructionService.js';
import { compilePrompt } from '../services/promptCompiler.js';
import { generateImage as kieGenerate } from '../services/kieService.js';
import { recordGenerationEvent } from '../services/analyticsService.js';
import { PIPELINE_STAGES } from '../constants/pipelineStages.js';

/**
 * POST /generate
 *
 * Request body:
 *   {
 *     image_b64: "data:image/jpeg;base64,...",
 *     config: { category, resolution, aspectRatio, pose, ... },
 *     instruction: "optional user instruction"
 *   }
 *
 * Headers (optional):
 *   X-Instruction: alternative instruction source
 *   X-TextOverlay: text overlay content
 */
export const handleGenerate = async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { image_b64, config: rawConfig, instruction: bodyInstruction } = req.body;

    // ── STEP 1: Feature Configuration Intake ───────────────────

    // 1a. Validate base64 image
    const validation = validateBase64(image_b64);
    if (!validation.valid) {
      const err = new Error('Invalid or missing base64 image. Provide a data URI (data:image/jpeg;base64,...).');
      err.statusCode = 400;
      throw err;
    }

    // 1b. Validate & normalize config
    const configResult = validateConfig(rawConfig);
    if (!configResult.valid) {
      const err = new Error(`Configuration validation failed: ${configResult.errors.join('; ')}`);
      err.statusCode = 400;
      throw err;
    }

    // 1c. Apply ecommerce compliance rules
    const ruleResult = applyRules(configResult.normalizedConfig);
    const normalizedConfig = ruleResult.config;

    // 1d. Validate & deduct credit (BEFORE generation)
    const creditsRemaining = await validateAndDeductCredit(req.user.userId);

    // 1e. Generate job ID
    const jobId = generateJobId();

    // 1f. Upload input image to Cloudinary
    const uploaded = await uploadBase64(image_b64, 'dhandha-studio/inputs');

    // 1g. Determine user instruction source
    const userInstruction = bodyInstruction || req.instruction || '';

    // 1h. Create job record
    await createJob({
      job_id: jobId,
      type: 'generation',
      user_id: req.user.userId,
      rawConfig: rawConfig || {},
      normalizedConfig,
      userInstruction: userInstruction || null,
      aspectRatio: normalizedConfig.aspectRatio,
      resolution: normalizedConfig.resolution,
      input_image_url: uploaded.url,
    });

    // ── Respond immediately (202 Accepted) ─────────────────────
    res.status(202).json({
      status: 'queued',
      job_id: jobId,
      pipelineStage: PIPELINE_STAGES.INTAKE,
      credits_remaining: creditsRemaining,
      eta_seconds: 60,
      check_status: `/status/${jobId}`,
      config_overrides: ruleResult.overrides.length ? ruleResult.overrides : undefined,
    });

    // ── ASYNC PIPELINE (runs after response is sent) ───────────
    setImmediate(async () => {
      try {
        // ── STEP 2: Gemini Image Analysis (ALWAYS) ─────────────
        await updatePipelineStage(jobId, PIPELINE_STAGES.ANALYSIS);

        const imageAnalysis = await analyzeImage(uploaded.url);

        await updatePipelineStage(jobId, PIPELINE_STAGES.ANALYSIS, {
          imageAnalysis,
        });

        console.log(`[JOB] ${jobId} — Analysis complete: ${imageAnalysis.detectedProductType}`);

        // ── STEP 3: Instruction Processing (CONDITIONAL) ───────
        await updatePipelineStage(jobId, PIPELINE_STAGES.INSTRUCTION);

        const instructionResult = await processInstruction({
          userInstruction,
          imageAnalysis,
        });

        await updatePipelineStage(jobId, PIPELINE_STAGES.INSTRUCTION, {
          refinedInstruction: instructionResult.refinedInstruction,
          finalInstruction: instructionResult.finalInstruction,
        });

        console.log(`[JOB] ${jobId} — Instruction (${instructionResult.source}): ${instructionResult.finalInstruction.substring(0, 80)}...`);

        // ── STEP 4: Prompt Compilation ─────────────────────────
        await updatePipelineStage(jobId, PIPELINE_STAGES.COMPILATION);

        const { prompt: compiledPrompt, promptString, dimensions } = compilePrompt({
          normalizedConfig,
          imageAnalysis,
          finalInstruction: instructionResult.finalInstruction,
          ruleOverrides: ruleResult.overrides,
          guidelines: ruleResult.guidelines,
          inputImageUrl: uploaded.url,
          headers: {
            textOverlay: req.textOverlay || null,
          },
        });

        await updatePipelineStage(jobId, PIPELINE_STAGES.COMPILATION, {
          finalPrompt: compiledPrompt,
        });

        console.log(`[JOB] ${jobId} — Prompt compiled (${dimensions.width}×${dimensions.height})`);

        // ── STEP 5: KIE Generation Call (PRIMARY ENGINE) ───────
        await updatePipelineStage(jobId, PIPELINE_STAGES.GENERATION);

        const kieResult = await kieGenerate({
           compiledPrompt: promptString,
           inputImageUrl: uploaded.url,
           aspectRatio: normalizedConfig.aspectRatio,
           resolution: normalizedConfig.resolution,
           outputFormat: normalizedConfig.outputFormat || 'png',
           callBackUrl: '',
        });

        // Upload KIE output to Cloudinary
        const outputUpload = await uploadBuffer(kieResult.buffer, 'dhandha-studio/outputs');

        // ── Mark completed ─────────────────────────────────────
        const durationMs = Date.now() - startTime;

        await updatePipelineStage(jobId, PIPELINE_STAGES.COMPLETED, {
          kieJobId: kieResult.kieJobId,
          outputUrl: outputUpload.url,
          output_url: outputUpload.url,  // Legacy compat
          metadata: {
            width: outputUpload.width,
            height: outputUpload.height,
            requestedWidth: dimensions.width,
            requestedHeight: dimensions.height,
            durationMs,
            kieJobId: kieResult.kieJobId,
            instructionSource: instructionResult.source,
            ecommerceMode: normalizedConfig.ecommerceMode || null,
          },
        });

        console.log(`[JOB] ${jobId} — COMPLETED in ${durationMs}ms`);

        // Record analytics
        await recordGenerationEvent({
          userId: req.user.userId,
          jobId,
          status: 'completed',
          durationMs,
          category: normalizedConfig.category,
        }).catch((e) => console.error(`[ANALYTICS] Failed to record event:`, e.message));

      } catch (asyncError) {
        console.error(`[JOB] ${jobId} — FAILED:`, asyncError.message);

        try {
          // Credit rollback — refund 1 credit on generation failure
          await addCredits(req.user.userId, 1).catch((e) =>
            console.error(`[JOB] ${jobId} — Credit rollback failed:`, e.message)
          );

          await updatePipelineStage(jobId, PIPELINE_STAGES.FAILED, {
            metadata: {
              error: asyncError.message,
              failedAt: new Date().toISOString(),
              durationMs: Date.now() - startTime,
            },
          });

          await recordGenerationEvent({
            userId: req.user.userId,
            jobId,
            status: 'failed',
            durationMs: Date.now() - startTime,
            category: normalizedConfig?.category || 'unknown',
          }).catch(() => {});

        } catch (updateError) {
          console.error(`[JOB] ${jobId} — Failed to update status:`, updateError.message);
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

export default { handleGenerate };