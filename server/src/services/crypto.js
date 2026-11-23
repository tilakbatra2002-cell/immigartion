import crypto from 'node:crypto';
import env from '../config/env.js';

/**
 * AES-256-GCM field encryption for sensitive PII (passport numbers etc.).
 * Ciphertext format: v1:<iv>:<tag>:<data> (base64url).
 *
 * The key comes from DATA_ENCRYPTION_KEY. When that is not set we fall back to a
 * value derived from JWT_ACCESS_SECRET so existing deployments keep working —
 * set DATA_ENCRYPTION_KEY in production so rotating JWT secrets never orphans PII.
 */
const KEY_SOURCE = env.DATA_ENCRYPTION_KEY || `${env.JWT_ACCESS_SECRET}:field-encryption:v1`;
const KEY = crypto.createHash('sha256').update(KEY_SOURCE).digest();

export function encryptField(plain) {
  if (plain === undefined || plain === null || plain === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join(':');
}

export function decryptField(payload) {
  if (!payload || typeof payload !== 'string' || !payload.startsWith('v1:')) return '';
  try {
    const [, ivB64, tagB64, dataB64] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/** Mask a passport/ID number for display: J836****9 */
export function maskId(value = '') {
  const s = String(value).trim();
  if (s.length <= 4) return s ? '••••' : '';
  return `${s.slice(0, 3)}${'•'.repeat(Math.max(3, s.length - 5))}${s.slice(-2)}`;
}
