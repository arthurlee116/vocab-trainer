import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { generateSuperJson } from '../services/superGenerator';
import {
  getGenerationSessionSnapshot,
  retryGenerationSection,
  startGenerationSession,
} from '../services/generation-session';
import { HttpError } from '../utils/httpError';
import { logger, logError, logApiRequest } from '../utils/logger';

const router = Router();

const payloadSchema = z.object({
  words: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  questionCountPerType: z.number().min(3).max(30).optional(),
});

const retrySchema = z.object({
  type: z.enum(['questions_type_1', 'questions_type_2', 'questions_type_3']),
});

router.post(
  '/session',
  asyncHandler(async (req, res) => {
    try {
      const { words, difficulty, questionCountPerType } = payloadSchema.parse(req.body);
      logger.info(
        `Generation API: POST /api/generation/session - Starting segmented generation (${difficulty}) for ${words.length} words from ${req.ip}`,
      );

      const sessionPayload = {
        words,
        difficulty,
        ...(questionCountPerType ? { questionCountPerType } : {}),
      };

      const snapshot = await startGenerationSession(sessionPayload);

      logApiRequest('POST', '/api/generation/session', 200);
      res.json(snapshot);
    } catch (error) {
      logError('Generation API: /api/generation/session failed', error);
      logApiRequest('POST', '/api/generation/session', 500);
      throw error;
    }
  }),
);

router.get(
  '/session/:sessionId',
  asyncHandler(async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        throw new HttpError(400, 'Missing session id');
      }
      const snapshot = getGenerationSessionSnapshot(sessionId);
      logApiRequest('GET', '/api/generation/session/:sessionId', 200);
      res.json(snapshot);
    } catch (error) {
      logError('Generation API: /api/generation/session/:sessionId failed', error);
      logApiRequest('GET', '/api/generation/session/:sessionId', 500);
      throw error;
    }
  }),
);

router.post(
  '/session/:sessionId/retry',
  asyncHandler(async (req, res) => {
    try {
      const payload = retrySchema.parse(req.body);
      const { sessionId } = req.params;
      if (!sessionId) {
        throw new HttpError(400, 'Missing session id');
      }
      const snapshot = await retryGenerationSection(sessionId, payload.type);
      logApiRequest('POST', '/api/generation/session/:sessionId/retry', 200);
      res.json(snapshot);
    } catch (error) {
      logError('Generation API: /api/generation/session/:sessionId/retry failed', error);
      logApiRequest('POST', '/api/generation/session/:sessionId/retry', 500);
      throw error;
    }
  }),
);

router.post(
  '/super-json',
  asyncHandler(async (req, res) => {
    try {
      const { words, difficulty, questionCountPerType } = payloadSchema.parse(req.body);

      logger.info(`Generation API: POST /api/generation/super-json - Generating ${questionCountPerType || 10} questions of type 1/2/3 for ${words.length} words (${difficulty}) from ${req.ip}`);

      const superJson = await generateSuperJson(words, difficulty, questionCountPerType);

      const totalQuestions = superJson.metadata?.totalQuestions || 0;
      logger.info(`Generation API: Successfully generated ${totalQuestions} total questions`);

      logApiRequest('POST', '/api/generation/super-json', 200);

      res.json({ superJson });
    } catch (error) {
      logError('Generation API: /api/generation/super-json failed', error);
      logApiRequest('POST', '/api/generation/super-json', 500);
      throw error;
    }
  }),
);

export default router;
