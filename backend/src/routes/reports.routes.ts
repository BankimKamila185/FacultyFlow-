import { Router } from 'express';
import { downloadPdf, downloadExcel } from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/pdf', authenticate, downloadPdf);
router.get('/excel', authenticate, downloadExcel);

export default router;
