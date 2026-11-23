import mongoose from 'mongoose';

const aiUsageSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  feature: { type: String, enum: ['DOCUMENT_SUMMARY', 'EMAIL_DRAFT', 'CASE_SUMMARY', 'CLIENT_REPLY', 'ASSISTANT'], required: true },
  provider: { type: String, default: 'openai' },
  model: String,
  promptTokens: { type: Number, default: 0 },
  completionTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  entityType: String,
  entityId: mongoose.Schema.Types.ObjectId,
  status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
  error: String,
  latencyMs: Number,
}, { timestamps: { createdAt: true, updatedAt: false } });

aiUsageSchema.index({ organizationId: 1, createdAt: -1 });

export const AIUsage = mongoose.model('AIUsage', aiUsageSchema);
export default AIUsage;
