import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SHARE_HEIGHT, SHARE_WIDTH, loadSharePhoto } from "@/lib/share-image-photo";

// Lot 142 — le chargement de la photo qui sert de fond à la carte de partage. La valeur lue vient de la base ; ces tests posent des
// pièges (remontée de dossier, adresse étrangère, faux fichier, énorme fichier) pour prouver qu'aucun ne passe.

let sandbox: string; // dossier jetable : contient « uploads/ » (le dossier autorisé) ET un fichier voisin, hors du dossier autorisé
let uploadsRoot: string;
let photoBytes: Buffer;

async function makeJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } }).jpeg().toBuffer();
}

beforeAll(async () => {
  sandbox = await mkdtemp(path.join(os.tmpdir(), "share-photo-"));
  uploadsRoot = path.join(sandbox, "uploads");
  await mkdir(path.join(uploadsRoot, "listings"), { recursive: true });
  photoBytes = await makeJpeg(1600, 1200);
  await writeFile(path.join(uploadsRoot, "listings", "ok.jpg"), photoBytes);
  await writeFile(path.join(uploadsRoot, "listings", "portrait.jpg"), await makeJpeg(600, 1000));
  await writeFile(path.join(uploadsRoot, "listings", "petite.jpg"), await makeJpeg(200, 100));
  await writeFile(path.join(uploadsRoot, "listings", "faux.jpg"), Buffer.from("ceci n'est pas une image, c'est du texte"));
  // Une vraie image, mais HORS du dossier autorisé : si le garde-fou tombait, elle serait lue et renvoyée.
  await writeFile(path.join(sandbox, "secret.jpg"), photoBytes);
  // Un dossier VOISIN dont le nom commence comme « uploads » : « uploads-evil/… » commence bien par « …/uploads », sans en faire partie.
  await mkdir(path.join(sandbox, "uploads-evil"), { recursive: true });
  await writeFile(path.join(sandbox, "uploads-evil", "secret2.jpg"), photoBytes);
});

afterAll(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

beforeEach(() => {
  delete process.env.S3_PUBLIC_URL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.S3_PUBLIC_URL;
});

async function expectCardSizedJpeg(bytes: Buffer | null) {
  expect(bytes).not.toBeNull();
  const meta = await sharp(bytes!).metadata();
  expect({ format: meta.format, width: meta.width, height: meta.height }).toEqual({ format: "jpeg", width: SHARE_WIDTH, height: SHARE_HEIGHT });
}

describe("photo locale", () => {
  it("recadre n'importe quelle photo aux dimensions exactes de la carte, en JPEG", async () => {
    await expectCardSizedJpeg(await loadSharePhoto("/uploads/listings/ok.jpg", uploadsRoot)); // paysage 4:3
    await expectCardSizedJpeg(await loadSharePhoto("/uploads/listings/portrait.jpg", uploadsRoot)); // portrait
    await expectCardSizedJpeg(await loadSharePhoto("/uploads/listings/petite.jpg", uploadsRoot)); // plus petite que la carte
  });

  it("ne renvoie rien (pas d'erreur) pour une annonce sans photo", async () => {
    expect(await loadSharePhoto(null, uploadsRoot)).toBeNull();
    expect(await loadSharePhoto(undefined, uploadsRoot)).toBeNull();
    expect(await loadSharePhoto("", uploadsRoot)).toBeNull();
  });

  it("ne renvoie rien pour un fichier absent ou qui n'est pas une image", async () => {
    expect(await loadSharePhoto("/uploads/listings/absent.jpg", uploadsRoot)).toBeNull();
    expect(await loadSharePhoto("/uploads/listings/faux.jpg", uploadsRoot)).toBeNull();
  });

  it("REFUSE de sortir du dossier des envois, sous toutes les formes de remontée", async () => {
    // Le fichier « secret.jpg » est une vraie image, juste au-dessus du dossier autorisé.
    expect(await loadSharePhoto("/uploads/../secret.jpg", uploadsRoot)).toBeNull();
    expect(await loadSharePhoto("/uploads/listings/../../secret.jpg", uploadsRoot)).toBeNull();
    expect(await loadSharePhoto("/uploads/listings/..\\..\\secret.jpg", uploadsRoot)).toBeNull();
    expect(await loadSharePhoto(`/uploads/${path.relative(uploadsRoot, path.join(sandbox, "secret.jpg"))}`, uploadsRoot)).toBeNull();
    expect(await loadSharePhoto("/uploads/../uploads-evil/secret2.jpg", uploadsRoot)).toBeNull(); // dossier voisin au nom presque identique
    // Contrôle : sans piège, le même fichier posé DANS le dossier est bien lu — le refus vient du garde-fou, pas d'un fichier illisible.
    await writeFile(path.join(uploadsRoot, "copie.jpg"), photoBytes);
    await expectCardSizedJpeg(await loadSharePhoto("/uploads/copie.jpg", uploadsRoot));
  });

  it("REFUSE un chemin absolu ou un préfixe voisin du dossier autorisé", async () => {
    expect(await loadSharePhoto(path.join(sandbox, "secret.jpg"), uploadsRoot)).toBeNull(); // chemin disque brut
    expect(await loadSharePhoto("/etc/passwd", uploadsRoot)).toBeNull();
    expect(await loadSharePhoto("/uploadsX/listings/ok.jpg", uploadsRoot)).toBeNull(); // « /uploads » sans le « / » final
    expect(await loadSharePhoto("file:///etc/passwd", uploadsRoot)).toBeNull();
  });
});

describe("photo distante — seulement notre propre stockage", () => {
  it("n'appelle JAMAIS une adresse étrangère (serveur interne, métadonnées cloud, site tiers)", async () => {
    process.env.S3_PUBLIC_URL = "https://bucket.exemple.dz/photos";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const url of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:5432/",
      "https://evil.exemple.com/photo.jpg",
      "https://bucket.exemple.dz.evil.com/photos/x.jpg", // même début de nom d'hôte, autre domaine
      "https://bucket.exemple.dz/autre-dossier/x.jpg", // bon hôte, hors du dossier public
    ]) {
      expect(await loadSharePhoto(url, uploadsRoot), url).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sans stockage distant configuré, aucune adresse http n'est suivie", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await loadSharePhoto("https://bucket.exemple.dz/photos/x.jpg", uploadsRoot)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("charge une photo de notre stockage, sans suivre de redirection, avec un délai maximal", async () => {
    process.env.S3_PUBLIC_URL = "https://bucket.exemple.dz/photos";
    const fetchSpy = vi.fn(async () => new Response(new Uint8Array(photoBytes), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    await expectCardSizedJpeg(await loadSharePhoto("https://bucket.exemple.dz/photos/listings/a.jpg", uploadsRoot));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
    expect(options.redirect).toBe("error"); // une redirection pourrait mener hors de notre stockage
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("ne renvoie rien si le stockage répond mal, échoue, ou envoie un fichier trop gros", async () => {
    process.env.S3_PUBLIC_URL = "https://bucket.exemple.dz/photos";
    const url = "https://bucket.exemple.dz/photos/listings/a.jpg";

    vi.stubGlobal("fetch", vi.fn(async () => new Response("erreur", { status: 500 })));
    expect(await loadSharePhoto(url, uploadsRoot)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    expect(await loadSharePhoto(url, uploadsRoot)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(photoBytes), { status: 200, headers: { "content-length": String(50 * 1024 * 1024) } })));
    expect(await loadSharePhoto(url, uploadsRoot)).toBeNull();

    // Sans en-tête de taille, avec une image VALIDE de plus de 10 Mo (du bruit, incompressible) : sans borne de taille elle serait
    // acceptée. Des octets nuls ne prouveraient rien — le décodage les refuserait de toute façon.
    const heavy = await sharp({ create: { width: 2400, height: 2400, channels: 3, background: { r: 0, g: 0, b: 0 }, noise: { type: "gaussian", mean: 128, sigma: 60 } } }).png({ compressionLevel: 0 }).toBuffer();
    expect(heavy.length).toBeGreaterThan(10 * 1024 * 1024);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(heavy), { status: 200 })));
    expect(await loadSharePhoto(url, uploadsRoot)).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>pas une image</html>", { status: 200 })));
    expect(await loadSharePhoto(url, uploadsRoot)).toBeNull();
  });
});
