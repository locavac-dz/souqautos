import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { EditProfileForm } from "@/components/EditProfileForm";
import { EmailChangeForm } from "@/components/EmailChangeForm";
import { AvatarUpload } from "@/components/AvatarUpload";
import { DeleteAccountForm } from "@/components/DeleteAccountForm";
import { Link } from "@/i18n/navigation";

export default async function EditProfilePage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("ProfileEdit");
  const tSecurity = await getTranslations("TwoFactor");
  const wilayas = await prisma.wilaya.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t("subtitle")}</p>
      <div className="mb-6">
        <AvatarUpload initialAvatarUrl={user.profile?.avatarUrl ?? null} />
      </div>
      <div className="mb-6">
        <EmailChangeForm currentEmail={user.email} hasPassword={Boolean(user.passwordHash)} />
      </div>
      {/* Lot 138 — double authentification. */}
      <p className="mb-6 text-sm">
        <Link href="/compte/securite" className="font-medium text-slate-900 dark:text-slate-100 underline hover:text-slate-700 dark:hover:text-slate-300">
          {tSecurity("securityLink")}
        </Link>
      </p>
      <EditProfileForm
        wilayas={wilayas}
        initialDisplayName={user.profile?.displayName ?? ""}
        initialWilayaId={user.profile?.wilayaId ?? null}
        initialPhone={user.phone}
        initialBio={user.profile?.bio ?? null}
        initialWhatsappEnabled={user.whatsappEnabled}
        phoneVerified={Boolean(user.phoneVerifiedAt)}
      />
      <div className="mt-10 border-t border-slate-200 dark:border-slate-700 pt-6">
        <h2 className="text-base font-medium text-slate-900 dark:text-slate-100 mb-1">{t("exportDataTitle")}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{t("exportDataDescription")}</p>
        <a
          href="/api/profile/export"
          download
          className="inline-block rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {t("exportDataAction")}
        </a>
      </div>

      <div className="mt-10">
        <DeleteAccountForm hasPassword={Boolean(user.passwordHash)} />
      </div>
    </div>
  );
}
