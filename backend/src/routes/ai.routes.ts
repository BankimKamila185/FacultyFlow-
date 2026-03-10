import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/suggest', authenticate, AIController.suggestAssignments);
router.get('/health', authenticate, AIController.getGlobalHealth);
router.post('/prompt-email', authenticate, AIController.sendPromptEmail);
router.post('/draft-email', authenticate, AIController.draftPromptEmail);
router.post('/confirm-send', authenticate, AIController.confirmSendEmail);
router.post('/chat', authenticate, AIController.universalChat);

export default router;
