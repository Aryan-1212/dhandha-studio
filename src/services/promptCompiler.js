/**
 * Prompt Compiler — Pipeline Step 4
 * ------------------------------------
 * Merges all pipeline data into ONE deterministic master prompt object.
 *
 * Inputs:
 *   - normalizedConfig (post-ruleEngine)
 *   - imageAnalysis (from geminiAnalysisService)
 *   - finalInstruction (from geminiInstructionService)
 *   - computed dimensions (from aspectRatioEngine)
 *   - branding config (from brandingEngine)
 *   - ecommerce guidelines (from ruleEngine)
 *
 * Output:
 *   A structured JSON prompt object — NOT a string prompt.
 *   The KIE service consumes this object directly.
 */

import { calculateDimensions } from './aspectRatioEngine.js';
import { getBrandingConfig } from './brandingEngine.js';

/**
 * Compile the master prompt from all pipeline sources.
 *
 * @param {object} params
 * @param {object} params.normalizedConfig     Post-ruleEngine config
 * @param {object} params.imageAnalysis        Output of geminiAnalysisService
 * @param {string} params.finalInstruction     Output of geminiInstructionService
 * @param {object} params.ruleOverrides        Overrides applied by ruleEngine
 * @param {string[]} params.guidelines         Ecommerce guidelines from ruleEngine
 * @param {string} params.inputImageUrl        Cloudinary URL of the raw input
 * @param {object} [params.headers]            Custom headers from request
 * @returns {{ prompt: object, dimensions: object }}
 */
export const compilePrompt = ({
  normalizedConfig,
  imageAnalysis,
  finalInstruction,
  ruleOverrides = [],
  guidelines = [],
  inputImageUrl,
  headers = {},
}) => {
  // ── Compute final dimensions ─────────────────────────────────
  const dimensions = calculateDimensions({
    aspectRatio: normalizedConfig.aspectRatio,
    resolution: normalizedConfig.resolution,
    customWidth: normalizedConfig.customWidth,
    customHeight: normalizedConfig.customHeight,
  });

  // ── Compile branding config ──────────────────────────────────
  const branding = getBrandingConfig({
    watermark: normalizedConfig.watermark,
    logoUrl: normalizedConfig.logoUrl,
    logoPlacement: normalizedConfig.logoPlacement,
  });

  // ── Build the master prompt object ───────────────────────────
  const prompt = {
    version: '2.0',
    timestamp: new Date().toISOString(),

    // ── Core Directive ─────────────────────────────────────────
    instruction: finalInstruction,

    // ── Product Analysis (from Gemini) ─────────────────────────
    analysis: {
      productType: imageAnalysis.detectedProductType,
      description: imageAnalysis.garmentDescription,
      colors: imageAnalysis.dominantColors,
      material: imageAnalysis.materialHints,
      orientation: imageAnalysis.orientation,
      styling: imageAnalysis.stylingInterpretation,
    },

    // ── Category & Product ─────────────────────────────────────
    category: normalizedConfig.category,
    subcategory: normalizedConfig.subcategory || null,
    kidsAge: normalizedConfig.kidsAge || null,
    product: normalizedConfig.product || null,

    // ── Photography Config ─────────────────────────────────────
    pose: normalizedConfig.pose || null,
    modelEthnicity: normalizedConfig.modelEthnicity || null,
    variantShot: normalizedConfig.variantShot || null,
    multipose: normalizedConfig.multipose?.length ? normalizedConfig.multipose : null,

    // ── Visual Config ──────────────────────────────────────────
    background: normalizedConfig.background || null,
    colorFilter: normalizedConfig.colorFilter || null,
    festivalTheme: normalizedConfig.festivalTheme || null,

    // ── Composition ────────────────────────────────────────────
    frameType: normalizedConfig.frameType || null,
    text: normalizedConfig.text || null,

    // ── Branding ───────────────────────────────────────────────
    branding,

    // ── Dimensions ─────────────────────────────────────────────
    dimensions: {
      width: dimensions.width,
      height: dimensions.height,
      aspectRatio: dimensions.aspectRatio,
      resolution: dimensions.resolution,
    },

    // ── Ecommerce Compliance ───────────────────────────────────
    ecommerceMode: normalizedConfig.ecommerceMode || null,
    complianceGuidelines: guidelines.length ? guidelines : null,
    configOverrides: ruleOverrides.length ? ruleOverrides : null,

    // ── Source Reference ───────────────────────────────────────
    inputImageUrl,
  };

  return { prompt, promptString: JSON.stringify(prompt), dimensions };
};

/**
 * Serialize the prompt to a deterministic string for logging/debugging.
 * @param {object} prompt
 * @returns {string}
 */
export const serializePrompt = (prompt) => {
  return JSON.stringify(prompt, null, 2);
};

export default { compilePrompt, serializePrompt };