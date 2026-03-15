import { Router } from 'express';
import { validateBody } from '../middleware/index.js';
import * as mpesaCtrl from '../controllers/mpesa.controller.js';
import * as riskCtrl from '../controllers/risk.controller.js';
import * as aiCtrl from '../controllers/ai.controller.js';

const router = Router();

// M-Pesa / Paystack
router.post('/mpesa/initialize', validateBody('phone', 'region'), mpesaCtrl.initializePayment);
router.get('/mpesa/status/:reference', mpesaCtrl.getStatus);
router.post('/mpesa/payout', validateBody('phone', 'amount_kes'), mpesaCtrl.sendPayout);
router.post('/paystack/webhook', mpesaCtrl.handleWebhook);

// Risk scoring
router.get('/risk/:region', riskCtrl.getRiskScore);
router.get('/risk', riskCtrl.getAllRisks);
router.get('/weather/:region', riskCtrl.getWeatherHistory);
router.post('/weather', validateBody('region', 'rainfall', 'temperature'), riskCtrl.recordWeather);
router.post('/check', riskCtrl.triggerCheck);

// Yield prediction
router.get('/yield/:region', aiCtrl.predictYield);
router.get('/crops', aiCtrl.getSupportedCrops);

// Fraud detection
router.post('/fraud/analyze', validateBody('phone', 'region'), aiCtrl.analyzeFraud);
router.post('/fraud/flag', validateBody('address'), aiCtrl.flagAddress);
router.get('/fraud/stats', aiCtrl.fraudStats);

// Dynamic pricing
router.get('/pricing/:region', aiCtrl.getDynamicPricing);
router.get('/pricing', aiCtrl.getAllPricing);

// Weather forecasting
router.get('/forecast/:region', aiCtrl.getForecast);

// Crop classification
router.get('/classify/:region', aiCtrl.classifyCrop);
router.get('/recommend/:region', aiCtrl.cropRecommendations);

// Sentiment analysis
router.post('/feedback', validateBody('text'), aiCtrl.analyzeFeedback);
router.get('/feedback/insights', aiCtrl.sentimentInsights);
router.get('/feedback/recent', aiCtrl.recentFeedback);

// Utility
router.get('/rates', mpesaCtrl.getRates);
router.get('/health', mpesaCtrl.healthCheck);

export default router;
