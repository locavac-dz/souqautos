import { describe, expect, it } from "vitest";
import {
  RESPONSIVENESS_GRACE_HOURS,
  RESPONSIVENESS_MIN_CONVERSATIONS,
  RESPONSIVENESS_WINDOW_DAYS,
  computeResponsiveness,
  responsivenessBadge,
  responsivenessGap,
  type ConversationTiming,
} from "@/lib/seller-responsiveness";

const NOW = new Date("2026-09-20T12:00:00Z");
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// Une conversation ouverte il y a `askedHoursAgo`, répondue `replyMinutes` plus tard (ou jamais).
const conv = (askedHoursAgo: number, replyMinutes: number | null): ConversationTiming => {
  const asked = new Date(NOW.getTime() - askedHoursAgo * HOUR);
  return { buyerFirstMessageAt: asked, sellerFirstReplyAt: replyMinutes === null ? null : new Date(asked.getTime() + replyMinutes * 60_000) };
};
// Un vendeur qui répond toujours en `minutes`, sur `count` conversations assez anciennes pour être jugées.
const responsive = (count: number, minutes: number) => Array.from({ length: count }, (_, i) => conv(72 + i, minutes));

describe("computeResponsiveness", () => {
  it("compte les conversations jugeables, celles répondues, le taux et la médiane", () => {
    const result = computeResponsiveness([conv(100, 30), conv(99, 90), conv(98, null), conv(97, 60)], NOW);
    expect(result).toEqual({ eligibleConversations: 4, respondedConversations: 3, responseRate: 0.75, medianReplyMinutes: 60 });
  });

  it("ne juge PAS une conversation trop récente restée sans réponse (délai de grâce)", () => {
    const tooRecent = computeResponsiveness([conv(1, null), conv(RESPONSIVENESS_GRACE_HOURS - 1, null)], NOW);
    expect(tooRecent.eligibleConversations).toBe(0);
    expect(tooRecent.responseRate).toBe(0);
    // Passé le délai, elle compte comme une absence de réponse.
    const oldEnough = computeResponsiveness([conv(RESPONSIVENESS_GRACE_HOURS + 1, null)], NOW);
    expect(oldEnough).toMatchObject({ eligibleConversations: 1, respondedConversations: 0, responseRate: 0 });
  });

  it("garde une conversation récente DÉJÀ répondue : répondre vite ne doit jamais être ignoré", () => {
    const result = computeResponsiveness([conv(0.5, 10)], NOW);
    expect(result).toMatchObject({ eligibleConversations: 1, respondedConversations: 1, medianReplyMinutes: 10 });
  });

  it("ignore ce qui sort de la fenêtre de 90 jours, dans un sens comme dans l'autre", () => {
    const old = new Date(NOW.getTime() - (RESPONSIVENESS_WINDOW_DAYS + 1) * DAY);
    const future = new Date(NOW.getTime() + DAY); // horloge incohérente
    const result = computeResponsiveness(
      [
        { buyerFirstMessageAt: old, sellerFirstReplyAt: new Date(old.getTime() + 60_000) },
        { buyerFirstMessageAt: future, sellerFirstReplyAt: null },
        conv(80 * 24, 15), // dans la fenêtre, tout juste
      ],
      NOW,
    );
    expect(result.eligibleConversations).toBe(1);
    expect(result.medianReplyMinutes).toBe(15);
  });

  it("la médiane ne porte que sur les conversations répondues, le taux sur toutes les jugeables", () => {
    // Trois réponses rapides, deux silences : la médiane reste rapide, le taux tombe à 60 %.
    const result = computeResponsiveness([conv(100, 10), conv(99, 20), conv(98, 30), conv(97, null), conv(96, null)], NOW);
    expect(result.medianReplyMinutes).toBe(20);
    expect(result.responseRate).toBeCloseTo(0.6);
  });

  it("médiane sur un nombre pair : moyenne des deux valeurs centrales", () => {
    expect(computeResponsiveness([conv(100, 10), conv(99, 30)], NOW).medianReplyMinutes).toBe(20);
  });

  it("une « réponse » antérieure à la question n'en est pas une (données incohérentes)", () => {
    const asked = new Date(NOW.getTime() - 100 * HOUR);
    const result = computeResponsiveness([{ buyerFirstMessageAt: asked, sellerFirstReplyAt: new Date(asked.getTime() - HOUR) }], NOW);
    expect(result).toMatchObject({ eligibleConversations: 1, respondedConversations: 0 });
  });

  it("aucune conversation : des zéros, jamais une division par zéro ni un NaN", () => {
    expect(computeResponsiveness([], NOW)).toEqual({ eligibleConversations: 0, respondedConversations: 0, responseRate: 0, medianReplyMinutes: null });
  });
});

describe("responsivenessBadge — un badge POSITIF, ou rien", () => {
  it("donne la formulation qui correspond à la médiane", () => {
    expect(responsivenessBadge(computeResponsiveness(responsive(6, 30), NOW))).toBe("under1h");
    expect(responsivenessBadge(computeResponsiveness(responsive(6, 90), NOW))).toBe("under2h");
    expect(responsivenessBadge(computeResponsiveness(responsive(6, 300), NOW))).toBe("under6h");
    expect(responsivenessBadge(computeResponsiveness(responsive(6, 1000), NOW))).toBe("under24h");
  });

  it("aux bornes exactes, la formulation la plus flatteuse reste acquise", () => {
    for (const [minutes, badge] of [[60, "under1h"], [120, "under2h"], [360, "under6h"], [1440, "under24h"]] as const) {
      expect(responsivenessBadge(computeResponsiveness(responsive(6, minutes), NOW)), `${minutes} min`).toBe(badge);
    }
    expect(responsivenessBadge(computeResponsiveness(responsive(6, 1441), NOW))).toBeNull(); // au-delà de 24 h : rien
  });

  it("aucun badge sous le minimum de conversations, même avec un sans-faute", () => {
    for (let count = 0; count < RESPONSIVENESS_MIN_CONVERSATIONS; count++) {
      expect(responsivenessBadge(computeResponsiveness(responsive(count, 5), NOW)), `${count} conversations`).toBeNull();
    }
    expect(responsivenessBadge(computeResponsiveness(responsive(RESPONSIVENESS_MIN_CONVERSATIONS, 5), NOW))).toBe("under1h");
  });

  it("aucun badge en dessous de 80 % de réponses, même si les réponses données sont instantanées", () => {
    // 8 réponses en 5 min, 2 silences = 80 % pile : acquis. 7 sur 10 : perdu.
    const justEnough = [...responsive(8, 5), conv(100, null), conv(99, null)];
    expect(responsivenessBadge(computeResponsiveness(justEnough, NOW))).toBe("under1h");
    const notEnough = [...responsive(7, 5), conv(100, null), conv(99, null), conv(98, null)];
    expect(responsivenessBadge(computeResponsiveness(notEnough, NOW))).toBeNull();
  });

  it("un vendeur qui ne répond jamais n'obtient rien (et n'est pas affiché comme mauvais : c'est l'absence de badge)", () => {
    const silent = Array.from({ length: 20 }, (_, i) => conv(100 + i, null));
    const result = computeResponsiveness(silent, NOW);
    expect(result).toMatchObject({ eligibleConversations: 20, respondedConversations: 0, medianReplyMinutes: null });
    expect(responsivenessBadge(result)).toBeNull();
  });
});

describe("responsivenessGap — ce qui manque au vendeur, pour lui seul", () => {
  it("rien à signaler quand le badge est acquis", () => {
    expect(responsivenessGap(computeResponsiveness(responsive(6, 30), NOW))).toBeNull();
  });
  it("distingue les trois raisons de ne pas l'avoir", () => {
    expect(responsivenessGap(computeResponsiveness(responsive(2, 5), NOW))).toBe("not_enough");
    expect(responsivenessGap(computeResponsiveness([...responsive(5, 5), ...Array.from({ length: 5 }, (_, i) => conv(100 + i, null))], NOW))).toBe("rate_too_low");
    expect(responsivenessGap(computeResponsiveness(responsive(6, 2000), NOW))).toBe("too_slow");
  });
});
