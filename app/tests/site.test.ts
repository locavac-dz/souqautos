import { describe, expect, it } from "vitest";
import { SITE_URL, resolveAbsolutePhotoUrl } from "@/lib/site";

describe("resolveAbsolutePhotoUrl", () => {
  it("laisse une URL déjà absolue inchangée (photo stockée sur S3)", () => {
    const url = "http://127.0.0.1:9000/souq-auto-photos/listings/abc.jpg";
    expect(resolveAbsolutePhotoUrl(url)).toBe(url);
  });

  it("laisse une URL https absolue inchangée", () => {
    const url = "https://cdn.example.dz/listings/abc.jpg";
    expect(resolveAbsolutePhotoUrl(url)).toBe(url);
  });

  it("préfixe SITE_URL pour un chemin local relatif (repli disque)", () => {
    expect(resolveAbsolutePhotoUrl("/uploads/listings/abc.jpg")).toBe(`${SITE_URL}/uploads/listings/abc.jpg`);
  });
});
