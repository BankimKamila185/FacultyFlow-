import { Router } from 'express';
import { listFiles, createDoc, uploadFile } from '../controllers/drive.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/files', authenticate, listFiles);
router.post('/docs', authenticate, createDoc);
router.post('/upload', authenticate, uploadFile);

export default router;
