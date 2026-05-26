import { Response } from 'express';
import { AuthRequest } from '../types';
import { rewardService } from '../services/rewardService';

export const rewardController = {
  getStreakStatus: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Пользователь не авторизован' });
        return;
      }

      const status = await rewardService.getStreakStatus(userId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: 'Ошибка получения streak статуса: ' + error.message });
    }
  },

  spinFree: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Пользователь не авторизован' });
        return;
      }

      const result = await rewardService.spinFree(userId);

      if (!result.canSpin) {
        res.status(429).json({
          message: 'Бесплатный спин пока недоступен',
          nextFreeSpinAt: result.nextFreeSpinAt,
          waitMs: result.waitMs,
          rikonCoins: result.rikonCoins,
        });
        return;
      }

      res.json({
        reward: result.reward,
        nextFreeSpinAt: result.nextFreeSpinAt,
        rikonCoins: result.rikonCoins,
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Ошибка free spin: ' + error.message });
    }
  },

  getSpinStatus: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ message: 'Пользователь не авторизован' });
        return;
      }

      const status = await rewardService.getSpinStatus(userId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: 'Ошибка статуса спина: ' + error.message });
    }
  },
};
