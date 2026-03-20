import mongoose from 'mongoose';
import logger from '../utils/logger.js';

let isConnected = false;

export async function connectDB(uri) {
  if (isConnected) return;

  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/kilimokinga';

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('MongoDB disconnected');
    });
  } catch (err) {
    logger.warn(`MongoDB not available (${err.message}). Running without persistent storage.`);
    isConnected = false;
  }

  return isConnected;
}

export function isDBConnected() {
  return isConnected;
}
