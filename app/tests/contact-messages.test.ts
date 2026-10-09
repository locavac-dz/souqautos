// Lot 273 — messages de contact : référence, routage, accusé de réception, courriel équipe, transitions.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import {
  REFERENCE_PATTERN,
  buildContactAcknowledgement,
  buildTeamContactEmail,
  computeContactTransition,
  generateContactReference,
  resolveContactRecipients,
  shouldAttachFaq,
} from "@/lib/contact-messages";

const t = (key: string, values?: Record<string, string>) => (values ? `${key}|${Object.values(values).join("|")}` : key);

describe("generateContactReference", () => {
  it("produit SA- + 6 caractères sans 0/O/1/I/L", () => {
    for (let i = 0; i < 200; i++) {
      const ref = generateContactReference();
      expect(ref).toMatch(REFERENCE_PATTERN);
      expect(ref).not.toMatch(/[01OIL]/);
    }
  });

  it("est déterministe pour un tirage donné", () => {
    expect(generateContactReference(() => 0)).toBe("SA-AAAAAA");
  });
});

describe("resolveContactRecipients", () => {
  const env = { ADMIN_EMAIL: "pdg@souqauto.dz", STAFF_ALERT_EMAILS: "equipe@souqauto.dz, support@souqauto.dz" };

  it("envoie les demandes commerciales (pro, partenariat) au PDG seul", () => {
    expect(resolveContactRecipients("pro", env, null)).toEqual(["pdg@souqauto.dz"]);
    expect(resolveContactRecipients("partnership", env, null)).toEqual(["pdg@souqauto.dz"]);
  });

  it("envoie le reste à la boîte partagée de l'équipe", () => {
    expect(resolveContactRecipients("general", env, null)).toEqual(["equipe@souqauto.dz", "support@souqauto.dz"]);
    expect(resolveContactRecipients("technical", env, null)).toEqual(["equipe@souqauto.dz", "support@souqauto.dz"]);
    expect(resolveContactRecipients("other", env, null)).toEqual(["equipe@souqauto.dz", "support@souqauto.dz"]);
  });

  it("se rabat sur le PDG sans boîte d'équipe, et sur l'équipe sans PDG", () => {
    expect(resolveContactRecipients("general", { ADMIN_EMAIL: "pdg@souqauto.dz" }, null)).toEqual(["pdg@souqauto.dz"]);
    expect(resolveContactRecipients("pro", { STAFF_ALERT_EMAILS: "equipe@souqauto.dz" }, null)).toEqual(["equipe@souqauto.dz"]);
  });

  it("accepte l'adresse de développement hors production seulement", () => {
    expect(resolveContactRecipients("general", { NODE_ENV: "development" }, "admin@souqauto.dz")).toEqual(["admin@souqauto.dz"]);
    expect(resolveContactRecipients("general", { NODE_ENV: "production" }, "admin@souqauto.dz")).toEqual([]);
  });
});

describe("buildContactAcknowledgement", () => {
  it("cite la référence, le délai du motif et la FAQ pour une question générale", () => {
    const ack = buildContactAcknowledgement(t, { reference: "SA-7K3M9Q", name: "Amina <b>", subject: "general", siteUrl: "https://souqauto.example", locale: "fr" });
    expect(ack.subject).toBe("ackSubject|SA-7K3M9Q");
    expect(ack.html).toContain("greeting|Amina &lt;b&gt;");
    expect(ack.html).toContain("received|SA-7K3M9Q");
    expect(ack.html).toContain("delayGeneral");
    expect(ack.html).toContain("faqTitle");
    expect(ack.html).toContain("faqQ5");
    expect(ack.html).toContain("noActionNeeded");
    expect(ack.html).toContain('href="https://souqauto.example/fr"');
  });

  it("n'attache pas la FAQ aux demandes pro, partenariat ou autre", () => {
    for (const subject of ["pro", "partnership", "other"] as const) {
      expect(shouldAttachFaq(subject)).toBe(false);
      const ack = buildContactAcknowledgement(t, { reference: "SA-AAAAAA", name: "X", subject, siteUrl: "https://souqauto.example", locale: "ar" });
      expect(ack.html).not.toContain("faqTitle");
      expect(ack.html).toContain('href="https://souqauto.example/ar"');
    }
    expect(buildContactAcknowledgement(t, { reference: "SA-AAAAAA", name: "X", subject: "pro", siteUrl: "", locale: "fr" }).html).toContain("delayPro");
    expect(buildContactAcknowledgement(t, { reference: "SA-AAAAAA", name: "X", subject: "partnership", siteUrl: "", locale: "fr" }).html).toContain("delayPartnership");
  });
});

describe("buildTeamContactEmail", () => {
  it("met le motif et la référence dans l'objet, échappe le message et lie la file admin", () => {
    const mail = buildTeamContactEmail({
      reference: "SA-7K3M9Q",
      name: "Karim",
      email: "karim@example.dz",
      subject: "technical",
      message: "Bonjour,\n<script>alert(1)</script>",
      locale: "fr",
      siteUrl: "https://souqauto.example",
    });
    expect(mail.subject).toBe("[Contact] Problème technique · SA-7K3M9Q — Karim");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("mailto:karim@example.dz");
    expect(mail.html).toContain("https://souqauto.example/fr/admin/contact");
  });
});

describe("computeContactTransition", () => {
  it("nouveau → pris en charge → répondu → rouvert", () => {
    expect(computeContactTransition("NOUVEAU", "take")).toEqual({ ok: true, newStatus: "PRIS_EN_CHARGE" });
    expect(computeContactTransition("PRIS_EN_CHARGE", "answered")).toEqual({ ok: true, newStatus: "REPONDU" });
    expect(computeContactTransition("NOUVEAU", "answered")).toEqual({ ok: true, newStatus: "REPONDU" });
    expect(computeContactTransition("REPONDU", "reopen")).toEqual({ ok: true, newStatus: "PRIS_EN_CHARGE" });
  });

  it("refuse les transitions sans sens", () => {
    expect(computeContactTransition("PRIS_EN_CHARGE", "take")).toEqual({ ok: false, error: "invalid_transition" });
    expect(computeContactTransition("REPONDU", "answered")).toEqual({ ok: false, error: "invalid_transition" });
    expect(computeContactTransition("NOUVEAU", "reopen")).toEqual({ ok: false, error: "invalid_transition" });
  });
});
