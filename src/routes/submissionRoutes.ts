import { Router } from 'express';
import { submissionController } from '../controllers/submissionController';
import { authMiddleware } from '../middleware/auth';
import { upload } from '../config/upload';

const router = Router();

router.use(authMiddleware);

// Загрузка доказательства (с шифрованием)
router.post('/', upload.single('media'), submissionController.create);

// Список сабмишенов по задаче
router.get('/task/:taskId', submissionController.getByTask);

// Мои сабмишены по челленджу
router.get('/my/:challengeId', submissionController.getMySubmissions);

// ✅ Защищённый endpoint — расшифровывает и отдаёт файл только участникам
router.get('/:submissionId/media', submissionController.serveMedia);

export default router;