import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { isAdmin } from "@/lib/auth-server/roles";
import { getModerationSettings } from "@/lib/moderation-settings";
import { ModerationSettingsForm } from "@/components/admin/ModerationSettingsForm";

export default async function AdminSettingsPage() {
  const currentUser = await getCurrentUser();
  const t = await getTranslations("AdminSettings");
  const settings = await getModerationSettings();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">{t("title")}</h1>
      <p className="text-sm text-slate-500 mb-6">{t("subtitle")}</p>
      <ModerationSettingsForm
        settings={settings}
        canEdit={Boolean(currentUser && isAdmin(currentUser.role))}
      />
    </div>
  );
}
