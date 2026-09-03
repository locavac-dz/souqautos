import { defineRouting } from "next-intl/routing";

// Priorité FR > AR > EN, cf. docs/ARCHITECTURE.md §42 (RTL prévu dès la conception).
export const routing = defineRouting({
  locales: ["fr", "ar"],
  defaultLocale: "fr",
});

export type AppLocale = (typeof routing.locales)[number];

export const localeDirection: Record<AppLocale, "ltr" | "rtl"> = {
  fr: "ltr",
  ar: "rtl",
};
