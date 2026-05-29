import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../types';
import { Challenge, Participant, Task, User, ChallengeInvite, FamilyMember, ChallengeKick } from '../models';
import { deleteChallengFiles } from '../utils/cleanupFiles';
import { completeChallengeWithPayout } from '../services/challengeCompletionService';
import { logCoinTransaction } from '../services/coinTransactionService';
import { kickParticipantFromChallenge } from '../services/challengeKickService';

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Р’СЃРїРѕРјРѕРіР°С‚РµР»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ вЂ” СЂР°СЃРїСЂРµРґРµР»РµРЅРёРµ РїСЂРёР·РѕРІРѕРіРѕ РїСѓР»Р°
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const distributePrizePool = async (challengeId: number): Promise<void> => {
    try {
        const challenge = await Challenge.findByPk(challengeId);
        if (!challenge || challenge.betAmount === 0) return;

        const participants = await Participant.findAll({
            where: { challengeId },
            order: [['score', 'DESC']],
        });

        if (participants.length === 0) return;

        const totalPool = challenge.betAmount * participants.length;

        console.log(`рџ’° РџСЂРёР·РѕРІРѕР№ РїСѓР» С‡РµР»Р»РµРЅРґР¶Р° #${challengeId}: ${totalPool} РјРѕРЅРµС‚`);
        console.log(`рџ‘Ґ РЈС‡Р°СЃС‚РЅРёРєРѕРІ: ${participants.length}`);

        const prizes: { userId: number; prize: number; place: number }[] = [];

        if (participants.length === 1) {
            prizes.push({ userId: participants[0].userId, prize: totalPool, place: 1 });
        } else if (participants.length === 2) {
            prizes.push({ userId: participants[0].userId, prize: Math.floor(totalPool * 0.7), place: 1 });
            prizes.push({ userId: participants[1].userId, prize: Math.floor(totalPool * 0.3), place: 2 });
        } else {
            prizes.push({ userId: participants[0].userId, prize: Math.floor(totalPool * 0.5), place: 1 });
            prizes.push({ userId: participants[1].userId, prize: Math.floor(totalPool * 0.3), place: 2 });
            prizes.push({ userId: participants[2].userId, prize: Math.floor(totalPool * 0.2), place: 3 });
        }

        for (const { userId, prize, place } of prizes) {
            await User.increment('rikonCoins', { by: prize, where: { id: userId } });
            console.log(`рџЏ† РњРµСЃС‚Рѕ #${place}: userId ${userId} РїРѕР»СѓС‡Р°РµС‚ ${prize} РјРѕРЅРµС‚`);
        }

        console.log(`вњ… РџСЂРёР·РѕРІРѕР№ РїСѓР» СЂР°СЃРїСЂРµРґРµР»С‘РЅ РґР»СЏ С‡РµР»Р»РµРЅРґР¶Р° #${challengeId}`);
    } catch (error: any) {
        console.error('distributePrizePool error:', error.message);
    }
};

// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
// Р’СЃРїРѕРјРѕРіР°С‚РµР»СЊРЅР°СЏ С„СѓРЅРєС†РёСЏ вЂ” С„РѕСЂРјР°С‚ РїСЂРёР·РѕРІРѕРіРѕ РїСѓР»Р° РґР»СЏ РѕС‚РІРµС‚Р°
// в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
const buildPrizeInfo = (totalPool: number, participantCount: number) => {
    if (participantCount === 0 || totalPool === 0) {
        return { totalPool: 0, prizes: [] };
    }

    if (participantCount === 1) {
        return {
            totalPool,
            prizes: [
                { place: 1, percent: 100, amount: totalPool, label: 'рџҐ‡ 1 РјРµСЃС‚Рѕ' },
            ],
        };
    }

    if (participantCount === 2) {
        return {
            totalPool,
            prizes: [
                { place: 1, percent: 70, amount: Math.floor(totalPool * 0.7), label: 'рџҐ‡ 1 РјРµСЃС‚Рѕ' },
                { place: 2, percent: 30, amount: Math.floor(totalPool * 0.3), label: 'рџҐ€ 2 РјРµСЃС‚Рѕ' },
            ],
        };
    }

    return {
        totalPool,
        prizes: [
            { place: 1, percent: 50, amount: Math.floor(totalPool * 0.5), label: 'рџҐ‡ 1 РјРµСЃС‚Рѕ' },
            { place: 2, percent: 30, amount: Math.floor(totalPool * 0.3), label: 'рџҐ€ 2 РјРµСЃС‚Рѕ' },
            { place: 3, percent: 20, amount: Math.floor(totalPool * 0.2), label: 'рџҐ‰ 3 РјРµСЃС‚Рѕ' },
        ],
    };
};

// РђРІС‚РѕС„РёРЅР°Р»РёР·Р°С†РёСЏ РїСЂРѕСЃСЂРѕС‡РµРЅРЅС‹С… С‡РµР»Р»РµРЅРґР¶РµР№.
// Р”Р»СЏ serverless РѕРєСЂСѓР¶РµРЅРёСЏ: РІС‹Р·С‹РІР°РµРј РІ API-РїРѕС‚РѕРєРµ.
const autoCompleteExpiredChallenges = async (): Promise<void> => {
    try {
        const now = new Date();

        const expiredChallenges = await Challenge.findAll({
            attributes: ['id', 'betAmount'],
            where: {
                status: { [Op.in]: ['active', 'pending'] },
                endDate: { [Op.lt]: now },
            },
        });

        if (expiredChallenges.length === 0) return;

        for (const challenge of expiredChallenges) {
            const completion = await completeChallengeWithPayout(challenge.id);
            if (!completion.ok) continue;

            console.log(`Auto-complete challenge #${challenge.id}`);
            setImmediate(async () => {
                await deleteChallengFiles(challenge.id);
            });
        }
    } catch (error: any) {
        console.error('autoCompleteExpiredChallenges error:', error.message);
    }
};

export const challengeController = {

    // GET /api/challenges/family
    getFamilyChallenges: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            await autoCompleteExpiredChallenges();

            const userId = req.user!.id;
            const { familyOwnerId } = req.query;

            let ownerIds: number[];

            if (familyOwnerId) {
                const ownerId = Number(familyOwnerId);
                if (ownerId === userId) {
                    ownerIds = [userId];
                } else {
                    const membership = await FamilyMember.findOne({
                        where: { userId: ownerId, appUserId: userId },
                    });
                    if (!membership) {
                        res.status(403).json({ message: 'РќРµС‚ РґРѕСЃС‚СѓРїР° Рє СЌС‚РѕР№ СЃРµРјСЊРµ' });
                        return;
                    }
                    ownerIds = [ownerId];
                }
            } else {
                const memberEntries = await FamilyMember.findAll({
                    where: { appUserId: userId },
                    attributes: ['userId'],
                });
                ownerIds = [userId, ...memberEntries.map((m) => m.userId)];
            }

            const challenges = await Challenge.findAll({
                where: { familyOwnerId: ownerIds },
                include: [
                    {
                        model: Participant,
                        as: 'participants',
                        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatarUrl'] }],
                    },
                    { model: User, as: 'creator', attributes: ['id', 'username'] },
                ],
                order: [['createdAt', 'DESC']],
            });

            const result = challenges.map((c: any) => {
                const participantCount = c.participants?.length ?? 0;
                const prizePool = c.betAmount * participantCount;
                return { ...c.toJSON(), prizePool };
            });

            res.json(result);
        } catch (error: any) {
            console.error('getFamilyChallenges error:', error.message);
            res.status(500).json({ message: 'РћС€РёР±РєР°: ' + error.message });
        }
    },

    // GET /api/challenges
    getAll: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            await autoCompleteExpiredChallenges();

            const userId = req.user!.id;
            const challenges = await Challenge.findAll({
                include: [
                    {
                        model: Participant,
                        as: 'participants',
                        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatarUrl'] }],
                    },
                    { model: User, as: 'creator', attributes: ['id', 'username'] },
                ],
                where: {
                    familyOwnerId: { [Op.is]: null as any },
                    [Op.or]: [
                        { visibility: 'public' },
                        { visibility: 'protected' },
                        { creatorId: userId },
                        { '$participants.userId$': userId },
                    ],
                },
                order: [['createdAt', 'DESC']],
            });

            const result = challenges.map((c: any) => {
                const participantCount = c.participants?.length ?? 0;
                const prizePool = c.betAmount * participantCount;
                return { ...c.toJSON(), prizePool };
            });

            res.json(result);
        } catch (error) {
            res.status(500).json({ message: 'РћС€РёР±РєР°' });
        }
    },

    // GET /api/challenges/:id
    getById: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            await autoCompleteExpiredChallenges();

            const userId = req.user!.id;
            const challenge = await Challenge.findByPk(req.params.id, {
                include: [
                    {
                        model: Participant,
                        as: 'participants',
                        include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatarUrl', 'rating'] }],
                    },
                    { model: Task, as: 'tasks', order: [['day', 'ASC']] },
                    { model: User, as: 'creator', attributes: ['id', 'username'] },
                ],
            });

            if (!challenge) {
                res.status(404).json({ message: 'Р§РµР»Р»РµРЅРґР¶ РЅРµ РЅР°Р№РґРµРЅ' });
                return;
            }

            if (challenge.familyOwnerId) {
                const isFamilyMember = await FamilyMember.findOne({
                    where: { userId: challenge.familyOwnerId, appUserId: userId },
                });
                const isOwner = challenge.familyOwnerId === userId;
                if (!isOwner && !isFamilyMember) {
                    res.status(403).json({ message: 'РќРµС‚ РґРѕСЃС‚СѓРїР° Рє СЌС‚РѕРјСѓ СЃРµРјРµР№РЅРѕРјСѓ С‡РµР»Р»РµРЅРґР¶Сѓ' });
                    return;
                }
            }

            const participantCount = (challenge as any).participants?.length ?? 0;
            const totalPool = challenge.betAmount * participantCount;
            const prizeInfo = buildPrizeInfo(totalPool, participantCount);

            res.json({
                ...challenge.toJSON(),
                prizePool: totalPool,
                prizeInfo,
            });
        } catch (error) {
            res.status(500).json({ message: 'РћС€РёР±РєР°' });
        }
    },

    // POST /api/challenges
    create: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const {
                title, description, startDate, endDate,
                visibility, betAmount, familyOwnerId,
            } = req.body;
            const creatorId = req.user!.id;

            if (familyOwnerId && Number(familyOwnerId) !== creatorId) {
                res.status(403).json({
                    message: 'РўРѕР»СЊРєРѕ РІР»Р°РґРµР»РµС† СЃРµРјСЊРё РјРѕР¶РµС‚ СЃРѕР·РґР°РІР°С‚СЊ СЃРµРјРµР№РЅС‹Рµ С‡РµР»Р»РµРЅРґР¶Рё',
                });
                return;
            }

            if (betAmount > 0) {
                const creator = await User.findByPk(creatorId);
                if (!creator || creator.rikonCoins < betAmount) {
                    res.status(400).json({
                        message: `РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РјРѕРЅРµС‚. РЈ С‚РµР±СЏ ${creator?.rikonCoins ?? 0} рџЄ™`,
                    });
                    return;
                }
            }

            const challenge = await Challenge.create({
                title, description, startDate, endDate,
                creatorId,
                visibility: visibility || 'public',
                betAmount: betAmount || 0,
                status: 'pending',
                familyOwnerId: familyOwnerId ? Number(familyOwnerId) : undefined,
            });

            await Participant.create({
                challengeId: challenge.id,
                userId: creatorId,
                hasConsented: true,
            });

            if (betAmount > 0) {
                await User.decrement('rikonCoins', { by: betAmount, where: { id: creatorId } });
                await logCoinTransaction({
                    userId: creatorId,
                    amount: -challenge.betAmount,
                    kind: 'challenge_bet',
                    description: 'Challenge bet on challenge creation',
                    challengeId: challenge.id,
                });
            }

            const full = await Challenge.findByPk(challenge.id, {
                include: [
                    {
                        model: Participant,
                        as: 'participants',
                        include: [{ model: User, as: 'user', attributes: ['id', 'username'] }],
                    },
                    { model: User, as: 'creator', attributes: ['id', 'username'] },
                ],
            });

            const prizePool = betAmount || 0;
            const prizeInfo = buildPrizeInfo(prizePool, 1);

            res.status(201).json({ ...(full as any).toJSON(), prizePool, prizeInfo });
        } catch (error) {
            res.status(500).json({ message: 'РћС€РёР±РєР° СЃРѕР·РґР°РЅРёСЏ С‡РµР»Р»РµРЅРґР¶Р°' });
        }
    },

    // POST /api/challenges/:id/join
    join: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            await autoCompleteExpiredChallenges();

            const challengeId = Number(req.params.id);
            const userId = req.user!.id;

            const challenge = await Challenge.findByPk(challengeId);
            if (!challenge) {
                res.status(404).json({ message: 'РќРµ РЅР°Р№РґРµРЅ' });
                return;
            }

            if (challenge.status === 'completed' || challenge.status === 'cancelled') {
                res.status(400).json({ message: 'Р§РµР»Р»РµРЅРґР¶ СѓР¶Рµ Р·Р°РІРµСЂС€С‘РЅ' });
                return;
            }

            if (challenge.familyOwnerId) {
                const isMember = await FamilyMember.findOne({
                    where: { userId: challenge.familyOwnerId, appUserId: userId },
                });
                const isOwner = challenge.familyOwnerId === userId;
                if (!isOwner && !isMember) {
                    res.status(403).json({ message: 'РўРѕР»СЊРєРѕ С‡Р»РµРЅС‹ СЃРµРјСЊРё РјРѕРіСѓС‚ СѓС‡Р°СЃС‚РІРѕРІР°С‚СЊ' });
                    return;
                }
            }

            const existing = await Participant.findOne({ where: { challengeId, userId } });
            if (existing) {
                res.status(400).json({ message: 'РЈР¶Рµ СѓС‡Р°СЃС‚РІСѓРµС€СЊ' });
                return;
            }

            const kicked = await ChallengeKick.findOne({ where: { challengeId, userId } });
            if (kicked) {
                res.status(403).json({ message: 'Вы были исключены из этого челленджа и не можете войти повторно' });
                return;
            }

            if (challenge.betAmount > 0) {
                const user = await User.findByPk(userId);
                if (!user || user.rikonCoins < challenge.betAmount) {
                    res.status(400).json({
                        message: `РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РјРѕРЅРµС‚. РќСѓР¶РЅРѕ ${challenge.betAmount} рџЄ™, Сѓ С‚РµР±СЏ ${user?.rikonCoins ?? 0} рџЄ™`,
                    });
                    return;
                }
            }

            await Participant.create({ challengeId, userId, hasConsented: true });

            if (challenge.betAmount > 0) {
                await User.decrement('rikonCoins', { by: challenge.betAmount, where: { id: userId } });
                await logCoinTransaction({
                    userId,
                    amount: -challenge.betAmount,
                    kind: 'challenge_bet',
                    description: 'Challenge bet on join',
                    challengeId: challengeId,
                });
            }

            const participantCount = await Participant.count({ where: { challengeId } });
            const totalPool = challenge.betAmount * participantCount;
            const prizeInfo = buildPrizeInfo(totalPool, participantCount);

            res.json({
                message: challenge.betAmount > 0
                    ? `рџЋ‰ РўС‹ РІ РёРіСЂРµ! ${challenge.betAmount} рџЄ™ РґРѕР±Р°РІР»РµРЅС‹ РІ РїСЂРёР·РѕРІРѕР№ РїСѓР».`
                    : 'рџЋ‰ РўС‹ РІСЃС‚СѓРїРёР» РІ С‡РµР»Р»РµРЅРґР¶!',
                prizePool: totalPool,
                prizeInfo,
            });
        } catch (error) {
            res.status(500).json({ message: 'РћС€РёР±РєР°' });
        }
    },

    // GET /api/challenges/:id/tasks
    getTasks: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            await autoCompleteExpiredChallenges();

            const challenge = await Challenge.findByPk(req.params.id, {
                attributes: ['id', 'status'],
            });
            if (!challenge) {
                res.status(404).json({ message: 'Челлендж не найден' });
                return;
            }
            if (challenge.status === 'completed' || challenge.status === 'cancelled') {
                res.status(403).json({ message: 'Челлендж завершён, доступ к задачам закрыт' });
                return;
            }

            const tasks = await Task.findAll({
                where: { challengeId: req.params.id },
                order: [['day', 'ASC']],
            });
            res.json(tasks);
        } catch (error) {
            res.status(500).json({ message: 'РћС€РёР±РєР°' });
        }
    },

    // вњ… PATCH /api/challenges/:id/status
    // РћР±РЅРѕРІР»С‘РЅ: РїСЂРё Р·Р°РІРµСЂС€РµРЅРёРё СѓРґР°Р»СЏРµС‚ С„Р°Р№Р»С‹ СЃР°Р±РјРёС€РµРЅРѕРІ
    updateStatus: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { status } = req.body;
            const challenge = await Challenge.findByPk(req.params.id);

            if (!challenge) {
                res.status(404).json({ message: 'РќРµ РЅР°Р№РґРµРЅ' });
                return;
            }

            if (challenge.creatorId !== req.user!.id) {
                res.status(403).json({ message: 'РќРµС‚ РїСЂР°РІ' });
                return;
            }

            if (status === 'completed') {
                const completion = await completeChallengeWithPayout(challenge.id);
                if (!completion.ok) {
                    res.status(409).json({ message: 'Челлендж уже завершён' });
                    return;
                }
                setImmediate(async () => {
                    await deleteChallengFiles(challenge.id);
                });
            } else {
                if (
                    (challenge.status === 'completed' || challenge.status === 'cancelled') &&
                    status !== challenge.status
                ) {
                    res.status(409).json({ message: 'Нельзя изменить статус завершённого челленджа' });
                    return;
                }
                await challenge.update({ status });
            }

            // вњ… РџСЂРё РѕС‚РјРµРЅРµ вЂ” С‚РѕР¶Рµ СѓРґР°Р»СЏРµРј С„Р°Р№Р»С‹
            if (status === 'cancelled') {
                console.log(`вќЊ Р§РµР»Р»РµРЅРґР¶ #${challenge.id} РѕС‚РјРµРЅС‘РЅ. РЈРґР°Р»СЏРµРј С„Р°Р№Р»С‹...`);

                setImmediate(async () => {
                    await deleteChallengFiles(challenge.id);
                });
            }

            const fresh = await Challenge.findByPk(challenge.id);
            res.json(fresh ?? challenge);
        } catch (error: any) {
            console.error('updateStatus error:', error.message);
            res.status(500).json({ message: 'РћС€РёР±РєР°' });
        }
    },

    // GET /api/challenges/:id/prize-pool
    getPrizePool: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const challenge = await Challenge.findByPk(req.params.id);
            if (!challenge) {
                res.status(404).json({ message: 'Р§РµР»Р»РµРЅРґР¶ РЅРµ РЅР°Р№РґРµРЅ' });
                return;
            }

            const participants = await Participant.findAll({
                where: { challengeId: challenge.id },
                include: [{ model: User, as: 'user', attributes: ['id', 'username', 'avatarUrl'] }],
                order: [['score', 'DESC']],
            });

            const participantCount = participants.length;
            const totalPool = challenge.betAmount * participantCount;
            const prizeInfo = buildPrizeInfo(totalPool, participantCount);

            const enrichedPrizes = prizeInfo.prizes.map((prize, i) => ({
                ...prize,
                user: participants[i]
                    ? {
                        id: (participants[i] as any).user?.id,
                        username: (participants[i] as any).user?.username,
                    }
                    : null,
            }));

            res.json({
                challengeId: challenge.id,
                betAmount: challenge.betAmount,
                participantCount,
                totalPool,
                status: challenge.status,
                prizes: enrichedPrizes,
            });
        } catch (error: any) {
            console.error('getPrizePool error:', error.message);
            res.status(500).json({ message: 'РћС€РёР±РєР°' });
        }
    },

    // POST /api/challenges/:id/invite
    inviteUser: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const challengeId = Number(req.params.id);
            const { toUserId } = req.body;
            const fromUserId = req.user!.id;

            const challenge = await Challenge.findByPk(challengeId);
            if (!challenge) {
                res.status(404).json({ message: 'Р§РµР»Р»РµРЅРґР¶ РЅРµ РЅР°Р№РґРµРЅ' });
                return;
            }

            if (challenge.creatorId !== fromUserId) {
                res.status(403).json({ message: 'РўРѕР»СЊРєРѕ СЃРѕР·РґР°С‚РµР»СЊ РјРѕР¶РµС‚ РїСЂРёРіР»Р°С€Р°С‚СЊ' });
                return;
            }

            const existing = await ChallengeInvite.findOne({
                where: { challengeId, toUserId, status: 'pending' },
            });

            if (existing) {
                res.status(400).json({ message: 'РџСЂРёРіР»Р°С€РµРЅРёРµ СѓР¶Рµ РѕС‚РїСЂР°РІР»РµРЅРѕ' });
                return;
            }

            const kicked = await ChallengeKick.findOne({
                where: { challengeId, userId: Number(toUserId) },
            });
            if (kicked) {
                res.status(400).json({ message: 'Пользователь был исключён из этого челленджа' });
                return;
            }

            await ChallengeInvite.create({ challengeId, fromUserId, toUserId: Number(toUserId) });
            res.status(201).json({ message: 'РџСЂРёРіР»Р°С€РµРЅРёРµ РѕС‚РїСЂР°РІР»РµРЅРѕ!' });
        } catch (error) {
            res.status(500).json({ message: 'РћС€РёР±РєР°' });
        }
    },

    // GET /api/challenges/my-invites
    getMyChallengeInvites: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;

            const invites = await ChallengeInvite.findAll({
                where: { toUserId: userId, status: 'pending' },
                order: [['createdAt', 'DESC']],
            });

            const result = await Promise.all(
                invites.map(async (invite) => {
                    const challenge = await Challenge.findByPk(invite.challengeId, {
                        attributes: ['id', 'title', 'description', 'betAmount'],
                    });
                    const sender = await User.findByPk(invite.fromUserId, {
                        attributes: ['id', 'username'],
                    });

                    const participantCount = await Participant.count({
                        where: { challengeId: invite.challengeId },
                    });
                    const prizePool = (challenge?.betAmount ?? 0) * participantCount;

                    return {
                        id: invite.id,
                        challengeId: invite.challengeId,
                        status: invite.status,
                        createdAt: invite.createdAt,
                        challenge: challenge ? { ...challenge.toJSON(), prizePool } : null,
                        inviteSender: sender,
                    };
                })
            );

            res.json(result);
        } catch (error: any) {
            console.error('getMyChallengeInvites error:', error.message);
            res.status(500).json({ message: 'РћС€РёР±РєР°: ' + error.message });
        }
    },

    // PATCH /api/challenges/invites/:inviteId
    respondChallengeInvite: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { inviteId } = req.params;
            const { accept } = req.body;
            const userId = req.user!.id;

            const invite = await ChallengeInvite.findByPk(inviteId);
            if (!invite || invite.toUserId !== userId) {
                res.status(404).json({ message: 'РќРµ РЅР°Р№РґРµРЅРѕ' });
                return;
            }

            if (accept) {
                const challenge = await Challenge.findByPk(invite.challengeId);
                const kicked = await ChallengeKick.findOne({
                    where: { challengeId: invite.challengeId, userId },
                });
                if (kicked) {
                    await invite.update({ status: 'rejected' });
                    res.status(403).json({ message: 'Вы были исключены из этого челленджа' });
                    return;
                }

                if (challenge && challenge.betAmount > 0) {
                    const user = await User.findByPk(userId);
                    if (!user || user.rikonCoins < challenge.betAmount) {
                        res.status(400).json({
                            message: `РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РјРѕРЅРµС‚. РќСѓР¶РЅРѕ ${challenge.betAmount} рџЄ™ РґР»СЏ СѓС‡Р°СЃС‚РёСЏ`,
                        });
                        return;
                    }
                }

                const existing = await Participant.findOne({
                    where: { challengeId: invite.challengeId, userId },
                });

                if (!existing) {
                    await Participant.create({
                        challengeId: invite.challengeId,
                        userId,
                        hasConsented: true,
                    });

                    if (challenge && challenge.betAmount > 0) {
                        await User.decrement('rikonCoins', {
                            by: challenge.betAmount,
                            where: { id: userId },
                        });
                        await logCoinTransaction({
                            userId,
                            amount: -challenge.betAmount,
                            kind: 'challenge_bet',
                            description: 'Challenge bet on invite acceptance',
                            challengeId: challenge.id,
                        });
                    }
                }

                await invite.update({ status: 'accepted' });
                res.json({ message: 'РџСЂРёРЅСЏС‚Рѕ! РўС‹ РІ С‡РµР»Р»РµРЅРґР¶Рµ.' });
            } else {
                await invite.update({ status: 'rejected' });
                res.json({ message: 'РћС‚РєР»РѕРЅРµРЅРѕ' });
            }
        } catch (error) {
            res.status(500).json({ message: 'РћС€РёР±РєР°' });
        }
    },

    // GET /api/challenges/search-users?q=
    searchUsersForInvite: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { q } = req.query;
            const userId = req.user!.id;

            if (!q || String(q).trim().length < 2) {
                res.json([]);
                return;
            }

            const users = await User.findAll({
                where: {
                    username: { [Op.iLike]: `%${q}%` },
                    id: { [Op.ne]: userId },
                },
                attributes: ['id', 'username', 'avatarUrl', 'rating'],
                limit: 10,
            });

            res.json(users);
        } catch (error) {
            res.status(500).json({ message: 'РћС€РёР±РєР° РїРѕРёСЃРєР°' });
        }
    },

    // DELETE /api/challenges/:id/kick/:userId
    kickParticipant: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const challengeId = Number(req.params.id);
            const targetUserId = Number(req.params.userId);
            const actorUserId = req.user!.id;
            const actorRole = req.user?.role;
            const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

            const result = await kickParticipantFromChallenge({
                challengeId,
                targetUserId,
                actorUserId,
                actorRole,
                reason,
            });

            if (!result.ok) {
                if (result.reason === 'challenge_not_found') {
                    res.status(404).json({ message: 'Челлендж не найден' });
                    return;
                }
                if (result.reason === 'cannot_kick_creator') {
                    res.status(400).json({ message: 'Нельзя исключить создателя челленджа' });
                    return;
                }
                if (result.reason === 'already_kicked') {
                    res.status(409).json({ message: 'Пользователь уже исключён' });
                    return;
                }
                if (result.reason === 'not_participant') {
                    res.status(404).json({ message: 'Пользователь не является участником челленджа' });
                    return;
                }
                res.status(403).json({ message: 'Нет прав для исключения участника' });
                return;
            }

            res.json({
                message: 'Участник исключён из челленджа',
                refundedCoins: result.refundedCoins,
            });
        } catch (error: any) {
            res.status(500).json({ message: 'Ошибка исключения участника: ' + error.message });
        }
    },
};

