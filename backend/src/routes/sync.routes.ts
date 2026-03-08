import { Router } from 'express';
import { syncGoogleSheetsData, updateSheetUrl } from '../controllers/sync.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, syncGoogleSheetsData); // Use POST, normally triggered by admin or webhook
router.patch('/sheet-url', authenticate, updateSheetUrl);

export default router;
