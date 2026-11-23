import { Router } from 'express';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import Invoice, { Payment } from '../models/Invoice.js';
import Client from '../models/Client.js';
import ImmigrationCase from '../models/ImmigrationCase.js';
import Organization from '../models/Organization.js';
import { requireAuth, requireOrg, requirePermission } from '../middleware/auth.js';
import { PERMISSIONS } from '../config/permissions.js';
import { body, query } from '../utils/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import { pageMeta, paginate, paginationSchema, escapeRegex } from '../utils/pagination.js';
import { INVOICE_STATUSES, PAYMENT_METHODS } from '../config/constants.js';
import { formatMoney, round2 } from '../utils/money.js';
import { nextReference } from '../services/references.js';
import { audit } from '../services/audit.js';
import { sendMail, baseEmailHtml } from '../services/mailer.js';

const router = Router();
router.use(requireAuth, requireOrg);

const invoiceBody = z.object({
  type: z.enum(['QUOTATION', 'INVOICE']).default('INVOICE'),
  clientId: z.string().min(1),
  caseId: z.string().nullable().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional().or(z.literal('')),
  currency: z.enum(['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD']).optional(),
  items: z.array(z.object({
    description: z.string().trim().min(1).max(300),
    quantity: z.coerce.number().positive().max(10000),
    unitPrice: z.coerce.number().min(0).max(100000000),
  })).min(1).max(50),
  discountType: z.enum(['FIXED', 'PERCENT']).optional(),
  discountValue: z.coerce.number().min(0).max(100000000).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
});

const listQuery = paginationSchema.extend({
  status: z.string().optional(), type: z.string().optional(), clientId: z.string().optional(),
  from: z.string().optional(), to: z.string().optional(),
});

router.get('/', requirePermission(PERMISSIONS.INVOICES_VIEW), query(listQuery), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filter = { organizationId: req.organizationId };
  if (q.status) filter.status = q.status;
  if (q.type) filter.type = q.type;
  if (q.clientId) filter.clientId = q.clientId;
  if (q.from || q.to) {
    filter.issueDate = {};
    if (q.from) filter.issueDate.$gte = new Date(q.from);
    if (q.to) filter.issueDate.$lte = new Date(q.to);
  }
  if (q.q) filter.$or = [{ invoiceNumber: new RegExp(escapeRegex(q.q), 'i') }, { notes: new RegExp(escapeRegex(q.q), 'i') }];
  const [items, total, totals] = await Promise.all([
    paginate(Invoice.find(filter), { page: q.page, limit: q.limit, sort: q.sort || '-createdAt' })
      .populate('clientId', 'firstName lastName reference').populate('caseId', 'reference title').lean(),
    Invoice.countDocuments(filter),
    Invoice.aggregate([
      { $match: { organizationId: filter.organizationId, type: 'INVOICE', status: { $ne: 'CANCELLED' } } },
      { $group: { _id: null, total: { $sum: '$total' }, paid: { $sum: '$amountPaid' }, balance: { $sum: '$balance' }, count: { $sum: 1 } } },
    ]),
  ]);
  res.json({ data: items, meta: pageMeta(total, q.page, q.limit), summary: totals[0] || { total: 0, paid: 0, balance: 0, count: 0 } });
}));

router.get('/:id', requirePermission(PERMISSIONS.INVOICES_VIEW), asyncHandler(async (req, res) => {
  const doc = await Invoice.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('clientId', 'firstName lastName reference email phone').populate('caseId', 'reference title').lean();
  if (!doc) throw ApiError.notFound('Invoice not found');
  const payments = await Payment.find({ organizationId: req.organizationId, invoiceId: doc._id }).populate('recordedBy', 'name').sort('-paidAt').lean();
  res.json({ ...doc, payments });
}));

router.post('/', requirePermission(PERMISSIONS.INVOICES_CREATE), body(invoiceBody), asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.body.clientId, organizationId: req.organizationId });
  if (!client) throw ApiError.badRequest('Client not found.');
  if (req.body.caseId && !(await ImmigrationCase.exists({ _id: req.body.caseId, organizationId: req.organizationId }))) throw ApiError.badRequest('Case not found.');
  const key = req.body.type === 'QUOTATION' ? 'QUOTATION' : 'INVOICE';
  const invoiceNumber = await nextReference(req.organizationId, key);
  const settings = req.org.settings;
  const doc = await Invoice.create({
    ...req.body,
    organizationId: req.organizationId,
    invoiceNumber,
    currency: req.body.currency || settings.currency || 'INR',
    taxRate: req.body.taxRate ?? settings.taxRate ?? 0,
    terms: req.body.terms || settings.invoiceTerms,
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 14 * 86400000),
    status: 'DRAFT',
    createdBy: req.user._id,
  });
  await audit(req, `${key === 'QUOTATION' ? 'quotation' : 'invoice'}.created`, { entityType: 'Invoice', entityId: doc._id, description: `${key} ${invoiceNumber} created` });
  res.status(201).json(doc);
}));

router.patch('/:id', requirePermission(PERMISSIONS.INVOICES_UPDATE), body(invoiceBody.partial()), asyncHandler(async (req, res) => {
  const doc = await Invoice.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Invoice not found');
  if (doc.amountPaid > 0) throw ApiError.badRequest('Invoices with recorded payments cannot be edited. Issue a credit note instead.');
  if (doc.status === 'CANCELLED') throw ApiError.badRequest('Cancelled invoices cannot be edited.');
  const { items, ...rest } = req.body;
  if (items) doc.items = items;
  if (rest.dueDate === '') doc.dueDate = undefined; else if (rest.dueDate) doc.dueDate = new Date(rest.dueDate);
  delete rest.dueDate; delete rest.clientId; delete rest.type;
  Object.assign(doc, rest);
  await doc.save();
  await audit(req, 'invoice.updated', { entityType: 'Invoice', entityId: doc._id, description: `Invoice ${doc.invoiceNumber} updated` });
  res.json(doc);
}));

router.patch('/:id/status', requirePermission(PERMISSIONS.INVOICES_UPDATE), body(z.object({ status: z.enum(INVOICE_STATUSES), sendEmail: z.boolean().optional() })), asyncHandler(async (req, res) => {
  const doc = await Invoice.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!doc) throw ApiError.notFound('Invoice not found');
  if (['PAID', 'PARTIALLY_PAID', 'OVERDUE'].includes(req.body.status)) throw ApiError.badRequest('Payment statuses are updated automatically when payments are recorded.');
  doc.status = req.body.status;
  if (req.body.status === 'SENT') doc.sentAt = new Date();
  if (req.body.status === 'CANCELLED') doc.cancelledAt = new Date();
  await doc.save();

  let emailResult = null;
  if (req.body.sendEmail && req.body.status === 'SENT') {
    const client = await Client.findById(doc.clientId);
    if (client?.email) {
      const org = await Organization.findById(req.organizationId);
      emailResult = await sendMail({
        to: client.email,
        subject: `${doc.type === 'QUOTATION' ? 'Quotation' : 'Invoice'} ${doc.invoiceNumber} from ${org.name}`,
        html: baseEmailHtml(`${doc.type === 'QUOTATION' ? 'Quotation' : 'Invoice'} ${doc.invoiceNumber}`, `
          <p>Dear ${client.firstName},</p>
          <p>Please find your ${doc.type.toLowerCase()} <strong>${doc.invoiceNumber}</strong> for <strong>${formatMoney(doc.total, doc.currency)}</strong>.</p>
          <p>Due date: ${doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('en-IN') : '—'}</p>
          <p>You can view and download it from your client portal.</p>
          <p style="color:#667085;font-size:12px">${org.name}</p>`),
      });
      await audit(req, 'invoice.sent', { entityType: 'Invoice', entityId: doc._id, description: `Invoice ${doc.invoiceNumber} emailed to ${client.email}` });
    } else {
      emailResult = { sent: false, error: 'Client has no email address.' };
    }
  }
  res.json({ invoice: doc, email: emailResult });
}));

router.post('/:id/payments', requirePermission(PERMISSIONS.PAYMENTS_RECORD), body(z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(PAYMENT_METHODS),
  paidAt: z.string().optional(),
  reference: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
})), asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.type === 'QUOTATION') throw ApiError.badRequest('Quotations cannot receive payments. Convert to an invoice first.');
  if (invoice.status === 'CANCELLED') throw ApiError.badRequest('Cancelled invoices cannot receive payments.');
  const amount = round2(req.body.amount);
  if (amount > invoice.balance + 0.001) throw ApiError.badRequest(`Payment exceeds the outstanding balance of ${formatMoney(invoice.balance, invoice.currency)}.`);
  const payment = await Payment.create({
    organizationId: req.organizationId, invoiceId: invoice._id, clientId: invoice.clientId,
    amount, currency: invoice.currency, method: req.body.method, status: 'SUCCESS',
    reference: req.body.reference, notes: req.body.notes,
    paidAt: req.body.paidAt ? new Date(req.body.paidAt) : new Date(), recordedBy: req.user._id,
  });
  invoice.amountPaid = round2(invoice.amountPaid + amount);
  invoice.balance = round2(invoice.total - invoice.amountPaid);
  invoice.status = invoice.balance <= 0.001 ? 'PAID' : 'PARTIALLY_PAID';
  if (invoice.status === 'PAID') invoice.balance = 0;
  await invoice.save();
  await audit(req, 'payment.recorded', { entityType: 'Payment', entityId: payment._id, description: `Payment of ${formatMoney(amount, invoice.currency)} recorded on ${invoice.invoiceNumber}` });
  res.status(201).json({ payment, invoice });
}));

router.delete('/:id/payments/:paymentId', requirePermission(PERMISSIONS.PAYMENTS_RECORD), asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  const payment = await Payment.findOneAndDelete({ _id: req.params.paymentId, invoiceId: invoice._id, organizationId: req.organizationId });
  if (!payment) throw ApiError.notFound('Payment not found');
  invoice.amountPaid = round2(Math.max(0, invoice.amountPaid - payment.amount));
  invoice.balance = round2(invoice.total - invoice.amountPaid);
  invoice.status = invoice.amountPaid <= 0.001 ? (invoice.status === 'PAID' ? 'SENT' : invoice.status) : 'PARTIALLY_PAID';
  await invoice.save();
  await audit(req, 'payment.reversed', { entityType: 'Payment', entityId: payment._id, description: `Payment reversal on ${invoice.invoiceNumber}` });
  res.json({ invoice });
}));

router.delete('/:id', requirePermission(PERMISSIONS.INVOICES_DELETE), asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, organizationId: req.organizationId });
  if (!invoice) throw ApiError.notFound('Invoice not found');
  if (invoice.amountPaid > 0) throw ApiError.badRequest('Invoices with payments cannot be deleted. Cancel instead to preserve the audit trail.');
  if (invoice.status !== 'DRAFT') throw ApiError.badRequest('Only draft invoices can be deleted. Cancel issued invoices instead.');
  await invoice.deleteOne();
  await audit(req, 'invoice.deleted', { entityType: 'Invoice', entityId: invoice._id, description: `Draft ${invoice.invoiceNumber} deleted` });
  res.json({ ok: true });
}));

/** PDF generation — streams a real PDF from the invoice record. */
router.get('/:id/pdf', requirePermission(PERMISSIONS.INVOICES_VIEW), asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ _id: req.params.id, organizationId: req.organizationId })
    .populate('clientId', 'firstName lastName reference email phone address');
  if (!invoice) throw ApiError.notFound('Invoice not found');
  const org = await Organization.findById(req.organizationId);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  doc.pipe(res);

  // Header
  doc.fillColor('#101828').fontSize(20).font('Helvetica-Bold').text(org.name, 50, 50);
  doc.font('Helvetica').fontSize(9).fillColor('#667085')
    .text([org.settings?.addressLine1, org.settings?.city, org.settings?.country].filter(Boolean).join(', ') || '', 50, 76)
    .text(org.email || '', 50, 88);
  if (org.settings?.taxNumber) doc.text(`${org.settings.taxName}: ${org.settings.taxNumber}`, 50, 100);

  doc.font('Helvetica-Bold').fontSize(22).fillColor('#2563EB').text(invoice.type === 'QUOTATION' ? 'QUOTATION' : 'INVOICE', 380, 50, { align: 'right', width: 165 });
  doc.font('Helvetica').fontSize(10).fillColor('#111827')
    .text(invoice.invoiceNumber, 380, 80, { align: 'right', width: 165 })
    .text(`Issued: ${new Date(invoice.issueDate).toLocaleDateString('en-IN')}`, 380, 94, { align: 'right', width: 165 })
    .text(`Due: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '—'}`, 380, 108, { align: 'right', width: 165 });

  // Bill to
  doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#E5E7EB').stroke();
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#667085').text('BILL TO', 50, 145);
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(`${invoice.clientId.firstName} ${invoice.clientId.lastName || ''}`, 50, 160);
  doc.font('Helvetica').fontSize(9).fillColor('#374151')
    .text(invoice.clientId.reference, 50, 175)
    .text(invoice.clientId.email || '', 50, 187)
    .text(invoice.clientId.phone || '', 50, 199);

  // Items table
  let y = 225;
  doc.rect(50, y, 495, 22).fill('#F7F9FC');
  doc.fillColor('#667085').font('Helvetica-Bold').fontSize(8)
    .text('DESCRIPTION', 58, y + 7).text('QTY', 360, y + 7, { width: 40, align: 'right' })
    .text('RATE', 410, y + 7, { width: 60, align: 'right' }).text('AMOUNT', 480, y + 7, { width: 60, align: 'right' });
  y += 30;
  doc.font('Helvetica').fontSize(9).fillColor('#111827');
  for (const item of invoice.items) {
    doc.text(item.description, 58, y, { width: 290 }).text(String(item.quantity), 360, y, { width: 40, align: 'right' })
      .text(formatMoney(item.unitPrice, invoice.currency), 410, y, { width: 60, align: 'right' })
      .text(formatMoney(item.amount, invoice.currency), 480, y, { width: 60, align: 'right' });
    y += 20;
    if (y > 680) { doc.addPage(); y = 60; }
  }

  // Totals
  y += 10;
  doc.moveTo(350, y).lineTo(545, y).strokeColor('#E5E7EB').stroke();
  y += 10;
  const line = (label, value, bold = false) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor(bold ? '#101828' : '#374151')
      .text(label, 350, y, { width: 120 }).text(value, 470, y, { width: 75, align: 'right' });
    y += bold ? 20 : 16;
  };
  line('Subtotal', formatMoney(invoice.subtotal, invoice.currency));
  if (invoice.discount > 0) line(`Discount${invoice.discountType === 'PERCENT' ? ` (${invoice.discountValue}%)` : ''}`, `- ${formatMoney(invoice.discount, invoice.currency)}`);
  if (invoice.taxAmount > 0) line(`${org.settings?.taxName || 'Tax'} (${invoice.taxRate}%)`, formatMoney(invoice.taxAmount, invoice.currency));
  doc.moveTo(350, y).lineTo(545, y).strokeColor('#E5E7EB').stroke(); y += 6;
  line('Total', formatMoney(invoice.total, invoice.currency), true);
  if (invoice.amountPaid > 0) { line('Paid', formatMoney(invoice.amountPaid, invoice.currency)); line('Balance due', formatMoney(invoice.balance, invoice.currency), true); }

  // Notes
  if (invoice.notes || invoice.terms) {
    y += 20;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#667085').text('NOTES', 50, y); y += 14;
    doc.font('Helvetica').fontSize(9).fillColor('#374151').text(invoice.notes || invoice.terms, 50, y, { width: 300 });
  }
  doc.font('Helvetica').fontSize(8).fillColor('#98A2B3').text('Generated by ImmigrationFlow · Webamazee', 50, 780, { align: 'center', width: 495 });
  doc.end();
}));

export default router;
