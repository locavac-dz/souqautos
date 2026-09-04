import { Prisma, type Listing } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/mailer";
import { SITE_URL } from "@/lib/site";
import { searchParamsSchema } from "@/lib/validation/search";
import { buildListingWhere } from "@/lib/search";

// Déclenché une seule fois, au moment précis où une annonce devient PUBLIEE
// (approbation en modération) — un vrai événement métier, pas un balayage
// périodique : contrairement au rappel d'expiration (Lot 48), "une nouvelle
// annonce correspond à mon alerte" n'a de sens qu'au moment où elle devient
// réellement visible, pas à la prochaine visite d'une page par un tiers.
export async function notifyMatchingSearchAlerts(listing: Listing): Promise<void> {
  const alerts = await prisma.searchAlert.findMany({
    where: { userId: { not: listing.sellerId } },
    include: { user: true },
  });

  for (const alert of alerts) {
    let filters;
    try {
      filters = searchParamsSchema.parse(JSON.parse(alert.filters));
    } catch {
      continue; // alerte corrompue/format inattendu — ignorée, jamais un crash du flux de modération
    }

    const where = buildListingWhere(filters);
    const match = await prisma.listing.findFirst({
      where: { AND: [where, { id: listing.id }] },
      select: { id: true },
    });
    if (!match) continue;

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
        continue; // déjà notifié pour cette annonce précise
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
  }
}
