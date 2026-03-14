import { Router } from 'express';
import { listFiles, createDoc, uploadFile } from '../controllers/drive.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/files',   authenticate, authorize('google:drive'), listFiles);
router.post('/docs',   authenticate, authorize('google:drive'), createDoc);
router.post('/upload', authenticate, authorize('google:drive'), uploadFile);

export default router;
