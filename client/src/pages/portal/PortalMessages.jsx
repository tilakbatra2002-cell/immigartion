import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, MessagesSquare, Info } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Textarea, EmptyState, ErrorState, PageSkeleton, Spinner } from '../../components/ui';
import { dateTime } from '../../lib/format';

export default function PortalMessages() {
  const { user } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const endRef = useRef();
  const [text, setText] = useState('');
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['portal', 'messages'], queryFn: () => api.get('/portal/messages'), refetchInterval: 20000 });

  const send = useMutation({
    mutationFn: () => api.post('/portal/messages', { body: text.trim() }),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['portal', 'messages'] }); qc.invalidateQueries({ queryKey: ['portal', 'dashboard'] }); },
    onError: (e) => toast.error('Message not sent', e.message),
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [data?.messages?.length]);

  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;
  const messages = data?.messages || [];

  return (
    <div className="page-enter">
      <div className="mb-3"><h1 className="text-lg font-extrabold tracking-tight text-ink">Messages</h1><p className="mt-0.5 text-xs text-ink-soft">Direct line to your case team. Internal staff notes are never shown here.</p></div>

      <div className="card flex h-[calc(100vh-16rem)] min-h-[380px] flex-col overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center"><EmptyState icon={MessagesSquare} title="No messages yet" description="Send the first message — your consultant will reply here." /></div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto bg-canvas/60 p-3.5">
            {messages.map((m) => {
              const mine = m.isClientMessage || m.direction === 'INBOUND';
              return (
                <div key={m._id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-xl px-3 py-2 ${mine ? 'bg-brand-600 text-white' : 'border border-line bg-white text-ink'}`}>
                    {!mine && m.authorName && <p className="mb-0.5 text-[10px] font-semibold opacity-70">{m.authorName} · Case team</p>}
                    <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{m.body}</p>
                    <p className={`mt-1 text-[9px] ${mine ? 'text-white/60' : 'text-ink-faint'}`}>{dateTime(m.createdAt)}</p>
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
        <div className="border-t border-line p-2.5">
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }} className="flex items-end gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) send.mutate(); } }} rows={1} placeholder="Write a message… (Enter to send, Shift+Enter for a new line)" className="min-h-[38px] flex-1 resize-none text-xs" />
            <Button type="submit" size="sm" icon={Send} loading={send.isPending} disabled={!text.trim()} className="h-[38px]">Send</Button>
          </form>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-[10px] text-ink-faint"><Info size={9} />Plain messages are delivered in the portal; your consultant may also reply by email.</p>
            {send.isPending && <Spinner className="h-3 w-3" />}
          </div>
        </div>
      </div>
    </div>
  );
}
