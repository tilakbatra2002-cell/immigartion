import { Router } from 'express';
import { z } from 'zod';
import Organization from '../models/Organization.js';
import Membership from '../models/Membership.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Subscription from '../models/Subscription.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS, ORG_ROLES, ROLE_LABELS, ROLE_PERMISSIONS, effectivePermissions, INVITABLE_ROLES } from '../config/permissions.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { CASE_STATUSES, COUNTRIES, ORG_BUSINESS_TYPES, ORG_TIMEZONES } from '../config/constants.js';
import { audit } from '../services/audit.js';
import { usageSummary, enforceSeatLimit } from '../services/plans.js';
import { hashToken, randomToken } from '../utils/tokens.js';
import { hashPassword as hashPw } from '../utils/password.js';
import { sendMail, baseEmailHtml, mailerStatus } from '../services/mailer.js';
import { whatsappStatus } from '../services/whatsapp.js';
import { aiStatus } from '../services/ai.js';
import env, { flags } from '../config/env.js';

const router = Router();
router.use(requireAuth, requireOrg);

// ---------- Profile ----------
router.get('/', requirePermission(PERMISSIONS.SETTINGS_VIEW), asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.organizationId).lean();
  res.json(org);
}));

const orgBody = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  businessType: z.enum(ORG_BUSINESS_TYPES).optional(),
  email: z.string().email().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  website: z.string().trim().max(200).optional().or(z.literal('')),
  registrationNumber: z.string().trim().max(60).optional(),
  logoUrl: z.string().trim().max(500).optional().or(z.literal('')),
  onboardingCompleted: z.boolean().optional(),
  settings: z.object({
    timezone: z.enum(ORG_TIMEZONES).optional(),
    currency: z.enum(['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD']).optional(),
    locale: z.string().max(20).optional(),
    addressLine1: z.string().max(200).optional(),
    addressLine2: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postalCode: z.string().max(20).optional(),
    country: z.string().max(5).optional(),
    taxName: z.string().max(30).optional(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    taxNumber: z.string().max(40).optional(),
    invoicePrefix: z.string().max(10).optional(),
    invoiceTerms: z.string().max(1000).optional(),
    notifications: z.object({
      emailOnNewLead: z.boolean().optional(), emailOnNewClient: z.boolean().optional(),
      dailyDigest: z.boolean().optional(), appointmentReminders: z.boolean().optional(), invoiceReminders: z.boolean().optional(),
    }).partial().optional(),
  }).partial().optional(),
});

router.patch('/', requirePermission(PERMISSIONS.SETTINGS_MANAGE), body(orgBody), asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.organizationId);
  if (!org) throw ApiError.notFound('Organization not found');
  const { settings, ...rest } = req.body;
  Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) org[k] = v; });
  if (rest.onboardingCompleted !== undefined) org.onboardingCompleted = rest.onboardingCompleted;
  if (settings) {
    for (const [k, v] of Object.entries(settings)) {
      if (k === 'notifications') org.settings.notifications = { ...org.settings.notifications.toObject?.() ?? org.settings.notifications, ...v };
      else if (v !== undefined) org.settings[k] = v;
    }
  }
  await org.save();
  await audit(req, 'organization.updated', { entityType: 'Organization', entityId: org._id, description: 'Organization settings updated' });
  res.json(org);
}));

// ---------- Case workflow ----------
router.put('/workflow', requirePermission(PERMISSIONS.SETTINGS_MANAGE), body(z.object({
  statuses: z.array(z.object({
    key: z.string().min(1).max(60), label: z.string().min(1).max(80), order: z.coerce.number().int(),
    active: z.coerce.boolean(), terminal: z.coerce.boolean().optional(),
  })).min(3).max(30),
})), asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.organizationId);
  const keys = req.body.statuses.map((s) => s.key);
  if (new Set(keys).size !== keys.length) throw ApiError.badRequest('Workflow status keys must be unique.');
  // Require canonical statuses so system logic (active/terminal) keeps working
  const required = ['APPROVED', 'REFUSED', 'CLOSED'];
  const missing = required.filter((k) => !keys.includes(k));
  if (missing.length) throw ApiError.badRequest(`Workflow must keep the terminal statuses: ${missing.join(', ')}`);
  org.settings.caseWorkflow = req.body.statuses;
  await org.save();
  await audit(req, 'workflow.updated', { description: 'Case workflow customized' });
  res.json(org.settings.caseWorkflow);
}));

router.get('/workflow', requirePermission(PERMISSIONS.SETTINGS_VIEW), asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.organizationId).select('settings.caseWorkflow').lean();
  res.json(org?.settings?.caseWorkflow?.length ? org.settings.caseWorkflow : CASE_STATUSES);
}));

// ---------- Team ----------
const teamQuery = paginationSchema.extend({ status: z.string().optional(), role: z.string().optional() });

router.get('/team', requirePermission(PERMISSIONS.TEAM_VIEW), query(teamQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.status) filter.status = q.status;
  if (q.role) filter.role = q.role;
  const [members, total] = await Promise.all([
    paginate(Membership.find(filter), { page: q.page, limit: q.limit, sort: 'createdAt' }).populate('userId', 'name email phone status lastLoginAt createdAt').lean(),
    Membership.countDocuments(filter),
  ]);
  const data = members.filter((m) => m.userId).map((m) => ({
    _id: m._id, role: m.role, roleLabel: ROLE_LABELS[m.role], status: m.status, title: m.title,
    user: { id: m.userId._id, name: m.userId.name, email: m.userId.email, phone: m.userId.phone, userStatus: m.userId.status, lastLoginAt: m.userId.lastLoginAt, joinedAt: m.userId.createdAt },
    permissions: effectivePermissions(m.role, req.org.settings?.roleOverrides),
    createdAt: m.createdAt,
  })).filter((m) => !q.q || m.user.name.toLowerCase().includes(q.q.toLowerCase()) || m.user.email.includes(q.q.toLowerCase()));
  res.json({ data, meta: pageMeta(total, q.page, q.limit) });
}));

router.post('/team/invite', requirePermission(PERMISSIONS.TEAM_MANAGE), body(z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(INVITABLE_ROLES),
  title: z.string().trim().max(100).optional(),
})), asyncHandler(async (req, res) => {
  const member = await Membership.findOne({ organizationId: req.organizationId, role: 'OWNER' });
  if (req.body.email === req.user.email) throw ApiError.badRequest('You cannot invite yourself.');
  const existingUser = await User.findOne({ email: req.body.email });
  if (existingUser) {
    const already = await Membership.findOne({ organizationId: req.organizationId, userId: existingUser._id });
    if (already) throw ApiError.conflict(already.status === 'DISABLED' ? 'This person was removed from your team. Re-activate them instead.' : 'This person is already a team member.');
  }
  await enforceSeatLimit(req.organizationId);

  const inviteToken = randomToken(32);
  const org = await Organization.findById(req.organizationId);
  let user = existingUser;
  let tempPassword = null;
  if (!user) {
    tempPassword = `IF-${randomToken(3)}${Math.floor(100 + Math.random() * 900)}`;
    user = await User.create({
      name: req.body.name, email: req.body.email,
      passwordHash: await hashPw(tempPassword), role: 'ORG_USER', status: 'INVITED',
    });
  }
  const membership = await Membership.create({
    organizationId: req.organizationId, userId: user._id, role: req.body.role, title: req.body.title,
    status: 'INVITED', invitedBy: req.user._id,
    inviteTokenHash: hashToken(inviteToken), inviteExpires: new Date(Date.now() + 7 * 86400000),
  });

  const acceptUrl = `${env.APP_URL}/accept-invite?token=${inviteToken}${tempPassword ? `&email=${encodeURIComponent(user.email)}` : ''}`;
  const mail = await sendMail({
    to: user.email,
    subject: `You're invited to ${org.name} on ImmigrationFlow`,
    html: baseEmailHtml('Team invitation', `<p>Hi ${req.body.name},</p><p>${req.user.name} invited you to join <strong>${org.name}</strong> as ${ROLE_LABELS[req.body.role]}.</p>${tempPassword ? `<p style="background:#F7F9FC;border:1px solid #E5E7EB;border-radius:8px;padding:12px"><strong>Email:</strong> ${user.email}<br/><strong>Temporary password:</strong> ${tempPassword}</p>` : ''}<p><a href="${acceptUrl}" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Accept invitation</a></p><p style="color:#667085;font-size:12px">This invitation expires in 7 days.</p>`),
  });
  await audit(req, 'team.invited', { entityType: 'Membership', entityId: membership._id, description: `Invited ${user.email} as ${ROLE_LABELS[req.body.role]}` });
  res.status(201).json({
    membership: { id: membership._id, role: membership.role, status: membership.status },
    emailSent: mail.sent,
    inviteUrl: mail.sent ? undefined : acceptUrl,
    temporaryPassword: mail.sent ? undefined : tempPassword,
  });
}));

router.patch('/team/:id', requirePermission(PERMISSIONS.TEAM_MANAGE), body(z.object({
  role: z.enum(ORG_ROLES).optional(), status: z.enum(['ACTIVE', 'DISABLED']).optional(), title: z.string().max(100).optional(),
})), asyncHandler(async (req, res) => {
  const membership = await Membership.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!membership) throw ApiError.notFound('Team member not found');
  if (membership.role === 'OWNER') throw ApiError.forbidden('The organization owner cannot be modified here.');
  if (req.body.role === 'OWNER') throw ApiError.forbidden('Ownership transfer is not available. Contact support.');
  if (String(membership.userId) === String(req.user._id) && req.body.role && req.body.role !== req.membership.role) throw ApiError.badRequest('You cannot change your own role.');
  if (req.body.role) membership.role = req.body.role;
  if (req.body.status) membership.status = req.body.status;
  if (req.body.title !== undefined) membership.title = req.body.title;
  await membership.save();
  await audit(req, 'team.member_updated', { entityType: 'Membership', entityId: membership._id, description: `Team member updated: ${req.body.role || ''} ${req.body.status || ''}`.trim() });
  res.json(membership);
}));

router.delete('/team/:id', requirePermission(PERMISSIONS.TEAM_MANAGE), asyncHandler(async (req, res) => {
  const membership = await Membership.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!membership) throw ApiError.notFound('Team member not found');
  if (membership.role === 'OWNER') throw ApiError.forbidden('The organization owner cannot be removed.');
  if (String(membership.userId) === String(req.user._id)) throw ApiError.badRequest('You cannot remove yourself.');
  membership.status = 'DISABLED';
  await membership.save();
  await AuditLog.create({ organizationId: req.organizationId, actorId: req.user._id, actorName: req.user.name, action: 'team.member_removed', entityType: 'Membership', entityId: membership._id, description: 'Team member deactivated' });
  res.json({ ok: true });
}));

// ---------- Roles & permissions ----------
router.get('/roles', requirePermission(PERMISSIONS.SETTINGS_VIEW), asyncHandler(async (req, res) => {
  const overrides = req.org.settings?.roleOverrides || {};
  res.json({
    roles: ORG_ROLES.filter((r) => r !== 'OWNER').map((role) => ({
      role, label: ROLE_LABELS[role],
      base: ROLE_PERMISSIONS[role],
      overrides: overrides[role] || {},
      effective: effectivePermissions(role, overrides),
    })),
  });
}));

router.put('/roles/:role', requirePermission(PERMISSIONS.ROLES_MANAGE), body(z.object({
  grants: z.array(z.string()).max(100).optional(),
  revokes: z.array(z.string()).max(100).optional(),
})), asyncHandler(async (req, res) => {
  const { role } = req.params;
  if (!ORG_ROLES.includes(role) || role === 'OWNER') throw ApiError.badRequest('This role cannot be customized.');
  const org = await Organization.findById(req.organizationId);
  const overrides = org.settings.roleOverrides || {};
  overrides[role] = { grants: req.body.grants || [], revokes: req.body.revokes || [] };
  org.settings.roleOverrides = overrides;
  await org.save();
  await audit(req, 'roles.updated', { description: `Permissions updated for ${ROLE_LABELS[role]}` });
  res.json({ role, effective: effectivePermissions(role, overrides) });
}));

// ---------- Audit logs ----------
router.get('/audit-logs', requirePermission(PERMISSIONS.AUDIT_VIEW), query(paginationSchema.extend({
  action: z.string().optional(), actorId: z.string().optional(), entityType: z.string().optional(), from: z.string().optional(), to: z.string().optional(),
})), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.action) filter.action = new RegExp(`^${escapeRegex(q.action)}`);
  if (q.actorId) filter.actorId = q.actorId;
  if (q.entityType) filter.entityType = q.entityType;
  if (q.from || q.to) { filter.createdAt = {}; if (q.from) filter.createdAt.$gte = new Date(q.from); if (q.to) filter.createdAt.$lte = new Date(q.to); }
  if (q.q) filter.$or = [{ description: new RegExp(escapeRegex(q.q), 'i') }, { actorName: new RegExp(escapeRegex(q.q), 'i') }];
  const [items, total] = await Promise.all([
    paginate(AuditLog.find(filter), { page: q.page, limit: q.limit, sort: '-createdAt' }).lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit) });
}));

// ---------- Usage & integrations status ----------
router.get('/usage', requirePermission(PERMISSIONS.BILLING_VIEW), asyncHandler(async (req, res) => {
  const summary = await usageSummary(req.organizationId);
  res.json(summary);
}));

router.get('/integrations', requirePermission(PERMISSIONS.SETTINGS_VIEW), asyncHandler(async (req, res) => {
  res.json({
    email: { ...mailerStatus(), editable: false },
    whatsapp: { ...whatsappStatus(), editable: false },
    ai: { ...aiStatus(), planEnabled: Boolean(req.plan.limits.ai), editable: false },
    payments: { stripe: flags.stripe, razorpay: flags.razorpay, billingCurrency: env.BILLING_CURRENCY },
    storage: { driver: env.STORAGE_DRIVER, signedUrls: true },
    note: 'Integration credentials are managed by platform administrators through environment variables on the server. They are never stored in or sent to the browser.',
  });
}));

router.get('/constants', asyncHandler(async (req, res) => {
  res.json({ countries: COUNTRIES, businessTypes: ORG_BUSINESS_TYPES, timezones: ORG_TIMEZONES, caseStatuses: req.org.settings?.caseWorkflow?.length ? req.org.settings.caseWorkflow : CASE_STATUSES });
}));

export default router;
