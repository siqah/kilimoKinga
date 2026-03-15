import * as yieldService from '../services/yield.service.js';
import * as fraudService from '../services/fraud.service.js';
import * as pricingService from '../services/pricing.service.js';
import * as forecastService from '../services/forecast.service.js';
import * as cropService from '../services/crop.service.js';
import * as sentimentService from '../services/sentiment.service.js';

// Yield prediction
export function predictYield(req, res) {
  const { region } = req.params;
  const crop = req.query.crop || 'maize';
  res.json({ success: true, ...yieldService.predictYield(region, crop) });
}

export function getSupportedCrops(req, res) {
  res.json({ success: true, crops: yieldService.getSupportedCrops() });
}

// Fraud detection
export function analyzeFraud(req, res) {
  const { phone, region, walletAddress } = req.body;
  const result = fraudService.analyzeRegistration({ phone, region, walletAddress, timestamp: Date.now() });
  res.json({ success: true, ...result });
}

export function flagAddress(req, res) {
  const { address, reason } = req.body;
  fraudService.flagAddress(address, reason || 'Manual flag');
  res.json({ success: true, message: `Address ${address} flagged` });
}

export function fraudStats(req, res) {
  res.json({ success: true, ...fraudService.getStats() });
}

// Dynamic pricing
export function getDynamicPricing(req, res) {
  const { region } = req.params;
  const { seasonsCompleted, previousClaims } = req.query;
  const result = pricingService.calculatePremium(region, {
    seasonsCompleted: Number(seasonsCompleted) || 0,
    previousClaims: Number(previousClaims) || 0,
  });
  res.json({ success: true, ...result });
}

export function getAllPricing(req, res) {
  const { seasonsCompleted, previousClaims } = req.query;
  const results = pricingService.getAllPricing({
    seasonsCompleted: Number(seasonsCompleted) || 0,
    previousClaims: Number(previousClaims) || 0,
  });
  res.json({ success: true, regions: results });
}

// Weather forecasting
export function getForecast(req, res) {
  const { region } = req.params;
  const days = Number(req.query.days) || 7;
  res.json({ success: true, ...forecastService.forecast(region, days) });
}

// Crop classification
export function classifyCrop(req, res) {
  const { region } = req.params;
  const { ndvi, temperature, rainfall } = req.query;
  const result = cropService.classifyCrop(region, {
    ndvi: Number(ndvi) || undefined,
    temperature: Number(temperature) || undefined,
    rainfall: Number(rainfall) || undefined,
  });
  res.json({ success: true, ...result });
}

export function cropRecommendations(req, res) {
  const { region } = req.params;
  res.json({ success: true, ...cropService.getRecommendations(region) });
}

// Sentiment analysis
export function analyzeFeedback(req, res) {
  const { text, phone, region } = req.body;
  if (!text) return res.status(400).json({ success: false, error: { message: 'text is required' } });
  const result = sentimentService.analyzeSentiment(text, { phone, region });
  res.json({ success: true, ...result });
}

export function sentimentInsights(req, res) {
  res.json({ success: true, ...sentimentService.getInsights() });
}

export function recentFeedback(req, res) {
  const limit = Number(req.query.limit) || 20;
  res.json({ success: true, feedback: sentimentService.getRecentFeedback(limit) });
}
