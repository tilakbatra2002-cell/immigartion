import { createContext, useContext, useCallback, useState, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);
let idc = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const push = useCallback((type, title, description, duration = 4500) => {
    const id = ++idc;
    setToasts((t) => [...t.slice(-4), { id, type, title, description }]);
    if (duration) timers.current[id] = setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);

  const toast = useRef({
    success: (title, desc) => push('success', title, desc),
    error: (title, desc) => push('error', title, desc, 6000),
    info: (title, desc) => push('info', title, desc),
    warning: (title, desc) => push('warning', title, desc, 6000),
  }).current;

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-600" />,
    error: <XCircle size={18} className="text-red-600" />,
    info: <Info size={18} className="text-brand-600" />,
    warning: <AlertTriangle size={18} className="text-amber-600" />,
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 px-2 sm:px-0" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="card page-enter flex items-start gap-3 border-l-[3px] p-3 shadow-pop"
            style={{ borderLeftColor: { success: '#059669', error: '#DC2626', info: '#2563EB', warning: '#D97706' }[t.type] }}>
            <div className="mt-0.5 shrink-0">{icons[t.type]}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-ink-soft break-words">{t.description}</p>}
            </div>
            <button onClick={() => dismiss(t.id)} className="shrink-0 rounded p-1 text-ink-faint hover:bg-slate-100" aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};
