import express from 'express';
import cors from 'cors';
import config from './config/index.js';
import { requestLogger, errorHandler, rateLimit } from './middleware/index.js';
import routes from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(cors({ origin: config.frontendUrl }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use(rateLimit({ windowMs: 60000, max: 60 }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  app.use('/api', routes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `${req.method} ${req.originalUrl} not found` },
    });
  });

  app.use(errorHandler);

  return app;
}
