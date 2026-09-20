import { getTranslations } from "next-intl/server";
import { responsivenessBadge, type Responsiveness } from "@/lib/seller-responsiveness";

// Lot 141 — les signaux de confiance d'un vendeur, là où l'acheteur décide de le contacter.
//
// Uniquement des signaux VÉRIFIÉS par le site (identité contrôlée par l'équipe, statut professionnel validé, réactivité
// mesurée sur de vraies conversations), jamais déclarés par le vendeur. Et uniquement des signaux POSITIFS : l'absence d'un
// badge ne veut pas dire « méfiez-vous », elle veut dire « pas (encore) acquis ». Un vendeur qui débute n'est jamais montré
// du doigt — décision du porteur de projet, cf. docs/EXPLOITATION.md.
export async function SellerTrustBadges({
  identityVerified,
  proVerified,
  responsiveness,
  className,
}: {
  identityVerified: boolean;
  proVerified?: boolean;
  responsiveness?: Responsiveness | null;
  className?: string;
}) {
  const t = await getTranslations("SellerTrust");
  const badge = responsiveness ? responsivenessBadge(responsiveness) : null;
  const BADGE_KEY = { under1h: "badgeUnder1h", under2h: "badgeUnder2h", under6h: "badgeUnder6h", under24h: "badgeUnder24h" } as const;

  if (!identityVerified && !proVerified && !badge) return null;

  return (
    <ul className={`flex flex-col gap-1 text-xs text-emerald-800 ${className ?? ""}`}>
      {identityVerified && (
        <li className="flex items-center gap-1.5">
          <CheckMark />
          {t("identityVerified")}
        </li>
      )}
      {proVerified && (
        <li className="flex items-center gap-1.5">
          <CheckMark />
          {t("proVerified")}
        </li>
      )}
      {badge && (
        <li className="flex items-center gap-1.5">
          <CheckMark />
          {t(BADGE_KEY[badge])}
        </li>
      )}
    </ul>
  );
}

// Décoratif : le sens est porté par le texte à côté, le lecteur d'écran n'a donc rien à en dire.
function CheckMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0 fill-current">
      <path d="M6.2 11.7 2.9 8.4l1.1-1.1 2.2 2.2 5.8-5.8 1.1 1.1z" />
    </svg>
  );
}
