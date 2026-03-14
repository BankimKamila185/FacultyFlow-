import { Router } from 'express';
import { getMyTasks, getAllTasks, updateTaskStatus, askReason, batchAskReason } from '../controllers/tasks.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/my',           authenticate, authorize('task:read:own'), getMyTasks);
router.get('/',             authenticate, authorize('task:read:own', 'task:read:department', 'task:read:all'), getAllTasks);
router.patch('/:id/status', authenticate, authorize('task:update:own', 'task:update:any'), updateTaskStatus);
router.post('/nudge-all',   authenticate, authorize('task:nudge'), batchAskReason);
router.post('/:id/ask-reason', authenticate, authorize('task:nudge'), askReason);

export default router;
