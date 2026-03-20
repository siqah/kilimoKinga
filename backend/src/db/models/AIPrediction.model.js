import mongoose from 'mongoose';

const aiPredictionSchema = new mongoose.Schema({
  region:     { type: String, required: true, index: true },
  type:       { type: String, enum: ['risk', 'yield', 'pricing', 'forecast', 'crop'], required: true, index: true },
  input:      { type: mongoose.Schema.Types.Mixed },  // input parameters
  result:     { type: mongoose.Schema.Types.Mixed, required: true },  // prediction output
  confidence: { type: Number },
  createdAt:  { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Compound index for getting latest prediction by type + region
aiPredictionSchema.index({ region: 1, type: 1, createdAt: -1 });

export default mongoose.model('AIPrediction', aiPredictionSchema);
