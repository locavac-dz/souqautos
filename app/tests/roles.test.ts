// Lot 276 — hiérarchie des rôles : un rédacteur entre dans le back-office sans aucun droit de modération.
import { describe, expect, it } from "vitest";
import { hasBackOfficeAccess, isAdmin, isEditor, isModerator, isStaff, isSuperAdmin } from "@/lib/auth-server/roles";

describe("rôle EDITEUR", () => {
  it("a l'accès éditorial, comme ADMIN et SUPER_ADMIN", () => {
    expect(isEditor("EDITEUR")).toBe(true);
    expect(isEditor("ADMIN")).toBe(true);
    expect(isEditor("SUPER_ADMIN")).toBe(true);
    expect(isEditor("MODERATEUR")).toBe(false);
    expect(isEditor("SUPPORT")).toBe(false);
    expect(isEditor("PARTICULIER")).toBe(false);
  });

  it("n'est ni membre de l'équipe de modération, ni modérateur, ni administrateur", () => {
    expect(isStaff("EDITEUR")).toBe(false);
    expect(isModerator("EDITEUR")).toBe(false);
    expect(isAdmin("EDITEUR")).toBe(false);
    expect(isSuperAdmin("EDITEUR")).toBe(false);
  });

  it("entre dans /admin, comme l'équipe, mais pas un particulier ni un professionnel", () => {
    expect(hasBackOfficeAccess("EDITEUR")).toBe(true);
    expect(hasBackOfficeAccess("SUPPORT")).toBe(true);
    expect(hasBackOfficeAccess("SUPER_ADMIN")).toBe(true);
    expect(hasBackOfficeAccess("PARTICULIER")).toBe(false);
    expect(hasBackOfficeAccess("PROFESSIONNEL")).toBe(false);
  });
});
