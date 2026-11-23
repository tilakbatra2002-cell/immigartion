import { Router } from 'express';
import { z } from 'zod';
import Appointment from '../models/Appointment.js';
import Client from '../models/Client.js';
import Lead from '../models/Lead.js';
import ImmigrationCase, { CaseTimeline } from '../models/ImmigrationCase.js';
import Membership from '../models/Membership.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema } from '../utils/pagination.js';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '../config/constants.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notifications.js';

const router = Router();
router.use(requireAuth, requireOrg);

const apptBody = z.object({
  title: z.string().trim().max(200).optional(),
  type: z.enum(APPOINTMENT_TYPES).optional(),
  clientId: z.string().nullable().optional(),
  leadId: z.string().nullable().optional(),
  caseId: z.string().nullable().optional(),
  consultantId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().max(60).optional(),
  location: z.string().max(300).optional(),
  meetingLink: z.string().url().max(500).optional().or(z.literal('')),
  notes: z.string().max(3000).optional(),
  reminderMinutes: z.number().int().min(0).max(10080).optional(),
});

async function validateRefs(req, b) {
  if (b.consultantId) {
    const m = await Membership.findOne({ organizationId: req.organizationId, userId: b.consultantId, status: 'ACTIVE' });
    if (!m) throw ApiError.badRequest('Consultant is not an active team member.');
  }
  if (b.clientId && !(await Client.exists({ _id: b.clientId, organizationId: req.organizationId }))) throw ApiError.badRequest('Client not found.');
  if (b.leadId && !(await Lead.exists({ _id: b.leadId, organizationId: req.organizationId }))) throw ApiError.badRequest('Lead not found.');
  if (b.caseId && !(await ImmigrationCase.exists({ _id: b.caseId, organizationId: req.organizationId }))) throw ApiError.badRequest('Case not found.');
  if (new Date(b.endAt) <= new Date(b.startAt)) throw ApiError.badRequest('End time must be after the start time.');
}

const listQuery = paginationSchema.extend({
  status: z.string().optional(), consultantId: z.string().optional(), clientId: z.string().optional(),
  from: z.string().optional(), to: z.string().optional(), type: z.string().optional(),
});

router.get('/', requirePermission(PERMISSIONS.APPT_VIEW), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.consultantId) filter.consultantId = q.consultantId;
  if (q.clientId) filter.clientId = q.clientId;
  if (q.from || q.to) {
    filter.startAt = {};
    if (q.from) filter.startAt.$gte = new Date(q.from);
    if (q.to) filter.startAt.$lte = new Date(q.to);
  }
  const [items, total] = await Promise.all([
    paginate(Appointment.find(filter).populate('clientId', 'firstName lastName reference').populate('leadId', 'fullName').populate('caseId', 'reference title').populate('consultantId', 'name'),
      { page: q.page, limit: q.limit, sort: q.sort || 'startAt' }).lean(),
    Appointment.countDocuments(filter),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit) });
}));

router.get('/:id', requirePermission(PERMISSIONS.APPT_VIEW), asyncHandler(async (req, res) => {
  const doc = await Appointment.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('clientId', 'firstName lastName reference').populate('caseId', 'reference title').populate('leadId', 'fullName').populate('consultantId', 'name email').lean();
  if (!doc) throw ApiError.notFound('Appointment not found');
  res.json(doc);
}));

router.post('/', requirePermission(PERMISSIONS.APPT_MANAGE), body(apptBody), asyncHandler(async (req, res) => {
  await validateRefs(req, req.body);
  const doc = await Appointment.create({
    ...req.body, meetingLink: req.body.meetingLink || undefined,
    organizationId: req.organizationId, createdBy: req.user._id,
  });
  await audit(req, 'appointment.created', { entityType: 'Appointment', entityId: doc._id, description: `Appointment "${doc.title || doc.type}" scheduled` });
  if (String(doc.consultantId) !== String(req.user._id)) {
    await notify({ organizationId: req.organizationId, userIds: [doc.consultantId], type: 'APPOINTMENT_REMINDER', title: 'New appointment assigned', body: `${doc.title || doc.type} on ${new Date(doc.startAt).toLocaleString('en-IN', { timeZone: req.org.settings?.timezone || 'Asia/Kolkata' })}`, link: '/appointments' });
  }
  if (doc.caseId) await CaseTimeline.create({ organizationId: req.organizationId, caseId: doc.caseId, type: 'APPOINTMENT', title: 'Appointment scheduled', description: doc.title, actorId: req.user._id, actorName: req.user.name });
  res.status(201).json(doc);
}));

router.patch('/:id', requirePermission(PERMISSIONS.APPT_MANAGE), body(apptBody.partial().extend({ reason: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
  const doc = await Appointment.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Appointment not found');
  if (['CANCELLED', 'COMPLETED'].includes(doc.status)) throw ApiError.badRequest('Cannot edit a cancelled or completed appointment.');
  if (req.body.startAt || req.body.consultantId) {
    const check = { ...doc.toObject(), ...req.body };
    await validateRefs(req, check);
  }
  const oldStart = doc.startAt;
  Object.entries(req.body).forEach(([k, v]) => { if (v !== undefined && k !== 'reason') doc[k] = v === '' && k === 'meetingLink' ? undefined : v; });
  if (req.body.startAt && new Date(req.body.startAt).getTime() !== new Date(oldStart).getTime()) {
    doc.status = 'RESCHEDULED';
    doc.rescheduleHistory.push({ from: oldStart, to: new Date(req.body.startAt), by: req.user._id, reason: req.body.reason || 'Rescheduled' });
    doc.reminderSentAt = undefined;
  }
  await doc.save();
  await audit(req, 'appointment.updated', { entityType: 'Appointment', entityId: doc._id, description: `Appointment updated` });
  res.json(doc);
}));

router.patch('/:id/status', requirePermission(PERMISSIONS.APPT_MANAGE), body(z.object({
  status: z.enum(APPOINTMENT_STATUSES), cancelReason: z.string().max(500).optional(),
})), asyncHandler(async (req, res) => {
  const doc = await Appointment.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Appointment not found');
  doc.status = req.body.status;
  if (req.body.status === 'CANCELLED') { doc.cancelReason = req.body.cancelReason; doc.cancelledAt = new Date(); }
  await doc.save();
  await audit(req, 'appointment.status_changed', { entityType: 'Appointment', entityId: doc._id, description: `Appointment → ${req.body.status}` });
  res.json(doc);
}));

router.delete('/:id', requirePermission(PERMISSIONS.APPT_MANAGE), asyncHandler(async (req, res) => {
  const doc = await Appointment.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Appointment not found');
  await audit(req, 'appointment.deleted', { entityType: 'Appointment', entityId: doc._id, description: 'Appointment deleted' });
  res.json({ ok: true });
}));

export default router;
