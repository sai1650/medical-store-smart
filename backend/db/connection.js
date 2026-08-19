const mongoose = require('mongoose');

function getConnectionFailureReason(error) {
  const message = String(error?.message || '').toLowerCase();
  const name = String(error?.name || '').toLowerCase();

  if (message.includes('authentication failed') || message.includes('bad auth') || name.includes('authentication')) {
    return 'authentication failed';
  }
  if (message.includes('server selection') || message.includes('timed out') || message.includes('timeout')) {
    return 'server selection timeout';
  }
  if (name.includes('network') || message.includes('enotfound') || message.includes('econn')) {
    return 'network connection failed';
  }
  return 'connection failed';
}

async function connectDB() {
  const mongoUri = (process.env.MONGODB_URI || '').trim().replace(/^['"]|['"]$/g, '');

  console.log('MongoDB URI configured:', Boolean(mongoUri));
  if (!mongoUri) {
    const error = new Error('MONGODB_URI environment variable is missing');
    error.code = 'MONGODB_URI_MISSING';
    throw error;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000
    });
    console.log('✅ MongoDB connected successfully');
    console.log('MongoDB connection state:', mongoose.connection.readyState);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${getConnectionFailureReason(error)}`);
    throw error;
  }
}

module.exports = connectDB;
