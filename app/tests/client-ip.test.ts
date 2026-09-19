import { describe, expect, it } from "vitest";
import { parseTrustedProxyHops, pickClientIp } from "@/lib/client-ip";

describe("parseTrustedProxyHops", () => {
  it("accepts whole numbers from 1 to 5", () => {
    expect(parseTrustedProxyHops("1")).toBe(1);
    expect(parseTrustedProxyHops(" 2 ")).toBe(2);
    expect(parseTrustedProxyHops("5")).toBe(5);
  });

  it("treats absent or invalid values as not configured", () => {
    for (const raw of [undefined, "", "0", "6", "-1", "1.5", "abc", "1e2"]) {
      expect(parseTrustedProxyHops(raw)).toBeNull();
    }
  });
});

describe("pickClientIp", () => {
  it("keeps the legacy behaviour (first value) when no trusted proxy count is configured", () => {
    expect(pickClientIp("203.0.113.5, 70.41.3.18", null)).toBe("203.0.113.5");
  });

  it("with one trusted proxy, takes the address that proxy saw: the last value", () => {
    expect(pickClientIp("203.0.113.5", 1)).toBe("203.0.113.5");
    expect(pickClientIp("198.51.100.7, 203.0.113.5", 1)).toBe("203.0.113.5");
  });

  it("ignores what a client wrote on the left of the trusted proxy's own entry", () => {
    // le client envoie lui-même un faux « 1.2.3.4 » ; nginx (1 saut) ajoute la vraie adresse à droite
    expect(pickClientIp("1.2.3.4, 203.0.113.5", 1)).toBe("203.0.113.5");
    // même chose avec un CDN puis nginx (2 sauts) : « client réel, adresse du CDN »
    expect(pickClientIp("6.6.6.6, 203.0.113.5, 172.16.0.9", 2)).toBe("203.0.113.5");
  });

  it("cannot be steered by changing the spoofed part: the result depends only on the right-hand entries", () => {
    const a = pickClientIp("1.1.1.1, 203.0.113.5", 1);
    const b = pickClientIp("9.9.9.9, 8.8.8.8, 203.0.113.5", 1);
    expect(a).toBe(b);
  });

  it("falls back to the right-most value when the chain is shorter than expected", () => {
    expect(pickClientIp("203.0.113.5", 3)).toBe("203.0.113.5");
    expect(pickClientIp("6.6.6.6, 203.0.113.5", 3)).toBe("203.0.113.5");
  });

  it("returns « local » when the header is missing or empty", () => {
    for (const value of [null, undefined, "", " , "]) {
      expect(pickClientIp(value, 1)).toBe("local");
      expect(pickClientIp(value, null)).toBe("local");
    }
  });
});
