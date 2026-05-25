import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';

export const generateToken = (payload: {
  id: number;
  email: string;
  role: string;
}): string => {
  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
};