import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import env from '../config/env.js';

const ROOT = path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);

function localPath(key) {
  const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
  return path.join(ROOT, safe);
}

let s3 = null;
if (env.STORAGE_DRIVER === 's3') {
  s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
}

export const storage = {
  driver: env.STORAGE_DRIVER,

  async put(key, buffer, contentType) {
    if (s3) {
      await s3.send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: buffer, ContentType: contentType, ServerSideEncryption: 'AES256' }));
      return;
    }
    const filePath = localPath(key);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, buffer, { mode: 0o600 });
  },

  async getSignedDownloadUrl(key, { expiresIn = 300, fileName } = {}) {
    if (s3) {
      const cmd = new GetObjectCommand({
        Bucket: env.S3_BUCKET, Key: key,
        ResponseContentDisposition: fileName ? `attachment; filename="${fileName.replace(/"/g, '')}"` : undefined,
      });
      return getSignedUrl(s3, cmd, { expiresIn });
    }
    // Local driver: the API serves the file through an HMAC-signed, short-lived token bound to this key.
    const { default: jwt } = await import('jsonwebtoken');
    const envMod = await import('../config/env.js');
    const orgId = key.split('/')[0];
    const token = jwt.sign({ key, org: orgId }, envMod.default.JWT_ACCESS_SECRET, { expiresIn });
    return `/api/files/download?key=${encodeURIComponent(key)}&token=${token}`;
  },

  async readLocal(key) {
    return fsp.readFile(localPath(key));
  },

  localExists(key) {
    return fs.existsSync(localPath(key));
  },

  async remove(key) {
    if (s3) {
      try { await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })); } catch { /* missing */ }
      return;
    }
    await fsp.rm(localPath(key), { force: true });
  },
};

/** Build an unguessable, non-enumerable storage key. */
export function buildStorageKey({ organizationId, scope, fileName }) {
  const ext = path.extname(fileName || '').slice(0, 12).toLowerCase().replace(/[^.a-z0-9]/g, '');
  const id = crypto.randomBytes(16).toString('hex');
  const date = new Date().toISOString().slice(0, 10);
  return `${organizationId}/${scope}/${date}/${id}${ext}`;
}

/** Very small "signature" check: verify magic bytes match the declared mime type. */
export function sniffMimeOk(buffer, mime) {
  if (!buffer || buffer.length < 4) return false;
  const b = buffer;
  const starts = (...bytes) => bytes.every((v, i) => b[i] === v);
  switch (mime) {
    case 'application/pdf': return b.slice(0, 5).toString() === '%PDF-';
    case 'image/jpeg': return starts(0xff, 0xd8, 0xff);
    case 'image/png': return starts(0x89, 0x50, 0x4e, 0x47);
    case 'image/webp': return b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP';
    case 'image/tiff': return starts(0x49, 0x49) || starts(0x4d, 0x4d);
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return starts(0x50, 0x4b) || starts(0xd0, 0xcf); // zip (docx) or OLE (doc)
    default: return true;
  }
}
