import Notification from '../models/Notification.js';
import { getIO } from '../realtime.js';

export async function notify({ organizationId, userIds = [], type = 'SYSTEM', title, body, link, metadata }) {
  if (!userIds.length) return [];
  const docs = await Notification.insertMany(userIds.map((userId) => ({
    organizationId, userId, type, title, body, link, metadata,
  })));
  const io = getIO();
  if (io) {
    for (const d of docs) {
      io.to(`user:${String(d.userId)}`).emit('notification', {
        _id: d._id, type: d.type, title: d.title, body: d.body, link: d.link, createdAt: d.createdAt,
      });
    }
  }
  return docs;
}
