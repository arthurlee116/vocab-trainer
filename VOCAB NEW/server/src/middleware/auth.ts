import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const authMiddleware = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }

  const token = authHeader.replace('Bearer ', '');
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { id: string; email: string };
    req.user = {
      id: payload.id,
      email: payload.email,
    };
  } catch (error) {
    // ignore invalid tokens to allow guest mode
  }

  next();
};
