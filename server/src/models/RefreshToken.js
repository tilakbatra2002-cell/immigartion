import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  tokenHash: { type: String, required: true, unique: true },
  userAgent: { type: String, maxlength: 300 },
  ip: { type: String, maxlength: 60 },
  expiresAt: { type: Date, required: true },
  revokedAt: Date,
  replacedByHash: { type: String },
}, { timestamps: true });

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
