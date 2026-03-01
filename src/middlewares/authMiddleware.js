/**
 * Authentication Middleware
 * --------------------------
 * Validates every incoming request against the Firestore `users` collection.
 *
 * Required headers:
 *   Authorization: Bearer <API_KEY>
 *   X-Client-ID: <client_id>         (optional — validated if present)
 *
 * On success, attaches:
 *   req.user = { userId, apiKey, credits, clientId, role }
 *   req.instruction   — from X-Instruction header
 *   req.textOverlay   — from X-TextOverlay header
 *
 * Role values: 'admin' | 'user' | 'client'
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
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return res.status(401).json({
        error: `Authorization header must be in format: Bearer <API_KEY>. Received: ${authHeader}`,
        code: 'AUTH_MALFORMED',
      });
    }

    const apiKey = match[1].trim();

    // ── 2b. Reject empty API key (never send Bearer with no key) ─
    if (!apiKey) {
      return res.status(401).json({
        error: 'Authorization header must be in format: Bearer <API_KEY>. API key cannot be empty.',
        code: 'AUTH_EMPTY_KEY',
      });
    }

    // ── 3. Validate API key against Firestore ──────────────────
    const user = await findUserByApiKey(apiKey);

    if (!user) {
      return res.status(403).json({
        error: 'Invalid API key.',
        code: 'AUTH_INVALID_KEY',
      });
    }

    // ── 4. Validate X-Client-ID header (if provided) ──────────
    const clientId = req.headers['x-client-id'];

    if (clientId && clientId !== user.clientId) {
      return res.status(403).json({
        error: 'X-Client-ID does not match the API key owner.',
        code: 'AUTH_CLIENT_MISMATCH',
      });
    }

    // ── 5. Attach user to request (including role) ─────────────
    req.user = {
      userId: user.userId,
      apiKey: user.apiKey,
      credits: user.credits,
      clientId: user.clientId,
      role: user.role || 'user',   // Default to 'user' if no role field exists
    };

    // Forward custom headers for downstream controllers
    req.instruction = req.headers['x-instruction'] || '';
    req.textOverlay = req.headers['x-textoverlay'] || '';

    next();
  } catch (error) {
    next(error);
  }
};

export default authMiddleware;
