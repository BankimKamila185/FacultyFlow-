import { Router } from 'express';
import { syncGoogleSheetsData, updateSheetUrl } from '../controllers/sync.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.post('/',           authenticate, authorize('sync:trigger'), syncGoogleSheetsData);
router.patch('/sheet-url', authenticate, authorize('sync:trigger'), updateSheetUrl);

export default router;
