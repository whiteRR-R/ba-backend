import { Response } from 'express';
import fs from 'fs';
import { AuthRequest } from '../types';
import { Submission, Task, Participant, Challenge } from '../models';
import { ENV } from '../config/env';
import { uploadToCloudinary } from '../utils/cloudinary';

const toClientMediaUrl = (submission: { id: number; mediaUrl: string }): string => {
  if (submission.mediaUrl.startsWith('enc:')) {
    return `${ENV.BASE_URL}/api/submissions/${submission.id}/media`;
  }

  return submission.mediaUrl;
};

export const submissionController = {
  create: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.body;
      const userId = req.user!.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ message: 'Файл не загружен' });
        return;
      }

      const task = await Task.findByPk(taskId);
      if (!task) {
        res.status(404).json({ message: 'Задача не найдена' });
        return;
      }

      const participant = await Participant.findOne({
        where: { challengeId: task.challengeId, userId },
      });

      if (!participant) {
        res.status(403).json({ message: 'Ты не участник этого челленджа' });
        return;
      }

      const isVideo = file.mimetype.startsWith('video/');
      const mediaType = isVideo ? 'video' : 'photo';

      const mediaUrl = await uploadToCloudinary(file.path, mediaType);

      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      const submission = await Submission.create({
        taskId: Number(taskId),
        userId,
        mediaUrl,
        mediaType,
      });

      res.status(201).json({
        ...submission.toJSON(),
        mediaUrl,
      });
    } catch (error: any) {
      console.error('Submission error:', error);
      res.status(500).json({ message: 'Ошибка загрузки файла' });
    }
  },

  getByTask: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const userId = req.user!.id;

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

      const result = submissions.map((s: any) => ({
        ...s.toJSON(),
        mediaUrl: toClientMediaUrl({ id: s.id, mediaUrl: s.mediaUrl }),
      }));

      res.json(result);
    } catch (error) {
      console.error('getByTask error:', error);
      res.status(500).json({ message: 'Ошибка' });
    }
  },

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

      const result = submissions.map((s: any) => ({
        ...s.toJSON(),
        mediaUrl: toClientMediaUrl({ id: s.id, mediaUrl: s.mediaUrl }),
      }));

      res.json(result);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка' });
    }
  },

  serveMedia: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { submissionId } = req.params;
      const userId = req.user!.id;

      const submission = await Submission.findByPk(submissionId);
      if (!submission) {
        res.status(404).json({ message: 'Не найдено' });
        return;
      }

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

      res.redirect(submission.mediaUrl);
    } catch (error: any) {
      console.error('serveMedia error:', error.message);
      res.status(500).json({ message: 'Ошибка получения файла' });
    }
  },
};
