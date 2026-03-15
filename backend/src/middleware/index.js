import logger from '../utils/logger.js';

export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    logger[level](`${method} ${originalUrl} → ${status} (${duration}ms)`);
  });

  next();
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  logger.error(`[${code}] ${err.message}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: { code, message: err.message },
  });
}

export function validateBody(...fields) {
  return (req, res, next) => {
    const missing = fields.filter((f) => !req.body[f]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `Missing required fields: ${missing.join(', ')}` },
      });
    }
    next();
  };
}

const rateLimitStore = new Map();

export function rateLimit({ windowMs = 60000, max = 30 } = {}) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const entry = rateLimitStore.get(key);
    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + windowMs;
      return next();
    }

    entry.count++;
    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' },
      });
    }

    next();
  };
}
