import logger from '../utils/logger.js';
import { getWeatherHistory } from './risk.service.js';

const cropDatabase = {
  maize: { optimalRainfall: [60, 120], optimalTemp: [20, 30], growthDays: 120, baseYield: 3000 },
  wheat: { optimalRainfall: [45, 90], optimalTemp: [15, 25], growthDays: 100, baseYield: 2500 },
  beans: { optimalRainfall: [50, 100], optimalTemp: [18, 28], growthDays: 80, baseYield: 1800 },
  sorghum: { optimalRainfall: [30, 80], optimalTemp: [25, 35], growthDays: 110, baseYield: 2200 },
  millet: { optimalRainfall: [25, 60], optimalTemp: [25, 35], growthDays: 90, baseYield: 1500 },
};

const defaultCrop = cropDatabase.maize;

export function predictYield(region, cropType = 'maize') {
  const history = getWeatherHistory(region);
  const crop = cropDatabase[cropType] || defaultCrop;

  if (history.length < 3) {
    return {
      region,
      crop: cropType,
      predictedYield: crop.baseYield,
      confidence: 'low',
      factors: { message: 'Insufficient data — using baseline yield' },
    };
  }

  const recent = history.slice(-10);

  // Rainfall fitness: how close to optimal range?
  const avgRain = recent.reduce((s, d) => s + d.rainfall, 0) / recent.length;
  const rainfallFitness = calculateFitness(avgRain, crop.optimalRainfall[0], crop.optimalRainfall[1]);

  // Temperature fitness
  const avgTemp = recent.reduce((s, d) => s + d.temperature, 0) / recent.length;
  const tempFitness = calculateFitness(avgTemp, crop.optimalTemp[0], crop.optimalTemp[1]);

  // NDVI — direct indicator of vegetative health
  const avgNdvi = recent.reduce((s, d) => s + (d.ndvi || 5000), 0) / recent.length;
  const ndviFitness = Math.min(1, avgNdvi / 7000);

  // Consistency bonus — stable weather = better yield
  const rainfallVariation = coefficientOfVariation(recent.map(d => d.rainfall));
  const consistencyBonus = Math.max(0, 1 - rainfallVariation);

  // Composite yield multiplier
  const yieldMultiplier =
    rainfallFitness * 0.35 +
    tempFitness * 0.25 +
    ndviFitness * 0.25 +
    consistencyBonus * 0.15;

  const predictedYield = Math.round(crop.baseYield * yieldMultiplier);
  const yieldPercent = Math.round(yieldMultiplier * 100);

  // Loss estimation for insurance
  const expectedLoss = crop.baseYield - predictedYield;
  const lossPercent = Math.round((expectedLoss / crop.baseYield) * 100);

  logger.info(`Yield prediction: ${region}/${cropType} → ${predictedYield} kg/ha (${yieldPercent}% of baseline)`);

  return {
    region,
    crop: cropType,
    baselineYield: crop.baseYield,
    predictedYield,
    yieldPercent,
    expectedLoss: Math.max(0, expectedLoss),
    lossPercent: Math.max(0, lossPercent),
    confidence: history.length >= 15 ? 'high' : history.length >= 7 ? 'medium' : 'low',
    shouldTriggerPayout: lossPercent >= 30,
    suggestedPayoutPercent: lossPercent >= 50 ? 100 : lossPercent >= 30 ? 50 : 0,
    factors: {
      rainfall: Math.round(rainfallFitness * 100),
      temperature: Math.round(tempFitness * 100),
      vegetation: Math.round(ndviFitness * 100),
      consistency: Math.round(consistencyBonus * 100),
    },
  };
}

export function getSupportedCrops() {
  return Object.entries(cropDatabase).map(([name, data]) => ({
    name,
    growthDays: data.growthDays,
    baseYield: data.baseYield,
    optimalRainfall: data.optimalRainfall,
    optimalTemp: data.optimalTemp,
  }));
}

function calculateFitness(value, min, max) {
  if (value >= min && value <= max) return 1;
  if (value < min) return Math.max(0, 1 - (min - value) / min);
  return Math.max(0, 1 - (value - max) / max);
}

function coefficientOfVariation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}
