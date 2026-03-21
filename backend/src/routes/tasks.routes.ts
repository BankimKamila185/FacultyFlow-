import { Router } from 'express';
import { getMyTasks, getAllTasks, updateTaskStatus, askReason, batchAskReason, createTask, updateTask, quickAction } from '../controllers/tasks.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/my',           authenticate, authorize('task:read:own'), getMyTasks);
router.get('/',             authenticate, authorize('task:read:own', 'task:read:department', 'task:read:all'), getAllTasks);
router.get('/:id/quick-action', quickAction); // Public/email accessible route
router.post('/',            authenticate, authorize('task:create'), createTask);
router.patch('/:id/status', authenticate, authorize('task:update:own', 'task:update:any'), updateTaskStatus);
router.patch('/:id',        authenticate, authorize('task:update:any'), updateTask);
router.post('/nudge-all',   authenticate, authorize('task:nudge'), batchAskReason);
router.post('/:id/ask-reason', authenticate, authorize('task:nudge'), askReason);

router.post('/trigger-overdue', authenticate, async (req, res) => {
    try {
        const { runOverdueCheck } = await import('../jobs/worker');
        await runOverdueCheck();
        res.status(200).json({ status: 'ok', message: 'Overdue check triggered' });
    } catch (error: any) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

export default router;
