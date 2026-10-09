// Lot 269 (audit D6) — squelette de chargement générique pour les pages publiques dynamiques (fiche annonce,
// pages marque/modèle/wilaya, rubriques éditoriales) qui n'avaient pas de `loading.tsx` : sans lui, la navigation
// vers ces pages ne donne aucun retour visuel pendant la lecture en base. Même langage visuel que
// `recherche/loading.tsx` (blocs pulsés gris, mode sombre compris).
export function PageSkeleton({ variant = "article" }: { variant?: "article" | "grid" }) {
  const block = "rounded bg-slate-200 dark:bg-slate-700";
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-pulse" aria-busy="true" aria-live="polite">
      <div className={`h-4 w-40 ${block}`} />
      <div className={`mt-4 h-8 w-3/4 ${block}`} />
      {variant === "article" ? (
        <>
          <div className={`mt-6 aspect-video w-full ${block}`} />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`h-4 ${block}`} style={{ width: `${95 - (i % 3) * 12}%` }} />
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="aspect-[4/3] bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-2 p-3">
                <div className={`h-4 w-3/4 ${block}`} />
                <div className={`h-3 w-1/2 ${block}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
