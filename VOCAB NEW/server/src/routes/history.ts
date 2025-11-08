import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/requireAuth';
import { AuthRequest } from '../middleware/auth';
import { saveSession, listSessions, getSession } from '../services/history';
import { HttpError } from '../utils/httpError';
import { logger, logError, logApiRequest } from '../utils/logger';

const router = Router();

const sessionSchema = z.object({
  mode: z.literal('authenticated'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  words: z.array(z.string()),
  superJson: z.any(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      choiceId: z.string(),
      correct: z.boolean(),
      elapsedMs: z.number(),
    }),
  ),
  score: z.number(),
  analysis: z.object({
    report: z.string(),
    recommendations: z.array(z.string()),
  }),
});

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new HttpError(401, 'Authentication required');
      }
      const session = sessionSchema.parse(req.body);

      logger.info(`History API: POST /api/history - Saving session for user ${req.user.email} (${session.words.length} words, score: ${session.score}%) from ${req.ip}`);

      const saved = saveSession({
        ...session,
        userId,
      });

      logger.info(`History API: Successfully saved session ${saved.id}`);

      logApiRequest('POST', '/api/history', 201);

      res.status(201).json(saved);
    } catch (error) {
      logError('History API: /api/history POST failed', error);
      logApiRequest('POST', '/api/history', 500);
      throw error;
    }
  }),
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new HttpError(401, 'Authentication required');
      }

      logger.info(`History API: GET /api/history - Listing sessions for user ${req.user.email} from ${req.ip}`);

      const sessions = listSessions(userId);

      logger.info(`History API: Retrieved ${sessions.length} sessions`);

      logApiRequest('GET', '/api/history', 200);

      res.json({ sessions });
    } catch (error) {
      logError('History API: /api/history GET failed', error);
      logApiRequest('GET', '/api/history', 500);
      throw error;
    }
  }),
);

router.get(
  '/:sessionId',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new HttpError(401, 'Authentication required');
      }
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing session id' });
      }

      logger.info(`History API: GET /api/history/${sessionId} - User ${req.user.email} from ${req.ip}`);

      const session = getSession(userId, sessionId);
      if (!session) {
        logger.info(`History API: Session ${sessionId} not found for user ${req.user.email}`);
        logApiRequest('GET', `/api/history/${sessionId}`, 404);
        return res.status(404).json({ message: 'Not found' });
      }

      logger.info(`History API: Successfully retrieved session ${sessionId}`);

      logApiRequest('GET', `/api/history/${sessionId}`, 200);

      res.json(session);
    } catch (error) {
      logError('History API: /api/history/:sessionId failed', error);
      logApiRequest('GET', `/api/history/${req.params.sessionId}`, 500);
      throw error;
    }
  }),
);

export default router;
