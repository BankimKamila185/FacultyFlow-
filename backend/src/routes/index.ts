import { Router } from 'express';
import authRoutes from './auth.routes';
import taskRoutes from './tasks.routes';
import analyticsRoutes from './analytics.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/tasks', taskRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
