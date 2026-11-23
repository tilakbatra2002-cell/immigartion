import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import Client, { FamilyMember } from '../models/Client.js';
import User from '../models/User.js';
import ImmigrationCase from '../models/ImmigrationCase.js';
import Document from '../models/Document.js';
import Invoice from '../models/Invoice.js';
import Appointment from '../models/Appointment.js';
import Membership from '../models/Membership.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { COUNTRIES, RESIDENCE_COUNTRIES } from '../config/constants.js';
import { nextReference } from '../services/references.js';
import { encryptField, decryptField } from '../services/crypto.js';
import { hashPassword, assertPasswordPolicy } from '../utils/password.js';
import { audit } from '../services/audit.js';
import { sendMail, baseEmailHtml } from '../services/mailer.js';
import { assertFeature, getAccess } from '../services/plans.js';
import { hashToken, randomToken } from '../utils/tokens.js';
import env from '../config/env.js';

const router = Router();
router.use(requireAuth, requireOrg);

const clientBody = z.object({
  type: z.enum(['INDIVIDUAL', 'FAMILY']).optional(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal('')),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  whatsappOptIn: z.boolean().optional(),
  dateOfBirth: z.string().optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  nationality: z.string().trim().max(60).optional(),
  currentCountry: z.enum([...RESIDENCE_COUNTRIES.map((c) => c.code), '']).optional(),
  city: z.string().trim().max(100).optional(),
  address: z.string().trim().max(400).optional(),
  preferredDestination: z.enum([...COUNTRIES.map((c) => c.code), '']).optional(),
  assignedConsultantId: z.string().nullable().optional(),
  tags: z.array(z.string().trim().max(40)).max(10).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).optional(),
  passportNumber: z.string().trim().max(40).optional().or(z.literal('')),
  passportExpiry: z.string().optional().or(z.literal('')),
  passportIssuingCountry: z.enum([...RESIDENCE_COUNTRIES.map((c) => c.code), '']).optional(),
});

/** Strip/transform sensitive fields. Passport is only decrypted when explicitly requested with permission. */
function serializeClient(doc, { includeSensitive = false } = {}) {
  if (!doc) return doc;
  const obj = doc.toObject ? doc.toObject({ virtuals: true }) : { ...doc };
  delete obj.passportNumberEnc;
  if (includeSensitive) {
    obj.passportNumber = decryptField(doc.passportNumberEnc);
    obj.passportExpiry = doc.passportExpiry;
    obj.passportIssuingCountry = doc.passportIssuingCountry;
  }
  delete obj.portalAccess?.userId;
  return obj;
}

const listQuery = paginationSchema.extend({
  status: z.string().optional(), assignedConsultantId: z.string().optional(),
  preferredDestination: z.string().optional(), type: z.string().optional(),
});

router.get('/', requirePermission(PERMISSIONS.CLIENTS_VIEW), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.status) filter.status = q.status;
  if (q.assignedConsultantId) filter.assignedConsultantId = q.assignedConsultantId === 'unassigned' ? null : q.assignedConsultantId;
  if (q.preferredDestination) filter.preferredDestination = q.preferredDestination;
  if (q.type) filter.type = q.type;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { phone: rx }, { reference: rx }];
  }
  const [items, total] = await Promise.all([
    paginate(Client.find(filter).select('-passportNumberEnc'), { page: q.page, limit: q.limit, sort: q.sort || '-createdAt' })
      .populate('assignedConsultantId', 'name').lean(),
    Client.countDocuments(filter),
  ]);
  res.json({ data: items.map((c) => serializeClient(c)), meta: pageMeta(total, q.page, q.limit) });
}));

router.get('/:id', requirePermission(PERMISSIONS.CLIENTS_VIEW), asyncHandler(async (req, res) => {
  const doc = await Client.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .select('+passportNumberEnc +passportExpiry +passportIssuingCountry')
    .populate('assignedConsultantId', 'name email');
  if (!doc) throw ApiError.notFound('Client not found');
  const includeSensitive = req.permissions.includes('*') || req.permissions.includes(PERMISSIONS.CLIENTS_SENSITIVE);
  const [family, cases, docs, invoices, appointments] = await Promise.all([
    FamilyMember.find({ organizationId: req.organizationId, clientId: doc._id }).sort('createdAt').lean(),
    ImmigrationCase.find({ organizationId: req.organizationId, clientId: doc._id }).select('reference title status visaCategory destinationCountry targetDeadline priority').sort('-createdAt').lean(),
    Document.find({ organizationId: req.organizationId, clientId: doc._id, deletedAt: null }).select('name category status versions createdAt expiryDate').sort('-createdAt').limit(50).lean(),
    Invoice.find({ organizationId: req.organizationId, clientId: doc._id }).select('invoiceNumber type total amountPaid balance status currency dueDate issueDate').sort('-createdAt').limit(50).lean(),
    Appointment.find({ organizationId: req.organizationId, clientId: doc._id }).select('title type startAt endAt status consultantId').populate('consultantId', 'name').sort('-startAt').limit(10).lean(),
  ]);
  await audit(req, includeSensitive ? 'client.viewed_sensitive' : 'client.viewed', { entityType: 'Client', entityId: doc._id, description: `Viewed client ${doc.reference}` });
  res.json({ ...serializeClient(doc, { includeSensitive }), family, cases, documents: docs, invoices, appointments });
}));

router.post('/', requirePermission(PERMISSIONS.CLIENTS_CREATE), body(clientBody), asyncHandler(async (req, res) => {
  const { passportNumber, passportExpiry, ...rest } = req.body;
  if (rest.assignedConsultantId) {
    const m = await Membership.findOne({ organizationId: req.organizationId, userId: rest.assignedConsultantId, status: 'ACTIVE' });
    if (!m) throw ApiError.badRequest('Assigned consultant is not an active team member.');
  }
  const reference = await nextReference(req.organizationId, 'CLIENT');
  const payload = { ...rest, organizationId: req.organizationId, reference, createdBy: req.user._id };
  if (rest.dateOfBirth === '') delete payload.dateOfBirth;
  if (passportNumber) {
    if (!req.permissions.includes(PERMISSIONS.CLIENTS_SENSITIVE) && !req.permissions.includes('*')) throw ApiError.forbidden('You do not have permission to store passport data.');
    payload.passportNumberEnc = encryptField(passportNumber);
    if (passportExpiry) payload.passportExpiry = new Date(passportExpiry);
  }
  const doc = await Client.create(payload);
  await audit(req, 'client.created', { entityType: 'Client', entityId: doc._id, description: `Client ${doc.reference} created` });
  res.status(201).json(serializeClient(doc));
}));

router.patch('/:id', requirePermission(PERMISSIONS.CLIENTS_UPDATE), body(clientBody.partial()), asyncHandler(async (req, res) => {
  const doc = await Client.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Client not found');
  const { passportNumber, passportExpiry, ...rest } = req.body;
  Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) doc[k] = v === '' && k === 'dateOfBirth' ? undefined : v; });
  if (passportNumber !== undefined) {
    if (!req.permissions.includes(PERMISSIONS.CLIENTS_SENSITIVE) && !req.permissions.includes('*')) throw ApiError.forbidden('You do not have permission to change passport data.');
    doc.passportNumberEnc = passportNumber ? encryptField(passportNumber) : '';
    if (passportNumber) await audit(req, 'client.passport_updated', { entityType: 'Client', entityId: doc._id, description: 'Passport details updated' });
  }
  if (passportExpiry !== undefined) doc.passportExpiry = passportExpiry ? new Date(passportExpiry) : undefined;
  await doc.save();
  await audit(req, 'client.updated', { entityType: 'Client', entityId: doc._id, description: `Client ${doc.reference} updated` });
  res.json(serializeClient(doc));
}));

router.delete('/:id', requirePermission(PERMISSIONS.CLIENTS_DELETE), asyncHandler(async (req, res) => {
  const doc = await Client.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Client not found');
  const openCases = await ImmigrationCase.countDocuments({ organizationId: req.organizationId, clientId: doc._id, status: { $nin: ['APPROVED', 'REFUSED', 'WITHDRAWN', 'CLOSED'] } });
  if (openCases > 0) throw ApiError.badRequest('This client has open cases. Close or reassign them before deleting the client.');
  doc.status = 'ARCHIVED';
  await doc.save();
  await audit(req, 'client.archived', { entityType: 'Client', entityId: doc._id, description: `Client ${doc.reference} archived` });
  res.json({ ok: true, archived: true });
}));

// ---------- Family members ----------
const familyBody = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.enum(['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER']),
  dateOfBirth: z.string().optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER', '']).optional(),
  nationality: z.string().trim().max(60).optional(),
  dependent: z.boolean().optional(),
  passportNumber: z.string().trim().max(40).optional().or(z.literal('')),
  passportExpiry: z.string().optional().or(z.literal('')),
});

router.post('/:id/family', requirePermission(PERMISSIONS.CLIENTS_UPDATE), body(familyBody), asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!client) throw ApiError.notFound('Client not found');
  const { passportNumber, passportExpiry, ...rest } = req.body;
  const payload = { ...rest, organizationId: req.organizationId, clientId: client._id };
  if (passportNumber) payload.passportNumberEnc = encryptField(passportNumber);
  if (passportExpiry) payload.passportExpiry = new Date(passportExpiry);
  const fm = await FamilyMember.create(payload);
  if (client.type === 'INDIVIDUAL') { client.type = 'FAMILY'; await client.save(); }
  const obj = fm.toObject(); delete obj.passportNumberEnc;
  res.status(201).json(obj);
}));

router.patch('/:id/family/:memberId', requirePermission(PERMISSIONS.CLIENTS_UPDATE), body(familyBody.partial()), asyncHandler(async (req, res) => {
  const fm = await FamilyMember.findOne({ _id: req.params.memberId, clientId: req.params.id, organizationId: req.organizationId });
  if (!fm) throw ApiError.notFound('Family member not found');
  const { passportNumber, passportExpiry, ...rest } = req.body;
  Object.assign(fm, rest);
  if (passportNumber !== undefined) fm.passportNumberEnc = passportNumber ? encryptField(passportNumber) : '';
  if (passportExpiry !== undefined) fm.passportExpiry = passportExpiry ? new Date(passportExpiry) : undefined;
  await fm.save();
  const obj = fm.toObject(); delete obj.passportNumberEnc;
  res.json(obj);
}));

router.delete('/:id/family/:memberId', requirePermission(PERMISSIONS.CLIENTS_UPDATE), asyncHandler(async (req, res) => {
  const fm = await FamilyMember.findOneAndDelete({ _id: req.params.memberId, clientId: req.params.id, organizationId: req.organizationId });
  if (!fm) throw ApiError.notFound('Family member not found');
  res.json({ ok: true });
}));

// ---------- Portal access ----------
router.post('/:id/portal-access', requirePermission(PERMISSIONS.CLIENTS_UPDATE), asyncHandler(async (req, res) => {
  await assertFeature(req.organizationId, 'clientPortal', 'Client portal');
  const client = await Client.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!client) throw ApiError.notFound('Client not found');
  if (!client.email) throw ApiError.badRequest('Add an email address to this client before enabling portal access.');
  if (client.portalAccess?.enabled) throw ApiError.conflict('Portal access is already enabled for this client.');

  const tempPassword = `IF-${randomToken(4)}${Math.floor(10 + Math.random() * 89)}`;
  const displayName = [client.firstName, client.lastName].filter(Boolean).join(' ');

  // Re-enabling after a revoke must reuse the existing (disabled) login instead of
  // failing on the unique email index — otherwise portal access can never be restored.
  let user = client.portalAccess?.userId ? await User.findById(client.portalAccess.userId) : null;
  if (!user) user = await User.findOne({ email: client.email, role: 'CLIENT' });
  if (user && user.role !== 'CLIENT') {
    throw ApiError.conflict('This email belongs to a staff account. Use a different client email for portal access.');
  }
  if (user) {
    user.name = displayName;
    user.phone = client.phone || user.phone;
    user.passwordHash = await hashPassword(tempPassword);
    user.status = 'ACTIVE';
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
  } else {
    user = new User({
      name: displayName,
      email: client.email,
      phone: client.phone,
      passwordHash: await hashPassword(tempPassword),
      role: 'CLIENT',
      status: 'ACTIVE',
    });
  }
  const resetToken = randomToken(32);
  user.passwordResetTokenHash = hashToken(resetToken);
  user.passwordResetExpires = new Date(Date.now() + 72 * 3600 * 1000);
  await user.save();
  client.portalAccess = { enabled: true, userId: user._id, invitedAt: new Date() };
  await client.save();

  const url = `${env.APP_URL}/portal/login`;
  const mail = await sendMail({
    to: client.email,
    subject: 'Your client portal access — ImmigrationFlow',
    html: baseEmailHtml('Client portal access', `
      <p>Hello ${client.firstName},</p>
      <p>Your consultant has enabled client portal access for your account.</p>
      <p style="background:#F7F9FC;border:1px solid #E5E7EB;border-radius:8px;padding:12px">
        <strong>Email:</strong> ${client.email}<br/>
        <strong>Temporary password:</strong> ${tempPassword}
      </p>
      <p><a href="${url}" style="background:#2563EB;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Open client portal</a></p>
      <p style="color:#667085;font-size:12px">Please change your password after signing in.</p>`),
  });
  await audit(req, 'client.portal_enabled', { entityType: 'Client', entityId: client._id, description: `Portal access enabled for ${client.reference}` });

  // Return the temp password ONLY when email is not configured, so the consultant can relay it manually.
  res.status(201).json({ message: mail.sent ? 'Portal access created and credentials emailed to the client.' : 'Portal access created. Email is not configured — share these credentials securely.', emailSent: mail.sent, ...(mail.sent ? {} : { temporaryPassword: tempPassword, portalUrl: url }) });
}));

router.delete('/:id/portal-access', requirePermission(PERMISSIONS.CLIENTS_UPDATE), asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!client) throw ApiError.notFound('Client not found');
  if (client.portalAccess?.userId) {
    await User.updateOne({ _id: client.portalAccess.userId }, { status: 'DISABLED' });
  }
  client.portalAccess = { enabled: false };
  await client.save();
  await audit(req, 'client.portal_disabled', { entityType: 'Client', entityId: client._id, description: `Portal access revoked for ${client.reference}` });
  res.json({ ok: true });
}));

export default router;
