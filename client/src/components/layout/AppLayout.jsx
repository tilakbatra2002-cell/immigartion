import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Users, UserSquare2, Briefcase, FileText, CalendarDays, CheckSquare,
  Receipt, MessageSquare, BarChart3, Sparkles, Settings, CreditCard, Shield, Menu, X,
  ChevronDown, LogOut, Building2, LifeBuoy, Search, Command,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { Avatar, Button, cx, Tooltip } from '../ui';
import { api } from '../../lib/api';
import { useEffect as useSocketEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '../../lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../context/ToastContext';

const NAV = [
  { section: 'Overview', items: [
    { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'dashboard.view' },
    { to: '/app/ai', label: 'AI Assistant', icon: Sparkles, perm: 'ai.use', badge: 'AI' },
  ] },
  { section: 'Pipeline', items: [
    { to: '/app/leads', label: 'Leads', icon: Users, perm: 'leads.view' },
    { to: '/app/clients', label: 'Clients', icon: UserSquare2, perm: 'clients.view' },
    { to: '/app/cases', label: 'Cases', icon: Briefcase, perm: 'cases.view' },
  ] },
  { section: 'Workflow', items: [
    { to: '/app/documents', label: 'Documents', icon: FileText, perm: 'documents.view' },
    { to: '/app/appointments', label: 'Appointments', icon: CalendarDays, perm: 'appointments.view' },
    { to: '/app/tasks', label: 'Tasks', icon: CheckSquare, perm: 'tasks.view' },
    { to: '/app/communications', label: 'Communications', icon: MessageSquare, perm: 'communications.view' },
  ] },
  { section: 'Business', items: [
    { to: '/app/invoices', label: 'Invoices', icon: Receipt, perm: 'invoices.view' },
    { to: '/app/reports', label: 'Reports', icon: BarChart3, perm: 'reports.view' },
  ] },
  { section: 'Workspace', items: [
    { to: '/app/team', label: 'Team', icon: Shield, perm: 'team.view' },
    { to: '/app/settings', label: 'Settings', icon: Settings, perm: 'settings.view' },
    { to: '/app/subscription', label: 'Subscription', icon: CreditCard, perm: 'settings.view' },
  ] },
];

function useSocket() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const sockRef = useRef(null);
  useEffect(() => {
    if (!user?.organization?.id) return undefined;
    const token = getAccessToken();
    if (!token) return undefined;
    const socket = io({ path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'] });
    sockRef.current = socket;
    socket.on('notification', (n) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.info(n.title, n.body);
    });
    const invalidate = (keys) => () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    socket.on('lead:created', invalidate(['leads', 'dashboard']));
    socket.on('lead:updated', invalidate(['leads', 'dashboard']));
    socket.on('case:updated', invalidate(['cases', 'dashboard']));
    socket.on('portal:message', () => { qc.invalidateQueries({ queryKey: ['conversations'] }); toast.info('New client message', 'A client sent a message in the portal.'); });
    socket.on('portal:document_uploaded', () => { qc.invalidateQueries({ queryKey: ['documents'] }); toast.info('Client uploaded a document'); });
    return () => socket.disconnect();
  }, [user?.organization?.id, qc, toast]);
  return sockRef;
}

export default function AppLayout() {
  const { user, logout, can } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useSocket();

  const { data: badges } = useQuery({ queryKey: ['badges'], queryFn: () => api.get('/dashboard/badges'), refetchInterval: 120000 });

  useEffect(() => { setMobileOpen(false); setUserMenu(false); }, [location.pathname]);

  const visibleNav = NAV.map((s) => ({ ...s, items: s.items.filter((i) => can(i.perm)) })).filter((s) => s.items.length);
  const currentLabel = NAV.flatMap((s) => s.items).find((i) => location.pathname.startsWith(i.to))?.label || 'Dashboard';

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line px-4">
        <NavLink to="/app/dashboard" aria-label="ImmigrationFlow home"><Logo size="sm" /></NavLink>
        <button onClick={() => setMobileOpen(false)} className="rounded p-1.5 text-ink-soft hover:bg-slate-100 lg:hidden" aria-label="Close menu"><X size={16} /></button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Main navigation">
        {visibleNav.map((section) => (
          <div key={section.section} className="mb-4">
            <p className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-faint">{section.section}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to}
                    className={({ isActive }) => cx('focus-ring group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition',
                      isActive ? 'bg-navy text-white shadow-card' : 'text-ink-soft hover:bg-slate-100 hover:text-ink')}>
                    {({ isActive }) => (
                      <>
                        <item.icon size={15.5} strokeWidth={isActive ? 2.2 : 1.9} className={isActive ? 'text-white' : 'text-ink-faint group-hover:text-ink-soft'} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && <span className={cx('rounded px-1 py-px text-[9px] font-bold', isActive ? 'bg-white/15 text-white' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100')}>{item.badge}</span>}
                        {item.to === '/app/tasks' && badges?.overdueTasks > 0 && (
                          <span className="rounded bg-red-50 px-1.5 py-px text-[10px] font-bold text-red-600 ring-1 ring-red-100">{badges.overdueTasks}</span>
                        )}
                        {item.to === '/app/communications' && badges?.unreadMessages > 0 && (
                          <span className="rounded bg-brand-50 px-1.5 py-px text-[10px] font-bold text-brand-700 ring-1 ring-brand-100">{badges.unreadMessages}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-2.5">
        {!user?.organization?.onboardingCompleted && (
          <button onClick={() => navigate('/onboarding')} className="mb-2 w-full rounded-lg border border-brand-200 bg-brand-25 px-3 py-2 text-left transition hover:bg-brand-50">
            <p className="text-2xs font-bold text-brand-800">Finish workspace setup</p>
            <p className="mt-0.5 text-[11px] leading-snug text-brand-700">Add your business details to unlock invoices & branding.</p>
          </button>
        )}
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <Avatar name={user?.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink">{user?.name}</p>
            <p className="truncate text-[10px] text-ink-faint">{user?.membership?.roleLabel} · {user?.organization?.name}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[232px] border-r border-line bg-white lg:block">{sidebar}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-white shadow-modal">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[232px]">
        <header className="sticky top-0 z-20 flex h-[52px] items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur sm:px-5">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-ink-soft hover:bg-slate-100 lg:hidden" aria-label="Open menu"><Menu size={18} /></button>
          <div className="hidden items-center gap-1.5 text-xs text-ink-faint sm:flex">
            <Building2 size={13} />
            <span className="max-w-[160px] truncate font-medium text-ink-soft">{user?.organization?.name}</span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-ink">{currentLabel}</span>
          </div>
          <div className="flex-1" />
          <button onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
            className="hidden items-center gap-2 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-ink-faint transition hover:border-slate-300 hover:text-ink-soft md:flex">
            <Search size={13} /><span>Search</span>
            <kbd className="flex items-center gap-0.5 rounded border border-line bg-slate-50 px-1 py-px font-ui text-[10px] font-semibold text-ink-faint"><Command size={9} />K</kbd>
          </button>
          <NotificationBell />
          <div className="relative">
            <button onClick={() => setUserMenu((o) => !o)} className="focus-ring flex items-center gap-1.5 rounded-lg py-1 pl-1 pr-1.5 hover:bg-slate-50">
              <Avatar name={user?.name} size="sm" />
              <ChevronDown size={13} className="text-ink-faint" />
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setUserMenu(false)} />
                <div className="card absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden py-1 shadow-pop page-enter">
                  <div className="border-b border-line px-3.5 py-2.5">
                    <p className="text-xs font-bold text-ink">{user?.name}</p>
                    <p className="truncate text-2xs text-ink-soft">{user?.email}</p>
                    <span className="mt-1.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{user?.membership?.roleLabel}</span>
                  </div>
                  <NavLink to="/app/settings/profile" className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-ink-soft hover:bg-slate-50"><Settings size={14} /> Profile settings</NavLink>
                  <NavLink to="/app/subscription" className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-ink-soft hover:bg-slate-50"><CreditCard size={14} /> Billing</NavLink>
                  {user?.isSuperAdmin && (
                    <NavLink to="/admin" className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-violet-700 hover:bg-violet-50"><Shield size={14} /> Platform admin</NavLink>
                  )}
                  <a href="mailto:support@webamazee.com" className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-ink-soft hover:bg-slate-50"><LifeBuoy size={14} /> Contact support</a>
                  <button onClick={logout} className="flex w-full items-center gap-2.5 border-t border-line px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"><LogOut size={14} /> Sign out</button>
                </div>
              </>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-5 sm:px-5 lg:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
