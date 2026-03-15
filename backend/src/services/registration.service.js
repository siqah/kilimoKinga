import logger from '../utils/logger.js';
import { maskPhone } from '../utils/phone.js';
import * as paystackService from '../services/paystack.service.js';
import * as blockchainService from '../services/blockchain.service.js';

const pending = new Map();

// Auto-cleanup stale entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [ref, entry] of pending) {
    if (entry.createdAt < cutoff) pending.delete(ref);
  }
}, 10 * 60 * 1000);

export function getPending(ref) { return pending.get(ref); }
export function getAllPending() { return pending; }

export async function initializePayment({ phone, region, email }) {
  const { premiumWei, premiumETH, premiumKES } = await blockchainService.getRegionalPremium(region);
  const reference = `KILIMO-${Date.now()}-${phone.slice(-4)}`;

  pending.set(reference, {
    phone,
    region,
    premiumKES,
    premiumWei: premiumWei.toString(),
    status: 'pending',
    createdAt: Date.now(),
  });

  const callbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success`;
  const paystack = await paystackService.initializePayment({
    phone,
    email,
    amountKES: premiumKES,
    reference,
    region,
    callbackUrl,
  });

  if (!paystack.status) {
    pending.delete(reference);
    throw new Error(paystack.message || 'Payment initialization failed');
  }

  logger.info(`Payment initialized: ${maskPhone(phone)} → ${region} | KES ${premiumKES} | Ref: ${reference}`);

  return {
    authorization_url: paystack.data.authorization_url,
    access_code: paystack.data.access_code,
    reference,
    premium_kes: premiumKES,
    premium_eth: premiumETH.toFixed(6),
  };
}

export async function handlePaymentConfirmed(reference) {
  const entry = pending.get(reference);
  if (!entry) {
    logger.warn(`No pending registration for ref: ${reference}`);
    return null;
  }

  logger.info(`Payment confirmed: ${maskPhone(entry.phone)} → ${entry.region}`);

  try {
    const phoneHash = blockchainService.hashPhone(entry.phone);
    const result = await blockchainService.registerMpesaFarmer({
      phoneHash,
      region: entry.region,
      premiumKES: entry.premiumKES,
      premiumWei: entry.premiumWei,
    });

    entry.walletAddress = result.walletAddress;
    entry.txHash = result.txHash;
    entry.status = 'registered';
    pending.set(reference, entry);

    logger.info(`Farmer registered: ${maskPhone(entry.phone)} → Wallet ${result.walletAddress}`);
    return entry;
  } catch (err) {
    entry.status = 'registration_failed';
    entry.error = err.message;
    pending.set(reference, entry);
    logger.error(`On-chain registration failed: ${err.message}`);
    return entry;
  }
}

export async function getStatus(reference) {
  const entry = pending.get(reference);
  if (!entry) return null;

  let paystackStatus = null;
  try {
    const paystack = await paystackService.verifyTransaction(reference);
    paystackStatus = paystack.data?.status;
  } catch (e) {}

  return {
    status: entry.status,
    paystack_status: paystackStatus,
    phone: maskPhone(entry.phone),
    region: entry.region,
    premium_kes: entry.premiumKES,
    wallet: entry.walletAddress || null,
    txHash: entry.txHash || null,
  };
}

export async function sendPayout({ phone, amountKES, reason }) {
  const recipient = await paystackService.createRecipient({ phone });
  if (!recipient.status) {
    throw new Error('Failed to create recipient: ' + recipient.message);
  }

  const transfer = await paystackService.sendPayout({
    recipientCode: recipient.data.recipient_code,
    amountKES,
    reason,
  });

  if (!transfer.status) {
    throw new Error('Transfer failed: ' + transfer.message);
  }

  logger.info(`Payout sent: KES ${amountKES} → ${maskPhone(phone)}`);

  return {
    transfer_code: transfer.data.transfer_code,
    amount_kes: amountKES,
    phone: maskPhone(phone),
  };
}
