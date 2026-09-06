import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { analyzePhotoQuality } from "@/lib/photo-quality";

async function solidColorImage(width: number, height: number, rgb: [number, number, number]): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } },
  })
    .jpeg()
    .toBuffer();
}

async function noisyImage(width: number, height: number): Promise<Buffer> {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i++) {
    raw[i] = Math.floor(Math.random() * 256);
  }
  return sharp(raw, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
}

describe("analyzePhotoQuality", () => {
  it("flags a low-resolution image", async () => {
    const buffer = await noisyImage(200, 150);
    expect(await analyzePhotoQuality(buffer)).toContain("low_resolution");
  });

  it("does not flag a normally-sized, varied image", async () => {
    const buffer = await noisyImage(1600, 1200);
    expect(await analyzePhotoQuality(buffer)).toEqual([]);
  });

  it("flags a near-black image as too dark", async () => {
    const buffer = await solidColorImage(1600, 1200, [5, 5, 5]);
    const flags = await analyzePhotoQuality(buffer);
    expect(flags).toContain("too_dark");
    expect(flags).toContain("near_solid_color");
  });

  it("flags a near-white image as too bright", async () => {
    const buffer = await solidColorImage(1600, 1200, [250, 250, 250]);
    const flags = await analyzePhotoQuality(buffer);
    expect(flags).toContain("too_bright");
    expect(flags).toContain("near_solid_color");
  });

  it("flags a mid-tone solid color as near-solid without dark/bright", async () => {
    const buffer = await solidColorImage(1600, 1200, [120, 120, 120]);
    const flags = await analyzePhotoQuality(buffer);
    expect(flags).toEqual(["near_solid_color"]);
  });
});
