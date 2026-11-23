import { Link } from 'react-router-dom';
import {
  ArrowRight, Users, Briefcase, FileText, CalendarDays, Receipt, Sparkles, ShieldCheck,
  CheckCircle2, Globe2, MessageSquare, BarChart3, Layers, Lock, Workflow,
} from 'lucide-react';
import PublicNav from '../../components/public/PublicNav';
import PublicFooter from '../../components/public/PublicFooter';
import { Button, Badge } from '../../components/ui';

const FEATURES = [
  { icon: Users, title: 'Lead pipeline CRM', body: 'Capture enquiries from every source, assign consultants and move prospects through a visual pipeline from first contact to signed client.' },
  { icon: Briefcase, title: 'Immigration case management', body: 'Track every application with reference numbers, deadlines, priorities, checklists and a complete activity timeline per case.' },
  { icon: FileText, title: 'Document control', body: 'Request, receive and verify passports, financials and police clearances — with version history, expiry tracking and signed downloads.' },
  { icon: Sparkles, title: 'AI assistance, on your terms', body: 'Summarise documents, draft client emails and generate case briefs. AI never decides eligibility and every extraction requires human verification.' },
  { icon: MessageSquare, title: 'Email & WhatsApp history', body: 'One thread per client across email, WhatsApp and the portal. Nothing is claimed as "sent" unless your provider confirms delivery.' },
  { icon: Receipt, title: 'Invoicing in 6 currencies', body: 'Quotations, GST/VAT-aware invoices, part payments and outstanding balances in INR, USD, GBP, AUD, NZD and CAD.' },
  { icon: CalendarDays, title: 'Appointments & tasks', body: 'Schedule consultations, send reminders and keep follow-ups from slipping — with overdue actions surfaced on the dashboard.' },
  { icon: BarChart3, title: 'Real reports, not vanity metrics', body: 'Lead conversion, consultant performance, case completion and revenue — computed live from your database with CSV exports.' },
];

const WORKFLOW = [
  ['01', 'Capture & qualify', 'Web enquiries, referrals and walk-ins land in one pipeline with source tracking and follow-up scheduling.'],
  ['02', 'Onboard the client', 'Convert qualified leads into clients with passport data encrypted at rest and family members linked to one account.'],
  ['03', 'Run the case', 'Checklist-driven case management with deadlines, assignments and client-visible updates separated from internal notes.'],
  ['04', 'Submit & close', 'Track submissions, information requests and decisions. Record fees and payments in the client\'s currency.'],
];

export default function Landing() {
  return (
    <div className="bg-white">
      <PublicNav />
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-canvas">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,#EFF4FF_0%,transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <Badge tone="info" className="mb-4">Built for immigration consultancies in 6 countries</Badge>
            <h1 className="text-balance font-sans text-[32px] font-extrabold leading-[1.12] tracking-[-0.03em] text-ink sm:text-[46px]">
              The operating system for<br className="hidden sm:block" /> modern immigration consultancies
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-ink-soft sm:text-base">
              ImmigrationFlow brings leads, clients, cases, documents, appointments, invoicing and client communication
              into one secure workspace — with optional AI assistance and a branded client portal.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
              <Link to="/register" className="w-full sm:w-auto"><Button size="lg" icon={ArrowRight} className="w-full sm:w-auto">Start 14-day free trial</Button></Link>
              <Link to="/pricing" className="w-full sm:w-auto"><Button size="lg" variant="secondary" className="w-full sm:w-auto">View pricing</Button></Link>
            </div>
            <p className="mt-3 text-2xs text-ink-faint">No credit card required · Cancel anytime · Data isolated per organization</p>
          </div>

          {/* Product preview */}
          <div className="mx-auto mt-12 max-w-5xl">
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-modal">
              <div className="flex items-center gap-1.5 border-b border-line bg-slate-50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-200" /><span className="h-2.5 w-2.5 rounded-full bg-slate-200" /><span className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                <span className="ml-3 rounded bg-white px-2 py-0.5 text-[10px] text-ink-faint ring-1 ring-line">app.immigrationflow.io</span>
              </div>
              <div className="grid grid-cols-[150px_1fr] sm:grid-cols-[190px_1fr]">
                <div className="hidden border-r border-line bg-white p-3 sm:block">
                  <div className="mb-3 flex items-center gap-1.5 px-1 text-[11px] font-bold text-ink">ImmigrationFlow</div>
                  {[['Dashboard', true], ['Leads', false], ['Clients', false], ['Cases', false], ['Documents', false], ['Invoices', false]].map(([l, active]) => (
                    <div key={l} className={`mb-0.5 rounded px-2 py-1.5 text-[11px] font-medium ${active ? 'bg-navy text-white' : 'text-ink-soft'}`}>{l}</div>
                  ))}
                </div>
                <div className="bg-canvas p-3 sm:p-4">
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[['Active cases', '128'], ['Documents pending', '34'], ['Monthly revenue', '₹8.4L'], ['Overdue tasks', '6']].map(([l, v]) => (
                      <div key={l} className="rounded-lg border border-line bg-white p-2.5">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-ink-faint">{l}</p>
                        <p className="mt-1 font-ui text-base font-bold text-ink">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-line bg-white p-3">
                    <div className="mb-2.5 flex items-center justify-between">
                      <p className="text-[11px] font-bold text-ink">Recent cases</p>
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[9px] font-semibold text-brand-700">Live data</span>
                    </div>
                    {[['CASE-2026-0148', 'Permanent Residency – Canada', 'Under Review', 'indigo'],
                      ['CASE-2026-0147', 'Student Visa – Australia', 'Documents Pending', 'amber'],
                      ['CASE-2026-0145', 'Skilled Migration – UK', 'Submitted', 'cyan']].map(([ref, title, status, tone]) => (
                      <div key={ref} className="flex items-center justify-between gap-2 border-t border-line py-2 first:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-ink">{title}</p>
                          <p className="font-ui text-[9px] text-ink-faint">{ref}</p>
                        </div>
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold ${{ indigo: 'bg-indigo-50 text-indigo-700', amber: 'bg-amber-50 text-amber-800', cyan: 'bg-cyan-50 text-cyan-800' }[tone]}`}>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] text-ink-faint">Illustrative interface preview. Your workspace starts empty and fills with your own data.</p>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b border-line bg-white py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 text-2xs font-semibold text-ink-faint sm:px-6">
          {[[Globe2, 'India · Australia · New Zealand · UK · Canada · USA'], [Lock, 'Encrypted passport data'], [Layers, 'Multi-tenant isolation'], [ShieldCheck, 'Full audit trail'], [Workflow, 'Custom case workflows']].map(([Icon, label]) => (
            <span key={label} className="flex items-center gap-1.5"><Icon size={13} className="text-ink-faint" />{label}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-2xs font-bold uppercase tracking-widest text-brand-700">Everything in one place</p>
          <h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.02em] text-ink sm:text-[32px]">Run the whole consultancy, not just the spreadsheet</h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">Purpose-built modules replace scattered spreadsheets, WhatsApp groups and shared drives — without forcing your team into generic project-management software.</p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group bg-white p-5 transition hover:bg-canvas">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><f.icon size={16} strokeWidth={2} /></div>
              <h3 className="mt-3 text-sm font-bold text-ink">{f.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="border-y border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start">
            <div>
              <p className="text-2xs font-bold uppercase tracking-widest text-brand-700">From enquiry to decision</p>
              <h2 className="mt-2 text-[26px] font-extrabold tracking-[-0.02em] text-ink sm:text-[32px]">One workflow your whole team can follow</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">Consultants, case managers and accounts work from the same record — with permissions that keep sensitive passport data and internal notes where they belong.</p>
              <div className="mt-6 space-y-2">
                {['Role-based access with 6 staff roles', 'Client portal that hides internal notes', 'Every action recorded in the audit log'].map((l) => (
                  <p key={l} className="flex items-center gap-2 text-xs font-medium text-ink"><CheckCircle2 size={14} className="text-emerald-600" />{l}</p>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {WORKFLOW.map(([n, t, d]) => (
                <div key={n} className="flex gap-4 rounded-xl border border-line bg-white p-4">
                  <span className="font-ui text-xs font-bold text-ink-faint">{n}</span>
                  <div><h3 className="text-sm font-bold text-ink">{t}</h3><p className="mt-1 text-xs leading-relaxed text-ink-soft">{d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* AI section */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="overflow-hidden rounded-2xl border border-line bg-navy">
          <div className="grid gap-8 p-7 sm:p-10 lg:grid-cols-2 lg:items-center">
            <div>
              <Badge tone="info" className="bg-white/10 text-brand-200 ring-white/15">Optional AI</Badge>
              <h2 className="mt-3 text-[24px] font-extrabold tracking-[-0.02em] text-white sm:text-[30px]">AI that drafts and summarises — never decides</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Summarise passports and financial statements, draft document-reminder emails and brief your team on stalled cases.
                Extracted information is clearly marked unverified until a consultant confirms it.
              </p>
              <div className="mt-5 space-y-2">
                {['Never predicts approval or refusal', 'Your API key stays on your server', 'Works without AI — every workflow has a manual path'].map((l) => (
                  <p key={l} className="flex items-center gap-2 text-xs font-medium text-slate-200"><CheckCircle2 size={14} className="text-brand-400" />{l}</p>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2 text-2xs font-semibold text-slate-400"><Sparkles size={12} className="text-brand-400" />Document summary · unverified</div>
              <div className="space-y-2">
                {[['Document type', 'Bank statement'], ['Account holder', 'P. Sharma'], ['Statement period', 'Apr – Sep 2026'], ['Average balance', '₹4,82,000']].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-lg bg-white/[0.05] px-3 py-2">
                    <span className="text-[11px] text-slate-400">{k}</span><span className="font-ui text-[11px] font-semibold text-white">{v}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[10px] leading-relaxed text-amber-200">
                Extracted information requires consultant verification before use in an application.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-[26px] font-extrabold tracking-[-0.02em] text-ink">Bring your consultancy into one system</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ink-soft">Start with a 14-day trial of the Starter plan. Upgrade when your team grows.</p>
          <div className="mt-6 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
            <Link to="/register"><Button size="lg" icon={ArrowRight}>Create your workspace</Button></Link>
            <Link to="/contact"><Button size="lg" variant="secondary">Talk to us</Button></Link>
          </div>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
