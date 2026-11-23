import { useEffect, useState } from 'react';
import { Modal, Button, Input, Textarea, Select, Checkbox } from '../../components/ui';
import { COUNTRIES, RESIDENCE_COUNTRIES } from '../../lib/constants';
import { toInputDate } from '../../lib/format';

const empty = {
  firstName: '', lastName: '', email: '', phone: '', whatsappOptIn: false, dateOfBirth: '', gender: '',
  nationality: '', currentCountry: '', city: '', address: '', preferredDestination: '',
  assignedConsultantId: '', notes: '', passportNumber: '', passportExpiry: '', passportIssuingCountry: '', tags: '',
};

export default function ClientForm({ open, onClose, client, team = [], saving, onSubmit, canSensitive }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm(client ? {
      ...empty, ...client,
      assignedConsultantId: client.assignedConsultantId?._id || client.assignedConsultantId || '',
      dateOfBirth: toInputDate(client.dateOfBirth), passportExpiry: toInputDate(client.passportExpiry),
      passportNumber: client.passportNumber || '', tags: (client.tags || []).join(', '),
      email: client.email || '', phone: client.phone || '', notes: client.notes || '', nationality: client.nationality || '',
    } : empty);
    setErrors({});
  }, [open, client]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (form.firstName.trim().length < 1) err.firstName = 'First name is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = 'Enter a valid email.';
    if (form.phone && form.phone.replace(/\D/g, '').length < 6) err.phone = 'Enter a valid phone number.';
    if (form.passportNumber && !form.passportExpiry) err.passportExpiry = 'Add the passport expiry date for expiry tracking.';
    setErrors(err);
    if (Object.keys(err).length) return;
    const payload = { ...form, tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10) : [] };
    delete payload._id; delete payload.organizationId; delete payload.reference; delete payload.createdAt; delete payload.updatedAt; delete payload.__v;
    payload.assignedConsultantId = form.assignedConsultantId || null;
    if (!canSensitive) { delete payload.passportNumber; delete payload.passportExpiry; }
    onSubmit(payload);
  };

  return (
    <Modal open={open} onClose={onClose} title={client ? 'Edit client' : 'Add client'} size="lg"
      description={client ? client.reference : 'Create a client profile. Passport data is encrypted at rest.'}
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={saving} onClick={submit}>{client ? 'Save changes' : 'Create client'}</Button></>}>
      <form onSubmit={submit} className="space-y-5">
        <section>
          <h3 className="mb-2.5 text-2xs font-bold uppercase tracking-wider text-ink-faint">Personal information</h3>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input label="First name" required value={form.firstName} error={errors.firstName} onChange={(e) => set('firstName', e.target.value)} />
            <Input label="Last name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
            <Input label="Email" type="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="Phone" value={form.phone} error={errors.phone} onChange={(e) => set('phone', e.target.value)} />
            <Input label="Date of birth" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
            <Select label="Gender" value={form.gender} onChange={(e) => set('gender', e.target.value)} placeholder="Select">
              <option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option>
            </Select>
            <Input label="Nationality" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="e.g. Indian" />
            <Select label="Assigned consultant" value={form.assignedConsultantId} onChange={(e) => set('assignedConsultantId', e.target.value)} placeholder="Unassigned">
              {team.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
            </Select>
          </div>
        </section>

        <section>
          <h3 className="mb-2.5 text-2xs font-bold uppercase tracking-wider text-ink-faint">Location</h3>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Select label="Current country" value={form.currentCountry} onChange={(e) => set('currentCountry', e.target.value)} placeholder="Select country">
              {RESIDENCE_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
            <Select label="Preferred destination" value={form.preferredDestination} onChange={(e) => set('preferredDestination', e.target.value)} placeholder="Select destination">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </Select>
            <Input label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
            <Input label="Address" value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>
        </section>

        {canSensitive && (
          <section>
            <h3 className="mb-2.5 flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-ink-faint">
              Passport & identity <span className="rounded bg-amber-50 px-1 py-px text-[9px] font-semibold normal-case text-amber-700 ring-1 ring-amber-200">Encrypted</span>
            </h3>
            <div className="grid gap-3.5 sm:grid-cols-3">
              <Input label="Passport number" value={form.passportNumber} onChange={(e) => set('passportNumber', e.target.value)} placeholder="Z1234567" autoComplete="off" />
              <Input label="Expiry date" type="date" value={form.passportExpiry} error={errors.passportExpiry} onChange={(e) => set('passportExpiry', e.target.value)} />
              <Select label="Issuing country" value={form.passportIssuingCountry} onChange={(e) => set('passportIssuingCountry', e.target.value)} placeholder="Select">
                {RESIDENCE_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </Select>
            </div>
            <p className="mt-2 text-2xs text-ink-faint">Stored encrypted (AES-256-GCM) and excluded from list APIs, exports and analytics.</p>
          </section>
        )}

        <section className="grid gap-3.5">
          <Input label="Tags" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="high-value, spouse-visa, referral" hint="Comma separated, max 10." />
          <Textarea label="Internal notes" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          <Checkbox label="Client consents to WhatsApp communication" checked={form.whatsappOptIn} onChange={(e) => set('whatsappOptIn', e.target.checked)} />
        </section>
      </form>
    </Modal>
  );
}
