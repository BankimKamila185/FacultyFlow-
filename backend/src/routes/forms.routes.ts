import { Router } from 'express';
import { FormsController } from '../controllers/forms.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/',        authenticate, authorize('google:forms'), FormsController.listForms);
router.post('/create', authenticate, authorize('google:forms'), FormsController.createForm);

export default router;
