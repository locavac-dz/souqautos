import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { EditProfileForm } from "@/components/EditProfileForm";
import { EmailChangeForm } from "@/components/EmailChangeForm";
import { AvatarUpload } from "@/components/AvatarUpload";

export default async function EditProfilePage() {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  const t = await getTranslations("ProfileEdit");
  const wilayas = await prisma.wilaya.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 mb-6">{t("subtitle")}</p>
      <div className="mb-6">
        <AvatarUpload initialAvatarUrl={user.profile?.avatarUrl ?? null} />
      </div>
      <div className="mb-6">
        <EmailChangeForm currentEmail={user.email} />
      </div>
      <EditProfileForm
        wilayas={wilayas}
        initialDisplayName={user.profile?.displayName ?? ""}
        initialWilayaId={user.profile?.wilayaId ?? null}
        initialPhone={user.phone}
        initialBio={user.profile?.bio ?? null}
        phoneVerified={Boolean(user.phoneVerifiedAt)}
      />
    </div>
  );
}
