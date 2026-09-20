import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const linkFindUnique = vi.fn();
const linkCreate = vi.fn();
const userFindUnique = vi.fn();
const userCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    oAuthAccount: { findUnique: (...a: unknown[]) => linkFindUnique(...a), create: (...a: unknown[]) => linkCreate(...a) },
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a), create: (...a: unknown[]) => userCreate(...a) },
  },
}));

import { signInWithGoogleProfile } from "@/lib/google-account";

const profile = { sub: "google-sub-1", email: "amina@gmail.com", name: "Amina Test" };
const unique = () => new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" });
const account = (overrides: Record<string, unknown> = {}) => ({ id: "user-1", role: "PARTICULIER", suspendedAt: null, deletedAt: null, emailVerifiedAt: new Date("2026-01-01"), totpEnabledAt: null, ...overrides });

beforeEach(() => {
  vi.resetAllMocks();
  linkFindUnique.mockResolvedValue(null);
  userFindUnique.mockResolvedValue(null);
  linkCreate.mockResolvedValue({});
  userCreate.mockResolvedValue({ id: "new-user", role: "PARTICULIER" });
});

describe("a Google account already linked to a site account", () => {
  it("opens that account, whatever the current address of the Google account is", async () => {
    linkFindUnique.mockResolvedValue({ user: account() });
    const result = await signInWithGoogleProfile({ ...profile, email: "nouvelle-adresse@gmail.com" }, "fr");
    expect(result).toEqual({ ok: true, user: { id: "user-1", role: "PARTICULIER", totpEnabledAt: null }, created: false, linked: false });
    expect(linkFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { provider_providerAccountId: { provider: "google", providerAccountId: "google-sub-1" } } }));
    expect(userFindUnique).not.toHaveBeenCalled(); // l'adresse n'est même pas consultée
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("tells the caller when the account has two-factor authentication (Lot 138): Google alone must not open a session", async () => {
    const enabledAt = new Date("2026-09-01");
    linkFindUnique.mockResolvedValue({ user: account({ totpEnabledAt: enabledAt }) });
    expect(await signInWithGoogleProfile(profile, "fr")).toMatchObject({ ok: true, user: { id: "user-1", totpEnabledAt: enabledAt } });
    // Aussi quand le compte est retrouvé par son adresse (rattachement).
    linkFindUnique.mockResolvedValue(null);
    userFindUnique.mockResolvedValue(account({ totpEnabledAt: enabledAt }));
    expect(await signInWithGoogleProfile(profile, "fr")).toMatchObject({ ok: true, linked: true, user: { totpEnabledAt: enabledAt } });
  });

  it("refuses a suspended, deleted or staff account, even though the link exists", async () => {
    linkFindUnique.mockResolvedValue({ user: account({ suspendedAt: new Date() }) });
    expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "suspended" });
    linkFindUnique.mockResolvedValue({ user: account({ deletedAt: new Date() }) });
    expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "deleted" });
    linkFindUnique.mockResolvedValue({ user: account({ role: "MODERATEUR" }) });
    expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "staff" });
    linkFindUnique.mockResolvedValue({ user: account({ role: "ADMIN" }) });
    expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "staff" });
  });
});

describe("a site account already exists at the same address", () => {
  it("links the Google account when the site has verified the address", async () => {
    userFindUnique.mockResolvedValue(account());
    const result = await signInWithGoogleProfile(profile, "fr");
    expect(result).toEqual({ ok: true, user: { id: "user-1", role: "PARTICULIER", totpEnabledAt: null }, created: false, linked: true });
    expect(linkCreate).toHaveBeenCalledWith({ data: { provider: "google", providerAccountId: "google-sub-1", userId: "user-1" } });
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("looks the account up by the address Google vouches for", async () => {
    userFindUnique.mockResolvedValue(account());
    await signInWithGoogleProfile(profile, "fr");
    expect(userFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: "amina@gmail.com" } }));
  });

  it("REFUSES when the site never verified the address: the account may belong to someone who registered first with another person's address", async () => {
    userFindUnique.mockResolvedValue(account({ emailVerifiedAt: null }));
    expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "unverified_account" });
    expect(linkCreate).not.toHaveBeenCalled(); // aucun lien : le compte n'est jamais donné à cette personne
    expect(userCreate).not.toHaveBeenCalled();
  });

  it("refuses a staff or suspended account before anything else, verified or not", async () => {
    for (const emailVerifiedAt of [null, new Date()]) {
      userFindUnique.mockResolvedValue(account({ role: "ADMIN", emailVerifiedAt }));
      expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "staff" });
      userFindUnique.mockResolvedValue(account({ role: "MODERATEUR", emailVerifiedAt }));
      expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "staff" });
      userFindUnique.mockResolvedValue(account({ suspendedAt: new Date(), emailVerifiedAt }));
      expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "suspended" });
    }
    expect(linkCreate).not.toHaveBeenCalled();
  });

  it("accepts a professional account (only staff roles are excluded)", async () => {
    userFindUnique.mockResolvedValue(account({ role: "PROFESSIONNEL" }));
    expect(await signInWithGoogleProfile(profile, "fr")).toMatchObject({ ok: true, linked: true, user: { role: "PROFESSIONNEL" } });
  });

  it("treats two simultaneous returns from Google as one (the link already exists)", async () => {
    userFindUnique.mockResolvedValue(account());
    linkCreate.mockRejectedValue(unique());
    expect(await signInWithGoogleProfile(profile, "fr")).toMatchObject({ ok: true, linked: true });
  });

  it("does not hide any other database failure while linking", async () => {
    userFindUnique.mockResolvedValue(account());
    linkCreate.mockRejectedValue(new Error("connexion perdue"));
    await expect(signInWithGoogleProfile(profile, "fr")).rejects.toThrow("connexion perdue");
  });
});

describe("a first Google sign-in with an unknown address", () => {
  it("creates a verified account without a password, a profile and the link — and stores nothing else from Google", async () => {
    const result = await signInWithGoogleProfile(profile, "ar");
    expect(result).toEqual({ ok: true, user: { id: "new-user", role: "PARTICULIER", totpEnabledAt: null }, created: true, linked: false });

    const { data } = userCreate.mock.calls[0][0];
    expect(data.email).toBe("amina@gmail.com");
    expect(data.passwordHash).toBeNull();
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(data.locale).toBe("ar");
    expect(data.profile).toEqual({ create: { displayName: "Amina Test" } });
    expect(data.oauthAccounts).toEqual({ create: { provider: "google", providerAccountId: "google-sub-1" } });
    expect(Object.keys(data).sort()).toEqual(["email", "emailVerifiedAt", "locale", "oauthAccounts", "passwordHash", "profile"]);
    expect(data.role).toBeUndefined(); // jamais un rôle choisi ici : le défaut du site (particulier)
  });

  it("falls back to the beginning of the address for the display name, and to a neutral word when that is too short", async () => {
    await signInWithGoogleProfile({ sub: "s", email: "karim.b@gmail.com" }, "fr");
    expect(userCreate.mock.calls[0][0].data.profile.create.displayName).toBe("karim.b");
    await signInWithGoogleProfile({ sub: "s2", email: "k@gmail.com" }, "fr");
    expect(userCreate.mock.calls[1][0].data.profile.create.displayName).toBe("Utilisateur");
  });

  it("starts over once when someone registered the same address in the meantime, then follows the normal rules", async () => {
    userCreate.mockRejectedValueOnce(unique());
    userFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(account({ emailVerifiedAt: null }));
    // Au 2e passage, le compte existe mais son adresse n'est pas vérifiée : refus, jamais un rattachement.
    expect(await signInWithGoogleProfile(profile, "fr")).toEqual({ ok: false, reason: "unverified_account" });
    expect(userCreate).toHaveBeenCalledTimes(1);
  });

  it("gives up after that single retry, and does not swallow other errors", async () => {
    userCreate.mockRejectedValue(unique());
    await expect(signInWithGoogleProfile(profile, "fr")).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(userCreate).toHaveBeenCalledTimes(2);

    userCreate.mockReset();
    userCreate.mockRejectedValue(new Error("base injoignable"));
    await expect(signInWithGoogleProfile(profile, "fr")).rejects.toThrow("base injoignable");
    expect(userCreate).toHaveBeenCalledTimes(1);
  });
});
