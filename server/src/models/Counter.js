import mongoose from 'mongoose';

/** Atomic per-tenant sequence counters (case/lead/client/invoice references). */
const counterSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.index({ organizationId: 1, key: 1 }, { unique: true });

export async function nextSequence(organizationId, key) {
  const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
  const doc = await Counter.findOneAndUpdate(
    { organizationId, key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return doc.seq;
}

export const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);
