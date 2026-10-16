// Tests d'intégration du verrouillage anti‑bruteforce (brief §9), sur un compte
// dédié « lockme » pour ne pas perturber les autres tests.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
const EMAIL = "lockme@opgi-alger.demo";
let s: Services;

beforeAll(() => {
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
    LOGIN_MAX_ATTEMPTS: "5",
    LOGIN_LOCK_MINUTES: "15",
  });
});

afterAll(async () => {
  await s.app.$disconnect();
  await s.admin.$disconnect();
});

function loginReq(password: string): Request {
  return new Request(`${ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
    body: JSON.stringify({ code: "OPGI-ALGER", email: EMAIL, password }),
  });
}
const login = (password: string) => handleLogin(loginReq(password), s);

async function resetCompte() {
  const org = await s.admin.organisation.findFirstOrThrow({ where: { code: "OPGI-ALGER" } });
  await s.admin.utilisateur.update({
    where: { organisationId_email: { organisationId: org.id, email: EMAIL } },
    data: { echecsConnexion: 0, verrouilleJusqua: null },
  });
}

describe("verrouillage de connexion", () => {
  it("verrouille après 5 échecs ; ensuite même le bon mot de passe est refusé", async () => {
    await resetCompte();
    for (let i = 0; i < 5; i++) {
      expect((await login("mauvais")).status).toBe(401);
    }
    // Compte verrouillé : le bon mot de passe est refusé tant que le verrou tient.
    expect((await login(DEMO_PASSWORD)).status).toBe(401);
  });

  it("déverrouillage (verrou expiré) : le bon mot de passe est de nouveau accepté", async () => {
    // Simule l'expiration du verrou en l'effaçant (équivaut à la fin du délai).
    await resetCompte();
    expect((await login(DEMO_PASSWORD)).status).toBe(200);
  });

  it("une connexion réussie remet le compteur d'échecs à zéro", async () => {
    await resetCompte();
    expect((await login("mauvais")).status).toBe(401); // 1 échec
    expect((await login("mauvais")).status).toBe(401); // 2 échecs
    expect((await login(DEMO_PASSWORD)).status).toBe(200); // succès → compteur remis à 0
    // 4 échecs supplémentaires ne doivent PAS verrouiller (compteur reparti de 0).
    for (let i = 0; i < 4; i++) expect((await login("mauvais")).status).toBe(401);
    expect((await login(DEMO_PASSWORD)).status).toBe(200);
  });
});
