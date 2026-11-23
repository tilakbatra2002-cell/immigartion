import mongoose from 'mongoose';
import { ORG_ROLES } from '../config/permissions.js';

const membershipSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, enum: ORG_ROLES, required: true, index: true },
  status: { type: String, enum: ['ACTIVE', 'INVITED', 'DISABLED'], default: 'ACTIVE', index: true },
  title: { type: String, trim: true, maxlength: 100 },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  inviteTokenHash: { type: String, select: false },
  inviteExpires: Date,
}, { timestamps: true });

membershipSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ organizationId: 1, status: 1 });

export const Membership = mongoose.model('Membership', membershipSchema);
export default Membership;
