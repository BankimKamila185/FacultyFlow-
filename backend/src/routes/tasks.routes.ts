import { Router } from 'express';
import { getMyTasks, getAllTasks, updateTaskStatus } from '../controllers/tasks.controller';
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

export default router;
