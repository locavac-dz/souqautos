export default function MagLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-pulse space-y-8">
      {/* Title */}
      <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-700" />

      {/* Article grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <div className="aspect-[16/9] bg-slate-200 dark:bg-slate-700" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-4/5 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
