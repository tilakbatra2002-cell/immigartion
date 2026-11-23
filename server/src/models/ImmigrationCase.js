import mongoose from 'mongoose';
import { CASE_STATUSES, COUNTRIES, PRIORITIES, VISA_CATEGORIES } from '../config/constants.js';

const checklistItemSchema = new mongoose.Schema({
  key: { type: String, required: true, maxlength: 60 },
  label: { type: String, required: true, maxlength: 200 },
  category: { type: String, required: true, maxlength: 60 },
  required: { type: Boolean, default: true },
  status: { type: String, enum: ['REQUIRED', 'UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'WAIVED'], default: 'REQUIRED' },
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  comments: { type: String, maxlength: 1000 },
}, { _id: false });

const caseSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  reference: { type: String, required: true, index: true },
  title: { type: String, trim: true, maxlength: 200 },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  destinationCountry: { type: String, enum: COUNTRIES.map((c) => c.code), required: true, index: true },
  visaCategory: { type: String, enum: VISA_CATEGORIES.map((v) => v.key), required: true, index: true },
  consultantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  caseManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  applicationDate: Date,
  targetDeadline: { type: Date, index: true },
  priority: { type: String, enum: PRIORITIES, default: 'MEDIUM', index: true },
  status: { type: String, default: 'INITIAL_ENQUIRY', index: true },
  statusChangedAt: { type: Date, default: Date.now },
  internalNotes: { type: String, maxlength: 10000 },
  clientVisibleNotes: { type: String, maxlength: 5000 },
  documentChecklist: { type: [checklistItemSchema], default: [] },
  checklistTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'DocumentChecklist' },
  fees: {
    currency: { type: String, enum: ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'], default: 'INR' },
    agreedAmount: { type: Number, min: 0, default: 0 },
  },
  completionReason: { type: String, maxlength: 500 },
  closedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

caseSchema.index({ organizationId: 1, reference: 1 }, { unique: true });
caseSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
caseSchema.index({ organizationId: 1, clientId: 1, status: 1 });
caseSchema.index({ organizationId: 1, targetDeadline: 1 });
caseSchema.index({ organizationId: 1, consultantId: 1, status: 1 });

caseSchema.pre('validate', function (next) {
  if (!this.title) {
    const visa = VISA_CATEGORIES.find((v) => v.key === this.visaCategory)?.label || 'Immigration';
    const dest = COUNTRIES.find((c) => c.code === this.destinationCountry)?.name || '';
    this.title = `${visa} – ${dest}`.trim();
  }
  next();
});

export const ImmigrationCase = mongoose.model('ImmigrationCase', caseSchema);

const timelineSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImmigrationCase', required: true, index: true },
  type: { type: String, enum: ['STATUS_CHANGE', 'NOTE', 'DOCUMENT', 'TASK', 'APPOINTMENT', 'COMMUNICATION', 'ASSIGNMENT', 'CLIENT_UPDATE', 'CREATED', 'DEADLINE'], required: true },
  title: { type: String, required: true, maxlength: 300 },
  description: { type: String, maxlength: 3000 },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  actorName: String,
  visibility: { type: String, enum: ['INTERNAL', 'CLIENT'], default: 'INTERNAL' },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

timelineSchema.index({ organizationId: 1, caseId: 1, createdAt: -1 });

export const CaseTimeline = mongoose.model('CaseTimeline', timelineSchema);

export default ImmigrationCase;
