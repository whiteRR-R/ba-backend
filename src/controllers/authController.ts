import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models';
import { generateToken } from '../utils/jwt';
import { AuthRequest } from '../types';

export const authController = {

  // POST /api/auth/register
  register: async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, email, password } = req.body;

      // Проверяем — существует ли пользователь
      const existingUser = await User.findOne({
        where: { email }
      });

      if (existingUser) {
        res.status(400).json({ message: 'Email уже используется' });
        return;
      }

      const existingUsername = await User.findOne({ where: { username } });
      if (existingUsername) {
        res.status(400).json({ message: 'Имя пользователя уже занято' });
        return;
      }

      // Хешируем пароль (число 12 = сложность хеширования)
      const hashedPassword = await bcrypt.hash(password, 12);

      const user = await User.create({
        username,
        email,
        password: hashedPassword,
        role: 'user',
      });

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        rating: user.rating,
        rikonCoins: user.rikonCoins,
        token,
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ message: 'Ошибка регистрации' });
    }
  },

  // POST /api/auth/login
  login: async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ where: { email } });

      if (!user) {
        res.status(401).json({ message: 'Неверный email или пароль' });
        return;
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        res.status(401).json({ message: 'Неверный email или пароль' });
        return;
      }

      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        rating: user.rating,
        rikonCoins: user.rikonCoins,
        avatarUrl: user.avatarUrl,
        token,
      });
    } catch (error) {
      res.status(500).json({ message: 'Ошибка входа' });
    }
  },

  // ================================================
  // GET /api/auth/users
  getAllUsers: async (req: Request, res: Response): Promise<void> => {
    try {
      const users = await User.findAll({
        attributes: { exclude: ['password'] } // Безопасность: не показываем хеши паролей
      });
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Ошибка при получении списка пользователей' });
    }
  },
  // ================================================

  // GET /api/auth/me  (требует токен)
  getMe: async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const user = await User.findByPk(req.user!.id, {
        attributes: { exclude: ['password'] }, // Никогда не отдаём пароль
      });

      if (!user) {
        res.status(404).json({ message: 'Пользователь не найден' });
        return;
      }

      res.json(user);
    } catch (error) {
      res.status(500).json({ message: 'Ошибка получения профиля' });
    }
  },
};