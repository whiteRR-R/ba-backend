import { Op } from 'sequelize';
import { Challenge, Participant, User } from '../models';
import { deleteChallengFiles } from '../utils/cleanupFiles';
import { logCoinTransaction } from './coinTransactionService';

const isCompletableStatus = (status: string): boolean =>
  status === 'active' || status === 'pending';

export type CompletionMode = 'payout' | 'refund';

export interface CoinFlowLine {
  userId: number;
  amount: number;
}

export interface CompletionSummary {
  mode: CompletionMode;
  totalAmount: number;
  lines: CoinFlowLine[];
}

export const distributePrizePool = async (challengeId: number): Promise<CompletionSummary> => {
  const challenge = await Challenge.findByPk(challengeId);
  if (!challenge || challenge.betAmount === 0) {
    return { mode: 'payout', totalAmount: 0, lines: [] };
  }

  const participants = await Participant.findAll({
    where: { challengeId },
    order: [['score', 'DESC']],
  });

  if (participants.length === 0) {
    return { mode: 'payout', totalAmount: 0, lines: [] };
  }

  const totalPool = challenge.betAmount * participants.length;
  const prizes: Array<{ userId: number; prize: number }> = [];

  if (participants.length === 1) {
    prizes.push({ userId: participants[0].userId, prize: totalPool });
  } else if (participants.length === 2) {
    prizes.push({ userId: participants[0].userId, prize: Math.floor(totalPool * 0.7) });
    prizes.push({ userId: participants[1].userId, prize: Math.floor(totalPool * 0.3) });
  } else {
    prizes.push({ userId: participants[0].userId, prize: Math.floor(totalPool * 0.5) });
    prizes.push({ userId: participants[1].userId, prize: Math.floor(totalPool * 0.3) });
    prizes.push({ userId: participants[2].userId, prize: Math.floor(totalPool * 0.2) });
  }

  const lines: CoinFlowLine[] = [];

  for (const { userId, prize } of prizes) {
    if (prize <= 0) continue;
    await User.increment('rikonCoins', { by: prize, where: { id: userId } });
    await logCoinTransaction({
      userId,
      amount: prize,
      kind: 'challenge_payout',
      description: 'Payout after challenge completion',
      challengeId,
    });
    lines.push({ userId, amount: prize });
  }

  return {
    mode: 'payout',
    totalAmount: lines.reduce((sum, item) => sum + item.amount, 0),
    lines,
  };
};

export const refundParticipantBets = async (
  challengeId: number,
  betAmount: number
): Promise<CompletionSummary> => {
  if (betAmount <= 0) {
    return { mode: 'refund', totalAmount: 0, lines: [] };
  }

  const participants = await Participant.findAll({
    where: { challengeId },
    attributes: ['userId'],
  });

  const lines: CoinFlowLine[] = [];

  for (const participant of participants) {
    await User.increment('rikonCoins', {
      by: betAmount,
      where: { id: participant.userId },
    });
    await logCoinTransaction({
      userId: participant.userId,
      amount: betAmount,
      kind: 'challenge_refund',
      description: 'Refund after challenge completion',
      challengeId,
    });
    lines.push({ userId: participant.userId, amount: betAmount });
  }

  return {
    mode: 'refund',
    totalAmount: lines.reduce((sum, item) => sum + item.amount, 0),
    lines,
  };
};

type CompleteChallengeResult =
  | { ok: true; summary: CompletionSummary }
  | { ok: false; reason: 'not_found' | 'already_completed' };

export const completeChallengeWithMode = async (
  challengeId: number,
  mode: CompletionMode = 'payout'
): Promise<CompleteChallengeResult> => {
  const challenge = await Challenge.findByPk(challengeId, {
    attributes: ['id', 'status', 'betAmount'],
  });

  if (!challenge) {
    return { ok: false, reason: 'not_found' };
  }

  if (!isCompletableStatus(challenge.status)) {
    return { ok: false, reason: 'already_completed' };
  }

  const [updatedRows] = await Challenge.update(
    { status: 'completed' },
    {
      where: {
        id: challengeId,
        status: { [Op.in]: ['active', 'pending'] },
      },
    }
  );

  if (updatedRows === 0) {
    return { ok: false, reason: 'already_completed' };
  }

  let summary: CompletionSummary = {
    mode,
    totalAmount: 0,
    lines: [],
  };

  if (challenge.betAmount > 0) {
    if (mode === 'refund') {
      summary = await refundParticipantBets(challengeId, challenge.betAmount);
    } else {
      summary = await distributePrizePool(challengeId);
    }
  }

  return { ok: true, summary };
};

export const completeChallengeWithPayout = async (
  challengeId: number
): Promise<CompleteChallengeResult> => {
  return completeChallengeWithMode(challengeId, 'payout');
};

export const autoCompleteExpiredChallenges = async (): Promise<number> => {
  const now = new Date();

  const expiredChallenges = await Challenge.findAll({
    attributes: ['id'],
    where: {
      status: { [Op.in]: ['active', 'pending'] },
      endDate: { [Op.lt]: now },
    },
  });

  if (expiredChallenges.length === 0) return 0;

  let completedCount = 0;

  for (const challenge of expiredChallenges) {
    const completion = await completeChallengeWithPayout(challenge.id);
    if (!completion.ok) continue;

    completedCount += 1;
    setImmediate(async () => {
      await deleteChallengFiles(challenge.id);
    });
  }

  return completedCount;
};
