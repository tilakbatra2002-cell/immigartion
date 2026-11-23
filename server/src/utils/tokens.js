import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');

/**
 * Accepts an ObjectId, a raw id string, or a populated organization document
 * (some call sites populate membership.organizationId). Always emits a plain id
 * string so middleware can cast it back safely.
 */
function orgIdOf(membership) {
  if (!membership) return null;
  const raw = membership.organizationId;
  if (!raw) return null;
  if (typeof raw === 'object' && raw._id) return String(raw._id);
  return String(raw);
}

export function signAccessToken(user, membership) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.isSuperAdmin ? 'SAAS_ADMIN' : membership?.role,
      org: orgIdOf(membership),
      name: user.name,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL },
  );
}

export function signRefreshToken(user, jti) {
  return jwt.sign({ sub: String(user._id), jti }, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TOKEN_DAYS}d` });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}
export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
