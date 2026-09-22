import { describe, expect, it } from "vitest";
import { buildContactMessage, CONTACT_TEMPLATE_KEYS } from "@/lib/contact-templates";

describe("buildContactMessage", () => {
  it("remplace {title} par le titre de l'annonce", () => {
    expect(buildContactMessage("Bonjour, votre annonce « {title} » m'intéresse.", "Renault Clio 2018")).toBe(
      "Bonjour, votre annonce « Renault Clio 2018 » m'intéresse."
    );
  });

  it("ne remplace que la première occurrence de {title}", () => {
    const result = buildContactMessage("{title} et {title}", "X");
    expect(result).toBe("X et {title}");
  });

  it("laisse le template intact si {title} est absent", () => {
    expect(buildContactMessage("Bonjour.", "Peugeot 208")).toBe("Bonjour.");
  });

  it("gère un titre vide", () => {
    expect(buildContactMessage("Annonce « {title} »", "")).toBe("Annonce «  »");
  });

  it("CONTACT_TEMPLATE_KEYS contient les trois clés attendues", () => {
    expect(CONTACT_TEMPLATE_KEYS).toEqual(["availability", "price", "testDrive"]);
  });
});
