/**
 * Authentication Middleware
 * --------------------------
 * Validates every incoming request against the Firestore `users` collection.
 *
 * Required headers:
 *   Authorization: Bearer <API_KEY>
 *   X-Client-ID: <client_id>
 *
 * On success, attaches `req.user` with { userId, apiKey, credits, clientId }.
 */

import { findUserByApiKey } from '../services/creditService.js';

const authMiddleware = async (req, res, next) => {
  try {
    // ── 1. Check Authorization header ──────────────────────────
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: 'Missing Authorization header.',
        code: 'AUTH_MISSING',
      });
    }

    // ── 2. Parse Bearer token ──────────────────────────────────
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Authorization header must be in format: Bearer <API_KEY>',
        code: 'AUTH_MALFORMED',
      });
    }

    const apiKey = parts[1];

    // ── 3. Validate API key against Firestore ──────────────────
    const user = await findUserByApiKey(apiKey);

    if (!user) {
      return res.status(403).json({
        error: 'Invalid API key.',
        code: 'AUTH_INVALID_KEY',
      });
    }

    // ── 4. Validate X-Client-ID header ─────────────────────────
    const clientId = req.headers['x-client-id'];

    if (clientId && clientId !== user.clientId) {
      return res.status(403).json({
        error: 'X-Client-ID does not match the API key owner.',
        code: 'AUTH_CLIENT_MISMATCH',
      });
    }

    // ── 5. Attach user to request ──────────────────────────────
    req.user = {
      userId: user.userId,
      apiKey: user.apiKey,
      credits: user.credits,
      clientId: user.clientId,
    };

    // Also forward custom headers for downstream controllers
    req.instruction = req.headers['x-instruction'] || '';
    req.textOverlay = req.headers['x-textoverlay'] || '';

    next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
