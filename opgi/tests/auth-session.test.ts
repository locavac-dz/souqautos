import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "@/lib/auth/session.js";
import { hashPassword, verifyPassword } from "@/lib/auth/password.js";
import type { VerifiedSession } from "@/lib/tenant/context.js";

const secret = "test-secret-at-least-16-chars-long";
const session: VerifiedSession = {
  utilisateurId: "u1",
  organisationId: "org-alger",
  role: "AGENT_LOCATIF",
  perimetre: null,
};

describe("session signée (jose)", () => {
  it("signe puis vérifie, en conservant l'organisme", async () => {
    const token = await signSession(session, secret);
    const back = await verifySession(token, secret);
    expect(back).toMatchObject({ utilisateurId: "u1", organisationId: "org-alger", role: "AGENT_LOCATIF" });
  });

  it("rejette une signature avec un autre secret", async () => {
    const token = await signSession(session, secret);
    expect(await verifySession(token, "un-autre-secret-de-16-ou-plus")).toBeNull();
  });

  it("rejette un jeton altéré", async () => {
    const token = await signSession(session, secret);
    const tampered = token.slice(0, -3) + "aaa";
    expect(await verifySession(tampered, secret)).toBeNull();
  });

  it("rejette un jeton expiré", async () => {
    const token = await signSession(session, secret, -1);
    expect(await verifySession(token, secret)).toBeNull();
  });

  it("exige un secret suffisamment long", async () => {
    await expect(signSession(session, "court")).rejects.toThrow();
  });
});

describe("mot de passe (bcrypt)", () => {
  it("vérifie un mot de passe correct et rejette un mauvais", async () => {
    const h = await hashPassword("Demo-1234!");
    expect(await verifyPassword("Demo-1234!", h)).toBe(true);
    expect(await verifyPassword("mauvais", h)).toBe(false);
  });

  it("renvoie false (sans erreur) quand aucun hash n'existe", async () => {
    expect(await verifyPassword("peu importe", null)).toBe(false);
  });
});
