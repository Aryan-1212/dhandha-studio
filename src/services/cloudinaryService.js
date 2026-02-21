/**
 * Cloudinary Upload Service
 * --------------------------
 * Provides two upload methods:
 *   1. uploadBase64  — for user-submitted base64 images
 *   2. uploadBuffer  — for Gemini-generated image buffers
 *
 * Both return { url, width, height, public_id }.
 */

import cloudinary from '../config/cloudinary.js';

/**
 * Upload a base64-encoded image (with data-URI prefix).
 *
 * @param {string} base64String  Full data URI, e.g. "data:image/jpeg;base64,..."
 * @param {string} [folder='dhandha-studio/inputs']  Cloudinary folder
 * @returns {Promise<{ url: string, width: number, height: number, public_id: string }>}
 */
export const uploadBase64 = async (base64String, folder = 'dhandha-studio/inputs') => {
  const result = await cloudinary.uploader.upload(base64String, {
    folder,
    resource_type: 'image',
    overwrite: false,
    unique_filename: true,
  });

  return {
    url: result.secure_url,
    width: result.width,
    height: result.height,
    public_id: result.public_id,
  };
};

/**
 * Upload a raw image buffer (e.g. from Gemini output).
 *
 * We wrap the buffer upload in a Promise because Cloudinary's
 * upload_stream API is callback-based.
 *
 * @param {Buffer} buffer
 * @param {string} [folder='dhandha-studio/outputs']
 * @returns {Promise<{ url: string, width: number, height: number, public_id: string }>}
 */
export const uploadBuffer = async (buffer, folder = 'dhandha-studio/outputs') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        overwrite: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          width: result.width,
          height: result.height,
          public_id: result.public_id,
        });
      }
    );

    stream.end(buffer);
  });
};

export default { uploadBase64, uploadBuffer };
