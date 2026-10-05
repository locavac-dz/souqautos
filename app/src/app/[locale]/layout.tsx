import type { Metadata, Viewport } from "next";
import { Bebas_Neue } from "next/font/google";

const bebasNeue = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas-neue", display: "swap" });
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, localeDirection, type AppLocale } from "@/i18n/routing";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { prisma } from "@/lib/prisma";
import { getManageableSellerIds } from "@/lib/listing-access";
import { getUnreadCount as getUnreadNotificationsCount } from "@/lib/notification-service";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CompareProvider } from "@/components/compare/CompareContext";
import { CompareTray } from "@/components/compare/CompareTray";
import { PwaRegister } from "@/components/PwaRegister";
import { PwaUpdateBanner } from "@/components/PwaUpdateBanner";
import { PageViewTracker } from "@/components/PageViewTracker";
import { ThemeApplicator } from "@/components/ThemeApplicator";
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
    icons: { apple: "/icons/icon-192.png" },
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
  const s3Origin = (() => {
    try { return process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL).origin : null; } catch { return null; }
  })();
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const tNav = await getTranslations({ locale, namespace: "Nav" });
  const user = await getCurrentUser();
  const direction = localeDirection[locale as AppLocale];

  const [unreadMessagesCount, unreadNotificationsCount, unreadGroupsCount] = user
    ? await Promise.all([
        prisma.message.count({
          where: {
            senderId: { not: user.id },
            readAt: null,
            conversation: {
              OR: [{ buyerId: user.id }, { sellerId: { in: await getManageableSellerIds(user.id) } }],
            },
          },
        }),
        getUnreadNotificationsCount(user.id),
        prisma.groupMember.findMany({
          where: { userId: user.id },
          select: {
            lastReadAt: true,
            group: { select: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } } },
          },
        }).then((ms) =>
          ms.filter((m) => m.group.messages[0] && (!m.lastReadAt || m.group.messages[0].createdAt > m.lastReadAt)).length
        ).catch(() => 0),
      ])
    : [0, 0, 0];

  return (
    <html lang={locale} dir={direction} className={bebasNeue.variable}>
      <body className="min-h-screen flex flex-col antialiased">
        {s3Origin && <link rel="preconnect" href={s3Origin} />}
        <NextIntlClientProvider messages={messages}>
          <CompareProvider>
            {/* Premier élément atteint au clavier : invisible tant qu'il n'a pas le focus, il évite de retraverser toute la navigation à chaque page. */}
            <a
              href="#contenu"
              className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
            >
              {tNav("skipToContent")}
            </a>
            <SiteHeader
              user={
                user
                  ? { email: user.email, displayName: user.profile?.displayName ?? null, role: user.role }
                  : null
              }
              unreadMessagesCount={unreadMessagesCount}
              unreadNotificationsCount={unreadNotificationsCount}
              unreadGroupsCount={unreadGroupsCount}
            />
            <main id="contenu" tabIndex={-1} className="flex-1 focus:outline-none">
              {children}
            </main>
            <SiteFooter />
            <CompareTray />
            <PwaRegister />
            <PwaUpdateBanner />
            <PageViewTracker />
            <ThemeApplicator />
          </CompareProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
