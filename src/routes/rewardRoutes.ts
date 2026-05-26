import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rewardController } from '../controllers/rewardController';

const router = Router();

router.use(authMiddleware);

router.get('/streak', rewardController.getStreakStatus);
router.get('/spin/status', rewardController.getSpinStatus);
router.post('/spin/free', rewardController.spinFree);

export default router;
