import { cx } from '../ui';

export default function PageHeader({ title, description, actions, children, className, back }) {
  return (
    <div className={cx('mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="min-w-0">
        {back}
        <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-soft">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
