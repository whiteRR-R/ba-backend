import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware); // Все роуты защищены

router.get('/stats', userController.getStats);
router.put('/profile', userController.updateProfile);
router.get('/:id', userController.getUserById);
export default router;