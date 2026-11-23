import User from '../models/User.js';
import Membership from '../models/Membership.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { ApiError } from '../utils/apiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { effectivePermissions } from '../config/permissions.js';
import { getAccess } from '../services/plans.js';

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/** Hard authentication: resolves user, membership and effective permissions. */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required');
  let payload;
  try { payload = verifyAccessToken(token); } catch { throw ApiError.unauthorized('Session expired. Please sign in again.'); }

  const user = await User.findById(payload.sub);
  if (!user || user.status === 'DISABLED') throw ApiError.unauthorized('Account is not active');

  let membership = null;
  if (payload.org) {
    membership = await Membership.findOne({ userId: user._id, organizationId: payload.org });
    if (!membership) throw ApiError.forbidden('You are not a member of this organization');
    if (membership.status !== 'ACTIVE') throw ApiError.forbidden('Your membership in this organization is not active');
  }

  req.user = user;
  req.membership = membership;
  req.permissions = user.isSuperAdmin
    ? ['*']
    : membership ? effectivePermissions(membership.role, membership.organization?.settings?.roleOverrides) : [];
  next();
});

/** Tenant-scoped route. Rejects super-admins trying to act inside tenant APIs without an org. */
export const requireOrg = asyncHandler(async (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.membership) return next(ApiError.forbidden('No organization context. Sign in to a workspace.'));
  const org = await getAccess(req.membership.organizationId);
  if (org.blocked && req.method !== 'GET') {
    return next(new ApiError(402, 'Your subscription has expired. Renew your plan to make changes.', { reason: org.reason }, 'SUBSCRIPTION_EXPIRED'));
  }
  req.org = org.org;
  req.subscription = org.subscription;
  req.plan = org.plan;
  req.accessBlocked = org.blocked;
  // Always scope org id from the authenticated membership, never from client input.
  req.organizationId = req.membership.organizationId;
  next();
});

/** Require any one of the listed permissions. Wildcard '*' (super admin) always passes. */
export const requirePermission = (...permissions) => (req, _res, next) => {
  if (!req.permissions) return next(ApiError.unauthorized());
  if (req.permissions.includes('*')) return next();
  const ok = permissions.some((p) => req.permissions.includes(p));
  if (!ok) return next(ApiError.forbidden(`Missing permission: ${permissions.join(' or ')}`));
  next();
};

export const requireSuperAdmin = (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!req.user.isSuperAdmin) return next(ApiError.forbidden('Platform administrator access required'));
  next();
};

/** Client-portal authentication. */
export const requireClient = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw ApiError.unauthorized();
  if (req.user.role !== 'CLIENT') throw ApiError.forbidden('Client portal access required');
  const Client = (await import('../models/Client.js')).default;
  const client = await Client.findOne({ 'portalAccess.userId': req.user._id, 'portalAccess.enabled': true });
  if (!client) throw ApiError.forbidden('No portal profile is linked to this account. Contact your consultant.');
  req.client = client;
  req.organizationId = client.organizationId;
  next();
});
