import { describe, expect, it } from "vitest";
import { errorFingerprint } from "@/lib/error-log";

describe("errorFingerprint", () => {
  it("produces a 16-char hex string", () => {
    const fp = errorFingerprint("server", "/api/test", "Something went wrong");
    expect(fp).toMatch(/^[0-9a-z]{13,16}$/);
  });

  it("is stable for the same inputs", () => {
    const a = errorFingerprint("server", "/api/test", "Error A");
    const b = errorFingerprint("server", "/api/test", "Error A");
    expect(a).toBe(b);
  });

  it("differs when kind changes", () => {
    const server = errorFingerprint("server", "/api/test", "Error");
    const client = errorFingerprint("client", "/api/test", "Error");
    expect(server).not.toBe(client);
  });

  it("differs when route changes", () => {
    const a = errorFingerprint("server", "/api/a", "Error");
    const b = errorFingerprint("server", "/api/b", "Error");
    expect(a).not.toBe(b);
  });

  it("uses only the first line of the message", () => {
    const short = errorFingerprint("server", "/api/test", "Error line 1");
    const multi = errorFingerprint("server", "/api/test", "Error line 1\nstack trace line 2\nline 3");
    expect(short).toBe(multi);
  });

  it("handles null/undefined route", () => {
    const a = errorFingerprint("server", null, "Error");
    const b = errorFingerprint("server", undefined, "Error");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-z]{13,16}$/);
  });

  it("handles empty message", () => {
    const fp = errorFingerprint("server", "/test", "");
    expect(fp).toMatch(/^[0-9a-z]{13,16}$/);
  });

  it("handles message with only empty lines", () => {
    const fp = errorFingerprint("server", "/test", "\n\n\n");
    expect(fp).toMatch(/^[0-9a-z]{13,16}$/);
  });
});
