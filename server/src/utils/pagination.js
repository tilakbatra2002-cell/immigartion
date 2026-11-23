import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(60).optional(),
  q: z.string().max(200).optional(),
});

export function paginate(query, { page = 1, limit = 20, sort = '-createdAt' }) {
  const skip = (Math.max(1, page) - 1) * limit;
  return query.skip(skip).limit(limit).sort(sort);
}

export function pageMeta(total, page, limit) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return { total, page, limit, pages, hasNext: page < pages, hasPrev: page > 1 };
}

export function escapeRegex(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
