import mongoose from 'mongoose';

const weatherEventSchema = new mongoose.Schema({
  region:      { type: String, required: true, index: true },
  rainfall:    { type: Number, required: true },
  temperature: { type: Number, required: true },
  ndvi:        { type: Number },
  source:      { type: String, enum: ['oracle', 'api', 'manual'], default: 'api' },
  recordedAt:  { type: Date, default: Date.now, index: true },
}, { timestamps: true });

// Compound index for efficient historical queries
weatherEventSchema.index({ region: 1, recordedAt: -1 });

export default mongoose.model('WeatherEvent', weatherEventSchema);
