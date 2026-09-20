import { afterEach, describe, expect, it, vi } from "vitest";

const reportServerError = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/server-error-alerts", () => ({ reportServerError: (...args: unknown[]) => reportServerError(...args) }));

import { onRequestError } from "@/instrumentation";

// Lot 136 — src/instrumentation.ts : Next.js appelle onRequestError à chaque erreur du serveur ; il doit passer la main au
// module d'alertes (Node.js seulement), sans jamais attendre ni lever d'exception vers Next.js.
const request = { path: "/fr/x", method: "GET", headers: {} };
const context = { routerKind: "App Router", routePath: "/x", routeType: "render", renderSource: "react-server-components", revalidateReason: undefined, renderType: "dynamic" } as const;

afterEach(() => {
  vi.unstubAllEnvs();
  reportServerError.mockClear();
});

describe("onRequestError", () => {
  it("transmet l'erreur, la requête et le contexte au module d'alertes sous Node.js", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const error = new Error("boom");
    const result = onRequestError(error, request, context);
    expect(result).toBeUndefined(); // ne renvoie pas de promesse : Next.js n'attend pas l'envoi
    await vi.waitFor(() => expect(reportServerError).toHaveBeenCalledWith(error, request, context));
  });

  it("ne fait rien hors de Node.js (runtime « edge » : pas de base de limites ni de courriel)", async () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");
    onRequestError(new Error("boom"), request, context);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(reportServerError).not.toHaveBeenCalled();
  });
});
