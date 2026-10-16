import { describe, it, expect } from "vitest";
import { isSameOriginRequest } from "@/lib/http/csrf.js";

function req(method: string, headers: Record<string, string>): Request {
  return new Request("http://localhost:5184/api/x", { method, headers });
}

describe("vérification CSRF par l'origine", () => {
  it("laisse passer les méthodes sûres", () => {
    expect(isSameOriginRequest(req("GET", {}))).toBe(true);
  });

  it("accepte une requête mutante dont l'origine correspond à l'hôte", () => {
    expect(
      isSameOriginRequest(req("POST", { origin: "http://localhost:5184", host: "localhost:5184" })),
    ).toBe(true);
  });

  it("refuse une origine différente de l'hôte (CSRF)", () => {
    expect(
      isSameOriginRequest(req("POST", { origin: "http://evil.example", host: "localhost:5184" })),
    ).toBe(false);
  });

  it("refuse une requête mutante sans origine", () => {
    expect(isSameOriginRequest(req("POST", { host: "localhost:5184" }))).toBe(false);
  });
});
