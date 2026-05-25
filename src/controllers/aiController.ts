import { Response } from 'express';
import { AuthRequest } from '../types';
import { Challenge, Task, Submission } from '../models';
import { aiService } from '../services/aiService';
import { ENV } from '../config/env';

export const aiController = {

    // Добавь в конец объекта aiController:
    listModels: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(ENV.ANTHROPIC_API_KEY);

            // @ts-ignore
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${ENV.ANTHROPIC_API_KEY}`
            );
            const data = await response.json() as any;

            // Оставляем только модели которые поддерживают generateContent
            const usable = (data.models || [])
                .filter((m: any) =>
                    m.supportedGenerationMethods?.includes('generateContent')
                )
                .map((m: any) => m.name);

            res.json({ available_models: usable });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    },
    // POST /api/ai/generate-tasks
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
                language || 'ru'
            );

            // Удаляем старые AI задачи
            await Task.destroy({ where: { challengeId, isAiGenerated: true } });

            // Сохраняем новые задачи с дедлайнами
// ✅ Используем порядковый номер (i+1) вместо day
const savedTasks = await Task.bulkCreate(
  plan.tasks.map((t, i) => ({
    challengeId,
    title:        t.title,
    description:  t.description,
    day:          i + 1,               // ✅ 1, 2, 3... вместо 3, 6, 9...
    deadline:     new Date(t.deadline),
    isAiGenerated: true,
  }))
);

            console.log(`✅ Создано ${savedTasks.length} задач с дедлайнами`);
            res.json({ tasks: savedTasks, summary: plan.summary });

        } catch (error: any) {
            console.error('AI generateTasks error:', error.message);
            res.status(500).json({ message: 'Ошибка генерации: ' + error.message });
        }
    },

    // POST /api/ai/evaluate/:submissionId
    evaluateSubmission: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { submissionId } = req.params;
            const { language } = req.body;

            const submission = await Submission.findByPk(submissionId, {
                include: [{ model: Task, as: 'task' }],
            });

            if (!submission) {
                res.status(404).json({ message: 'Сабмишен не найден' });
                return;
            }

            const task = (submission as any).task as Task;

            console.log(`🤖 AI оценивает submission #${submissionId}`);

            const evaluation = await aiService.evaluateSubmission(
                task.title,
                task.description,
                submission.mediaUrl,
                submission.mediaType,
                language || 'ru'
            );

            // Сохраняем оценку в БД
            await submission.update({
                aiScore: evaluation.score,
                aiComment: evaluation.comment,
                score: evaluation.score,
            });

            console.log(`✅ AI оценил: ${evaluation.score}/100`);

            res.json(evaluation);
        } catch (error: any) {
            console.error('AI evaluate error:', error.message);
            res.status(500).json({ message: 'Ошибка AI оценки: ' + error.message });
        }
    },

    // POST /api/ai/chat
    chat: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { message, challengeId, language } = req.body;

            let context = 'Общий помощник B&A Challenge';

            if (challengeId) {
                const challenge = await Challenge.findByPk(challengeId);
                if (challenge) {
                    context = `Челлендж "${challenge.title}": ${challenge.description}`;
                }
            }

            const reply = await aiService.chat(message, context, language || 'ru');
            res.json({ reply });
        } catch (error: any) {
            console.error('AI chat error:', error.message);

            // Определяем тип ошибки
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