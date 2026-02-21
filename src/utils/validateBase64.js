/**
 * Base64 Image Validator
 * -----------------------
 * Validates that a given string is a well-formed data-URI encoded image.
 * Supports JPEG, PNG, GIF, and WebP.
 *
 * Returns: { valid: boolean, mimeType: string, data: string }
 *   - mimeType  e.g. "image/jpeg"
 *   - data      the raw base64 payload (no prefix)
 */

/**
 * @param {string} base64String
 * @returns {{ valid: boolean, mimeType: string | null, data: string | null }}
 */
export const validateBase64 = (base64String) => {
  if (!base64String || typeof base64String !== 'string') {
    return { valid: false, mimeType: null, data: null };
  }

  // Match the data-URI header:  data:image/<subtype>;base64,<payload>
  const regex = /^data:image\/(jpeg|png|gif|webp);base64,(.+)$/i;
  const match = base64String.match(regex);

  if (!match) {
    return { valid: false, mimeType: null, data: null };
  }

  const mimeType = `image/${match[1].toLowerCase()}`;
  const data = match[2];

  // Sanity check — the payload should be non-trivially long
  if (data.length < 100) {
    return { valid: false, mimeType: null, data: null };
  }

  return { valid: true, mimeType, data };
};

export default validateBase64;
