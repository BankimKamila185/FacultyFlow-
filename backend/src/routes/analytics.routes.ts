import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';

const router = Router();

router.get('/dashboard', AnalyticsController.getDashboardMetrics);
router.get('/productivity', AnalyticsController.getFacultyProductivity);
router.get('/trends', AnalyticsController.getTaskTrends);
router.get('/compliance', AnalyticsController.getDeadlineCompliance);
router.get('/workflows', AnalyticsController.getWorkflowBreakdown);

export default router;
