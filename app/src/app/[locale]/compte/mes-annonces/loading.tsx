export default function MesAnnoncesLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-pulse">
      <div className="h-7 w-48 rounded bg-slate-200 dark:bg-slate-700 mb-6" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="h-24 w-32 shrink-0 rounded-lg bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-6 w-32 rounded bg-slate-200 dark:bg-slate-700" />
              <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <div className="h-7 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="h-7 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
