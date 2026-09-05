import type { Metadata } from "next";
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
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
          </CompareProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
