import { useEffect, useState } from 'react';
import { Modal, Button, Input, Textarea, Select } from '../../components/ui';
import { LEAD_SOURCES, VISA_CATEGORIES, COUNTRIES, RESIDENCE_COUNTRIES, PRIORITIES, LEAD_STATUSES } from '../../lib/constants';
import { toInputDateTime } from '../../lib/format';

const empty = {
  fullName: '', email: '', phone: '', countryOfResidence: '', destinationCountry: '', visaCategory: '',
  leadSource: 'WEBSITE', assignedToId: '', priority: 'MEDIUM', status: 'NEW', notes: '', followUpAt: '',
};

export default function LeadForm({ open, onClose, lead, team = [], saving, onSubmit, currentUserId }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        ...empty, ...lead,
        assignedToId: lead.assignedToId?._id || lead.assignedToId || '',
        followUpAt: lead.followUpAt ? toInputDateTime(lead.followUpAt) : '',
        email: lead.email || '', phone: lead.phone || '', notes: lead.notes || '',
      });
    } else {
      setForm({ ...empty, assignedToId: currentUserId || '' });
    }
    setErrors({});
  }, [open, lead, currentUserId]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (form.fullName.trim().length < 2) err.fullName = 'Full name is required.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) err.email = 'Enter a valid email address.';
    if (form.phone && form.phone.replace(/\D/g, '').length < 6) err.phone = 'Enter a valid phone number.';
    if (!form.email && !form.phone) err.phone = 'Provide an email or phone number.';
    setErrors(err);
    if (Object.keys(err).length) return;
    onSubmit({
      fullName: form.fullName.trim(), email: form.email, phone: form.phone,
      countryOfResidence: form.countryOfResidence, destinationCountry: form.destinationCountry,
      visaCategory: form.visaCategory, leadSource: form.leadSource, assignedToId: form.assignedToId || null,
      priority: form.priority, status: form.status, notes: form.notes,
      followUpAt: form.followUpAt ? new Date(form.followUpAt).toISOString() : null,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={lead ? 'Edit lead' : 'Add lead'} description={lead ? lead.fullName : 'Capture a new enquiry — only name and contact are required.'} size="lg"
      footer={<>
        <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" loading={saving} onClick={submit}>{lead ? 'Save changes' : 'Create lead'}</Button>
      </>}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Input label="Full name" required value={form.fullName} error={errors.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Priya Sharma" autoFocus />
          <Input label="Email" type="email" value={form.email} error={errors.email} onChange={(e) => set('email', e.target.value)} placeholder="priya@example.com" />
          <Input label="Phone" value={form.phone} error={errors.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
          <Select label="Country of residence" value={form.countryOfResidence} onChange={(e) => set('countryOfResidence', e.target.value)} placeholder="Select country">
            {RESIDENCE_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Select label="Destination country" value={form.destinationCountry} onChange={(e) => set('destinationCountry', e.target.value)} placeholder="Select destination">
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
          <Select label="Interested visa category" value={form.visaCategory} onChange={(e) => set('visaCategory', e.target.value)} placeholder="Select category">
            {VISA_CATEGORIES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </Select>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Select label="Lead source" value={form.leadSource} onChange={(e) => set('leadSource', e.target.value)}>
            {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (m) => m.toUpperCase())}</option>)}
          </Select>
          <Select label="Priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </Select>
          <Select label="Assigned consultant" value={form.assignedToId} onChange={(e) => set('assignedToId', e.target.value)} placeholder="Unassigned">
            {team.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
          </Select>
        </div>
        {lead && (
          <Select label="Status" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {LEAD_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
        )}
        <Input label="Follow-up date" type="datetime-local" value={form.followUpAt} onChange={(e) => set('followUpAt', e.target.value)} hint="Appears on your dashboard and follow-up reports." />
        <Textarea label="Notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Requirements, budget, timeline…" />
      </form>
    </Modal>
  );
}
