export default function AnnonceLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 animate-pulse">
      {/* Galerie */}
      <div className="aspect-[16/9] rounded-xl bg-slate-200 dark:bg-slate-700" />

      {/* Titre + prix */}
      <div className="mt-6 space-y-3">
        <div className="h-7 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
        <div className="h-8 w-40 rounded bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Tags */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-20 rounded-full bg-slate-200 dark:bg-slate-700" />
        ))}
      </div>

      {/* Corps : détails + vendeur */}
      <div className="mt-8 grid sm:grid-cols-3 gap-8">
        <div className="sm:col-span-2 space-y-4">
          <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-4/6 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-4 w-3/6 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="space-y-3">
          <div className="h-24 rounded-lg bg-slate-200 dark:bg-slate-700" />
          <div className="h-10 rounded-md bg-slate-200 dark:bg-slate-700" />
          <div className="h-10 rounded-md bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  );
}
