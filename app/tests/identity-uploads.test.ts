import path from "node:path";
import { describe, expect, it } from "vitest";
import { identityDocumentAbsolutePath } from "@/lib/identity-uploads";

describe("identityDocumentAbsolutePath", () => {
  it("joins the filename under private-uploads/identity, never under /public", () => {
    const result = identityDocumentAbsolutePath("abc123.jpg");
    expect(result).toBe(path.join(process.cwd(), "private-uploads", "identity", "abc123.jpg"));
    expect(result).not.toContain(path.join("public"));
  });

  it("works the same way for a PDF filename", () => {
    const result = identityDocumentAbsolutePath("abc123.pdf");
    expect(result.endsWith(path.join("private-uploads", "identity", "abc123.pdf"))).toBe(true);
  });
});
