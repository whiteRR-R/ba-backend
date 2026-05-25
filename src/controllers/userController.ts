import { Response } from 'express';
import { AuthRequest } from '../types';
import { User, Submission, Vote, Participant, Task, Challenge } from '../models';

export const userController = {
  getStats: async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    console.log(`📊 getStats для userId: ${userId}`);

    const submissions = await Submission.findAll({
      where: { userId },
      attributes: ['id', 'score'],
    });
    console.log(`📊 Сабмишенов: ${submissions.length}`);

    const submissionIds = submissions.map((s) => s.id);

    let avgRating      = 0;
    let totalVoters    = 0;
    let totalVoteCount = 0;

    if (submissionIds.length > 0) {
      const votes = await Vote.findAll({
        where: { submissionId: submissionIds },
        attributes: ['score', 'voterId'],
      });

      console.log(`📊 Голосов получено: ${votes.length}`);
      totalVoteCount = votes.length;
      totalVoters = new Set(votes.map((v: { voterId: number }) => v.voterId)).size;

avgRating = votes.length > 0
  ? Math.round(
      votes.reduce((sum: number, v: { score: number }) => sum + v.score, 0) / votes.length * 100
    ) / 100
  : 0;
    }

    const challengeCount = await Participant.count({ where: { userId } });

    let wonCount = 0;
    const participations = await Participant.findAll({
      where: { userId },
    });

    for (const p of participations) {
      const challenge = await Challenge.findByPk(p.challengeId);
      if (!challenge || challenge.status !== 'completed') continue;

      const top = await Participant.findOne({
        where: { challengeId: p.challengeId },
        order: [['score', 'DESC']],
      });

      if (top && top.userId === userId) wonCount++;
    }

    const result = {
      avgRating,
      totalVoters,
      totalVoteCount,
      challengeCount,
      wonCount,
      submissionCount: submissions.length,
    };

    console.log('📊 Результат stats:', result);
    res.json(result);

  } catch (error: any) {
    console.error('getStats error:', error.message);
    res.status(500).json({ message: 'Ошибка статистики: ' + error.message });
  }
},
  updateProfile: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { username } = req.body;
      const userId = req.user!.id;

      if (username) {
        const exists = await User.findOne({ where: { username } });
        if (exists && exists.id !== userId) {
          res.status(400).json({ message: 'Имя пользователя уже занято' });
          return;
        }
      }

      await User.update(
        { ...(username && { username }) },
        { where: { id: userId } }
      );

      const updated = await User.findByPk(userId, {
        attributes: { exclude: ['password'] },
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка обновления профиля' });
    }
  },

  getUserById: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findByPk(req.params.id, {
        attributes: { exclude: ['password'] },
      });

      if (!user) {
        res.status(404).json({ message: 'Пользователь не найден' });
        return;
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка' });
    }
  },
};