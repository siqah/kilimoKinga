import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { ethers } from 'ethers';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// ══════════════════════════════════════════════════════════════════
//  Config
// ══════════════════════════════════════════════════════════════════
const {
  PAYSTACK_SECRET_KEY,
  RPC_URL,
  RELAY_PRIVATE_KEY,
  FARMER_INSURANCE_ADDRESS,
  MPESA_BRIDGE_ADDRESS,
  PORT = 3001,
  KES_PER_ETH = 500000,
} = process.env;

const PAYSTACK_BASE = 'https://api.paystack.co';

// ── Blockchain setup ─────────────────────────────────────────────
let provider, relay, insuranceContract, bridgeContract;

const INSURANCE_ABI = [
  "function regionalPolicies(string) view returns (uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)",
  "event ClaimPaid(address indexed farmer, uint256 amount, string reason, uint256 severity)",
];

const BRIDGE_ABI = [
  "function registerFarmerViaMpesa(bytes32 phoneHash, address walletAddress, string region, uint256 premiumKES) payable",
  "function triggerMpesaPayout(address farmerWallet, uint256 amountWei, string reason)",
  "function isMpesaFarmer(address) view returns (bool)",
];

function initBlockchain() {
  try {
    provider = new ethers.JsonRpcProvider(RPC_URL);
    relay = new ethers.Wallet(RELAY_PRIVATE_KEY, provider);
    insuranceContract = new ethers.Contract(FARMER_INSURANCE_ADDRESS, INSURANCE_ABI, relay);

    if (MPESA_BRIDGE_ADDRESS && MPESA_BRIDGE_ADDRESS !== '0x0000000000000000000000000000000000000000') {
      bridgeContract = new ethers.Contract(MPESA_BRIDGE_ADDRESS, BRIDGE_ABI, relay);
    }

    console.log('  ✅ Blockchain connected. Relay:', relay.address);
  } catch (err) {
    console.warn('  ⚠️  Blockchain not connected:', err.message);
  }
}

// ── Paystack helpers ─────────────────────────────────────────────
async function paystackRequest(method, path, body = null) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${PAYSTACK_BASE}${path}`, opts);
  return res.json();
}

function verifyPaystackSignature(body, signature) {
  const hash = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(body))
    .digest('hex');
  return hash === signature;
}

// In-memory pending registrations (production: use a database)
const pendingRegistrations = new Map();

// ══════════════════════════════════════════════════════════════════
//  API Routes
// ══════════════════════════════════════════════════════════════════

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    blockchain: !!provider,
    bridge: !!bridgeContract,
    paystack: !!PAYSTACK_SECRET_KEY,
  });
});

// ── Initialize M-Pesa payment (Paystack) ─────────────────────────
app.post('/api/mpesa/initialize', async (req, res) => {
  try {
    const { phone, region, email } = req.body;

    if (!phone || !region) {
      return res.status(400).json({ error: 'Phone and region are required' });
    }

    // Get premium from smart contract
    let premiumWei;
    try {
      const policy = await insuranceContract.regionalPolicies(region);
      premiumWei = policy[4]; // premiumAmount is index 4
      if (premiumWei === 0n) {
        return res.status(400).json({ error: 'Region not supported' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Could not fetch policy: ' + err.message });
    }

    // Convert ETH to KES
    const premiumETH = Number(ethers.formatEther(premiumWei));
    const premiumKES = Math.ceil(premiumETH * Number(KES_PER_ETH));
    const premiumKobo = premiumKES * 100; // Paystack uses lowest currency unit

    // Sanitize phone: ensure it starts with 254
    const cleanPhone = phone.replace(/^0/, '254').replace(/^\+/, '');

    // Generate unique reference
    const reference = `KILIMO-${Date.now()}-${cleanPhone.slice(-4)}`;

    // Store pending registration
    pendingRegistrations.set(reference, {
      phone: cleanPhone,
      region,
      premiumKES,
      premiumWei: premiumWei.toString(),
      createdAt: Date.now(),
    });

    // Initialize Paystack transaction
    const paystack = await paystackRequest('POST', '/transaction/initialize', {
      email: email || `${cleanPhone}@kilimokinga.farmer`,
      amount: premiumKobo,
      currency: 'KES',
      reference,
      callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment-success`,
      channels: ['mobile_money'],
      mobile_money: { phone: cleanPhone, provider: 'mpesa' },
      metadata: {
        phone: cleanPhone,
        region,
        premium_kes: premiumKES,
        custom_fields: [
          { display_name: 'Phone', variable_name: 'phone', value: cleanPhone },
          { display_name: 'Region', variable_name: 'region', value: region },
        ],
      },
    });

    if (!paystack.status) {
      return res.status(400).json({ error: paystack.message || 'Paystack initialization failed' });
    }

    res.json({
      success: true,
      authorization_url: paystack.data.authorization_url,
      access_code: paystack.data.access_code,
      reference,
      premium_kes: premiumKES,
      premium_eth: premiumETH.toFixed(6),
    });
  } catch (err) {
    console.error('Initialize error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Paystack Webhook — payment confirmed ─────────────────────────
app.post('/api/paystack/webhook', async (req, res) => {
  // Verify signature
  const signature = req.headers['x-paystack-signature'];
  if (signature && !verifyPaystackSignature(req.body, signature)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { event, data } = req.body;

  if (event === 'charge.success') {
    const reference = data.reference;
    const pending = pendingRegistrations.get(reference);

    if (!pending) {
      console.warn('No pending registration for:', reference);
      return res.sendStatus(200);
    }

    console.log(`\n  📱 M-Pesa payment confirmed: ${pending.phone} → ${pending.region} (KES ${pending.premiumKES})`);

    // Register farmer on-chain via MpesaBridge
    try {
      if (bridgeContract) {
        const phoneHash = ethers.keccak256(ethers.toUtf8Bytes(pending.phone));

        // Create a managed wallet for this farmer
        const farmerWallet = ethers.Wallet.createRandom();

        const tx = await bridgeContract.registerFarmerViaMpesa(
          phoneHash,
          farmerWallet.address,
          pending.region,
          pending.premiumKES,
          { value: pending.premiumWei }
        );

        await tx.wait();
        console.log(`  ✅ Farmer registered on-chain! Wallet: ${farmerWallet.address}`);

        // Store wallet info (production: encrypt and store securely)
        pending.walletAddress = farmerWallet.address;
        pending.txHash = tx.hash;
        pending.status = 'registered';
      } else {
        console.log('  ⚠️  Bridge contract not deployed — skipping on-chain registration');
        pending.status = 'payment_confirmed';
      }
    } catch (err) {
      console.error('  ❌ On-chain registration failed:', err.message);
      pending.status = 'registration_failed';
      pending.error = err.message;
    }

    pendingRegistrations.set(reference, pending);
  }

  res.sendStatus(200);
});

// ── Check payment status ─────────────────────────────────────────
app.get('/api/mpesa/status/:reference', async (req, res) => {
  const { reference } = req.params;
  const pending = pendingRegistrations.get(reference);

  if (!pending) {
    return res.status(404).json({ error: 'Reference not found' });
  }

  // Also verify with Paystack
  try {
    const paystack = await paystackRequest('GET', `/transaction/verify/${reference}`);
    res.json({
      status: pending.status || 'pending',
      paystack_status: paystack.data?.status,
      phone: pending.phone,
      region: pending.region,
      premium_kes: pending.premiumKES,
      wallet: pending.walletAddress || null,
      txHash: pending.txHash || null,
    });
  } catch (err) {
    res.json({ status: pending.status || 'pending', ...pending });
  }
});

// ── Send M-Pesa payout (manual trigger for testing) ──────────────
app.post('/api/mpesa/payout', async (req, res) => {
  try {
    const { phone, amount_kes, reason } = req.body;

    if (!phone || !amount_kes) {
      return res.status(400).json({ error: 'Phone and amount required' });
    }

    const cleanPhone = phone.replace(/^0/, '254').replace(/^\+/, '');

    // Create Paystack transfer recipient
    const recipient = await paystackRequest('POST', '/transferrecipient', {
      type: 'mobile_money',
      name: `Farmer ${cleanPhone.slice(-4)}`,
      account_number: cleanPhone,
      bank_code: 'MPESA',
      currency: 'KES',
    });

    if (!recipient.status) {
      return res.status(400).json({ error: 'Failed to create recipient: ' + recipient.message });
    }

    // Initiate transfer
    const transfer = await paystackRequest('POST', '/transfer', {
      source: 'balance',
      amount: amount_kes * 100, // kobo
      recipient: recipient.data.recipient_code,
      reason: reason || 'KilimoKinga Insurance Claim Payout',
      currency: 'KES',
    });

    if (!transfer.status) {
      return res.status(400).json({ error: 'Transfer failed: ' + transfer.message });
    }

    console.log(`  💰 Payout initiated: KES ${amount_kes} → ${cleanPhone}`);

    res.json({
      success: true,
      transfer_code: transfer.data.transfer_code,
      amount_kes,
      phone: cleanPhone,
    });
  } catch (err) {
    console.error('Payout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Get conversion rate ──────────────────────────────────────────
app.get('/api/rates', (req, res) => {
  res.json({ KES_PER_ETH: Number(KES_PER_ETH) });
});

// ══════════════════════════════════════════════════════════════════
//  ClaimPaid Event Listener — Auto M-Pesa Payouts
// ══════════════════════════════════════════════════════════════════
function startClaimListener() {
  if (!insuranceContract || !bridgeContract) {
    console.log('  ⚠️  Skipping claim listener (contracts not configured)');
    return;
  }

  insuranceContract.on('ClaimPaid', async (farmer, amount, reason, severity) => {
    console.log(`\n  🔔 ClaimPaid detected: ${farmer} — ${ethers.formatEther(amount)} ETH — ${reason}`);

    // Check if this is an M-Pesa farmer
    try {
      const isMpesa = await bridgeContract.isMpesaFarmer(farmer);
      if (!isMpesa) {
        console.log('  ℹ️  Not an M-Pesa farmer, skipping payout');
        return;
      }

      // Convert ETH to KES
      const amountETH = Number(ethers.formatEther(amount));
      const amountKES = Math.floor(amountETH * Number(KES_PER_ETH));

      // Find phone from pending registrations
      let phone = null;
      for (const [, reg] of pendingRegistrations) {
        if (reg.walletAddress === farmer) {
          phone = reg.phone;
          break;
        }
      }

      if (phone) {
        console.log(`  📱 Sending M-Pesa payout: KES ${amountKES} → ${phone}`);

        // Emit bridge event
        const tx = await bridgeContract.triggerMpesaPayout(farmer, amount, reason);
        await tx.wait();

        // Send via Paystack (same flow as manual payout)
        // In production, this would call the payout endpoint internally
        console.log(`  ✅ M-Pesa payout triggered for ${phone}`);
      } else {
        console.log('  ⚠️  Phone number not found for M-Pesa farmer');
      }
    } catch (err) {
      console.error('  ❌ Auto-payout error:', err.message);
    }
  });

  console.log('  👂 Listening for ClaimPaid events (auto M-Pesa payouts)...');
}

// ══════════════════════════════════════════════════════════════════
//  Start Server
// ══════════════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  🌾  KilimoKinga Backend — M-Pesa Bridge');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Server:     http://localhost:${PORT}`);
  console.log(`  Paystack:   ${PAYSTACK_SECRET_KEY ? '✅ Configured' : '❌ Missing key'}`);
  console.log('');

  initBlockchain();
  startClaimListener();

  console.log('');
  console.log('  API Endpoints:');
  console.log('  ─────────────────────────────────────────────');
  console.log('  POST /api/mpesa/initialize  — Start M-Pesa payment');
  console.log('  POST /api/paystack/webhook  — Payment confirmation');
  console.log('  GET  /api/mpesa/status/:ref — Check payment status');
  console.log('  POST /api/mpesa/payout      — Send M-Pesa payout');
  console.log('  GET  /api/rates             — KES/ETH conversion');
  console.log('  GET  /api/health            — Health check');
  console.log('');
});
