import bcrypt from 'bcryptjs';
import { ApiError } from './apiError.js';

const MIN = 8;
export function assertPasswordPolicy(pw = '') {
  if (pw.length < MIN) throw ApiError.badRequest(`Password must be at least ${MIN} characters`);
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) throw ApiError.badRequest('Password must contain at least one letter and one number');
  if (pw.length > 200) throw ApiError.badRequest('Password is too long');
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 12);
}
export async function verifyPassword(pw, hash) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}
