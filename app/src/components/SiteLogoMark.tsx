export function SiteLogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="slm-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="url(#slm-grad)" />
      <text
        x="32"
        y="49"
        textAnchor="middle"
        fill="white"
        fontSize="50"
        fontWeight="bold"
        fontFamily="var(--font-bebas-neue), 'Arial Black', Impact, sans-serif"
      >
        S
      </text>
    </svg>
  );
}
