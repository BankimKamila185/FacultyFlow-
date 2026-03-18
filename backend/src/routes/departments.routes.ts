import { Router } from 'express';
import { FirestoreService } from '../services/FirestoreService';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const departments = await FirestoreService.getCollection('departments');
        res.json({ success: true, data: departments });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
