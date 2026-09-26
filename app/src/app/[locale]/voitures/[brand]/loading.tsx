export default function BrandLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-pulse space-y-6">
      <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
            <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
