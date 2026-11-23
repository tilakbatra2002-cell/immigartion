import { Server } from 'socket.io';
import { verifyAccessToken } from './utils/tokens.js';
import env from './config/env.js';
import { isAllowedOrigin } from './services/corsOrigins.js';

let io = null;

export function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: (o, cb) => (isAllowedOrigin(o) ? cb(null, true) : cb(new Error('Not allowed by CORS'))), credentials: true },
    path: '/socket.io',
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = verifyAccessToken(token);
      socket.userId = String(payload.sub);
      socket.orgId = payload.org ? String(payload.org) : null;
      if (!socket.orgId) return next(new Error('Organization context required'));
      next();
    } catch { next(new Error('Unauthorized')); }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    socket.join(`org:${socket.orgId}`);
  });

  return io;
}

export const getIO = () => io;

/** Emit a tenant-scoped event to every connected user of an organization. */
export function emitToOrg(organizationId, event, payload) {
  if (io) io.to(`org:${String(organizationId)}`).emit(event, payload);
}
