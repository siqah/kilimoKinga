import mongoose from 'mongoose';

const farmerSchema = new mongoose.Schema({
  walletAddress: { type: String, index: true, unique: true, sparse: true },
  phoneHash:     { type: String, index: true, sparse: true },
  region:        { type: String, required: true, index: true },
  premiumPaid:   { type: String },  // stored as ETH string
  coverageAmount:{ type: String },
  seasonsCompleted: { type: Number, default: 0 },
  isActive:      { type: Boolean, default: true },
  registrationTx:{ type: String },
  registeredAt:  { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('Farmer', farmerSchema);
