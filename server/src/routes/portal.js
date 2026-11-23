import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import ImmigrationCase, { CaseTimeline } from '../models/ImmigrationCase.js';
import Document from '../models/Document.js';
import Appointment from '../models/Appointment.js';
import Invoice from '../models/Invoice.js';
import { Conversation, Message } from '../models/Communication.js';
import Organization from '../models/Organization.js';
import { FamilyMember } from '../models/Client.js';
import { requireAuth, requireClient } from '../middleware/auth.js';
import { body } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { storage, buildStorageKey, sniffMimeOk } from '../services/storage.js';
import { DOC_ALLOWED_MIME, DOC_MAX_BYTES, DOC_CATEGORIES } from '../config/constants.js';
import { audit } from '../services/audit.js';
import { emitToOrg } from '../realtime.js';

const router = Router();
router.use(requireAuth, requireClient);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: DOC_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => (DOC_ALLOWED_MIME.includes(file.mimetype) ? cb(null, true) : cb(ApiError.badRequest('Unsupported file type.'))),
});

function publicDoc(doc) {
  const obj = doc.toObject ? doc.toObject() : { ...doc };
  delete obj.versions;
  delete obj.comments;
  return obj;
}

router.get('/me', asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.client.organizationId).select('name logoUrl settings email phone website').lean();
  res.json({
    client: { id: req.client._id, reference: req.client.reference, firstName: req.client.firstName, lastName: req.client.lastName, email: req.client.email, phone: req.client.phone },
    organization: { name: org?.name, logoUrl: org?.logoUrl, email: org?.email, phone: org?.phone, website: org?.website, currency: org?.settings?.currency || 'INR', timezone: org?.settings?.timezone },
  });
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const clientId = req.client._id;
  const orgId = req.client.organizationId;
  const [cases, nextAppointment, outstandingInvoices, unreadMessages, actionItems] = await Promise.all([
    ImmigrationCase.find({ organizationId: orgId, clientId }).select('reference title status visaCategory destinationCountry targetDeadline updatedAt').sort('-updatedAt').lean(),
    Appointment.findOne({ organizationId: orgId, clientId, startAt: { $gte: new Date() }, status: { $in: ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED'] } }).sort('startAt').populate('consultantId', 'name').lean(),
    Invoice.aggregate([{ $match: { organizationId: req.client.organizationId, clientId, status: { $in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] } } }, { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } }]),
    Message.countDocuments({ organizationId: orgId, isClientMessage: false, direction: 'OUTBOUND', 'to': req.client.email, readAt: null }),
    (async () => {
      const caseIds = await ImmigrationCase.find({ organizationId: orgId, clientId }).select('_id documentChecklist').lean();
      let required = 0;
      for (const c of caseIds) required += c.documentChecklist.filter((i) => i.required && ['REQUIRED', 'REJECTED'].includes(i.status)).length;
      return required;
    })(),
  ]);
  res.json({
    cases,
    nextAppointment,
    outstanding: outstandingInvoices[0] || { total: 0, count: 0 },
    unreadMessages,
    documentsRequired: actionItems,
  });
}));

router.get('/cases', asyncHandler(async (req, res) => {
  const cases = await ImmigrationCase.find({ organizationId: req.client.organizationId, clientId: req.client._id })
    .select('reference title status visaCategory destinationCountry applicationDate targetDeadline priority updatedAt')
    .sort('-updatedAt').lean();
  res.json({ data: cases });
}));

router.get('/cases/:id', asyncHandler(async (req, res) => {
  const c = await ImmigrationCase.findOne({ _id: req.params.id, organizationId: req.client.organizationId, clientId: req.client._id })
    .select('-internalNotes -fees -createdBy -checklistTemplateId').lean();
  if (!c) throw ApiError.notFound('Case not found');
  // Only client-visible timeline entries
  const timeline = await CaseTimeline.find({ organizationId: c.organizationId, caseId: c._id, visibility: 'CLIENT' })
    .select('type title description actorName createdAt').sort('-createdAt').lean();
  const docs = await Document.find({ organizationId: c.organizationId, caseId: c._id, deletedAt: null })
    .select('name category status isRequested createdAt currentVersion').lean();
  res.json({
    ...c,
    internalNotes: undefined,
    timeline,
    documents: docs.map((d) => ({ ...d, status: ['REQUIRED', 'UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'WAIVED'].includes(d.status) ? d.status : 'UPLOADED', hasFile: d.currentVersion > 0 })),
  });
}));

router.get('/documents', asyncHandler(async (req, res) => {
  const docs = await Document.find({ organizationId: req.client.organizationId, clientId: req.client._id, deletedAt: null })
    .select('name category status isRequested createdAt currentVersion checklistKey caseId').sort('-createdAt').lean();
  res.json({ data: docs.map((d) => ({ ...d, hasFile: d.currentVersion > 0 })) });
}));

router.get('/documents/:id/download', asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.client.organizationId, clientId: req.client._id, deletedAt: null });
  if (!doc || !doc.versions.length) throw ApiError.notFound('Document not found');
  const v = doc.versions[doc.versions.length - 1];
  const url = await storage.getSignedDownloadUrl(v.storageKey, { expiresIn: 300, fileName: v.fileName });
  await audit(req, 'portal.document_downloaded', { entityType: 'Document', entityId: doc._id, organizationId: req.client.organizationId, description: `Client downloaded "${doc.name}"` });
  res.json({ url, fileName: v.fileName, expiresIn: 300 });
}));

router.post('/documents', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded.');
  if (!sniffMimeOk(req.file.buffer, req.file.mimetype)) throw ApiError.badRequest('File content does not match its declared type.');
  const meta = z.object({ name: z.string().trim().min(1).max(200), category: z.enum(DOC_CATEGORIES.map((d) => d.key)).optional(), caseId: z.string().optional(), checklistKey: z.string().optional() }).safeParse(req.body);
  if (!meta.success) throw ApiError.badRequest('Validation failed', Object.fromEntries(meta.error.issues.map((i) => [i.path.join('.') || '_', i.message])));

  let caseDoc = null;
  if (meta.data.caseId) {
    caseDoc = await ImmigrationCase.findOne({ _id: meta.data.caseId, organizationId: req.client.organizationId, clientId: req.client._id });
    if (!caseDoc) throw ApiError.badRequest('Case not found.');
  }
  const storageKey = buildStorageKey({ organizationId: req.client.organizationId, scope: 'portal-uploads', fileName: req.file.originalname });
  await storage.put(storageKey, req.file.buffer, req.file.mimetype);

  // If this fulfils a required checklist item, update the existing requirement row
  let doc = null;
  if (caseDoc && meta.data.checklistKey) {
    const item = caseDoc.documentChecklist.find((i) => i.key === meta.data.checklistKey);
    if (item) {
      doc = await Document.findOne({ organizationId: req.client.organizationId, caseId: caseDoc._id, checklistKey: meta.data.checklistKey });
    }
  }
  if (doc) {
    const version = (doc.currentVersion || 0) + 1;
    doc.versions.push({ version, storageKey, fileName: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype, uploadedByName: req.client.firstName });
    doc.currentVersion = version;
    doc.status = 'UPLOADED';
    doc.isRequested = false;
    doc.uploadedByClient = true;
    await doc.save();
  } else {
    doc = await Document.create({
      organizationId: req.client.organizationId, clientId: req.client._id, caseId: caseDoc?._id,
      checklistKey: meta.data.checklistKey, category: meta.data.category || 'OTHER', name: meta.data.name,
      status: 'UPLOADED', isRequested: false, currentVersion: 1, uploadedByClient: true, uploadedByName: `${req.client.firstName} (client)`,
      versions: [{ version: 1, storageKey, fileName: req.file.originalname, size: req.file.size, mimeType: req.file.mimetype, uploadedByName: `${req.client.firstName} (client)` }],
    });
  }
  if (caseDoc && meta.data.checklistKey) {
    const item = caseDoc.documentChecklist.find((i) => i.key === meta.data.checklistKey);
    if (item) {
      item.documentId = doc._id;
      item.status = 'UPLOADED';
      await caseDoc.save();
      await CaseTimeline.create({ organizationId: req.client.organizationId, caseId: caseDoc._id, type: 'DOCUMENT', title: `Client uploaded: ${item.label}`, actorName: `${req.client.firstName} (client)`, visibility: 'CLIENT' });
    }
  }
  await audit(req, 'portal.document_uploaded', { entityType: 'Document', entityId: doc._id, organizationId: req.client.organizationId, description: `Client uploaded "${doc.name}"` });
  emitToOrg(req.client.organizationId, 'portal:document_uploaded', { id: doc._id, name: doc.name, clientId: req.client._id });
  res.status(201).json({ ...publicDoc(doc), versions: undefined });
}));

router.get('/appointments', asyncHandler(async (req, res) => {
  const appts = await Appointment.find({ organizationId: req.client.organizationId, clientId: req.client._id })
    .populate('consultantId', 'name').select('title type startAt endAt status meetingLink location notes timezone').sort('startAt').lean();
  res.json({ data: appts });
}));

router.get('/invoices', asyncHandler(async (req, res) => {
  const invoices = await Invoice.find({ organizationId: req.client.organizationId, clientId: req.client._id, status: { $ne: 'DRAFT' }, type: 'INVOICE' })
    .select('invoiceNumber issueDate dueDate total amountPaid balance status currency').sort('-issueDate').lean();
  res.json({ data: invoices });
}));

router.get('/messages', asyncHandler(async (req, res) => {
  const conv = await Conversation.findOne({ organizationId: req.client.organizationId, clientId: req.client._id, channel: 'PORTAL' })
    || await Conversation.findOne({ organizationId: req.client.organizationId, clientId: req.client._id }).sort('-lastMessageAt');
  if (!conv) return res.json({ conversation: null, messages: [] });
  const messages = await Message.find({ organizationId: req.client.organizationId, conversationId: conv._id, direction: { $ne: 'INTERNAL' } })
    .select('direction body authorName createdAt channel').sort('createdAt').lean();
  await Conversation.updateOne({ _id: conv._id }, { unreadForClient: 0 });
  res.json({ conversation: { _id: conv._id, subject: conv.subject, channel: conv.channel }, messages });
}));

router.post('/messages', body(z.object({ body: z.string().trim().min(1).max(5000) })), asyncHandler(async (req, res) => {
  let conv = await Conversation.findOne({ organizationId: req.client.organizationId, clientId: req.client._id, channel: 'PORTAL' });
  if (!conv) {
    conv = await Conversation.create({
      organizationId: req.client.organizationId, clientId: req.client._id, channel: 'PORTAL',
      subject: `Portal conversation — ${req.client.firstName}`, participantEmails: req.client.email ? [req.client.email] : [],
      lastMessageAt: new Date(),
    });
  }
  const message = await Message.create({
    organizationId: req.client.organizationId, conversationId: conv._id, channel: 'PORTAL', direction: 'INBOUND',
    status: 'RECEIVED', provider: 'portal', body: req.body.body, isClientMessage: true, authorName: `${req.client.firstName} ${req.client.lastName || ''}`.trim(),
    from: req.client.email,
  });
  conv.lastMessageAt = new Date();
  conv.lastMessagePreview = req.body.body.slice(0, 300);
  conv.unreadForStaff = (conv.unreadForStaff || 0) + 1;
  await conv.save();
  emitToOrg(req.client.organizationId, 'portal:message', { conversationId: conv._id, clientId: req.client._id, preview: req.body.body.slice(0, 80) });
  res.status(201).json({ message: { _id: message._id, body: message.body, createdAt: message.createdAt, direction: message.direction } });
}));

router.get('/family', asyncHandler(async (req, res) => {
  const members = await FamilyMember.find({ organizationId: req.client.organizationId, clientId: req.client._id }).select('name relationship dateOfBirth nationality').lean();
  res.json({ data: members });
}));

export default router;
