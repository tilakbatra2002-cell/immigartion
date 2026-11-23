import { Link } from 'react-router-dom';
import { Users, Briefcase, FileText, CalendarDays, CheckSquare, Receipt, MessageSquare, BarChart3, Sparkles, ShieldCheck, Globe2, Lock, UserCog, ScrollText, Building2, Bell, Settings2, ArrowRight } from 'lucide-react';
import PublicNav from '../../components/public/PublicNav';
import PublicFooter from '../../components/public/PublicFooter';
import { Button, Badge } from '../../components/ui';

const MODULES = [
  { icon: Users, title: 'Lead management', points: ['Source, priority and consultant assignment', 'Table and Kanban pipeline views', 'Follow-up scheduling and contact notes', 'CSV export with permission checks'] },
  { icon: Briefcase, title: 'Immigration cases', points: ['9 visa categories, 13 case statuses', 'Customizable per-organization workflow', 'Deadlines and priority tracking', 'Internal notes separated from client updates'] },
  { icon: FileText, title: 'Documents', points: ['Reusable checklists per visa category', 'Version history with review status', 'Expiry tracking and missing-document reports', 'Signed, short-lived download URLs'] },
  { icon: CalendarDays, title: 'Appointments', points: ['Consultation types with meeting links', 'Calendar and list views', 'Reschedule history and reminders', 'Organization timezone aware'] },
  { icon: CheckSquare, title: 'Tasks', points: ['Assign to any team member', 'Link to leads, clients or cases', 'Recurring reminders', 'Overdue surfacing on the dashboard'] },
  { icon: Receipt, title: 'Invoicing', points: ['Quotations and invoices', 'Tax and discount handling', 'Part payments and balances', 'PDF download and email delivery'] },
  { icon: MessageSquare, title: 'Communications', points: ['Email and WhatsApp histories', 'Portal conversations', 'Reusable message templates', 'Honest delivery states'] },
  { icon: BarChart3, title: 'Reports', points: ['Conversion and consultant performance', 'Revenue and outstanding balances', 'Pending documents by case', 'Date filters and CSV export'] },
  { icon: Sparkles, title: 'AI assistant', points: ['Document field extraction', 'Email drafting with guardrails', 'Case briefs with pending actions', 'Usage tracking per organization'] },
];

export default function Features() {
  return (
    <div className="bg-white">
      <PublicNav />
      <section className="border-b border-line bg-canvas px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Badge tone="info">Product</Badge>
          <h1 className="mt-3 text-[30px] font-extrabold tracking-[-0.03em] text-ink sm:text-[38px]">Built for how immigration work actually runs</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">Nine core modules, an optional AI layer and a branded client portal — designed for agencies handling student visas, work permits, PR and family sponsorship across six destination countries.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div key={m.title} className="card p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><m.icon size={16} /></div>
              <h2 className="mt-3 text-sm font-bold text-ink">{m.title}</h2>
              <ul className="mt-2.5 space-y-1.5">
                {m.points.map((p) => (
                  <li key={p} className="flex gap-2 text-xs leading-relaxed text-ink-soft">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />{p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-canvas py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">Enterprise-grade foundations</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[[Globe2, 'Six destination markets', 'India, Australia, New Zealand, UK, Canada and the US with local currencies.'],
              [Lock, 'Encrypted identity data', 'Passport numbers encrypted with AES-256-GCM and hidden from list endpoints.'],
              [ShieldCheck, 'Tenant isolation tested', 'Every query is scoped to the authenticated organization on the server.'],
              [ScrollText, 'Auditable by default', 'Logins, exports, downloads and record changes are recorded with actor and IP.']].map(([Icon, t, d]) => (
              <div key={t} className="rounded-xl border border-line bg-white p-4">
                <Icon size={17} className="text-brand-700" />
                <h3 className="mt-2 text-xs font-bold text-ink">{t}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 text-center">
        <Link to="/register"><Button size="lg" icon={ArrowRight}>Start your free trial</Button></Link>
      </section>
      <PublicFooter />
    </div>
  );
}
