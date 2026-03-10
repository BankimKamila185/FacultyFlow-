import { Router } from 'express';
import { FormsController } from '../controllers/forms.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, FormsController.listForms);
router.post('/create', authenticate, FormsController.createForm);

export default router;
