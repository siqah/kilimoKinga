import logger from '../utils/logger.js';
import { getWeatherHistory } from './risk.service.js';

export function forecast(region, daysAhead = 7) {
  const history = getWeatherHistory(region);

  if (history.length < 5) {
    return {
      region,
      daysAhead,
      confidence: 'low',
      forecast: generateFallbackForecast(daysAhead),
      method: 'baseline',
    };
  }

  const recent = history.slice(-10);

  // Calculate trend using linear regression
  const rainfallTrend = linearTrend(recent.map(d => d.rainfall));
  const tempTrend = linearTrend(recent.map(d => d.temperature));
  const ndviTrend = linearTrend(recent.map(d => d.ndvi || 5000));

  // Calculate moving averages for base values
  const avgRainfall = recent.reduce((s, d) => s + d.rainfall, 0) / recent.length;
  const avgTemp = recent.reduce((s, d) => s + d.temperature, 0) / recent.length;
  const avgNdvi = recent.reduce((s, d) => s + (d.ndvi || 5000), 0) / recent.length;

  // Volatility for confidence calculation
  const rainfallVol = volatility(recent.map(d => d.rainfall));

  // Generate daily forecasts
  const days = [];
  for (let i = 1; i <= daysAhead; i++) {
    const noise = (Math.random() - 0.5) * rainfallVol * 0.5;

    const predictedRainfall = Math.max(0, avgRainfall + rainfallTrend.slope * i + noise);
    const predictedTemp = avgTemp + tempTrend.slope * i + (Math.random() - 0.5) * 2;
    const predictedNdvi = Math.max(0, Math.min(10000, avgNdvi + ndviTrend.slope * i));

    days.push({
      day: i,
      rainfall: Math.round(predictedRainfall * 10) / 10,
      temperature: Math.round(predictedTemp * 10) / 10,
      ndvi: Math.round(predictedNdvi),
      condition: categorizeCondition(predictedRainfall, predictedTemp),
    });
  }

  // Alerts based on forecast
  const alerts = [];
  const avgForecastRain = days.reduce((s, d) => s + d.rainfall, 0) / days.length;
  const avgForecastTemp = days.reduce((s, d) => s + d.temperature, 0) / days.length;

  if (avgForecastRain < 30) alerts.push({ type: 'drought', message: `Drought risk: avg rainfall ${avgForecastRain.toFixed(0)}mm predicted` });
  if (avgForecastTemp > 37) alerts.push({ type: 'heat', message: `Heat risk: avg temp ${avgForecastTemp.toFixed(1)}°C predicted` });
  if (rainfallTrend.slope < -3) alerts.push({ type: 'declining', message: 'Rainfall declining rapidly' });

  const confidence = history.length >= 15 ? 'high' : history.length >= 7 ? 'medium' : 'low';

  logger.info(`Forecast ${region}: ${daysAhead}d | Rain trend: ${rainfallTrend.slope.toFixed(1)}/day | ${alerts.length} alerts`);

  return {
    region,
    daysAhead,
    confidence,
    method: 'linear_regression',
    trends: {
      rainfall: { direction: rainfallTrend.slope > 0 ? 'increasing' : 'decreasing', rate: Math.round(rainfallTrend.slope * 10) / 10 },
      temperature: { direction: tempTrend.slope > 0 ? 'warming' : 'cooling', rate: Math.round(tempTrend.slope * 10) / 10 },
      ndvi: { direction: ndviTrend.slope > 0 ? 'improving' : 'declining', rate: Math.round(ndviTrend.slope) },
    },
    forecast: days,
    alerts,
    summary: buildSummary(avgForecastRain, avgForecastTemp, alerts),
  };
}

function linearTrend(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope: isNaN(slope) ? 0 : slope, intercept };
}

function volatility(values) {
  if (values.length < 2) return 10;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function categorizeCondition(rainfall, temp) {
  if (rainfall > 80 && temp < 30) return 'rainy';
  if (rainfall > 50) return 'wet';
  if (rainfall < 20 && temp > 35) return 'hot_dry';
  if (rainfall < 30) return 'dry';
  return 'normal';
}

function buildSummary(avgRain, avgTemp, alerts) {
  if (alerts.length === 0) return 'Normal conditions expected';
  return alerts.map(a => a.message).join('. ');
}

function generateFallbackForecast(days) {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    rainfall: 50 + (Math.random() - 0.5) * 30,
    temperature: 28 + (Math.random() - 0.5) * 6,
    ndvi: 5000,
    condition: 'normal',
  }));
}
