import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { ENV } from './config/env';
import { connectDB } from './config/database';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { startScheduler } from './utils/scheduler';

import './models';

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cors({ origin: '*' }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api', routes);

app.get('/', (_req, res) => {
  res.json({
    status: 'OK',
    message: 'B&A Challenge API is running',
    docs: '/api',
    health: '/health',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    message: 'B&A Challenge API работает ✅',
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
let initPromise: Promise<void> | null = null;

const initRuntime = async () => {
  if (!initPromise) {
    initPromise = (async () => {
      await connectDB();

      // Scheduler should run only in long-lived server mode.
      if (!isVercel) {
        startScheduler();
      }
    })();
  }

  return initPromise;
};

const startServer = async () => {
  try {
    await initRuntime();

    app.listen(ENV.PORT, () => {
      console.log(`Server started on port ${ENV.PORT}`);
      console.log(`API: http://localhost:${ENV.PORT}/api`);
      console.log(`Health: http://localhost:${ENV.PORT}/health`);
      console.log(`Static: http://localhost:${ENV.PORT}/uploads`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

if (isVercel) {
  void initRuntime().catch((error) => {
    console.error('Vercel runtime init error:', error);
  });
} else {
  void startServer();
}

export default app;
