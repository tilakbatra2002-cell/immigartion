import mongoose from 'mongoose';
import { INVOICE_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from '../config/constants.js';
import { computeInvoiceTotals } from '../utils/money.js';

const itemSchema = new mongoose.Schema({
  description: { type: String, required: true, maxlength: 300 },
  quantity: { type: Number, required: true, min: 0.01 },
  unitPrice: { type: Number, required: true, min: 0 },
  amount: { type: Number, default: 0, min: 0 }, // computed in pre-save hook
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  invoiceNumber: { type: String, required: true },
  type: { type: String, enum: ['QUOTATION', 'INVOICE'], default: 'INVOICE' },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImmigrationCase', index: true },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  currency: { type: String, enum: ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'], default: 'INR' },
  items: { type: [itemSchema], default: [] },
  subtotal: { type: Number, default: 0 },
  discountType: { type: String, enum: ['FIXED', 'PERCENT'], default: 'FIXED' },
  discountValue: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  taxRate: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  amountPaid: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  status: { type: String, enum: INVOICE_STATUSES, default: 'DRAFT', index: true },
  notes: { type: String, maxlength: 2000 },
  terms: { type: String, maxlength: 2000 },
  sentAt: Date,
  lastReminderAt: Date,
  cancelledAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

invoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ organizationId: 1, status: 1, issueDate: -1 });
invoiceSchema.index({ organizationId: 1, clientId: 1, createdAt: -1 });
invoiceSchema.index({ organizationId: 1, dueDate: 1 });

invoiceSchema.pre('save', function (next) {
  const totals = computeInvoiceTotals(this);
  this.items = totals.items;
  this.subtotal = totals.subtotal;
  this.discount = totals.discount;
  this.taxAmount = totals.taxAmount;
  this.total = totals.total;
  this.balance = Math.max(0, Math.round((this.total - (this.amountPaid || 0)) * 100) / 100);
  if (this.dueDate && this.balance > 0 && !['PAID', 'CANCELLED', 'DRAFT'].includes(this.status) && this.dueDate < new Date()) {
    this.status = 'OVERDUE';
  }
  next();
});

export const Invoice = mongoose.model('Invoice', invoiceSchema);

const paymentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
  amount: { type: Number, required: true, min: 0.01 },
  currency: { type: String, enum: ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'], default: 'INR' },
  method: { type: String, enum: PAYMENT_METHODS, default: 'BANK_TRANSFER' },
  status: { type: String, enum: PAYMENT_STATUSES, default: 'SUCCESS' },
  reference: { type: String, maxlength: 200 },
  paidAt: { type: Date, default: Date.now },
  notes: { type: String, maxlength: 1000 },
  providerData: { type: mongoose.Schema.Types.Mixed },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

paymentSchema.index({ organizationId: 1, paidAt: -1 });
paymentSchema.index({ organizationId: 1, invoiceId: 1 });

export const Payment = mongoose.model('Payment', paymentSchema);

export default Invoice;
