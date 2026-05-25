import { Response } from 'express';
import { AuthRequest } from '../types';
import { Message, User, FamilyMember, Challenge, Participant } from '../models';

export const chatController = {

  // GET /api/chat/:roomType/:roomId
  // roomType = 'family' | 'challenge'
  getMessages: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { roomType, roomId } = req.params;
      const userId = req.user!.id;
      const limit  = Number(req.query.limit)  || 50;
      const before = req.query.before as string | undefined; // ISO date для пагинации

      // ── Проверка доступа ──────────────────────────────────────────
      if (roomType === 'family') {
        // Доступ: владелец семьи ИЛИ член семьи
        const isOwner  = Number(roomId) === userId;
        const isMember = await FamilyMember.findOne({
          where: { userId: Number(roomId), appUserId: userId },
        });
        if (!isOwner && !isMember) {
          res.status(403).json({ message: 'Нет доступа к этому чату' });
          return;
        }
      } else if (roomType === 'challenge') {
        // Доступ: участник челленджа
        const isParticipant = await Participant.findOne({
          where: { challengeId: Number(roomId), userId },
        });
        const challenge = await Challenge.findByPk(Number(roomId));
        const isCreator = challenge?.creatorId === userId;
        if (!isParticipant && !isCreator) {
          res.status(403).json({ message: 'Нет доступа к этому чату' });
          return;
        }
      } else {
        res.status(400).json({ message: 'Неверный тип комнаты' });
        return;
      }

      // ── Загрузка сообщений ────────────────────────────────────────
      const whereClause: any = { roomType, roomId: Number(roomId) };
      if (before) {
        whereClause.createdAt = { $lt: new Date(before) };
      }

      const messages = await Message.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit,
      });

      // Подгружаем данные авторов
      const userIds = [...new Set(messages.map((m) => m.userId))];
      const users   = await User.findAll({
        where: { id: userIds },
        attributes: ['id', 'username', 'avatarUrl'],
      });
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

      const result = messages.reverse().map((m) => ({
        id:        m.id,
        text:      m.text,
        userId:    m.userId,
        createdAt: m.createdAt,
        user:      userMap[m.userId]
          ? { id: userMap[m.userId].id, username: userMap[m.userId].username, avatarUrl: userMap[m.userId].avatarUrl }
          : { id: m.userId, username: 'Удалён', avatarUrl: null },
      }));

      res.json(result);
    } catch (error: any) {
      console.error('getMessages error:', error.message);
      res.status(500).json({ message: 'Ошибка загрузки сообщений' });
    }
  },

  // POST /api/chat/:roomType/:roomId
  sendMessage: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { roomType, roomId } = req.params;
      const userId = req.user!.id;
      const { text } = req.body;

      if (!text || !text.trim()) {
        res.status(400).json({ message: 'Сообщение не может быть пустым' });
        return;
      }

      if (text.trim().length > 2000) {
        res.status(400).json({ message: 'Сообщение слишком длинное (макс. 2000 символов)' });
        return;
      }

      // ── Проверка доступа ──────────────────────────────────────────
      if (roomType === 'family') {
        const isOwner  = Number(roomId) === userId;
        const isMember = await FamilyMember.findOne({
          where: { userId: Number(roomId), appUserId: userId },
        });
        if (!isOwner && !isMember) {
          res.status(403).json({ message: 'Нет доступа к этому чату' });
          return;
        }
      } else if (roomType === 'challenge') {
        const isParticipant = await Participant.findOne({
          where: { challengeId: Number(roomId), userId },
        });
        const challenge = await Challenge.findByPk(Number(roomId));
        const isCreator = challenge?.creatorId === userId;
        if (!isParticipant && !isCreator) {
          res.status(403).json({ message: 'Нет доступа к этому чату' });
          return;
        }
      } else {
        res.status(400).json({ message: 'Неверный тип комнаты' });
        return;
      }

      // ── Сохраняем сообщение ───────────────────────────────────────
      const message = await Message.create({
        roomType: roomType as 'family' | 'challenge',
        roomId:   Number(roomId),
        userId,
        text:     text.trim(),
      });

      const author = await User.findByPk(userId, {
        attributes: ['id', 'username', 'avatarUrl'],
      });

      res.status(201).json({
        id:        message.id,
        text:      message.text,
        userId:    message.userId,
        createdAt: message.createdAt,
        user: author
          ? { id: author.id, username: author.username, avatarUrl: author.avatarUrl }
          : { id: userId, username: 'Пользователь', avatarUrl: null },
      });
    } catch (error: any) {
      console.error('sendMessage error:', error.message);
      res.status(500).json({ message: 'Ошибка отправки сообщения' });
    }
  },

  // DELETE /api/chat/message/:messageId
  deleteMessage: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { messageId } = req.params;
      const userId = req.user!.id;

      const message = await Message.findByPk(messageId);
      if (!message) {
        res.status(404).json({ message: 'Сообщение не найдено' });
        return;
      }

      if (message.userId !== userId) {
        res.status(403).json({ message: 'Можно удалять только свои сообщения' });
        return;
      }

      await message.destroy();
      res.json({ message: 'Удалено' });
    } catch (error: any) {
      console.error('deleteMessage error:', error.message);
      res.status(500).json({ message: 'Ошибка удаления' });
    }
  },
};