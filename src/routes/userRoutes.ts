import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../config/upload';

const router = Router();

router.use(authMiddleware); // Все роуты защищены

router.post('/avatar', upload.single('avatar'), userController.uploadAvatar);
router.get('/stats', userController.getStats);
router.get('/coin-transactions', userController.getCoinTransactions);
router.put('/profile', userController.updateProfile);
router.get('/:id', userController.getUserById);
export default router;
