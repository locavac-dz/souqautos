import { describe, expect, it } from "vitest";
import { emailChangedNoticeEmail, normalizeNoticeLocale } from "@/lib/email-change-emails";

describe("avertissement à l'ancienne adresse après un changement d'email (Lot 229)", () => {
  it("en français : cite les deux adresses et le lien de réinitialisation du mot de passe", () => {
    const mail = emailChangedNoticeEmail("fr", { previousEmail: "avant@example.dz", newEmail: "apres@example.dz" });
    expect(mail.subject).toMatch(/modifiée/);
    expect(mail.html).toContain("avant@example.dz");
    expect(mail.html).toContain("apres@example.dz");
    expect(mail.html).toMatch(/\/fr\/mot-de-passe-oublie/);
    expect(mail.html).toContain('dir="ltr"');
  });

  it("en arabe : de droite à gauche, avec le lien de réinitialisation arabe", () => {
    const mail = emailChangedNoticeEmail("ar", { previousEmail: "avant@example.dz", newEmail: "apres@example.dz" });
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.html).toMatch(/\/ar\/mot-de-passe-oublie/);
    expect(mail.subject).toMatch(/[؀-ۿ]/);
  });

  it("neutralise le HTML dans les adresses et ne connaît que deux langues", () => {
    const mail = emailChangedNoticeEmail("fr", { previousEmail: "a<b>@example.dz", newEmail: "c@example.dz" });
    expect(mail.html).not.toContain("<b>");
    expect(mail.html).toContain("a&lt;b&gt;@example.dz");
    expect(normalizeNoticeLocale("ar")).toBe("ar");
    expect(normalizeNoticeLocale("en")).toBe("fr");
    expect(normalizeNoticeLocale(null)).toBe("fr");
  });
});
