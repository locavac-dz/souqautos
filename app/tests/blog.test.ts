import { describe, expect, it } from "vitest";
import { generateUniqueSlug } from "@/lib/blog";

describe("generateUniqueSlug", () => {
  it("returns the base slug unchanged when it doesn't already exist", () => {
    expect(generateUniqueSlug("comment-acheter-une-voiture", [])).toBe("comment-acheter-une-voiture");
  });

  it("appends -2 when the base slug already exists", () => {
    expect(generateUniqueSlug("comment-acheter-une-voiture", ["comment-acheter-une-voiture"])).toBe(
      "comment-acheter-une-voiture-2"
    );
  });

  it("keeps incrementing until it finds a free suffix", () => {
    const existing = [
      "comment-acheter-une-voiture",
      "comment-acheter-une-voiture-2",
      "comment-acheter-une-voiture-3",
    ];
    expect(generateUniqueSlug("comment-acheter-une-voiture", existing)).toBe(
      "comment-acheter-une-voiture-4"
    );
  });

  it("is unaffected by unrelated existing slugs", () => {
    expect(generateUniqueSlug("comment-vendre-sa-voiture", ["comment-acheter-une-voiture"])).toBe(
      "comment-vendre-sa-voiture"
    );
  });
});
