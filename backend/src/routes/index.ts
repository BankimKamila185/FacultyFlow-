import { Router } from 'express';
import { prisma } from '../models/prisma';
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
router.get('/health', async (req, res) => {
    try {
        // console.log('Pinged health check at:', new Date().toISOString());
        // Simple query to check database connectivity
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ 
            status: 'ok', 
            message: 'API is healthy',
            database: 'connected'
        });
    } catch (error) {
        res.status(503).json({ 
            status: 'error', 
            message: 'API is unhealthy',
            database: 'disconnected',
            error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
        });
    }
});

export default router;
