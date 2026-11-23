import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button, Input, Textarea, Select } from '../../components/ui';
import { VISA_CATEGORIES, COUNTRIES, PRIORITIES } from '../../lib/constants';
import { api } from '../../lib/api';

const empty = {
  clientId: '', destinationCountry: '', visaCategory: '', title: '', consultantId: '', caseManagerId: '',
  applicationDate: '', targetDeadline: '', priority: 'MEDIUM', internalNotes: '', clientVisibleNotes: '', checklistTemplateId: '',
  fees: { currency: 'INR', agreedAmount: 0 },
};

export default function CaseForm({ open, onClose, team = [], saving, onSubmit, prefillClient }) {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [clientSearch, setClientSearch] = useState('');

  const clients = useQuery({
    queryKey: ['clients', 'picker', clientSearch],
    queryFn: () => api.get(`/clients?limit=20&status=ACTIVE&q=${encodeURIComponent(clientSearch)}`),
    enabled: open,
  });
  const templates = useQuery({ queryKey: ['checklists'], queryFn: () => api.get('/documents/checklists/list'), enabled: open });

  useEffect(() => {
    if (!open) return;
    setForm({ ...empty, clientId: prefillClient || '' });
    setErrors({});
  }, [open, prefillClient]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (!form.clientId) err.clientId = 'Select a client.';
    if (!form.destinationCountry) err.destinationCountry = 'Select a destination country.';
    if (!form.visaCategory) err.visaCategory = 'Select a visa category.';
    setErrors(err);
    if (Object.keys(err).length) return;
    onSubmit({
      clientId: form.clientId, destinationCountry: form.destinationCountry, visaCategory: form.visaCategory,
      title: form.title || undefined, consultantId: form.consultantId || null, caseManagerId: form.caseManagerId || null,
      applicationDate: form.applicationDate || '', targetDeadline: form.targetDeadline || '', priority: form.priority,
      internalNotes: form.internalNotes, clientVisibleNotes: form.clientVisibleNotes,
      checklistTemplateId: form.checklistTemplateId || undefined,
      fees: { currency: form.fees.currency, agreedAmount: Number(form.fees.agreedAmount) || 0 },
    });
  };

  const selectedClient = clients.data?.data?.find((c) => c._id === form.clientId);

  return (
    <Modal open={open} onClose={onClose} title="New immigration case" size="lg"
      description="A document checklist is attached automatically based on the visa category."
      footer={<><Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" loading={saving} onClick={submit}>Create case</Button></>}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink">Client <span className="text-red-500">*</span></label>
          {!selectedClient ? (
            <>
              <Input placeholder="Search clients by name or reference…" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} error={errors.clientId} />
              <div className="mt-1.5 max-h-36 overflow-y-auto rounded-lg border border-line">
                {clients.isLoading ? <p className="p-3 text-xs text-ink-faint">Searching…</p>
                  : !clients.data?.data?.length ? <p className="p-3 text-xs text-ink-faint">No active clients found. Convert a lead first.</p>
                  : clients.data.data.map((c) => (
                    <button key={c._id} type="button" onClick={() => set('clientId', c._id)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-50">
                      <span className="font-medium text-ink">{c.firstName} {c.lastName}</span><span className="font-ui text-2xs text-ink-faint">{c.reference}</span>
                    </button>
                  ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-25 px-3 py-2">
              <span className="text-xs font-semibold text-ink">{selectedClient.firstName} {selectedClient.lastName} <span className="font-ui font-normal text-ink-faint">· {selectedClient.reference}</span></span>
              <button type="button" onClick={() => set('clientId', '')} className="text-2xs font-semibold text-brand-700">Change</button>
            </div>
          )}
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Select label="Destination country" required value={form.destinationCountry} error={errors.destinationCountry} onChange={(e) => set('destinationCountry', e.target.value)} placeholder="Select country">
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </Select>
          <Select label="Visa category" required value={form.visaCategory} error={errors.visaCategory} onChange={(e) => set('visaCategory', e.target.value)} placeholder="Select category">
            {VISA_CATEGORIES.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
          </Select>
        </div>

        <Input label="Case title (optional)" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Auto-generated from category and destination" />

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Select label="Assigned consultant" value={form.consultantId} onChange={(e) => set('consultantId', e.target.value)} placeholder="Me (default)">
            {team.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
          </Select>
          <Select label="Case manager" value={form.caseManagerId} onChange={(e) => set('caseManagerId', e.target.value)} placeholder="Optional">
            {team.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
          </Select>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Input label="Application date" type="date" value={form.applicationDate} onChange={(e) => set('applicationDate', e.target.value)} />
          <Input label="Target deadline" type="date" value={form.targetDeadline} onChange={(e) => set('targetDeadline', e.target.value)} />
          <Select label="Priority" value={form.priority} onChange={(e) => set('priority', e.target.value)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
          </Select>
        </div>

        <Select label="Document checklist template" value={form.checklistTemplateId} onChange={(e) => set('checklistTemplateId', e.target.value)} placeholder="Default for this visa category">
          {(templates.data?.data || []).map((t) => <option key={t._id} value={t._id}>{t.name} ({t.visaCategory === 'ALL' ? 'all categories' : t.visaCategory.replace(/_/g, ' ')})</option>)}
        </Select>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Select label="Fee currency" value={form.fees.currency} onChange={(e) => setForm({ ...form, fees: { ...form.fees, currency: e.target.value } })}>
            {['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Input label="Agreed fee" type="number" min="0" value={form.fees.agreedAmount} onChange={(e) => setForm({ ...form, fees: { ...form.fees, agreedAmount: e.target.value } })} className="sm:col-span-2" />
        </div>

        <Textarea label="Internal notes (staff only)" rows={2} value={form.internalNotes} onChange={(e) => set('internalNotes', e.target.value)} hint="Never shown to the client in the portal." />
        <Textarea label="Client-visible notes" rows={2} value={form.clientVisibleNotes} onChange={(e) => set('clientVisibleNotes', e.target.value)} hint="Shown in the client portal case view." />
      </form>
    </Modal>
  );
}
