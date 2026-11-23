import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Logo from '../layout/Logo';
import { Button } from '../ui';

export default function PublicNav({ minimal = false }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" aria-label="ImmigrationFlow home"><Logo size="sm" /></Link>
        {!minimal && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Site">
            {[['/features', 'Features'], ['/pricing', 'Pricing'], ['/contact', 'Contact']].map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? 'text-ink' : 'text-ink-soft hover:bg-slate-100 hover:text-ink'}`}>{label}</NavLink>
            ))}
          </nav>
        )}
        <div className="hidden items-center gap-2 md:flex">
          <Link to="/portal/login" className="px-2 text-xs font-medium text-ink-soft hover:text-ink">Client login</Link>
          <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/register"><Button size="sm">Start free trial</Button></Link>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-lg p-2 text-ink-soft hover:bg-slate-100 md:hidden" aria-label="Toggle menu">
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-line bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {!minimal && [['/features', 'Features'], ['/pricing', 'Pricing'], ['/contact', 'Contact']].map(([to, label]) => (
              <Link key={to} to={to} onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-slate-50">{label}</Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              <Link to="/portal/login"><Button variant="secondary" size="sm" className="w-full">Client login</Button></Link>
              <Link to="/login"><Button variant="secondary" size="sm" className="w-full">Sign in</Button></Link>
              <Link to="/register"><Button size="sm" className="w-full">Start free trial</Button></Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
