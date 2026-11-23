import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, FileText, Mail, Briefcase, MessageSquare, Bot, AlertTriangle, Settings2, Send, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import { Button, Tabs, Badge, EmptyState, Select, Textarea, Input, Spinner, ErrorState } from '../../components/ui';
import { CASE_STATUSES, labelFor } from '../../lib/constants';

const TOOLS = [
  { key: 'assistant', label: 'Ask assistant', icon: Bot },
  { key: 'case', label: 'Case summary', icon: Briefcase },
  { key: 'email', label: 'Draft email', icon: Mail },
  { key: 'document', label: 'Document summary', icon: FileText },
  { key: 'reply', label: 'Client reply', icon: MessageSquare },
];

export default function AIAssistant() {
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('assistant');
  const status = useQuery({ queryKey: ['ai', 'status'], queryFn: () => api.get('/ai/status') });
  const usage = useQuery({ queryKey: ['ai', 'usage'], queryFn: () => api.get('/ai/usage') });

  if (status.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;
  const configured = status.data?.configured && status.data?.planEnabled;

  return (
    <div className="page-enter">
      <PageHeader title="AI Assistant" description="Draft, summarise and extract — always with a human in the loop. AI never decides visa outcomes or submits applications." />

      {!configured && (
        <div className="card mb-4 border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900">AI is not available on this workspace</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                {!status.data?.planEnabled ? 'AI assistance requires the Professional plan or above. Upgrade in Billing to enable it.' : 'No AI provider key is configured on the server. Add AI_API_KEY to the server environment to enable these tools.'}
              </p>
              <p className="mt-2 text-xs text-amber-800">Every workflow in ImmigrationFlow has a manual alternative — documents, emails and reports all work without AI.</p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-2xs">
                <Badge tone="warning">Provider: {status.data?.provider || 'none'}</Badge>
                <Badge tone="muted">Model: {status.data?.model || '—'}</Badge>
                <Badge tone="muted">Calls: {status.data?.usage?.calls || 0}</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <Tabs tabs={TOOLS.map((t) => ({ key: t.key, label: t.label }))} value={tab} onChange={setTab} className="px-3 pt-1" />
        <div className="p-4">
          {!configured ? <EmptyState icon={Sparkles} title="Configure AI to unlock these tools" description="Once enabled, you can summarise documents, draft client emails and generate case briefs." />
            : tab === 'assistant' ? <AssistantTool />
            : tab === 'case' ? <CaseSummaryTool />
            : tab === 'email' ? <EmailTool />
            : tab === 'document' ? <DocumentTool />
            : <ReplyTool />}
        </div>
      </div>

      {configured && usage.data?.summary?.length > 0 && (
        <div className="card mt-4 p-4">
          <h2 className="text-sm font-bold text-ink">Usage this billing period</h2>
          <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {usage.data.summary.map((u) => (
              <div key={u._id} className="rounded-lg border border-line p-2.5"><p className="text-2xs text-ink-soft">{u._id.replace(/_/g, ' ').toLowerCase()}</p>
                <p className="font-ui text-sm font-bold text-ink">{u.calls} calls</p><p className="text-2xs text-ink-faint">{u.tokens.toLocaleString()} tokens</p></div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 rounded-card border border-line bg-white p-3.5">
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-700" />
          <div className="text-2xs leading-relaxed text-ink-soft">
            <span className="font-semibold text-ink">How AI is used here:</span> outputs are drafting aids, not advice. Extracted data is marked unverified until a consultant confirms it. The assistant never has access to other organizations' data and never predicts approval or refusal outcomes.
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantTool() {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const ask = async (e) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true); setAnswer(null);
    try { const r = await api.post('/ai/assistant', { question: q }); setAnswer(r); }
    catch (err) { toast.error('Assistant unavailable', err.message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <form onSubmit={ask} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. How many cases are waiting on documents?" className="flex-1" />
        <Button type="submit" loading={busy} icon={Send} disabled={!q.trim()}>Ask</Button>
      </form>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {['Summarise pending cases', 'What should I follow up today?', 'How much is outstanding?'].map((s) => (
          <button key={s} onClick={() => setQ(s)} className="rounded-full border border-line px-2.5 py-1 text-2xs text-ink-soft hover:bg-slate-50">{s}</button>
        ))}
      </div>
      {busy && <div className="mt-6 flex justify-center"><Spinner /></div>}
      {answer && (
        <div className="mt-5 rounded-lg border border-line bg-canvas p-4">
          <div className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wide text-brand-700"><Sparkles size={11} />Answer</div>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink">{answer.answer}</p>
          {answer.dataPoints?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">{answer.dataPoints.map((d, i) => <Badge key={i} tone="muted" size="sm">{d}</Badge>)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function CaseSummaryTool() {
  const toast = useToast();
  const cases = useQuery({ queryKey: ['cases', 'picker'], queryFn: () => api.get('/cases?limit=100') });
  const [caseId, setCaseId] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Select label="Case" value={caseId} onChange={(e) => setCaseId(e.target.value)} placeholder="Select a case">
        {(cases.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.reference} — {c.clientId?.firstName} {c.clientId?.lastName}</option>)}
      </Select>
      <Button loading={busy} disabled={!caseId} onClick={async () => {
        setBusy(true); setResult(null);
        try { setResult(await api.post('/ai/summarize-case', { caseId })); } catch (e) { toast.error('AI unavailable', e.message); } finally { setBusy(false); }
      }} icon={Briefcase}>Summarise case</Button>
      {busy && <div className="flex justify-center py-6"><Spinner /></div>}
      {result && (
        <div className="rounded-lg border border-brand-200 bg-brand-25 p-4">
          <p className="text-xs leading-relaxed text-ink">{result.summary}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[['Highlights', result.highlights], ['Pending actions', result.pendingActions], ['Missing docs', result.missingDocuments]].map(([l, items]) => (
              <div key={l}><p className="text-2xs font-bold uppercase tracking-wide text-brand-800">{l}</p>
                <ul className="mt-1 space-y-0.5">{items?.length ? items.map((i, k) => <li key={k} className="text-2xs text-ink-soft">• {i}</li>) : <li className="text-2xs text-ink-faint">None</li>}</ul></div>
            ))}
          </div>
          {result.risks?.length > 0 && <div className="mt-2"><p className="text-2xs font-bold uppercase tracking-wide text-amber-700">Risks</p><ul>{result.risks.map((r, i) => <li key={i} className="text-2xs text-amber-800">• {r}</li>)}</ul></div>}
          <p className="mt-2 text-[10px] text-brand-700">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function EmailTool() {
  const toast = useToast();
  const clients = useQuery({ queryKey: ['clients', 'picker'], queryFn: () => api.get('/clients?limit=100&status=ACTIVE') });
  const cases = useQuery({ queryKey: ['cases', 'picker'], queryFn: () => api.get('/cases?limit=100') });
  const [form, setForm] = useState({ intent: 'DOCUMENT_REMINDER', clientId: '', caseId: '', context: '', tone: 'FORMAL' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label="Purpose" value={form.intent} onChange={(e) => setForm({ ...form, intent: e.target.value })}>
          {[['GENERAL', 'General message'], ['DOCUMENT_REMINDER', 'Document reminder'], ['FOLLOW_UP', 'Follow-up'], ['CONSULTATION_FOLLOW_UP', 'Consultation follow-up'], ['CASE_UPDATE', 'Case update'], ['INVOICE_REMINDER', 'Invoice reminder']].map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Select label="Tone" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>
          {['FORMAL', 'FRIENDLY', 'CONCISE'].map((t) => <option key={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
        </Select>
        <Select label="Client (optional)" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} placeholder="No specific client">
          {(clients.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.firstName} {c.lastName}</option>)}
        </Select>
        <Select label="Case (optional)" value={form.caseId} onChange={(e) => setForm({ ...form, caseId: e.target.value })} placeholder="No specific case">
          {(cases.data?.data || []).map((c) => <option key={c._id} value={c._id}>{c.reference}</option>)}
        </Select>
      </div>
      <Textarea label="Extra context" rows={2} value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} placeholder="Anything the email should mention…" />
      <Button loading={busy} onClick={async () => {
        setBusy(true); setResult(null);
        try { setResult(await api.post('/ai/draft-email', form)); } catch (e) { toast.error('AI unavailable', e.message); } finally { setBusy(false); }
      }} icon={Mail}>Draft email</Button>
      {busy && <div className="flex justify-center py-6"><Spinner /></div>}
      {result && (
        <div className="rounded-lg border border-line bg-canvas p-4">
          <p className="text-2xs font-bold uppercase tracking-wide text-ink-faint">Subject</p>
          <p className="text-xs font-semibold text-ink">{result.subject}</p>
          <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink">{result.body}</p>
          <div className="mt-3 flex gap-2">
            <Button size="xs" variant="secondary" onClick={() => { navigator.clipboard?.writeText(`${result.subject}\n\n${result.body}`); toast.success('Copied to clipboard'); }}>Copy</Button>
            {result.missingDocs?.length > 0 && <Badge tone="warning" size="sm">Mentions {result.missingDocs.length} missing document{result.missingDocs.length > 1 ? 's' : ''}</Badge>}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentTool() {
  const toast = useToast();
  const docs = useQuery({ queryKey: ['documents', 'picker'], queryFn: () => api.get('/documents?limit=50') });
  const [documentId, setDocumentId] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Select label="PDF document" value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="Select a PDF document">
        {(docs.data?.data || []).filter((d) => d.versions?.some((v) => v.mimeType === 'application/pdf') || d.versions?.length).map((d) => <option key={d._id} value={d._id}>{d.name} — {d.caseId?.reference || d.clientId?.firstName || 'unlinked'}</option>)}
      </Select>
      <Button loading={busy} disabled={!documentId} onClick={async () => {
        setBusy(true); setResult(null);
        try { setResult(await api.post('/ai/summarize-document', { documentId })); } catch (e) { toast.error('AI unavailable', e.message); } finally { setBusy(false); }
      }} icon={FileText}>Summarise document</Button>
      {busy && <div className="flex justify-center py-6"><Spinner /></div>}
      {result && (
        <div className="rounded-lg border border-line bg-canvas p-4">
          <div className="flex items-center gap-2"><Badge tone="warning" size="sm">Unverified extraction</Badge>{result.summary?.documentType && <Badge tone="muted" size="sm">{result.summary.documentType}</Badge>}</div>
          <p className="mt-2 text-xs leading-relaxed text-ink">{result.summary.summary}</p>
          {result.summary.extracted && (
            <div className="mt-3 overflow-hidden rounded-lg border border-line bg-white">
              <table className="w-full"><thead><tr className="bg-slate-50"><th className="table-th">Field</th><th className="table-th">Extracted value</th></tr></thead>
                <tbody className="divide-y divide-line">{Object.entries(result.summary.extracted).map(([k, v]) => <tr key={k}><td className="table-td py-1.5 text-2xs text-ink-soft">{k}</td><td className="table-td py-1.5 text-xs font-medium">{String(v)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          {result.summary.flags?.length > 0 && <div className="mt-2 rounded bg-amber-50 p-2 text-2xs text-amber-800">{result.summary.flags.map((f, i) => <p key={i}>• {f}</p>)}</div>}
          <p className="mt-2 text-[10px] text-ink-faint">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function ReplyTool() {
  const toast = useToast();
  const [form, setForm] = useState({ clientMessage: '', action: 'REPLY', targetLanguage: '' });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <Textarea label="Client message" rows={4} value={form.clientMessage} onChange={(e) => setForm({ ...form, clientMessage: e.target.value })} placeholder="Paste the client's message or your rough draft…" />
      <div className="flex gap-2">
        <Select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })} className="w-40">
          <option value="REPLY">Draft a reply</option><option value="IMPROVE">Improve clarity</option><option value="TRANSLATE">Translate</option>
        </Select>
        {form.action === 'TRANSLATE' && <Input value={form.targetLanguage} onChange={(e) => setForm({ ...form, targetLanguage: e.target.value })} placeholder="Target language, e.g. Hindi" className="flex-1" />}
      </div>
      <Button loading={busy} disabled={!form.clientMessage.trim()} onClick={async () => {
        setBusy(true); setResult(null);
        try { setResult(await api.post('/ai/client-reply', form)); } catch (e) { toast.error('AI unavailable', e.message); } finally { setBusy(false); }
      }} icon={MessageSquare}>Generate</Button>
      {busy && <div className="flex justify-center py-6"><Spinner /></div>}
      {result && (
        <div className="rounded-lg border border-line bg-canvas p-4">
          {result.subject && <><p className="text-2xs font-bold uppercase tracking-wide text-ink-faint">Subject</p><p className="text-xs font-semibold">{result.subject}</p></>}
          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink">{result.body}</p>
          <Button size="xs" variant="secondary" className="mt-2" onClick={() => { navigator.clipboard?.writeText(result.body); toast.success('Copied'); }}>Copy</Button>
        </div>
      )}
    </div>
  );
}
