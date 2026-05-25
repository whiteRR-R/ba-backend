import { Response } from 'express';
import { AuthRequest } from '../types';
import { Op } from 'sequelize';
import { FamilyMember, FamilyEvent, FamilyInvite, User } from '../models';

export const familyController = {

  // GET /api/family/members
  getMembers: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const members = await FamilyMember.findAll({
        where: { userId },
        order: [['createdAt', 'ASC']],
      });
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка' });
    }
  },

  // POST /api/family/members
  addMember: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { name, relation, birthYear, bio, parentId, appUserId } = req.body;

      if (!name || !relation) {
        res.status(400).json({ message: 'Имя и родство обязательны' });
        return;
      }

      const member = await FamilyMember.create({
        userId,
        name,
        relation,
        birthYear: birthYear || null,
        bio:       bio || null,
        parentId:  parentId || null,
        appUserId: appUserId || null,
      });

      res.status(201).json(member);
    } catch (error: any) {
      console.error('addMember error:', error.message);
      res.status(500).json({ message: 'Ошибка добавления' });
    }
  },

  // PUT /api/family/members/:memberId
  updateMember: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { memberId } = req.params;
      const userId = req.user!.id;
      const { name, relation, birthYear, bio } = req.body;

      const member = await FamilyMember.findByPk(memberId);
      if (!member || member.userId !== userId) {
        res.status(404).json({ message: 'Не найдено' });
        return;
      }

      await member.update({ name, relation, birthYear, bio });
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка обновления' });
    }
  },

  // DELETE /api/family/members/:memberId
  deleteMember: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { memberId } = req.params;
      const userId = req.user!.id;

      const member = await FamilyMember.findByPk(memberId);
      if (!member || member.userId !== userId) {
        res.status(404).json({ message: 'Не найдено' });
        return;
      }

      // Убираем parentId у детей этого члена
      await FamilyMember.update(
        { parentId: undefined },
        { where: { parentId: member.id } }
      );

      await member.destroy();
      res.json({ message: 'Удалено' });
    } catch (error) {
      res.status(500).json({ message: 'Ошибка удаления' });
    }
  },

  // GET /api/family/events
  getEvents: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const events = await FamilyEvent.findAll({
        where: { userId },
        order: [['year', 'DESC'], ['month', 'DESC']],
      });
      res.json(events);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка' });
    }
  },

  // POST /api/family/events
  addEvent: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { title, description, year, month, day, emoji } = req.body;

      if (!title || !year) {
        res.status(400).json({ message: 'Название и год обязательны' });
        return;
      }

      const event = await FamilyEvent.create({
        userId,
        title,
        description: description || null,
        year:        Number(year),
        month:       month ? Number(month) : undefined,
        day:         day ? Number(day) : undefined,
        emoji:       emoji || '📅',
      });

      res.status(201).json(event);
    } catch (error: any) {
      console.error('addEvent error:', error.message);
      res.status(500).json({ message: 'Ошибка добавления события' });
    }
  },

  // DELETE /api/family/events/:eventId
  deleteEvent: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { eventId } = req.params;
      const userId = req.user!.id;

      const event = await FamilyEvent.findByPk(eventId);
      if (!event || event.userId !== userId) {
        res.status(404).json({ message: 'Не найдено' });
        return;
      }

      await event.destroy();
      res.json({ message: 'Удалено' });
    } catch (error) {
      res.status(500).json({ message: 'Ошибка удаления' });
    }
  },

// Добавь в familyController объект:
// GET /api/family/all-members
// Возвращает членов ВСЕХ семей где состоит пользователь
getAllFamilyMembers: async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    // 1. Своё дерево
    const ownMembers = await FamilyMember.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']],
    });

    // 2. Семьи где этот пользователь является членом (appUserId = userId)
    const memberEntries = await FamilyMember.findAll({
      where: { appUserId: userId },
      attributes: ['userId'],
    });

    // Уникальные владельцы семей где состоит пользователь
    const ownerIds = [...new Set(memberEntries.map((m) => m.userId))];

    // Получаем членов этих семей
    const otherFamilies = await Promise.all(
      ownerIds.map(async (ownerId) => {
        const owner = await User.findByPk(ownerId, {
          attributes: ['id', 'username'],
        });

        const members = await FamilyMember.findAll({
          where: { userId: ownerId },
          order: [['createdAt', 'ASC']],
        });

        return {
          ownerId,
          ownerName: owner?.username ?? 'Неизвестно',
          isOwn:     false,
          members,
        };
      })
    );

    res.json({
      ownFamily: {
        ownerId:   userId,
        ownerName: 'Моя семья',
        isOwn:     true,
        members:   ownMembers,
      },
      otherFamilies,
    });
  } catch (error: any) {
    console.error('getAllFamilyMembers error:', error.message);
    res.status(500).json({ message: 'Ошибка' });
  }
},
// GET /api/family/search-users?q=имя
searchUsers: async (req: AuthRequest, res: Response): Promise<void> => {
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
        id:       { [Op.ne]: userId },      // исключаем себя
      },
      attributes: ['id', 'username', 'avatarUrl', 'rating'],
      limit: 10,
    });

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка поиска' });
  }
},

// POST /api/family/invite
sendInvite: async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const fromUserId = req.user!.id;
    const { toUserId, relation, parentId, birthYear } = req.body;

    if (!toUserId || !relation) {
      res.status(400).json({ message: 'Укажи пользователя и роль' });
      return;
    }

    // ✅ Проверяем — не отключил ли получатель приглашения в семью
    const targetUser = await User.findByPk(toUserId, {
      attributes: ['id', 'username', 'allowFamilyInvites'],
    }) as any;

    if (!targetUser) {
      res.status(404).json({ message: 'Пользователь не найден' });
      return;
    }

    if (targetUser.allowFamilyInvites === false) {
      res.status(403).json({
        message: `${targetUser.username} отключил приглашения в семью`,
        blocked: true,
      });
      return;
    }

    // Проверяем — уже есть pending приглашение?
    const existing = await FamilyInvite.findOne({
      where: { fromUserId, toUserId, status: 'pending' },
    });

    if (existing) {
      res.status(400).json({ message: 'Приглашение уже отправлено' });
      return;
    }

    // Проверяем — не в семье ли уже?
    const alreadyMember = await FamilyMember.findOne({
      where: { userId: fromUserId, appUserId: toUserId },
    });

    if (alreadyMember) {
      res.status(400).json({ message: 'Этот пользователь уже в семье' });
      return;
    }

    const invite = await FamilyInvite.create({
      fromUserId,
      toUserId:  Number(toUserId),
      relation,
      parentId:  parentId  ? Number(parentId)  : undefined,
      birthYear: birthYear ? Number(birthYear) : undefined,
    });

    res.status(201).json(invite);
  } catch (error: any) {
    console.error('sendInvite error:', error.message);
    res.status(500).json({ message: 'Ошибка отправки приглашения' });
  }
},

// GET /api/family/invites — мои входящие приглашения
getMyInvites: async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;

    const invites = await FamilyInvite.findAll({
      where: { toUserId: userId, status: 'pending' },
      include: [{
        model: User,
        as: 'sender',
        attributes: ['id', 'username', 'avatarUrl'],
      }],
      order: [['createdAt', 'DESC']],
    });

    res.json(invites);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка' });
  }
},

// PATCH /api/family/invites/:inviteId — принять или отклонить
respondInvite: async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { inviteId } = req.params;
    const { accept }   = req.body;   // true = принять, false = отклонить
    const userId       = req.user!.id;

    const invite = await FamilyInvite.findByPk(inviteId);

    if (!invite || invite.toUserId !== userId) {
      res.status(404).json({ message: 'Приглашение не найдено' });
      return;
    }

    if (invite.status !== 'pending') {
      res.status(400).json({ message: 'Приглашение уже обработано' });
      return;
    }

    if (accept) {
      // Принято — добавляем в дерево отправителя
      await FamilyMember.create({
        userId:    invite.fromUserId,
        name:      (await User.findByPk(userId))?.username ?? 'Участник',
        relation:  invite.relation as any,
        birthYear: invite.birthYear,
        parentId:  invite.parentId,
        appUserId: userId,           // ссылка на реального пользователя
      });

      await invite.update({ status: 'accepted' });
      res.json({ message: 'Приглашение принято! Ты добавлен в семью.' });
    } else {
      await invite.update({ status: 'rejected' });
      res.json({ message: 'Приглашение отклонено' });
    }
  } catch (error: any) {
    console.error('respondInvite error:', error.message);
    res.status(500).json({ message: 'Ошибка' });
  }
},

};