import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Briefcase, FolderOpen, CalendarDays, MessagesSquare, ReceiptIndianRupee, UserRound, LogOut, Menu, X, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import Logo from './Logo';
import { Avatar, Badge } from '../ui';

const NAV = [
  { to: '/portal', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/portal/cases', label: 'My cases', icon: Briefcase },
  { to: '/portal/documents', label: 'Documents', icon: FolderOpen },
  { to: '/portal/appointments', label: 'Appointments', icon: CalendarDays },
  { to: '/portal/messages', label: 'Messages', icon: MessagesSquare },
  { to: '/portal/invoices', label: 'Invoices', icon: ReceiptIndianRupee },
  { to: '/portal/profile', label: 'Profile', icon: UserRound },
];

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['portal', 'me'], queryFn: () => api.get('/portal/me'), staleTime: 300000 });
  const counts = useQuery({ queryKey: ['portal', 'dashboard'], queryFn: () => api.get('/portal/dashboard'), staleTime: 30000 });
  const organization = me.data?.organization;

  const doLogout = async () => { await logout(); navigate('/portal/login', { replace: true }); };

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-3 sm:px-5">
          <button onClick={() => setOpen(!open)} className="rounded-md p-1.5 text-ink-soft hover:bg-slate-100 lg:hidden" aria-label="Toggle navigation">{open ? <X size={18} /> : <Menu size={18} />}</button>
          <div className="flex min-w-0 items-center gap-2"><Logo compact /><span className="hidden text-2xs text-ink-faint sm:inline">|</span><span className="hidden truncate text-xs font-semibold text-ink-soft sm:inline">{organization?.name}</span></div>
          <div className="ml-auto flex items-center gap-2">
            {counts.data?.unreadMessages > 0 && <NavLink to="/portal/messages" className="relative rounded-md p-1.5 text-ink-soft hover:bg-slate-100"><Bell size={16} /><span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand-600 px-1 text-[8px] font-bold text-white">{counts.data.unreadMessages}</span></NavLink>}
            <div className="hidden items-center gap-2 rounded-lg border border-line px-2 py-1 sm:flex"><Avatar name={user?.name} size="xs" /><div className="leading-tight"><p className="text-2xs font-semibold text-ink">{user?.name}</p><p className="text-[10px] text-ink-faint">Client portal</p></div></div>
            <button onClick={doLogout} className="rounded-md p-1.5 text-ink-soft hover:bg-red-50 hover:text-red-600" title="Sign out"><LogOut size={16} /></button>
          </div>
        </div>
        <nav className="mx-auto hidden max-w-6xl gap-0.5 px-4 lg:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-medium transition ${isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-soft hover:text-ink'}`}>
              <n.icon size={13} />{n.label}
              {n.to === '/portal/messages' && counts.data?.unreadMessages > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[9px] font-bold text-white">{counts.data.unreadMessages}</span>}
            </NavLink>
          ))}
        </nav>
      </header>

      {open && (
        <div className="border-b border-line bg-white lg:hidden">
          <nav className="mx-auto max-w-6xl p-2">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-navy text-white' : 'text-ink-soft'}`}>
                <n.icon size={15} />{n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-3 py-5 sm:px-5"><Outlet /></main>
      <footer className="mx-auto max-w-6xl px-5 py-6">
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4 text-[10px] text-ink-faint">
          <ShieldCheck size={11} /> Your documents are stored privately and shared only with your assigned consultant. Internal notes are never visible here.
          <span className="ml-auto">ImmigrationFlow by Webamazee</span>
        </div>
      </footer>
    </div>
  );
}
