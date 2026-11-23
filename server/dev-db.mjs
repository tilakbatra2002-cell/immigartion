/**
 * Local development database.
 * Starts an embedded MongoDB-compatible server when no MONGODB_URI is running.
 * Production MUST use MongoDB Atlas (or a self-hosted replica set) — this file is
 * never used when a real MONGODB_URI is supplied.
 *
 * The data directory defaults to ./.cache/devdb. That location is intentionally
 * outside the tracked tree: WiredTiger preallocates ~300 MB of journal files,
 * and this data is disposable — recreate it any time with
 *   node scripts/create-superadmin.mjs …   &&   node scripts/seed-demo.mjs
 * Override with DEV_DB_PATH if you need it somewhere else.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import fs from 'node:fs';

const dbPath = process.env.DEV_DB_PATH || './.cache/devdb';
if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, dbName: 'immigrationflow', storageEngine: 'wiredTiger', dbPath },
  binary: { version: '7.0.14' },
});
console.log(`[dev-db] MongoDB running at ${mongod.getUri()}`);
console.log('[dev-db] Data directory:', dbPath);
console.log('[dev-db] Disposable: re-seed with `node scripts/seed-demo.mjs`. Press Ctrl+C to stop.');

process.on('SIGINT', async () => { await mongod.stop({ doCleanup: false }); process.exit(0); });
process.on('SIGTERM', async () => { await mongod.stop({ doCleanup: false }); process.exit(0); });
setInterval(() => {}, 1 << 30);
