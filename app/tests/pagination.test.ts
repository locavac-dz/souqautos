import { describe, expect, it } from "vitest";
import { pageWindow } from "@/lib/pagination";

describe("pageWindow", () => {
  it("computes the page count and the database offset", () => {
    expect(pageWindow(25, 2, 12)).toEqual({ page: 2, totalPages: 3, skip: 12 });
  });

  it("defaults to the first page", () => {
    expect(pageWindow(25, undefined, 12)).toEqual({ page: 1, totalPages: 3, skip: 0 });
  });

  it("brings a page beyond the last back to the last one", () => {
    expect(pageWindow(25, 99, 12)).toEqual({ page: 3, totalPages: 3, skip: 24 });
  });

  it("brings a page below 1 to the first one", () => {
    expect(pageWindow(25, 0, 12).page).toBe(1);
  });

  it("still reports one page when there is nothing to list", () => {
    expect(pageWindow(0, undefined, 12)).toEqual({ page: 1, totalPages: 1, skip: 0 });
  });
});
