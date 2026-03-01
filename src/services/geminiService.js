/**
 * Gemini Image Generation Service
 * ---------------------------------
 * Uses Google Gemini (gemini-2.0-flash-exp) to generate / transform images.
 *
 * Flow:
 *   1. Fetch the input image from its URL → convert to base64
 *   2. Build a rich structured prompt from all parameters
 *   3. Send a multi-part request (text + inline image) to Gemini
 *   4. Extract the generated image from the response
 *   5. Return { buffer, mimeType, metadata }
 */

import { genAI, GEMINI_MODEL } from '../config/gemini.js';

/**
 * Build a detailed, structured prompt from the user-supplied parameters.
 */
const buildPrompt = ({ instruction, textOverlay, model_type, background_theme, clothing_category, lighting_style }) => {
  const parts = [
    `You are an expert AI image generation model specializing in fashion and portrait photography.`,
    ``,
    `## Task`,
    `Generate a high-quality, photorealistic image based on the following specifications.`,
    ``,
    `## Specifications`,
  ];

  if (model_type) parts.push(`- **Model Type**: ${model_type}`);
  if (background_theme) parts.push(`- **Background Theme**: ${background_theme}`);
  if (clothing_category) parts.push(`- **Clothing Category**: ${clothing_category}`);
  if (lighting_style) parts.push(`- **Lighting Style**: ${lighting_style}`);

  if (instruction) {
    parts.push(``, `## Custom Instruction`, instruction);
  }

  if (textOverlay) {
    parts.push(
      ``,
      `## Text Overlay`,
      `Apply the following text overlay on the generated image in an aesthetically appropriate position:`,
      `"${textOverlay}"`
    );
  }

  parts.push(
    ``,
    `## Guidelines`,
    `- Use the provided reference image as the base input.`,
    `- Maintain high resolution and natural colors.`,
    `- The output must be a single photorealistic image.`,
    `- Return ONLY the generated image, no additional text.`
  );

  return parts.join('\n');
};

/**
 * Fetch an image from a URL and convert to base64.
 *
 * @param {string} imageUrl
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
const fetchImageAsBase64 = async (imageUrl) => {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch input image: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { base64, mimeType: contentType.split(';')[0].trim() };
};

/**
 * Generate an image via Google Gemini.
 *
 * @param {object} params
 * @param {string} params.inputImageUrl   Cloudinary URL of the uploaded input image
 * @param {string} params.instruction     Custom instruction from x-instruction header
 * @param {string} params.textOverlay     Text overlay from x-textoverlay header
 * @param {string} params.model_type      e.g. "indian_male_20s"
 * @param {string} params.background_theme
 * @param {string} params.clothing_category
 * @param {string} params.lighting_style
 * @returns {Promise<{ buffer: Buffer, mimeType: string, metadata: object }>}
 */
export const generateImage = async ({
  inputImageUrl,
  instruction,
  textOverlay,
  model_type,
  background_theme,
  clothing_category,
  lighting_style,
}) => {
  // 1. Fetch the reference image
  const { base64: imageBase64, mimeType: imageMimeType } = await fetchImageAsBase64(inputImageUrl);

  // 2. Build prompt
  const promptText = buildPrompt({
    instruction,
    textOverlay,
    model_type,
    background_theme,
    clothing_category,
    lighting_style,
  });

  // 3. Image generation is handled by KIE, not Gemini. This function should not use Gemini for final image generation.
  // If you need to generate images, use kieService instead.

  // 4. Send multi-part content (text prompt + inline image)
  const result = await model.generateContent([
    { text: promptText },
    {
      inlineData: {
        mimeType: imageMimeType,
        data: imageBase64,
      },
    },
  ]);

  const response = result.response;

  // 5. Extract the image part from the response
  const candidates = response.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini returned no candidates.');
  }

  const parts = candidates[0].content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData);

  if (!imagePart) {
    throw new Error('Gemini response did not contain an image. The model may have returned only text.');
  }

  const outputBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  const outputMimeType = imagePart.inlineData.mimeType || 'image/png';

  // 6. Build metadata
  const metadata = {
    width: null,   // Will be populated from Cloudinary after upload
    height: null,
    text_applied: textOverlay || null,
    model_used: 'gemini-2.0-flash-exp',
    prompt_length: promptText.length,
  };

  return { buffer: outputBuffer, mimeType: outputMimeType, metadata };
};

export default { generateImage };
