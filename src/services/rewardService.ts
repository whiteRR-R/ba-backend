import sequelize from '../config/database';
import { SpinHistory, StreakRewardLog, User } from '../models';
import { logCoinTransaction } from './coinTransactionService';

const APP_TIME_ZONE = 'Asia/Almaty';
const BASE_DAILY_STREAK_REWARD = 2;
const STREAK_MILESTONE_BONUSES: Record<number, number> = {
  7: 15,
  14: 35,
  30: 90,
};
const FREE_SPIN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const SPIN_REWARDS: Array<{ reward: number; weight: number }> = [
  { reward: 0, weight: 36 },
  { reward: 5, weight: 30 },
  { reward: 10, weight: 20 },
  { reward: 20, weight: 10 },
  { reward: 50, weight: 4 },
];

const formatLocalDateKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Cannot format local date key');
  }

  return `${year}-${month}-${day}`;
};

const getPreviousDateKey = (dateKey: string): string => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const getNextMilestone = (streakCount: number): number | null => {
  if (streakCount < 7) return 7;
  if (streakCount < 14) return 14;
  if (streakCount < 30) return 30;
  return null;
};

const pickWeightedSpinReward = (): number => {
  const totalWeight = SPIN_REWARDS.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of SPIN_REWARDS) {
    roll -= item.weight;
    if (roll <= 0) return item.reward;
  }

  return SPIN_REWARDS[SPIN_REWARDS.length - 1].reward;
};

export interface StreakApplyResult {
  rewarded: boolean;
  streakCount: number;
  bestStreak: number;
  reward: number;
  baseReward: number;
  bonusReward: number;
  localDate: string;
  nextMilestone: number | null;
  milestoneBonusAwarded: boolean;
}

export interface StreakStatusResult {
  streakCount: number;
  bestStreak: number;
  streakLastDate: string | null;
  rewardedToday: boolean;
  todayDateKey: string;
  nextMilestone: number | null;
  nextMilestoneBonus: number;
  baseDailyReward: number;
  milestoneBonuses: Record<number, number>;
}

export interface SpinResult {
  canSpin: boolean;
  reward: number;
  nextFreeSpinAt: Date;
  rikonCoins: number;
  waitMs: number;
}

export interface SpinStatusResult {
  canSpin: boolean;
  nextFreeSpinAt: Date | null;
  waitMs: number;
}

export const rewardService = {
  async applyDailyStreakReward(userId: number, submissionId?: number): Promise<StreakApplyResult> {
    return sequelize.transaction(async (transaction) => {
      const now = new Date();
      const todayKey = formatLocalDateKey(now);
      const yesterdayKey = getPreviousDateKey(todayKey);

      const user = await User.findByPk(userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        throw new Error('User not found');
      }

      const currentStreak = user.streakCount || 0;
      const bestStreak = user.bestStreak || 0;
      const lastDate = user.streakLastDate || null;

      if (lastDate === todayKey) {
        return {
          rewarded: false,
          streakCount: currentStreak,
          bestStreak,
          reward: 0,
          baseReward: 0,
          bonusReward: 0,
          localDate: todayKey,
          nextMilestone: getNextMilestone(currentStreak),
          milestoneBonusAwarded: false,
        };
      }

      const newStreakCount = lastDate === yesterdayKey ? currentStreak + 1 : 1;
      const bonusReward = STREAK_MILESTONE_BONUSES[newStreakCount] || 0;
      const baseReward = BASE_DAILY_STREAK_REWARD;
      const totalReward = baseReward + bonusReward;
      const newBestStreak = Math.max(bestStreak, newStreakCount);

      user.streakCount = newStreakCount;
      user.bestStreak = newBestStreak;
      user.streakLastDate = todayKey;
      user.rikonCoins = (user.rikonCoins || 0) + totalReward;
      await user.save({ transaction });

      await StreakRewardLog.create(
        {
          userId,
          localDate: todayKey,
          streakDay: newStreakCount,
          baseReward,
          bonusReward,
          totalReward,
          submissionId: submissionId ?? null,
        },
        { transaction }
      );

      await logCoinTransaction(
        {
          userId,
          amount: totalReward,
          kind: 'streak_reward',
          description: `Daily streak reward (day ${newStreakCount})`,
          submissionId: submissionId ?? null,
        },
        { transaction }
      );

      return {
        rewarded: true,
        streakCount: newStreakCount,
        bestStreak: newBestStreak,
        reward: totalReward,
        baseReward,
        bonusReward,
        localDate: todayKey,
        nextMilestone: getNextMilestone(newStreakCount),
        milestoneBonusAwarded: bonusReward > 0,
      };
    });
  },

  async getStreakStatus(userId: number): Promise<StreakStatusResult> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const todayKey = formatLocalDateKey(new Date());
    const streakCount = user.streakCount || 0;
    const nextMilestone = getNextMilestone(streakCount);

    return {
      streakCount,
      bestStreak: user.bestStreak || 0,
      streakLastDate: user.streakLastDate || null,
      rewardedToday: user.streakLastDate === todayKey,
      todayDateKey: todayKey,
      nextMilestone,
      nextMilestoneBonus: nextMilestone ? STREAK_MILESTONE_BONUSES[nextMilestone] || 0 : 0,
      baseDailyReward: BASE_DAILY_STREAK_REWARD,
      milestoneBonuses: STREAK_MILESTONE_BONUSES,
    };
  },

  async spinFree(userId: number): Promise<SpinResult> {
    return sequelize.transaction(async (transaction) => {
      const now = new Date();

      const user = await User.findByPk(userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!user) {
        throw new Error('User not found');
      }

      const nextFreeSpinAt = user.nextFreeSpinAt ? new Date(user.nextFreeSpinAt) : null;

      if (nextFreeSpinAt && nextFreeSpinAt.getTime() > now.getTime()) {
        return {
          canSpin: false,
          reward: 0,
          nextFreeSpinAt,
          rikonCoins: user.rikonCoins || 0,
          waitMs: nextFreeSpinAt.getTime() - now.getTime(),
        };
      }

      const reward = pickWeightedSpinReward();
      const nextAt = new Date(now.getTime() + FREE_SPIN_COOLDOWN_MS);

      user.rikonCoins = (user.rikonCoins || 0) + reward;
      user.nextFreeSpinAt = nextAt;
      await user.save({ transaction });

      const spinHistory = await SpinHistory.create(
        {
          userId,
          spinType: 'free',
          reward,
          nextAvailableAt: nextAt,
        },
        { transaction }
      );

      await logCoinTransaction(
        {
          userId,
          amount: reward,
          kind: 'spin_reward',
          description: 'Free spin reward',
          spinHistoryId: spinHistory.id,
        },
        { transaction }
      );

      return {
        canSpin: true,
        reward,
        nextFreeSpinAt: nextAt,
        rikonCoins: user.rikonCoins,
        waitMs: FREE_SPIN_COOLDOWN_MS,
      };
    });
  },

  async getSpinStatus(userId: number): Promise<SpinStatusResult> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const now = new Date();
    const nextFreeSpinAt = user.nextFreeSpinAt ? new Date(user.nextFreeSpinAt) : null;
    const waitMs =
      nextFreeSpinAt && nextFreeSpinAt.getTime() > now.getTime()
        ? nextFreeSpinAt.getTime() - now.getTime()
        : 0;

    return {
      canSpin: waitMs === 0,
      nextFreeSpinAt,
      waitMs,
    };
  },
};

