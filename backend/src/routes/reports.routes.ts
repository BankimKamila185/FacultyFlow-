import { Router } from 'express';
import { downloadPdf, downloadExcel } from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/pdf',   authenticate, authorize('report:download'), downloadPdf);
router.get('/excel', authenticate, authorize('report:download'), downloadExcel);

export default router;
