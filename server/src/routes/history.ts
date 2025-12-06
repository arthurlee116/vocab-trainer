import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { requireAuth } from '../middleware/requireAuth';
import { AuthRequest } from '../middleware/auth';
import { saveSession, listSessions, getSession, updateProgress, deleteSession, updateSessionSuperJson, getLearningStats, createInProgressSession } from '../services/history';
import { SessionStatus } from '../types';
import { HttpError } from '../utils/httpError';
import { logger, logError, logApiRequest } from '../utils/logger';

const router = Router();

// Schema for creating in-progress session (Requirements 2.1, 2.2)
const inProgressSessionSchema = z.object({
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  words: z.array(z.string()).min(1),
  superJson: z.any(),
});

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

// Schema for progress update (Requirements 2.1)
const progressSchema = z.object({
  answer: z.object({
    questionId: z.string(),
    choiceId: z.string().optional(),
    userInput: z.string().optional(),
    correct: z.boolean(),
    elapsedMs: z.number(),
  }),
  currentQuestionIndex: z.number().int().min(0),
});

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = user.id;
      const session = sessionSchema.parse(req.body);

      logger.info(`History API: POST /api/history - Saving session for user ${user.email} (${session.words.length} words, score: ${session.score}%) from ${req.ip}`);

      const saved = saveSession({
        ...session,
        userId,
        status: 'completed' as const,
        currentQuestionIndex: session.answers.length,
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

/**
 * POST /api/history/in-progress
 * Create a new in-progress session when user starts practice
 * Requirements: 2.1, 2.2, 2.3
 */
router.post(
  '/in-progress',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = user.id;

      // Validate request body (Requirement 2.1)
      const { difficulty, words, superJson } = inProgressSessionSchema.parse(req.body);

      logger.info(`History API: POST /api/history/in-progress - Creating in-progress session for user ${user.email} (${words.length} words, difficulty: ${difficulty}) from ${req.ip}`);

      // Create session with initial state (Requirement 2.2)
      const session = createInProgressSession({
        userId,
        mode: 'authenticated',
        difficulty,
        words,
        superJson,
      });

      logger.info(`History API: Successfully created in-progress session ${session.id}`);

      logApiRequest('POST', '/api/history/in-progress', 201);

      // Return session ID and creation timestamp (Requirement 2.3)
      res.status(201).json({
        id: session.id,
        createdAt: session.createdAt,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        logError('History API: /api/history/in-progress validation failed', error);
        logApiRequest('POST', '/api/history/in-progress', 400);
        throw new HttpError(400, 'Invalid request body: ' + error.errors.map(e => e.message).join(', '));
      }
      logError('History API: /api/history/in-progress POST failed', error);
      logApiRequest('POST', '/api/history/in-progress', 500);
      throw error;
    }
  }),
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = user.id;

      // Parse optional status query parameter (Requirements 4.1)
      const statusParam = req.query.status as string | undefined;
      const status: SessionStatus | undefined = 
        statusParam === 'in_progress' || statusParam === 'completed' 
          ? statusParam 
          : undefined;

      logger.info(`History API: GET /api/history - Listing sessions for user ${user.email}${status ? ` (status: ${status})` : ''} from ${req.ip}`);

      const sessions = listSessions(userId, status);

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
  '/stats',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = user.id;

      logger.info(`History API: GET /api/history/stats - User ${user.email} from ${req.ip}`);

      const stats = getLearningStats(userId);

      logger.info(`History API: Successfully retrieved stats for user ${user.email} - Words: ${stats.totalWordsLearned}, Sessions: ${stats.totalSessionsCompleted}`);

      logApiRequest('GET', '/api/history/stats', 200);

      res.json(stats);
    } catch (error) {
      logError('History API: /api/history/stats GET failed', error);
      logApiRequest('GET', '/api/history/stats', 500);
      throw error;
    }
  }),
);

/**
 * GET /api/history/:sessionId
 * Get a specific session by ID
 */
router.get(
  '/:sessionId',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = user.id;
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing session id' });
      }

      logger.info(`History API: GET /api/history/${sessionId} - User ${user.email} from ${req.ip}`);

      const session = getSession(userId, sessionId);
      if (!session) {
        logger.info(`History API: Session ${sessionId} not found for user ${user.email}`);
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

/**
 * PATCH /api/history/:sessionId/progress
 * Save answer progress for an in-progress session
 * Requirements: 2.1
 */
router.patch(
  '/:sessionId/progress',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = user.id;
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing session id' });
      }

      const { answer, currentQuestionIndex } = progressSchema.parse(req.body);

      logger.info(`History API: PATCH /api/history/${sessionId}/progress - User ${user.email}, index ${currentQuestionIndex} from ${req.ip}`);

      // Convert the answer to match AnswerRecord type expectations
      const answerRecord: import('../types').AnswerRecord = {
        questionId: answer.questionId,
        ...(answer.choiceId !== undefined && { choiceId: answer.choiceId }),
        ...(answer.userInput !== undefined && { userInput: answer.userInput }),
        correct: answer.correct,
        elapsedMs: answer.elapsedMs,
      };

      const updated = updateProgress(userId, sessionId, answerRecord, currentQuestionIndex);
      if (!updated) {
        logger.info(`History API: Session ${sessionId} not found for user ${user.email}`);
        logApiRequest('PATCH', `/api/history/${sessionId}/progress`, 404);
        return res.status(404).json({ message: 'Session not found' });
      }

      logger.info(`History API: Successfully updated progress for session ${sessionId}, status: ${updated.status}`);

      logApiRequest('PATCH', `/api/history/${sessionId}/progress`, 200);

      // Return summary instead of full session
      res.json({
        id: updated.id,
        status: updated.status,
        currentQuestionIndex: updated.currentQuestionIndex,
        answeredCount: updated.answers.length,
        score: updated.score,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      logError('History API: /api/history/:sessionId/progress PATCH failed', error);
      logApiRequest('PATCH', `/api/history/${req.params.sessionId}/progress`, 500);
      throw error;
    }
  }),
);

/**
 * PATCH /api/history/:sessionId/super-json
 * Update superJson for an in-progress session (when retry succeeds)
 * Requirements: 7.3
 */
router.patch(
  '/:sessionId/super-json',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = user.id;
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing session id' });
      }

      const { superJson } = req.body;
      if (!superJson) {
        return res.status(400).json({ message: 'Missing superJson in request body' });
      }

      logger.info(`History API: PATCH /api/history/${sessionId}/super-json - User ${user.email} from ${req.ip}`);

      const updated = updateSessionSuperJson(userId, sessionId, superJson);
      if (!updated) {
        logger.info(`History API: Session ${sessionId} not found or not in-progress for user ${user.email}`);
        logApiRequest('PATCH', `/api/history/${sessionId}/super-json`, 404);
        return res.status(404).json({ message: 'Session not found or not in-progress' });
      }

      logger.info(`History API: Successfully updated superJson for session ${sessionId}`);

      logApiRequest('PATCH', `/api/history/${sessionId}/super-json`, 200);

      res.json({
        id: updated.id,
        status: updated.status,
        totalQuestions: updated.superJson.metadata.totalQuestions,
        updatedAt: updated.updatedAt,
      });
    } catch (error) {
      logError('History API: /api/history/:sessionId/super-json PATCH failed', error);
      logApiRequest('PATCH', `/api/history/${req.params.sessionId}/super-json`, 500);
      throw error;
    }
  }),
);

/**
 * DELETE /api/history/:sessionId
 * Delete a session with user ownership check
 * Requirements: 4.4
 */
router.delete(
  '/:sessionId',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, 'Authentication required');
      }
      const userId = user.id;
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ message: 'Missing session id' });
      }

      logger.info(`History API: DELETE /api/history/${sessionId} - User ${user.email} from ${req.ip}`);

      const deleted = deleteSession(userId, sessionId);
      if (!deleted) {
        logger.info(`History API: Session ${sessionId} not found for user ${user.email}`);
        logApiRequest('DELETE', `/api/history/${sessionId}`, 404);
        return res.status(404).json({ message: 'Session not found or not owned by user' });
      }

      logger.info(`History API: Successfully deleted session ${sessionId}`);

      logApiRequest('DELETE', `/api/history/${sessionId}`, 200);

      res.json({ success: true, message: 'Session deleted' });
    } catch (error) {
      logError('History API: /api/history/:sessionId DELETE failed', error);
      logApiRequest('DELETE', `/api/history/${req.params.sessionId}`, 500);
      throw error;
    }
  }),
);

export default router;