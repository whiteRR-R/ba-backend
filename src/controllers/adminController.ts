import { Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '../config/database';
import { AuthRequest } from '../types';
import { Challenge, Participant, Task, User } from '../models';
import { deleteChallengFiles } from '../utils/cleanupFiles';

export const adminController = {
  getChallengeDetail: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const challenge = await Challenge.findByPk(req.params.id, {
        include: [
          {
            model: Participant,
            as: 'participants',
            include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatarUrl', 'rating'] }],
          },
          { model: Task, as: 'tasks' },
          { model: User, as: 'creator', attributes: ['id', 'username'] },
        ],
      });

      if (!challenge) {
        res.status(404).json({ message: 'Challenge not found' });
        return;
      }

      res.json(challenge);
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to fetch challenge: ' + error.message });
    }
  },

  searchChallenges: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { q, status, visibility } = req.query;
      const whereClause: any = {};

      if (q) {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
        ];
      }
      if (status) whereClause.status = status;
      if (visibility) whereClause.visibility = visibility;

      const challenges = await Challenge.findAll({
        where: whereClause,
        include: [{ model: User, as: 'creator', attributes: ['id', 'username'] }],
        order: [['createdAt', 'DESC']],
      });

      res.json(challenges);
    } catch (error: any) {
      res.status(500).json({ message: 'Search failed: ' + error.message });
    }
  },

  completeChallenge: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const challenge = await Challenge.findByPk(req.params.id);
      if (!challenge) {
        res.status(404).json({ message: 'Challenge not found' });
        return;
      }

      await challenge.update({ status: 'completed' });
      res.json({ message: 'Challenge completed by admin', challenge });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to complete challenge: ' + error.message });
    }
  },

  resolveDispute: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const challengeId = Number(req.params.id);
      const { winnerUserId } = req.body;
      const transaction = await sequelize.transaction();

      try {
        const challenge = await Challenge.findByPk(challengeId, { transaction });
        if (!challenge) throw new Error('Challenge not found');

        const participants = await Participant.findAll({ where: { challengeId }, transaction });
        const totalPool = challenge.betAmount * participants.length;

        if (totalPool > 0) {
          await User.increment('rikonCoins', {
            by: totalPool,
            where: { id: winnerUserId },
            transaction,
          });
        }

        await challenge.update({ status: 'completed' }, { transaction });
        await transaction.commit();

        res.json({
          message: `Dispute resolved. Winner: ${winnerUserId}, prize: ${totalPool}`,
        });
      } catch (err: any) {
        await transaction.rollback();
        throw err;
      }
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to resolve dispute: ' + error.message });
    }
  },

  deleteChallenge: async (req: AuthRequest, res: Response): Promise<void> => {
    const challengeId = Number(req.params.id);
    const transaction = await sequelize.transaction();

    try {
      const challenge = await Challenge.findByPk(challengeId, { transaction });
      if (!challenge) {
        await transaction.rollback();
        res.status(404).json({ message: 'Challenge not found' });
        return;
      }

      const participants = await Participant.findAll({ where: { challengeId }, transaction });

      if (challenge.betAmount > 0) {
        for (const participant of participants) {
          await User.increment('rikonCoins', {
            by: challenge.betAmount,
            where: { id: participant.userId },
            transaction,
          });
        }
      }

      await Participant.destroy({ where: { challengeId }, transaction });
      await challenge.destroy({ transaction });
      await transaction.commit();

      setImmediate(async () => {
        await deleteChallengFiles(challengeId);
      });

      res.json({
        message: 'Challenge deleted and participant bets refunded',
        refundedAmountPerUser: challenge.betAmount,
      });
    } catch (error: any) {
      await transaction.rollback();
      res.status(500).json({ message: 'Failed to delete challenge: ' + error.message });
    }
  },
};
