import { Router } from 'express';
import { syncInbox, getInbox, generateAutoReply, markAsRead, sendReply } from '../controllers/inbox.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.post('/sync',           authenticate, authorize('inbox:sync'), syncInbox);
router.get('/',                authenticate, authorize('inbox:read'), getInbox);
router.post('/:id/auto-reply', authenticate, authorize('inbox:read'), generateAutoReply);
router.patch('/:id/read',      authenticate, authorize('inbox:read'), markAsRead);
router.post('/:id/send-reply', authenticate, authorize('inbox:read'), sendReply);

export default router;
