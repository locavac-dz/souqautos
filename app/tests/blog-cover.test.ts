import { describe, expect, it } from "vitest";
import { isBlogCoverUrl } from "@/lib/blog-cover";

const FILE = "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d.jpg";
const S3 = "https://cdn.example.com/souq";

describe("isBlogCoverUrl", () => {
  it("accepts a generated file in the local blog-covers folder", () => {
    expect(isBlogCoverUrl(`/uploads/blog-covers/${FILE}`, undefined)).toBe(true);
  });

  it("accepts a generated file under the configured S3 public address, with or without a trailing slash", () => {
    expect(isBlogCoverUrl(`${S3}/blog-covers/${FILE}`, S3)).toBe(true);
    expect(isBlogCoverUrl(`${S3}/blog-covers/${FILE}`, `${S3}/`)).toBe(true);
  });

  it("refuses an external address, however harmless it looks", () => {
    expect(isBlogCoverUrl(`https://evil.example.com/blog-covers/${FILE}`, S3)).toBe(false);
    expect(isBlogCoverUrl(`//evil.example.com/uploads/blog-covers/${FILE}`, undefined)).toBe(false);
    expect(isBlogCoverUrl("javascript:alert(1)", S3)).toBe(false);
  });

  it("refuses files of other folders, so a cover can never make us delete a logo, an ad photo or an attachment", () => {
    for (const dir of ["listings", "avatars", "messages", "pro-logos", "pro-banners"]) {
      expect(isBlogCoverUrl(`/uploads/${dir}/${FILE}`, undefined)).toBe(false);
      expect(isBlogCoverUrl(`${S3}/${dir}/${FILE}`, S3)).toBe(false);
    }
  });

  it("refuses path tricks and non-generated file names", () => {
    expect(isBlogCoverUrl(`/uploads/blog-covers/../avatars/${FILE}`, undefined)).toBe(false);
    expect(isBlogCoverUrl(`/uploads/blog-covers/${FILE}/../../x.jpg`, undefined)).toBe(false);
    expect(isBlogCoverUrl("/uploads/blog-covers/photo.jpg", undefined)).toBe(false);
    expect(isBlogCoverUrl(`/uploads/blog-covers/${FILE}?x=1`, undefined)).toBe(false);
    expect(isBlogCoverUrl(`/uploads/blog-covers/${FILE.replace(".jpg", ".svg")}`, undefined)).toBe(false);
    expect(isBlogCoverUrl("", undefined)).toBe(false);
  });

  it("does not treat an S3 address as valid when S3 is not configured", () => {
    expect(isBlogCoverUrl(`${S3}/blog-covers/${FILE}`, undefined)).toBe(false);
    expect(isBlogCoverUrl(`${S3}/blog-covers/${FILE}`, "")).toBe(false);
  });
});
