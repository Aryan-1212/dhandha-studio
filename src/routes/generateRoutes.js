/**
 * Generate Routes
 * ----------------
 * POST /generate → handleGenerate
 */

import { Router } from 'express';
import { handleGenerate } from '../controllers/generateController.js';

const router = Router();

router.post('/', handleGenerate);

export default router;
