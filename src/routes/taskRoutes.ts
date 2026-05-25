import { Router } from 'express';
import { taskController } from '../controllers/taskController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/',                    taskController.create);
router.put('/:taskId',              taskController.update);
router.delete('/:taskId',           taskController.delete);
router.patch('/:taskId/reorder',    taskController.reorder);

export default router;