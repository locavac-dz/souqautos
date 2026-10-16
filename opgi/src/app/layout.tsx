import type { ReactNode } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plateforme OPGI",
  description: "Gestion intégrée du patrimoine, des projets et des réclamations des OPGI.",
};

// CSP par nonce (mode par défaut) : le nonce est généré par requête dans le proxy
// et Next ne peut l'injecter dans ses scripts que lors d'un rendu dynamique. On
// force donc le rendu dynamique pour TOUTE l'application (sinon les pages
// statiques, dépourvues de nonce, verraient leurs scripts bloqués par la CSP).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
