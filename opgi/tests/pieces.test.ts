// Tests d'intégration des pièces jointes à accès médié : upload (type contrôlé),
// téléchargement autorisé, isolation inter‑OPGI et propriété (occupant),
// trace d'audit. Stockage local dans un répertoire temporaire.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServices, type Services } from "@/lib/services";
import { handleLogin } from "@/http/auth";
import { handleReclamations } from "@/http/reclamations";
import { handlePieces, handlePieceTelechargement } from "@/http/pieces";
import { handleAudit } from "@/http/audit";
import { loadEnv, requireEnv } from "./_env.js";
import { DEMO_PASSWORD } from "./global-setup.js";

loadEnv();

// PNG 1×1 transparent.
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const HOST = "localhost:5186";
const ORIGIN = "http://localhost:5186";
let s: Services;
let storageDir = "";
const ck = {} as Record<"occ" | "occ2" | "resp" | "oran" | "auditeur", string>;
let recId = "";
let pieceId = "";

beforeAll(async () => {
  storageDir = mkdtempSync(join(tmpdir(), "opgi-pieces-"));
  s = buildServices({
    DATABASE_URL: requireEnv("TEST_DATABASE_URL"),
    DIRECT_DATABASE_URL: requireEnv("TEST_DIRECT_DATABASE_URL"),
    SESSION_SECRET: "integration-secret-at-least-16",
    ISOLATION_MODE: "shared",
    COOKIE_SECURE: "false",
    FILE_STORAGE_DIR: storageDir,
  });
  ck.occ = await login("OPGI-ALGER", "occ@opgi-alger.demo");
  ck.occ2 = await login("OPGI-ALGER", "occ2@opgi-alger.demo");
  ck.resp = await login("OPGI-ALGER", "resp@opgi-alger.demo");
  ck.oran = await login("OPGI-ORAN", "agent@opgi-oran.demo");
  ck.auditeur = await login("OPGI-ALGER", "auditeur@opgi-alger.demo");

  const rec = await handleReclamations(req("POST", ck.occ, { categorie: "PLOMBERIE", description: "Avec photo" }), s);
  recId = ((await rec.json()) as { reclamation: { id: string } }).reclamation.id;
});

afterAll(async () => {
  await s.app.$disconnect();
  await s.admin.$disconnect();
  rmSync(storageDir, { recursive: true, force: true });
});

async function login(code: string, email: string): Promise<string> {
  const res = await handleLogin(
    new Request(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { origin: ORIGIN, host: HOST, "content-type": "application/json" },
      body: JSON.stringify({ code, email, password: DEMO_PASSWORD }),
    }),
    s,
  );
  if (res.status !== 200) throw new Error(`login ${email} → ${res.status}`);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

function req(method: string, cookie: string, body?: unknown): Request {
  const headers: Record<string, string> = { origin: ORIGIN, host: HOST, cookie };
  if (body !== undefined) headers["content-type"] = "application/json";
  return new Request(`${ORIGIN}/api/x`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("pièces jointes — upload & contrôles", () => {
  it("l'occupant téléverse une image sur SA réclamation (201)", async () => {
    const res = await handlePieces(
      req("POST", ck.occ, { nomFichier: "photo.png", typeMime: "image/png", contenuBase64: PNG_B64 }),
      s,
      recId,
    );
    expect(res.status).toBe(201);
    const { piece } = (await res.json()) as { piece: { id: string; tailleOctets: number } };
    expect(piece.tailleOctets).toBeGreaterThan(0);
    pieceId = piece.id;
  });

  it("refuse un type MIME non autorisé (415)", async () => {
    const res = await handlePieces(
      req("POST", ck.occ, { nomFichier: "x.txt", typeMime: "text/plain", contenuBase64: PNG_B64 }),
      s,
      recId,
    );
    expect(res.status).toBe(415);
  });

  it("un autre occupant ne peut pas téléverser sur cette réclamation (404)", async () => {
    const res = await handlePieces(
      req("POST", ck.occ2, { nomFichier: "p.png", typeMime: "image/png", contenuBase64: PNG_B64 }),
      s,
      recId,
    );
    expect(res.status).toBe(404);
  });
});

describe("pièces jointes — téléchargement médié", () => {
  it("l'occupant propriétaire télécharge sa pièce (contenu correct)", async () => {
    const res = await handlePieceTelechargement(req("GET", ck.occ), s, pieceId);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.equals(Buffer.from(PNG_B64, "base64"))).toBe(true);
  });

  it("un agent (réclamation visible) peut aussi télécharger", async () => {
    expect((await handlePieceTelechargement(req("GET", ck.resp), s, pieceId)).status).toBe(200);
  });

  it("un autre occupant ne peut pas télécharger (404, propriété)", async () => {
    expect((await handlePieceTelechargement(req("GET", ck.occ2), s, pieceId)).status).toBe(404);
  });

  it("isolation inter‑OPGI : Oran ne peut pas télécharger la pièce d'Alger (404)", async () => {
    expect((await handlePieceTelechargement(req("GET", ck.oran), s, pieceId)).status).toBe(404);
  });

  it("la liste des pièces est limitée au propriétaire de la réclamation", async () => {
    const mine = (await (await handlePieces(req("GET", ck.occ), s, recId)).json()) as { pieces: unknown[] };
    expect(mine.pieces.length).toBeGreaterThan(0);
    expect((await handlePieces(req("GET", ck.occ2), s, recId)).status).toBe(404);
  });

  it("l'upload est tracé au journal d'audit", async () => {
    const audit = (await (await handleAudit(req("GET", ck.auditeur), s)).json()) as { entries: { action: string }[] };
    expect(audit.entries.some((e) => e.action === "piece.upload")).toBe(true);
  });
});
