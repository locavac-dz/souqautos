export default function MessagesLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 animate-pulse">
      <div className="h-7 w-40 rounded bg-slate-200 dark:bg-slate-700 mb-6" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="h-12 w-12 shrink-0 rounded-md bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="h-3 w-12 shrink-0 rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
