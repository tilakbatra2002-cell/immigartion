import { useQuery } from '@tanstack/react-query';
import { ReceiptIndianRupee, Download, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../context/ToastContext';
import { Badge, EmptyState, ErrorState, PageSkeleton, Button, Modal } from '../../components/ui';
import { useState } from 'react';
import { money, date } from '../../lib/format';

const STATUS_TONE = { PAID: 'success', SENT: 'info', PARTIALLY_PAID: 'warning', OVERDUE: 'danger', CANCELLED: 'muted', DRAFT: 'muted' };

export default function PortalInvoices() {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useQuery({ queryKey: ['portal', 'invoices'], queryFn: () => api.get('/portal/invoices') });
  const [info, setInfo] = useState(null);
  if (isLoading) return <PageSkeleton />;
  if (isError) return <ErrorState message={error?.message} onRetry={refetch} />;

  const rows = data?.data || [];
  const outstanding = rows.filter((i) => ['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status)).reduce((s, i) => s + (i.balance || 0), 0);

  return (
    <div className="page-enter">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-lg font-extrabold tracking-tight text-ink">Invoices</h1><p className="mt-0.5 text-xs text-ink-soft">Statements from your consultancy. Payments are recorded by staff.</p></div>
        {outstanding > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5"><p className="text-2xs text-amber-800">Outstanding</p><p className="font-ui text-sm font-bold text-amber-900">{money(outstanding, rows[0]?.currency || 'INR')}</p></div>}
      </div>

      <div className="card overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={ReceiptIndianRupee} title="No invoices" description="Invoices issued by your consultancy will appear here." /> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line bg-slate-50"><th className="table-th">Invoice</th><th className="table-th">Issued</th><th className="table-th">Due</th><th className="table-th">Status</th><th className="table-th text-right">Total</th><th className="table-th text-right">Balance</th><th className="table-th"></th></tr></thead>
              <tbody className="divide-y divide-line">
                {rows.map((i) => (
                  <tr key={i._id} className="hover:bg-slate-50/60">
                    <td className="table-td"><p className="font-ui text-xs font-semibold text-ink">{i.invoiceNumber}</p></td>
                    <td className="table-td text-2xs text-ink-soft">{date(i.issueDate)}</td>
                    <td className="table-td text-2xs"><span className={i.status === 'OVERDUE' ? 'font-semibold text-red-600' : 'text-ink-soft'}>{date(i.dueDate)}</span></td>
                    <td className="table-td"><Badge tone={STATUS_TONE[i.status]} size="sm">{i.status.toLowerCase().replace('_', ' ')}</Badge></td>
                    <td className="table-td text-right text-xs font-semibold text-ink">{money(i.total, i.currency)}</td>
                    <td className="table-td text-right text-xs">{money(i.balance, i.currency)}</td>
                    <td className="table-td text-right"><Button size="xs" variant="secondary" onClick={() => setInfo(i)}>Details</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mt-3 flex items-start gap-1 text-[10px] text-ink-faint"><AlertTriangle size={10} className="mt-0.5" />Online card payment is not enabled in the portal. Please arrange payment with your consultant by bank transfer or UPI as instructed on your invoice.</p>

      <Modal open={Boolean(info)} onClose={() => setInfo(null)} title={info?.invoiceNumber} size="sm" footer={<Button size="sm" onClick={() => setInfo(null)}>Close</Button>}>
        {info && (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-ink-soft">Issued</span><span>{date(info.issueDate)}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Due</span><span>{date(info.dueDate)}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Total</span><span className="font-semibold">{money(info.total, info.currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink-soft">Paid</span><span>{money(info.amountPaid, info.currency)}</span></div>
            <div className="flex justify-between border-t border-line pt-2"><span className="font-semibold text-ink">Balance</span><span className="font-bold text-ink">{money(info.balance, info.currency)}</span></div>
            <p className="rounded-lg bg-canvas p-2 text-2xs text-ink-soft">A PDF copy can be requested from your consultant. Your consultant records payments — portal balances update after each recorded payment.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
