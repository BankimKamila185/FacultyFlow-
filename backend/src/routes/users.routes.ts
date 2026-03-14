import { Router } from 'express';
import { getFacultyProfile, updateFacultyProfile, getAllFacultyStats, updateUserRole, getMyPermissions } from '../controllers/users.controller';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';

const router = Router();

router.get('/me/permissions',  authenticate, getMyPermissions);
router.get('/profile/:email',  authenticate, authorize('user:read:own', 'user:read:department', 'user:read:all'), getFacultyProfile);
router.put('/profile',         authenticate, authorize('user:update:own'), updateFacultyProfile);
router.patch('/:id/role',      authenticate, authorize('user:role:update'), updateUserRole);
router.get('/',                authenticate, authorize('user:read:all', 'user:read:department'), getAllFacultyStats);

export default router;
