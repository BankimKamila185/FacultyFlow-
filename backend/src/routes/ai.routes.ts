import { Router } from 'express';
import { AIController } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/suggest', authenticate, AIController.suggestAssignments);
router.get('/health', authenticate, AIController.getGlobalHealth);
router.post('/prompt-email', authenticate, AIController.sendPromptEmail);

export default router;
