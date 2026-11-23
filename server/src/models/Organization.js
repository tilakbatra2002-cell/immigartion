import mongoose from 'mongoose';
import { COUNTRIES, ORG_BUSINESS_TYPES, ORG_TIMEZONES } from '../config/constants.js';

const brandingSchema = new mongoose.Schema({
  primaryColor: { type: String, default: '#2563EB', match: [/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid color'] },
  logoUrl: { type: String, default: '' },
}, { _id: false });

const settingsSchema = new mongoose.Schema({
  timezone: { type: String, enum: ORG_TIMEZONES, default: 'Asia/Kolkata' },
  currency: { type: String, enum: ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'], default: 'INR' },
  locale: { type: String, default: 'en-IN' },
  addressLine1: { type: String, trim: true, maxlength: 200 },
  addressLine2: { type: String, trim: true, maxlength: 200 },
  city: { type: String, trim: true, maxlength: 100 },
  state: { type: String, trim: true, maxlength: 100 },
  postalCode: { type: String, trim: true, maxlength: 20 },
  country: { type: String, enum: [...COUNTRIES.map((c) => c.code), 'AE', 'SG', 'OTHER'], default: 'IN' },
  taxName: { type: String, default: 'GST', maxlength: 30 },
  taxRate: { type: Number, min: 0, max: 100, default: 18 },
  taxNumber: { type: String, trim: true, maxlength: 40 },
  invoicePrefix: { type: String, default: 'INV', maxlength: 10 },
  invoiceTerms: { type: String, default: 'Payment due within 14 days.', maxlength: 1000 },
  dateFormat: { type: String, default: 'DD/MM/YYYY' },
  notifications: {
    emailOnNewLead: { type: Boolean, default: true },
    emailOnNewClient: { type: Boolean, default: false },
    dailyDigest: { type: Boolean, default: true },
    appointmentReminders: { type: Boolean, default: true },
    invoiceReminders: { type: Boolean, default: true },
  },
  roleOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
  caseWorkflow: { type: [{ status: String, label: String, order: Number, active: Boolean, terminal: Boolean }], default: undefined },
}, { _id: false });

const orgSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Organization name is required'], trim: true, maxlength: 120 },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true },
  businessType: { type: String, enum: ORG_BUSINESS_TYPES, default: 'Immigration Consultancy' },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  website: { type: String, trim: true, maxlength: 200 },
  registrationNumber: { type: String, trim: true, maxlength: 60 },
  logoUrl: { type: String, default: '' },
  branding: { type: brandingSchema, default: () => ({}) },
  settings: { type: settingsSchema, default: () => ({}) },
  onboardingCompleted: { type: Boolean, default: false },
  status: { type: String, enum: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED'], default: 'TRIAL', index: true },
  suspendedReason: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

orgSchema.index({ status: 1, createdAt: -1 });
orgSchema.index({ name: 'text' });

export const Organization = mongoose.model('Organization', orgSchema);
export default Organization;
