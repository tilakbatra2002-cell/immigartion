import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import Organization from '../models/Organization.js';
import User from '../models/User.js';
import Membership from '../models/Membership.js';
import Subscription from '../models/Subscription.js';
import AuditLog from '../models/AuditLog.js';
import Lead from '../models/Lead.js';
import ImmigrationCase from '../models/ImmigrationCase.js';
import Invoice, { Payment } from '../models/Invoice.js';
import { requireAuth, requireSuperAdmin } from '../middleware/auth.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { PLANS, PLAN_KEYS, planFor } from '../config/plans.js';
import { ROLE_LABELS } from '../config/permissions.js';
import { audit } from '../services/audit.js';
import { flags } from '../config/env.js';
import { hashPassword, assertPasswordPolicy } from '../utils/password.js';

const router = Router();
router.use(requireAuth, requireSuperAdmin);

// ---------- Platform analytics ----------
router.get('/overview', asyncHandler(async (req, res) => {
  const [orgCounts, subCounts, userCount, revenueAgg, recentOrgs, caseCount, leadCount] = await Promise.all([
    Organization.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Subscription.aggregate([{ $group: { _id: { plan: '$plan', status: '$status' }, count: { $sum: 1 } } }]),
    User.countDocuments({ role: { $ne: 'CLIENT' } }),
    Subscription.aggregate([{ $match: { status: 'ACTIVE' } }, { $group: { _id: '$plan', count: { $sum: 1 } } }]),
    Organization.find().sort('-createdAt').limit(6).select('name slug status createdAt settings.currency').lean(),
    ImmigrationCase.countDocuments(),
    Lead.countDocuments(),
  ]);
  const planRevenue = revenueAgg.reduce((sum, r) => {
    const plan = planFor(r._id);
    return sum + (plan.price[req.org?.settings?.currency || 'INR'] || plan.price.INR) * r.count;
  }, 0);
  res.json({
    organizations: {
      total: orgCounts.reduce((s, r) => s + r.count, 0),
      byStatus: Object.fromEntries(orgCounts.map((r) => [r._id, r.count])),
    },
    subscriptions: subCounts.map((r) => ({ plan: r._id.plan, status: r._id.status, count: r.count })),
    activeByPlan: Object.fromEntries(revenueAgg.map((r) => [r._id, r.count])),
    mrrEstimate: planRevenue,
    users: userCount,
    totalCases: caseCount,
    totalLeads: leadCount,
    recentOrganizations: recentOrgs,
  });
}));

router.get('/analytics', asyncHandler(async (req, res) => {
  const [orgsByMonth, casesByMonth] = await Promise.all([
    Organization.aggregate([{ $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]),
    ImmigrationCase.aggregate([{ $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { '_id.y': 1, '_id.m': 1 } }]),
  ]);
  res.json({
    organizationsByMonth: orgsByMonth.map((r) => ({ month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`, count: r.count })),
    casesByMonth: casesByMonth.map((r) => ({ month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`, count: r.count })),
  });
}));

// ---------- Organizations ----------
const orgQuery = paginationSchema.extend({ status: z.string().optional(), plan: z.string().optional() });

router.get('/organizations', query(orgQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.q) filter.$or = [{ name: new RegExp(escapeRegex(q.q), 'i') }, { slug: new RegExp(escapeRegex(q.q), 'i') }, { email: new RegExp(escapeRegex(q.q), 'i') }];
  const [orgs, total] = await Promise.all([
    paginate(Organization.find(filter), { page: q.page, limit: q.limit, sort: '-createdAt' }).lean(),
    Organization.countDocuments(filter),
  ]);
  const subs = await Subscription.find({ organizationId: { $in: orgs.map((o) => o._id) } }).lean();
  const counts = await Membership.aggregate([{ $match: { organizationId: { $in: orgs.map((o) => o._id) }, status: 'ACTIVE' } }, { $group: { _id: '$organizationId', count: { $sum: 1 } } }]);
  const data = orgs.map((o) => ({
    ...o,
    subscription: subs.find((s) => String(s.organizationId) === String(o._id)) || null,
    memberCount: counts.find((c) => String(c._id) === String(o._id))?.count || 0,
  })).filter((o) => !q.plan || o.subscription?.plan === q.plan);
  res.json({ data, meta: pageMeta(total, q.page, q.limit) });
}));

router.get('/organizations/:id', asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id).lean();
  if (!org) throw ApiError.notFound('Organization not found');
  const [sub, members, usage] = await Promise.all([
    Subscription.findOne({ organizationId: org._id }).lean(),
    Membership.find({ organizationId: org._id }).populate('userId', 'name email status lastLoginAt').lean(),
    Promise.all([
      Lead.countDocuments({ organizationId: org._id }),
      ImmigrationCase.countDocuments({ organizationId: org._id }),
      Invoice.aggregate([{ $match: { organizationId: org._id, status: 'PAID' } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
    ]),
  ]);
  res.json({
    organization: org,
    subscription: sub,
    members: members.filter((m) => m.userId).map((m) => ({ id: m._id, name: m.userId.name, email: m.userId.email, role: m.role, roleLabel: ROLE_LABELS[m.role], status: m.status })),
    usage: { leads: usage[0], cases: usage[1], revenue: usage[2][0]?.total || 0 },
  });
}));

router.patch('/organizations/:id', body(z.object({
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED']).optional(),
  suspendedReason: z.string().max(500).optional(),
  name: z.string().trim().min(2).max(120).optional(),
})), asyncHandler(async (req, res) => {
  const org = await Organization.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!org) throw ApiError.notFound('Organization not found');
  await audit(req, 'admin.organization_updated', { organizationId: org._id, entityType: 'Organization', entityId: org._id, description: `Platform admin updated org status: ${req.body.status || 'details'}` });
  res.json(org);
}));

// ---------- Subscriptions ----------
router.patch('/subscriptions/:organizationId', body(z.object({
  plan: z.enum(PLAN_KEYS).optional(),
  status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED', 'PAUSED']).optional(),
  currentPeriodEnd: z.string().optional(),
  trialEndsAt: z.string().optional(),
})), asyncHandler(async (req, res) => {
  const sub = await Subscription.findOne({ organizationId: req.params.organizationId });
  if (!sub) throw ApiError.notFound('Subscription not found');
  if (req.body.plan) sub.plan = req.body.plan;
  if (req.body.status) sub.status = req.body.status;
  if (req.body.currentPeriodEnd) sub.currentPeriodEnd = new Date(req.body.currentPeriodEnd);
  if (req.body.trialEndsAt) sub.trialEndsAt = new Date(req.body.trialEndsAt);
  await sub.save();
  await Organization.updateOne({ _id: sub.organizationId }, { status: req.body.status === 'ACTIVE' ? 'ACTIVE' : req.body.status === 'CANCELLED' ? 'CANCELLED' : req.body.status === 'PAST_DUE' ? 'PAST_DUE' : undefined });
  await audit(req, 'admin.subscription_updated', { organizationId: sub.organizationId, description: `Platform admin set plan=${sub.plan} status=${sub.status}` });
  res.json(sub);
}));

// ---------- Users ----------
router.get('/users', query(paginationSchema.extend({ role: z.string().optional(), status: z.string().optional() })), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = {};
  if (q.role) filter.role = q.role;
  if (q.status) filter.status = q.status;
  if (q.q) { const rx = new RegExp(escapeRegex(q.q), 'i'); filter.$or = [{ name: rx }, { email: rx }]; }
  const [users, total] = await Promise.all([
    paginate(User.find(filter).select('-passwordHash'), { page: q.page, limit: q.limit, sort: '-createdAt' }).lean(),
    User.countDocuments(filter),
  ]);
  const memberships = await Membership.find({ userId: { $in: users.map((u) => u._id) } }).populate('organizationId', 'name').lean();
  res.json({
    data: users.map((u) => ({ ...u, memberships: memberships.filter((m) => String(m.userId) === String(u._id)).map((m) => ({ organization: m.organizationId?.name, role: m.role, status: m.status })) })),
    meta: pageMeta(total, q.page, q.limit),
  });
}));

router.patch('/users/:id', body(z.object({ status: z.enum(['ACTIVE', 'DISABLED']).optional(), isSuperAdmin: z.boolean().optional() })), asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id) && req.body.isSuperAdmin === false) throw ApiError.badRequest('You cannot remove your own super admin access.');
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-passwordHash');
  if (!user) throw ApiError.notFound('User not found');
  await audit(req, 'admin.user_updated', { description: `Platform admin updated user ${user.email}` });
  res.json(user);
}));

// ---------- Plans (read + price display) ----------
router.get('/plans', asyncHandler(async (req, res) => {
  const counts = await Subscription.aggregate([{ $group: { _id: { plan: '$plan', status: '$status' }, count: { $sum: 1 } } }]);
  res.json({ plans: Object.values(PLANS), usage: counts });
}));

// ---------- Platform audit trail ----------
router.get('/audit-logs', query(paginationSchema.extend({ action: z.string().optional(), organizationId: z.string().optional() })), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = {};
  if (q.action) filter.action = new RegExp(`^${escapeRegex(q.action)}`);
  if (q.organizationId) filter.organizationId = q.organizationId;
  const [items, total] = await Promise.all([
    paginate(AuditLog.find(filter), { page: q.page, limit: q.limit, sort: '-createdAt' }).populate('organizationId', 'name').lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit) });
}));

// ---------- Platform revenue ----------
router.get('/revenue', asyncHandler(async (req, res) => {
  const subs = await Subscription.find({ status: 'ACTIVE' }).lean();
  const byCurrency = {};
  for (const s of subs) {
    const plan = planFor(s.plan);
    const price = plan.price[s.currency] || plan.price.INR;
    byCurrency[s.currency] = (byCurrency[s.currency] || 0) + price;
  }
  const totals = await Payment.aggregate([{ $match: { status: 'SUCCESS' } }, { $group: { _id: '$currency', total: { $sum: '$amount' } } }]);
  res.json({ activeSubscriptions: subs.length, monthlyRecurringByCurrency: byCurrency, supplierPaymentsByCurrency: totals, providers: { stripe: flags.stripe, razorpay: flags.razorpay } });
}));

// ---------- System config visibility ----------
router.get('/system', asyncHandler(async (req, res) => {
  const { flags: f } = await import('../config/env.js');
  const env = (await import('../config/env.js')).default;
  res.json({
    environment: env.NODE_ENV,
    integrations: { email: f.smtp, whatsapp: f.whatsapp, ai: f.ai, stripe: f.stripe, razorpay: f.razorpay, s3: f.s3 },
    storageDriver: env.STORAGE_DRIVER,
    nodeVersion: process.version,
    uptimeSeconds: Math.floor(process.uptime()),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    emailVerificationRequired: env.REQUIRE_EMAIL_VERIFICATION === 'true',
  });
}));

// ---------- Make user super admin (safety: requires existing super admin) ----------
router.post('/users/:id/grant-superadmin', body(z.object({ confirm: z.literal(true) })), asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found');
  user.isSuperAdmin = true;
  user.role = 'SAAS_ADMIN';
  await user.save();
  await audit(req, 'admin.superadmin_granted', { description: `Super admin granted to ${user.email}` });
  res.json({ ok: true });
}));

export default router;
