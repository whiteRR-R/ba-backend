import { Router } from 'express';
import { privacyController } from '../controllers/privacyController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Настройки приватности профиля
router.get('/profile',  privacyController.getProfilePrivacy);
router.patch('/profile', privacyController.updateProfilePrivacy);

export default router;