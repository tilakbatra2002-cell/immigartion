import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorName: String,
  actorRole: String,
  action: { type: String, required: true, maxlength: 80, index: true }, // e.g. case.status_changed, auth.login
  entityType: { type: String, maxlength: 60, index: true },
  entityId: { type: mongoose.Schema.Types.ObjectId },
  description: { type: String, maxlength: 500 },
  metadata: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String, maxlength: 60 },
  userAgent: { type: String, maxlength: 300 },
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
