import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

// En production les cookies d'authentification portent le préfixe __Host- : un navigateur refuse tout Set-Cookie
// « __Host- » sans l'attribut Secure, y compris pour l'effacer. `store.delete()` n'émet pas Secure : le cookie
// restait en place (constaté par l'e2e de production). On réémet le cookie, vide, avec les attributs de sa pose.
const set = vi.fn();
const del = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ set, delete: del, get: () => undefined }) }));

import { expireAuthCookie } from "@/lib/auth-server/cookie-expiry";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/auth-server/session";
import { clearRefreshCookie, REFRESH_COOKIE } from "@/lib/auth-server/refresh-token";
import { clearPendingCookie, PENDING_COOKIE } from "@/lib/auth-server/two-factor-pending";

beforeEach(() => {
  set.mockClear();
  del.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("effacement des cookies d'authentification", () => {
  it("réémet un cookie vide, Secure et à durée nulle, en production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expireAuthCookie("__Host-exemple");
    expect(set).toHaveBeenCalledWith("__Host-exemple", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    expect(del).not.toHaveBeenCalled();
  });

  it("n'impose pas Secure en développement (http://localhost)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expireAuthCookie("exemple");
    expect(set).toHaveBeenCalledWith("exemple", "", expect.objectContaining({ secure: false, path: "/", maxAge: 0 }));
  });

  it.each([
    ["session", clearSessionCookie, SESSION_COOKIE],
    ["rafraîchissement", clearRefreshCookie, REFRESH_COOKIE],
    ["attente 2FA", clearPendingCookie, PENDING_COOKIE],
  ] as const)("le cookie %s est effacé par réémission, jamais par delete()", async (_label, clear, name) => {
    vi.stubEnv("NODE_ENV", "production");
    await clear();
    expect(set).toHaveBeenCalledWith(name, "", expect.objectContaining({ secure: true, maxAge: 0 }));
    expect(del).not.toHaveBeenCalled();
  });
});
