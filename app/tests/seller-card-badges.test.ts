import { describe, expect, it } from "vitest";
import { cardSellerBadges } from "@/lib/seller-card-badges";
import { RESPONSIVENESS_MIN_CONVERSATIONS, type Responsiveness } from "@/lib/seller-responsiveness";

// Lot 143 — ce que la carte d'un résultat affiche du vendeur : rien, ou des signaux POSITIFS et vérifiés, jamais un signal négatif.

const responsive = (medianReplyMinutes: number, overrides: Partial<Responsiveness> = {}): Responsiveness => ({
  eligibleConversations: RESPONSIVENESS_MIN_CONVERSATIONS + 5,
  respondedConversations: RESPONSIVENESS_MIN_CONVERSATIONS + 5,
  responseRate: 1,
  medianReplyMinutes,
  ...overrides,
});

describe("cardSellerBadges", () => {
  it("ne renvoie rien quand il n'y a rien à montrer : la carte n'ajoute alors aucune ligne", () => {
    expect(cardSellerBadges(undefined, undefined)).toBeNull(); // vendeur inconnu
    expect(cardSellerBadges({ identityVerified: false }, undefined)).toBeNull();
    expect(cardSellerBadges({ identityVerified: false }, responsive(30, { eligibleConversations: 2, respondedConversations: 2 }))).toBeNull(); // trop peu de conversations
    expect(cardSellerBadges({ identityVerified: false }, responsive(30, { responseRate: 0.5 }))).toBeNull(); // trop peu de réponses
    expect(cardSellerBadges({ identityVerified: false }, responsive(3000))).toBeNull(); // trop lent
  });

  it("affiche l'identité vérifiée seule, sans réactivité", () => {
    expect(cardSellerBadges({ identityVerified: true }, undefined)).toEqual({ identityVerified: true, responsiveness: null });
    expect(cardSellerBadges({ identityVerified: true }, responsive(3000))).toEqual({ identityVerified: true, responsiveness: null });
  });

  it("affiche la réactivité seule, sans identité, avec la même formulation que sur la fiche", () => {
    expect(cardSellerBadges({ identityVerified: false }, responsive(30))).toEqual({ identityVerified: false, responsiveness: "under1h" });
    expect(cardSellerBadges(undefined, responsive(90))).toEqual({ identityVerified: false, responsiveness: "under2h" });
    expect(cardSellerBadges(undefined, responsive(300))).toEqual({ identityVerified: false, responsiveness: "under6h" });
    expect(cardSellerBadges(undefined, responsive(1000))).toEqual({ identityVerified: false, responsiveness: "under24h" });
  });

  it("affiche les deux ensemble", () => {
    expect(cardSellerBadges({ identityVerified: true }, responsive(30))).toEqual({ identityVerified: true, responsiveness: "under1h" });
  });

  it("l'identité se lit dans le drapeau explicite, jamais dans les points du score (une pondération qui change ne doit pas la faire mentir)", () => {
    // Un résumé qui porterait des points d'identité mais pas le drapeau n'affiche rien : le drapeau est la seule source.
    const misleading = { identityVerified: false, trustBreakdown: { identityPoints: 20 } };
    expect(cardSellerBadges(misleading, undefined)).toBeNull();
  });
});
