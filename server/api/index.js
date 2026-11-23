/**
 * Vercel serverless entry point.
 *
 * Vercel does not run a long-lived server, so this file adapts the Express app:
 *  • MongoDB connections are cached across invocations (otherwise every request
 *    would open a new pool and exhaust Atlas connections).
 *  • The in-process scheduler and Socket.IO are NOT started — neither can run in
 *    a serverless function. Notifications still persist; only live push is
 *    skipped, and the SPA falls back to polling.
 *
 * Local development and self-hosting keep using src/index.js.
 */
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';

// The health endpoint reads the connection from here.
globalThis.__mongoose = mongoose;

const opts = {
  dbName: env.MONGODB_DB_NAME || undefined,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  // Serverless functions are frozen between requests; a long socket timeout
  // avoids reconnecting on every warm invocation.
  socketTimeoutMS: 45000,
};

let cached = globalThis.__mongoPromise;

async function connect() {
  if (mongoose.connection.readyState === 1) return;
  if (!cached) {
    cached = mongoose.connect(env.MONGODB_URI, opts).catch((err) => {
      cached = null; // let the next invocation retry
      throw err;
    });
    globalThis.__mongoPromise = cached;
  }
  await cached;
}

export default async function handler(req, res) {
  try {
    await connect();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[vercel] database connection failed', err);
    res.status(503).json({ error: 'Database unavailable. Please retry.', code: 'DB_UNAVAILABLE' });
    return;
  }
  return app(req, res);
}
