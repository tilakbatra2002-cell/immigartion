import { Router } from 'express';
import { z } from 'zod';
import Lead from '../models/Lead.js';
import User from '../models/User.js';
import Client from '../models/Client.js';
import Membership from '../models/Membership.js';
import Appointment from '../models/Appointment.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body, query, parse } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { CONVERTIBLE_LEAD_STATUSES, COUNTRIES, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, VISA_CATEGORIES } from '../config/constants.js';
import { enforceLeadLimit } from '../services/plans.js';
import { nextReference } from '../services/references.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notifications.js';
import { emitToOrg } from '../realtime.js';
import { encryptField } from '../services/crypto.js';

const router = Router();
router.use(requireAuth, requireOrg);

const leadBody = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  countryOfResidence: z.string().trim().max(60).optional(),
  destinationCountry: z.enum([...COUNTRIES.map((c) => c.code), '']).optional(),
  visaCategory: z.enum([...VISA_CATEGORIES.map((v) => v.key), '']).optional(),
  leadSource: z.enum(LEAD_SOURCES).optional(),
  assignedToId: z.string().nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(LEAD_STATUSES.map((s) => s.key)).optional(),
  notes: z.string().max(5000).optional().or(z.literal('')),
  followUpAt: z.string().datetime().nullable().optional().or(z.literal('')),
});

const buildFilter = (orgId, q) => {
  const f = { organizationId: orgId };
  if (q.status) f.status = q.status;
  if (q.priority) f.priority = q.priority;
  if (q.source) f.leadSource = q.source;
  if (q.assignedToId) f.assignedToId = q.assignedToId === 'unassigned' ? null : q.assignedToId;
  if (q.destinationCountry) f.destinationCountry = q.destinationCountry;
  if (q.visaCategory) f.visaCategory = q.visaCategory;
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    f.$or = [{ fullName: rx }, { email: rx }, { phone: rx }, { notes: rx }];
  }
  return f;
};

const listQuery = paginationSchema.extend({
  status: z.string().optional(), priority: z.string().optional(), source: z.string().optional(),
  assignedToId: z.string().optional(), destinationCountry: z.string().optional(), visaCategory: z.string().optional(),
});

router.get('/', requirePermission(PERMISSIONS.LEADS_VIEW), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = buildFilter(req.organizationId, q);
  const [items, total] = await Promise.all([
    paginate(Lead.find(filter), { page: q.page, limit: q.limit, sort: q.sort || '-createdAt' })
      .populate('assignedToId', 'name email')
      .lean(),
    Lead.countDocuments(filter),
  ]);
  // Pipeline counts in the same response — powers Kanban without N+1 requests
  const pipeline = await Lead.aggregate([
    { $match: { organizationId: filter.organizationId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit), pipeline });
}));

router.get('/kanban', requirePermission(PERMISSIONS.LEADS_VIEW), asyncHandler(async (req, res) => {
  const q = parse(listQuery, req.query);
  const filter = buildFilter(req.organizationId, q);
  const docs = await Lead.find(filter)
    .sort(q.sort || '-createdAt').limit(500)
    .populate('assignedToId', 'name').lean();
  const buckets = Object.fromEntries(LEAD_STATUSES.map((s) => [s.key, []]));
  for (const l of docs) (buckets[l.status] || buckets.NEW).push(l);
  res.json({ buckets });
}));

router.get('/:id', requirePermission(PERMISSIONS.LEADS_VIEW), asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('assignedToId', 'name email').lean();
  if (!lead) throw ApiError.notFound('Lead not found');
  const [appointments, client] = await Promise.all([
    Appointment.find({ organizationId: req.organizationId, leadId: lead._id }).sort('-startAt').limit(10).lean(),
    lead.convertedClientId ? Client.findOne({ _id: lead.convertedClientId, organizationId: req.organizationId }).select('firstName lastName reference').lean() : null,
  ]);
  res.json({ ...lead, appointments, convertedClient: client });
}));

router.post('/', requirePermission(PERMISSIONS.LEADS_CREATE), body(leadBody), asyncHandler(async (req, res) => {
  await enforceLeadLimit(req.organizationId);
  if (req.body.assignedToId) {
    const m = await Membership.findOne({ organizationId: req.organizationId, userId: req.body.assignedToId, status: 'ACTIVE' });
    if (!m) throw ApiError.badRequest('Assigned consultant is not an active team member.');
  }
  const lead = await Lead.create({
    ...req.body,
    email: req.body.email || '',
    organizationId: req.organizationId,
    createdBy: req.user._id,
    followUpAt: req.body.followUpAt || undefined,
  });
  await audit(req, 'lead.created', { entityType: 'Lead', entityId: lead._id, description: `Lead "${lead.fullName}" created` });
  emitToOrg(req.organizationId, 'lead:created', { id: lead._id, fullName: lead.fullName });
  if (lead.assignedToId && String(lead.assignedToId) !== String(req.user._id)) {
    await notify({ organizationId: req.organizationId, userIds: [lead.assignedToId], type: 'LEAD_ASSIGNED', title: 'Lead assigned to you', body: lead.fullName, link: `/leads/${lead._id}` });
  }
  res.status(201).json(lead);
}));

router.patch('/:id', requirePermission(PERMISSIONS.LEADS_UPDATE), body(leadBody.partial()), asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!lead) throw ApiError.notFound('Lead not found');
  const oldAssignee = lead.assignedToId ? String(lead.assignedToId) : null;
  const oldStatus = lead.status;

  if (req.body.assignedToId) {
    const m = await Membership.findOne({ organizationId: req.organizationId, userId: req.body.assignedToId, status: 'ACTIVE' });
    if (!m) throw ApiError.badRequest('Assigned consultant is not an active team member.');
  }
  Object.entries(req.body).forEach(([k, v]) => {
    if (v !== undefined) lead[k] = v === '' && ['followUpAt'].includes(k) ? undefined : v;
  });
  if (req.body.followUpAt === '') lead.followUpAt = undefined;
  await lead.save();

  if (oldStatus !== lead.status) {
    await audit(req, 'lead.status_changed', { entityType: 'Lead', entityId: lead._id, description: `Lead status ${oldStatus} → ${lead.status}` });
    emitToOrg(req.organizationId, 'lead:updated', { id: lead._id, status: lead.status });
  }
  if (String(lead.assignedToId || '') !== String(oldAssignee || '') && lead.assignedToId) {
    await notify({ organizationId: req.organizationId, userIds: [lead.assignedToId], type: 'LEAD_ASSIGNED', title: 'Lead assigned to you', body: lead.fullName, link: `/leads/${lead._id}` });
  }
  res.json(lead);
}));

router.patch('/:id/status', requirePermission(PERMISSIONS.LEADS_UPDATE), body(z.object({ status: z.enum(LEAD_STATUSES.map((s) => s.key)), lostReason: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!lead) throw ApiError.notFound('Lead not found');
  if (lead.status === req.body.status) return res.json(lead);
  const from = lead.status;
  lead.status = req.body.status;
  if (req.body.status === 'LOST' && req.body.lostReason) lead.lostReason = req.body.lostReason;
  if (req.body.status === 'CONTACTED' && !lead.lastContactedAt) lead.lastContactedAt = new Date();
  await lead.save();
  await audit(req, 'lead.status_changed', { entityType: 'Lead', entityId: lead._id, description: `Lead status ${from} → ${lead.status}` });
  emitToOrg(req.organizationId, 'lead:updated', { id: lead._id, status: lead.status });
  res.json(lead);
}));

router.post('/:id/notes', requirePermission(PERMISSIONS.LEADS_UPDATE), body(z.object({ body: z.string().trim().min(1).max(4000) })), asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!lead) throw ApiError.notFound('Lead not found');
  lead.noteEntries.push({ body: req.body.body, authorId: req.user._id, authorName: req.user.name });
  await lead.save();
  res.status(201).json(lead.noteEntries[lead.noteEntries.length - 1]);
}));

router.delete('/:id/notes/:noteId', requirePermission(PERMISSIONS.LEADS_UPDATE), asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!lead) throw ApiError.notFound('Lead not found');
  lead.noteEntries.id(req.params.noteId)?.deleteOne();
  await lead.save();
  res.json({ ok: true });
}));

router.post('/:id/convert', requirePermission(PERMISSIONS.CLIENTS_CREATE), asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!lead) throw ApiError.notFound('Lead not found');
  if (lead.convertedClientId) throw ApiError.conflict('This lead has already been converted to a client.');
  if (!CONVERTIBLE_LEAD_STATUSES.includes(lead.status)) throw ApiError.badRequest('Only new, contacted, booked or qualified leads can be converted.');

  const reference = await nextReference(req.organizationId, 'CLIENT');
  const [firstName, ...rest] = lead.fullName.trim().split(/\s+/);
  const client = await Client.create({
    organizationId: req.organizationId,
    reference,
    firstName,
    lastName: rest.join(' '),
    email: lead.email,
    phone: lead.phone,
    currentCountry: '',
    preferredDestination: lead.destinationCountry || '',
    assignedConsultantId: lead.assignedToId,
    source: lead._id,
    notes: lead.notes,
    convertedFromLeadId: lead._id,
    createdBy: req.user._id,
  });
  lead.status = 'CONVERTED';
  lead.convertedClientId = client._id;
  lead.convertedAt = new Date();
  await lead.save();
  await audit(req, 'lead.converted', { entityType: 'Lead', entityId: lead._id, description: `Lead converted to client ${client.reference}` });
  emitToOrg(req.organizationId, 'lead:converted', { id: lead._id, clientId: client._id });
  res.status(201).json({ lead, client });
}));

router.delete('/:id', requirePermission(PERMISSIONS.LEADS_DELETE), asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!lead) throw ApiError.notFound('Lead not found');
  if (lead.convertedClientId) throw ApiError.badRequest('Converted leads cannot be deleted. Archive the related client instead.');
  await lead.deleteOne();
  await audit(req, 'lead.deleted', { entityType: 'Lead', entityId: lead._id, description: `Lead "${lead.fullName}" deleted` });
  res.json({ ok: true });
}));

// CSV export
router.get('/export/csv', requirePermission(PERMISSIONS.LEADS_VIEW, PERMISSIONS.LEADS_EXPORT), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = buildFilter(req.organizationId, q);
  const leads = await Lead.find(filter).sort('-createdAt').limit(5000).populate('assignedToId', 'name').lean();
  const headers = ['Full Name', 'Email', 'Phone', 'Residence', 'Destination', 'Visa Category', 'Source', 'Priority', 'Status', 'Assigned To', 'Follow-up', 'Created'];
  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const label = (arr, key) => arr.find((x) => x.key === key)?.label || key || '';
  const rows = leads.map((l) => [
    l.fullName, l.email, l.phone, l.countryOfResidence,
    COUNTRIES.find((c) => c.code === l.destinationCountry)?.name || l.destinationCountry,
    label(VISA_CATEGORIES, l.visaCategory), l.leadSource, l.priority, label(LEAD_STATUSES, l.status),
    l.assignedToId?.name || '', l.followUpAt ? new Date(l.followUpAt).toISOString().slice(0, 10) : '',
    l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '',
  ].map(csvEscape).join(','));
  const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');
  await audit(req, 'lead.exported', { description: `Exported ${leads.length} leads to CSV` });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\uFEFF' + csv);
}));

export default router;
