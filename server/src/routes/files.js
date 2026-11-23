import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Document from '../models/Document.js';
import { storage } from '../services/storage.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import env from '../config/env.js';

/**
 * Local-storage file delivery. The download URL contains a short-lived,
 * HMAC-signed token bound to a single storage key and organization. Every
 * request re-validates the token, expiry and organization before streaming.
 */
const router = Router();

router.get('/download', asyncHandler(async (req, res) => {
  const { key, token } = req.query;
  if (!key || !token) throw ApiError.unauthorized('Invalid download link');
  let payload;
  try { payload = jwt.verify(String(token), env.JWT_ACCESS_SECRET); } catch { throw ApiError.unauthorized('Download link expired. Request a fresh link.'); }
  if (payload.key !== key) throw ApiError.forbidden('Invalid download link');
  if (env.STORAGE_DRIVER !== 'local') throw ApiError.badRequest('Local file route disabled when S3 storage is configured.');
  if (!storage.localExists(String(key))) throw ApiError.notFound('File not found in storage');

  const doc = await Document.findOne({ organizationId: payload.org, 'versions.storageKey': key, deletedAt: null });
  if (!doc) throw ApiError.notFound('Document not found');
  const version = doc.versions.find((v) => v.storageKey === key);
  const buffer = await storage.readLocal(String(key));
  res.setHeader('Content-Type', version?.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${(version?.fileName || 'document').replace(/"/g, '')}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buffer);
}));

export default router;
