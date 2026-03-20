import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  type:       { type: String, enum: ['registration', 'claim', 'mpesa_payment', 'mpesa_payout', 'stake', 'unstake'], required: true, index: true },
  walletAddress: { type: String, index: true },
  phoneHash:  { type: String, sparse: true },
  region:     { type: String },
  amount:     { type: String },           // ETH or KES amount as string
  currency:   { type: String, enum: ['ETH', 'KES', 'USDC'], default: 'ETH' },
  txHash:     { type: String, sparse: true, unique: true },
  paystackRef:{ type: String, sparse: true },
  status:     { type: String, enum: ['pending', 'success', 'failed'], default: 'pending' },
  metadata:   { type: mongoose.Schema.Types.Mixed },
  createdAt:  { type: Date, default: Date.now, index: true },
}, { timestamps: true });

export default mongoose.model('Transaction', transactionSchema);
