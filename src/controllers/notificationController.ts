import { Response } from 'express';
import { Op } from 'sequelize';
import { AuthRequest } from '../types';
import Notification from '../models/Notification';

export const notificationController = {

    // GET /api/notifications
    getAll: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;
            const limit = Number(req.query.limit) || 50;

            const notifications = await Notification.findAll({
                where: { userId },
                order: [['createdAt', 'DESC']],
                limit,
            });

            const result = notifications.map((n) => ({
                id: n.id,
                type: n.type,
                title: n.title,
                body: n.body,
                data: n.data ? JSON.parse(n.data) : null,
                isRead: n.isRead,
                createdAt: n.createdAt,
            }));

            res.json(result);
        } catch (err: any) {
            console.error('getAll notifications error:', err.message);
            res.status(500).json({ message: 'Ошибка загрузки уведомлений' });
        }
    },

    // GET /api/notifications/count  — количество непрочитанных
    getUnreadCount: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;
            const count = await Notification.count({ where: { userId, isRead: false } });
            res.json({ count });
        } catch (err: any) {
            res.status(500).json({ message: 'Ошибка' });
        }
    },

    // PATCH /api/notifications/:id/read  — пометить одно прочитанным
    markRead: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            const notif = await Notification.findByPk(id);
            if (!notif || notif.userId !== userId) {
                res.status(404).json({ message: 'Не найдено' });
                return;
            }

            await notif.update({ isRead: true });
            res.json({ message: 'OK' });
        } catch (err: any) {
            res.status(500).json({ message: 'Ошибка' });
        }
    },

    // PATCH /api/notifications/read-all  — пометить все прочитанными
    markAllRead: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;
            await Notification.update({ isRead: true }, { where: { userId, isRead: false } });
            res.json({ message: 'Все прочитаны' });
        } catch (err: any) {
            res.status(500).json({ message: 'Ошибка' });
        }
    },

    // DELETE /api/notifications/:id
    deleteOne: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { id } = req.params;
            const userId = req.user!.id;

            const notif = await Notification.findByPk(id);
            if (!notif || notif.userId !== userId) {
                res.status(404).json({ message: 'Не найдено' });
                return;
            }

            await notif.destroy();
            res.json({ message: 'Удалено' });
        } catch (err: any) {
            res.status(500).json({ message: 'Ошибка' });
        }
    },

    // DELETE /api/notifications/clear-all
    clearAll: async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const userId = req.user!.id;
            await Notification.destroy({ where: { userId } });
            res.json({ message: 'Очищено' });
        } catch (err: any) {
            res.status(500).json({ message: 'Ошибка' });
        }
    },
};