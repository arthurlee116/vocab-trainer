import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { generateSuperJson } from '../services/superGenerator';
import { logger, logError, logApiRequest } from '../utils/logger';

const router = Router();

const payloadSchema = z.object({
  words: z.array(z.string().min(1)).min(1),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  questionCountPerType: z.number().min(3).max(30).optional(),
});

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
