import { cx } from '../ui';

export default function FilterBar({ children, className }) {
  return <div className={cx('flex flex-wrap items-center gap-2', className)}>{children}</div>;
}

export function FilterSelect({ value, onChange, options, placeholder, className }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)}
      className={cx('focus-ring h-9 rounded-lg border border-line bg-white px-2.5 pr-7 text-xs font-medium text-ink-soft shadow-card transition hover:border-slate-300 focus:border-brand-500', className)}>
      <option value="">{placeholder}</option>
      {options.map((o, i) => {
        const val = o.value ?? o.key;
        return <option key={`${val}-${i}`} value={val}>{o.label}</option>;
      })}
    </select>
  );
}
