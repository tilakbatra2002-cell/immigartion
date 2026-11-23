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
 * IMPORTANT: mongoose must resolve to exactly ONE instance, otherwise the
 * connection is opened on one copy while the models use another and every
 * query hangs. We reuse the server's install rather than adding a second one,
 * and fall back to a private import only if that is somehow unavailable.
 *
 * Local development and self-hosting keep using server/src/index.js.
 */
import app from '../server/src/app.js';
import env from '../server/src/config/env.js';

// Reuse whichever mongoose the models are bound to (server/node_modules first).
let mongoose;
try {
  mongoose = (await import('mongoose')).default; // resolves via NODE_PATH/hints
} catch {
  mongoose = (await import('../server/node_modules/mongoose/index.js')).default;
}

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
