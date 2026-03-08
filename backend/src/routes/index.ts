import { Router } from 'express';
import usersRoutes from './users.routes';
import tasksRoutes from './tasks.routes';
import syncRoutes from './sync.routes';
import authRoutes from './auth.routes';
import inboxRoutes from './inbox.routes';
import analyticsRoutes from './analytics.routes';
import notificationsRoutes from './notifications.routes';
import googleRoutes from './google.routes';
import searchRoutes from './search.routes';
import driveRoutes from './drive.routes';
import workflowsRoutes from './workflows.routes';
import aiRoutes from './ai.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/tasks', tasksRoutes);
router.use('/sync', syncRoutes);
router.use('/inbox', inboxRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/google', googleRoutes);
router.use('/search', searchRoutes);
router.use('/drive', driveRoutes);
router.use('/workflows', workflowsRoutes);
router.use('/ai', aiRoutes);

// Health check
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'API is healthy' });
});

export default router;
