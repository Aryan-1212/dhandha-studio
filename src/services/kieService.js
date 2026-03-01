/**
 * KIE Service — Pipeline Step 5 (PRIMARY IMAGE GENERATION ENGINE)
 * -----------------------------------------------------------------
 * This is the ONLY image generation endpoint in the platform.
 * Gemini is NEVER used for final image generation.
 *
 * KIE API endpoints (confirmed from official docs):
 *   POST  /api/v1/jobs/createTask          → submit job
 *   GET   /api/v1/jobs/recordInfo?taskId=  → poll status
 *
 * Poll response shape:
 *   { code, msg, data: { taskId, state, resultJson, failMsg, ... } }
 *   state values : 'success' | 'fail' | (anything else = still processing)
 *   resultJson   : JSON string → { resultUrls: ["https://..."] }
 */

import kieConfig from '../config/kie.js';

/**
 * Submit a generation job to KIE.
 *
 * @param {object} params
 * @param {string} params.compiledPrompt   Serialized prompt string from promptCompiler
 * @param {string} params.inputImageUrl    Cloudinary URL of the raw input image
 * @param {string} [params.aspectRatio]    e.g. '9:16'
 * @param {string} [params.resolution]     e.g. '1K'
 * @param {string} [params.outputFormat]   e.g. 'png'
 * @param {string} [params.callBackUrl]    Webhook URL (can be empty string)
 * @returns {Promise<{ kieJobId: string, status: string }>}
 */
export const submitGenerationJob = async ({
  compiledPrompt,
  inputImageUrl,
  aspectRatio,
  resolution,
  outputFormat,
  callBackUrl,
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), kieConfig.timeoutMs);

  try {
    const safeAspectRatio  = typeof aspectRatio  === 'string' && aspectRatio  ? aspectRatio  : '1:1';
    const safeResolution   = typeof resolution   === 'string' && resolution   ? resolution   : '1K';
    const safeOutputFormat = typeof outputFormat === 'string' && outputFormat ? outputFormat : 'png';

    const response = await fetch(`${kieConfig.baseUrl}/api/v1/jobs/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${kieConfig.apiKey}`,
        'X-Client':      'dhandha-studio',
      },
      body: JSON.stringify({
        model:       'nano-banana-pro',
        callBackUrl: typeof callBackUrl === 'string' ? callBackUrl : '',
        input: {
          prompt:        compiledPrompt,
          image_input:   inputImageUrl ? [inputImageUrl] : [],
          aspect_ratio:  safeAspectRatio,
          resolution:    safeResolution,
          output_format: safeOutputFormat,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`KIE API error (${response.status}): ${errorBody || response.statusText}`);
    }

    const data = await response.json();

    // Response shape: { code: 200, msg: "success", data: { taskId: "task_nano-banana-pro_..." } }
    const kieJobId = data?.data?.taskId || data?.data?.recordId || null;

    if (!kieJobId) {
      throw new Error(`KIE API returned no job ID. Full response: ${JSON.stringify(data)}`);
    }

    console.log(`[KIE] Job created: ${kieJobId}`);
    return { kieJobId, status: 'submitted' };

  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Poll KIE API for job status.
 *
 * @param {string} kieJobId
 * @returns {Promise<{ state: string, outputUrl: string|null, error: string|null }>}
 */
export const pollJobStatus = async (kieJobId) => {
  const response = await fetch(
    `${kieConfig.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(kieJobId)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${kieConfig.apiKey}`,
        'X-Client':      'dhandha-studio',
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`KIE poll error (${response.status}): ${errorBody || response.statusText}`);
  }

  const body = await response.json();

  // Response shape: { code, msg, data: { taskId, state, resultJson, failMsg, ... } }
  const data = body?.data || {};

  // resultJson is a JSON string: '{"resultUrls":["https://..."]}'
  let outputUrl = null;
  if (data.resultJson) {
    try {
      const parsed = JSON.parse(data.resultJson);
      outputUrl = parsed?.resultUrls?.[0] || null;
    } catch {
      // resultJson may occasionally be a plain URL string
      outputUrl = typeof data.resultJson === 'string' ? data.resultJson : null;
    }
  }

  return {
    state:     data.state     || 'processing',
    outputUrl,
    error:     data.failMsg   || data.errorMessage || null,
  };
};

/**
 * Full generation flow: submit → poll until done → buffer the result image.
 *
 * @param {object} params
 * @param {string} params.compiledPrompt
 * @param {string} params.inputImageUrl
 * @param {string} [params.aspectRatio]
 * @param {string} [params.resolution]
 * @param {string} [params.outputFormat]
 * @param {string} [params.callBackUrl]
 * @param {number} [params.pollIntervalMs=5000]
 * @param {number} [params.maxPollAttempts=60]
 * @param {function} [params.onProgress]
 * @returns {Promise<{ kieJobId: string, buffer: Buffer, mimeType: string, outputUrl: string|null }>}
 */
export const generateImage = async ({
  compiledPrompt,
  inputImageUrl,
  aspectRatio,
  resolution,
  outputFormat,
  callBackUrl,
  pollIntervalMs = 5000,
  maxPollAttempts = 60,
  onProgress = null,
}) => {
  // 1. Submit job
  const { kieJobId } = await submitGenerationJob({
    compiledPrompt,
    inputImageUrl,
    aspectRatio,
    resolution,
    outputFormat,
    callBackUrl,
  });

  // 2. Poll for completion
  let attempts  = 0;
  let lastState = null;

  while (attempts < maxPollAttempts) {
    await sleep(pollIntervalMs);
    attempts++;

    const pollResult = await pollJobStatus(kieJobId);
    lastState = pollResult.state;

    if (onProgress) onProgress({ attempt: attempts, state: pollResult.state });

    if (pollResult.state === 'success') {
      console.log(`[KIE] Job ${kieJobId} succeeded after ${attempts} polls.`);

      if (!pollResult.outputUrl) {
        throw new Error(`KIE job ${kieJobId} succeeded but returned no output URL.`);
      }

      // Fetch and buffer the result image
      const imgResponse = await fetch(pollResult.outputUrl);
      if (!imgResponse.ok) {
        throw new Error(`Failed to download KIE result image (${imgResponse.status}): ${pollResult.outputUrl}`);
      }

      const arrayBuffer = await imgResponse.arrayBuffer();
      return {
        kieJobId,
        buffer:    Buffer.from(arrayBuffer),
        mimeType:  imgResponse.headers.get('content-type')?.split(';')[0].trim() || 'image/png',
        outputUrl: pollResult.outputUrl,
      };
    }

    if (pollResult.state === 'fail') {
      throw new Error(`KIE generation failed for job ${kieJobId}: ${pollResult.error || 'Unknown error'}`);
    }

    console.log(`[KIE] Job ${kieJobId} — state: ${pollResult.state} (poll ${attempts}/${maxPollAttempts})`);
  }

  throw new Error(
    `KIE generation timed out after ${maxPollAttempts} polls (${(maxPollAttempts * pollIntervalMs) / 1000}s) for job ${kieJobId}. Last state: ${lastState}`
  );
};

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default { submitGenerationJob, pollJobStatus, generateImage };