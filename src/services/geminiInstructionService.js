/**
 * Gemini Instruction Service — Pipeline Step 3
 * -----------------------------------------------
 * CONDITIONAL execution:
 *   - IF user instruction exists → refine it via Gemini
 *   - ELSE → use imageAnalysis.garmentDescription as finalInstruction
 *
 * This step converts a raw user instruction like "make it look premium"
 * into a precise, photography-oriented directive that the KIE prompt
 * compiler can use.
 */

import { genAI, GEMINI_MODEL } from '../config/gemini.js';

/**
 * Prompt template for instruction refinement.
 * @param {string} userInstruction
 * @param {object} imageAnalysis
 * @returns {string}
 */
const buildRefinementPrompt = (userInstruction, imageAnalysis) => {
  return `You are an expert AI-powered photoshoot director specializing in fashion and product photography.

## Context
A user has submitted a product image with the following analysis:
- Product Type: ${imageAnalysis.detectedProductType}
- Description: ${imageAnalysis.garmentDescription}
- Colors: ${imageAnalysis.dominantColors?.join(', ') || 'N/A'}
- Material: ${imageAnalysis.materialHints}
- Style: ${imageAnalysis.stylingInterpretation}

## User's Raw Instruction
"${userInstruction}"

## Your Task
Refine the user's instruction into a precise, detailed photoshoot directive. Your output should:
1. Be specific about lighting, angles, mood, and composition
2. Reference the product's actual colors and materials
3. Incorporate photography terminology
4. Be a single paragraph, 2-4 sentences maximum
5. Be directive (not conversational)

Return ONLY the refined instruction text. No quotes, no formatting, no explanation.`;
};

/**
 * Process the instruction step of the pipeline.
 *
 * @param {object} params
 * @param {string|null} params.userInstruction   Raw instruction from user (can be empty/null)
 * @param {object}      params.imageAnalysis     Output of geminiAnalysisService.analyzeImage()
 * @returns {Promise<{ finalInstruction: string, refinedInstruction: string|null, source: 'user_refined'|'analysis_derived' }>}
 */
export const processInstruction = async ({ userInstruction, imageAnalysis }) => {
  // CASE: No user instruction → derive from image analysis
  if (!userInstruction || userInstruction.trim() === '') {
    const derived = imageAnalysis.garmentDescription ||
      `${imageAnalysis.detectedProductType} product photography with ${imageAnalysis.stylingInterpretation || 'professional'} styling`;

    return {
      finalInstruction: derived,
      refinedInstruction: null,
      source: 'analysis_derived',
    };
  }

  // CASE: User instruction exists → refine via Gemini
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
    },
  });

  const prompt = buildRefinementPrompt(userInstruction, imageAnalysis);

  const result = await model.generateContent(prompt);
  const response = result.response;
  const refinedInstruction = response.text().trim();

  return {
    finalInstruction: refinedInstruction,
    refinedInstruction,
    source: 'user_refined',
  };
};

export default { processInstruction };
