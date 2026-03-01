/**
 * Environment Variable Validation
 * --------------------------------
 * Fail-fast validation of required env vars on server start.
 * Prevents runtime errors when keys are missing.
 */

const REQUIRED = [
  'KIE_API_URL',
  'KIE_API_KEY',
  'GEMINI_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

/**
 * Validate required environment variables.
 * @throws {Error} If any required var is missing or empty
 */
export const validateEnv = () => {
  const missing = REQUIRED.filter((key) => {
    const val = process.env[key];
    return val === undefined || val === null || String(val).trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing or empty required environment variables: ${missing.join(', ')}. ` +
      'Check .env and ensure all keys are set before starting the server.'
    );
  }
};

export default { validateEnv };
