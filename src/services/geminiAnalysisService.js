/**
 * Gemini Analysis Service — Pipeline Step 2
 * -------------------------------------------
 * ALWAYS runs. Sends the raw input image to Gemini for structured analysis.
 *
 * Returns a JSON object with:
 *   - detectedProductType
 *   - garmentDescription
 *   - dominantColors
 *   - materialHints
 *   - orientation
 *   - stylingInterpretation
 *   - categorySuggestions
 *
 * Uses Gemini in TEXT-ONLY response mode (no image generation here).
 */

import { genAI, GEMINI_MODEL } from '../config/gemini.js';

/**
 * The analysis prompt instructs Gemini to return structured JSON.
 */
const ANALYSIS_PROMPT = `You are an expert fashion and product photography analyst.

Analyze the provided image and return a JSON object with EXACTLY these fields (no markdown, no explanation — only valid JSON):

{
  "detectedProductType": "string — e.g. 't-shirt', 'saree', 'sneakers', 'necklace', 'bedsheet'",
  "garmentDescription": "string — detailed description of the garment/product visible",
  "dominantColors": ["array of dominant color names found in the product"],
  "materialHints": "string — fabric or material type if detectable (e.g. 'cotton', 'silk', 'leather', 'metal')",
  "orientation": "string — 'front', 'back', 'side', 'flat_lay', '45_degree'",
  "stylingInterpretation": "string — overall style vibe (e.g. 'casual streetwear', 'formal ethnic', 'minimalist modern')",
  "categorySuggestions": ["array of 1-3 suggested category IDs from: men, women, kids_boys, kids_girls, footwear_men, footwear_women, footwear_kids, jewellery, bags, towel, bedsheet, doormats, curtains, duvets"]
}

Return ONLY the JSON object. No markdown code fences. No additional text.`;

/**
 * Fetch an image from a URL and convert to base64.
 * @param {string} imageUrl
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
const fetchImageAsBase64 = async (imageUrl) => {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch input image for analysis: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  return { base64, mimeType: contentType.split(';')[0].trim() };
};

/**
 * Analyze a product image using Gemini.
 *
 * @param {string} imageUrl  Cloudinary URL of the uploaded raw image
 * @returns {Promise<object>}  Structured analysis result
 */
export const analyzeImage = async (imageUrl) => {
  const { base64, mimeType } = await fetchImageAsBase64(imageUrl);

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const result = await model.generateContent([
    { text: ANALYSIS_PROMPT },
    {
      inlineData: {
        mimeType,
        data: base64,
      },
    },
  ]);

  const response = result.response;
  const text = response.text();

  // Parse the JSON response
  let analysis;
  try {
    analysis = JSON.parse(text);
  } catch {
    // Try to extract JSON from response if wrapped in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error(`Gemini analysis returned unparseable response: ${text.substring(0, 200)}`);
    }
  }

  // Ensure required fields exist with defaults
  return {
    detectedProductType: analysis.detectedProductType || 'unknown',
    garmentDescription: analysis.garmentDescription || '',
    dominantColors: Array.isArray(analysis.dominantColors) ? analysis.dominantColors : [],
    materialHints: analysis.materialHints || 'unknown',
    orientation: analysis.orientation || 'front',
    stylingInterpretation: analysis.stylingInterpretation || '',
    categorySuggestions: Array.isArray(analysis.categorySuggestions) ? analysis.categorySuggestions : [],
  };
};

export default { analyzeImage };
