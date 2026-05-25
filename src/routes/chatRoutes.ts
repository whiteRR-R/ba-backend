import { Router } from 'express';
import { chatController } from '../controllers/chatController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/:roomType/:roomId',       chatController.getMessages);
router.post('/:roomType/:roomId',      chatController.sendMessage);
router.delete('/message/:messageId',   chatController.deleteMessage);

export default router;