import { Router } from 'express';
import { z } from 'zod';
import ImmigrationCase, { CaseTimeline } from '../models/ImmigrationCase.js';
import Client from '../models/Client.js';
import Document, { DocumentChecklist } from '../models/Document.js';
import Membership from '../models/Membership.js';
import Task from '../models/Task.js';
import Appointment from '../models/Appointment.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { CASE_STATUSES, COUNTRIES, PRIORITIES, VISA_CATEGORIES, DOC_CATEGORIES } from '../config/constants.js';
import { enforceCaseLimit } from '../services/plans.js';
import { nextReference } from '../services/references.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notifications.js';
import { emitToOrg } from '../realtime.js';

const router = Router();
router.use(requireAuth, requireOrg);

async function orgWorkflow(organizationId) {
  const { Organization } = await import('../models/Organization.js');
  const org = await Organization.findById(organizationId).select('settings.caseWorkflow').lean();
  const custom = org?.settings?.caseWorkflow;
  if (Array.isArray(custom) && custom.length) return custom;
  return CASE_STATUSES;
}
async function assertValidStatus(organizationId, status) {
  const flow = await orgWorkflow(organizationId);
  if (!flow.some((s) => s.key === status || s.status === status)) throw ApiError.badRequest('Invalid case status for this organization.');
}

async function addTimeline({ req, caseDoc, type, title, description, visibility = 'INTERNAL', metadata }) {
  const entry = await CaseTimeline.create({
    organizationId: caseDoc.organizationId, caseId: caseDoc._id, type, title, description, visibility,
    actorId: req.user?._id, actorName: req.user?.name || 'System', metadata,
  });
  emitToOrg(caseDoc.organizationId, 'case:timeline', { caseId: caseDoc._id, entry });
  return entry;
}

const createSchema = z.object({
  clientId: z.string().min(1),
  destinationCountry: z.enum(COUNTRIES.map((c) => c.code)),
  visaCategory: z.enum(VISA_CATEGORIES.map((v) => v.key)),
  title: z.string().trim().max(200).optional(),
  consultantId: z.string().nullable().optional(),
  caseManagerId: z.string().nullable().optional(),
  applicationDate: z.string().optional().or(z.literal('')),
  targetDeadline: z.string().optional().or(z.literal('')),
  priority: z.enum(PRIORITIES).optional(),
  status: z.string().optional(),
  internalNotes: z.string().max(10000).optional(),
  clientVisibleNotes: z.string().max(5000).optional(),
  checklistTemplateId: z.string().optional(),
  fees: z.object({ currency: z.enum(['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD']), agreedAmount: z.number().min(0) }).optional(),
});

const listQuery = paginationSchema.extend({
  status: z.string().optional(), priority: z.string().optional(), consultantId: z.string().optional(),
  caseManagerId: z.string().optional(), destinationCountry: z.string().optional(), visaCategory: z.string().optional(),
  clientId: z.string().optional(), deadlineWithin: z.coerce.number().optional(),
});

router.get('/', requirePermission(PERMISSIONS.CASES_VIEW), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.status) filter.status = q.status === 'ACTIVE' ? { $in: CASE_STATUSES.filter((s) => s.active).map((s) => s.key) } : q.status;
  if (q.priority) filter.priority = q.priority;
  if (q.consultantId) filter.consultantId = q.consultantId === 'unassigned' ? null : q.consultantId;
  if (q.caseManagerId) filter.caseManagerId = q.caseManagerId;
  if (q.destinationCountry) filter.destinationCountry = q.destinationCountry;
  if (q.visaCategory) filter.visaCategory = q.visaCategory;
  if (q.clientId) filter.clientId = q.clientId;
  if (q.deadlineWithin) filter.targetDeadline = { $lte: new Date(Date.now() + q.deadlineWithin * 24 * 3600 * 1000), $gte: new Date() };
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ reference: rx }, { title: rx }];
  }
  const [items, total] = await Promise.all([
    paginate(ImmigrationCase.find(filter), { page: q.page, limit: q.limit, sort: q.sort || '-createdAt' })
      .populate('clientId', 'firstName lastName reference email phone')
      .populate('consultantId', 'name')
      .populate('caseManagerId', 'name')
      .select('-internalNotes')
      .lean(),
    ImmigrationCase.countDocuments(filter),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit) });
}));

router.get('/board', requirePermission(PERMISSIONS.CASES_VIEW), asyncHandler(async (req, res) => {
  const flow = await orgWorkflow(req.organizationId);
  const docs = await ImmigrationCase.find({ organizationId: req.organizationId })
    .populate('clientId', 'firstName lastName reference')
    .populate('consultantId', 'name')
    .select('-internalNotes -documentChecklist')
    .sort('-updatedAt').limit(400).lean();
  const buckets = flow.map((s) => ({ key: s.key || s.status, label: s.label, color: s.color, items: [] }));
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
  for (const c of docs) byKey[c.status]?.items.push(c);
  res.json({ columns: buckets });
}));

router.get('/:id', requirePermission(PERMISSIONS.CASES_VIEW), asyncHandler(async (req, res) => {
  const doc = await ImmigrationCase.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('clientId', 'firstName lastName reference email phone preferredDestination')
    .populate('consultantId', 'name email')
    .populate('caseManagerId', 'name email');
  if (!doc) throw ApiError.notFound('Case not found');
  const [timeline, documents, tasks, appointments] = await Promise.all([
    CaseTimeline.find({ organizationId: req.organizationId, caseId: doc._id }).sort('-createdAt').limit(100).lean(),
    Document.find({ organizationId: req.organizationId, caseId: doc._id, deletedAt: null, isRequested: false })
      .select('name category status currentVersion versions createdAt expiryDate checklistKey verifiedAt').sort('-createdAt').lean(),
    Task.find({ organizationId: req.organizationId, relatedType: 'CASE', relatedId: doc._id }).populate('assignedToId', 'name').sort('dueAt').lean(),
    Appointment.find({ organizationId: req.organizationId, caseId: doc._id }).populate('consultantId', 'name').sort('-startAt').lean(),
  ]);
  res.json({ ...doc.toObject(), timeline, documents, tasks, appointments });
}));

router.post('/', requirePermission(PERMISSIONS.CASES_CREATE), body(createSchema), asyncHandler(async (req, res) => {
  await enforceCaseLimit(req.organizationId);
  const client = await Client.findOne({ _id: req.body.clientId, organizationId: req.organizationId });
  if (!client) throw ApiError.badRequest('Client not found in this organization.');
  if (req.body.status) {
    const flow = await orgWorkflow(req.organizationId);
    if (!flow.some((s) => (s.key || s.status) === req.body.status)) throw ApiError.badRequest('Invalid case status.');
  }
  const reference = await nextReference(req.organizationId, 'CASE');
  const payload = { ...req.body, organizationId: req.organizationId, reference, createdBy: req.user._id, consultantId: req.body.consultantId || req.user._id };
  if (req.body.applicationDate === '') delete payload.applicationDate;
  if (req.body.targetDeadline === '') delete payload.targetDeadline;

  // Apply checklist template (explicit selection → visa-category default → auto-generated from category)
  let template = null;
  if (req.body.checklistTemplateId) {
    template = await DocumentChecklist.findOne({ _id: req.body.checklistTemplateId, organizationId: req.organizationId });
  } else {
    template = await DocumentChecklist.findOne({ organizationId: req.organizationId, $or: [{ visaCategory: req.body.visaCategory }, { visaCategory: 'ALL' }], isDefault: true });
  }
  const items = template?.items?.length
    ? template.items
    : [
      { key: 'passport', label: 'Passport (bio page)', category: 'PASSPORT', required: true },
      { key: 'photograph', label: 'Recent photograph', category: 'PHOTOGRAPH', required: true },
      { key: 'financial', label: 'Proof of funds / financial documents', category: 'FINANCIAL_DOCUMENTS', required: true },
      { key: 'police', label: 'Police clearance certificate', category: 'POLICE_CLEARANCE', required: req.body.visaCategory !== 'VISITOR_VISA' },
      { key: 'medical', label: 'Medical examination report', category: 'MEDICAL_DOCUMENTS', required: ['WORK_VISA', 'PERMANENT_RESIDENCY', 'SKILLED_MIGRATION'].includes(req.body.visaCategory) },
    ];
  payload.documentChecklist = items.map((it) => ({ key: it.key, label: it.label, category: it.category, required: it.required !== false, status: 'REQUIRED' }));
  if (template) payload.checklistTemplateId = template._id;

  const doc = await ImmigrationCase.create(payload);
  await addTimeline({ req, caseDoc: doc, type: 'CREATED', title: 'Case created', description: `${reference} created for ${client.firstName} ${client.lastName || ''}`.trim() });
  await audit(req, 'case.created', { entityType: 'ImmigrationCase', entityId: doc._id, description: `Case ${reference} created` });
  const assigned = [doc.consultantId, doc.caseManagerId].filter(Boolean).map(String).filter((id) => id !== String(req.user._id));
  if (assigned.length) {
    await notify({ organizationId: req.organizationId, userIds: assigned, type: 'CASE_ASSIGNED', title: 'New case assigned', body: `${reference}: ${doc.title}`, link: `/cases/${doc._id}` });
  }
  res.status(201).json(doc);
}));

const updateSchema = createSchema.omit({ clientId: true, destinationCountry: true, visaCategory: true, checklistTemplateId: true }).partial();

router.patch('/:id', requirePermission(PERMISSIONS.CASES_UPDATE), body(updateSchema), asyncHandler(async (req, res) => {
  const doc = await ImmigrationCase.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Case not found');
  const oldConsultant = String(doc.consultantId || '');
  Object.entries(req.body).forEach(([k, v]) => {
    if (v === undefined) return;
    if (['applicationDate', 'targetDeadline'].includes(k)) doc[k] = v === '' ? undefined : v;
    else doc[k] = v;
  });
  await doc.save();
  if (String(doc.consultantId || '') !== oldConsultant && doc.consultantId) {
    await notify({ organizationId: req.organizationId, userIds: [doc.consultantId], type: 'CASE_ASSIGNED', title: 'Case assigned to you', body: `${doc.reference}: ${doc.title}`, link: `/cases/${doc._id}` });
  }
  await audit(req, 'case.updated', { entityType: 'ImmigrationCase', entityId: doc._id, description: `Case ${doc.reference} updated` });
  res.json(doc);
}));

router.patch('/:id/status', requirePermission(PERMISSIONS.CASES_WORKFLOW), body(z.object({
  status: z.string().min(1),
  note: z.string().max(2000).optional(),
  clientVisible: z.boolean().optional(),
  completionReason: z.string().max(500).optional(),
})), asyncHandler(async (req, res) => {
  const doc = await ImmigrationCase.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Case not found');
  await assertValidStatus(req.organizationId, req.body.status);
  if (doc.status === req.body.status) throw ApiError.badRequest('Case is already in this status.');
  const from = doc.status;
  const flow = await orgWorkflow(req.organizationId);
  const target = flow.find((s) => (s.key || s.status) === req.body.status);
  doc.status = req.body.status;
  doc.statusChangedAt = new Date();
  if (target?.terminal) { doc.closedAt = new Date(); if (req.body.completionReason) doc.completionReason = req.body.completionReason; }
  await doc.save();
  await addTimeline({
    req, caseDoc: doc, type: 'STATUS_CHANGE', visibility: req.body.clientVisible ? 'CLIENT' : 'INTERNAL',
    title: `Status changed to ${target?.label || req.body.status}`,
    description: req.body.note || `Previous status: ${CASE_STATUSES.find((s) => s.key === from)?.label || from}`,
  });
  await audit(req, 'case.status_changed', { entityType: 'ImmigrationCase', entityId: doc._id, description: `${doc.reference}: ${from} → ${doc.status}`, metadata: { from, to: doc.status } });
  const watchers = [...new Set([doc.consultantId, doc.caseManagerId].filter(Boolean).map(String))].filter((id) => id !== String(req.user._id));
  if (watchers.length) await notify({ organizationId: req.organizationId, userIds: watchers, type: 'CASE_STATUS_CHANGED', title: 'Case status updated', body: `${doc.reference} → ${target?.label || req.body.status}`, link: `/cases/${doc._id}` });
  emitToOrg(req.organizationId, 'case:updated', { id: doc._id, status: doc.status });
  res.json(doc);
}));

router.post('/:id/timeline', requirePermission(PERMISSIONS.CASES_UPDATE), body(z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(3000).optional(),
  visibility: z.enum(['INTERNAL', 'CLIENT']).default('INTERNAL'),
  type: z.enum(['NOTE', 'CLIENT_UPDATE', 'DEADLINE']).default('NOTE'),
})), asyncHandler(async (req, res) => {
  const doc = await ImmigrationCase.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Case not found');
  const entry = await addTimeline({ req, caseDoc: doc, type: req.body.type, title: req.body.title, description: req.body.description, visibility: req.body.visibility });
  res.status(201).json(entry);
}));

// ---------- Checklist ----------
router.patch('/:id/checklist/:key', requirePermission(PERMISSIONS.CASES_UPDATE), body(z.object({
  status: z.enum(['REQUIRED', 'UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'WAIVED']).optional(),
  comments: z.string().max(1000).optional(),
  required: z.boolean().optional(),
  documentId: z.string().nullable().optional(),
})), asyncHandler(async (req, res) => {
  const doc = await ImmigrationCase.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Case not found');
  const item = doc.documentChecklist.find((i) => i.key === req.params.key);
  if (!item) throw ApiError.notFound('Checklist item not found');
  const prev = item.status;
  if (req.body.status) item.status = req.body.status;
  if (req.body.comments !== undefined) item.comments = req.body.comments;
  if (req.body.required !== undefined) item.required = req.body.required;
  if (req.body.documentId !== undefined) item.documentId = req.body.documentId || undefined;
  if (req.body.status === 'VERIFIED') { item.verifiedBy = req.user._id; item.verifiedAt = new Date(); }
  await doc.save();
  if (req.body.status && prev !== item.status) {
    await addTimeline({ req, caseDoc: doc, type: 'DOCUMENT', title: `Checklist: ${item.label} → ${item.status}`, visibility: 'INTERNAL' });
  }
  res.json(doc.documentChecklist);
}));

// ---------- Delete ----------
router.delete('/:id', requirePermission(PERMISSIONS.CASES_DELETE), asyncHandler(async (req, res) => {
  const doc = await ImmigrationCase.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Case not found');
  const docCount = await Document.countDocuments({ organizationId: req.organizationId, caseId: doc._id, deletedAt: null });
  if (docCount > 0) throw ApiError.badRequest('This case has documents. Set the case to Withdrawn or Closed instead of deleting it.');
  await CaseTimeline.deleteMany({ organizationId: req.organizationId, caseId: doc._id });
  await doc.deleteOne();
  await audit(req, 'case.deleted', { entityType: 'ImmigrationCase', entityId: doc._id, description: `Case ${doc.reference} deleted` });
  res.json({ ok: true });
}));

export default router;
