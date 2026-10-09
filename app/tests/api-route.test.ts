// Lot 271 — briques communes des routes API : requireUser / requireRole / parseJsonBody.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/auth-server/current-user", () => ({ getCurrentUser: () => getCurrentUser() }));

import { NO_STORE, parseJsonBody, requireRole, requireUser } from "@/lib/api-route";
import { isAdmin } from "@/lib/auth-server/roles";

const particulier = { id: "u1", role: "PARTICULIER" };
const admin = { id: "a1", role: "ADMIN" };

beforeEach(() => {
  getCurrentUser.mockReset();
});

describe("requireUser", () => {
  it("renvoie l'utilisateur connecté", async () => {
    getCurrentUser.mockResolvedValue(particulier);
    const result = await requireUser();
    expect(result).toBe(particulier);
  });

  it("répond 401 « unauthenticated » à un anonyme", async () => {
    getCurrentUser.mockResolvedValue(null);
    const result = await requireUser();
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthenticated" });
    expect(response.headers.get("cache-control")).toBeNull();
  });

  it("applique les en-têtes demandés (NO_STORE) à la réponse d'erreur", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = (await requireUser({ headers: NO_STORE })) as NextResponse;
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});

describe("requireRole", () => {
  it("renvoie l'utilisateur quand son rôle satisfait le prédicat", async () => {
    getCurrentUser.mockResolvedValue(admin);
    expect(await requireRole(isAdmin)).toBe(admin);
  });

  it("répond 403 « forbidden » à un rôle insuffisant", async () => {
    getCurrentUser.mockResolvedValue(particulier);
    const response = (await requireRole(isAdmin)) as NextResponse;
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  it("répond 403 (et non 401) à un anonyme — comportement historique des routes d'équipe", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = (await requireRole(isAdmin)) as NextResponse;
    expect(response.status).toBe(403);
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int().optional() });
  const request = (body: unknown) => ({ json: async () => body });
  const brokenRequest = { json: async () => { throw new SyntaxError("Unexpected token"); } };

  it("renvoie les données validées (typées par le schéma)", async () => {
    const result = await parseJsonBody(request({ name: "Amina", age: 30 }), schema);
    expect(result).toEqual({ name: "Amina", age: 30 });
  });

  it("répond 400 « validation » sur un JSON illisible", async () => {
    const response = (await parseJsonBody(brokenRequest, schema)) as NextResponse;
    expect(response).toBeInstanceOf(NextResponse);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "validation" });
  });

  it("répond 400 « validation » sans détail par défaut quand le schéma refuse", async () => {
    const response = (await parseJsonBody(request({ name: "" }), schema)) as NextResponse;
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "validation" });
  });

  it("joint les issues zod complètes avec issues: \"full\"", async () => {
    const response = (await parseJsonBody(request({ name: "" }), schema, { issues: "full" })) as NextResponse;
    const body = await response.json();
    expect(body.error).toBe("validation");
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues[0]).toMatchObject({ path: ["name"] });
  });

  it("ne joint que les chemins fautifs avec issues: \"paths\"", async () => {
    const response = (await parseJsonBody(request({ name: "", age: 1.5 }), schema, { issues: "paths" })) as NextResponse;
    expect(await response.json()).toEqual({ error: "validation", issues: ["name", "age"] });
  });

  it("applique les en-têtes demandés à la réponse d'erreur", async () => {
    const response = (await parseJsonBody(request(null), schema, { headers: NO_STORE })) as NextResponse;
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
