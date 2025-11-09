import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { extractWordsFromImage } from '../services/vlm';
import { logger, logError, logApiRequest } from '../utils/logger';
import { env } from '../config/env';

const router = Router();

const payloadSchema = z.object({
  images: z.array(z.string().min(10)).min(1).max(env.maxVlmImages),
});

router.post(
  '/extract',
  asyncHandler(async (req, res) => {
    try {
      const { images } = payloadSchema.parse(req.body);

      logger.info(`VLM API: POST /api/vlm/extract - Processing ${images.length} image(s) from ${req.ip}`);

      const words = await extractWordsFromImage(images);

      logger.info(`VLM API: Successfully extracted ${words.length} words`);

      logApiRequest('POST', '/api/vlm/extract', 200);

      res.json({ words });
    } catch (error) {
      logError('VLM API: /api/vlm/extract failed', error);
      logApiRequest('POST', '/api/vlm/extract', 500);
      throw error;
    }
  }),
);

export default router;
