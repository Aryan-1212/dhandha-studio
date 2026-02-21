/**
 * Global Error Handler Middleware
 * --------------------------------
 * Catches all errors thrown or passed via next(err) and returns
 * a consistent JSON error response.
 *
 * Supported status codes: 400, 401, 402, 403, 404, 429, 500.
 * Any unrecognised code defaults to 500.
 */

/* eslint-disable no-unused-vars */
const errorHandler = (err, _req, res, _next) => {
  // Determine HTTP status — prefer explicit statusCode, fall back to 500
  const statusCode = err.statusCode || err.status || 500;

  // Build response body
  const body = {
    error: err.message || 'Internal Server Error',
    code: err.code || 'SERVER_ERROR',
  };

  // In development, include stack trace for debugging
  if (process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  // Log the error (never log sensitive fields like API keys)
  console.error(`[ERROR] ${statusCode} — ${err.message}`);

  res.status(statusCode).json(body);
};

export default errorHandler;
