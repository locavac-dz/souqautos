export function SiteWordMark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        background: "linear-gradient(to right, #059669, #0ea5e9)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        fontWeight: 900,
        letterSpacing: "0.04em",
        fontFamily: "'Montserrat', 'Arial Black', sans-serif",
        lineHeight: 1,
      }}
    >
      SOUQAUTO
    </span>
  );
}
