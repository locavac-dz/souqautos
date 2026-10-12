import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import manifest from "@/app/manifest";

const PUBLIC = path.resolve(process.cwd(), "public");
const APP = path.resolve(process.cwd(), "src/app/[locale]");

describe("web app manifest", () => {
  const m = manifest();

  it("has the fields a browser needs to offer installation", () => {
    expect(m.name).toBe("Souq Autos");
    expect(m.short_name).toBe("Souq Autos");
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.scope).toBe("/");
    expect(m.id).toBe("/");
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("declares a 192, a 512 and a maskable 512 icon", () => {
    const icons = m.icons ?? [];
    const keys = icons.map((i) => `${i.sizes}:${i.purpose}`);
    expect(keys).toContain("192x192:any");
    expect(keys).toContain("512x512:any");
    expect(keys).toContain("512x512:maskable");
    for (const icon of icons) expect(icon.type).toBe("image/png");
  });

  it("points to icon files that exist and really have the declared size", async () => {
    for (const icon of m.icons ?? []) {
      const file = path.join(PUBLIC, icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      const meta = await sharp(file).metadata();
      expect(`${meta.width}x${meta.height}`, icon.src).toBe(icon.sizes);
      expect(meta.format, icon.src).toBe("png");
    }
  });

  it("keeps the maskable icon's drawing inside the 80% safe zone (the phone crops the corners)", async () => {
    const file = path.join(PUBLIC, "icons/icon-maskable-512.png");
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    // dessin = pixels qui ne sont pas du fond blanc ; il doit tenir dans le cercle de rayon 40 % de la largeur
    const centre = info.width / 2;
    const safeRadius = info.width * 0.4;
    let outside = 0;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const i = (y * info.width + x) * info.channels;
        const isBackground = data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
        if (!isBackground && Math.hypot(x - centre, y - centre) > safeRadius) outside++;
      }
    }
    expect(outside).toBe(0);
  });

  it("uses shortcut addresses that belong to the scope and to real pages", () => {
    for (const shortcut of m.shortcuts ?? []) {
      expect(shortcut.url.startsWith("/")).toBe(true);
      expect(existsSync(path.join(APP, shortcut.url.slice(1))), shortcut.url).toBe(true);
    }
  });
});

describe("offline page", () => {
  const html = readFileSync(path.join(PUBLIC, "offline.html"), "utf8");

  it("is in French and in Arabic, the second right-to-left", () => {
    expect(html).toContain("Vous êtes hors connexion");
    expect(html).toContain("أنت غير متصل بالإنترنت");
    expect(html).toMatch(/lang="ar"\s+dir="rtl"/);
  });

  it("is never indexed and offers a retry", () => {
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).toContain("location.reload()");
  });

  it("depends on nothing else: no external file, so it still displays without a network", () => {
    expect(html).not.toMatch(/(?:src|href)=["']https?:/i);
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/url\(\s*["']?https?:/i);
  });
});
