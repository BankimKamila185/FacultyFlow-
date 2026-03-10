import { Router } from 'express';
import { SheetsController } from '../controllers/sheets.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, SheetsController.listSheets);
router.post('/create', authenticate, SheetsController.createSheet);
router.get('/:spreadsheetId', authenticate, SheetsController.getSheetData);
router.post('/writeback', authenticate, SheetsController.writeBackTaskStatus);

export default router;
