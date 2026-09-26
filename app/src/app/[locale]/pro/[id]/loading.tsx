export default function ProShowcaseLoading() {
  return (
    <div className="animate-pulse">
      {/* Banner */}
      <div className="h-40 sm:h-56 w-full bg-slate-200 dark:bg-slate-700" />

      <div className="mx-auto max-w-4xl px-4 py-10 space-y-8">
        {/* Logo + name */}
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="space-y-2">
            <div className="h-7 w-48 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        </div>

        {/* Contact / info bar */}
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 w-28 rounded-full bg-slate-200 dark:bg-slate-700" />
          ))}
        </div>

        {/* Listings grid */}
        <div>
          <div className="h-5 w-36 rounded bg-slate-200 dark:bg-slate-700 mb-4" />
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
    </div>
  );
}
