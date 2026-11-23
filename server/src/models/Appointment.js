import mongoose from 'mongoose';
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '../config/constants.js';

const appointmentSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  title: { type: String, trim: true, maxlength: 200 },
  type: { type: String, enum: APPOINTMENT_TYPES, default: 'GENERAL_CONSULTATION' },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImmigrationCase', index: true },
  consultantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true },
  timezone: { type: String, default: 'Asia/Kolkata' },
  location: { type: String, maxlength: 300 },
  meetingLink: { type: String, maxlength: 500 },
  status: { type: String, enum: APPOINTMENT_STATUSES, default: 'SCHEDULED', index: true },
  notes: { type: String, maxlength: 3000 },
  reminderMinutes: { type: Number, default: 60, min: 0, max: 10080 },
  reminderSentAt: Date,
  rescheduleHistory: { type: [{ from: Date, to: Date, by: mongoose.Schema.Types.ObjectId, reason: String, at: { type: Date, default: Date.now } }], default: [] },
  cancelReason: { type: String, maxlength: 500 },
  cancelledAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

appointmentSchema.index({ organizationId: 1, startAt: 1 });
appointmentSchema.index({ organizationId: 1, consultantId: 1, startAt: 1 });
appointmentSchema.index({ organizationId: 1, clientId: 1, startAt: -1 });

export const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
