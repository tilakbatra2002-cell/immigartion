import mongoSanitize from 'express-mongo-sanitize';
import crypto from 'node:crypto';
import env from '../config/env.js';
import { isAllowedOrigin } from '../services/corsOrigins.js';

/** Reject payloads containing MongoDB operators or prototype-pollution keys. */
export function sanitizeInput(req, res, next) {
  const walk = (v, depth = 0) => {
    if (depth > 8) return;
    if (v && typeof v === 'object') {
      for (const key of Object.keys(v)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
          const e = new Error('Invalid payload');
          e.status = 400; e.code = 'BAD_REQUEST';
          throw e;
        }
        walk(v[key], depth + 1);
      }
    }
  };
  try {
    walk(req.body); walk(req.params);
  } catch (e) { return next(e); }
  return mongoSanitize({
    replaceWith: '_',
    allowDots: false,
  })(req, res, next);
}

/** CSRF protection for cookie-based refresh/logout endpoints.
 *  Access-token APIs are protected by the Bearer requirement (not cookie-authenticated),
 *  so they are not susceptible to classic CSRF. Refresh uses SameSite=strict + origin check. */
export function verifyOrigin(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.headers.origin || req.headers.referer || '';
  if (!origin) return next(); // non-browser clients (server-to-server) carry no Origin
  if (!isAllowedOrigin(origin)) {
    const e = new Error('Request origin not allowed');
    e.status = 403; e.code = 'BAD_ORIGIN';
    return next(e);
  }
  return next();
}

export const requestId = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};

/** Verify Razorpay webhook signature (HMAC SHA256 of raw body). */
export function verifyRazorpaySignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); } catch { return false; }
}

/** Verify Stripe webhook signature (t=timestamp,v1=signature scheme). */
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=')));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > toleranceSec) return false;
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1 || '')); } catch { return false; }
}
