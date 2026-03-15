import config from '../config/index.js';
import { sanitizePhone, isValidKenyanPhone } from '../utils/phone.js';
import { AppError } from '../utils/resilience.js';
import * as registrationService from '../services/registration.service.js';
import * as paystackService from '../services/paystack.service.js';

export async function initializePayment(req, res, next) {
  try {
    const { phone, region, email } = req.body;
    const cleanPhone = sanitizePhone(phone);

    if (!isValidKenyanPhone(cleanPhone)) {
      throw new AppError('Invalid Kenyan phone number. Use format 07XX XXX XXX', 400, 'INVALID_PHONE');
    }

    const result = await registrationService.initializePayment({
      phone: cleanPhone,
      region,
      email,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-paystack-signature'];
    if (signature && !paystackService.verifyWebhookSignature(req.body, signature)) {
      throw new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE');
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      await registrationService.handlePaymentConfirmed(data.reference);
    }

    res.sendStatus(200);
  } catch (err) {
    next(err);
  }
}

export async function getStatus(req, res, next) {
  try {
    const { reference } = req.params;
    const status = await registrationService.getStatus(reference);

    if (!status) {
      throw new AppError('Reference not found', 404, 'NOT_FOUND');
    }

    res.json({ success: true, ...status });
  } catch (err) {
    next(err);
  }
}

export async function sendPayout(req, res, next) {
  try {
    const { phone, amount_kes, reason } = req.body;
    const cleanPhone = sanitizePhone(phone);

    if (!isValidKenyanPhone(cleanPhone)) {
      throw new AppError('Invalid phone number', 400, 'INVALID_PHONE');
    }

    const result = await registrationService.sendPayout({
      phone: cleanPhone,
      amountKES: Number(amount_kes),
      reason,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

export function getRates(req, res) {
  res.json({
    success: true,
    KES_PER_ETH: config.kesPerEth,
    updated: new Date().toISOString(),
  });
}

export function healthCheck(req, res) {
  res.json({
    success: true,
    status: 'healthy',
    version: '2.0.0',
    uptime: Math.floor(process.uptime()),
    env: config.nodeEnv,
    services: {
      paystack: !!config.paystack.secretKey,
      blockchain: !!config.blockchain.contracts.farmerInsurance,
      bridge: !!config.blockchain.contracts.mpesaBridge,
    },
  });
}
