export default function Logo({ size = 'md', dark = false, showText = true }) {
  const dims = { sm: 24, md: 28, lg: 34 }[size];
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={dims} height={dims} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill={dark ? '#fff' : '#101828'} />
        <path d="M8.5 23V9h2.9v14H8.5zm5.6 0V9h2.9l5 8.2V9h2.8v14h-2.8l-5-8.3V23h-2.9z" fill={dark ? '#101828' : '#fff'} />
        <circle cx="24.5" cy="9.5" r="2" fill="#2563EB" />
      </svg>
      {showText && (
        <span className={`font-sans text-[15px] font-extrabold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>
          ImmigrationFlow
        </span>
      )}
    </span>
  );
}
