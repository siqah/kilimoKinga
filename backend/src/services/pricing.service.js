import logger from '../utils/logger.js';
import { calculateRiskScore } from './risk.service.js';

const claimHistory = new Map(); // region → [{ season, claimRate, avgPayout }]
const BASE_PREMIUMS = {
  Laikipia: 0.01,
  Nakuru: 0.015,
  Turkana: 0.008,
};

export function calculatePremium(region, { seasonsCompleted = 0, previousClaims = 0 } = {}) {
  const basePremium = BASE_PREMIUMS[region] || 0.01;

  // Factor 1: Regional risk score
  const risk = calculateRiskScore(region, {
    rainfallThreshold: 50,
    temperatureThreshold: 35,
    ndviThreshold: 5000,
  });
  const riskMultiplier = risk.premiumMultiplier || 1.0;

  // Factor 2: Historical claim rate for region
  const history = claimHistory.get(region) || [];
  let claimRateMultiplier = 1.0;
  if (history.length > 0) {
    const avgClaimRate = history.reduce((s, h) => s + h.claimRate, 0) / history.length;
    claimRateMultiplier = 1 + (avgClaimRate - 0.3) * 0.5; // normalize around 30% expected claim rate
    claimRateMultiplier = Math.max(0.8, Math.min(1.5, claimRateMultiplier));
  }

  // Factor 3: Individual risk (repeat claimers pay more)
  let individualMultiplier = 1.0;
  if (previousClaims > 0 && seasonsCompleted > 0) {
    const personalClaimRate = previousClaims / seasonsCompleted;
    if (personalClaimRate > 0.5) individualMultiplier = 1.2;
    else if (personalClaimRate > 0.3) individualMultiplier = 1.1;
  }

  // Factor 4: Loyalty discount (mirrors smart contract logic)
  let loyaltyMultiplier = 1.0;
  if (seasonsCompleted >= 3) {
    const discountPercent = Math.min(25, (seasonsCompleted - 2) * 5);
    loyaltyMultiplier = 1 - discountPercent / 100;
  }

  // Factor 5: Seasonal adjustment (dry season = higher premium)
  const month = new Date().getMonth();
  const drySeasonMonths = [0, 1, 2, 7, 8, 9];
  const seasonalMultiplier = drySeasonMonths.includes(month) ? 1.15 : 1.0;

  const finalPremium = basePremium
    * riskMultiplier
    * claimRateMultiplier
    * individualMultiplier
    * loyaltyMultiplier
    * seasonalMultiplier;

  const result = {
    region,
    basePremium,
    finalPremium: Number(finalPremium.toFixed(6)),
    multipliers: {
      risk: Number(riskMultiplier.toFixed(2)),
      claimHistory: Number(claimRateMultiplier.toFixed(2)),
      individual: Number(individualMultiplier.toFixed(2)),
      loyalty: Number(loyaltyMultiplier.toFixed(2)),
      seasonal: Number(seasonalMultiplier.toFixed(2)),
    },
    changePercent: Math.round(((finalPremium / basePremium) - 1) * 100),
    riskLevel: risk.level,
  };

  logger.info(`Dynamic premium: ${region} → ${result.finalPremium} ETH (${result.changePercent > 0 ? '+' : ''}${result.changePercent}%)`);
  return result;
}

export function recordSeasonClaims(region, { totalFarmers, totalClaims, avgPayoutETH }) {
  if (!claimHistory.has(region)) claimHistory.set(region, []);

  const history = claimHistory.get(region);
  history.push({
    season: history.length + 1,
    claimRate: totalFarmers > 0 ? totalClaims / totalFarmers : 0,
    avgPayout: avgPayoutETH,
    timestamp: Date.now(),
  });

  if (history.length > 20) history.shift();
}

export function getPricingHistory(region) {
  return claimHistory.get(region) || [];
}

export function getAllPricing(farmerProfile = {}) {
  const results = {};
  for (const region of Object.keys(BASE_PREMIUMS)) {
    results[region] = calculatePremium(region, farmerProfile);
  }
  return results;
}
