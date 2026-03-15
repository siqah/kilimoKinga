import * as riskService from '../services/risk.service.js';
import * as autoChecker from '../services/autochecker.service.js';

export function getRiskScore(req, res, next) {
  try {
    const { region } = req.params;
    const policy = req.query;

    const risk = riskService.calculateRiskScore(region, {
      rainfallThreshold: Number(policy.rainfall) || 50,
      temperatureThreshold: Number(policy.temperature) || 35,
      ndviThreshold: Number(policy.ndvi) || 5000,
    });

    res.json({ success: true, region, ...risk });
  } catch (err) {
    next(err);
  }
}

export function getWeatherHistory(req, res) {
  const { region } = req.params;
  const history = riskService.getWeatherHistory(region);
  res.json({ success: true, region, dataPoints: history.length, history });
}

export function recordWeather(req, res) {
  const { region, rainfall, temperature, ndvi } = req.body;

  riskService.recordWeatherData(region, {
    rainfall: Number(rainfall),
    temperature: Number(temperature),
    ndvi: Number(ndvi || 5000),
  });

  res.json({ success: true, message: `Weather recorded for ${region}` });
}

export function triggerCheck(req, res) {
  autoChecker.runManualCheck();
  res.json({ success: true, message: 'Manual claim check triggered' });
}

export function getAllRisks(req, res) {
  const policies = {
    Laikipia: { rainfallThreshold: 50, temperatureThreshold: 35, ndviThreshold: 5000 },
    Nakuru: { rainfallThreshold: 45, temperatureThreshold: 37, ndviThreshold: 4500 },
    Turkana: { rainfallThreshold: 30, temperatureThreshold: 40, ndviThreshold: 3500 },
  };

  const risks = riskService.getAllRegionRisks(policies);
  res.json({ success: true, regions: risks });
}
