import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/dashboard',         authenticate, authorize('analytics:read:own', 'analytics:read:department', 'analytics:read:all'), AnalyticsController.getDashboardMetrics);
router.get('/dashboard-metrics', authenticate, authorize('analytics:read:own', 'analytics:read:department', 'analytics:read:all'), AnalyticsController.getDashboardMetrics);
router.get('/productivity',      authenticate, authorize('analytics:read:department', 'analytics:read:all'), AnalyticsController.getFacultyProductivity);
router.get('/trends',            authenticate, authorize('analytics:read:own', 'analytics:read:department', 'analytics:read:all'), AnalyticsController.getTaskTrends);
router.get('/compliance',        authenticate, authorize('analytics:read:own', 'analytics:read:department', 'analytics:read:all'), AnalyticsController.getDeadlineCompliance);
router.get('/workflows',         authenticate, authorize('analytics:read:own', 'analytics:read:department', 'analytics:read:all'), AnalyticsController.getWorkflowBreakdown);
router.get('/departments',       authenticate, authorize('analytics:read:department', 'analytics:read:all'), AnalyticsController.getDepartmentSummaries);

export default router;
