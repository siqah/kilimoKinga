import config, { validateConfig } from './src/config/index.js';
import { createApp } from './src/app.js';
import * as blockchainService from './src/services/blockchain.service.js';
import { startClaimListener } from './src/listeners/claim.listener.js';
import { startAutoChecker } from './src/services/autochecker.service.js';
import logger from './src/utils/logger.js';

async function start() {
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('  🌾  KilimoKinga Backend v2.0');
  logger.info('═══════════════════════════════════════════════════════════');

  validateConfig();
  blockchainService.init();

  const app = createApp();

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Paystack: ${config.paystack.secretKey ? '✅' : '❌'}`);
  });

  startClaimListener();
  startAutoChecker();

  const shutdown = (signal) => {
    logger.info(`${signal} received — shutting down...`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (err) => logger.error('Unhandled rejection:', err));
  process.on('uncaughtException', (err) => { logger.error('Uncaught exception:', err); process.exit(1); });
}

start().catch((err) => { logger.error('Failed to start:', err); process.exit(1); });
