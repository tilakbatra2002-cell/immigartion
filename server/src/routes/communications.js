import { Router } from 'express';
import { z } from 'zod';
import { Conversation, Message, MessageTemplate } from '../models/Communication.js';
import Client from '../models/Client.js';
import Lead from '../models/Lead.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { MESSAGE_CHANNELS } from '../config/constants.js';
import { sendMail, mailerStatus } from '../services/mailer.js';
import { sendWhatsApp, whatsappStatus } from '../services/whatsapp.js';
import { audit } from '../services/audit.js';
import { emitToOrg } from '../realtime.js';

const router = Router();
router.use(requireAuth, requireOrg);

const renderTemplate = (text, vars) => String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);

// ---------- Conversations ----------
const listQuery = paginationSchema.extend({
  channel: z.string().optional(), clientId: z.string().optional(), status: z.string().optional(),
});

router.get('/conversations', requirePermission(PERMISSIONS.COMMS_VIEW), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.channel) filter.channel = q.channel;
  if (q.clientId) filter.clientId = q.clientId;
  if (q.status) filter.status = q.status;
  if (q.q) filter.subject = new RegExp(escapeRegex(q.q), 'i');
  const [items, total] = await Promise.all([
    paginate(Conversation.find(filter), { page: q.page, limit: q.limit, sort: q.sort || '-lastMessageAt' })
      .populate('clientId', 'firstName lastName reference email phone').populate('caseId', 'reference title').lean(),
    Conversation.countDocuments(filter),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit) });
}));

router.post('/conversations', requirePermission(PERMISSIONS.COMMS_SEND), body(z.object({
  subject: z.string().trim().min(1).max(250),
  channel: z.enum(MESSAGE_CHANNELS).default('EMAIL'),
  clientId: z.string().optional(),
  leadId: z.string().optional(),
  caseId: z.string().optional(),
})), asyncHandler(async (req, res) => {
  let emails = []; let phones = [];
  if (req.body.clientId) {
    const client = await Client.findOne({ _id: req.body.clientId, organizationId: req.organizationId });
    if (!client) throw ApiError.badRequest('Client not found.');
    if (client.email) emails = [client.email];
    if (client.phone) phones = [client.phone];
  }
  if (req.body.leadId) {
    const lead = await Lead.findOne({ _id: req.body.leadId, organizationId: req.organizationId });
    if (!lead) throw ApiError.badRequest('Lead not found.');
    if (lead.email) emails = [lead.email];
    if (lead.phone) phones = [lead.phone];
  }
  const conv = await Conversation.create({
    organizationId: req.organizationId, subject: req.body.subject, channel: req.body.channel,
    clientId: req.body.clientId, leadId: req.body.leadId, caseId: req.body.caseId,
    participantEmails: emails, participantPhones: phones, lastMessageAt: new Date(), createdBy: req.user._id,
  });
  res.status(201).json(conv);
}));

router.get('/conversations/:id', requirePermission(PERMISSIONS.COMMS_VIEW), asyncHandler(async (req, res) => {
  const conv = await Conversation.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('clientId', 'firstName lastName reference email phone').populate('caseId', 'reference title').lean();
  if (!conv) throw ApiError.notFound('Conversation not found');
  const messages = await Message.find({ organizationId: req.organizationId, conversationId: conv._id }).sort('createdAt').lean();
  // Reset staff unread counter
  await Conversation.updateOne({ _id: conv._id }, { unreadForStaff: 0 });
  res.json({ ...conv, messages });
}));

router.post('/conversations/:id/messages', requirePermission(PERMISSIONS.COMMS_SEND), body(z.object({
  body: z.string().trim().min(1).max(20000),
  channel: z.enum(MESSAGE_CHANNELS).optional(),
  subject: z.string().max(250).optional(),
})), asyncHandler(async (req, res) => {
  const conv = await Conversation.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('clientId', 'email phone firstName').populate('leadId', 'email phone fullName');
  if (!conv) throw ApiError.notFound('Conversation not found');
  const channel = req.body.channel || conv.channel;

  const message = new Message({
    organizationId: req.organizationId, conversationId: conv._id, channel, direction: 'OUTBOUND',
    from: req.user.email, to: channel === 'EMAIL' ? (conv.participantEmails.length ? conv.participantEmails : conv.clientId?.email ? [conv.clientId.email] : conv.leadId?.email ? [conv.leadId.email] : []) : [],
    subject: req.body.subject || conv.subject, body: req.body.body,
    authorId: req.user._id, authorName: req.user.name,
  });

  let result = { sent: false };
  if (channel === 'EMAIL') {
    if (!message.to.length) throw ApiError.badRequest('No recipient email on this conversation.');
    result = await sendMail({ to: message.to.join(','), subject: message.subject, text: req.body.body, html: req.body.body.replace(/\n/g, '<br/>') });
    message.provider = 'smtp';
    message.status = result.sent ? 'SENT' : 'FAILED';
    if (result.sent) message.sentAt = new Date(); else message.error = result.error;
    message.providerMessageId = result.messageId;
  } else if (channel === 'WHATSAPP') {
    const phone = conv.participantPhones[0] || conv.clientId?.phone || conv.leadId?.phone;
    if (!phone) throw ApiError.badRequest('No phone number on this conversation.');
    result = await sendWhatsApp({ to: phone, body: req.body.body });
    message.to = [phone];
    message.provider = 'meta';
    message.status = result.sent ? 'SENT' : 'FAILED';
    if (result.sent) message.sentAt = new Date(); else message.error = result.error;
    message.providerMessageId = result.providerMessageId;
  } else {
    // PORTAL channel: message visible to client in the portal — always "sent" internally
    result = { sent: true, provider: 'portal' };
    message.provider = 'portal';
    message.status = 'SENT';
    message.sentAt = new Date();
  }
  await message.save();
  conv.lastMessageAt = new Date();
  conv.lastMessagePreview = req.body.body.slice(0, 300);
  conv.unreadForClient = (conv.unreadForClient || 0) + 1;
  await conv.save();
  await audit(req, `${channel.toLowerCase()}.message_sent`, { entityType: 'Conversation', entityId: conv._id, description: `${channel} message ${result.sent ? 'sent' : 'failed'}` });
  if (result.sent) emitToOrg(req.organizationId, 'message:sent', { conversationId: conv._id });

  // 200 with the failure state — the client UI shows "Not sent: reason" rather than a false success.
  res.status(result.sent ? 201 : 202).json({ message, delivered: result.sent, error: result.sent ? undefined : result.error, integrationConfigured: channel === 'EMAIL' ? mailerStatus().configured : channel === 'WHATSAPP' ? whatsappStatus().configured : true });
}));

router.post('/conversations/:id/notes', requirePermission(PERMISSIONS.COMMS_VIEW), body(z.object({ body: z.string().trim().min(1).max(5000) })), asyncHandler(async (req, res) => {
  const conv = await Conversation.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!conv) throw ApiError.notFound('Conversation not found');
  const message = await Message.create({
    organizationId: req.organizationId, conversationId: conv._id, channel: 'PORTAL', direction: 'INTERNAL',
    status: 'SENT', provider: 'internal', body: req.body.body, authorId: req.user._id, authorName: req.user.name,
  });
  conv.lastMessageAt = new Date();
  await conv.save();
  res.status(201).json(message);
}));

// ---------- Unified history ----------
router.get('/messages', requirePermission(PERMISSIONS.COMMS_VIEW), query(paginationSchema.extend({
  channel: z.string().optional(), direction: z.string().optional(), clientId: z.string().optional(),
})), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.channel) filter.channel = q.channel;
  if (q.direction) filter.direction = q.direction;
  if (q.q) filter.$or = [{ body: new RegExp(escapeRegex(q.q), 'i') }, { subject: new RegExp(escapeRegex(q.q), 'i') }];
  const [items, total] = await Promise.all([
    paginate(Message.find(filter), { page: q.page, limit: q.limit, sort: '-createdAt' }).populate({ path: 'conversationId', select: 'subject clientId', populate: { path: 'clientId', select: 'firstName lastName reference' } }).lean(),
    Message.countDocuments(filter),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit) });
}));

// ---------- Templates ----------
const templateBody = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.enum(MESSAGE_CHANNELS).default('EMAIL'),
  category: z.enum(['GENERAL', 'DOCUMENT_REMINDER', 'FOLLOW_UP', 'INVOICE', 'APPOINTMENT', 'WELCOME', 'CASE_UPDATE']).default('GENERAL'),
  subject: z.string().max(250).optional(),
  body: z.string().trim().min(1).max(20000),
});

router.get('/templates', requirePermission(PERMISSIONS.COMMS_VIEW), asyncHandler(async (req, res) => {
  const items = await MessageTemplate.find({ organizationId: req.organizationId }).sort('-createdAt').lean();
  res.json({ data: items });
}));

router.post('/templates', requirePermission(PERMISSIONS.COMMS_TEMPLATES), body(templateBody), asyncHandler(async (req, res) => {
  const vars = [...new Set((req.body.body.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((v) => v.replace(/[{}]/g, '').trim()))];
  const doc = await MessageTemplate.create({ ...req.body, organizationId: req.organizationId, variables: vars, createdBy: req.user._id });
  res.status(201).json(doc);
}));

router.patch('/templates/:id', requirePermission(PERMISSIONS.COMMS_TEMPLATES), body(templateBody.partial()), asyncHandler(async (req, res) => {
  const doc = await MessageTemplate.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Template not found');
  Object.assign(doc, req.body);
  if (req.body.body) doc.variables = [...new Set((req.body.body.match(/\{\{\s*(\w+)\s*\}\}/g) || []).map((v) => v.replace(/[{}]/g, '').trim()))];
  await doc.save();
  res.json(doc);
}));

router.delete('/templates/:id', requirePermission(PERMISSIONS.COMMS_TEMPLATES), asyncHandler(async (req, res) => {
  const doc = await MessageTemplate.findOneAndDelete({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Template not found');
  res.json({ ok: true });
}));

router.post('/templates/:id/preview', requirePermission(PERMISSIONS.COMMS_VIEW), body(z.object({ variables: z.record(z.string()).default({}) })), asyncHandler(async (req, res) => {
  const doc = await MessageTemplate.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Template not found');
  res.json({ subject: renderTemplate(doc.subject, req.body.variables), body: renderTemplate(doc.body, req.body.variables) });
}));

router.get('/integrations/status', requirePermission(PERMISSIONS.COMMS_VIEW), asyncHandler(async (req, res) => {
  res.json({ email: mailerStatus(), whatsapp: whatsappStatus() });
}));

export default router;
