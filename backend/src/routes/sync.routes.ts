import { Router } from 'express';
import { syncGoogleSheetsData, updateSheetUrl, sendReminders } from '../controllers/sync.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.post('/',           authenticate, authorize('sync:trigger'), syncGoogleSheetsData);
router.patch('/sheet-url', authenticate, authorize('sync:trigger'), updateSheetUrl);
router.post('/reminders',  authenticate, authorize('sync:trigger'), sendReminders);

export default router;
