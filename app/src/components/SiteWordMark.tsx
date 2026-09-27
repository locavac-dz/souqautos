export function SiteWordMark({ className }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden="true"
        className={className}
        style={{
          display: "inline-flex",
          lineHeight: 1,
          letterSpacing: "0.06em",
          fontFamily: "var(--font-bebas-neue), 'Arial Black', sans-serif",
          fontWeight: 400,
        }}
      >
        <span className="text-emerald-700 dark:text-emerald-400">SOUQ</span>
        <span className="text-sky-700 dark:text-sky-400">AUTO</span>
      </span>
      <span className="sr-only">Souq Auto</span>
    </>
  );
}
