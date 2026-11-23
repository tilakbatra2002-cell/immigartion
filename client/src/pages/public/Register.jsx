import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Logo from '../../components/layout/Logo';
import { Button, Input, Select } from '../../components/ui';
import { ORG_BUSINESS_TYPES, ORG_TIMEZONES } from '../../lib/constants';
import { api } from '../../lib/api';

const initial = {
  name: '', email: '', password: '', organizationName: '', businessType: 'Immigration Consultancy',
  country: 'IN', timezone: 'Asia/Kolkata', currency: 'INR',
};

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (form.password.length < 8 || !/[0-9]/.test(form.password) || !/[a-zA-Z]/.test(form.password)) e.password = 'At least 8 characters with a letter and a number.';
    if (form.organizationName.trim().length < 2) e.organizationName = 'Enter your consultancy name.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const data = await register(form);
      toast.success('Workspace created', data.message || 'Welcome to ImmigrationFlow.');
      navigate('/onboarding');
    } catch (err) {
      if (err.details) setErrors(err.details);
      else setServerError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col px-5 py-6 sm:px-10 lg:w-[54%] lg:px-16">
        <Link to="/" aria-label="Home"><Logo size="sm" /></Link>
        <div className="mx-auto flex w-full max-w-[420px] flex-col justify-center py-8">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">Create your workspace</h1>
          <p className="mt-1.5 text-xs text-ink-soft">14-day free trial of the Starter plan. No credit card required.</p>
          <form onSubmit={submit} className="mt-6 space-y-3.5" noValidate>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input label="Your full name" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Amrita Kaur" />
              <Input label="Work email" type="email" required value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@agency.com" />
            </div>
            <Input label="Password" type="password" required value={form.password} error={errors.password} hint="At least 8 characters with one letter and one number."
              onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Create a strong password" />
            <Input label="Consultancy / organization name" required value={form.organizationName} error={errors.organizationName}
              onChange={(e) => setForm({ ...form, organizationName: e.target.value })} placeholder="Aurora Immigration Services" />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Select label="Business type" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
                {ORG_BUSINESS_TYPES.map((t) => <option key={t}>{t}</option>)}
              </Select>
              <Select label="Timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                {ORG_TIMEZONES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Select label="Base country" value={form.country} onChange={(e) => {
                const currencies = { IN: 'INR', AU: 'AUD', NZ: 'NZD', GB: 'GBP', CA: 'CAD', US: 'USD' };
                setForm({ ...form, country: e.target.value, currency: currencies[e.target.value] || 'INR' });
              }}>
                <option value="IN">India</option><option value="AU">Australia</option><option value="NZ">New Zealand</option>
                <option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="US">United States</option>
              </Select>
              <Select label="Billing currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </div>
            {serverError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{serverError}</div>}
            <Button type="submit" size="lg" className="w-full" loading={loading}>Create workspace</Button>
            <p className="text-center text-2xs leading-relaxed text-ink-faint">
              By creating an account you agree to our terms of service and privacy policy. ImmigrationFlow provides workflow software only.
            </p>
          </form>
          <p className="mt-4 text-center text-xs text-ink-soft">
            Already have an account? <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800">Sign in</Link>
          </p>
        </div>
      </div>
      <div className="relative hidden flex-1 overflow-hidden bg-navy lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_30%_30%,#1E3A8A55_0%,transparent_60%)]" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <h2 className="max-w-sm text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-white">Set up in minutes. Your data stays yours.</h2>
          <div className="mt-8 space-y-3.5">
            {[['1', 'Create your organization', 'Each workspace is fully isolated with its own users, clients and settings.'],
              ['2', 'Invite your team', 'Assign roles from admin to viewer with granular permissions.'],
              ['3', 'Start with your first lead', 'Import from CSV or add leads directly — no sample data is created.']].map(([n, t, d]) => (
              <div key={n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 font-ui text-[11px] font-bold text-white">{n}</span>
                <div><p className="text-xs font-bold text-white">{t}</p><p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{d}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
