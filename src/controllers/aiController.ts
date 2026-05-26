import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../types';
import { Challenge, Participant, Task, Submission } from '../models';
import { aiService } from '../services/aiService';
import { ENV } from '../config/env';

const normalizeLanguage = (language: string = 'ru'): 'ru' | 'kz' | 'en' => {
  const lang = String(language || 'ru').toLowerCase();
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('kz') || lang.startsWith('kk')) return 'kz';
  return 'ru';
};

export const aiController = {
  listModels: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await import('@google/generative-ai');

      // @ts-ignore
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${ENV.ANTHROPIC_API_KEY}`
      );
      const data = (await response.json()) as any;

      const usable = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m: any) => m.name);

      res.json({ available_models: usable });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  },

  generateTasks: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { challengeId, taskCount, language } = req.body;

      if (!taskCount || taskCount < 1) {
        res.status(400).json({ message: 'Укажи количество задач' });
        return;
      }

      const challenge = await Challenge.findByPk(challengeId);
      if (!challenge) {
        res.status(404).json({ message: 'Челлендж не найден' });
        return;
      }

      const plan = await aiService.generateTasks(
        challenge.title,
        challenge.description,
        challenge.startDate.toString(),
        challenge.endDate.toString(),
        Number(taskCount),
        normalizeLanguage(language)
      );

      await Task.destroy({ where: { challengeId, isAiGenerated: true } });

      const savedTasks = await Task.bulkCreate(
        plan.tasks.map((t, i) => ({
          challengeId,
          title: t.title,
          description: t.description,
          day: i + 1,
          deadline: new Date(t.deadline),
          isAiGenerated: true,
        }))
      );

      res.json({ tasks: savedTasks, summary: plan.summary });
    } catch (error: any) {
      console.error('AI generateTasks error:', error.message);
      res.status(500).json({ message: 'Ошибка генерации: ' + error.message });
    }
  },

  evaluateSubmission: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { submissionId } = req.params;
      const { language } = req.body;

      const submission = await Submission.findByPk(submissionId);

      if (!submission) {
        res.status(404).json({ message: 'Сабмишен не найден' });
        return;
      }

      const task = await Task.findByPk(submission.taskId);
      if (!task) {
        res.status(404).json({ message: 'Задача для сабмишена не найдена' });
        return;
      }

      const evaluation = await aiService.evaluateSubmission(
        task.title,
        task.description,
        submission.mediaUrl,
        submission.mediaType,
        normalizeLanguage(language)
      );

      await submission.update({
        aiScore: evaluation.score,
        aiComment: evaluation.comment,
        score: evaluation.score,
      });

      res.json(evaluation);
    } catch (error: any) {
      console.error('AI evaluate error:', error.message);
      res.status(500).json({ message: 'Ошибка AI оценки: ' + error.message });
    }
  },

  chat: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { message, challengeId, language } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ message: 'Пользователь не авторизован' });
        return;
      }

      const normalizedLanguage = normalizeLanguage(language);
      const now = new Date();
      const weekLater = new Date(now);
      weekLater.setDate(weekLater.getDate() + 7);

      const participations = await Participant.findAll({
        where: { userId },
        attributes: ['challengeId'],
        limit: 20,
      });
      const challengeIds = participations.map((p: any) => p.challengeId);

      if (challengeIds.length === 0) {
        const emptyReply =
          normalizedLanguage === 'kz'
            ? 'Сіз әлі ешбір челленджге қосылмағансыз.'
            : normalizedLanguage === 'en'
            ? 'You are not participating in any challenges yet.'
            : 'Вы пока не участвуете ни в одном челлендже.';
        res.json({ reply: emptyReply });
        return;
      }

      const challengeWhere: any = { id: { [Op.in]: challengeIds } };
      if (challengeId) challengeWhere.id = Number(challengeId);

      const challenges = await Challenge.findAll({
        where: challengeWhere,
        attributes: ['id', 'title', 'status', 'startDate', 'endDate'],
        order: [['updatedAt', 'DESC']],
        limit: 10,
      });

      const selectedChallengeIds = challenges.map((c: any) => c.id);

      const tasks = await Task.findAll({
        where: {
          challengeId: { [Op.in]: selectedChallengeIds },
        },
        attributes: ['id', 'challengeId', 'title', 'deadline', 'day'],
        order: [['deadline', 'ASC']],
        limit: 80,
      });

      const taskIds = tasks.map((t: any) => t.id);

      const submissions = taskIds.length
        ? await Submission.findAll({
            where: {
              userId,
              taskId: { [Op.in]: taskIds },
            },
            attributes: ['taskId', 'createdAt', 'score', 'aiScore'],
            order: [['createdAt', 'DESC']],
            limit: 120,
          })
        : [];

      const submittedTaskSet = new Set(submissions.map((s: any) => s.taskId));

      const overdueTasks = tasks
        .filter((t: any) => t.deadline && new Date(t.deadline) < now && !submittedTaskSet.has(t.id))
        .slice(0, 8)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline,
          challengeId: t.challengeId,
        }));

      const upcomingTasks = tasks
        .filter((t: any) => {
          if (!t.deadline) return false;
          const d = new Date(t.deadline);
          return d >= now && d <= weekLater;
        })
        .slice(0, 10)
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          deadline: t.deadline,
          challengeId: t.challengeId,
          submitted: submittedTaskSet.has(t.id),
        }));

      const challengeStats = challenges.map((c: any) => {
        const cTasks = tasks.filter((t: any) => t.challengeId === c.id);
        const done = cTasks.filter((t: any) => submittedTaskSet.has(t.id)).length;
        return {
          id: c.id,
          title: c.title,
          status: c.status,
          totalTasks: cTasks.length,
          completedTasks: done,
        };
      });

      const compactContext = {
        userId,
        now: now.toISOString(),
        challengeCount: challengeStats.length,
        challengeStats,
        overdueCount: overdueTasks.length,
        overdueTasks,
        upcomingWeekCount: upcomingTasks.length,
        upcomingTasks,
      };

      const reply = await aiService.chat(
        message,
        JSON.stringify(compactContext),
        normalizedLanguage
      );

      res.json({ reply });
    } catch (error: any) {
      console.error('AI chat error:', error.message);

      if (error.message?.includes('429')) {
        res.status(503).json({
          message: 'AI перегружен, попробуй через минуту ⏳',
        });
      } else {
        res.status(500).json({
          message: 'AI недоступен: ' + error.message?.slice(0, 100),
        });
      }
    }
  },
};
