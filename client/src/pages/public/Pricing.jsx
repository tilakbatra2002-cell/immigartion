import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight } from 'lucide-react';
import PublicNav from '../../components/public/PublicNav';
import PublicFooter from '../../components/public/PublicFooter';
import { Button, Badge, Skeleton } from '../../components/ui';
import { api } from '../../lib/api';
import { money } from '../../lib/format';

const CURRENCIES = ['INR', 'USD', 'GBP', 'AUD', 'NZD', 'CAD'];
const COMPARE = [
  ['Team members', '2', '10', '30'],
  ['Active leads', '100', '1,000', '5,000'],
  ['Active cases', '25', '500', '2,000'],
  ['Lead & client CRM', '✓', '✓', '✓'],
  ['Document management', '✓', '✓', '✓'],
  ['Invoicing & payments', '✓', '✓', '✓'],
  ['AI assistant', '—', '✓', '✓'],
  ['Client portal', '—', '✓', '✓'],
  ['Advanced reports', '—', '✓', '✓'],
  ['Custom case workflows', '—', '✓', '✓'],
  ['Advanced permissions', '—', '—', '✓'],
  ['Audit log access', '—', '—', '✓'],
  ['Support', 'Email', 'Priority', 'Priority + onboarding'],
];

export default function Pricing() {
  const [currency, setCurrency] = useState('INR');
  const [plans, setPlans] = useState(null);

  useEffect(() => {
    api.get('/billing/plans').then((d) => setPlans(d.plans)).catch(() => setPlans([]));
  }, []);

  return (
    <div className="bg-white">
      <PublicNav />
      <section className="border-b border-line bg-canvas px-4 py-12 text-center sm:px-6">
        <div className="mx-auto max-w-2xl">
          <Badge tone="info">Pricing</Badge>
          <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.03em] text-ink sm:text-[38px]">Simple plans that scale with your team</h1>
          <p className="mt-3 text-sm text-ink-soft">Every plan includes a 14-day free trial. All limits are enforced on the server, so you always know where you stand.</p>
          <div className="mt-5 inline-flex flex-wrap justify-center gap-1 rounded-lg border border-line bg-white p-1">
            {CURRENCIES.map((c) => (
              <button key={c} onClick={() => setCurrency(c)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${currency === c ? 'bg-navy text-white' : 'text-ink-soft hover:bg-slate-50'}`}>{c}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {!plans ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-96 rounded-xl" />) : plans.map((p) => (
            <div key={p.key} className={`relative flex flex-col rounded-xl border bg-white p-6 ${p.popular ? 'border-brand-600 shadow-pop ring-1 ring-brand-600' : 'border-line shadow-card'}`}>
              {p.popular && <span className="absolute -top-2.5 left-5 rounded-full bg-brand-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Most popular</span>}
              <h2 className="text-base font-extrabold text-ink">{p.name}</h2>
              <p className="mt-1 min-h-[32px] text-xs text-ink-soft">{p.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-ui text-[32px] font-extrabold tracking-tight text-ink">{money(p.price[currency] || p.price.INR, currency).replace('.00', '')}</span>
                <span className="text-xs text-ink-faint">/month</span>
              </div>
              <Link to="/register" className="mt-5"><Button variant={p.popular ? 'primary' : 'secondary'} className="w-full">{p.popular ? 'Start free trial' : 'Choose ' + p.name}</Button></Link>
              <ul className="mt-5 space-y-2 border-t border-line pt-4">
                {p.features.map((f) => <li key={f} className="flex gap-2 text-xs text-ink-soft"><Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />{f}</li>)}
              </ul>
              <div className="mt-4 space-y-1 rounded-lg bg-canvas p-3">
                <p className="text-[11px] text-ink-soft"><span className="font-semibold text-ink">{p.limits.users}</span> team members</p>
                <p className="text-[11px] text-ink-soft"><span className="font-semibold text-ink">{p.limits.activeLeads.toLocaleString()}</span> active leads · <span className="font-semibold text-ink">{p.limits.activeCases.toLocaleString()}</span> active cases</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-line">
          <table className="w-full text-left">
            <thead><tr className="border-b border-line bg-slate-50"><th className="px-4 py-3 text-2xs font-bold uppercase tracking-wider text-ink-faint">Compare plans</th>
              {['Starter', 'Professional', 'Business'].map((n) => <th key={n} className="px-4 py-3 text-center text-xs font-bold text-ink">{n}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {COMPARE.map(([label, ...vals]) => (
                <tr key={label}>
                  <td className="px-4 py-2.5 text-xs font-medium text-ink-soft">{label}</td>
                  {vals.map((v, i) => <td key={i} className="px-4 py-2.5 text-center text-xs font-semibold text-ink">{v}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-center text-2xs text-ink-faint">Prices are billed monthly per organization. Yearly billing and multi-branch pricing available — contact us.</p>
      </section>
      <PublicFooter />
    </div>
  );
}
