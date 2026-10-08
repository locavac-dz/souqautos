import { getTranslations } from "next-intl/server";

// Lot 264 — bandeau affiché au retour de la page de paiement Chargily (?paiement=ok|echec). Purement
// informatif : « ok » signifie que le prestataire a renvoyé l'acheteur sur l'adresse de succès, PAS que
// la commande est confirmée (c'est le webhook ou la relecture qui le fait) — le texte le dit.
export async function PaymentReturnBanner({ outcome }: { outcome: string | undefined }) {
  if (outcome !== "ok" && outcome !== "echec") return null;
  const t = await getTranslations("Payment");
  const ok = outcome === "ok";
  return (
    <p
      role="status"
      className={
        ok
          ? "mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
          : "mb-6 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
      }
    >
      {ok ? t("returnOk") : t("returnFailed")}
    </p>
  );
}
