import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { isExpired } from "@/lib/verification";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("Verification");

  const record = await prisma.emailVerificationToken.findUnique({ where: { token } });

  let status: "success" | "expired" | "invalid" = "invalid";
  if (record) {
    if (isExpired(record.expiresAt)) {
      status = "expired";
      await prisma.emailVerificationToken.delete({ where: { id: record.id } });
    } else {
      await prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
      await prisma.emailVerificationToken.delete({ where: { id: record.id } });
      status = "success";
    }
  }

  const message =
    status === "success" ? t("emailConfirmed") : status === "expired" ? t("linkExpired") : t("linkInvalid");

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <p className={status === "success" ? "text-emerald-700" : "text-red-600"}>{message}</p>
      <Link href="/compte/tableau-de-bord" className="mt-4 inline-block text-sm text-slate-500 hover:underline">
        {t("backToDashboard")}
      </Link>
    </div>
  );
}
