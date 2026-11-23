import mongoose from 'mongoose';
import { TASK_PRIORITIES, TASK_RECURRENCE, TASK_STATUSES } from '../config/constants.js';

const taskSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, required: [true, 'Task title is required'], trim: true, maxlength: 200 },
  description: { type: String, maxlength: 3000 },
  assignedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priority: { type: String, enum: TASK_PRIORITIES, default: 'MEDIUM' },
  status: { type: String, enum: TASK_STATUSES, default: 'OPEN', index: true },
  dueAt: { type: Date, index: true },
  relatedType: { type: String, enum: ['LEAD', 'CLIENT', 'CASE', 'NONE'], default: 'NONE' },
  relatedId: { type: mongoose.Schema.Types.ObjectId },
  recurrence: { type: String, enum: TASK_RECURRENCE, default: 'NONE' },
  recurrenceUntil: Date,
  reminderAt: Date,
  completedAt: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastReminderSentAt: Date,
}, { timestamps: true });

taskSchema.index({ organizationId: 1, status: 1, dueAt: 1 });
taskSchema.index({ organizationId: 1, assignedToId: 1, status: 1 });
taskSchema.index({ organizationId: 1, relatedType: 1, relatedId: 1 });

export const Task = mongoose.model('Task', taskSchema);
export default Task;
