import { Router } from 'express';
import { aiController } from '../controllers/aiController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/generate-tasks',          aiController.generateTasks);
router.post('/evaluate/:submissionId',  aiController.evaluateSubmission);
router.post('/chat',                    aiController.chat);

// ✅ Временный роут для проверки доступных моделей
// router.get('/models', aiController.listModels);

export default router;