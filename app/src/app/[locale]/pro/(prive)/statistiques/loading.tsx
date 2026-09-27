export default function ProStatistiquesLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-pulse space-y-6">
      <div className="h-7 w-40 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-7 w-14 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
      <div className="h-48 rounded-xl bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
