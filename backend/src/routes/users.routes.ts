import { Router } from 'express';
import { getFacultyProfile, updateFacultyProfile, getAllFacultyStats } from '../controllers/users.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public profile view by email — for debugging/admin
router.get('/profile/:email', getFacultyProfile);

// Authenticated route to update current user's profile
router.put('/profile', authenticate, updateFacultyProfile);

// Authenticated route to get all faculty stats (Admin only)
router.get('/', authenticate, getAllFacultyStats);

export default router;
