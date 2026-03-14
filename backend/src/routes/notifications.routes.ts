import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notifications.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/',           authenticate, authorize('notification:read:own'), getNotifications);
router.patch('/read-all', authenticate, authorize('notification:read:own'), markAllAsRead);
router.patch('/:id/read', authenticate, authorize('notification:read:own'), markAsRead);

export default router;
