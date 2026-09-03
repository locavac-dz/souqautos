import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { sendEmail, escapeHtml } from "@/lib/mailer";

// Comblement de l'écart documenté depuis le Lot 31 : un compte suspendu perd
// immédiatement toute capacité authentifiée (cf. getCurrentUser) et ne peut
// donc plus voir l'information dans l'application elle-même — l'email est le
// seul canal restant pour l'en informer. Partagé entre la suspension manuelle
// et la suspension automatique (Lot 31) pour ne pas dupliquer ce patron.
export async function sendAccountSuspendedEmail(userId: string, reason: string): Promise<void> {
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return;

  const t = await getTranslations({ locale: target.locale, namespace: "Notifications" });
  const emailResult = await sendEmail({
    to: target.email,
    subject: t("accountSuspendedSubject"),
    html: `<p>${t("greeting")}</p><p>${t("accountSuspendedBody", { reason: escapeHtml(reason) })}</p>`,
  }).catch((err) => {
    console.error(`[EMAIL notification suspension de compte] échec envoi: ${(err as Error).message}`);
    return null;
  });
  if (emailResult?.previewUrl) {
    console.log(`[EMAIL notification suspension de compte] ${emailResult.previewUrl}`);
  }
}
