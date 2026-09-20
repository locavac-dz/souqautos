import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { WizardProvider } from "@/components/wizard/WizardContext";

export default async function PublierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    redirect({ href: "/connexion", locale });
    return null;
  }

  return (
    <WizardProvider>
      <div className="border-b border-slate-100 bg-slate-50/50">
        <div className="mx-auto max-w-2xl px-4 py-2 text-xs text-slate-500">
          Publier une annonce
        </div>
      </div>
      {children}
    </WizardProvider>
  );
}
