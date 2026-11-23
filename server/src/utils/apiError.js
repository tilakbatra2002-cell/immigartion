export class ApiError extends Error {
  constructor(status, message, details = null, code = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.code = code;
  }
  static badRequest(msg = 'Invalid request', details) { return new ApiError(400, msg, details, 'BAD_REQUEST'); }
  static unauthorized(msg = 'Authentication required') { return new ApiError(401, msg, null, 'UNAUTHORIZED'); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new ApiError(403, msg, null, 'FORBIDDEN'); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg, null, 'NOT_FOUND'); }
  static conflict(msg = 'Resource already exists') { return new ApiError(409, msg, null, 'CONFLICT'); }
  static upgradeRequired(msg = 'Your plan does not include this feature', details) { return new ApiError(402, msg, details, 'UPGRADE_REQUIRED'); }
  static limitReached(msg = 'Plan limit reached', details) { return new ApiError(402, msg, details, 'LIMIT_REACHED'); }
  static tooMany(msg = 'Too many requests') { return new ApiError(429, msg, null, 'RATE_LIMITED'); }
  static serviceUnavailable(msg = 'Service unavailable') { return new ApiError(503, msg, null, 'UNAVAILABLE'); }
}
