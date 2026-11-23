import mongoose from 'mongoose';
import { MESSAGE_CHANNELS, MESSAGE_DIRECTIONS } from '../config/constants.js';

const conversationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  subject: { type: String, trim: true, maxlength: 250 },
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImmigrationCase', index: true },
  channel: { type: String, enum: MESSAGE_CHANNELS, default: 'EMAIL' },
  participantEmails: [{ type: String, lowercase: true }],
  participantPhones: [{ type: String }],
  lastMessageAt: Date,
  lastMessagePreview: { type: String, maxlength: 300 },
  unreadForStaff: { type: Number, default: 0 },
  unreadForClient: { type: Number, default: 0 },
  status: { type: String, enum: ['OPEN', 'ARCHIVED'], default: 'OPEN' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

conversationSchema.index({ organizationId: 1, lastMessageAt: -1 });
conversationSchema.index({ organizationId: 1, clientId: 1, channel: 1 });

export const Conversation = mongoose.model('Conversation', conversationSchema);

const messageSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  channel: { type: String, enum: MESSAGE_CHANNELS, default: 'EMAIL' },
  direction: { type: String, enum: MESSAGE_DIRECTIONS, required: true },
  status: { type: String, enum: ['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED', 'DRAFT'], default: 'QUEUED' },
  provider: { type: String, default: 'internal' },
  providerMessageId: String,
  from: { type: String, maxlength: 250 },
  to: [{ type: String, maxlength: 250 }],
  subject: { type: String, maxlength: 250 },
  body: { type: String, maxlength: 20000 },
  html: { type: String, maxlength: 50000 },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: String,
  isClientMessage: { type: Boolean, default: false },
  attachments: { type: [{ documentId: mongoose.Schema.Types.ObjectId, name: String }], default: [] },
  error: String,
  readAt: Date,
  sentAt: Date,
  externalId: String,
}, { timestamps: true });

messageSchema.index({ organizationId: 1, conversationId: 1, createdAt: -1 });
messageSchema.index({ organizationId: 1, channel: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);

const templateSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  channel: { type: String, enum: MESSAGE_CHANNELS, default: 'EMAIL' },
  category: { type: String, enum: ['GENERAL', 'DOCUMENT_REMINDER', 'FOLLOW_UP', 'INVOICE', 'APPOINTMENT', 'WELCOME', 'CASE_UPDATE'], default: 'GENERAL' },
  subject: { type: String, maxlength: 250 },
  body: { type: String, required: true, maxlength: 20000 },
  variables: [{ type: String }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

templateSchema.index({ organizationId: 1, category: 1 });

export const MessageTemplate = mongoose.model('MessageTemplate', templateSchema);

export default Conversation;
