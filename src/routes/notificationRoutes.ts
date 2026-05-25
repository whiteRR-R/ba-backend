import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', notificationController.getAll);
router.get('/count', notificationController.getUnreadCount);
router.patch('/read-all', notificationController.markAllRead);
router.delete('/clear-all', notificationController.clearAll);
router.patch('/:id/read', notificationController.markRead);
router.delete('/:id', notificationController.deleteOne);

export default router;