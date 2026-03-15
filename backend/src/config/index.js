import 'dotenv/config';

const config = {
  port: Number(process.env.PORT) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    baseUrl: 'https://api.paystack.co',
  },

  blockchain: {
    rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
    relayPrivateKey: process.env.RELAY_PRIVATE_KEY || '',
    contracts: {
      farmerInsurance: process.env.FARMER_INSURANCE_ADDRESS || '',
      mpesaBridge: process.env.MPESA_BRIDGE_ADDRESS || '',
    },
  },

  kesPerEth: Number(process.env.KES_PER_ETH) || 500000,

  retry: {
    maxAttempts: 3,
    baseDelayMs: 1000,
  },

  logLevel: process.env.LOG_LEVEL || 'info',
};

export function validateConfig() {
  const errors = [];
  if (!config.paystack.secretKey) errors.push('PAYSTACK_SECRET_KEY is required');
  if (!config.blockchain.relayPrivateKey) errors.push('RELAY_PRIVATE_KEY is required');
  if (!config.blockchain.contracts.farmerInsurance) errors.push('FARMER_INSURANCE_ADDRESS is required');

  if (errors.length > 0 && config.nodeEnv === 'production') {
    throw new Error(`Config validation failed:\n  ${errors.join('\n  ')}`);
  }

  if (errors.length > 0) {
    console.warn('  ⚠️  Missing config (ok for dev):', errors.join(', '));
  }
}

export default config;
