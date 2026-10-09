import { Prisma, type Listing } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { searchParamsSchema } from "@/lib/validation/search";
import { buildListingWhere } from "@/lib/search";
import { notifyUser } from "@/lib/notify-user";

// Déclenché une seule fois, au moment précis où une annonce devient PUBLIEE
// (approbation en modération) — un vrai événement métier, pas un balayage
// périodique : contrairement au rappel d'expiration (Lot 48), "une nouvelle
// annonce correspond à mon alerte" n'a de sens qu'au moment où elle devient
// réellement visible, pas à la prochaine visite d'une page par un tiers.
async function notifyOneSearchAlert(
  alert: Prisma.SearchAlertGetPayload<{ include: { user: true } }>,
  listing: Listing
): Promise<void> {
  let filters;
  try {
    filters = searchParamsSchema.parse(JSON.parse(alert.filters));
  } catch {
    return; // alerte corrompue/format inattendu — ignorée, jamais un crash du flux de modération
  }

  const where = buildListingWhere(filters);
  const match = await prisma.listing.findFirst({
    where: { AND: [where, { id: listing.id }] },
    select: { id: true },
  });
  if (!match) return;

  // Marquage atomique avant l'envoi (même principe que le rappel
  // d'expiration, Lot 48) : l'index unique (alertId, listingId) empêche un
  // double envoi si cette fonction est appelée deux fois pour la même
  // transition (ex: re-approbation après suspension).
  try {
    await prisma.searchAlertNotification.create({
      data: { alertId: alert.id, listingId: listing.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return; // déjà notifié pour cette annonce précise
    }
    throw error;
  }

  const t = await getTranslations({ locale: alert.user.locale, namespace: "Notifications" });
  const locale = alert.user.locale === "ar" ? "ar" : "fr";
  const price = listing.price.toLocaleString(locale === "ar" ? "ar-DZ" : "fr-DZ");

  // Lot 271 — courriel (meilleur effort), push (Lot 121 : sans effet si aucun appareil abonné ou clés absentes)
  // et notification in-app en un appel ; aucun des trois ne lève.
  await notifyUser({
    userId: alert.userId,
    kind: "SEARCH_ALERT_MATCH",
    url: `/${locale}/annonce/${listing.id}`,
    body: listing.title,
    email: {
      tag: "alerte recherche",
      to: alert.user.email,
      subject: t("searchAlertMatchSubject"),
      html: `<p>${t("greeting")}</p><p>${t("searchAlertMatchBody", {
        alertLabel: escapeHtml(alert.label),
        title: escapeHtml(listing.title),
        price,
      })}</p><p><a href="${SITE_URL}/${alert.user.locale}/annonce/${listing.id}">${t(
        "searchAlertMatchLink"
      )}</a></p>`,
    },
    push: {
      title: t("pushSearchAlertTitle"),
      body: t("pushSearchAlertBody", { title: listing.title, price }),
      tag: `alert-${alert.id}-${listing.id}`,
      lang: locale,
    },
  });
}

export async function notifyMatchingSearchAlerts(listing: Listing): Promise<void> {
  const alerts = await prisma.searchAlert.findMany({
    where: { userId: { not: listing.sellerId } },
    include: { user: true },
  });

  // Chaque alerte est indépendante (sa propre requête de correspondance, son
  // propre envoi d'email) — traitées en parallèle plutôt que séquentiellement
  // (Lot 99, audit qualité), une seule échouant (email/DB) n'affecte jamais
  // les autres grâce au .catch() sur sendEmail et à la propagation normale
  // d'erreur Prisma pour le reste.
  // Lot 268 (audit B5) — par lots de 10 : « toutes en parallèle » saturait le pool de connexions Prisma
  // (une requête par alerte) au détriment des visiteurs pendant quelques secondes.
  for (let i = 0; i < alerts.length; i += SEARCH_ALERT_CONCURRENCY) {
    await Promise.all(alerts.slice(i, i + SEARCH_ALERT_CONCURRENCY).map((alert) => notifyOneSearchAlert(alert, listing)));
  }
}

export const SEARCH_ALERT_CONCURRENCY = 10;
