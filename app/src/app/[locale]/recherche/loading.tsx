export default function RechercheLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 grid sm:grid-cols-[260px_1fr] gap-8 animate-pulse">
      {/* Filtres */}
      <aside className="hidden sm:block space-y-6">
        <div className="h-5 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 rounded-md bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </aside>

      {/* Résultats */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-8 w-28 rounded-md bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-700" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-5 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
