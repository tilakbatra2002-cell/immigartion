import mongoose from 'mongoose';
import env from '../config/env.js';

export const notFound = (req, _res, next) => next(new Error(`Route not found: ${req.method} ${req.originalUrl}`));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details || null;
  let code = err.code || null;

  if (err instanceof mongoose.Error.ValidationError) {
    status = 400; message = 'Validation failed';
    details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    code = 'VALIDATION_ERROR';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400; message = 'Invalid identifier'; code = 'BAD_REQUEST';
  } else if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyPattern || {}).filter((k) => k !== 'organizationId').join(', ');
    message = field ? `A record with this ${field} already exists` : 'Duplicate record';
    code = 'CONFLICT';
  } else if (err.type === 'entity.too.large') {
    status = 413; message = 'Request payload too large'; code = 'PAYLOAD_TOO_LARGE';
  } else if (err.name === 'MongoServerError' && /Authentication failed/i.test(err.message)) {
    status = 503; message = 'Database connection failed'; code = 'DB_UNAVAILABLE';
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    if (env.NODE_ENV === 'production' && !err.expose) message = 'Internal server error';
  }

  const body = { error: message, code: code || 'ERROR' };
  if (details) body.details = details;
  if (env.NODE_ENV !== 'production' && status >= 500) body.stack = err.stack;
  res.status(status).json(body);
}
