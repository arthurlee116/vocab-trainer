import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { HttpError } from '../utils/httpError';

export const requireAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new HttpError(401, 'Authentication required');
  }

  next();
};
