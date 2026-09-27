export default function AdminLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 animate-pulse space-y-4">
      <div className="h-7 w-48 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 w-full rounded bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>
    </div>
  );
}
