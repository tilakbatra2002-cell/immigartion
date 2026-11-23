import { cx } from '../ui';

export default function DataTable({ columns, rows, keyField = '_id', onRowClick, empty, loading, skeleton, className, dense }) {
  return (
    <div className={cx('overflow-x-auto', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line bg-slate-50/70">
            {columns.map((c) => (
              <th key={c.key} className={cx('table-th', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading ? skeleton
            : rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="p-0">{empty}</td></tr>
            ) : rows.map((row) => (
              <tr key={row[keyField]}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cx('transition', onRowClick && 'cursor-pointer hover:bg-slate-50/80')}>
                {columns.map((c) => (
                  <td key={c.key} className={cx('table-td', dense ? 'py-2' : '', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.className)}>
                    {c.render ? c.render(row) : row[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
