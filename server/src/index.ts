import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';
import vlmRoutes from './routes/vlm';
import generationRoutes from './routes/generation';
import analysisRoutes from './routes/analysis';
import historyRoutes from './routes/history';
import { HttpError } from './utils/httpError';

const app = express();

app.use(
  cors({
    origin: env.clientOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: '20mb' }));
app.use(authMiddleware);

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.use('/api/auth', authRoutes);
app.use('/api/vlm', vlmRoutes);
app.use('/api/generation', generationRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/history', historyRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  if (err instanceof Error) {
    return res.status(500).json({ message: err.message });
  }

  res.status(500).json({ message: 'Unknown error' });
});

const port = env.port;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
