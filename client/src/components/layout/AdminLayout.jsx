import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, Users, CreditCard, Package, BarChart3, ScrollText, Settings, LogOut, ShieldAlert, Menu, X, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Logo from './Logo';
import { Avatar } from '../ui';

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/admin/plans', label: 'Plans', icon: Package },
  { to: '/admin/analytics', label: 'Platform analytics', icon: BarChart3 },
  { to: '/admin/audit', label: 'Audit trail', icon: ScrollText },
  { to: '/admin/settings', label: 'Platform settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const doLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside className="hidden w-56 shrink-0 border-r border-navy-800 bg-navy lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-4"><Logo dark compact /><span className="whitespace-nowrap rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/80">Super Admin</span></div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
              <n.icon size={14} />{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-2">
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <Avatar name={user?.name} size="xs" />
            <div className="min-w-0 flex-1 leading-tight"><p className="truncate text-2xs font-semibold text-white">{user?.name}</p><p className="truncate text-[10px] text-white/50">{user?.email}</p></div>
            <button onClick={doLogout} className="rounded p-1 text-white/50 hover:bg-white/10 hover:text-white" title="Sign out"><LogOut size={13} /></button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white px-3 lg:hidden">
          <button onClick={() => setOpen(!open)} className="rounded-md p-1.5 text-ink-soft hover:bg-slate-100">{open ? <X size={18} /> : <Menu size={18} />}</button>
          <Logo compact /><span className="whitespace-nowrap rounded bg-navy px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Admin</span>
          <button onClick={doLogout} className="ml-auto rounded p-1.5 text-ink-soft hover:bg-slate-100"><LogOut size={16} /></button>
        </header>
        {open && (
          <div className="border-b border-line bg-white p-2 lg:hidden">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-navy text-white' : 'text-ink-soft'}`}><n.icon size={15} />{n.label}</NavLink>
            ))}
          </div>
        )}
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5">
          <p className="flex items-center gap-1.5 text-[10px] font-medium text-amber-900"><ShieldAlert size={11} /> Platform administration — actions here are logged and affect all organizations. Customer data should be accessed only for support purposes.</p>
        </div>
        <main className="mx-auto max-w-7xl px-3 py-5 sm:px-5">{<Outlet />}</main>
      </div>
    </div>
  );
}
