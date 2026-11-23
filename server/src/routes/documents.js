import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import Document, { DocumentChecklist } from '../models/Document.js';
import ImmigrationCase, { CaseTimeline } from '../models/ImmigrationCase.js';
import Client from '../models/Client.js';
import Integration from '../models/Integration.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { DOC_ALLOWED_MIME, DOC_CATEGORIES, DOC_MAX_BYTES, DOC_STATUSES, VISA_CATEGORIES } from '../config/constants.js';
import { storage, buildStorageKey, sniffMimeOk } from '../services/storage.js';
import { audit } from '../services/audit.js';
import { emitToOrg } from '../realtime.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { flags } from '../config/env.js';

const router = Router();
router.use(requireAuth, requireOrg);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOC_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!DOC_ALLOWED_MIME.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Unsupported file type. Upload PDF, JPG, PNG, WEBP, TIFF, DOC or DOCX.'));
    }
    return cb(null, true);
  },
});

const listQuery = paginationSchema.extend({
  status: z.string().optional(), category: z.string().optional(), caseId: z.string().optional(),
  clientId: z.string().optional(), checklistKey: z.string().optional(), requested: z.enum(['true', 'false']).optional(),
  expiringDays: z.coerce.number().optional(),
});

router.get('/', requirePermission(PERMISSIONS.DOCS_VIEW), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId, deletedAt: null };
  if (q.status) filter.status = q.status;
  if (q.category) filter.category = q.category;
  if (q.caseId) filter.caseId = q.caseId;
  if (q.clientId) filter.clientId = q.clientId;
  if (q.requested) filter.isRequested = q.requested === 'true';
  if (q.expiringDays) filter.expiryDate = { $lte: new Date(Date.now() + q.expiringDays * 24 * 3600 * 1000) };
  if (q.q) filter.name = new RegExp(escapeRegex(q.q), 'i');
  const [items, total] = await Promise.all([
    paginate(Document.find(filter).select('-versions.storageKey -comments'), { page: q.page, limit: q.limit, sort: q.sort || '-createdAt' })
      .populate('clientId', 'firstName lastName reference')
      .populate('caseId', 'reference title')
      .lean(),
    Document.countDocuments(filter),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit) });
}));

router.get('/:id', requirePermission(PERMISSIONS.DOCS_VIEW), asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId, deletedAt: null })
    .populate('clientId', 'firstName lastName reference')
    .populate('caseId', 'reference title')
    .lean();
  if (!doc) throw ApiError.notFound('Document not found');
  doc.versions = (doc.versions || []).map((v) => ({ _id: v._id, version: v.version, fileName: v.fileName, size: v.size, mimeType: v.mimeType, uploadedByName: v.uploadedByName, createdAt: v.createdAt }));
  res.json(doc);
}));

/** Upload a new document OR a new version of an existing one. */
router.post('/', requirePermission(PERMISSIONS.DOCS_UPLOAD), uploadLimiter, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded. Use multipart/form-data with a "file" field.');
  if (!sniffMimeOk(req.file.buffer, req.file.mimetype)) throw ApiError.badRequest('File content does not match its declared type.');

  const meta = z.object({
    name: z.string().trim().min(1).max(200),
    category: z.enum(DOC_CATEGORIES.map((d) => d.key)).optional(),
    caseId: z.string().optional(),
    clientId: z.string().optional(),
    checklistKey: z.string().max(60).optional(),
    expiryDate: z.string().optional(),
    description: z.string().max(1000).optional(),
    documentId: z.string().optional(), // when uploading a new version
    visibility: z.enum(['INTERNAL', 'CLIENT']).optional(),
  }).safeParse(req.body);
  if (!meta.success) throw ApiError.badRequest('Validation failed', Object.fromEntries(meta.error.issues.map((i) => [i.path.join('.') || '_', i.message])));
  const data = meta.data;

  let caseDoc = null;
  let clientId = data.clientId || null;
  if (data.caseId) {
    caseDoc = await ImmigrationCase.findOne({ _id: data.caseId, organizationId: req.organizationId });
    if (!caseDoc) throw ApiError.badRequest('Case not found in this organization.');
    clientId = clientId || String(caseDoc.clientId);
  }
  if (clientId) {
    const client = await Client.findOne({ _id: clientId, organizationId: req.organizationId });
    if (!client) throw ApiError.badRequest('Client not found in this organization.');
  }

  // Malware-scanning hook. Local infrastructure does not ship an AV engine; if
  // CLAMAV/scanning is configured at the platform level it must run here.
  // We record that scanning is unavailable rather than pretending it ran.
  const scanStatus = 'NOT_CONFIGURED';

  const storageKey = buildStorageKey({ organizationId: req.organizationId, scope: 'documents', fileName: req.file.originalname });
  await storage.put(storageKey, req.file.buffer, req.file.mimetype);
  const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  let doc;
  if (data.documentId) {
    doc = await Document.findOne({ _id: data.documentId, organizationId: req.organizationId, deletedAt: null });
    if (!doc) throw ApiError.notFound('Document not found');
    if (String(doc.clientId) !== String(clientId)) throw ApiError.badRequest('Client mismatch for new version.');
    const version = (doc.currentVersion || 0) + 1;
    doc.versions.push({ version, storageKey, fileName: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype, checksum, uploadedBy: req.user._id, uploadedByName: req.user.name });
    doc.currentVersion = version;
    doc.status = 'UPLOADED';
    doc.rejectionReason = undefined;
    doc.name = data.name || doc.name;
    if (data.expiryDate) doc.expiryDate = data.expiryDate ? new Date(data.expiryDate) : undefined;
    await doc.save();
  } else {
    doc = await Document.create({
      organizationId: req.organizationId, clientId, caseId: caseDoc?._id, checklistKey: data.checklistKey,
      category: data.category || 'OTHER', name: data.name, description: data.description,
      status: 'UPLOADED', currentVersion: 1, isRequested: false,
      versions: [{ version: 1, storageKey, fileName: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype, checksum, uploadedBy: req.user._id, uploadedByName: req.user.name }],
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      uploadedBy: req.user._id, uploadedByName: req.user.name,
    });
  }

  // Auto-link to case checklist item
  if (caseDoc && data.checklistKey) {
    const item = caseDoc.documentChecklist.find((i) => i.key === data.checklistKey);
    if (item) {
      item.documentId = doc._id;
      item.status = 'UPLOADED';
      await caseDoc.save();
      await CaseTimeline.create({ organizationId: req.organizationId, caseId: caseDoc._id, type: 'DOCUMENT', title: `Document uploaded: ${item.label}`, actorId: req.user._id, actorName: req.user.name, visibility: 'INTERNAL' });
    }
  }

  await audit(req, 'document.uploaded', { entityType: 'Document', entityId: doc._id, description: `Uploaded "${doc.name}" (${req.file.size} bytes)` });
  emitToOrg(req.organizationId, 'document:uploaded', { id: doc._id, name: doc.name, caseId: doc.caseId });
  res.status(201).json({ ...doc.toObject(), versions: doc.versions.map((v) => ({ _id: v._id, version: v.version, fileName: v.fileName, size: v.size, mimeType: v.mimeType, uploadedByName: v.uploadedByName, createdAt: v.createdAt })), scanStatus });
}));

/** Short-lived download URL (signed for S3, token-protected for local storage). */
router.get('/:id/download', requirePermission(PERMISSIONS.DOCS_VIEW), asyncHandler(async (req, res) => {
  const version = Number(req.query.version || 0);
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId, deletedAt: null });
  if (!doc) throw ApiError.notFound('Document not found');
  const v = version ? doc.versions.find((x) => x.version === version) : doc.versions[doc.versions.length - 1];
  if (!v) throw ApiError.notFound('No file has been uploaded for this requirement yet.');
  const url = await storage.getSignedDownloadUrl(v.storageKey, { expiresIn: 300, fileName: v.fileName });
  await audit(req, 'document.downloaded', { entityType: 'Document', entityId: doc._id, description: `Downloaded "${v.fileName}" v${v.version}` });
  res.json({ url, expiresIn: 300, fileName: v.fileName, mimeType: v.mimeType, previewable: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(v.mimeType), version: v.version });
}));

router.patch('/:id/status', requirePermission(PERMISSIONS.DOCS_VERIFY), body(z.object({
  status: z.enum(['UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED']),
  rejectionReason: z.string().max(1000).optional(),
})), asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId, deletedAt: null });
  if (!doc) throw ApiError.notFound('Document not found');
  if (!doc.currentVersion) throw ApiError.badRequest('This document requirement has no uploaded file to review.');
  doc.status = req.body.status;
  if (req.body.status === 'VERIFIED') { doc.verifiedBy = req.user._id; doc.verifiedAt = new Date(); }
  if (req.body.status === 'REJECTED') doc.rejectionReason = req.body.rejectionReason || 'Rejected by reviewer';
  await doc.save();

  if (doc.caseId) {
    const caseDoc = await ImmigrationCase.findOne({ _id: doc.caseId, organizationId: req.organizationId });
    if (caseDoc) {
      let changed = false;
      for (const item of caseDoc.documentChecklist) {
        if (item.documentId && String(item.documentId) === String(doc._id)) {
          item.status = req.body.status === 'VERIFIED' ? 'VERIFIED' : req.body.status === 'REJECTED' ? 'REJECTED' : 'UNDER_REVIEW';
          if (req.body.status === 'VERIFIED') { item.verifiedBy = req.user._id; item.verifiedAt = new Date(); }
          changed = true;
        }
      }
      if (changed) await caseDoc.save();
      await CaseTimeline.create({ organizationId: req.organizationId, caseId: doc.caseId, type: 'DOCUMENT', title: `Document ${req.body.status.toLowerCase()}: ${doc.name}`, actorId: req.user._id, actorName: req.user.name, visibility: 'INTERNAL' });
    }
  }
  await audit(req, `document.${req.body.status.toLowerCase()}`, { entityType: 'Document', entityId: doc._id, description: `Document "${doc.name}" → ${req.body.status}` });
  res.json(doc);
}));

router.post('/:id/comments', requirePermission(PERMISSIONS.DOCS_VIEW), body(z.object({ body: z.string().trim().min(1).max(2000), visibility: z.enum(['INTERNAL', 'CLIENT']).default('INTERNAL') })), asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId, deletedAt: null });
  if (!doc) throw ApiError.notFound('Document not found');
  doc.comments.push({ body: req.body.body, authorId: req.user._id, authorName: req.user.name, visibility: req.body.visibility });
  await doc.save();
  res.status(201).json(doc.comments[doc.comments.length - 1]);
}));

router.delete('/:id', requirePermission(PERMISSIONS.DOCS_DELETE), asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId, deletedAt: null });
  if (!doc) throw ApiError.notFound('Document not found');
  doc.deletedAt = new Date();
  doc.deletedBy = req.user._id;
  await doc.save();
  // Hard-delete the underlying object; metadata retained for audit trail.
  for (const v of doc.versions) await storage.remove(v.storageKey);
  await audit(req, 'document.deleted', { entityType: 'Document', entityId: doc._id, description: `Document "${doc.name}" deleted` });
  res.json({ ok: true });
}));

// ---------- Document requirements (missing tracking) ----------
router.post('/request', requirePermission(PERMISSIONS.DOCS_UPLOAD), body(z.object({
  caseId: z.string().min(1), checklistKey: z.string().max(60).optional(), name: z.string().trim().max(200).optional(), category: z.enum(DOC_CATEGORIES.map((d) => d.key)).optional(),
})), asyncHandler(async (req, res) => {
  const caseDoc = await ImmigrationCase.findOne({ _id: req.body.caseId, organizationId: req.organizationId });
  if (!caseDoc) throw ApiError.notFound('Case not found');
  const item = req.body.checklistKey ? caseDoc.documentChecklist.find((i) => i.key === req.body.checklistKey) : null;
  const doc = await Document.create({
    organizationId: req.organizationId, clientId: caseDoc.clientId, caseId: caseDoc._id,
    checklistKey: req.body.checklistKey, category: req.body.category || item?.category || 'OTHER',
    name: req.body.name || item?.label || 'Requested document', status: 'REQUIRED', isRequested: true, currentVersion: 0,
    uploadedBy: req.user._id, uploadedByName: req.user.name,
  });
  res.status(201).json(doc);
}));

// ---------- Checklists ----------
const checklistBody = z.object({
  name: z.string().trim().min(2).max(150),
  visaCategory: z.enum([...VISA_CATEGORIES.map((v) => v.key), 'ALL']),
  destinationCountry: z.string().max(5).default('ALL'),
  isDefault: z.boolean().optional(),
  items: z.array(z.object({ key: z.string().min(1).max(60), label: z.string().min(1).max(200), category: z.enum(DOC_CATEGORIES.map((d) => d.key)), required: z.boolean().default(true) })).min(1).max(60),
});

router.get('/checklists/list', requirePermission(PERMISSIONS.DOCS_VIEW), asyncHandler(async (req, res) => {
  const items = await DocumentChecklist.find({ organizationId: req.organizationId }).sort('-createdAt').lean();
  res.json({ data: items });
}));

router.post('/checklists', requirePermission(PERMISSIONS.DOCS_TEMPLATES), body(checklistBody), asyncHandler(async (req, res) => {
  if (req.body.isDefault) await DocumentChecklist.updateMany({ organizationId: req.organizationId, visaCategory: req.body.visaCategory }, { isDefault: false });
  const doc = await DocumentChecklist.create({ ...req.body, organizationId: req.organizationId, createdBy: req.user._id });
  await audit(req, 'document_checklist.created', { entityType: 'DocumentChecklist', entityId: doc._id, description: `Checklist "${doc.name}" created` });
  res.status(201).json(doc);
}));

router.patch('/checklists/:id', requirePermission(PERMISSIONS.DOCS_TEMPLATES), body(checklistBody.partial()), asyncHandler(async (req, res) => {
  const doc = await DocumentChecklist.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Checklist not found');
  if (req.body.isDefault) await DocumentChecklist.updateMany({ organizationId: req.organizationId, visaCategory: req.body.visaCategory || doc.visaCategory }, { isDefault: false });
  Object.assign(doc, req.body);
  await doc.save();
  res.json(doc);
}));

router.delete('/checklists/:id', requirePermission(PERMISSIONS.DOCS_TEMPLATES), asyncHandler(async (req, res) => {
  const doc = await DocumentChecklist.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Checklist not found');
  res.json({ ok: true });
}));

export default router;
