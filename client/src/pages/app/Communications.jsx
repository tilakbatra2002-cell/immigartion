import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, MessageSquare, Mail, MessageCircle, Send, StickyNote, AlertTriangle, CheckCircle2, XCircle, FileText, Trash2, Sparkles } from 'lucide-react';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import { Button, SearchInput, Pagination, EmptyState, ErrorState, TableSkeleton, Modal, Input, Textarea, Select, Tabs, Badge, Avatar, Spinner } from '../../components/ui';
import { TEMPLATE_CATEGORIES, MESSAGE_CHANNEL_LABELS } from '../../lib/constants';
import { date, dateTime, timeAgo } from '../../lib/format';

const CHANNEL_ICON = { EMAIL: Mail, WHATSAPP: MessageCircle, PORTAL: MessageSquare };
const CHANNEL_TONE = { EMAIL: 'info', WHATSAPP: 'success', PORTAL: 'violet' };

export default function Communications() {
  const { can } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState('conversations');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ channel: '' });
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ subject: '', channel: 'EMAIL', clientId: params.get('leadId') ? '' : '', leadId: params.get('leadId') || '' });
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, filters]);

  const conversations = useQuery({
    queryKey: ['conversations', { page, debounced, ...filters }],
    queryFn: () => api.get(`/communications/conversations${qs({ page, limit: 20, q: debounced, ...filters })}`),
    enabled: tab === 'conversations',
  });
  const history = useQuery({
    queryKey: ['messages', { page, debounced, ...filters }],
    queryFn: () => api.get(`/communications/messages${qs({ page, limit: 25, q: debounced, ...filters })}`),
    enabled: tab === 'history',
  });
  const active = useQuery({
    queryKey: ['conversation', activeId],
    queryFn: () => api.get(`/communications/conversations/${activeId}`),
    enabled: Boolean(activeId),
  });
  const status = useQuery({ queryKey: ['integrations', 'comms'], queryFn: () => api.get('/communications/integrations/status') });
  const templates = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/communications/templates') });
  const clients = useQuery({ queryKey: ['clients', 'picker'], queryFn: () => api.get('/clients?limit=100&status=ACTIVE'), enabled: newOpen });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active.data?.messages?.length]);

  const createConv = useMutation({
    mutationFn: () => api.post('/communications/conversations', newForm),
    onSuccess: (conv) => { toast.success('Conversation started'); qc.invalidateQueries({ queryKey: ['conversations'] }); setNewOpen(false); setActiveId(conv._id); setTab('conversations'); },
    onError: (e) => toast.error('Could not start conversation', e.message),
  });

  const send = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const res = await api.post(`/communications/conversations/${activeId}/messages`, { body: message });
      if (!res.delivered) {
        toast.warning('Message saved — not delivered', res.error);
      } else {
        toast.success('Message sent');
      }
      setMessage(''); setSelectedTemplate('');
      qc.invalidateQueries({ queryKey: ['conversation', activeId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) { toast.error('Could not send', e.message); } finally { setBusy(false); }
  };

  const addNote = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await api.post(`/communications/conversations/${activeId}/notes`, { body: message });
      setMessage(''); qc.invalidateQueries({ queryKey: ['conversation', activeId] });
      toast.success('Internal note added');
    } catch (e) { toast.error('Could not add note', e.message); } finally { setBusy(false); }
  };

  const applyTemplate = (id) => {
    setSelectedTemplate(id);
    const t = templates.data?.data?.find((x) => x._id === id);
    if (t) setMessage(t.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => {
      const conv = active.data;
      const vars = { client_name: conv?.clientId ? `${conv.clientId.firstName} ${conv.clientId.lastName || ''}`.trim() : '', case_reference: conv?.caseId?.reference || '', company: '' };
      return vars[k] ?? m;
    }));
  };

  const conv = active.data;
  const channels = [{ key: 'EMAIL', label: 'Email' }, { key: 'WHATSAPP', label: 'WhatsApp' }, { key: 'PORTAL', label: 'Portal' }];

  return (
    <div className="page-enter">
      <PageHeader title="Communications" description="Email, WhatsApp and portal conversations per client — with honest delivery states and internal notes."
        actions={can('communications.send') && <Button size="sm" icon={Plus} onClick={() => setNewOpen(true)}>New conversation</Button>} />

      {(!status.data?.email?.configured || !status.data?.whatsapp?.configured) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
          <AlertTriangle size={14} />
          <span className="font-semibold">Integration status:</span>
          {!status.data?.email?.configured && <Badge tone="warning">Email (SMTP) not configured — messages will be saved but not delivered</Badge>}
          {!status.data?.whatsapp?.configured && <Badge tone="warning">WhatsApp not connected — only portal messages deliver</Badge>}
          <span className="text-amber-800">Configure in server environment variables. Nothing is faked.</span>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-3">
          <Tabs tabs={[{ key: 'conversations', label: 'Conversations' }, { key: 'history', label: 'Message history' }, { key: 'templates', label: 'Templates' }]} value={tab} onChange={setTab} className="border-0" />
        </div>

        {tab === 'conversations' && (
          <div className="grid min-h-[560px] grid-cols-1 lg:grid-cols-[330px_1fr]">
            <div className="border-b border-line lg:border-b-0 lg:border-r">
              <div className="space-y-2 border-b border-line p-2.5">
                <SearchInput value={search} onChange={setSearch} placeholder="Search subject…" />
                <FilterSelect value={filters.channel} onChange={(v) => setFilters({ ...filters, channel: v })} placeholder="All channels" options={channels} className="h-8 w-full" />
              </div>
              <div className="max-h-[520px] overflow-y-auto">
                {conversations.isLoading ? <div className="space-y-2 p-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-lg" />)}</div>
                  : conversations.isError ? <ErrorState message={conversations.error?.message} onRetry={conversations.refetch} />
                  : !conversations.data?.data?.length ? <EmptyState icon={MessageSquare} title="No conversations" description="Start a conversation with a client or lead." className="py-12" />
                  : conversations.data.data.map((c) => {
                    const Icon = CHANNEL_ICON[c.channel] || MessageSquare;
                    return (
                      <button key={c._id} onClick={() => setActiveId(c._id)}
                        className={`flex w-full items-start gap-2.5 border-b border-line px-3 py-2.5 text-left transition hover:bg-slate-50 ${activeId === c._id ? 'bg-brand-25' : ''}`}>
                        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-ink-faint`}><Icon size={13} /></span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-semibold text-ink">{c.clientId ? `${c.clientId.firstName} ${c.clientId.lastName || ''}` : c.subject}</p>
                            {c.unreadForStaff > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[9px] font-bold text-white">{c.unreadForStaff}</span>}
                          </div>
                          <p className="truncate text-2xs text-ink-soft">{c.lastMessagePreview || c.subject}</p>
                          <p className="text-2xs text-ink-faint">{c.lastMessageAt ? timeAgo(c.lastMessageAt) : 'New'} · {c.channel.toLowerCase()}</p>
                        </div>
                      </button>
                    );
                  })}
              </div>
              <Pagination meta={conversations.data?.meta} onPage={setPage} className="border-t border-line" />
            </div>

            <div className="flex min-h-[480px] flex-col">
              {!activeId ? (
                <EmptyState icon={MessageSquare} title="Select a conversation" description="Choose a thread on the left, or start a new one with a client." className="flex-1" />
              ) : active.isLoading ? <div className="flex flex-1 items-center justify-center"><Spinner /></div>
                : active.isError ? <ErrorState message={active.error?.message} onRetry={active.refetch} />
                : (
                  <>
                    <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                      <div>
                        <p className="text-xs font-bold text-ink">{conv.clientId ? `${conv.clientId.firstName} ${conv.clientId.lastName || ''}` : conv.subject}</p>
                        <p className="text-2xs text-ink-faint">{conv.subject}{conv.caseId ? ` · ${conv.caseId.reference}` : ''} · {conv.channel.toLowerCase()}</p>
                      </div>
                      <Badge tone={CHANNEL_TONE[conv.channel] || 'neutral'}>{conv.channel.toLowerCase()}</Badge>
                    </div>
                    <div className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 440 }}>
                      {!conv.messages?.length ? <p className="py-10 text-center text-xs text-ink-faint">No messages yet.</p>
                        : conv.messages.map((m) => (
                          <div key={m._id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : m.direction === 'INTERNAL' ? 'justify-center' : 'justify-start'}`}>
                            {m.direction === 'INTERNAL' ? (
                              <div className="max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                                <p className="text-2xs font-semibold uppercase tracking-wide text-amber-700"><StickyNote size={10} className="mr-1 inline" />Internal note</p>
                                <p className="mt-0.5 whitespace-pre-wrap text-xs text-amber-900">{m.body}</p>
                                <p className="mt-1 text-2xs text-amber-700">{m.authorName} · {timeAgo(m.createdAt)}</p>
                              </div>
                            ) : (
                              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${m.direction === 'OUTBOUND' ? 'bg-brand-600 text-white' : 'border border-line bg-white'}`}>
                                <p className={`whitespace-pre-wrap text-xs ${m.direction === 'OUTBOUND' ? 'text-white' : 'text-ink'}`}>{m.body}</p>
                                <div className={`mt-1 flex items-center gap-1.5 text-[10px] ${m.direction === 'OUTBOUND' ? 'text-brand-100' : 'text-ink-faint'}`}>
                                  <span>{m.direction === 'OUTBOUND' ? `You · ${m.authorName}` : m.authorName || 'Client'}</span>
                                  <span>·</span><span>{timeAgo(m.createdAt)}</span>
                                  {m.status === 'FAILED' && <span className="flex items-center gap-0.5 text-red-300"><XCircle size={9} />Not delivered</span>}
                                  {m.status === 'SENT' && m.direction === 'OUTBOUND' && <span className="flex items-center gap-0.5"><CheckCircle2 size={9} />Sent</span>}
                                </div>
                                {m.error && m.direction === 'OUTBOUND' && <p className="mt-1 rounded bg-red-500/20 px-1.5 py-0.5 text-[10px] text-red-100">{m.error}</p>}
                              </div>
                            )}
                          </div>
                        ))}
                      <div ref={bottomRef} />
                    </div>
                    {can('communications.send') && (
                      <div className="border-t border-line p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                          <Select value={selectedTemplate} onChange={(e) => applyTemplate(e.target.value)} className="h-8 w-auto min-w-[160px] text-xs">
                            <option value="">Insert template…</option>
                            {(templates.data?.data || []).filter((t) => t.channel === conv.channel || conv.channel === 'PORTAL').map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
                          </Select>
                          {can('ai.use') && (
                            <Button size="xs" variant="ghost" icon={Sparkles}
                              onClick={async () => {
                                if (!message.trim()) { toast.info('Type a draft first', 'AI will improve your message.'); return; }
                                try { const r = await api.post('/ai/client-reply', { clientMessage: message, action: 'IMPROVE' }); if (r.body) setMessage(r.body); } catch (e) { toast.error('AI unavailable', e.message); }
                              }}>Improve</Button>
                          )}
                        </div>
                        <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={`Write a ${conv.channel.toLowerCase()} message…`} />
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-2xs text-ink-faint">
                            {conv.channel === 'EMAIL' && !status.data?.email?.configured ? 'SMTP not configured — will save as FAILED'
                              : conv.channel === 'WHATSAPP' && !status.data?.whatsapp?.configured ? 'WhatsApp not connected — will save as FAILED'
                              : conv.channel === 'PORTAL' ? 'Delivered to client portal' : 'Will send on click'}
                          </p>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="secondary" icon={StickyNote} loading={busy} disabled={!message.trim()} onClick={addNote}>Note</Button>
                            <Button size="sm" icon={Send} loading={busy} disabled={!message.trim()} onClick={send}>Send</Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
            </div>
          </div>
        )}

        {tab === 'history' && (
          <>
            <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
              <SearchInput value={search} onChange={setSearch} placeholder="Search message text…" className="flex-1" />
              <FilterBar><FilterSelect value={filters.channel} onChange={(v) => setFilters({ ...filters, channel: v })} placeholder="All channels" options={channels} /></FilterBar>
            </div>
            {history.isLoading ? <TableSkeleton rows={6} cols={4} />
              : history.isError ? <ErrorState message={history.error?.message} onRetry={history.refetch} />
              : !history.data?.data?.length ? <EmptyState icon={MessageSquare} title="No messages" description="Sent and received messages will appear here." />
              : (
                <>
                  <div className="divide-y divide-line">
                    {history.data.data.map((m) => (
                      <div key={m._id} className="flex items-start gap-3 px-4 py-2.5">
                        <Badge tone={m.direction === 'OUTBOUND' ? 'info' : m.direction === 'INTERNAL' ? 'warning' : 'success'} size="sm">{m.direction.toLowerCase()}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-ink">{m.subject || m.conversationId?.subject || '—'}</p>
                          <p className="line-clamp-2 text-2xs text-ink-soft">{m.body}</p>
                          <p className="text-2xs text-ink-faint">{m.channel.toLowerCase()} · {m.conversationId?.clientId ? `${m.conversationId.clientId.firstName} ${m.conversationId.clientId.lastName || ''}` : ''} · {dateTime(m.createdAt)}</p>
                        </div>
                        <Badge tone={m.status === 'SENT' || m.status === 'DELIVERED' ? 'success' : m.status === 'FAILED' ? 'danger' : 'muted'} size="sm">{m.status.toLowerCase()}</Badge>
                      </div>
                    ))}
                  </div>
                  <Pagination meta={history.data?.meta} onPage={setPage} />
                </>
              )}
          </>
        )}

        {tab === 'templates' && <TemplatesPanel canManage={can('communications.templates')} />}
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Start conversation" size="sm"
        footer={<><Button variant="secondary" size="sm" onClick={() => setNewOpen(false)}>Cancel</Button><Button size="sm" loading={createConv.isPending} disabled={!newForm.subject.trim()} onClick={() => createConv.mutate()}>Start</Button></>}>
        <div className="space-y-3">
          <Input label="Subject" required value={newForm.subject} onChange={(e) => setNewForm({ ...newForm, subject: e.target.value })} placeholder="Document reminder — permanent residency" />
          <Select label="Channel" value={newForm.channel} onChange={(e) => setNewForm({ ...newForm, channel: e.target.value })}>
            {channels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </Select>
          {!newForm.leadId && (
            <Select label="Client" value={newForm.clientId} onChange={(e) => setNewForm({ ...newForm, clientId: e.target.value })} placeholder="Select client">
              {(clients.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.firstName} {c.lastName} · {c.reference}</option>)}
            </Select>
          )}
          {newForm.leadId && <p className="rounded-lg bg-canvas p-2.5 text-2xs text-ink-soft">This conversation is linked to a lead enquiry.</p>}
        </div>
      </Modal>
    </div>
  );
}

function TemplatesPanel({ canManage }) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['templates'], queryFn: () => api.get('/communications/templates') });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', channel: 'EMAIL', category: 'GENERAL', subject: '', body: '' });

  const save = useMutation({
    mutationFn: () => api.post('/communications/templates', form),
    onSuccess: () => { toast.success('Template saved'); qc.invalidateQueries({ queryKey: ['templates'] }); setOpen(false); setForm({ name: '', channel: 'EMAIL', category: 'GENERAL', subject: '', body: '' }); },
    onError: (e) => toast.error('Could not save', e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => api.del(`/communications/templates/${id}`),
    onSuccess: () => { toast.success('Template deleted'); qc.invalidateQueries({ queryKey: ['templates'] }); },
  });

  return (
    <div className="p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-ink-soft">Reusable email and WhatsApp templates. Use <code className="rounded bg-slate-100 px-1 font-mono">{'{{client_name}}'}</code>, <code className="rounded bg-slate-100 px-1 font-mono">{'{{case_reference}}'}</code>.</p>
        {canManage && <Button size="sm" icon={Plus} onClick={() => setOpen(true)}>New template</Button>}
      </div>
      {isLoading ? <TableSkeleton rows={3} cols={3} /> : !data?.data?.length ? (
        <EmptyState icon={FileText} title="No templates" description="Create templates for document reminders, follow-ups and invoice emails." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {data.data.map((t) => (
            <div key={t._id} className="rounded-lg border border-line p-3">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-xs font-semibold text-ink">{t.name}</p>
                  <div className="mt-1 flex gap-1"><Badge tone="muted" size="sm">{t.channel.toLowerCase()}</Badge><Badge tone="info" size="sm">{t.category.replace(/_/g, ' ').toLowerCase()}</Badge></div></div>
                {canManage && <button onClick={() => remove.mutate(t._id)} className="rounded p-1 text-ink-faint hover:bg-red-50 hover:text-red-600"><Trash2 size={12} /></button>}
              </div>
              {t.subject && <p className="mt-1.5 text-2xs font-medium text-ink-soft">Subject: {t.subject}</p>}
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-2xs text-ink-faint">{t.body}</p>
            </div>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New template" size="md"
        footer={<><Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" loading={save.isPending} disabled={!form.name.trim() || !form.body.trim()} onClick={() => save.mutate()}>Save template</Button></>}>
        <div className="space-y-3">
          <Input label="Template name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Channel" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {['EMAIL', 'WHATSAPP', 'PORTAL'].map((c) => <option key={c} value={c}>{c.toLowerCase()}</option>)}
            </Select>
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {TEMPLATE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </div>
          <Input label="Subject (email)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <Textarea label="Body" rows={5} required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={'Dear {{client_name}},\n\nThis is a reminder about your case {{case_reference}}…'} />
        </div>
      </Modal>
    </div>
  );
}
