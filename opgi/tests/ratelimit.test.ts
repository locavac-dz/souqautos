// Tests unitaires du limiteur de débit (horloge injectée, déterministe).
import { describe, it, expect } from "vitest";
import { createRateLimiter } from "@/lib/http/ratelimit.js";

describe("createRateLimiter", () => {
  it("autorise jusqu'à max, puis refuse dans la fenêtre", () => {
    let t = 0;
    const rl = createRateLimiter(2, 1000, () => t);
    expect(rl.check("a")).toBe(true);
    expect(rl.check("a")).toBe(true);
    expect(rl.check("a")).toBe(false);
  });

  it("réautorise après expiration de la fenêtre", () => {
    let t = 0;
    const rl = createRateLimiter(1, 1000, () => t);
    expect(rl.check("a")).toBe(true);
    expect(rl.check("a")).toBe(false);
    t = 1001;
    expect(rl.check("a")).toBe(true);
  });

  it("compte chaque clé indépendamment", () => {
    let t = 0;
    const rl = createRateLimiter(1, 1000, () => t);
    expect(rl.check("a")).toBe(true);
    expect(rl.check("b")).toBe(true);
    expect(rl.check("a")).toBe(false);
  });
});
