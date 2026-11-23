import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import RefreshToken from '../models/RefreshToken.js';
import Subscription from '../models/Subscription.js';
import Client from '../models/Client.js';
import { body, parse } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { assertPasswordPolicy, hashPassword, verifyPassword } from '../utils/password.js';
import { hashToken, randomToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens.js';
import { ORG_BUSINESS_TYPES, ORG_TIMEZONES } from '../config/constants.js';
import env from '../config/env.js';
import { TRIAL_DAYS } from '../config/plans.js';
import { audit } from '../services/audit.js';
import { sendMail, baseEmailHtml } from '../services/mailer.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter } from '../middleware/rateLimit.js';
import { effectivePermissions, ROLE_LABELS } from '../config/permissions.js';

const router = Router();

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const cookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  // 'lax' is required on Vercel: the SPA and the API can live on different
  // *.vercel.app hostnames, and SameSite=Strict would drop the cookie there.
  // Set COOKIE_SAME_SITE=strict for single-origin deployments if you prefer.
  sameSite: env.COOKIE_SAME_SITE === 'strict' ? 'strict' : 'lax',
  path: '/api/auth',
  domain: env.COOKIE_DOMAIN || undefined,
  maxAge: env.REFRESH_TOKEN_DAYS * 24 * 3600 * 1000,
});

async function issueSession(req, res, user, membership) {
  const accessToken = signAccessToken(user, membership);
  const jti = randomToken(16);
  const refreshToken = signRefreshToken(user, jti);
  await RefreshToken.create({
    userId: user._id,
    organizationId: membership?.organizationId,
    tokenHash: hashToken(refreshToken),
    userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    ip: req.ip,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 3600 * 1000),
  });
  res.cookie('if_refresh', refreshToken, cookieOptions());
  return { accessToken, refreshToken };
}

function publicUser(user, membership, organization) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    avatarUrl: user.avatarUrl || '',
    emailVerified: user.emailVerified,
    isSuperAdmin: user.isSuperAdmin,
    role: user.role,
    membership: membership ? {
      id: membership._id,
      role: membership.role,
      roleLabel: ROLE_LABELS[membership.role],
      title: membership.title || '',
      permissions: effectivePermissions(membership.role, organization?.settings?.roleOverrides),
    } : null,
    organization: organization ? {
      id: organization._id,
      name: organization.name,
      slug: organization.slug,
      currency: organization.settings?.currency || 'INR',
      timezone: organization.settings?.timezone || 'Asia/Kolkata',
      onboardingCompleted: organization.onboardingCompleted,
      status: organization.status,
    } : null,
  };
}

// ---------- Register (creates organization + owner) ----------
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  organizationName: z.string().trim().min(2).max(120),
  businessType: z.enum(ORG_BUSINESS_TYPES).optional(),
  country: z.string().length(2).default('IN'),
  timezone: z.string().max(60).optional(),
  currency: z.enum(['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD']).optional(),
});

router.post('/register', body(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, organizationName } = req.body;
  assertPasswordPolicy(password);
  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists. Sign in instead.');

  const user = await User.create({
    name, email,
    passwordHash: await hashPassword(password),
    role: 'ORG_USER',
  });

  // Unique slug per organization
  let slug = slugify(organizationName) || 'consultancy';
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await Organization.exists({ slug }))) break;
    slug = `${slugify(organizationName)}-${crypto.randomBytes(2).toString('hex')}`;
  }

  const countryCurrency = { IN: 'INR', AU: 'AUD', NZ: 'NZD', GB: 'GBP', CA: 'CAD', US: 'USD' }[req.body.country] || 'INR';
  const org = await Organization.create({
    name: organizationName,
    slug,
    email,
    businessType: req.body.businessType || 'Immigration Consultancy',
    createdBy: user._id,
    status: 'TRIAL',
    settings: {
      currency: req.body.currency || countryCurrency,
      timezone: req.body.timezone || (req.body.country === 'IN' ? 'Asia/Kolkata' : 'Asia/Kolkata'),
      country: req.body.country,
    },
  });

  const membership = await Membership.create({ organizationId: org._id, userId: user._id, role: 'OWNER', status: 'ACTIVE', title: 'Owner' });

  await Subscription.create({
    organizationId: org._id, plan: 'STARTER', status: 'TRIALING',
    trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000),
    currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 24 * 3600 * 1000),
  });

  // Email verification token
  const verifyToken = randomToken(32);
  user.emailVerificationTokenHash = hashToken(verifyToken);
  user.emailVerificationExpires = new Date(Date.now() + 48 * 3600 * 1000);
  await user.save();

  const verifyUrl = `${env.APP_URL}/verify-email?token=${verifyToken}`;
  const mail = await sendMail({
    to: email,
    subject: 'Verify your ImmigrationFlow email',
    text: `Welcome to ImmigrationFlow. Verify your email: ${verifyUrl}`,
    html: baseEmailHtml('Verify your email', `<p>Hi ${name}, welcome to ImmigrationFlow.</p><p><a href="${verifyUrl}" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Verify email</a></p><p style="color:#667085;font-size:12px">Link expires in 48 hours.</p>`),
  });

  const session = await issueSession(req, res, user, membership);
  await audit({ user, membership, ip: req.ip, headers: req.headers }, 'auth.register', { entityType: 'Organization', entityId: org._id, description: `Organization "${org.name}" registered` });

  res.status(201).json({
    user: publicUser(user, membership, org),
    ...session,
    emailSent: mail.sent,
    message: mail.sent ? 'Account created. Check your email to verify your address.' : 'Account created. Email verification is unavailable until SMTP is configured.',
  });
}));

// ---------- Login ----------
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
  organizationId: z.string().optional(),
});

router.post('/login', loginLimiter, body(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash +failedLoginAttempts +lockedUntil');
  const genericFail = ApiError.unauthorized('Invalid email or password');

  if (!user) throw genericFail;
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw ApiError.tooMany('Account temporarily locked after repeated failed attempts. Try again in 15 minutes.');
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 10) user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    throw genericFail;
  }
  if (user.status === 'DISABLED') throw ApiError.forbidden('This account has been deactivated. Contact your administrator.');

  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  // Client portal users use a separate login endpoint
  if (user.role === 'CLIENT') {
    throw ApiError.forbidden('Please sign in through the client portal.');
  }

  let membership = null;
  if (!user.isSuperAdmin) {
    const memberships = await Membership.find({ userId: user._id, status: 'ACTIVE' }).populate('organizationId');
    const usable = memberships.filter((m) => m.organizationId && m.organizationId.status !== 'SUSPENDED');
    if (!usable.length) throw ApiError.forbidden('Your organization membership is inactive. Contact your administrator.');
    membership = req.body.organizationId
      ? usable.find((m) => String(m.organizationId._id) === req.body.organizationId)
      : usable[0];
    if (!membership) throw ApiError.forbidden('You do not have access to that organization.');
  }

  const session = await issueSession(req, res, user, membership);
  await audit({ user, membership: { organizationId: membership?.organizationId?._id || membership?.organizationId, role: membership?.role }, ip: req.ip, headers: req.headers }, 'auth.login', { description: 'Signed in' });
  res.json({ user: publicUser(user, membership, membership?.organizationId), ...session });
}));

// ---------- Client portal login ----------
router.post('/client/login', loginLimiter, body(loginSchema.pick({ email: true, password: true })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash +failedLoginAttempts +lockedUntil');
  const genericFail = ApiError.unauthorized('Invalid email or password');
  if (!user || user.role !== 'CLIENT') throw genericFail;
  if (user.lockedUntil && user.lockedUntil > new Date()) throw ApiError.tooMany('Account temporarily locked. Try again in 15 minutes.');
  const ok = await verifyPassword(req.body.password, user.passwordHash);
  if (!ok) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 10) user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    throw genericFail;
  }
  if (user.status === 'DISABLED') throw ApiError.forbidden('This portal account has been disabled.');
  const client = await Client.findOne({ 'portalAccess.userId': user._id, 'portalAccess.enabled': true });
  if (!client) throw ApiError.forbidden('No portal profile is linked to this account.');
  user.failedLoginAttempts = 0; user.lastLoginAt = new Date();
  await user.save();
  const session = await issueSession(req, res, user, null);
  await audit({ user, ip: req.ip, headers: req.headers, membership: { organizationId: client.organizationId, role: 'CLIENT' } }, 'portal.login', { description: 'Client signed in to portal' });
  res.json({
    user: { id: user._id, name: user.name, email: user.email, role: 'CLIENT', portal: true, clientId: client._id, organizationId: client.organizationId },
    ...session,
  });
}));

// ---------- Session helpers ----------
router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.if_refresh || req.body?.refreshToken;
  if (!token) throw ApiError.unauthorized('No refresh token');
  let payload;
  try { payload = verifyRefreshToken(token); } catch { throw ApiError.unauthorized('Session expired'); }
  const stored = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (!stored || stored.revokedAt) throw ApiError.unauthorized('Session revoked');
  // Rotate
  stored.revokedAt = new Date();
  const user = await User.findById(payload.sub);
  if (!user || user.status === 'DISABLED') throw ApiError.unauthorized('Account inactive');
  let membership = null;
  if (stored.organizationId) {
    membership = await Membership.findOne({ userId: user._id, organizationId: stored.organizationId, status: 'ACTIVE' }).populate('organizationId');
    if (!membership) throw ApiError.unauthorized('Membership inactive');
  }
  await stored.save();
  const session = await issueSession(req, res, user, membership);
  res.json({ user: publicUser(user, membership, membership?.organizationId), ...session });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.if_refresh;
  if (token) await RefreshToken.updateOne({ tokenHash: hashToken(token) }, { revokedAt: new Date() });
  res.clearCookie('if_refresh', { ...cookieOptions(), maxAge: undefined });
  res.json({ ok: true });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  // Guard: org users without membership should be flagged rather than crash
  const org = req.membership ? await Organization.findById(req.membership.organizationId) : null;
  res.json({ user: publicUser(req.user, req.membership, org) });
}));

// ---------- Email verification ----------
router.post('/verify-email', body(z.object({ token: z.string().min(10) })), asyncHandler(async (req, res) => {
  const user = await User.findOne({
    emailVerificationTokenHash: hashToken(req.body.token),
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpires');
  if (!user) throw ApiError.badRequest('This verification link is invalid or has expired.');
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  res.json({ message: 'Email verified successfully.' });
}));

router.post('/resend-verification', requireAuth, asyncHandler(async (req, res) => {
  if (req.user.emailVerified) return res.json({ message: 'Email already verified.' });
  const token = randomToken(32);
  req.user.emailVerificationTokenHash = hashToken(token);
  req.user.emailVerificationExpires = new Date(Date.now() + 48 * 3600 * 1000);
  await req.user.save();
  const mail = await sendMail({
    to: req.user.email,
    subject: 'Verify your ImmigrationFlow email',
    html: baseEmailHtml('Verify your email', `<p><a href="${env.APP_URL}/verify-email?token=${token}" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Verify email</a></p>`),
  });
  res.json({ message: mail.sent ? 'Verification email sent.' : 'SMTP is not configured — ask your administrator to enable email.', emailSent: mail.sent });
}));

// ---------- Password reset ----------
router.post('/forgot-password', body(z.object({ email: z.string().email() })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  // Always return the same message to prevent account enumeration
  const generic = { message: 'If an account exists for that email, a reset link has been sent.' };
  if (!user || user.status === 'DISABLED') return res.json(generic);
  const token = randomToken(32);
  user.passwordResetTokenHash = hashToken(token);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();
  const url = `${env.APP_URL}/reset-password?token=${token}`;
  const mail = await sendMail({
    to: user.email,
    subject: 'Reset your ImmigrationFlow password',
    text: `Reset your password: ${url} (expires in 1 hour)`,
    html: baseEmailHtml('Reset your password', `<p>We received a request to reset your password. This link expires in 1 hour.</p><p><a href="${url}" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Reset password</a></p><p style="color:#667085;font-size:12px">If you didn't request this, you can ignore this email.</p>`),
  });
  await audit({ user, ip: req.ip, headers: req.headers }, 'auth.forgot_password', { description: 'Password reset requested' });
  res.json({ ...generic, emailSent: mail.sent });
}));

router.post('/reset-password', body(z.object({ token: z.string().min(10), password: z.string().min(8).max(200) })), asyncHandler(async (req, res) => {
  assertPasswordPolicy(req.body.password);
  const user = await User.findOne({
    passwordResetTokenHash: hashToken(req.body.token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired.');
  user.passwordHash = await hashPassword(req.body.password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await user.save();
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() }); // revoke all sessions
  await audit({ user, ip: req.ip, headers: req.headers }, 'auth.reset_password', { description: 'Password reset completed' });
  res.json({ message: 'Password updated. Sign in with your new password.' });
}));

router.post('/change-password', requireAuth, body(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(200) })), asyncHandler(async (req, res) => {
  assertPasswordPolicy(req.body.newPassword);
  const user = await User.findById(req.user._id).select('+passwordHash');
  const ok = await verifyPassword(req.body.currentPassword, user.passwordHash);
  if (!ok) throw ApiError.badRequest('Current password is incorrect.');
  user.passwordHash = await hashPassword(req.body.newPassword);
  await user.save();
  await RefreshToken.updateMany({ userId: user._id, revokedAt: null, tokenHash: { $ne: hashToken(req.cookies?.if_refresh || '') } }, { revokedAt: new Date() });
  await audit(req, 'auth.change_password', { description: 'Password changed' });
  res.json({ message: 'Password updated.' });
}));

router.patch('/profile', requireAuth, body(z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  timezone: z.string().max(60).optional(),
})), asyncHandler(async (req, res) => {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json({ message: 'Profile updated.', user: publicUser(req.user, req.membership, null) });
}));

export default router;
