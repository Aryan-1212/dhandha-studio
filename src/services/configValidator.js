/**
 * Config Validator Service
 * -------------------------
 * Validates and normalizes the incoming photoshoot configuration object
 * against the feature catalog and category definitions.
 *
 * Returns { valid, normalizedConfig, errors } — the controller should
 * reject the request if valid === false.
 */

import { VALID_CATEGORY_IDS, CATEGORY_MAP } from '../constants/categories.js';
import {
  POSES,
  MODEL_ETHNICITIES,
  FESTIVAL_THEMES,
  VARIANT_SHOTS,
  VALID_BACKGROUND_IDS,
  BACKGROUND_TYPES,
  COLOR_FILTERS,
  FRAME_TYPES,
  TEXT_FONT_STYLES,
  TEXT_BUBBLE_STYLES,
  LOGO_PLACEMENTS,
  ECOMMERCE_MODES,
  ASPECT_RATIOS,
  RESOLUTIONS,
  MULTIPOSE_OPTIONS,
} from '../constants/featureCatalog.js';

/**
 * Validate a single field against an allowed list.
 * Case-insensitive comparison; returns canonical value from allowed list.
 * @param {string} fieldName
 * @param {*} value
 * @param {string[]|Set<string>} allowed
 * @param {string[]} errors
 * @returns {string|null} canonical value from allowed list, or null
 */
const validateEnum = (fieldName, value, allowed, errors) => {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).toLowerCase().trim();
  const allowedArr = allowed instanceof Set ? [...allowed] : [...allowed];
  const canonical = allowedArr.find((a) => String(a).toLowerCase() === normalized);
  if (!canonical) {
    errors.push(`Invalid ${fieldName}: "${value}". Allowed: ${allowedArr.join(', ')}`);
    return null;
  }
  return canonical;
};

/**
 * Validate an array field — each item must be in the allowed list.
 * @param {string} fieldName
 * @param {*} value
 * @param {string[]} allowed
 * @param {string[]} errors
 * @returns {string[]} normalized array
 */
const validateEnumArray = (fieldName, value, allowed, errors) => {
  if (!value) return [];
  if (!Array.isArray(value)) {
    errors.push(`${fieldName} must be an array.`);
    return [];
  }
  const allowedSet = new Set(allowed);
  const result = [];
  for (const item of value) {
    const normalized = String(item).toLowerCase().trim();
    if (!allowedSet.has(normalized)) {
      errors.push(`Invalid ${fieldName} item: "${item}". Allowed: ${allowed.join(', ')}`);
    } else {
      result.push(normalized);
    }
  }
  return result;
};

/**
 * Validate and normalize the complete photoshoot configuration.
 *
 * @param {object} rawConfig  The raw config object from the request body
 * @returns {{ valid: boolean, normalizedConfig: object|null, errors: string[] }}
 */
export const validateConfig = (rawConfig) => {
  const errors = [];

  if (!rawConfig || typeof rawConfig !== 'object') {
    return { valid: false, normalizedConfig: null, errors: ['Config object is required.'] };
  }

  const normalized = {};

  // ── Category (required) ──────────────────────────────────────
  if (!rawConfig.category) {
    errors.push('category is required.');
  } else {
    normalized.category = validateEnum('category', rawConfig.category, VALID_CATEGORY_IDS, errors);

    // Kids age validation
    if (normalized.category) {
      const catDef = CATEGORY_MAP[normalized.category];
      if (catDef && catDef.requiresAge) {
        const age = parseInt(rawConfig.kidsAge, 10);
        if (!age || isNaN(age)) {
          errors.push(`kidsAge is required for category "${normalized.category}".`);
        } else if (age < catDef.ageRange.min || age > catDef.ageRange.max) {
          errors.push(`kidsAge must be between ${catDef.ageRange.min} and ${catDef.ageRange.max}.`);
        } else {
          normalized.kidsAge = age;
        }
      }
    }

    // Subcategory validation
    if (rawConfig.subcategory && normalized.category) {
      const catDef = CATEGORY_MAP[normalized.category];
      if (catDef) {
        const subNorm = String(rawConfig.subcategory).toLowerCase().trim();
        if (!catDef.subcategories.includes(subNorm)) {
          errors.push(`Invalid subcategory "${rawConfig.subcategory}" for category "${normalized.category}". Allowed: ${catDef.subcategories.join(', ')}`);
        } else {
          normalized.subcategory = subNorm;
        }
      }
    }
  }

  // ── Resolution (required — defaults to 2K) ──────────────────
  normalized.resolution = validateEnum('resolution', rawConfig.resolution || '2K', RESOLUTIONS, errors) || '2K';

  // ── Aspect Ratio (required — defaults to 1:1) ───────────────
  normalized.aspectRatio = validateEnum('aspectRatio', rawConfig.aspectRatio || '1:1', ASPECT_RATIOS, errors) || '1:1';

  // Custom aspect ratio dimensions
  if (normalized.aspectRatio === 'custom') {
    const cw = parseInt(rawConfig.customWidth, 10);
    const ch = parseInt(rawConfig.customHeight, 10);
    if (!cw || !ch || cw < 512 || ch < 512 || cw > 8192 || ch > 8192) {
      errors.push('Custom aspect ratio requires customWidth and customHeight (512–8192).');
    } else {
      normalized.customWidth = cw;
      normalized.customHeight = ch;
    }
  }

  // ── Optional Feature Fields ──────────────────────────────────
  normalized.pose = validateEnum('pose', rawConfig.pose, POSES, errors);
  normalized.modelEthnicity = validateEnum('modelEthnicity', rawConfig.modelEthnicity, MODEL_ETHNICITIES, errors);
  normalized.festivalTheme = validateEnum('festivalTheme', rawConfig.festivalTheme, FESTIVAL_THEMES, errors);
  normalized.variantShot = validateEnum('variantShot', rawConfig.variantShot, VARIANT_SHOTS, errors);
  normalized.colorFilter = validateEnum('colorFilter', rawConfig.colorFilter, COLOR_FILTERS, errors);
  normalized.frameType = validateEnum('frameType', rawConfig.frameType, FRAME_TYPES, errors);
  normalized.logoPlacement = validateEnum('logoPlacement', rawConfig.logoPlacement, LOGO_PLACEMENTS, errors);
  normalized.ecommerceMode = validateEnum('ecommerceMode', rawConfig.ecommerceMode, ECOMMERCE_MODES, errors);

  // ── Multipose ────────────────────────────────────────────────
  normalized.multipose = validateEnumArray('multipose', rawConfig.multipose, MULTIPOSE_OPTIONS, errors);

  // ── Background ───────────────────────────────────────────────
  if (rawConfig.background) {
    const bg = rawConfig.background;
    normalized.background = {};
    normalized.background.type = validateEnum('background.type', bg.type, VALID_BACKGROUND_IDS, errors);

    if (normalized.background.type) {
      const bgDef = Object.values(BACKGROUND_TYPES).find((b) => b.id === normalized.background.type);
      if (bgDef && bg.option) {
        const optNorm = String(bg.option).toLowerCase().trim();
        if (!bgDef.options.includes(optNorm)) {
          errors.push(`Invalid background option "${bg.option}" for type "${bg.type}". Allowed: ${bgDef.options.join(', ')}`);
        } else {
          normalized.background.option = optNorm;
        }
      }
    }

    // Pass through custom background color for studio solid
    if (bg.color) normalized.background.color = bg.color;
  }

  // ── Text Addition ────────────────────────────────────────────
  if (rawConfig.text) {
    const txt = rawConfig.text;
    normalized.text = {
      content: String(txt.content || '').trim(),
      fontSize: parseInt(txt.fontSize, 10) || 24,
      fontStyle: validateEnum('text.fontStyle', txt.fontStyle, TEXT_FONT_STYLES, errors) || 'sans_serif',
      color: txt.color || '#FFFFFF',
      bold: Boolean(txt.bold),
      italic: Boolean(txt.italic),
      underline: Boolean(txt.underline),
      bubbleStyle: validateEnum('text.bubbleStyle', txt.bubbleStyle, TEXT_BUBBLE_STYLES, errors) || 'none',
    };
  }

  // ── Logo URL ─────────────────────────────────────────────────
  if (rawConfig.logoUrl) {
    normalized.logoUrl = String(rawConfig.logoUrl).trim();
  }

  // ── Watermark ────────────────────────────────────────────────
  normalized.watermark = rawConfig.watermark !== false;

  // ── Product Data ─────────────────────────────────────────────
  if (rawConfig.product) {
    normalized.product = {
      productId: rawConfig.product.productId || null,
      name: rawConfig.product.name || null,
      mrp: rawConfig.product.mrp != null ? Number(rawConfig.product.mrp) : null,
      sizes: Array.isArray(rawConfig.product.sizes) ? rawConfig.product.sizes : [],
    };
  }

  return {
    valid: errors.length === 0,
    normalizedConfig: errors.length === 0 ? normalized : null,
    errors,
  };
};

export default { validateConfig };
