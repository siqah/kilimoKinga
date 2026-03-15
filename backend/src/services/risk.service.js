import logger from '../utils/logger.js';

// Historical data store (production: replace with a real database)
const weatherHistory = new Map();
const MAX_HISTORY = 30; // keep last 30 data points per region

export function recordWeatherData(region, { rainfall, temperature, ndvi }) {
  if (!weatherHistory.has(region)) {
    weatherHistory.set(region, []);
  }

  const history = weatherHistory.get(region);
  history.push({
    rainfall,
    temperature,
    ndvi,
    timestamp: Date.now(),
  });

  if (history.length > MAX_HISTORY) {
    history.shift();
  }
}

export function calculateRiskScore(region, policy) {
  const history = weatherHistory.get(region) || [];

  if (history.length < 3) {
    return {
      score: 50,
      level: 'unknown',
      confidence: 'low',
      factors: { message: 'Not enough historical data yet' },
    };
  }

  const recent = history.slice(-10);

  // Factor 1: Drought risk (0-100)
  const avgRainfall = recent.reduce((s, d) => s + d.rainfall, 0) / recent.length;
  const rainfallRatio = avgRainfall / (policy.rainfallThreshold || 50);
  const droughtRisk = Math.max(0, Math.min(100, (1 - rainfallRatio) * 100 + 20));

  // Factor 2: Heat risk (0-100)
  const avgTemp = recent.reduce((s, d) => s + d.temperature, 0) / recent.length;
  const tempRatio = avgTemp / (policy.temperatureThreshold || 35);
  const heatRisk = Math.max(0, Math.min(100, (tempRatio - 0.7) * 150));

  // Factor 3: Vegetation health (0-100)
  const avgNdvi = recent.reduce((s, d) => s + (d.ndvi || 5000), 0) / recent.length;
  const ndviRatio = avgNdvi / (policy.ndviThreshold || 5000);
  const vegetationRisk = Math.max(0, Math.min(100, (1 - ndviRatio) * 100 + 10));

  // Factor 4: Trend analysis — is it getting worse?
  const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
  const secondHalf = recent.slice(Math.floor(recent.length / 2));
  const trendRainfall = avg(secondHalf, 'rainfall') - avg(firstHalf, 'rainfall');
  const trendTemp = avg(secondHalf, 'temperature') - avg(firstHalf, 'temperature');
  const trendScore = Math.max(0, Math.min(100,
    50 + (trendTemp * 3) - (trendRainfall * 2)
  ));

  // Factor 5: Volatility — erratic weather = higher risk
  const rainfallStdDev = stdDev(recent.map(d => d.rainfall));
  const volatilityRisk = Math.min(100, rainfallStdDev * 3);

  // Weighted composite score
  const weights = {
    drought: 0.30,
    heat: 0.20,
    vegetation: 0.25,
    trend: 0.15,
    volatility: 0.10,
  };

  const compositeScore = Math.round(
    droughtRisk * weights.drought +
    heatRisk * weights.heat +
    vegetationRisk * weights.vegetation +
    trendScore * weights.trend +
    volatilityRisk * weights.volatility
  );

  const level = compositeScore >= 75 ? 'critical'
    : compositeScore >= 55 ? 'high'
    : compositeScore >= 35 ? 'moderate'
    : 'low';

  const premiumMultiplier = compositeScore >= 75 ? 1.5
    : compositeScore >= 55 ? 1.2
    : compositeScore >= 35 ? 1.0
    : 0.9;

  logger.info(`Risk score for ${region}: ${compositeScore}/100 (${level})`);

  return {
    score: compositeScore,
    level,
    confidence: history.length >= 15 ? 'high' : history.length >= 7 ? 'medium' : 'low',
    premiumMultiplier,
    factors: {
      drought: Math.round(droughtRisk),
      heat: Math.round(heatRisk),
      vegetation: Math.round(vegetationRisk),
      trend: Math.round(trendScore),
      volatility: Math.round(volatilityRisk),
    },
    dataPoints: history.length,
    lastUpdated: new Date(history[history.length - 1].timestamp).toISOString(),
  };
}

export function getWeatherHistory(region) {
  return weatherHistory.get(region) || [];
}

export function getAllRegionRisks(policies) {
  const results = {};
  for (const [region, policy] of Object.entries(policies)) {
    results[region] = calculateRiskScore(region, policy);
  }
  return results;
}

// Helpers
function avg(arr, key) {
  if (arr.length === 0) return 0;
  return arr.reduce((s, d) => s + (d[key] || 0), 0) / arr.length;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}
