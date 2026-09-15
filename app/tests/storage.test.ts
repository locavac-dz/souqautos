import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ne teste jamais le vrai réseau S3 (aucun appel PutObject/DeleteObject réel
// ici) — même discipline que rate-limit.test.ts/realtime.test.ts pour Redis.
// Le vrai chemin S3 (upload/suppression réels, repli après échec S3) n'est
// vérifié qu'en conditions réelles contre un vrai serveur MinIO.
//
// vi.resetModules() + import() dynamique à chaque test : getS3Client() met
// son résultat en cache sur globalThis (même patron que getRedisClient) —
// sans réinitialiser le registre de modules, un test verrait la valeur mise
// en cache par le test précédent plutôt que de relire process.env.
describe("storage (détection de forme, sans réseau)", () => {
  const originalPublicUrl = process.env.S3_PUBLIC_URL;
  const originalBucket = process.env.S3_BUCKET;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.S3_PUBLIC_URL;
    delete process.env.S3_BUCKET;
  });

  afterEach(() => {
    if (originalPublicUrl) process.env.S3_PUBLIC_URL = originalPublicUrl;
    else delete process.env.S3_PUBLIC_URL;
    if (originalBucket) process.env.S3_BUCKET = originalBucket;
    else delete process.env.S3_BUCKET;
  });

  it("isS3Configured est faux tant que S3_BUCKET n'est pas définie", async () => {
    const { isS3Configured } = await import("@/lib/storage");
    expect(isS3Configured()).toBe(false);
  });

  it("buildPublicUrl construit l'URL à partir de S3_PUBLIC_URL", async () => {
    process.env.S3_PUBLIC_URL = "http://127.0.0.1:9000/souq-auto-photos";
    const { buildPublicUrl } = await import("@/lib/storage");
    expect(buildPublicUrl("listings/abc.jpg")).toBe("http://127.0.0.1:9000/souq-auto-photos/listings/abc.jpg");
  });

  it("buildPublicUrl ignore un slash final sur S3_PUBLIC_URL", async () => {
    process.env.S3_PUBLIC_URL = "http://127.0.0.1:9000/souq-auto-photos/";
    const { buildPublicUrl } = await import("@/lib/storage");
    expect(buildPublicUrl("avatars/x.jpg")).toBe("http://127.0.0.1:9000/souq-auto-photos/avatars/x.jpg");
  });

  it("s3KeyFromStoredPath retrouve la clé pour une URL sous S3_PUBLIC_URL", async () => {
    process.env.S3_PUBLIC_URL = "http://127.0.0.1:9000/souq-auto-photos";
    const { s3KeyFromStoredPath } = await import("@/lib/storage");
    expect(s3KeyFromStoredPath("http://127.0.0.1:9000/souq-auto-photos/listings/abc.jpg")).toBe("listings/abc.jpg");
  });

  it("s3KeyFromStoredPath renvoie null pour un chemin local relatif", async () => {
    process.env.S3_PUBLIC_URL = "http://127.0.0.1:9000/souq-auto-photos";
    const { s3KeyFromStoredPath } = await import("@/lib/storage");
    expect(s3KeyFromStoredPath("/uploads/listings/abc.jpg")).toBeNull();
  });

  it("s3KeyFromStoredPath renvoie null pour une URL absolue étrangère (ne correspond pas à la base)", async () => {
    process.env.S3_PUBLIC_URL = "http://127.0.0.1:9000/souq-auto-photos";
    const { s3KeyFromStoredPath } = await import("@/lib/storage");
    expect(s3KeyFromStoredPath("https://autre-domaine.example/x.jpg")).toBeNull();
  });

  it("s3KeyFromStoredPath reste fonctionnel même si S3 est désormais désactivée (parc mixte)", async () => {
    // S3_PUBLIC_URL encore définie (nécessaire pour reconnaître d'anciennes
    // lignes) mais S3_BUCKET absente — isS3Configured() est faux, la
    // détection de forme reste correcte car elle ne dépend jamais de
    // isS3Configured().
    process.env.S3_PUBLIC_URL = "http://127.0.0.1:9000/souq-auto-photos";
    const { s3KeyFromStoredPath, isS3Configured } = await import("@/lib/storage");
    expect(isS3Configured()).toBe(false);
    expect(s3KeyFromStoredPath("http://127.0.0.1:9000/souq-auto-photos/listings/old.jpg")).toBe("listings/old.jpg");
  });

  it("s3KeyFromStoredPath renvoie toujours null sans S3_PUBLIC_URL configurée", async () => {
    const { s3KeyFromStoredPath } = await import("@/lib/storage");
    expect(s3KeyFromStoredPath("/uploads/listings/abc.jpg")).toBeNull();
    expect(s3KeyFromStoredPath("https://n-importe-quoi.example/x.jpg")).toBeNull();
  });
});
