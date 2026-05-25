import { Response } from 'express';
import { AuthRequest } from '../types';
import { Task, Challenge, Participant } from '../models';

// Пересчитываем дедлайны для всех задач челленджа
const recalculateDeadlines = async (challengeId: number) => {
  const challenge = await Challenge.findByPk(challengeId);
  if (!challenge) return;

  const tasks = await Task.findAll({
    where: { challengeId },
    order: [['day', 'ASC']],
  });

  if (tasks.length === 0) return;

  const start = new Date(challenge.startDate);
  const end   = new Date(challenge.endDate);
  const totalDays = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Равномерно делим дни между задачами
  const interval = Math.floor(totalDays / tasks.length);

  await Promise.all(
    tasks.map(async (task, i) => {
      const dayNumber = (i + 1) * interval;
      const deadline  = new Date(start);
      deadline.setDate(deadline.getDate() + dayNumber);

      await task.update({
        day:      i + 1,           // порядковый номер
        deadline: deadline,
      });
    })
  );
};

export const taskController = {

  // POST /api/tasks
  create: async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { challengeId, title, description } = req.body;
    const userId = req.user!.id;

    const challenge = await Challenge.findByPk(challengeId);
    if (!challenge) {
      res.status(404).json({ message: 'Челлендж не найден' });
      return;
    }

    if (challenge.creatorId !== userId) {
      res.status(403).json({ message: 'Только создатель может добавлять задачи' });
      return;
    }

    // ✅ Считаем сколько дней в челлендже
    const totalDays = Math.ceil(
      (new Date(challenge.endDate).getTime() - new Date(challenge.startDate).getTime()) /
      (1000 * 60 * 60 * 24)
    );

    // ✅ Считаем сколько задач уже есть
    const existingCount = await Task.count({ where: { challengeId } });

    if (existingCount >= totalDays) {
      res.status(400).json({
        message: `Нельзя добавить больше ${totalDays} задач — столько дней в челлендже`,
      });
      return;
    }

    await Task.create({
      challengeId,
      title,
      description,
      day:           existingCount + 1,
      deadline:      new Date(),
      isAiGenerated: false,
    });

    await recalculateDeadlines(challengeId);

    const updatedTasks = await Task.findAll({
      where: { challengeId },
      order: [['day', 'ASC']],
    });

    res.status(201).json(updatedTasks);
  } catch (error: any) {
    console.error('Task create error:', error.message);
    res.status(500).json({ message: 'Ошибка создания задачи' });
  }
},

  // PUT /api/tasks/:taskId
  update: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const { title, description } = req.body;
      const userId = req.user!.id;

      const task = await Task.findByPk(taskId);
      if (!task) {
        res.status(404).json({ message: 'Задача не найдена' });
        return;
      }

      const challenge = await Challenge.findByPk(task.challengeId);
      if (!challenge || challenge.creatorId !== userId) {
        res.status(403).json({ message: 'Только создатель может изменять задачи' });
        return;
      }

      await task.update({
        title:       title       ?? task.title,
        description: description ?? task.description,
      });

      res.json(task);
    } catch (error: any) {
      res.status(500).json({ message: 'Ошибка обновления задачи' });
    }
  },

  // DELETE /api/tasks/:taskId
  delete: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const userId = req.user!.id;

      const task = await Task.findByPk(taskId);
      if (!task) {
        res.status(404).json({ message: 'Задача не найдена' });
        return;
      }

      const challenge = await Challenge.findByPk(task.challengeId);
      if (!challenge || challenge.creatorId !== userId) {
        res.status(403).json({ message: 'Только создатель может удалять задачи' });
        return;
      }

      const { challengeId } = task;
      await task.destroy();

      // Пересчитываем дедлайны после удаления
      await recalculateDeadlines(challengeId);

      const updatedTasks = await Task.findAll({
        where: { challengeId },
        order: [['day', 'ASC']],
      });

      res.json(updatedTasks);
    } catch (error: any) {
      res.status(500).json({ message: 'Ошибка удаления задачи' });
    }
  },

  // PATCH /api/tasks/:taskId/reorder
  // Меняет порядок — сдвигает задачу вверх или вниз
  reorder: async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { direction } = req.body;
    const userId = req.user!.id;

    const task = await Task.findByPk(taskId);
    if (!task) {
      res.status(404).json({ message: 'Задача не найдена' });
      return;
    }

    const challenge = await Challenge.findByPk(task.challengeId);
    if (!challenge || challenge.creatorId !== userId) {
      res.status(403).json({ message: 'Нет прав' });
      return;
    }

    const allTasks = await Task.findAll({
      where: { challengeId: task.challengeId },
      order: [['day', 'ASC']],
    });

    const currentIndex = allTasks.findIndex((t) => t.id === task.id);
    const swapIndex    = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (swapIndex < 0 || swapIndex >= allTasks.length) {
      res.status(400).json({ message: 'Нельзя сдвинуть дальше' });
      return;
    }

    const swapTask = allTasks[swapIndex];

    // ✅ Проверяем — просрочена ли задача с которой меняемся
    const now = new Date();
    if (swapTask.deadline && new Date(swapTask.deadline) < now) {
      res.status(400).json({
        message: 'Нельзя поменяться местами с просроченной задачей',
      });
      return;
    }

    // ✅ Проверяем — просрочена ли сама задача
    if (task.deadline && new Date(task.deadline) < now) {
      res.status(400).json({
        message: 'Нельзя перемещать просроченную задачу',
      });
      return;
    }

    const tempTitle = task.title;
    const tempDesc  = task.description;
    const tempAI    = task.isAiGenerated;

    await task.update({
      title:         swapTask.title,
      description:   swapTask.description,
      isAiGenerated: swapTask.isAiGenerated,
    });

    await swapTask.update({
      title:         tempTitle,
      description:   tempDesc,
      isAiGenerated: tempAI,
    });

    const updatedTasks = await Task.findAll({
      where: { challengeId: task.challengeId },
      order: [['day', 'ASC']],
    });

    res.json(updatedTasks);
  } catch (error: any) {
    res.status(500).json({ message: 'Ошибка изменения порядка' });
  }
},
};