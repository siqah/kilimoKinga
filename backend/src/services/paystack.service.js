import crypto from 'crypto';
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { withRetry, AppError } from '../utils/resilience.js';

const { secretKey, baseUrl } = config.paystack;

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  return withRetry(
    async () => {
      const res = await fetch(`${baseUrl}${path}`, opts);
      const data = await res.json();
      if (!res.ok && !data.status) {
        throw new AppError(data.message || `Paystack ${method} ${path} failed`, res.status, 'PAYSTACK_ERROR');
      }
      return data;
    },
    { maxAttempts: 2, baseDelay: 500, label: `Paystack ${method} ${path}` }
  );
}

export async function initializePayment({ phone, email, amountKES, reference, region, callbackUrl }) {
  logger.info(`Initializing payment: KES ${amountKES} from ${phone.slice(-4)} for ${region}`);

  return request('POST', '/transaction/initialize', {
    email: email || `${phone}@kilimokinga.farmer`,
    amount: amountKES * 100,
    currency: 'KES',
    reference,
    callback_url: callbackUrl,
    channels: ['mobile_money'],
    mobile_money: { phone, provider: 'mpesa' },
    metadata: {
      phone,
      region,
      premium_kes: amountKES,
      custom_fields: [
        { display_name: 'Phone', variable_name: 'phone', value: phone },
        { display_name: 'Region', variable_name: 'region', value: region },
      ],
    },
  });
}

export async function verifyTransaction(reference) {
  return request('GET', `/transaction/verify/${reference}`);
}

export async function createRecipient({ phone, name }) {
  return request('POST', '/transferrecipient', {
    type: 'mobile_money',
    name: name || `Farmer ${phone.slice(-4)}`,
    account_number: phone,
    bank_code: 'MPESA',
    currency: 'KES',
  });
}

export async function sendPayout({ recipientCode, amountKES, reason }) {
  logger.info(`Sending payout: KES ${amountKES} to recipient ${recipientCode}`);

  return request('POST', '/transfer', {
    source: 'balance',
    amount: amountKES * 100,
    recipient: recipientCode,
    reason: reason || 'KilimoKinga Insurance Claim Payout',
    currency: 'KES',
  });
}

export function verifyWebhookSignature(body, signature) {
  if (!signature) return false;
  const hash = crypto
    .createHmac('sha512', secretKey)
    .update(JSON.stringify(body))
    .digest('hex');
  return hash === signature;
}
