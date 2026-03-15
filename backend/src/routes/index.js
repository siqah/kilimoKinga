import { Router } from 'express';
import { validateBody } from '../middleware/index.js';
import * as mpesaCtrl from '../controllers/mpesa.controller.js';

const router = Router();

router.post('/mpesa/initialize', validateBody('phone', 'region'), mpesaCtrl.initializePayment);
router.get('/mpesa/status/:reference', mpesaCtrl.getStatus);
router.post('/mpesa/payout', validateBody('phone', 'amount_kes'), mpesaCtrl.sendPayout);
router.post('/paystack/webhook', mpesaCtrl.handleWebhook);
router.get('/rates', mpesaCtrl.getRates);
router.get('/health', mpesaCtrl.healthCheck);

export default router;
