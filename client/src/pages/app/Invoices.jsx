import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Receipt, Trash2, Send, Download, Wallet, CreditCard, XCircle, Eye, FileText } from 'lucide-react';
import { api, qs, downloadFile } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import PageHeader from '../../components/domain/PageHeader';
import DataTable from '../../components/domain/DataTable';
import FilterBar, { FilterSelect } from '../../components/domain/FilterBar';
import ConfirmDialog from '../../components/domain/ConfirmDialog';
import { InvoiceStatus } from '../../components/domain/StatusBadge';
import { Button, SearchInput, Pagination, EmptyState, ErrorState, TableSkeleton, Modal, Input, Textarea, Select, Badge, PageSkeleton } from '../../components/ui';
import { INVOICE_STATUSES, PAYMENT_METHODS, COUNTRIES } from '../../lib/constants';
import { money, date, num } from '../../lib/format';
import InvoiceForm from './InvoiceForm';

export default function Invoices() {
  const { can, organization } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState({ status: params.get('status') || '', type: '' });
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(params.get('new') === '1');
  const [detail, setDetail] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [payment, setPayment] = useState({ amount: '', method: 'BANK_TRANSFER', reference: '', notes: '', paidAt: '' });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [sendMail, setSendMail] = useState(true);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { setPage(1); }, [debounced, filters]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoices', { page, debounced, ...filters }],
    queryFn: () => api.get(`/invoices${qs({ page, limit: 20, q: debounced, ...filters })}`),
  });
  const detailQuery = useQuery({ queryKey: ['invoice', detail?._id], queryFn: () => api.get(`/invoices/${detail._id}`), enabled: Boolean(detail?._id) });
  const pendingTask = useQuery({ queryKey: ['invoices', 'picker'], queryFn: () => api.get('/invoices?limit=100&status=SENT'), enabled: false });

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['invoice'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  const create = useMutation({
    mutationFn: (payload) => api.post('/invoices', payload),
    onSuccess: (inv) => { toast.success('Invoice created', inv.invoiceNumber); invalidate(); setFormOpen(false); setDetail(inv); },
    onError: (e) => toast.error('Could not create invoice', e.message),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status, sendEmail }) => api.patch(`/invoices/${id}/status`, { status, sendEmail }),
    onSuccess: (res) => {
      if (res.email && !res.email.sent) toast.warning('Marked sent, but email was not delivered', res.email.error);
      else toast.success('Invoice updated');
      invalidate();
    },
    onError: (e) => toast.error('Update failed', e.message),
  });

  const recordPayment = useMutation({
    mutationFn: () => api.post(`/invoices/${detail._id}/payments`, { amount: Number(payment.amount), method: payment.method, reference: payment.reference, notes: payment.notes, paidAt: payment.paidAt || undefined }),
    onSuccess: () => { toast.success('Payment recorded'); invalidate(); setPaymentOpen(false); setPayment({ amount: '', method: 'BANK_TRANSFER', reference: '', notes: '', paidAt: '' }); },
    onError: (e) => toast.error('Could not record payment', e.message),
  });

  const remove = useMutation({
    mutationFn: (id) => api.del(`/invoices/${id}`),
    onSuccess: () => { toast.success('Invoice deleted'); setDeleteTarget(null); invalidate(); },
    onError: (e) => { toast.error('Delete failed', e.message); setDeleteTarget(null); },
  });

  const s = data?.summary || {};
  const currency = organization?.currency || 'INR';
  const detailData = detailQuery.data;

  const columns = [
    { key: 'invoiceNumber', header: 'Invoice', render: (i) => <div><p className="font-ui text-xs font-semibold text-ink">{i.invoiceNumber}</p><p className="text-2xs text-ink-faint">{i.type === 'QUOTATION' ? 'Quotation' : 'Invoice'} · {date(i.issueDate)}</p></div> },
    { key: 'client', header: 'Client', render: (i) => i.clientId ? <div><p className="text-xs text-ink">{i.clientId.firstName} {i.clientId.lastName}</p><p className="font-ui text-2xs text-ink-faint">{i.clientId.reference}</p></div> : '—' },
    { key: 'total', header: 'Total', align: 'right', render: (i) => <span className="font-ui text-xs font-semibold text-ink">{money(i.total, i.currency)}</span> },
    { key: 'balance', header: 'Balance', align: 'right', render: (i) => <span className={`font-ui text-xs font-semibold ${i.balance > 0 && i.status !== 'CANCELLED' ? 'text-amber-700' : 'text-ink-faint'}`}>{money(i.balance, i.currency)}</span> },
    { key: 'dueDate', header: 'Due', render: (i) => <span className="whitespace-nowrap text-xs text-ink-soft">{i.dueDate ? date(i.dueDate) : '—'}</span> },
    { key: 'status', header: 'Status', render: (i) => <InvoiceStatus status={i.status} /> },
    {
      key: 'actions', header: '', align: 'right', render: (i) => (
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setDetail(i)} className="rounded p-1.5 text-ink-faint hover:bg-slate-100 hover:text-ink" title="View"><Eye size={13} /></button>
          <button onClick={() => downloadFile(`/invoices/${i._id}/pdf`, `${i.invoiceNumber}.pdf`).catch((e) => toast.error('PDF failed', e.message))} className="rounded p-1.5 text-ink-faint hover:bg-slate-100 hover:text-ink" title="Download PDF"><Download size={13} /></button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-enter">
      <PageHeader title="Invoices & quotations" description="Bill clients in six currencies with tax, discounts, part payments and PDF delivery."
        actions={can('invoices.create') && <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>New invoice</Button>} />

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[['Total invoiced', money(s.total || 0, currency, true)], ['Collected', money(s.paid || 0, currency, true)],
          ['Outstanding', money(s.balance || 0, currency, true)], ['Documents', num(s.count || 0)]].map(([k, v]) => (
          <div key={k} className="card p-3"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{k}</p><p className="mt-0.5 font-ui text-lg font-bold text-ink">{v}</p></div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoice number…" className="flex-1" />
          <FilterBar>
            <FilterSelect value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} placeholder="All statuses" options={INVOICE_STATUSES.map((s) => ({ key: s, label: s.replace(/_/g, ' ').toLowerCase() }))} />
            <FilterSelect value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })} placeholder="All types" options={[{ key: 'INVOICE', label: 'Invoices' }, { key: 'QUOTATION', label: 'Quotations' }]} />
          </FilterBar>
        </div>
        {isError ? <ErrorState message={error?.message} onRetry={refetch} /> : (
          <>
            <DataTable columns={columns} rows={data?.data || []} loading={isLoading} skeleton={<TableSkeleton rows={6} cols={6} bare />} onRowClick={(i) => setDetail(i)}
              empty={<EmptyState icon={Receipt} title="No invoices yet" description="Create your first invoice or quotation."
                action={can('invoices.create') ? <Button size="sm" icon={Plus} onClick={() => setFormOpen(true)}>New invoice</Button> : null} />} />
            <Pagination meta={data?.meta} onPage={setPage} />
          </>
        )}
      </div>

      <InvoiceForm open={formOpen} onClose={() => setFormOpen(false)} saving={create.isPending} onSubmit={(p) => create.mutate(p)} defaultCurrency={currency} />

      <Modal open={Boolean(detail)} onClose={() => setDetail(null)} title={detailData ? `${detailData.invoiceNumber}` : 'Invoice'} size="lg"
        description={detailData?.clientId ? `${detailData.clientId.firstName} ${detailData.clientId.lastName} · ${detailData.clientId.reference}` : undefined}
        footer={detailData && (
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1.5">
              <Button variant="secondary" size="sm" icon={Download} onClick={() => downloadFile(`/invoices/${detailData._id}/pdf`, `${detailData.invoiceNumber}.pdf`).catch((e) => toast.error('PDF failed', e.message))}>PDF</Button>
              {can('invoices.delete') && detailData.status === 'DRAFT' && <Button variant="danger-outline" size="sm" icon={Trash2} onClick={() => setDeleteTarget(detailData)}>Delete</Button>}
              {can('invoices.update') && detailData.status === 'DRAFT' && <Button variant="secondary" size="sm" icon={Send} onClick={() => setStatus.mutate({ id: detailData._id, status: 'SENT', sendEmail: false })}>Mark sent</Button>}
              {can('payments.record') && detailData.status !== 'PAID' && detailData.status !== 'CANCELLED' && detailData.type === 'INVOICE' && (
                <Button size="sm" icon={Wallet} onClick={() => { setPayment((p) => ({ ...p, amount: String(detailData.balance) })); setPaymentOpen(true); }}>Record payment</Button>
              )}
              {can('invoices.update') && ['DRAFT', 'SENT'].includes(detailData.status) && <Button variant="danger-outline" size="sm" icon={XCircle} onClick={() => setStatus.mutate({ id: detailData._id, status: 'CANCELLED' })}>Cancel</Button>}
            </div>
            <InvoiceStatus status={detailData.status} />
          </div>
        )}>
        {!detailData ? <PageSkeleton /> : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[['Issue date', date(detailData.issueDate)], ['Due date', detailData.dueDate ? date(detailData.dueDate) : '—'],
                ['Currency', detailData.currency], ['Case', detailData.caseId?.reference || '—']].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-canvas p-2.5"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">{k}</p><p className="mt-0.5 text-xs text-ink">{v}</p></div>
              ))}
            </div>

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full">
                <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Description</th><th className="table-th text-right">Qty</th><th className="table-th text-right">Rate</th><th className="table-th text-right">Amount</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {detailData.items.map((it, i) => (
                    <tr key={i}><td className="table-td py-2">{it.description}</td><td className="table-td py-2 text-right">{it.quantity}</td>
                      <td className="table-td py-2 text-right">{money(it.unitPrice, detailData.currency)}</td><td className="table-td py-2 text-right font-semibold">{money(it.amount, detailData.currency)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="space-y-1 border-t border-line bg-slate-50/60 p-3 text-xs">
                <div className="flex justify-between"><span className="text-ink-soft">Subtotal</span><span className="font-medium">{money(detailData.subtotal, detailData.currency)}</span></div>
                {detailData.discount > 0 && <div className="flex justify-between"><span className="text-ink-soft">Discount{detailData.discountType === 'PERCENT' ? ` (${detailData.discountValue}%)` : ''}</span><span className="text-red-600">-{money(detailData.discount, detailData.currency)}</span></div>}
                {detailData.taxAmount > 0 && <div className="flex justify-between"><span className="text-ink-soft">Tax ({detailData.taxRate}%)</span><span>{money(detailData.taxAmount, detailData.currency)}</span></div>}
                <div className="flex justify-between border-t border-line pt-1 text-sm font-bold"><span>Total</span><span>{money(detailData.total, detailData.currency)}</span></div>
                {detailData.amountPaid > 0 && <div className="flex justify-between text-emerald-700"><span>Paid</span><span>{money(detailData.amountPaid, detailData.currency)}</span></div>}
                <div className="flex justify-between font-semibold"><span>Balance due</span><span className={detailData.balance > 0 ? 'text-amber-700' : 'text-emerald-700'}>{money(detailData.balance, detailData.currency)}</span></div>
              </div>
            </div>

            {detailData.notes && <div className="rounded-lg bg-canvas p-2.5"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Notes</p><p className="mt-0.5 text-xs text-ink">{detailData.notes}</p></div>}
            {detailData.terms && <div className="rounded-lg bg-canvas p-2.5"><p className="text-2xs font-semibold uppercase tracking-wide text-ink-faint">Terms</p><p className="mt-0.5 text-xs text-ink">{detailData.terms}</p></div>}

            <div>
              <h3 className="mb-1.5 text-xs font-bold text-ink">Payments</h3>
              {!detailData.payments?.length ? <p className="rounded-lg bg-canvas p-2.5 text-xs text-ink-soft">No payments recorded yet.</p>
                : <div className="divide-y divide-line rounded-lg border border-line">
                  {detailData.payments.map((p) => (
                    <div key={p._id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div><p className="text-xs font-semibold text-ink">{money(p.amount, p.currency)} <span className="font-normal text-ink-faint">· {p.method.replace(/_/g, ' ').toLowerCase()}</span></p>
                        <p className="text-2xs text-ink-faint">{date(p.paidAt)}{p.reference ? ` · ${p.reference}` : ''} · recorded by {p.recordedBy?.name || '—'}</p></div>
                      <Badge tone={p.status === 'SUCCESS' ? 'success' : 'warning'} size="sm">{p.status}</Badge>
                    </div>
                  ))}
                </div>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Record payment" size="sm"
        description={`Outstanding balance: ${detailData ? money(detailData.balance, detailData.currency) : ''}`}
        footer={<><Button variant="secondary" size="sm" onClick={() => setPaymentOpen(false)}>Cancel</Button><Button size="sm" loading={recordPayment.isPending} disabled={!payment.amount || Number(payment.amount) <= 0} onClick={() => recordPayment.mutate()}>Record payment</Button></>}>
        <div className="space-y-3">
          <Input label="Amount" type="number" min="0" step="0.01" required value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} suffix={detailData?.currency} />
          <Select label="Method" value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })}>
            {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Paid on" type="date" value={payment.paidAt} onChange={(e) => setPayment({ ...payment, paidAt: e.target.value })} />
            <Input label="Reference" value={payment.reference} onChange={(e) => setPayment({ ...payment, reference: e.target.value })} placeholder="UTR / txn ID" />
          </div>
          <Textarea label="Notes" rows={2} value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} />
          <p className="rounded-lg bg-canvas px-2.5 py-2 text-2xs text-ink-soft">Only record payments you have actually received. Online collection requires a configured Stripe or Razorpay integration.</p>
        </div>
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={() => remove.mutate(deleteTarget._id)} busy={remove.isPending}
        title="Delete draft invoice?" description={<>Draft <strong className="text-ink">{deleteTarget?.invoiceNumber}</strong> will be permanently deleted. Issued invoices can only be cancelled to preserve the audit trail.</>} confirmLabel="Delete draft" />
    </div>
  );
}
