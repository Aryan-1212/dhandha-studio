/**
 * Rate Limiter Middleware
 * ------------------------
 * Global rate limit: 10 requests per second per IP.
 * Returns 429 with a structured JSON body when exceeded.
 */

import rateLimit from 'express-rate-limit';

const rateLimiter = rateLimit({
  windowMs: 1000,  // 1-second window
  max: 10,         // 10 requests per window per IP
  standardHeaders: true,   // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,    // Disable `X-RateLimit-*` headers

  message: {
    error: 'Too many requests. Please slow down.',
    code: 'RATE_LIMIT_EXCEEDED',
    retry_after_ms: 1000,
  },

  handler: (_req, res, _next, options) => {
    res.status(429).json(options.message);
  },
});

export default rateLimiter;
