import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, Check, Globe2, Receipt, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/layout/Logo';
import { Button, Input, Select, Textarea, Badge } from '../../components/ui';
import { ORG_BUSINESS_TYPES, ORG_TIMEZONES } from '../../lib/constants';
import { api } from '../../lib/api';

const CURRENCIES = ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'];

export default function Onboarding() {
  const { user, refreshMe } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.organization?.name || '', businessType: 'Immigration Consultancy', email: user?.email || '',
    phone: '', website: '', registrationNumber: '',
    settings: { timezone: user?.organization?.timezone || 'Asia/Kolkata', currency: user?.organization?.currency || 'INR', country: 'IN', addressLine1: '', city: '', state: '', postalCode: '', taxName: 'GST', taxRate: 18, taxNumber: '', invoiceTerms: 'Payment due within 14 days.' },
  });

  const update = (path, value) => {
    if (path.startsWith('settings.')) setForm({ ...form, settings: { ...form.settings, [path.split('.')[1]]: value } });
    else setForm({ ...form, [path]: value });
  };

  const finish = async () => {
    setLoading(true);
    try {
      await api.patch('/organization', { ...form, onboardingCompleted: true });
      await refreshMe();
      toast.success('Workspace ready', 'Your organization profile is set up.');
      navigate('/app/dashboard');
    } catch (err) { toast.error('Could not save setup', err.message); } finally { setLoading(false); }
  };

  const steps = [
    { title: 'Business details', icon: Building2 },
    { title: 'Location & currency', icon: Globe2 },
    { title: 'Invoicing defaults', icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5">
          <Logo size="sm" />
          <button onClick={() => navigate('/app/dashboard')} className="flex items-center gap-1 text-xs text-ink-soft hover:text-ink"><X size={13} /> Skip for now</button>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6">
          <Badge tone="info">Setup 1 of 1</Badge>
          <h1 className="mt-2 text-[22px] font-extrabold tracking-tight text-ink">Set up {form.name || 'your workspace'}</h1>
          <p className="mt-1 text-xs text-ink-soft">This information appears on invoices and in the client portal. You can change it anytime in Settings.</p>
        </div>

        <div className="mb-5 flex gap-1">
          {steps.map((s, i) => (
            <button key={s.title} onClick={() => setStep(i)} className={`flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left transition ${step === i ? 'border-brand-600 bg-brand-25 ring-1 ring-brand-600' : 'border-line bg-white'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold ${i < step ? 'bg-emerald-100 text-emerald-700' : step === i ? 'bg-brand-600 text-white' : 'bg-slate-100 text-ink-faint'}`}>
                {i < step ? <Check size={12} /> : i + 1}
              </span>
              <span className="hidden text-xs font-semibold text-ink sm:block">{s.title}</span>
            </button>
          ))}
        </div>

        <div className="card p-5 sm:p-6">
          {step === 0 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Organization name" required value={form.name} onChange={(e) => update('name', e.target.value)} />
                <Select label="Business type" value={form.businessType} onChange={(e) => update('businessType', e.target.value)}>
                  {ORG_BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                </Select>
                <Input label="Business email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                <Input label="Phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+91 98123 45678" />
                <Input label="Website" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://youragency.com" />
                <Input label="Registration / license number" value={form.registrationNumber} onChange={(e) => update('registrationNumber', e.target.value)} placeholder="Optional" />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Timezone" value={form.settings.timezone} onChange={(e) => update('settings.timezone', e.target.value)}>
                  {ORG_TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                </Select>
                <Select label="Default currency" value={form.settings.currency} onChange={(e) => update('settings.currency', e.target.value)}>
                  {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                </Select>
                <Input label="Address line 1" value={form.settings.addressLine1} onChange={(e) => update('settings.addressLine1', e.target.value)} placeholder="Office / street" className="sm:col-span-2" />
                <Input label="City" value={form.settings.city} onChange={(e) => update('settings.city', e.target.value)} />
                <Input label="State / province" value={form.settings.state} onChange={(e) => update('settings.state', e.target.value)} />
                <Input label="Postal code" value={form.settings.postalCode} onChange={(e) => update('settings.postalCode', e.target.value)} />
              </div>
              <p className="rounded-lg bg-canvas px-3 py-2 text-2xs text-ink-soft">All appointments display in this timezone. Client records keep their own country of residence.</p>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Tax label" value={form.settings.taxName} onChange={(e) => update('settings.taxName', e.target.value)} hint="e.g. GST (India), VAT (UK), HST (Canada)" />
                <Input label="Default tax rate (%)" type="number" min="0" max="100" value={form.settings.taxRate} onChange={(e) => update('settings.taxRate', e.target.value)} />
                <Input label="Tax registration number" value={form.settings.taxNumber} onChange={(e) => update('settings.taxNumber', e.target.value)} placeholder="Optional" className="sm:col-span-2" />
              </div>
              <Textarea label="Invoice terms" rows={2} value={form.settings.invoiceTerms} onChange={(e) => update('settings.invoiceTerms', e.target.value)} />
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
            <Button variant="ghost" size="sm" onClick={() => (step === 0 ? navigate('/app/dashboard') : setStep(step - 1))}>{step === 0 ? 'Skip' : 'Back'}</Button>
            {step < 2
              ? <Button size="sm" onClick={() => setStep(step + 1)}>Continue <ArrowRight size={14} /></Button>
              : <Button size="sm" loading={loading} onClick={finish} icon={Check}>Save & enter workspace</Button>}
          </div>
        </div>
        <p className="mt-3 text-center text-2xs text-ink-faint">Your team can be invited from Settings → Team after setup.</p>
      </div>
    </div>
  );
}
