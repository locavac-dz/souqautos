import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { isExpired } from "@/lib/verification";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { sendEmail } from "@/lib/mailer";
import { emailChangedNoticeEmail, normalizeNoticeLocale } from "@/lib/email-change-emails";

// Lot 229 — l'ancienne adresse est prévenue ; l'échec du courriel ne défait pas le changement (le courriel est un filet, pas la règle).
async function notifyPreviousAddress(owner: { email: string; locale: string }, newEmail: string) {
  try {
    await sendEmail({ to: owner.email, ...emailChangedNoticeEmail(normalizeNoticeLocale(owner.locale), { previousEmail: owner.email, newEmail }) });
  } catch (error) {
    console.error(`[EMAIL changement d'adresse] avertissement à l'ancienne adresse non envoyé : ${(error as Error).message}`);
  }
}

export default async function ConfirmEmailChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("Verification");

  const record = await prisma.emailChangeRequest.findUnique({ where: { token } });

  let status: "success" | "expired" | "invalid" | "taken" = "invalid";
  if (record) {
    if (isExpired(record.expiresAt)) {
      status = "expired";
      await prisma.emailChangeRequest.delete({ where: { id: record.id } });
    } else {
      // Re-vérifié au moment de la confirmation : l'adresse a pu être prise
      // par un autre compte entre la demande et le clic sur le lien.
      const existing = await prisma.user.findUnique({ where: { email: record.newEmail } });
      if (existing && existing.id !== record.userId) {
        status = "taken";
        await prisma.emailChangeRequest.delete({ where: { id: record.id } });
      } else {
        // Cliquer ce lien prouve la possession de la nouvelle adresse — elle
        // est donc considérée vérifiée dès l'activation, sans étape séparée.
        const owner = await prisma.user.findUnique({ where: { id: record.userId }, select: { email: true, locale: true } });
        try {
          await prisma.user.update({
            where: { id: record.userId },
            data: { email: record.newEmail.toLowerCase(), emailVerifiedAt: new Date() },
          });
          status = "success";
          if (owner) await notifyPreviousAddress(owner, record.newEmail.toLowerCase());
        } catch (error) {
          // L'adresse a été prise entre la vérification ci-dessus et l'écriture.
          if (!isUniqueViolation(error)) throw error;
          status = "taken";
        }
        await prisma.emailChangeRequest.delete({ where: { id: record.id } });
      }
    }
  }

  const message =
    status === "success"
      ? t("emailChangeConfirmed")
      : status === "expired"
        ? t("emailChangeLinkExpired")
        : status === "taken"
          ? t("emailChangeTaken")
          : t("emailChangeLinkInvalid");

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className={status === "success" ? "text-emerald-700" : "text-red-600"}>{message}</p>
      <Link href="/compte/profil" className="mt-4 inline-block text-sm text-slate-500 hover:underline">
        {t("backToProfile")}
      </Link>
    </div>
  );
}
