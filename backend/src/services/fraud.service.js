import logger from '../utils/logger.js';

const registrationLog = [];
const flaggedAddresses = new Set();
const MAX_LOG = 500;

export function analyzeRegistration({ phone, region, timestamp, walletAddress }) {
  const now = timestamp || Date.now();
  const flags = [];
  let riskLevel = 0;

  // Rule 1: Rapid successive registrations from same phone
  const recentFromPhone = registrationLog.filter(
    (r) => r.phone === phone && now - r.timestamp < 24 * 60 * 60 * 1000
  );
  if (recentFromPhone.length >= 3) {
    flags.push('Multiple registrations in 24h');
    riskLevel += 30;
  }

  // Rule 2: Registration spike for a region (possible insider info about incoming drought)
  const recentForRegion = registrationLog.filter(
    (r) => r.region === region && now - r.timestamp < 48 * 60 * 60 * 1000
  );
  const avgDailyRegistrations = registrationLog.filter(
    (r) => r.region === region
  ).length / Math.max(1, 30);

  if (recentForRegion.length > avgDailyRegistrations * 5 && recentForRegion.length > 5) {
    flags.push('Abnormal registration spike for region');
    riskLevel += 25;
  }

  // Rule 3: Known flagged address
  if (walletAddress && flaggedAddresses.has(walletAddress)) {
    flags.push('Previously flagged address');
    riskLevel += 40;
  }

  // Rule 4: Registration right before known risky season (simple heuristic)
  const month = new Date(now).getMonth();
  const drySeasonMonths = [0, 1, 2, 7, 8, 9]; // Jan-Mar, Aug-Oct (Kenya dry seasons)
  if (drySeasonMonths.includes(month)) {
    flags.push('Registration during high-risk season');
    riskLevel += 10;
  }

  // Rule 5: Phone number patterns (disposable/suspicious)
  if (phone && (phone.startsWith('2540000') || phone.length < 10)) {
    flags.push('Suspicious phone number pattern');
    riskLevel += 20;
  }

  riskLevel = Math.min(100, riskLevel);

  const result = {
    fraudScore: riskLevel,
    level: riskLevel >= 60 ? 'high' : riskLevel >= 30 ? 'medium' : 'low',
    flags,
    action: riskLevel >= 60 ? 'block' : riskLevel >= 30 ? 'review' : 'allow',
    timestamp: new Date(now).toISOString(),
  };

  // Log this registration
  registrationLog.push({ phone, region, timestamp: now, walletAddress });
  if (registrationLog.length > MAX_LOG) registrationLog.shift();

  if (riskLevel >= 30) {
    logger.warn(`Fraud alert [${result.level}]: ${flags.join(', ')}`);
  }

  return result;
}

export function flagAddress(address, reason) {
  flaggedAddresses.add(address);
  logger.info(`Address flagged: ${address} — ${reason}`);
}

export function unflagAddress(address) {
  flaggedAddresses.delete(address);
}

export function getStats() {
  return {
    totalAnalyzed: registrationLog.length,
    flaggedAddresses: flaggedAddresses.size,
    recentFlags: registrationLog
      .filter((r) => r.walletAddress && flaggedAddresses.has(r.walletAddress))
      .length,
  };
}
