import logger from '../utils/logger.js';
import * as blockchainService from './blockchain.service.js';
import * as riskService from './risk.service.js';

let intervalId = null;
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // every 6 hours
const REGIONS = ['Laikipia', 'Nakuru', 'Turkana'];

export function startAutoChecker() {
  if (intervalId) return;

  logger.info(`Auto claim checker started (every ${CHECK_INTERVAL / 3600000}h)`);

  intervalId = setInterval(() => runCheck(), CHECK_INTERVAL);

  // Run first check after 30 seconds
  setTimeout(() => runCheck(), 30000);
}

export function stopAutoChecker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Auto claim checker stopped');
  }
}

async function runCheck() {
  logger.info('Running scheduled claim check...');

  const insurance = blockchainService.getInsuranceContract();
  if (!insurance) {
    logger.warn('Insurance contract not available, skipping check');
    return;
  }

  for (const region of REGIONS) {
    try {
      // Fetch current weather from oracle via contract
      const policy = await insurance.regionalPolicies(region);
      const rainfallThreshold = Number(policy[0]);
      const tempThreshold = Number(policy[1]);
      const ndviThreshold = Number(policy[2]);

      // Record weather data for risk model (simulated — in production, pull from oracle)
      riskService.recordWeatherData(region, {
        rainfall: rainfallThreshold + Math.random() * 40 - 20, // simulated variation
        temperature: tempThreshold + Math.random() * 10 - 5,
        ndvi: ndviThreshold + Math.random() * 2000 - 1000,
      });

      // Calculate current risk
      const risk = riskService.calculateRiskScore(region, {
        rainfallThreshold,
        temperatureThreshold: tempThreshold,
        ndviThreshold,
      });

      if (risk.score >= 70) {
        logger.warn(`⚠️  ${region} risk is ${risk.level} (${risk.score}/100) — claims likely`);
      }
    } catch (err) {
      logger.error(`Check failed for ${region}: ${err.message}`);
    }
  }

  logger.info('Scheduled check complete');
}

export function runManualCheck() {
  return runCheck();
}
