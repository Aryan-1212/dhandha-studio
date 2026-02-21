/**
 * Status Routes
 * ---------------
 * GET /status/:job_id → handleStatus
 */

import { Router } from 'express';
import { handleStatus } from '../controllers/statusController.js';

const router = Router();

router.get('/:job_id', handleStatus);

export default router;
