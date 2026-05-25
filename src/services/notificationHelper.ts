import Notification, { NotificationType } from '../models/Notification';

interface CreateNotifParams {
    userId: number;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, any>;
}

export const notificationHelper = {

    create: async (params: CreateNotifParams): Promise<void> => {
        try {
            await Notification.create({
                userId: params.userId,
                type: params.type,
                title: params.title,
                body: params.body,
                data: params.data ? JSON.stringify(params.data) : undefined,
            });
        } catch (err: any) {
            // Не ломаем основной поток если уведомление не создалось
            console.error('notificationHelper.create error:', err.message);
        }
    },

    // ── Готовые хелперы для каждого типа ──────────────────────────

    newVote: async (
        submissionOwnerId: number,
        voterUsername: string,
        score: number,
        submissionId: number,
        taskTitle: string,
        isAnonymous: boolean
    ) => {
        const from = isAnonymous ? '🕵️ Анонимно' : voterUsername;
        await notificationHelper.create({
            userId: submissionOwnerId,
            type: 'new_vote',
            title: '⭐ Новая оценка!',
            body: `${from} оценил твою работу «${taskTitle}» на ${score} из 5`,
            data: { submissionId, score, voterUsername: isAnonymous ? null : voterUsername },
        });
    },

    voteUpdated: async (
        submissionOwnerId: number,
        voterUsername: string,
        score: number,
        submissionId: number,
        taskTitle: string,
        isAnonymous: boolean
    ) => {
        const from = isAnonymous ? '🕵️ Анонимно' : voterUsername;
        await notificationHelper.create({
            userId: submissionOwnerId,
            type: 'vote_updated',
            title: '✏️ Оценка изменена',
            body: `${from} изменил оценку за «${taskTitle}» на ${score} из 5`,
            data: { submissionId, score },
        });
    },

    newParticipant: async (
        challengeCreatorId: number,
        newUsername: string,
        challengeId: number,
        challengeTitle: string
    ) => {
        await notificationHelper.create({
            userId: challengeCreatorId,
            type: 'new_participant',
            title: '🎉 Новый участник!',
            body: `${newUsername} вступил в твой челлендж «${challengeTitle}»`,
            data: { challengeId },
        });
    },

    challengeStarted: async (
        participantId: number,
        challengeId: number,
        challengeTitle: string
    ) => {
        await notificationHelper.create({
            userId: participantId,
            type: 'challenge_started',
            title: '🔥 Челлендж начался!',
            body: `Челлендж «${challengeTitle}» теперь активен. Удачи!`,
            data: { challengeId },
        });
    },

    challengeEnded: async (
        participantId: number,
        challengeId: number,
        challengeTitle: string,
        place: number,
        prize: number
    ) => {
        const placeEmoji = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '📋';
        const prizeText = prize > 0 ? ` Ты получил ${prize} 🪙!` : '';
        await notificationHelper.create({
            userId: participantId,
            type: 'challenge_ended',
            title: `${placeEmoji} Челлендж завершён`,
            body: `«${challengeTitle}» завершён. Твоё место: #${place}.${prizeText}`,
            data: { challengeId, place, prize },
        });
    },

    newBet: async (
        targetUserId: number,
        betCreatorUsername: string,
        amount: number,
        challengeId: number,
        challengeTitle: string
    ) => {
        await notificationHelper.create({
            userId: targetUserId,
            type: 'new_bet',
            title: '🎯 На тебя сделали ставку!',
            body: `${betCreatorUsername} ставит ${amount} 🪙 на твою победу в «${challengeTitle}»`,
            data: { challengeId, amount },
        });
    },

    betJoined: async (
        betCreatorId: number,
        joinerUsername: string,
        amount: number,
        challengeId: number,
        challengeTitle: string
    ) => {
        await notificationHelper.create({
            userId: betCreatorId,
            type: 'bet_joined',
            title: '⚔️ Ставку приняли!',
            body: `${joinerUsername} принял твою ставку в «${challengeTitle}». Банк: ${amount * 2} 🪙`,
            data: { challengeId, amount },
        });
    },
};