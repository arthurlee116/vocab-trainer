import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { buildAnalysis } from '../services/analysis';
import { logger, logError, logApiRequest } from '../utils/logger';

const router = Router();

const answerSchema = z.object({
  questionId: z.string(),
  choiceId: z.string(),
  correct: z.boolean(),
  elapsedMs: z.number(),
});

const payloadSchema = z.object({
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  words: z.array(z.string()),
  answers: z.array(answerSchema),
  superJson: z.any(), // already validated when created
  score: z.number().min(0).max(100),
});

router.post(
  '/report',
  asyncHandler(async (req, res) => {
    try {
      const payload = payloadSchema.parse(req.body);

      logger.info(`Analysis API: POST /api/analysis/report - Analyzing ${payload.answers.length} answers (score: ${payload.score}%, difficulty: ${payload.difficulty}) from ${req.ip}`);

      const summary = await buildAnalysis(payload);

      logger.info(`Analysis API: Successfully generated analysis report`);

      logApiRequest('POST', '/api/analysis/report', 200);

      res.json(summary);
    } catch (error) {
      logError('Analysis API: /api/analysis/report failed', error);
      logApiRequest('POST', '/api/analysis/report', 500);
      throw error;
    }
  }),
);

export default router;
