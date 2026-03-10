import { Router } from 'express';
import { getMyTasks, getAllTasks, updateTaskStatus, askReason, batchAskReason } from '../controllers/tasks.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * GET /api/tasks/my  — personalized tasks for logged-in faculty
 * (filtered by their email across all Responsible Person columns)
 */
router.get('/my', authenticate, getMyTasks);

/**
 * GET /api/tasks — all tasks (admin / dashboard view)
 */
router.get('/', authenticate, getAllTasks);

/**
 * PATCH /api/tasks/:id/status — update task status
 */
router.patch('/:id/status', authenticate, updateTaskStatus);

/**
 * POST /api/tasks/nudge-all — ask reason for ALL delayed tasks
 */
router.post('/nudge-all', authenticate, batchAskReason);

/**
 * POST /api/tasks/:id/ask-reason — ask reason for a delayed task
 */
router.post('/:id/ask-reason', authenticate, askReason);

export default router;
