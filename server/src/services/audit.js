import AuditLog from '../models/AuditLog.js';

export async function audit(req, action, { entityType, entityId, description, metadata, organizationId } = {}) {
  try {
    await AuditLog.create({
      organizationId: organizationId ?? req.membership?.organizationId ?? null,
      actorId: req.user?._id,
      actorName: req.user?.name,
      actorRole: req.membership?.role || (req.user?.isSuperAdmin ? 'SAAS_ADMIN' : 'CLIENT'),
      action,
      entityType,
      entityId,
      description,
      metadata,
      ip: req.ip,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300),
    });
  } catch (err) {
    // Audit failures must never break the request, but they must be visible.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write entry', action, err.message);
  }
}

/** Write an audit entry without an express request (webhooks, schedulers). */
export async function auditRaw({ organizationId, actorName, actorRole, action, entityType, entityId, description, metadata }) {
  try {
    await AuditLog.create({ organizationId, actorName, actorRole, action, entityType, entityId, description, metadata });
  } catch { /* noop */ }
}
