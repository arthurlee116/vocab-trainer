import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { login, register } from '../services/auth';
import { AuthRequest } from '../middleware/auth';
import { logger, logError, logApiRequest } from '../utils/logger';

const router = Router();

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    try {
      const result = credentialsSchema.parse(req.body);

      logger.info(`Auth API: POST /api/auth/register - Registering user ${result.email} from ${req.ip}`);

      const payload = await register(result.email.toLowerCase(), result.password);

      logger.info(`Auth API: Successfully registered user ${result.email}`);

      logApiRequest('POST', '/api/auth/register', 200);

      res.json(payload);
    } catch (error) {
      logError('Auth API: /api/auth/register failed', error);
      logApiRequest('POST', '/api/auth/register', 500);
      throw error;
    }
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    try {
      const result = credentialsSchema.parse(req.body);

      logger.info(`Auth API: POST /api/auth/login - User ${result.email} from ${req.ip}`);

      const payload = await login(result.email.toLowerCase(), result.password);

      logger.info(`Auth API: Successfully logged in user ${result.email}`);

      logApiRequest('POST', '/api/auth/login', 200);

      res.json(payload);
    } catch (error) {
      logError('Auth API: /api/auth/login failed', error);
      logApiRequest('POST', '/api/auth/login', 500);
      throw error;
    }
  }),
);

router.get(
  '/me',
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        logger.info(`Auth API: GET /api/auth/me - No user from ${req.ip}`);
        logApiRequest('GET', '/api/auth/me', 204);
        return res.status(204).send();
      }

      logger.info(`Auth API: GET /api/auth/me - User ${req.user.email} from ${req.ip}`);

      logApiRequest('GET', '/api/auth/me', 200);

      res.json({ user: req.user });
    } catch (error) {
      logError('Auth API: /api/auth/me failed', error);
      logApiRequest('GET', '/api/auth/me', 500);
      throw error;
    }
  }),
);

export default router;
