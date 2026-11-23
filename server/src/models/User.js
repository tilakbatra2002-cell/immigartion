import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true, maxlength: 200 },
  phone: { type: String, trim: true, maxlength: 30 },
  passwordHash: { type: String, required: true, select: false },
  avatarUrl: { type: String, default: '' },
  role: { type: String, enum: ['SAAS_ADMIN', 'ORG_USER', 'CLIENT'], default: 'ORG_USER', index: true },
  isSuperAdmin: { type: Boolean, default: false, index: true },
  emailVerified: { type: Boolean, default: false },
  emailVerifiedAt: Date,
  emailVerificationTokenHash: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  passwordResetTokenHash: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  lastLoginAt: Date,
  status: { type: String, enum: ['ACTIVE', 'INVITED', 'DISABLED'], default: 'ACTIVE', index: true },
  failedLoginAttempts: { type: Number, default: 0, select: false },
  lockedUntil: { type: Date, select: false },
  timezone: { type: String, default: '' },
}, { timestamps: true });

userSchema.index({ createdAt: -1 });

export const User = mongoose.model('User', userSchema);
export default User;
