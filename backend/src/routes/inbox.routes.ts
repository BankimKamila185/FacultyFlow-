import { Router } from 'express';
import {
    syncInbox,
    getInbox,
    generateAutoReply,
    markAsRead,
    sendReply
} from '../controllers/inbox.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/sync', authenticate, syncInbox);
router.get('/', authenticate, getInbox);
router.post('/:id/auto-reply', authenticate, generateAutoReply);
router.patch('/:id/read', authenticate, markAsRead);
router.post('/:id/send-reply', authenticate, sendReply);

export default router;
