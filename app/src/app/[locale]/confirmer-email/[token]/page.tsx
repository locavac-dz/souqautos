import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { isExpired } from "@/lib/verification";

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
        await prisma.user.update({
          where: { id: record.userId },
          data: { email: record.newEmail, emailVerifiedAt: new Date() },
        });
        await prisma.emailChangeRequest.delete({ where: { id: record.id } });
        status = "success";
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
