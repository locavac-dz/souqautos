import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth-server/current-user";
import { checkRateLimit } from "@/lib/rate-limit";
import { resolvePushConfig } from "@/lib/push";
import { sendPushToUser } from "@/lib/push-send";

// Lot 121 — envoie une notification d'essai à TOUS les appareils du compte, pour que la personne
// vérifie que tout fonctionne (bouton « Envoyer une notification d'essai »).
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: NO_STORE });
  }

  if (!(await checkRateLimit(`push-test:${user.id}`, { limit: 5, windowMs: 60 * 60 * 1000 }))) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  }

  if (resolvePushConfig(process.env).mode !== "enabled") {
    return NextResponse.json({ error: "push_disabled" }, { status: 503, headers: NO_STORE });
  }

  const locale = user.locale === "ar" ? "ar" : "fr";
  const t = await getTranslations({ locale, namespace: "Notifications" });
  const result = await sendPushToUser(user.id, {
    title: t("pushTestTitle"),
    body: t("pushTestBody"),
    url: `/${locale}/compte/alertes`,
    tag: "push-test",
    lang: locale,
  });

  return NextResponse.json(result, { headers: NO_STORE });
}
