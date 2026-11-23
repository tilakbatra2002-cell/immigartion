import { Router } from 'express';
import { z } from 'zod';
import Document from '../models/Document.js';
import ImmigrationCase, { CaseTimeline } from '../models/ImmigrationCase.js';
import Client from '../models/Client.js';
import Task from '../models/Task.js';
import Invoice from '../models/Invoice.js';
import Appointment from '../models/Appointment.js';
import AIUsage from '../models/AIUsage.js';
import { storage } from '../services/storage.js';
import { aiChat, aiStatus, parseAIJson, trackAIUsage, redactForAI } from '../services/ai.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { assertFeature } from '../services/plans.js';
import { audit } from '../services/audit.js';
import { CASE_STATUSES, VISA_CATEGORIES } from '../config/constants.js';

const router = Router();
router.use(requireAuth, requireOrg);

async function requireAI(req) {
  await assertFeature(req.organizationId, 'ai', 'AI assistance');
  if (!aiStatus().configured) {
    throw new ApiError(503, 'AI is not configured for this deployment. Add AI_API_KEY on the server, then reload Settings → AI.', null, 'AI_NOT_CONFIGURED');
  }
}

router.get('/status', asyncHandler(async (req, res) => {
  const usage = await AIUsage.aggregate([
    { $match: { organizationId: req.organizationId } },
    { $group: { _id: null, calls: { $sum: 1 }, tokens: { $sum: '$totalTokens' } } },
  ]);
  res.json({ ...aiStatus(), usage: usage[0] || { calls: 0, tokens: 0 }, planEnabled: Boolean(req.plan?.limits?.ai) });
}));

// 1) Document summarization — extracts fields for HUMAN verification
router.post('/summarize-document', aiLimiter, body(z.object({ documentId: z.string().min(1) })), asyncHandler(async (req, res) => {
  await requireAI(req);
  const doc = await Document.findOne({ _id: req.body.documentId, organizationId: req.organizationId, deletedAt: null });
  if (!doc) throw ApiError.notFound('Document not found');
  const version = doc.versions[doc.versions.length - 1];
  if (!version) throw ApiError.badRequest('This document has no uploaded file yet.');

  let text = '';
  if (version.mimeType.startsWith('image/')) {
    throw ApiError.badRequest('Image documents require an OCR-capable AI provider. Upload a text-based PDF for summarization, or review the image manually.');
  }
  if (version.mimeType === 'application/pdf') {
    const buffer = await storage.driver === 's3'
      ? await (async () => {
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
        const env = (await import('../config/env.js')).default;
        const client = new S3Client({ region: env.S3_REGION, endpoint: env.S3_ENDPOINT || undefined, forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true', credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } });
        const out = await client.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: version.storageKey }));
        const chunks = []; for await (const c of out.Body) chunks.push(c); return Buffer.concat(chunks);
      })()
      : await storage.readLocal(version.storageKey);
    try {
      const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
      const parsed = await pdfParse(buffer);
      text = parsed.text || '';
    } catch {
      throw ApiError.badRequest('Could not extract text from this PDF. It may be a scanned image.');
    }
  } else {
    throw ApiError.badRequest('Only PDF text extraction is supported for AI summaries.');
  }
  if (!text.trim()) throw ApiError.badRequest('No readable text found in the document.');

  const started = Date.now();
  const result = await aiChat({
    temperature: 0.2,
    jsonMode: true,
    messages: [{
      role: 'user',
      content: `Summarize this immigration document and extract fields. Return JSON:
{"summary": "2-3 sentence plain summary", "documentType": "...", "extracted": {"fieldName": "value"}, "flags": ["issues like expiry, mismatch, illegible"], "confidence": "high|medium|low"}
Only include data literally visible in the document. If a field is not present, omit it. Never infer or fabricate values.

DOCUMENT (${doc.name}):
${redactForAI(text)}`,
    }],
  });
  const parsed = parseAIJson(result.content);
  if (!parsed) throw new ApiError(502, 'AI returned an unreadable response. Try again.');

  doc.aiSummary = { ...parsed, model: result.model, generatedAt: new Date(), generatedBy: req.user._id, verified: false };
  await doc.save();
  await trackAIUsage({ organizationId: req.organizationId, userId: req.user._id, feature: 'DOCUMENT_SUMMARY', result, entityType: 'Document', entityId: doc._id });
  await audit(req, 'ai.document_summarized', { entityType: 'Document', entityId: doc._id, description: `AI summary generated for "${doc.name}"` });
  res.json({ summary: doc.aiSummary, disclaimer: 'Extracted information is unverified. A consultant must review and confirm every field.' });
}));

router.post('/documents/:id/verify-fields', requirePermission(PERMISSIONS.DOCS_VERIFY), body(z.object({ verified: z.boolean(), notes: z.string().max(1000).optional() })), asyncHandler(async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc || !doc.aiSummary) throw ApiError.notFound('No AI summary on this document');
  doc.aiSummary.verified = req.body.verified;
  doc.aiSummary.verifiedBy = req.user._id;
  doc.aiSummary.verifiedAt = new Date();
  if (req.body.notes) doc.aiSummary.verificationNotes = req.body.notes;
  if (req.body.verified && doc.status !== 'VERIFIED') { doc.status = 'VERIFIED'; doc.verifiedBy = req.user._id; doc.verifiedAt = new Date(); }
  await doc.save();
  await audit(req, 'ai.extraction_verified', { entityType: 'Document', entityId: doc._id, description: `AI extraction ${req.body.verified ? 'confirmed' : 'marked incorrect'} by ${req.user.name}` });
  res.json(doc.aiSummary);
}));

// 2) Email drafting
router.post('/draft-email', aiLimiter, body(z.object({
  intent: z.enum(['GENERAL', 'DOCUMENT_REMINDER', 'FOLLOW_UP', 'CONSULTATION_FOLLOW_UP', 'CASE_UPDATE', 'INVOICE_REMINDER']),
  clientId: z.string().optional(),
  caseId: z.string().optional(),
  context: z.string().max(2000).optional(),
  tone: z.enum(['FORMAL', 'FRIENDLY', 'CONCISE']).default('FORMAL'),
})), asyncHandler(async (req, res) => {
  await requireAI(req);
  let clientName = 'the client';
  let missingDocs = [];
  let caseInfo = '';
  if (req.body.clientId) {
    const client = await Client.findOne({ _id: req.body.clientId, organizationId: req.organizationId });
    if (client) clientName = `${client.firstName} ${client.lastName || ''}`.trim();
  }
  if (req.body.caseId) {
    const c = await ImmigrationCase.findOne({ _id: req.body.caseId, organizationId: req.organizationId });
    if (c) {
      caseInfo = `Case ${c.reference} (${VISA_CATEGORIES.find((v) => v.key === c.visaCategory)?.label}) — status: ${CASE_STATUSES.find((s) => s.key === c.status)?.label}`;
      missingDocs = c.documentChecklist.filter((i) => i.required && ['REQUIRED', 'REJECTED'].includes(i.status)).map((i) => i.label);
    }
  }
  const started = Date.now();
  const result = await aiChat({
    temperature: 0.5,
    messages: [{
      role: 'user',
      content: `Draft a professional ${req.body.tone.toLowerCase()} email from an immigration consultancy to ${clientName}.
Purpose: ${req.body.intent.replace(/_/g, ' ').toLowerCase()}.
${caseInfo ? `Case context: ${caseInfo}.` : ''}
${missingDocs.length ? `Missing documents: ${missingDocs.join(', ')}.` : ''}
${req.body.context ? `Extra context: ${req.body.context}` : ''}
Return JSON: {"subject": "...", "body": "plain text email, no placeholders like [Name] unless data is unknown", "suggestedVariables": []}.
Do not promise visa outcomes or timelines. Sign off as "Your ImmigrationFlow consultant".`,
    }],
    jsonMode: true,
  });
  const parsed = parseAIJson(result.content) || { subject: 'Message from your consultant', body: result.content };
  await trackAIUsage({ organizationId: req.organizationId, userId: req.user._id, feature: 'EMAIL_DRAFT', result });
  res.json({ ...parsed, model: result.model, missingDocs });
}));

// 3) Case summarization
router.post('/summarize-case', aiLimiter, body(z.object({ caseId: z.string().min(1) })), asyncHandler(async (req, res) => {
  await requireAI(req);
  const caseDoc = await ImmigrationCase.findOne({ _id: req.body.caseId, organizationId: req.organizationId })
    .populate('clientId', 'firstName lastName reference');
  if (!caseDoc) throw ApiError.notFound('Case not found');
  const [timeline, tasks, docs] = await Promise.all([
    CaseTimeline.find({ organizationId: req.organizationId, caseId: caseDoc._id }).sort('-createdAt').limit(40).lean(),
    Task.find({ organizationId: req.organizationId, relatedType: 'CASE', relatedId: caseDoc._id, status: { $in: ['OPEN', 'IN_PROGRESS'] } }).lean(),
    Document.find({ organizationId: req.organizationId, caseId: caseDoc._id, deletedAt: null }).select('name status isRequested').lean(),
  ]);
  const missing = caseDoc.documentChecklist.filter((i) => i.required && !['VERIFIED', 'WAIVED'].includes(i.status)).map((i) => i.label);
  const context = {
    reference: caseDoc.reference,
    visaCategory: caseDoc.visaCategory,
    destination: caseDoc.destinationCountry,
    status: caseDoc.status,
    deadline: caseDoc.targetDeadline,
    checklistMissing: missing,
    openTasks: tasks.map((t) => t.title),
    uploadedDocs: docs.map((d) => `${d.name} (${d.status})`),
    recentActivity: timeline.slice(0, 15).map((t) => `${t.title}${t.description ? ` — ${t.description}` : ''}`),
  };
  const result = await aiChat({
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `Summarize this immigration case for the internal team. Return JSON:
{"summary": "paragraph", "highlights": ["..."], "pendingActions": ["..."], "missingDocuments": ["..."], "risks": ["deadline or document risk only — never a visa outcome prediction"]}
Base everything strictly on this data; if empty, say so.

DATA:\n${redactForAI(JSON.stringify(context, null, 1))}`,
    }],
    jsonMode: true,
  });
  const parsed = parseAIJson(result.content) || { summary: result.content, highlights: [], pendingActions: [], missingDocuments: missing, risks: [] };
  await trackAIUsage({ organizationId: req.organizationId, userId: req.user._id, feature: 'CASE_SUMMARY', result, entityType: 'ImmigrationCase', entityId: caseDoc._id });
  res.json({ ...parsed, generatedAt: new Date(), model: result.model, disclaimer: 'AI summary — verify all statuses before communicating with the client.' });
}));

// 4) Client communication — reply drafting / translation / clarity
router.post('/client-reply', aiLimiter, body(z.object({
  clientMessage: z.string().min(1).max(8000),
  action: z.enum(['REPLY', 'TRANSLATE', 'IMPROVE']).default('REPLY'),
  targetLanguage: z.string().max(40).optional(),
  clientId: z.string().optional(),
})), asyncHandler(async (req, res) => {
  await requireAI(req);
  const prompt = {
    REPLY: `Draft a professional reply to this client message. Never promise outcomes or timelines. Return JSON {"subject": "...", "body": "..."}.\n\nClient message:\n${redactForAI(req.body.clientMessage)}`,
    TRANSLATE: `Translate this message into ${req.body.targetLanguage || 'English'} preserving professionalism. Return JSON {"body": "..."}.\n\nMessage:\n${redactForAI(req.body.clientMessage)}`,
    IMPROVE: `Rewrite this message to be clearer and more professional while preserving meaning. Return JSON {"body": "..."}.\n\nMessage:\n${redactForAI(req.body.clientMessage)}`,
  }[req.body.action];
  const result = await aiChat({ temperature: 0.4, messages: [{ role: 'user', content: prompt }], jsonMode: true });
  const parsed = parseAIJson(result.content) || { body: result.content };
  await trackAIUsage({ organizationId: req.organizationId, userId: req.user._id, feature: 'CLIENT_REPLY', result });
  res.json({ ...parsed, model: result.model });
}));

// 5) Internal assistant — tenant-scoped, read-only context
router.post('/assistant', aiLimiter, body(z.object({ question: z.string().trim().min(2).max(1000) })), asyncHandler(async (req, res) => {
  await requireAI(req);
  const [caseCounts, overdueTasks, pendingDocs, invoiceTotals, upcoming] = await Promise.all([
    ImmigrationCase.aggregate([{ $match: { organizationId: req.organizationId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Task.countDocuments({ organizationId: req.organizationId, status: { $in: ['OPEN', 'IN_PROGRESS'] }, dueAt: { $lt: new Date() } }),
    Document.countDocuments({ organizationId: req.organizationId, deletedAt: null, isRequested: true, status: 'REQUIRED' }),
    Invoice.aggregate([{ $match: { organizationId: req.organizationId, type: 'INVOICE', status: { $ne: 'CANCELLED' } } }, { $group: { _id: null, outstanding: { $sum: '$balance' }, revenue: { $sum: '$amountPaid' } } }]),
    Appointment.countDocuments({ organizationId: req.organizationId, startAt: { $gte: new Date(), $lte: new Date(Date.now() + 7 * 86400000) }, status: { $in: ['SCHEDULED', 'CONFIRMED'] } }),
  ]);
  const ctx = {
    casesByStatus: caseCounts.map((c) => `${CASE_STATUSES.find((s) => s.key === c._id)?.label || c._id}: ${c.count}`).join(', ') || 'no cases',
    overdueTasks,
    missingDocumentRequirements: pendingDocs,
    outstandingBalance: invoiceTotals[0]?.outstanding || 0,
    collectedRevenue: invoiceTotals[0]?.revenue || 0,
    appointmentsNext7Days: upcoming,
    currency: req.org?.settings?.currency || 'INR',
  };
  const result = await aiChat({
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `You are the internal assistant for this immigration consultancy. Answer the user's question using ONLY this aggregated organization data (no personal client data is available to you). If the data cannot answer it, say what you can't see and suggest where to look in the app.
Return JSON {"answer": "markdown-lite answer", "dataPoints": ["key figures used"]}.

Organization snapshot:\n${JSON.stringify(ctx)}

Question: ${req.body.question}`,
    }],
    jsonMode: true,
  });
  const parsed = parseAIJson(result.content) || { answer: result.content };
  await trackAIUsage({ organizationId: req.organizationId, userId: req.user._id, feature: 'ASSISTANT', result });
  res.json({ ...parsed, snapshot: ctx, model: result.model });
}));

router.get('/usage', asyncHandler(async (req, res) => {
  const rows = await AIUsage.find({ organizationId: req.organizationId }).sort('-createdAt').limit(50).populate('userId', 'name').lean();
  const summary = await AIUsage.aggregate([
    { $match: { organizationId: req.organizationId } },
    { $group: { _id: '$feature', calls: { $sum: 1 }, tokens: { $sum: '$totalTokens' } } },
  ]);
  res.json({ data: rows, summary });
}));

export default router;
