export function SiteWordMark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        lineHeight: 1,
        letterSpacing: "0.06em",
        fontFamily: "var(--font-bebas-neue), 'Arial Black', sans-serif",
        fontWeight: 400,
      }}
    >
      <span style={{ color: "#059669" }}>SOUQ</span>
      <span style={{ color: "#0ea5e9" }}>AUTO</span>
    </span>
  );
}
