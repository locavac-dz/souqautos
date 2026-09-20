import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

// Lot 131 — page « introuvable » dans la langue du visiteur (jusqu'ici, la page anglaise par défaut de Next.js
// s'affichait aussi pour une adresse arabe). Rendue par notFound() dans n'importe quelle page de [locale] et par
// l'attrape-tout [...rest] pour une adresse qui ne correspond à aucune page. Next.js y ajoute le statut 404 et
// « noindex » : les moteurs de recherche ne gardent pas ces adresses.
export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{t("title")}</h1>
      <p className="mt-3 text-slate-600">{t("message")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link href="/" className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
          {t("home")}
        </Link>
        <Link href="/recherche" className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">
          {t("search")}
        </Link>
      </div>
    </div>
  );
}
