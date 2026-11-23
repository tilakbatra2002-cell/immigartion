import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

const base = {
  windowMs: env.RATE_LIMIT_WINDOW_MIN * 60 * 1000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
};

export const apiLimiter = rateLimit({ ...base, limit: env.RATE_LIMIT_MAX });
export const loginLimiter = rateLimit({
  ...base, limit: env.LOGIN_RATE_LIMIT_MAX, skip: () => env.NODE_ENV === 'test',
  message: { error: 'Too many sign-in attempts. Please wait and try again.', code: 'RATE_LIMITED' },
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email || '').toLowerCase().slice(0, 80)}`,
});
export const aiLimiter = rateLimit({
  ...base, limit: 30, windowMs: 60 * 1000, skip: () => env.NODE_ENV === 'test',
  message: { error: 'AI requests are limited per minute. Please retry shortly.', code: 'RATE_LIMITED' },
});
export const uploadLimiter = rateLimit({
  ...base, limit: 60, windowMs: 60 * 1000, skip: () => env.NODE_ENV === 'test',
  message: { error: 'Too many uploads. Please retry shortly.', code: 'RATE_LIMITED' },
});
