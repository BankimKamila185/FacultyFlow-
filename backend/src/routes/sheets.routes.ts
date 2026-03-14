import { Router } from 'express';
import { SheetsController } from '../controllers/sheets.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/',               authenticate, authorize('google:sheets'), SheetsController.listSheets);
router.post('/create',        authenticate, authorize('google:sheets'), SheetsController.createSheet);
router.get('/:spreadsheetId', authenticate, authorize('google:sheets'), SheetsController.getSheetData);
router.post('/writeback',     authenticate, authorize('google:sheets'), SheetsController.writeBackTaskStatus);

export default router;
