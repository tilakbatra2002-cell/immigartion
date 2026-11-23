import mongoose from 'mongoose';

const integrationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  scope: { type: String, enum: ['ORGANIZATION', 'PLATFORM'], default: 'ORGANIZATION', index: true },
  provider: { type: String, enum: ['SMTP', 'WHATSAPP', 'AI', 'STRIPE', 'RAZORPAY'], required: true },
  status: { type: String, enum: ['CONNECTED', 'DISCONNECTED', 'ERROR'], default: 'DISCONNECTED' },
  config: { type: mongoose.Schema.Types.Mixed, default: {} }, // secrets stored encrypted/masked
  lastCheckedAt: Date,
  lastError: String,
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

integrationSchema.index({ scope: 1, organizationId: 1, provider: 1 }, { unique: true });

export const Integration = mongoose.model('Integration', integrationSchema);
export default Integration;
