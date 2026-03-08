import { Router } from 'express';
import { getWorkflowProgress } from '../controllers/workflows.controller';

const router = Router();

router.get('/progress', getWorkflowProgress);

export default router;
