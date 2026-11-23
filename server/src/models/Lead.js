import mongoose from 'mongoose';
import { COUNTRIES, LEAD_SOURCES, LEAD_STATUSES, PRIORITIES, VISA_CATEGORIES } from '../config/constants.js';

const noteSchema = new mongoose.Schema({
  body: { type: String, required: true, maxlength: 4000 },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: String,
}, { timestamps: true });

const leadSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  fullName: { type: String, required: [true, 'Full name is required'], trim: true, maxlength: 120 },
  email: { type: String, lowercase: true, trim: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  countryOfResidence: { type: String, trim: true, maxlength: 60 },
  destinationCountry: { type: String, enum: [...COUNTRIES.map((c) => c.code), ''], default: '' },
  visaCategory: { type: String, enum: [...VISA_CATEGORIES.map((v) => v.key), ''], default: '' },
  leadSource: { type: String, enum: LEAD_SOURCES, default: 'WEBSITE' },
  assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  priority: { type: String, enum: PRIORITIES, default: 'MEDIUM' },
  status: { type: String, enum: LEAD_STATUSES.map((s) => s.key), default: 'NEW', index: true },
  notes: { type: String, maxlength: 5000 },
  noteEntries: { type: [noteSchema], default: [] },
  followUpAt: { type: Date, index: true },
  lastContactedAt: Date,
  lostReason: { type: String, maxlength: 500 },
  convertedClientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  convertedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

leadSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
leadSchema.index({ organizationId: 1, assignedToId: 1 });
leadSchema.index({ organizationId: 1, email: 1 });
leadSchema.index({ organizationId: 1, followUpAt: 1 });

export const Lead = mongoose.model('Lead', leadSchema);
export default Lead;
