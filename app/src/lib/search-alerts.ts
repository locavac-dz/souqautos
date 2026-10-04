import { Prisma, type Listing } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { searchParamsSchema } from "@/lib/validation/search";
import { buildListingWhere } from "@/lib/search";
import { sendPushToUser } from "@/lib/push-send";
import { createNotification } from "@/lib/notification-service";

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
  const emailResult = await sendEmail({
    to: alert.user.email,
    subject: t("searchAlertMatchSubject"),
    html: `<p>${t("greeting")}</p><p>${t("searchAlertMatchBody", {
      alertLabel: escapeHtml(alert.label),
      title: escapeHtml(listing.title),
      price: listing.price.toLocaleString(alert.user.locale === "ar" ? "ar-DZ" : "fr-DZ"),
    })}</p><p><a href="${SITE_URL}/${alert.user.locale}/annonce/${listing.id}">${t(
      "searchAlertMatchLink"
    )}</a></p>`,
  }).catch((err) => {
    console.error(`[EMAIL alerte recherche] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (emailResult?.previewUrl) {
    console.log(`[EMAIL alerte recherche] ${emailResult.previewUrl}`);
  }

  // Lot 121 — même alerte sur les appareils abonnés aux notifications (sans effet si la
  // personne n'en a activé aucune, ou si les clés du site ne sont pas configurées). Ne lève
  // jamais d'exception : l'email ci-dessus est déjà parti.
  const locale = alert.user.locale === "ar" ? "ar" : "fr";
  await sendPushToUser(alert.userId, {
    title: t("pushSearchAlertTitle"),
    body: t("pushSearchAlertBody", {
      title: listing.title,
      price: listing.price.toLocaleString(locale === "ar" ? "ar-DZ" : "fr-DZ"),
    }),
    url: `/${locale}/annonce/${listing.id}`,
    tag: `alert-${alert.id}-${listing.id}`,
    lang: locale,
  });

  await createNotification(alert.userId, "SEARCH_ALERT_MATCH", {
    url: `/${locale}/annonce/${listing.id}`,
    body: listing.title,
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
  await Promise.all(alerts.map((alert) => notifyOneSearchAlert(alert, listing)));
}
