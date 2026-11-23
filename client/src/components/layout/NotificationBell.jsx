import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { timeAgo } from '../../lib/format';
import { Spinner } from '../ui';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=12'),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markRead = async (n) => {
    if (!n.readAt) await api.patch(`/notifications/${n._id}/read`, {});
    qc.invalidateQueries({ queryKey: ['notifications'] });
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  const unread = data?.unread || 0;
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className="focus-ring relative rounded-lg p-2 text-ink-soft transition hover:bg-slate-100 hover:text-ink">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-40 mt-2 w-[340px] overflow-hidden shadow-pop page-enter">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <p className="text-xs font-bold text-ink">Notifications</p>
            {unread > 0 && (
              <button onClick={() => readAll.mutate()} className="flex items-center gap-1 text-2xs font-semibold text-brand-600 hover:text-brand-700">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="max-h-[380px] overflow-y-auto">
            {isLoading ? <div className="flex justify-center py-8"><Spinner /></div>
              : !data?.data?.length ? <p className="px-4 py-10 text-center text-xs text-ink-soft">No notifications yet.</p>
              : data.data.map((n) => (
                <button key={n._id} onClick={() => markRead(n)}
                  className={`block w-full border-b border-line px-3.5 py-2.5 text-left transition last:border-0 hover:bg-slate-50 ${!n.readAt ? 'bg-brand-25/60' : ''}`}>
                  <div className="flex items-start gap-2">
                    {!n.readAt && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" />}
                    <div className={!n.readAt ? '' : 'pl-3.5'}>
                      <p className="text-xs font-semibold text-ink">{n.title}</p>
                      {n.body && <p className="mt-0.5 line-clamp-2 text-2xs text-ink-soft">{n.body}</p>}
                      <p className="mt-1 text-2xs text-ink-faint">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
