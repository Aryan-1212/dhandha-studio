/**
 * ═══════════════════════════════════════════════════════════════
 *  Dhandha Studio — AI Image Generation Backend
 * ═══════════════════════════════════════════════════════════════
 *
 *  Architecture
 *  ─────────────
 *  Express server → Middleware chain → Routes → Controllers
 *                                                    │
 *                            ┌────────────────────────┘
 *                            ▼
 *                    Services (credit, job, gemini, cloudinary)
 *                            │
 *                            ▼
 *              External APIs  (Firebase, Cloudinary, Gemini)
 *
 *  Async Processing
 *  ─────────────────
 *  After the HTTP response is sent, image generation runs as a
 *  background task via setImmediate. The client polls /status/:job_id
 *  to check progress.
 *
 *  Credit System
 *  ──────────────
 *  Every generation or refinement atomically deducts 1 credit
 *  from the user's Firestore balance using a transaction.
 *  Failed jobs do NOT automatically refund credits.
 *
 * ═══════════════════════════════════════════════════════════════
 */

import 'dotenv/config';        // Load .env BEFORE all other imports
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

// Middleware
import rateLimiter from './middlewares/rateLimiter.js';
import authMiddleware from './middlewares/authMiddleware.js';
import errorHandler from './middlewares/errorHandler.js';

// Routes
import generateRoutes from './routes/generateRoutes.js';
import refineRoutes from './routes/refineRoutes.js';
import statusRoutes from './routes/statusRoutes.js';

// ── App Initialization ──────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ── Global Middleware Stack ─────────────────────────────────────
app.use(helmet());                           // Security headers
app.use(cors());                             // Cross-origin support
app.use(morgan('combined'));                 // HTTP request logging
app.use(express.json({ limit: '50mb' }));   // Parse JSON bodies (large limit for base64 images)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(rateLimiter);                        // 10 req/sec rate limit

// ── Health Check (unauthenticated) ──────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'dhandha-studio-backend',
    timestamp: new Date().toISOString(),
  });
});

// ── Authenticated Routes ────────────────────────────────────────
app.use('/generate', authMiddleware, generateRoutes);
app.use('/refine', authMiddleware, refineRoutes);
app.use('/status', authMiddleware, statusRoutes);

// ── 404 Catch-All ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' });
});

// ── Global Error Handler (must be last) ─────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Dhandha Studio Backend`);
  console.log(`   ├─ Port        : ${PORT}`);
  console.log(`   ├─ Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   └─ Ready       : ${new Date().toISOString()}\n`);
});

export default app;
