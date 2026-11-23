import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Check, AlertTriangle, ArrowUpRight, Calendar, Users, Briefcase, UsersRound, XCircle, ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import { Button, Badge, Progress, EmptyState, ErrorState, Spinner, Modal, Select } from '../../components/ui';
import { money, date } from '../../lib/format';

export default function Subscription() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [cycle, setCycle] = useState('MONTHLY');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [providerChoice, setProviderChoice] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['billing'], queryFn: () => api.get('/billing') });

  const changePlan = useMutation({
    mutationFn: ({ plan }) => api.post('/billing/change-plan', { plan }),
    onSuccess: (res) => {
      if (res.requiresPayment) {
        toast.info('Checkout required', res.message);
        api.post('/billing/checkout', { plan: res.planKey || 'PROFESSIONAL', provider: providerChoice || 'stripe' })
          .then((c) => { if (c.url) window.location.href = c.url; })
          .catch((e) => toast.error('Checkout unavailable', e.message));
      } else { toast.success('Plan updated', res.message); qc.invalidateQueries({ queryKey: ['billing'] }); }
    },
    onError: (e) => toast.error('Could not change plan', e.message),
  });

  const cancel = useMutation({
    mutationFn: (atPeriodEnd) => api.post('/billing/cancel', { atPeriodEnd }),
    onSuccess: () => { toast.success('Cancellation scheduled'); qc.invalidateQueries({ queryKey: ['billing'] }); setCancelOpen(false); },
    onError: (e) => toast.error('Could not cancel', e.message),
  });
  const resume = useMutation({
    mutationFn: () => api.post('/billing/resume', {}),
    onSuccess: () => { toast.success('Subscription resumed'); qc.invalidateQueries({ queryKey: ['billing'] }); },
    onError: (e) => toast.error('Could not resume', e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const { subscription: sub, plan, usage, plans, providers } = data;
  const currency = sub.currency || 'INR';
  const trialDaysLeft = sub.trialEndsAt ? Math.max(0, Math.ceil((new Date(sub.trialEndsAt) - Date.now()) / 86400000)) : 0;

  return (
    <div className="page-enter">
      <PageHeader title="Subscription & billing" description="Your plan, usage limits and billing history. Limits are enforced on the server." />

      {(sub.status === 'TRIALING' || sub.status === 'EXPIRED' || sub.status === 'PAST_DUE' || sub.cancelAtPeriodEnd) && (
        <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-card border p-3.5 ${sub.status === 'TRIALING' ? 'border-brand-200 bg-brand-25' : 'border-amber-200 bg-amber-50'}`}>
          <AlertTriangle size={16} className={sub.status === 'TRIALING' ? 'text-brand-700' : 'text-amber-600'} />
          <div className="flex-1">
            <p className={`text-xs font-bold ${sub.status === 'TRIALING' ? 'text-brand-900' : 'text-amber-900'}`}>
              {sub.status === 'TRIALING' ? `Trial: ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} remaining` : sub.cancelAtPeriodEnd ? 'Subscription scheduled to cancel' : sub.status === 'PAST_DUE' ? 'Payment past due' : 'Your subscription has expired'}
            </p>
            <p className={`text-2xs ${sub.status === 'TRIALING' ? 'text-brand-800' : 'text-amber-800'}`}>
              {sub.status === 'TRIALING' ? 'Your data is preserved. Choose a plan before the trial ends to keep creating records.' : sub.cancelAtPeriodEnd ? 'Access continues until the period end, then record creation is disabled. Resume anytime.' : 'Existing data remains accessible, but creating new records is disabled until renewal.'}
            </p>
          </div>
          {sub.cancelAtPeriodEnd && <Button size="sm" variant="secondary" onClick={() => resume.mutate()} loading={resume.isPending}>Resume subscription</Button>}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Current plan</p>
              <div className="mt-1 flex items-center gap-2"><h2 className="text-xl font-extrabold tracking-tight text-ink">{plan.name}</h2><Badge tone={sub.status === 'ACTIVE' ? 'success' : sub.status === 'TRIALING' ? 'info' : 'warning'} dot>{sub.status.toLowerCase()}</Badge></div>
              <p className="mt-0.5 text-xs text-ink-soft">{plan.description}</p>
            </div>
            <div className="text-right">
              <p className="font-ui text-lg font-bold text-ink">{money(plan.price[currency] || plan.price.INR, currency)}</p>
              <p className="text-2xs text-ink-faint">per month</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[['Team members', usage.users, Users], ['Active leads', usage.activeLeads, UsersRound], ['Active cases', usage.activeCases, Briefcase]].map(([label, u, Icon]) => (
              <div key={label} className="rounded-lg border border-line p-2.5">
                <div className="flex items-center justify-between"><p className="text-2xs font-semibold text-ink-soft">{label}</p><Icon size={12} className="text-ink-faint" /></div>
                <p className="mt-1 font-ui text-sm font-bold text-ink">{u.used}<span className="text-2xs font-normal text-ink-faint"> / {u.limit.toLocaleString()}</span></p>
                <Progress value={(u.used / u.limit) * 100} tone={u.used / u.limit > 0.9 ? 'danger' : u.used / u.limit > 0.75 ? 'warning' : 'brand'} className="mt-1" />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-ink-soft">
            <span className="flex items-center gap-1"><Calendar size={11} />{sub.currentPeriodEnd ? `Period ends ${date(sub.currentPeriodEnd)}` : 'No active period'}</span>
            <span>Provider: {sub.provider === 'NONE' ? 'none (manual)' : sub.provider.toLowerCase()}</span>
            <span>Billing: {sub.billingCycle.toLowerCase()}</span>
          </div>
          {can('billing.manage') && sub.status !== 'CANCELLED' && !sub.cancelAtPeriodEnd && (
            <div className="mt-4 border-t border-line pt-3"><button onClick={() => setCancelOpen(true)} className="text-2xs font-medium text-red-600 hover:text-red-700">Cancel subscription</button></div>
          )}
        </div>

        <div className="card p-4">
          <h2 className="text-sm font-bold text-ink">Payment providers</h2>
          <p className="mt-0.5 text-2xs text-ink-soft">Subscriptions activate only via verified provider webhooks.</p>
          <div className="mt-3 space-y-2">
            {[['Stripe (international)', providers.stripe], ['Razorpay (India)', providers.razorpay]].map(([name, ok]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-2">
                <span className="text-xs text-ink">{name}</span>
                <Badge tone={ok ? 'success' : 'muted'} size="sm">{ok ? 'Configured' : 'Not configured'}</Badge>
              </div>
            ))}
          </div>
          {!providers.stripe && !providers.razorpay && (
            <div className="mt-3 rounded-lg bg-canvas p-2.5 text-2xs text-ink-soft">
              No payment provider is configured. You can still downgrade to Starter. Paid plan upgrades require Stripe or Razorpay credentials on the server, or activation by a platform administrator.
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {plans.map((p) => {
          const current = p.key === plan.key;
          return (
            <div key={p.key} className={`card relative p-4 ${current ? 'ring-1 ring-brand-600' : ''}`}>
              {p.popular && !current && <span className="absolute -top-2 left-4 rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Popular</span>}
              <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-ink">{p.name}</h3>{current && <Badge tone="info" size="sm">Current</Badge>}</div>
              <p className="mt-1 font-ui text-xl font-extrabold text-ink">{money(p.price[currency] || p.price.INR, currency)}<span className="text-2xs font-normal text-ink-faint">/mo</span></p>
              <ul className="mt-2.5 space-y-1">{p.features.map((f) => <li key={f} className="flex gap-1.5 text-2xs text-ink-soft"><Check size={11} className="mt-0.5 shrink-0 text-emerald-600" />{f}</li>)}</ul>
              <div className="mt-3 text-2xs text-ink-faint">{p.limits.users} users · {p.limits.activeLeads.toLocaleString()} leads · {p.limits.activeCases.toLocaleString()} cases</div>
              {can('billing.manage') && !current && (
                <Button className="mt-3 w-full" size="sm" variant={p.order > plan.order ? 'primary' : 'secondary'} loading={changePlan.isPending}
                  onClick={() => changePlan.mutate({ plan: p.key })}>
                  {p.order > plan.order ? <><ArrowUpRight size={13} />Upgrade to {p.name}</> : `Downgrade to ${p.name}`}
                </Button>
              )}
              {!can('billing.manage') && !current && <p className="mt-3 text-2xs text-ink-faint">Only the owner can change plans.</p>}
            </div>
          );
        })}
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="border-b border-line px-4 py-3"><h2 className="text-sm font-bold text-ink">Billing history</h2></div>
        {!sub.billingHistory?.length ? <EmptyState icon={CreditCard} title="No billing history" description="Payments will appear here once a subscription is active through a payment provider." /> : (
          <table className="w-full"><thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Date</th><th className="table-th">Description</th><th className="table-th">Provider</th><th className="table-th">Status</th><th className="table-th text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-line">{sub.billingHistory.map((b, i) => (
              <tr key={i}><td className="table-td py-2 text-xs">{date(b.date)}</td><td className="table-td py-2 text-xs">{b.description || b.plan}</td>
                <td className="table-td py-2 text-2xs text-ink-soft">{b.provider}</td><td className="table-td py-2"><Badge tone={b.status === 'PAID' ? 'success' : 'muted'} size="sm">{b.status}</Badge></td>
                <td className="table-td py-2 text-right text-xs font-semibold">{money(b.amount, b.currency)}</td></tr>
            ))}</tbody></table>
        )}
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel subscription" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setCancelOpen(false)}>Keep subscription</Button><Button variant="danger" size="sm" loading={cancel.isPending} onClick={() => cancel.mutate(true)}>Cancel at period end</Button></>}>
        <p className="text-xs leading-relaxed text-ink-soft">Your plan stays active until <strong className="text-ink">{sub.currentPeriodEnd ? date(sub.currentPeriodEnd) : 'the end of the period'}</strong>. After that, existing data remains accessible but creating new leads, cases and invoices is disabled until you resubscribe.</p>
        <p className="mt-2 rounded-lg bg-canvas p-2.5 text-2xs text-ink-soft">You can resume at any time before the period ends. Exports remain available.</p>
      </Modal>
    </div>
  );
}
