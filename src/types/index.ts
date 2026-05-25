import { Request } from 'express';

// Расширяем Request чтобы добавить пользователя после JWT проверки
export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export type UserRole = 'admin' | 'moderator' | 'user';
export type ChallengeStatus = 'active' | 'pending' | 'completed' | 'cancelled';
export type VisibilityLevel = 'secret' | 'protected' | 'public';