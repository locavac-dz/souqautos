import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Base en mémoire qui applique VRAIMENT les conditions des requêtes du service (égalité, null, « inférieur à », OR) : les
// garanties de « comparer et remplacer » (anti-rejeu, une seule activation, un seul code de secours consommé) sont donc
// exercées, pas simulées par des réponses écrites d'avance.
type Row = Record<string, unknown>;
const { db, sendEmail, writeAuditLog } = vi.hoisted(() => {
  const state = { users: new Map<string, Row>(), codes: [] as Row[], ids: 0 };
  const matches = (row: Row, where: Row): boolean =>
    Object.entries(where).every(([key, expected]) => {
      if (key === "OR") return (expected as Row[]).some((alternative) => matches(row, alternative));
      const actual = row[key];
      if (expected === null) return actual === null || actual === undefined;
      if (expected && typeof expected === "object" && !(expected instanceof Date)) {
        const operators = expected as { lt?: number };
        if ("lt" in operators) return typeof actual === "number" && actual < (operators.lt as number);
      }
      return actual === expected;
    });
  const tables = {
    user: {
      findUnique: async ({ where }: { where: Row }) => {
        const found = [...state.users.values()].find((u) => matches(u, where));
        return found ? { ...found } : null;
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = [...state.users.values()].find((u) => matches(u, where))!;
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = [...state.users.values()].filter((u) => matches(u, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      },
    },
    twoFactorRecoveryCode: {
      deleteMany: async ({ where }: { where: Row }) => {
        const before = state.codes.length;
        state.codes = state.codes.filter((c) => !matches(c, where));
        return { count: before - state.codes.length };
      },
      createMany: async ({ data }: { data: Row[] }) => {
        for (const row of data) state.codes.push({ id: `code-${++state.ids}`, usedAt: null, ...row });
        return { count: data.length };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const rows = state.codes.filter((c) => matches(c, where));
        for (const row of rows) Object.assign(row, data);
        return { count: rows.length };
      },
      count: async ({ where }: { where: Row }) => state.codes.filter((c) => matches(c, where)).length,
    },
  };
  const client = { ...tables, $transaction: async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: typeof tables) => unknown)(tables) : Promise.all(arg as unknown[])) };
  return { db: { state, client }, sendEmail: vi.fn(), writeAuditLog: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: db.client }));
vi.mock("@/lib/mailer", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));
vi.mock("@/lib/audit-log", () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }));

import { decryptBuffer } from "@/lib/crypto/at-rest";
import { hashPassword } from "@/lib/auth-server/password";
import { hashRecoveryCode, normalizeRecoveryCode } from "@/lib/recovery-codes";
import { totpCode, TOTP_STEP_SECONDS, stepAt } from "@/lib/totp";
import { beginEnrolment, challenge, confirmEnrolment, disableTwoFactor, getTwoFactorStatus, regenerateRecoveryCodes, resetTwoFactor } from "@/lib/two-factor";

const NOW = new Date("2026-09-20T10:00:00Z");
const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
const PASSWORD = "MotDePasseSolide2026!";
let passwordHash = "";
let originalKey: string | undefined;

beforeAll(async () => {
  originalKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
  passwordHash = await hashPassword(PASSWORD);
});
afterAll(() => {
  if (originalKey === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = originalKey;
});

const user = (id = "u1"): Row => db.state.users.get(id)!;
const secretOf = (id = "u1") => decryptBuffer(Buffer.from((user(id).totpSecretEnc ?? user(id).totpPendingSecretEnc) as string, "base64")).toString("utf8");

beforeEach(() => {
  db.state.users.clear();
  db.state.codes = [];
  db.state.ids = 0;
  sendEmail.mockReset().mockResolvedValue({});
  writeAuditLog.mockReset().mockResolvedValue(undefined);
  db.state.users.set("u1", { id: "u1", email: "amina@example.dz", locale: "fr", passwordHash, totpSecretEnc: null, totpPendingSecretEnc: null, totpEnabledAt: null, totpLastStep: null, sessionsValidAfter: null });
});

// Active la fonction pour u1 et renvoie les codes de secours.
async function enable(): Promise<string[]> {
  const begun = await beginEnrolment("u1", PASSWORD);
  if (!begun.ok) throw new Error("begin");
  const confirmed = await confirmEnrolment("u1", totpCode(begun.secret, NOW.getTime()), NOW);
  if (!confirmed.ok) throw new Error("confirm");
  sendEmail.mockClear();
  writeAuditLog.mockClear();
  return confirmed.recoveryCodes;
}

describe("activation — le mot de passe est exigé pour commencer (Lot 229)", () => {
  it("refuse sans mot de passe ou avec un mauvais mot de passe, et ne tire aucun secret", async () => {
    expect(await beginEnrolment("u1")).toEqual({ ok: false, error: "invalid_password" });
    expect(await beginEnrolment("u1", "mauvais")).toEqual({ ok: false, error: "invalid_password" });
    expect(user().totpPendingSecretEnc).toBeNull();
  });

  it("un compte créé avec Google (sans mot de passe) commence avec sa seule session", async () => {
    user().passwordHash = null;
    const result = await beginEnrolment("u1");
    expect(result.ok).toBe(true);
    expect(user().totpPendingSecretEnc).not.toBeNull();
  });
});

describe("activation", () => {
  it("begin : garde le secret CHIFFRÉ comme « en attente », rend le QR et la clé, et n'active rien", async () => {
    const result = await beginEnrolment("u1", PASSWORD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.uri).toContain(`secret=${result.secret}`);
    expect(result.uri).toContain("issuer=Souq+Auto");
    expect(result.qr.path).toMatch(/^M/);
    expect(result.secretDisplay.replace(/ /g, "")).toBe(result.secret);
    expect(user().totpPendingSecretEnc).toBeTruthy();
    expect(String(user().totpPendingSecretEnc)).not.toContain(result.secret); // jamais en clair
    expect(secretOf()).toBe(result.secret); // déchiffrable, et identique
    expect(user().totpEnabledAt).toBeNull();
    expect(user().totpSecretEnc).toBeNull();
    expect((await getTwoFactorStatus("u1")).enabled).toBe(false);
  });

  it("recommencer remplace le secret en attente (l'ancien code QR ne sert plus)", async () => {
    const first = await beginEnrolment("u1", PASSWORD);
    const second = await beginEnrolment("u1", PASSWORD);
    if (!first.ok || !second.ok) throw new Error("begin");
    expect(second.secret).not.toBe(first.secret);
    expect(secretOf()).toBe(second.secret);
    expect((await confirmEnrolment("u1", totpCode(first.secret, NOW.getTime()), NOW)).ok).toBe(false);
  });

  it("confirm avec un mauvais code : refusé, rien n'est activé", async () => {
    await beginEnrolment("u1", PASSWORD);
    const result = await confirmEnrolment("u1", "000000", NOW);
    expect(result).toEqual({ ok: false, error: "invalid_code" });
    expect(user().totpEnabledAt).toBeNull();
    expect(db.state.codes).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("confirm sans étape 1 : refusé", async () => {
    expect(await confirmEnrolment("u1", "123456", NOW)).toEqual({ ok: false, error: "no_pending" });
  });

  it("confirm avec le bon code : active, mémorise le pas, révoque les autres sessions, crée dix codes de secours (empreintes seulement)", async () => {
    const begun = await beginEnrolment("u1", PASSWORD);
    if (!begun.ok) throw new Error("begin");
    const result = await confirmEnrolment("u1", totpCode(begun.secret, NOW.getTime()), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(user().totpEnabledAt).toEqual(NOW);
    expect(user().totpSecretEnc).toBeTruthy();
    expect(user().totpPendingSecretEnc).toBeNull();
    expect(user().totpLastStep).toBe(stepAt(NOW.getTime()));
    expect(user().sessionsValidAfter).toEqual(NOW);

    expect(result.recoveryCodes).toHaveLength(10);
    expect(db.state.codes).toHaveLength(10);
    const hashes = db.state.codes.map((c) => c.codeHash as string);
    for (const code of result.recoveryCodes) {
      expect(hashes).toContain(hashRecoveryCode(normalizeRecoveryCode(code)!));
      expect(JSON.stringify(db.state.codes)).not.toContain(normalizeRecoveryCode(code)!); // le code lui-même n'est jamais stocké
    }
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "two_factor.enable", adminId: "u1", targetId: "u1" }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "amina@example.dz" });
    expect((await getTwoFactorStatus("u1"))).toMatchObject({ enabled: true, recoveryCodesRemaining: 10 });
  });

  it("une fois activée : begin et confirm refusent (« déjà activée »)", async () => {
    await enable();
    expect(await beginEnrolment("u1", PASSWORD)).toEqual({ ok: false, error: "already_enabled" });
    expect(await confirmEnrolment("u1", "123456", NOW)).toEqual({ ok: false, error: "already_enabled" });
  });

  it("deux confirmations SIMULTANÉES : une seule aboutit, et il n'y a qu'un jeu de codes de secours", async () => {
    const begun = await beginEnrolment("u1", PASSWORD);
    if (!begun.ok) throw new Error("begin");
    const code = totpCode(begun.secret, NOW.getTime());
    const results = await Promise.all([confirmEnrolment("u1", code, NOW), confirmEnrolment("u1", code, NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => (r as { error: string }).error)).toEqual(["already_enabled"]);
    expect(db.state.codes).toHaveLength(10);
  });

  it("un compte inconnu : « not_found »", async () => {
    expect(await beginEnrolment("fantome")).toEqual({ ok: false, error: "not_found" });
    expect(await confirmEnrolment("fantome", "123456", NOW)).toEqual({ ok: false, error: "not_found" });
  });

  it("un courriel qui ne part pas ne défait pas l'activation", async () => {
    sendEmail.mockRejectedValue(new Error("SMTP indisponible"));
    const begun = await beginEnrolment("u1", PASSWORD);
    if (!begun.ok) throw new Error("begin");
    expect((await confirmEnrolment("u1", totpCode(begun.secret, NOW.getTime()), NOW)).ok).toBe(true);
    expect(user().totpEnabledAt).toEqual(NOW);
  });
});

describe("challenge (code d'application ou code de secours)", () => {
  it("accepte un code valable UNE fois : le rejeu du même code est refusé", async () => {
    await enable();
    const later = at(TOTP_STEP_SECONDS * 2); // deux pas plus tard : le pas de l'activation est déjà consommé
    const code = totpCode(secretOf(), later.getTime());
    expect(await challenge("u1", code, later)).toEqual({ ok: true, method: "totp" });
    expect(await challenge("u1", code, later)).toEqual({ ok: false, error: "invalid_code" });
    expect(await challenge("u1", `${code.slice(0, 3)} ${code.slice(3)}`, later)).toEqual({ ok: false, error: "invalid_code" }); // même code, autre écriture
  });

  it("refuse le code déjà utilisé pour l'ACTIVATION (le pas de confirmation est mémorisé)", async () => {
    await enable();
    expect(await challenge("u1", totpCode(secretOf(), NOW.getTime()), NOW)).toEqual({ ok: false, error: "invalid_code" });
  });

  it("le pas suivant est accepté, un pas plus ancien que le dernier accepté ne l'est plus", async () => {
    await enable();
    const t1 = at(TOTP_STEP_SECONDS * 3);
    const t2 = at(TOTP_STEP_SECONDS * 4);
    expect((await challenge("u1", totpCode(secretOf(), t2.getTime()), t2)).ok).toBe(true);
    expect((await challenge("u1", totpCode(secretOf(), t1.getTime()), t2)).ok).toBe(false); // plus ancien que celui déjà accepté
  });

  it("deux vérifications SIMULTANÉES avec le même code : une seule passe (le rejeu est fermé même à la milliseconde)", async () => {
    await enable();
    const later = at(TOTP_STEP_SECONDS * 5);
    const code = totpCode(secretOf(), later.getTime());
    const results = await Promise.all([challenge("u1", code, later), challenge("u1", code, later), challenge("u1", code, later)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("refuse un mauvais code et un compte sans double authentification", async () => {
    await enable();
    expect(await challenge("u1", "000000", at(TOTP_STEP_SECONDS * 6))).toEqual({ ok: false, error: "invalid_code" });
    db.state.users.get("u1")!.totpEnabledAt = null;
    expect(await challenge("u1", "123456", NOW)).toEqual({ ok: false, error: "not_enabled" });
    expect(await challenge("fantome", "123456", NOW)).toEqual({ ok: false, error: "not_enabled" });
  });

  it("un code de secours ne sert qu'UNE fois, quelle que soit la façon de l'écrire, et il en reste neuf", async () => {
    const codes = await enable();
    const code = codes[0];
    expect(await challenge("u1", code.toLowerCase().replace(/-/g, " "), NOW)).toEqual({ ok: true, method: "recovery" });
    expect(await challenge("u1", code, NOW)).toEqual({ ok: false, error: "invalid_code" });
    expect((await getTwoFactorStatus("u1")).recoveryCodesRemaining).toBe(9);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "two_factor.recovery_used", details: { remaining: 9 } }));
    expect(sendEmail).toHaveBeenCalledTimes(1); // la personne est prévenue à chaque code de secours utilisé
  });

  it("deux utilisations SIMULTANÉES du même code de secours : une seule aboutit", async () => {
    const codes = await enable();
    const results = await Promise.all([challenge("u1", codes[1], NOW), challenge("u1", codes[1], NOW)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await getTwoFactorStatus("u1")).recoveryCodesRemaining).toBe(9);
  });

  it("un code de secours d'un AUTRE compte ne sert pas", async () => {
    await enable();
    db.state.users.set("u2", { id: "u2", email: "b@example.dz", locale: "fr", passwordHash, totpSecretEnc: user().totpSecretEnc, totpEnabledAt: NOW, totpLastStep: null });
    const codes = db.state.codes.map((c) => c.codeHash);
    expect(codes).toHaveLength(10);
    expect((await challenge("u2", "ABCD-EFGH-JKLM", NOW)).ok).toBe(false);
  });
});

describe("désactivation", () => {
  const later = at(TOTP_STEP_SECONDS * 10);
  const codeNow = () => totpCode(secretOf(), later.getTime());

  it("exige le mot de passe ET un code : sans mot de passe correct, le code n'est même pas consommé", async () => {
    await enable();
    const code = codeNow();
    expect(await disableTwoFactor("u1", { password: "mauvais", code }, later)).toEqual({ ok: false, error: "invalid_password" });
    expect(await disableTwoFactor("u1", { code }, later)).toEqual({ ok: false, error: "invalid_password" });
    expect(user().totpEnabledAt).toEqual(NOW);
    // Le code n'a pas été brûlé par les refus précédents : il fonctionne avec le bon mot de passe.
    expect(await disableTwoFactor("u1", { password: PASSWORD, code }, later)).toEqual({ ok: true });
  });

  it("refuse un mauvais code même avec le bon mot de passe", async () => {
    await enable();
    expect(await disableTwoFactor("u1", { password: PASSWORD, code: "000000" }, later)).toEqual({ ok: false, error: "invalid_code" });
    expect(user().totpEnabledAt).toEqual(NOW);
  });

  it("efface le secret, les codes de secours, prévient la personne et écrit le journal", async () => {
    await enable();
    expect(await disableTwoFactor("u1", { password: PASSWORD, code: codeNow() }, later)).toEqual({ ok: true });
    expect(user()).toMatchObject({ totpSecretEnc: null, totpPendingSecretEnc: null, totpEnabledAt: null, totpLastStep: null });
    expect(db.state.codes).toHaveLength(0);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "two_factor.disable" }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await disableTwoFactor("u1", { password: PASSWORD, code: "123456" }, later)).toEqual({ ok: false, error: "not_enabled" });
  });

  it("un compte créé avec Google (sans mot de passe) se désactive avec le seul code, y compris un code de secours", async () => {
    const codes = await enable();
    user().passwordHash = null;
    expect(await disableTwoFactor("u1", { code: codes[2] }, later)).toEqual({ ok: true });
  });
});

describe("nouveaux codes de secours", () => {
  const later = at(TOTP_STEP_SECONDS * 20);

  it("exige un code ; remplace les dix anciens (qui ne fonctionnent plus)", async () => {
    const old = await enable();
    expect(await regenerateRecoveryCodes("u1", "000000", later)).toEqual({ ok: false, error: "invalid_code" });
    const result = await regenerateRecoveryCodes("u1", totpCode(secretOf(), later.getTime()), later);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recoveryCodes).toHaveLength(10);
    expect(db.state.codes).toHaveLength(10);
    expect(result.recoveryCodes.some((c) => old.includes(c))).toBe(false);
    expect((await challenge("u1", old[0], later)).ok).toBe(false);
    expect((await challenge("u1", result.recoveryCodes[0], later)).ok).toBe(true);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "two_factor.recovery_regenerated" }));
  });

  it("refuse si la fonction n'est pas activée", async () => {
    expect(await regenerateRecoveryCodes("u1", "123456", later)).toEqual({ ok: false, error: "not_enabled" });
  });
});

describe("réinitialisation par l'équipe", () => {
  it("efface tout, révoque les sessions, prévient la personne, journalise QUI a agi", async () => {
    await enable();
    db.state.users.set("admin", { id: "admin", email: "admin@example.dz", locale: "fr" });
    const later = at(3600);
    expect(await resetTwoFactor("u1", "admin", later)).toEqual({ ok: true });
    expect(user()).toMatchObject({ totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, sessionsValidAfter: later });
    expect(db.state.codes).toHaveLength(0);
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "two_factor.reset", adminId: "admin", targetId: "u1", details: { by: "administrateur" } }));
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: "amina@example.dz" });
  });

  it("par la commande du serveur (le compte agit sur lui-même) : le journal le dit", async () => {
    await enable();
    await resetTwoFactor("u1", "u1", at(60));
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ details: { by: "commande" } }));
  });

  it("rien à réinitialiser ou compte inconnu : réponses distinctes, aucun effet", async () => {
    expect(await resetTwoFactor("u1", "admin")).toEqual({ ok: false, error: "not_enabled" });
    expect(await resetTwoFactor("fantome", "admin")).toEqual({ ok: false, error: "not_found" });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("réinitialise aussi une activation commencée mais jamais confirmée", async () => {
    await beginEnrolment("u1", PASSWORD);
    expect(await resetTwoFactor("u1", "admin")).toEqual({ ok: true });
    expect(user().totpPendingSecretEnc).toBeNull();
  });
});
