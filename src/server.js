/**
 * ═══════════════════════════════════════════════════════════════
 *  Dhandha Studio — AI Photoshoot Platform-as-a-Service
 * ═══════════════════════════════════════════════════════════════
 *
 *  Architecture (KIE-Centric Pipeline)
 *  ────────────────────────────────────
 *  Client Request
 *    → Feature Configuration Intake
 *    → Gemini Image Analysis (Call #1 — ALWAYS)
 *    → Instruction Processing (Call #2 — CONDITIONAL)
 *    → Prompt Compilation Engine
 *    → KIE API Generation (PRIMARY ENGINE)
 *    → Cloudinary Storage
 *    → Job Update
 *    → Client Polling Response
 *
 *  Gemini = preprocessing intelligence ONLY.
 *  KIE    = the ONLY image generation engine.
 *
 *  Three Dashboard System
 *  ───────────────────────
 *  /admin   → Platform analytics, refund management, user/client mgmt
 *  /user    → Upload, history, credits, profile, refund requests
 *  /client  → API keys, usage analytics, billing, batch jobs
 *
 *  Pipeline Stages
 *  ────────────────
 *  intake → analysis → instruction → compilation → generation → completed | failed
 *
 * ═══════════════════════════════════════════════════════════════
 */

import 'dotenv/config';        // Load .env BEFORE all other imports
import { validateEnv } from './config/envValidation.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';

// Middleware
import rateLimiter from './middlewares/rateLimiter.js';
import authMiddleware from './middlewares/authMiddleware.js';
import errorHandler from './middlewares/errorHandler.js';

// Routes — Core Pipeline
import generateRoutes from './routes/generateRoutes.js';
import statusRoutes from './routes/statusRoutes.js';

// Routes — Dashboards
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import clientRoutes from './routes/clientRoutes.js';

// ── App Initialization ──────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

// ── Global Middleware Stack ─────────────────────────────────────
app.use(helmet());                           // Security headers
app.use(cors());                             // Cross-origin support
app.use(morgan('combined'));                 // HTTP request logging
app.use(express.json({ limit: '50mb' }));   // Parse JSON bodies (large limit for base64 images)
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(rateLimiter);                        // Rate limiting

// ── Health Check (unauthenticated) ──────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'dhandha-studio-platform',
    version: '2.0.0',
    architecture: 'KIE-centric',
    timestamp: new Date().toISOString(),
  });
});

// ── Authenticated Routes — Core Pipeline ────────────────────────
app.use('/generate', authMiddleware, generateRoutes);
app.use('/status', authMiddleware, statusRoutes);

// ── Authenticated Routes — Dashboards ───────────────────────────
// Each dashboard route group applies its own role middleware internally
app.use('/admin', authMiddleware, adminRoutes);
app.use('/user', authMiddleware, userRoutes);
app.use('/client', authMiddleware, clientRoutes);

// ── 404 Catch-All ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' });
});

// ── Global Error Handler (must be last) ─────────────────────────
app.use(errorHandler);

// ── Validate Environment (fail-fast before accepting requests) ────
validateEnv();

// ── Start Server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Dhandha Studio — AI Photoshoot Platform`);
  console.log(`   ├─ Port        : ${PORT}`);
  console.log(`   ├─ Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   ├─ Architecture: KIE-centric pipeline`);
  console.log(`   ├─ Dashboards  : admin | user | client`);
  console.log(`   └─ Ready       : ${new Date().toISOString()}\n`);
});

export default app;
