export default function ModelLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-pulse space-y-10">
      {/* Header: name + stats */}
      <div className="space-y-3">
        <div className="h-8 w-64 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>
      </div>

      {/* Price history chart placeholder */}
      <div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-700" />

      {/* Listings */}
      <div>
        <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-700 mb-4" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-700" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-5 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
