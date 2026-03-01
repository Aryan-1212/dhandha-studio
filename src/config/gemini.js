/**
 * Google Gemini API Configuration
 * ---------------------------------
 * Initializes the Google Generative AI client.
 * Uses the `gemini-2.0-flash-exp` model for image generation capabilities.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required in environment variables.');
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

export { genAI, GEMINI_MODEL };
