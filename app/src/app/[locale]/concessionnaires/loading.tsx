export default function ConcessionnairesLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-pulse space-y-6">
      {/* Title */}
      <div className="h-8 w-56 rounded bg-slate-200 dark:bg-slate-700" />

      {/* Dealer list */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="h-12 w-12 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-1/4 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
