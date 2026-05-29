import sequelize from '../config/database';
import { Challenge, ChallengeInvite, ChallengeKick, Participant, User } from '../models';
import { logCoinTransaction } from './coinTransactionService';

type KickResult =
  | { ok: true; refundedCoins: number }
  | {
      ok: false;
      reason:
        | 'challenge_not_found'
        | 'cannot_kick_creator'
        | 'not_participant'
        | 'already_kicked'
        | 'forbidden';
    };

interface KickInput {
  challengeId: number;
  targetUserId: number;
  actorUserId: number;
  actorRole?: string;
  reason?: string;
}

const canKick = (isCreator: boolean, actorRole?: string): boolean => {
  if (isCreator) return true;
  return actorRole === 'admin' || actorRole === 'moderator';
};

export const kickParticipantFromChallenge = async (input: KickInput): Promise<KickResult> => {
  const { challengeId, targetUserId, actorUserId, actorRole, reason } = input;

  const tx = await sequelize.transaction();
  try {
    const challenge = await Challenge.findByPk(challengeId, { transaction: tx });
    if (!challenge) {
      await tx.rollback();
      return { ok: false, reason: 'challenge_not_found' };
    }

    const isCreator = challenge.creatorId === actorUserId;
    if (!canKick(isCreator, actorRole)) {
      await tx.rollback();
      return { ok: false, reason: 'forbidden' };
    }

    if (targetUserId === challenge.creatorId) {
      await tx.rollback();
      return { ok: false, reason: 'cannot_kick_creator' };
    }

    const participant = await Participant.findOne({
      where: { challengeId, userId: targetUserId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!participant) {
      const alreadyKicked = await ChallengeKick.findOne({
        where: { challengeId, userId: targetUserId },
        transaction: tx,
      });
      await tx.rollback();
      if (alreadyKicked) return { ok: false, reason: 'already_kicked' };
      return { ok: false, reason: 'not_participant' };
    }

    let refundedCoins = 0;
    if (challenge.betAmount > 0) {
      refundedCoins = challenge.betAmount;
      await User.increment(
        'rikonCoins',
        {
          by: refundedCoins,
          where: { id: targetUserId },
          transaction: tx,
        }
      );
      await logCoinTransaction(
        {
          userId: targetUserId,
          amount: refundedCoins,
          kind: 'challenge_refund',
          description: 'Refund after participant kick',
          challengeId,
        },
        { transaction: tx }
      );
    }

    await participant.destroy({ transaction: tx });
    await ChallengeInvite.destroy({
      where: { challengeId, toUserId: targetUserId, status: 'pending' },
      transaction: tx,
    });

    const existingKick = await ChallengeKick.findOne({
      where: { challengeId, userId: targetUserId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (existingKick) {
      await existingKick.update(
        {
          kickedByUserId: actorUserId,
          reason: reason || existingKick.reason || null,
          kickedAt: new Date(),
        },
        { transaction: tx }
      );
    } else {
      await ChallengeKick.create(
        {
          challengeId,
          userId: targetUserId,
          kickedByUserId: actorUserId,
          reason: reason || null,
          kickedAt: new Date(),
        },
        { transaction: tx }
      );
    }

    await tx.commit();
    return { ok: true, refundedCoins };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
};

