import { beforeEach, describe, expect, it, vi } from "vitest";

// `vi.hoisted` : ces simulations doivent exister AVANT que les `vi.mock` (remontés en tête de fichier) ne les utilisent.
const { userFindUnique, userUpdate, tokenFindUnique, tokenCreate, tokenDeleteMany, sendEmail, models } = vi.hoisted(() => {
  const userFindUnique = vi.fn();
  const userUpdate = vi.fn();
  const tokenFindUnique = vi.fn();
  const tokenCreate = vi.fn();
  const tokenDeleteMany = vi.fn();
  const sendEmail = vi.fn();
  const models = {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a), update: (...a: unknown[]) => userUpdate(...a) },
    passwordResetToken: {
      findUnique: (...a: unknown[]) => tokenFindUnique(...a),
      create: (...a: unknown[]) => tokenCreate(...a),
      deleteMany: (...a: unknown[]) => tokenDeleteMany(...a),
    },
  };
  return { userFindUnique, userUpdate, tokenFindUnique, tokenCreate, tokenDeleteMany, sendEmail, models };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...models,
    // Tableau d'opérations (déjà lancées) ou fonction interactive : les deux formes utilisées par le service.
    $transaction: async (arg: unknown) => (typeof arg === "function" ? (arg as (tx: typeof models) => unknown)(models) : Promise.all(arg as unknown[])),
  },
}));
vi.mock("@/lib/mailer", () => ({ sendEmail: (...a: unknown[]) => sendEmail(...a) }));
vi.mock("@/lib/site", () => ({ SITE_URL: "https://souqauto.example" }));

import { confirmPasswordReset, isResetTokenUsable, requestPasswordReset } from "@/lib/password-reset-service";
import { createResetToken, hashResetToken } from "@/lib/password-reset";
import { verifyPassword } from "@/lib/auth-server/password";

const NOW = new Date("2026-09-20T10:00:00Z");
const user = (overrides: Record<string, unknown> = {}) => ({ id: "user-1", email: "amina@example.dz", locale: "fr", suspendedAt: null, deletedAt: null, ...overrides });

beforeEach(() => {
  vi.resetAllMocks();
  tokenDeleteMany.mockResolvedValue({ count: 1 });
  tokenCreate.mockResolvedValue({});
  userUpdate.mockResolvedValue({});
  sendEmail.mockResolvedValue({});
});

describe("requestPasswordReset", () => {
  it("sends nothing, and writes nothing, for an unknown, deleted or suspended account", async () => {
    userFindUnique.mockResolvedValue(null);
    expect(await requestPasswordReset("inconnu@example.dz")).toEqual({ sent: false });
    for (const overrides of [{ deletedAt: new Date() }, { suspendedAt: new Date() }]) {
      userFindUnique.mockResolvedValue(user(overrides));
      expect(await requestPasswordReset("amina@example.dz")).toEqual({ sent: false });
    }
    expect(tokenCreate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("replaces any previous link, stores only the hash, and mails the link whose token matches that hash", async () => {
    userFindUnique.mockResolvedValue(user());
    expect(await requestPasswordReset("amina@example.dz")).toEqual({ sent: true });

    expect(tokenDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    const stored = tokenCreate.mock.calls[0][0].data as { userId: string; tokenHash: string; expiresAt: Date };
    expect(stored.userId).toBe("user-1");
    expect(stored.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.expiresAt.getTime() - Date.now()).toBeGreaterThan(59 * 60_000);

    const mail = sendEmail.mock.calls[0][0] as { to: string; subject: string; html: string };
    expect(mail.to).toBe("amina@example.dz");
    const token = /reinitialiser-mot-de-passe\/([A-Za-z0-9_-]{43})/.exec(mail.html)?.[1];
    expect(token).toBeDefined();
    expect(hashResetToken(token!)).toBe(stored.tokenHash);
    expect(JSON.stringify(tokenCreate.mock.calls)).not.toContain(token!); // le jeton lui-même n'est jamais écrit
    expect(mail.html).toContain("https://souqauto.example/fr/reinitialiser-mot-de-passe/");
  });

  it("writes to the user in their own language", async () => {
    userFindUnique.mockResolvedValue(user({ locale: "ar" }));
    await requestPasswordReset("amina@example.dz");
    const mail = sendEmail.mock.calls[0][0] as { subject: string; html: string };
    expect(mail.subject).toBe("إعادة تعيين كلمة المرور — سوق أوتو");
    expect(mail.html).toContain("/ar/reinitialiser-mot-de-passe/");
  });

  it("lets a mail failure reach the caller (the route logs it, and still answers the same thing)", async () => {
    userFindUnique.mockResolvedValue(user());
    sendEmail.mockRejectedValue(new Error("SMTP indisponible"));
    await expect(requestPasswordReset("amina@example.dz")).rejects.toThrow("SMTP indisponible");
  });
});

describe("isResetTokenUsable", () => {
  const { token, tokenHash } = createResetToken(NOW);
  const row = (overrides: Record<string, unknown> = {}) => ({ expiresAt: new Date(NOW.getTime() + 60_000), user: { deletedAt: null }, ...overrides });

  it("does not even query the database for a malformed token", async () => {
    for (const bad of ["", "abc", "a".repeat(200), null, undefined, 42]) expect(await isResetTokenUsable(bad, NOW)).toBe(false);
    expect(tokenFindUnique).not.toHaveBeenCalled();
  });

  it("looks the token up by its hash, and accepts it only when unexpired and the account is not deleted", async () => {
    tokenFindUnique.mockResolvedValue(row());
    expect(await isResetTokenUsable(token, NOW)).toBe(true);
    expect(tokenFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash } }));

    tokenFindUnique.mockResolvedValue(null);
    expect(await isResetTokenUsable(token, NOW)).toBe(false);
    tokenFindUnique.mockResolvedValue(row({ expiresAt: new Date(NOW.getTime() - 1) }));
    expect(await isResetTokenUsable(token, NOW)).toBe(false);
    tokenFindUnique.mockResolvedValue(row({ expiresAt: NOW })); // à la seconde même de l'expiration : refusé
    expect(await isResetTokenUsable(token, NOW)).toBe(false);
    tokenFindUnique.mockResolvedValue(row({ user: { deletedAt: new Date() } }));
    expect(await isResetTokenUsable(token, NOW)).toBe(false);
  });
});

describe("confirmPasswordReset", () => {
  const { token, tokenHash } = createResetToken(NOW);
  const row = (overrides: Record<string, unknown> = {}) => ({
    userId: "user-1",
    expiresAt: new Date(NOW.getTime() + 60_000),
    user: { email: "amina@example.dz", locale: "fr", emailVerifiedAt: null, deletedAt: null },
    ...overrides,
  });

  it("refuses a malformed, unknown, expired or deleted-account token with one single answer, and changes nothing", async () => {
    expect(await confirmPasswordReset("abc", "NouveauMotDePasse2026!", NOW)).toEqual({ ok: false, error: "invalid_token" });
    expect(tokenFindUnique).not.toHaveBeenCalled();

    for (const found of [null, row({ expiresAt: new Date(NOW.getTime() - 1) }), row({ user: { email: "a", locale: "fr", emailVerifiedAt: null, deletedAt: new Date() } })]) {
      tokenFindUnique.mockResolvedValue(found);
      expect(await confirmPasswordReset(token, "NouveauMotDePasse2026!", NOW)).toEqual({ ok: false, error: "invalid_token" });
    }
    expect(userUpdate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sets a HASHED password, verifies the address, lifts the lockout, revokes every earlier session and consumes the token", async () => {
    tokenFindUnique.mockResolvedValue(row());
    expect(await confirmPasswordReset(token, "NouveauMotDePasse2026!", NOW)).toEqual({ ok: true });

    expect(tokenDeleteMany).toHaveBeenCalledWith({ where: { tokenHash } }); // consomme CE jeton
    expect(tokenDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } }); // et tous les autres du compte
    const { where, data } = userUpdate.mock.calls[0][0];
    expect(where).toEqual({ id: "user-1" });
    expect(data.passwordHash).not.toBe("NouveauMotDePasse2026!");
    expect(await verifyPassword("NouveauMotDePasse2026!", data.passwordHash)).toBe(true);
    expect(data.emailVerifiedAt).toEqual(NOW);
    expect(data.failedLoginAttempts).toBe(0);
    expect(data.lockedUntil).toBeNull();
    expect(data.sessionsValidAfter).toEqual(NOW);
  });

  it("keeps the date on which the address had already been verified", async () => {
    const verified = new Date("2026-01-01T00:00:00Z");
    tokenFindUnique.mockResolvedValue(row({ user: { email: "a@b.dz", locale: "fr", emailVerifiedAt: verified, deletedAt: null } }));
    await confirmPasswordReset(token, "NouveauMotDePasse2026!", NOW);
    expect(userUpdate.mock.calls[0][0].data.emailVerifiedAt).toEqual(verified);
  });

  it("tells the person, in their language, that the password changed", async () => {
    tokenFindUnique.mockResolvedValue(row({ user: { email: "amina@example.dz", locale: "ar", emailVerifiedAt: null, deletedAt: null } }));
    await confirmPasswordReset(token, "NouveauMotDePasse2026!", NOW);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "amina@example.dz", subject: "تم تغيير كلمة المرور — سوق أوتو" }));
  });

  it("lets only ONE of two simultaneous requests succeed: the token deletion decides", async () => {
    tokenFindUnique.mockResolvedValue(row());
    tokenDeleteMany.mockResolvedValueOnce({ count: 0 }); // l'autre demande a déjà consommé le jeton
    expect(await confirmPasswordReset(token, "SecondMotDePasse2026!", NOW)).toEqual({ ok: false, error: "invalid_token" });
    expect(userUpdate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not undo the change when the notification email cannot be sent", async () => {
    tokenFindUnique.mockResolvedValue(row());
    sendEmail.mockRejectedValue(new Error("SMTP indisponible"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await confirmPasswordReset(token, "NouveauMotDePasse2026!", NOW)).toEqual({ ok: true });
    expect(userUpdate).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0][0]).not.toContain("NouveauMotDePasse2026!"); // jamais le mot de passe dans les journaux
    error.mockRestore();
  });
});
