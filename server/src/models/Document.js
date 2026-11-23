import mongoose from 'mongoose';
import { DOC_CATEGORIES, DOC_STATUSES, VISA_CATEGORIES } from '../config/constants.js';

const versionSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  storageKey: { type: String, required: true },
  fileName: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  checksum: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedByName: String,
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const commentSchema = new mongoose.Schema({
  body: { type: String, required: true, maxlength: 2000 },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: String,
  visibility: { type: String, enum: ['INTERNAL', 'CLIENT'], default: 'INTERNAL' },
}, { timestamps: true });

const documentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImmigrationCase', index: true },
  checklistKey: { type: String, maxlength: 60 },
  category: { type: String, enum: DOC_CATEGORIES.map((d) => d.key), default: 'OTHER', index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, maxlength: 1000 },
  status: { type: String, enum: DOC_STATUSES, default: 'UPLOADED', index: true },
  isRequested: { type: Boolean, default: false }, // a requirement row before a file exists
  currentVersion: { type: Number, default: 0 },
  versions: { type: [versionSchema], default: [] },
  expiryDate: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  rejectionReason: { type: String, maxlength: 1000 },
  comments: { type: [commentSchema], default: [] },
  aiSummary: { type: mongoose.Schema.Types.Mixed, default: null },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedByName: String,
  uploadedByClient: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

documentSchema.index({ organizationId: 1, caseId: 1, status: 1 });
documentSchema.index({ organizationId: 1, clientId: 1, createdAt: -1 });
documentSchema.index({ organizationId: 1, expiryDate: 1 });
documentSchema.index({ organizationId: 1, isRequested: 1, status: 1 });

export const Document = mongoose.model('Document', documentSchema);

const checklistSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 150 },
  visaCategory: { type: String, enum: [...VISA_CATEGORIES.map((v) => v.key), 'ALL'], default: 'ALL' },
  destinationCountry: { type: String, default: 'ALL', maxlength: 5 },
  items: { type: [{ key: String, label: String, category: String, required: Boolean }], default: [] },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

checklistSchema.index({ organizationId: 1, visaCategory: 1 });

export const DocumentChecklist = mongoose.model('DocumentChecklist', checklistSchema);

export default Document;
