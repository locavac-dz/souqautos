import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, localeDirection, type AppLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { prisma } from "@/lib/prisma";
import { getManageableSellerIds } from "@/lib/listing-access";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CompareProvider } from "@/components/compare/CompareContext";
import { CompareTray } from "@/components/compare/CompareTray";
import { PwaRegister } from "@/components/PwaRegister";
import { PageViewTracker } from "@/components/PageViewTracker";
import { buildSearchEngineVerification } from "@/lib/seo-verification";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Lot 120 — couleur de la barre du navigateur sur mobile et de l'application installée.
export const viewport: Viewport = { themeColor: "#12222e" };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Brand" });
  return {
    title: `${t("name")} — ${t("tagline")}`,
    description: t("tagline"),
    // Lot 120 — application installable (le manifeste est servi par src/app/manifest.ts).
    applicationName: t("name"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    // Lot 124 — preuve de propriété du site pour Google Search Console et Bing Webmaster Tools
    // (variables GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION ; rien n'est émis si elles sont absentes).
    ...buildSearchEngineVerification(process.env),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const user = await getCurrentUser();
  const direction = localeDirection[locale as AppLocale];

  const unreadMessagesCount = user
    ? await prisma.message.count({
        where: {
          senderId: { not: user.id },
          readAt: null,
          conversation: {
            OR: [{ buyerId: user.id }, { sellerId: { in: await getManageableSellerIds(user.id) } }],
          },
        },
      })
    : 0;

  return (
    <html lang={locale} dir={direction}>
      <body className="min-h-screen flex flex-col antialiased">
        <NextIntlClientProvider messages={messages}>
          <CompareProvider>
            <SiteHeader
              user={
                user
                  ? { email: user.email, displayName: user.profile?.displayName ?? null, role: user.role }
                  : null
              }
              unreadMessagesCount={unreadMessagesCount}
            />
            <main className="flex-1">{children}</main>
            <SiteFooter />
            <CompareTray />
            <PwaRegister />
            <PageViewTracker />
          </CompareProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
