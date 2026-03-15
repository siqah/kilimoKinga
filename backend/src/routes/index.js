import { Router } from 'express';
import { validateBody } from '../middleware/index.js';
import * as mpesaCtrl from '../controllers/mpesa.controller.js';
import * as riskCtrl from '../controllers/risk.controller.js';

const router = Router();

// M-Pesa / Paystack
router.post('/mpesa/initialize', validateBody('phone', 'region'), mpesaCtrl.initializePayment);
router.get('/mpesa/status/:reference', mpesaCtrl.getStatus);
router.post('/mpesa/payout', validateBody('phone', 'amount_kes'), mpesaCtrl.sendPayout);
router.post('/paystack/webhook', mpesaCtrl.handleWebhook);

// Risk scoring & AI
router.get('/risk/:region', riskCtrl.getRiskScore);
router.get('/risk', riskCtrl.getAllRisks);
router.get('/weather/:region', riskCtrl.getWeatherHistory);
router.post('/weather', validateBody('region', 'rainfall', 'temperature'), riskCtrl.recordWeather);
router.post('/check', riskCtrl.triggerCheck);

// Utility
router.get('/rates', mpesaCtrl.getRates);
router.get('/health', mpesaCtrl.healthCheck);

export default router;
