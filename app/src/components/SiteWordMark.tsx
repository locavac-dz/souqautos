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
        <span className="text-slate-800 dark:text-slate-100">Souq&nbsp;</span>
        <span className="text-cyan-600 dark:text-teal-400">Auto</span>
      </span>
      <span className="sr-only">Souq Auto</span>
    </>
  );
}
