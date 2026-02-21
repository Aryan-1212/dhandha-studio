/**
 * Refine Routes
 * ---------------
 * GET /refine/:job_id/:refinement_instructions → handleRefine
 */

import { Router } from 'express';
import { handleRefine } from '../controllers/refineController.js';

const router = Router();

router.get('/:job_id/:refinement_instructions', handleRefine);

export default router;
