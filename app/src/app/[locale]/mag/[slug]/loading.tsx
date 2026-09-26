export default function MagArticleLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 animate-pulse space-y-6">
      {/* Cover */}
      <div className="aspect-[16/9] rounded-xl bg-slate-200 dark:bg-slate-700" />

      {/* Title */}
      <div className="space-y-3">
        <div className="h-8 w-full rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-8 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Body */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded bg-slate-200 dark:bg-slate-700 ${i % 4 === 3 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}
