#!/usr/bin/env node
/**
 * Bootstrap the first platform (SaaS) super admin.
 *
 * Usage:
 *   node scripts/create-superadmin.mjs --email ops@yourcompany.com --password 'StrongPass123' --name 'Ops Lead'
 *
 * If the user already exists it is promoted instead of duplicated.
 * Never hard-codes credentials — everything comes from flags or env vars.
 */
import mongoose from 'mongoose';
import env from '../src/config/env.js';
import User from '../src/models/User.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { hashPassword } from '../src/utils/password.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const email = (arg('email', process.env.SUPERADMIN_EMAIL) || '').toLowerCase().trim();
const password = arg('password', process.env.SUPERADMIN_PASSWORD) || '';
const name = arg('name', process.env.SUPERADMIN_NAME) || 'Platform Admin';

if (!email || !process.env.SUPERADMIN_PASSWORD && !password) {
  console.error('Missing credentials.\n  node scripts/create-superadmin.mjs --email you@company.com --password "StrongPass123" --name "Ops"\n');
  process.exit(1);
}
if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
  console.error('Password must be at least 10 characters and include a letter and a number.');
  process.exit(1);
}

await mongoose.connect(env.MONGODB_URI);
try {
  let user = await User.findOne({ email });
  if (user) {
    user.isSuperAdmin = true;
    user.role = 'SAAS_ADMIN';
    user.status = 'ACTIVE';
    await user.save();
    console.log(`✔ Promoted existing user to super admin: ${email}`);
  } else {
    user = await User.create({
      name, email, passwordHash: await hashPassword(password),
      role: 'SAAS_ADMIN', isSuperAdmin: true, status: 'ACTIVE', emailVerified: true, emailVerifiedAt: new Date(),
    });
    console.log(`✔ Created super admin: ${email}`);
  }
  await AuditLog.create({
    organizationId: null, actorId: user._id, actorName: 'CLI bootstrap', actorRole: 'SAAS_ADMIN',
    action: 'admin.superadmin_bootstrapped', description: `Super admin bootstrapped from CLI for ${email}`,
  });
  console.log('  Sign in at /login with these credentials, then open /admin.');
} finally {
  await mongoose.disconnect();
}
