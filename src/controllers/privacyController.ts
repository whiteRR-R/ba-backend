import { Response } from 'express';
import { AuthRequest } from '../types';
import { Challenge, Participant, User } from '../models';
import bcrypt from 'bcryptjs';

export const privacyController = {

    // PATCH /api/challenges/:id/visibility
    updateVisibility: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { visibility, password } = req.body;
            const userId = req.user!.id;

            const challenge = await Challenge.findByPk(id);
            if (!challenge) {
                res.status(404).json({ message: 'Челлендж не найден' });
                return;
            }

            if (challenge.creatorId !== userId) {
                res.status(403).json({ message: 'Только создатель может менять настройки' });
                return;
            }

            const validVisibilities = ['secret', 'protected', 'public'];
            if (!validVisibilities.includes(visibility)) {
                res.status(400).json({ message: 'Неверный уровень видимости' });
                return;
            }

            if (visibility === 'protected' && !password?.trim()) {
                res.status(400).json({ message: 'Для защищённого челленджа нужен пароль' });
                return;
            }

            const updateData: any = { visibility };

            if (visibility === 'protected' && password) {
                updateData.accessPassword = await bcrypt.hash(password.trim(), 10);
            } else if (visibility !== 'protected') {
                updateData.accessPassword = null;
            }

            await challenge.update(updateData);

            res.json({
                message: 'Видимость обновлена',
                visibility: challenge.visibility,
                hasPassword: visibility === 'protected',
            });
        } catch (error: any) {
            console.error('updateVisibility error:', error.message);
            res.status(500).json({ message: 'Ошибка обновления видимости' });
        }
    },

    // POST /api/challenges/:id/verify-access
    verifyAccess: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const { password } = req.body;
            const userId = req.user!.id;

            const challenge = await Challenge.findByPk(id) as any;
            if (!challenge) {
                res.status(404).json({ message: 'Челлендж не найден' });
                return;
            }

            // Публичный — всегда доступен
            if (challenge.visibility !== 'protected') {
                res.json({ granted: true });
                return;
            }

            // Создатель всегда имеет доступ
            if (challenge.creatorId === userId) {
                res.json({ granted: true });
                return;
            }

            // Уже участник — тоже доступ
            const isParticipant = await Participant.findOne({
                where: { challengeId: Number(id), userId },
            });
            if (isParticipant) {
                res.json({ granted: true });
                return;
            }

            // Нет пароля в БД — значит открыт
            if (!challenge.accessPassword) {
                res.json({ granted: true });
                return;
            }

            // Пароль не передан
            if (!password) {
                res.status(403).json({ message: 'Требуется пароль', needsPassword: true });
                return;
            }

            const isValid = await bcrypt.compare(password, challenge.accessPassword);
            if (!isValid) {
                res.status(403).json({ message: 'Неверный пароль', needsPassword: true });
                return;
            }

            res.json({ granted: true });
        } catch (error: any) {
            console.error('verifyAccess error:', error.message);
            res.status(500).json({ message: 'Ошибка проверки доступа' });
        }
    },

    // GET /api/privacy/profile
    getProfilePrivacy: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;

            const user = await User.findByPk(userId, {
                attributes: [
                    'id',
                    'showChallengesPublic',
                    'allowFamilyInvites',
                    'allowChallengeInvites',
                ],
            }) as any;

            if (!user) {
                res.status(404).json({ message: 'Пользователь не найден' });
                return;
            }

            res.json({
                showChallengesPublic: user.showChallengesPublic ?? true,
                allowFamilyInvites: user.allowFamilyInvites ?? true,
                allowChallengeInvites: user.allowChallengeInvites ?? true,
            });
        } catch (error: any) {
            console.error('getProfilePrivacy error:', error.message);
            res.status(500).json({ message: 'Ошибка получения настроек' });
        }
    },

    // PATCH /api/privacy/profile
    updateProfilePrivacy: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;
            const {
                showChallengesPublic,
                allowFamilyInvites,
                allowChallengeInvites,
            } = req.body;

            const updateData: any = {};
            if (showChallengesPublic !== undefined) updateData.showChallengesPublic = showChallengesPublic;
            if (allowFamilyInvites !== undefined) updateData.allowFamilyInvites = allowFamilyInvites;
            if (allowChallengeInvites !== undefined) updateData.allowChallengeInvites = allowChallengeInvites;

            await User.update(updateData, { where: { id: userId } });

            res.json({ message: 'Настройки приватности обновлены', ...updateData });
        } catch (error: any) {
            console.error('updateProfilePrivacy error:', error.message);
            res.status(500).json({ message: 'Ошибка обновления настроек' });
        }
    },
};