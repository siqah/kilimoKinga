import logger from '../utils/logger.js';

export async function withRetry(fn, { maxAttempts = 3, baseDelay = 1000, label = 'operation' } = {}) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts) {
        logger.error(`${label} failed after ${maxAttempts} attempts:`, err.message);
        throw err;
      }
      const delay = baseDelay * Math.pow(2, attempt - 1);
      logger.warn(`${label} attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}
