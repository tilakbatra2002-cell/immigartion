import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, UserSquare2, Briefcase, FileText, CalendarDays, CheckSquare, Receipt, MessageSquare, BarChart3, Sparkles, Settings, CreditCard, Shield, CornerDownLeft, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cx } from '../ui';

const ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view', group: 'Go to' },
  { to: '/app/leads', label: 'Leads', icon: Users, perm: 'leads.view', group: 'Go to' },
  { to: '/app/clients', label: 'Clients', icon: UserSquare2, perm: 'clients.view', group: 'Go to' },
  { to: '/app/cases', label: 'Cases', icon: Briefcase, perm: 'cases.view', group: 'Go to' },
  { to: '/app/documents', label: 'Documents', icon: FileText, perm: 'documents.view', group: 'Go to' },
  { to: '/app/appointments', label: 'Appointments', icon: CalendarDays, perm: 'appointments.view', group: 'Go to' },
  { to: '/app/tasks', label: 'Tasks', icon: CheckSquare, perm: 'tasks.view', group: 'Go to' },
  { to: '/app/invoices', label: 'Invoices', icon: Receipt, perm: 'invoices.view', group: 'Go to' },
  { to: '/app/communications', label: 'Communications', icon: MessageSquare, perm: 'communications.view', group: 'Go to' },
  { to: '/app/reports', label: 'Reports', icon: BarChart3, perm: 'reports.view', group: 'Go to' },
  { to: '/app/ai', label: 'AI Assistant', icon: Sparkles, perm: 'ai.use', group: 'Go to' },
  { to: '/app/team', label: 'Team', icon: Shield, perm: 'team.view', group: 'Go to' },
  { to: '/app/settings', label: 'Settings', icon: Settings, perm: 'settings.view', group: 'Go to' },
  { to: '/app/subscription', label: 'Subscription', icon: CreditCard, perm: 'settings.view', group: 'Go to' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const { can } = useAuth();
  const navigate = useNavigate();

  const results = useMemo(() => {
    const list = ITEMS.filter((i) => can(i.perm));
    if (!q.trim()) return list;
    return list.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  }, [q, can]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => { setIdx(0); }, [q, open]);

  if (!open) return null;

  const go = (item) => { if (item) { navigate(item.to); setOpen(false); setQ(''); } };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-label="Command palette">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-line bg-white shadow-modal page-enter">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="text-ink-faint" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); go(results[idx]); }
            }}
            placeholder="Search pages and actions…"
            className="h-12 flex-1 border-0 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint" />
          <kbd className="rounded border border-line bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-ink-faint">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.length === 0 && <p className="px-4 py-8 text-center text-xs text-ink-soft">No matches for “{q}”</p>}
          {results.map((item, i) => (
            <button key={item.to} onClick={() => go(item)} onMouseEnter={() => setIdx(i)}
              className={cx('flex w-full items-center gap-3 px-4 py-2 text-left text-sm', i === idx ? 'bg-slate-50 text-ink' : 'text-ink-soft')}>
              <item.icon size={15} className="text-ink-faint" />
              <span className="flex-1 font-medium">{item.label}</span>
              {i === idx && <CornerDownLeft size={13} className="text-ink-faint" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
