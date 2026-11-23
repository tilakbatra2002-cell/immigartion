import http from 'node:http';
import mongoose from 'mongoose';
import env from './config/env.js';
import app from './app.js';
import { initRealtime } from './realtime.js';
import { startScheduler } from './services/scheduler.js';

globalThis.__mongoose = mongoose;

async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, {
    dbName: env.MONGODB_DB_NAME || undefined,
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
  });
  // eslint-disable-next-line no-console
  console.log(`[db] connected to ${mongoose.connection.host}/${mongoose.connection.name}`);
}

async function start() {
  await connectDB();
  const server = http.createServer(app);
  initRealtime(server);
  startScheduler();
  server.listen(env.PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[api] ImmigrationFlow listening on :${env.PORT} (${env.NODE_ENV})`);
  });
  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => { mongoose.disconnect().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[api] failed to start', err);
  process.exit(1);
});
