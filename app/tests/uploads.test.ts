import { beforeEach, describe, expect, it, vi } from "vitest";

// Lot 269 (audit B10) — la validation des envois de fichiers n'avait aucun test : refus d'un fichier qui n'est pas
// une image (sur ses OCTETS, pas son nom), limite de taille, nom physique généré, repli disque local. `sharp`,
// le stockage, le disque et l'analyse de qualité sont simulés ; `file-type` est réel (il lit les octets).
const toBuffer = vi.fn();
const sharpChain = { rotate: vi.fn(), resize: vi.fn(), jpeg: vi.fn(), toBuffer: (...a: unknown[]) => toBuffer(...a) };
sharpChain.rotate.mockReturnValue(sharpChain);
sharpChain.resize.mockReturnValue(sharpChain);
sharpChain.jpeg.mockReturnValue(sharpChain);
const sharp = vi.fn<(...args: unknown[]) => typeof sharpChain>(() => sharpChain);
const mkdir = vi.fn();
const writeFile = vi.fn();
const putObject = vi.fn();
const isS3Configured = vi.fn();
const analyzePhotoQuality = vi.fn();

vi.mock("sharp", () => ({ default: (...a: unknown[]) => sharp(...a) }));
vi.mock("node:fs/promises", () => ({ mkdir: (...a: unknown[]) => mkdir(...a), writeFile: (...a: unknown[]) => writeFile(...a), unlink: vi.fn() }));
vi.mock("@/lib/storage", () => ({
  isS3Configured: () => isS3Configured(),
  putObject: (...a: unknown[]) => putObject(...a),
  buildPublicUrl: (key: string) => `https://cdn.example/${key}`,
  s3KeyFromStoredPath: () => null,
  deleteObject: vi.fn(),
}));
vi.mock("@/lib/uploads-serve", () => ({ uploadsRoot: () => "/srv/uploads" }));
vi.mock("@/lib/photo-quality", () => ({ analyzePhotoQuality: (...a: unknown[]) => analyzePhotoQuality(...a) }));

import { PhotoValidationError, saveAvatar, savePhoto, storeProcessedImage } from "@/lib/uploads";

// Un vrai PNG de 1×1 pixel (file-type lit la signature ET la structure des blocs), peu importe le nom ou le type déclaré.
const PNG_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const PDF_BYTES = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n");
const SVG_BYTES = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

function file(bytes: Buffer, name: string, type: string, size = bytes.length): File {
  return { name, type, size, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as unknown as File;
}

beforeEach(() => {
  toBuffer.mockReset().mockResolvedValue(Buffer.from("jpeg-output"));
  sharp.mockClear();
  mkdir.mockReset().mockResolvedValue(undefined);
  writeFile.mockReset().mockResolvedValue(undefined);
  putObject.mockReset().mockResolvedValue(undefined);
  isS3Configured.mockReset().mockReturnValue(false);
  analyzePhotoQuality.mockReset().mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("savePhoto", () => {
  it("accepts a real PNG even with a misleading name and type, re-encodes it, and stores it under a generated name", async () => {
    const saved = await savePhoto(file(PNG_BYTES, "../../etc/passwd.exe", "application/octet-stream"));
    expect(saved.path).toMatch(/^\/uploads\/listings\/[0-9a-f-]{36}\.jpg$/);
    expect(saved.path).not.toContain("passwd");
    expect(saved.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(sharpChain.resize).toHaveBeenCalledWith({ width: 1600, withoutEnlargement: true });
    expect(writeFile).toHaveBeenCalledOnce();
    expect(String(writeFile.mock.calls[0][0])).toMatch(/listings[\\/][0-9a-f-]{36}\.jpg$/);
  });

  it("rejects a file whose bytes are not an image, whatever its declared type (PDF, SVG with script)", async () => {
    await expect(savePhoto(file(PDF_BYTES, "photo.jpg", "image/jpeg"))).rejects.toThrow(PhotoValidationError);
    await expect(savePhoto(file(PDF_BYTES, "photo.jpg", "image/jpeg"))).rejects.toThrow("photo_invalid_type");
    await expect(savePhoto(file(SVG_BYTES, "logo.svg", "image/svg+xml"))).rejects.toThrow("photo_invalid_type");
    expect(sharp).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("rejects a file over 8 MB before reading it", async () => {
    const big = file(PNG_BYTES, "big.png", "image/png", 8 * 1024 * 1024 + 1);
    await expect(savePhoto(big)).rejects.toThrow("photo_too_large");
    expect(sharp).not.toHaveBeenCalled();
  });

  it("uploads to S3 when configured, and falls back to the local disk if S3 fails", async () => {
    isS3Configured.mockReturnValue(true);
    const stored = await savePhoto(file(PNG_BYTES, "a.png", "image/png"));
    expect(putObject).toHaveBeenCalledOnce();
    expect(stored.path).toMatch(/^https:\/\/cdn\.example\/listings\/[0-9a-f-]{36}\.jpg$/);
    expect(writeFile).not.toHaveBeenCalled();

    putObject.mockRejectedValue(new Error("S3 down"));
    const fallback = await savePhoto(file(PNG_BYTES, "a.png", "image/png"));
    expect(fallback.path).toMatch(/^\/uploads\/listings\//);
    expect(writeFile).toHaveBeenCalledOnce();
  });
});

describe("saveAvatar / storeProcessedImage", () => {
  it("applies the 4 MB avatar limit and the square crop", async () => {
    await expect(saveAvatar(file(PNG_BYTES, "me.png", "image/png", 4 * 1024 * 1024 + 1))).rejects.toThrow("photo_too_large");
    const path = await saveAvatar(file(PNG_BYTES, "me.png", "image/png"));
    expect(path).toMatch(/^\/uploads\/avatars\/[0-9a-f-]{36}\.jpg$/);
    expect(sharpChain.resize).toHaveBeenCalledWith(expect.objectContaining({ width: 400, height: 400 }));
  });

  it("writes exactly the given bytes under the given subfolder and name", async () => {
    const stored = await storeProcessedImage("blog-covers", "x.jpg", Buffer.from("bytes"));
    expect(stored).toBe("/uploads/blog-covers/x.jpg");
    expect(mkdir).toHaveBeenCalledWith(expect.stringMatching(/blog-covers$/), { recursive: true });
    expect(writeFile.mock.calls[0][1]).toEqual(Buffer.from("bytes"));
  });
});
