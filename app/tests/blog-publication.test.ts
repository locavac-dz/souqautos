import { describe, expect, it } from "vitest";
import {
  articleStatus,
  publishedNow,
  resolvePublishedAt,
  shouldShowUpdatedDate,
} from "@/lib/blog-publication";

const now = new Date("2026-09-19T12:00:00Z");
const past = new Date("2026-09-10T08:00:00Z");
const future = new Date("2026-10-01T08:00:00Z");

describe("articleStatus", () => {
  it("is a draft without a publication date", () => {
    expect(articleStatus(null, now)).toBe("draft");
  });

  it("is scheduled when the date is in the future", () => {
    expect(articleStatus(future, now)).toBe("scheduled");
  });

  it("is published when the date is in the past or exactly now", () => {
    expect(articleStatus(past, now)).toBe("published");
    expect(articleStatus(now, now)).toBe("published");
  });
});

describe("publishedNow", () => {
  it("filters on a publication date not later than now (which also excludes drafts)", () => {
    expect(publishedNow(now)).toEqual({ publishedAt: { lte: now } });
  });
});

describe("shouldShowUpdatedDate", () => {
  it("hides the update date for a quick edit right after publication", () => {
    expect(shouldShowUpdatedDate(past, new Date(past.getTime() + 60 * 60 * 1000))).toBe(false);
  });

  it("shows it once at least 24 hours separate publication and last update", () => {
    expect(shouldShowUpdatedDate(past, new Date(past.getTime() + 24 * 60 * 60 * 1000))).toBe(true);
    expect(shouldShowUpdatedDate(past, new Date(past.getTime() + 5 * 24 * 60 * 60 * 1000))).toBe(true);
  });

  it("never shows it for an unpublished article", () => {
    expect(shouldShowUpdatedDate(null, now)).toBe(false);
  });
});

describe("resolvePublishedAt", () => {
  it("clears the date for a draft", () => {
    expect(resolvePublishedAt({ mode: "draft" }, past, now)).toBeNull();
  });

  it("publishes a draft or a scheduled article at the current server time", () => {
    expect(resolvePublishedAt({ mode: "now" }, null, now)).toEqual(now);
    expect(resolvePublishedAt({ mode: "now" }, future, now)).toEqual(now);
  });

  it("keeps the original date of an article that is already published", () => {
    expect(resolvePublishedAt({ mode: "now" }, past, now)).toEqual(past);
  });

  it("uses the requested date when scheduling", () => {
    expect(resolvePublishedAt({ mode: "scheduled", at: "2026-10-01T08:00:00Z" }, null, now)).toEqual(future);
  });
});
