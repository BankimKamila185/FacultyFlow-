import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/suggest',       authenticate, authorize('ai:suggest'), AIController.suggestAssignments);
router.get('/health',        authenticate, authorize('ai:use'), AIController.getGlobalHealth);
router.post('/prompt-email', authenticate, authorize('ai:use'), AIController.sendPromptEmail);
router.post('/draft-email',  authenticate, authorize('ai:use'), AIController.draftPromptEmail);
router.post('/confirm-send', authenticate, authorize('ai:use'), AIController.confirmSendEmail);
router.post('/chat',         authenticate, authorize('ai:use'), AIController.universalChat);

export default router;
