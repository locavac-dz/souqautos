"use client";

import { useEffect, useState } from "react";
import "./globals.css";

// Lot 230 — dernier filet : une erreur levée par la mise en page racine elle-même (src/app/[locale]/layout.tsx — base injoignable lors de
// la lecture de la session, par exemple) n'est pas rattrapée par [locale]/error.tsx, qui vit À L'INTÉRIEUR de cette mise en page. Ici, plus
// rien n'est disponible : ni les messages next-intl, ni la navigation ; la page se rend seule, dans la langue de l'adresse.
const TEXT = {
  fr: { title: "Une erreur est survenue", message: "Le site n'a pas pu afficher cette page. Réessayez dans un instant.", retry: "Réessayer", home: "Retour à l'accueil" },
  ar: { title: "حدث خطأ", message: "تعذّر على الموقع عرض هذه الصفحة. أعد المحاولة بعد لحظات.", retry: "إعادة المحاولة", home: "العودة إلى الرئيسية" },
} as const;

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang] = useState<"fr" | "ar">(() => (typeof window !== "undefined" && window.location.pathname.startsWith("/ar") ? "ar" : "fr"));
  const t = TEXT[lang];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}>
      <body className="min-h-screen bg-white text-slate-900 antialiased">
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="mt-3 text-slate-600">{t.message}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
            <button type="button" onClick={reset} className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">
              {t.retry}
            </button>
            <a href={`/${lang}`} className="rounded-md border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50">
              {t.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
