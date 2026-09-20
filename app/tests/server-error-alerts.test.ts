import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.fn();
const checkRateLimit = vi.fn();
vi.mock("@/lib/mailer", () => ({ sendEmail: (...args: unknown[]) => sendEmail(...args), escapeHtml: (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...args: unknown[]) => checkRateLimit(...args) }));

import { buildServerErrorEmail, describeServerError, isIgnorableError, maskSensitive, reportServerError } from "@/lib/server-error-alerts";

const request = { path: "/fr/recherche?q=renault&token=abcDEF1234567890abcDEF1234", method: "get" };
const context = { routePath: "/[locale]/recherche", routeType: "render" };

beforeEach(() => {
  sendEmail.mockReset().mockResolvedValue({});
  checkRateLimit.mockReset().mockResolvedValue(true);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("OPS_ALERT_EMAILS", "");
  vi.stubEnv("STAFF_ALERT_EMAILS", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("isIgnorableError — ce qui n'est pas une panne", () => {
  it("ignore les redirections et « introuvable » de Next.js, et les visiteurs qui coupent la connexion", () => {
    expect(isIgnorableError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/fr;307" }))).toBe(true);
    expect(isIgnorableError(Object.assign(new Error("x"), { digest: "NEXT_NOT_FOUND" }))).toBe(true);
    expect(isIgnorableError(Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }))).toBe(true);
    expect(isIgnorableError(Object.assign(new Error("boom"), { name: "AbortError" }))).toBe(true);
    expect(isIgnorableError(new Error("aborted"))).toBe(true);
    expect(isIgnorableError(new Error("read ECONNRESET"))).toBe(true);
    expect(isIgnorableError(new Error("socket hang up"))).toBe(true);
  });
  it("garde les vraies pannes", () => {
    expect(isIgnorableError(new Error("Cannot read properties of undefined (reading 'id')"))).toBe(false);
    expect(isIgnorableError(Object.assign(new Error("db"), { digest: "1234567890" }))).toBe(false);
    expect(isIgnorableError("chaîne inattendue")).toBe(false);
    expect(isIgnorableError(null)).toBe(false);
  });
});

describe("maskSensitive / describeServerError — jamais de donnée personnelle dans l'alerte", () => {
  it("masque adresses e-mail, numéros de téléphone et longs jetons dans le message", () => {
    const masked = maskSensitive("Unique constraint failed for amina@example.dz phone +213 555 12 34 56 token abcDEF1234567890abcDEF1234567890abcd");
    expect(masked).not.toContain("amina");
    expect(masked).not.toContain("555 12 34");
    expect(masked).not.toContain("abcDEF1234567890");
    expect(masked).toContain("[e-mail]");
    expect(masked).toContain("[numéro]");
  });

  it("ne garde ni les paramètres d'adresse ni les jetons du chemin, ni la pile d'appels", () => {
    const error = Object.assign(new Error("Boom\n    at secretFunction (/srv/app/secret.ts:1:1)"), { digest: "98765" });
    const described = describeServerError(error, { path: "/fr/reinitialiser-mot-de-passe/AbCd1234EfGh5678IjKl9012?next=/compte&code=zzz", method: "post" }, context);
    expect(described.path).toBe("/fr/reinitialiser-mot-de-passe/[…]");
    expect(JSON.stringify(described)).not.toContain("secretFunction");
    expect(JSON.stringify(described)).not.toContain("code=zzz");
    expect(described).toMatchObject({ method: "POST", digest: "98765", message: "Boom", signature: "/[locale]/recherche|Error" });
  });

  it("tronque un message très long, et résiste à une erreur qui n'en est pas une", () => {
    expect(describeServerError(new Error("x".repeat(5000)), request, context).message.length).toBeLessThanOrEqual(200);
    expect(describeServerError("texte brut", request, context)).toMatchObject({ name: "Error", message: "texte brut" });
    expect(describeServerError({ weird: true }, request, {})).toMatchObject({ name: "Erreur inconnue", routePath: "(inconnue)", message: "" });
  });

  it("regroupe par écran ET par type d'erreur (deux écrans, deux signatures)", () => {
    const a = describeServerError(new TypeError("a"), request, { routePath: "/a" });
    const b = describeServerError(new TypeError("b"), request, { routePath: "/b" });
    const c = describeServerError(new RangeError("c"), request, { routePath: "/a" });
    expect(new Set([a.signature, b.signature, c.signature]).size).toBe(3);
    expect(describeServerError(new TypeError("autre message"), request, { routePath: "/a" }).signature).toBe(a.signature);
  });
});

describe("buildServerErrorEmail", () => {
  it("échappe le contenu, donne le code à chercher dans les journaux et n'affiche pas de pile", () => {
    const described = describeServerError(Object.assign(new Error("<img src=x onerror=alert(1)>"), { digest: "42" }), request, context);
    const email = buildServerErrorEmail(described, new Date("2026-09-20T10:11:12Z"));
    expect(email.subject).toContain("/[locale]/recherche");
    expect(email.html).not.toContain("<img");
    expect(email.html).toContain("2026-09-20 10:11:12 UTC");
    expect(email.html).toContain("42");
    expect(email.html).toMatch(/affichage d(&#39;|')une page/); // l'apostrophe est échappée comme le reste
    expect(email.html).not.toContain("token=");
  });
});

describe("reportServerError", () => {
  const boom = () => new Error("Cannot read properties of undefined");

  it("écrit toujours une ligne dans les journaux, sans envoyer de courriel quand personne n'est destinataire", async () => {
    await reportServerError(boom(), request, context);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("[erreur] GET /fr/recherche — /[locale]/recherche (render)"));
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining("token="));
    expect(sendEmail).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("envoie un courriel à chaque destinataire ; OPS_ALERT_EMAILS l'emporte sur STAFF_ALERT_EMAILS", async () => {
    vi.stubEnv("STAFF_ALERT_EMAILS", "moderation@example.dz");
    vi.stubEnv("OPS_ALERT_EMAILS", "tech1@example.dz, tech2@example.dz");
    await reportServerError(boom(), request, context);
    expect(sendEmail.mock.calls.map((c) => (c[0] as { to: string }).to).sort()).toEqual(["tech1@example.dz", "tech2@example.dz"]);
  });

  it("à défaut de destinataires techniques, prévient l'équipe (STAFF_ALERT_EMAILS)", async () => {
    vi.stubEnv("STAFF_ALERT_EMAILS", "equipe@example.dz");
    await reportServerError(boom(), request, context);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("ne renvoie pas quand la limite par écran/type d'erreur est atteinte, ni quand la limite globale l'est", async () => {
    vi.stubEnv("OPS_ALERT_EMAILS", "tech@example.dz");
    checkRateLimit.mockImplementation(async (key: string) => !key.startsWith("server-error-alert:/"));
    await reportServerError(boom(), request, context);
    expect(sendEmail).not.toHaveBeenCalled();

    checkRateLimit.mockReset().mockImplementation(async (key: string) => key !== "server-error-alert:all");
    await reportServerError(boom(), request, context);
    expect(sendEmail).not.toHaveBeenCalled();
    // Les deux limites sont bien celles annoncées : 1 par 30 min et par signature, 6 par heure au total.
    expect(checkRateLimit).toHaveBeenCalledWith("server-error-alert:/[locale]/recherche|Error", { limit: 1, windowMs: 30 * 60 * 1000 });
    expect(checkRateLimit).toHaveBeenCalledWith("server-error-alert:all", { limit: 6, windowMs: 60 * 60 * 1000 });
  });

  it("ne fait rien du tout pour ce qui n'est pas une panne (ni journal, ni limite, ni courriel)", async () => {
    vi.stubEnv("OPS_ALERT_EMAILS", "tech@example.dz");
    await reportServerError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/fr;307" }), request, context);
    expect(console.error).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ne lève JAMAIS d'exception : envoi en échec, limite en panne, erreur bizarre", async () => {
    vi.stubEnv("OPS_ALERT_EMAILS", "tech@example.dz");
    sendEmail.mockRejectedValue(new Error("SMTP down"));
    await expect(reportServerError(boom(), request, context)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("échec d'envoi de l'alerte"));

    checkRateLimit.mockRejectedValue(new Error("redis down"));
    await expect(reportServerError(boom(), request, context)).resolves.toBeUndefined();
    await expect(reportServerError(undefined, undefined as never, undefined as never)).resolves.toBeUndefined();
  });
});
