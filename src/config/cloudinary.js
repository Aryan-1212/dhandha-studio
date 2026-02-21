/**
 * Cloudinary Configuration
 * -------------------------
 * Configures the Cloudinary SDK with credentials from environment variables.
 * All uploads go through this single configured instance.
 */

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Always use HTTPS URLs
});

export default cloudinary;
