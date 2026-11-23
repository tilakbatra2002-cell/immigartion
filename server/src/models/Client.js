import mongoose from 'mongoose';
import { COUNTRIES, RESIDENCE_COUNTRIES } from '../config/constants.js';

const destCodes = COUNTRIES.map((c) => c.code);
const residenceCodes = RESIDENCE_COUNTRIES.map((c) => c.code);

const portalAccessSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  enabled: { type: Boolean, default: false },
  invitedAt: Date,
}, { _id: false });

const familyMemberSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  relationship: { type: String, enum: ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'], default: 'OTHER' },
  dateOfBirth: Date,
  gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', ''] , default: '' },
  nationality: { type: String, trim: true, maxlength: 60 },
  passportNumberEnc: { type: String, select: false },
  passportExpiry: Date,
  dependent: { type: Boolean, default: true },
}, { timestamps: true });

familyMemberSchema.index({ organizationId: 1, clientId: 1 });

const clientSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  reference: { type: String, required: true, index: true },
  type: { type: String, enum: ['INDIVIDUAL', 'FAMILY'], default: 'INDIVIDUAL' },
  firstName: { type: String, required: true, trim: true, maxlength: 80 },
  lastName: { type: String, trim: true, maxlength: 80, default: '' },
  email: { type: String, lowercase: true, trim: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  whatsappOptIn: { type: Boolean, default: false },
  dateOfBirth: Date,
  gender: { type: String, enum: ['MALE', 'FEMALE', 'OTHER', ''], default: '' },
  nationality: { type: String, trim: true, maxlength: 60 },
  currentCountry: { type: String, enum: [...residenceCodes, ''], default: '' },
  city: { type: String, trim: true, maxlength: 100 },
  address: { type: String, trim: true, maxlength: 400 },
  preferredDestination: { type: String, enum: [...destCodes, ''], default: '' },
  // Sensitive identity fields — encrypted at rest, excluded from list APIs by default.
  passportNumberEnc: { type: String, select: false },
  passportExpiry: { type: Date, select: false },
  passportIssuingCountry: { type: String, enum: [...residenceCodes, ''], default: '' , select: false },
  assignedConsultantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  source: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  tags: [{ type: String, trim: true, maxlength: 40 }],
  notes: { type: String, maxlength: 5000 },
  portalAccess: { type: portalAccessSchema, default: () => ({}) },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ARCHIVED'], default: 'ACTIVE', index: true },
  convertedFromLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

clientSchema.index({ organizationId: 1, reference: 1 }, { unique: true });
clientSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
clientSchema.index({ organizationId: 1, email: 1 });
clientSchema.index({ organizationId: 1, assignedConsultantId: 1 });
clientSchema.index({ organizationId: 1, firstName: 'text', lastName: 'text', email: 'text' });

clientSchema.virtual('fullName').get(function () { return [this.firstName, this.lastName].filter(Boolean).join(' '); });
clientSchema.set('toJSON', { virtuals: true });
clientSchema.set('toObject', { virtuals: true });

export const Client = mongoose.model('Client', clientSchema);
export const FamilyMember = mongoose.model('FamilyMember', familyMemberSchema);
export default Client;
