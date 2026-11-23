import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Button, Input, Textarea, Select } from '../../components/ui';
import { api } from '../../lib/api';
import { money } from '../../lib/format';

export default function InvoiceForm({ open, onClose, saving, onSubmit, defaultCurrency }) {
  const [type, setType] = useState('INVOICE');
  const [clientId, setClientId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [currency, setCurrency] = useState(defaultCurrency || 'INR');
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: '' }]);
  const [discountType, setDiscountType] = useState('FIXED');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(18);
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  const clients = useQuery({ queryKey: ['clients', 'picker'], queryFn: () => api.get('/clients?limit=100&status=ACTIVE'), enabled: open });
  const cases = useQuery({ queryKey: ['cases', 'picker'], queryFn: () => api.get('/cases?limit=100'), enabled: open });

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const discount = discountType === 'PERCENT' ? (subtotal * (Number(discountValue) || 0)) / 100 : Number(discountValue) || 0;
  const taxable = Math.max(0, subtotal - discount);
  const tax = (taxable * (Number(taxRate) || 0)) / 100;
  const total = taxable + tax;

  const reset = () => {
    setType('INVOICE'); setClientId(''); setCaseId(''); setCurrency(defaultCurrency || 'INR');
    setItems([{ description: '', quantity: 1, unitPrice: '' }]); setDiscountType('FIXED'); setDiscountValue(0);
    setTaxRate(18); setDueDate(''); setNotes(''); setErrors({});
  };

  const submit = () => {
    const err = {};
    if (!clientId) err.clientId = 'Select a client.';
    if (items.some((it) => !it.description.trim())) err.items = 'Every line needs a description.';
    if (items.some((it) => Number(it.quantity) <= 0 || Number(it.unitPrice) < 0 || it.unitPrice === '')) err.items = 'Every line needs a quantity and a rate.';
    setErrors(err);
    if (Object.keys(err).length) return;
    onSubmit({
      type, clientId, caseId: caseId || null, currency, discountType,
      discountValue: Number(discountValue) || 0, taxRate: Number(taxRate) || 0,
      dueDate: dueDate || '', notes,
      items: items.map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity), unitPrice: Number(it.unitPrice) })),
    });
    reset();
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="New invoice / quotation" size="lg"
      footer={<><Button variant="secondary" size="sm" onClick={() => { onClose(); reset(); }}>Cancel</Button><Button size="sm" loading={saving} onClick={submit}>Create {type === 'QUOTATION' ? 'quotation' : 'invoice'}</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Select label="Document type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="INVOICE">Invoice</option><option value="QUOTATION">Quotation</option>
          </Select>
          <Select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Select label="Client" required value={clientId} error={errors.clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Select client">
            {(clients.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.firstName} {c.lastName} · {c.reference}</option>)}
          </Select>
          <Select label="Related case" value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="No case">
            {(cases.data?.data || []).filter((c) => !clientId || c.clientId?._id === clientId).map((c) => <option key={c._id} value={c._id}>{c.reference} — {c.title}</option>)}
          </Select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold text-ink">Line items</p>
            <Button size="xs" variant="ghost" icon={Plus} onClick={() => setItems([...items, { description: '', quantity: 1, unitPrice: '' }])}>Add line</Button>
          </div>
          {errors.items && <p className="mb-1.5 text-xs font-medium text-red-600">{errors.items}</p>}
          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="flex gap-1.5">
                <input value={it.description} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], description: e.target.value }; setItems(n); }}
                  placeholder="Service description" className="input-base flex-1" />
                <input type="number" min="0.01" value={it.quantity} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], quantity: e.target.value }; setItems(n); }}
                  placeholder="Qty" className="input-base w-16 text-right" />
                <input type="number" min="0" value={it.unitPrice} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], unitPrice: e.target.value }; setItems(n); }}
                  placeholder="Rate" className="input-base w-24 text-right" />
                <button onClick={() => setItems(items.length > 1 ? items.filter((_, x) => x !== i) : items)} className="rounded p-1.5 text-ink-faint hover:bg-red-50 hover:text-red-600" aria-label="Remove line"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-ink">Discount</label>
            <div className="flex gap-1.5">
              <input type="number" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className="input-base flex-1 text-right" />
              <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="input-base w-20">
                <option value="FIXED">Fixed</option><option value="PERCENT">%</option>
              </select>
            </div>
          </div>
          <Input label="Tax rate (%)" type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          <div className="rounded-lg bg-canvas p-2.5">
            <p className="text-2xs text-ink-soft">Subtotal {money(subtotal, currency)}</p>
            {discount > 0 && <p className="text-2xs text-ink-soft">Discount −{money(discount, currency)}</p>}
            {tax > 0 && <p className="text-2xs text-ink-soft">Tax {money(tax, currency)}</p>}
            <p className="mt-0.5 text-sm font-bold text-ink">Total {money(total, currency)}</p>
          </div>
        </div>

        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <p className="rounded-lg bg-canvas px-2.5 py-2 text-2xs text-ink-soft">Totals are recalculated on the server from line items, discount and tax — the browser figures are previews only.</p>
      </div>
    </Modal>
  );
}
