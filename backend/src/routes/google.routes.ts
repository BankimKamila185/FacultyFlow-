import { Router } from 'express';
import { GoogleController } from '../controllers/google.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/health',                 GoogleController.healthCheck);
router.get('/calendar/events',        authenticate, authorize('google:calendar'), GoogleController.listCalendarEvents);
router.post('/calendar/events',       authenticate, authorize('google:calendar'), GoogleController.createCalendarEvent);
router.post('/calendar/task/:taskId', authenticate, authorize('google:calendar'), GoogleController.syncTaskToCalendar);

export default router;
