import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { AuthRequest } from '../types';
import { Submission, Task, Participant, Challenge } from '../models';
import { ENV } from '../config/env';
import { encryptFile } from '../utils/fileEncryption';

export const submissionController = {

    // POST /api/submissions  (с файлом)
    create: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { taskId } = req.body;
            const userId = req.user!.id;
            const file = req.file;

            if (!file) {
                res.status(400).json({ message: 'Файл не загружен' });
                return;
            }

            // Проверяем что задача существует
            const task = await Task.findByPk(taskId);
            if (!task) {
                res.status(404).json({ message: 'Задача не найдена' });
                return;
            }

            // Проверяем что пользователь участник челленджа
            const participant = await Participant.findOne({
                where: { challengeId: task.challengeId, userId },
            });

            if (!participant) {
                res.status(403).json({ message: 'Ты не участник этого челленджа' });
                return;
            }

            // Определяем тип файла
            const isVideo = file.mimetype.startsWith('video/');
            const mediaType = isVideo ? 'video' : 'photo';

            // --- ШИФРОВАНИЕ ---
            // file.path содержит путь к загруженному файлу на диске
            const encryptedPath = encryptFile(file.path);
            // encryptedPath = uploads/photos/uuid.jpg.enc  (оригинал удалён)

            console.log(`🔐 Файл зашифрован: ${encryptedPath}`);

            // Сохраняем в БД зашифрованный путь (НЕ публичный URL)
            // Формат: enc:uploads/photos/uuid.jpg.enc
            const storedPath = `enc:${encryptedPath}`;

            const submission = await Submission.create({
                taskId: Number(taskId),
                userId,
                mediaUrl: storedPath,   // храним зашифрованный путь
                mediaType,
            });

            // Возвращаем клиенту подписанный URL для просмотра (через наш endpoint)
            const viewUrl = `${ENV.BASE_URL}/api/submissions/${submission.id}/media`;

            res.status(201).json({
                ...submission.toJSON(),
                mediaUrl: viewUrl,   // клиент получает защищённый URL
            });

        } catch (error: any) {
            console.error('Submission error:', error);
            res.status(500).json({ message: 'Ошибка загрузки файла' });
        }
    },

    // GET /api/submissions/task/:taskId
    getByTask: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { taskId } = req.params;
            const userId = req.user!.id;

            // Проверяем что пользователь участник этого челленджа
            const task = await Task.findByPk(taskId);
            if (!task) {
                res.status(404).json({ message: 'Задача не найдена' });
                return;
            }

            const participant = await Participant.findOne({
                where: { challengeId: task.challengeId, userId },
            });

            const challenge = await Challenge.findByPk(task.challengeId);
            const isCreator = challenge?.creatorId === userId;

            if (!participant && !isCreator) {
                res.status(403).json({ message: 'Нет доступа' });
                return;
            }

            const submissions = await Submission.findAll({
                where: { taskId: Number(taskId) },
                include: [
                    {
                        model: require('../models').User,
                        as: 'user',
                        attributes: ['id', 'username', 'avatarUrl'],
                    },
                ],
                order: [['createdAt', 'DESC']],
            });

            // Заменяем зашифрованный путь на защищённый URL для просмотра
            const result = submissions.map((s: any) => ({
                ...s.toJSON(),
                mediaUrl: s.mediaUrl.startsWith('enc:')
                    ? `${ENV.BASE_URL}/api/submissions/${s.id}/media`
                    : s.mediaUrl,   // старые записи без шифрования — оставляем как есть
            }));

            res.json(result);
        } catch (error) {
            console.error('getByTask error:', error);
            res.status(500).json({ message: 'Ошибка' });
        }
    },

    // GET /api/submissions/my/:challengeId
    getMySubmissions: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { challengeId } = req.params;
            const userId = req.user!.id;

            const tasks = await Task.findAll({
                where: { challengeId: Number(challengeId) },
            });
            const taskIds = tasks.map((t) => t.id);

            const submissions = await Submission.findAll({
                where: { userId, taskId: taskIds },
                include: [
                    {
                        model: Task,
                        as: 'task',
                        attributes: ['id', 'title', 'day'],
                    },
                ],
                order: [['createdAt', 'DESC']],
            });

            // Заменяем зашифрованный путь на защищённый URL
            const result = submissions.map((s: any) => ({
                ...s.toJSON(),
                mediaUrl: s.mediaUrl.startsWith('enc:')
                    ? `${ENV.BASE_URL}/api/submissions/${s.id}/media`
                    : s.mediaUrl,
            }));

            res.json(result);
        } catch (error) {
            res.status(500).json({ message: 'Ошибка' });
        }
    },

    // GET /api/submissions/:submissionId/media
    // Защищённый endpoint — расшифровывает и отдаёт файл только участникам
    serveMedia: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { submissionId } = req.params;
            const userId = req.user!.id;

            const submission = await Submission.findByPk(submissionId);
            if (!submission) {
                res.status(404).json({ message: 'Не найдено' });
                return;
            }

            // Проверка доступа — только участники челленджа
            const task = await Task.findByPk(submission.taskId);
            if (!task) {
                res.status(404).json({ message: 'Задача не найдена' });
                return;
            }

            const participant = await Participant.findOne({
                where: { challengeId: task.challengeId, userId },
            });

            const challenge = await Challenge.findByPk(task.challengeId);
            const isCreator = challenge?.creatorId === userId;
            const isOwner = submission.userId === userId;

            if (!participant && !isCreator && !isOwner) {
                res.status(403).json({ message: 'Нет доступа к этому файлу' });
                return;
            }

            // Если файл зашифрован — расшифровываем и отдаём
            if (submission.mediaUrl.startsWith('enc:')) {
                const encPath = submission.mediaUrl.replace('enc:', '');

                if (!fs.existsSync(encPath)) {
                    res.status(404).json({ message: 'Файл не найден или удалён' });
                    return;
                }

                const { decryptFile, getMimeType } = await import('../utils/fileEncryption');
                const decryptedBuffer = decryptFile(encPath);
                const mimeType = getMimeType(encPath);

                res.set('Content-Type', mimeType);
                res.set('Content-Length', String(decryptedBuffer.length));
                res.set('Cache-Control', 'private, max-age=3600');
                res.send(decryptedBuffer);
                return;
            }

            // Старые файлы без шифрования — редиректим на статику
            res.redirect(submission.mediaUrl);

        } catch (error: any) {
            console.error('serveMedia error:', error.message);
            res.status(500).json({ message: 'Ошибка получения файла' });
        }
    },
};