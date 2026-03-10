import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/dashboard', authenticate, AnalyticsController.getDashboardMetrics);
router.get('/productivity', authenticate, AnalyticsController.getFacultyProductivity);
router.get('/trends', authenticate, AnalyticsController.getTaskTrends);
router.get('/compliance', authenticate, AnalyticsController.getDeadlineCompliance);
router.get('/workflows', authenticate, AnalyticsController.getWorkflowBreakdown);

export default router;
