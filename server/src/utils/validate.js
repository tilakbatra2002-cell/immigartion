import { ApiError } from './apiError.js';

const flatten = (issues) => {
  const out = {};
  for (const i of issues) {
    const key = i.path.join('.') || '_';
    if (!out[key]) out[key] = i.message;
  }
  return out;
};

/** Validate `data` with a zod schema; throws a 400 ApiError with field-level details. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) throw ApiError.badRequest('Validation failed', flatten(result.error.issues));
  return result.data;
}

export const body = (schema) => (req, _res, next) => {
  try {
    req.body = parse(schema, req.body ?? {});
    next();
  } catch (e) { next(e); }
};

export const query = (schema) => (req, _res, next) => {
  try {
    req.validatedQuery = parse(schema, req.query ?? {});
    next();
  } catch (e) { next(e); }
};
