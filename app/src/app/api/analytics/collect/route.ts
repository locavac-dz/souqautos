import { NextRequest, NextResponse, after } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";
import { isLikelyBot } from "@/lib/view-tracking";
import { classifyDevice, classifyPublicPath, classifyReferrer, isTrackingOptOut, parseBeacon } from "@/lib/analytics";
import { purgeOldPageViews, recordPageView } from "@/lib/analytics-record";
import { SITE_URL } from "@/lib/site";

// Lot 124 — reçoit la balise « une page a été vue » envoyée par le navigateur.
//
// Répond TOUJOURS 204, sans rien dire de ce qui a été gardé ou refusé (le navigateur n'a rien à en
// faire, et un visiteur malveillant n'apprend rien). Ce qui est lu de la requête : le chemin de la
// page, la provenance (réduite à une catégorie) et le User-Agent (réduit à mobile / tablette /
// ordinateur) — puis tout est jeté. L'adresse IP ne sert qu'à limiter le débit, et n'est jamais écrite.
const NO_CONTENT = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

// Une personne qui parcourt beaucoup de pages n'atteint jamais cette limite ; un script qui inonde la
// route la dépasse vite, et ses envois suivants sont simplement ignorés.
const HOURLY_LIMIT_PER_IP = 600;

// Suppression des compteurs de plus de 25 mois : une fois environ toutes les 2 000 balises acceptées,
// en tâche de fond, plutôt qu'un travail planifié de plus à exploiter.
const PURGE_PROBABILITY = 1 / 2000;

export async function POST(request: NextRequest) {
  if (isTrackingOptOut(request.headers)) return NO_CONTENT();

  const userAgent = request.headers.get("user-agent");
  if (isLikelyBot(userAgent)) return NO_CONTENT();

  const beacon = parseBeacon(await request.text().catch(() => ""));
  if (!beacon) return NO_CONTENT();

  const classified = classifyPublicPath(beacon.path);
  if (!classified) return NO_CONTENT();

  if (!(await checkRateLimit(`audience:${getClientIp(request)}`, { limit: HOURLY_LIMIT_PER_IP, windowMs: 60 * 60 * 1000 }))) {
    return NO_CONTENT();
  }

  const record = {
    ...classified,
    device: classifyDevice(userAgent),
    referrer: classifyOwnOrExternal(beacon.referrer, request.headers.get("host") ?? ""),
  };

  after(async () => {
    await recordPageView(record);
    if (Math.random() < PURGE_PROBABILITY) {
      await purgeOldPageViews().catch((error) => console.error(`[audience] purge impossible : ${(error as Error).message}`));
    }
  });

  return NO_CONTENT();
}

// Derrière un serveur intermédiaire, l'en-tête Host peut différer du domaine public : la provenance
// est « interne » si elle vient de l'un OU de l'autre.
function classifyOwnOrExternal(referrer: string | undefined, host: string) {
  const byHost = classifyReferrer(referrer, host);
  if (byHost !== "autre" && byHost !== "recherche" && byHost !== "reseaux") return byHost;
  let siteHost = "";
  try {
    siteHost = new URL(SITE_URL).hostname;
  } catch {
    /* SITE_URL invalide : seule la comparaison avec Host s'applique */
  }
  return siteHost && classifyReferrer(referrer, siteHost) === "interne" ? "interne" : byHost;
}
