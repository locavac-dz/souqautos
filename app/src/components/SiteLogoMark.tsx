export function SiteLogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="slm-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0BBFB0" />
          <stop offset="100%" stopColor="#0891B2" />
        </linearGradient>
      </defs>
      <path d="M 32 0 L 64 32 L 32 64 L 0 32 Z" fill="url(#slm-grad)" />
      <text
        x="32"
        y="46"
        textAnchor="middle"
        fill="white"
        fontSize="40"
        fontWeight="bold"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        S
      </text>
    </svg>
  );
}
