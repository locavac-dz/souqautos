export default function ProTableauDeBordLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-pulse space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <div className="h-3 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-7 w-12 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>

      {/* Recent listings */}
      <div className="space-y-3">
        <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-700" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="h-16 w-20 shrink-0 rounded-md bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-5 w-28 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
