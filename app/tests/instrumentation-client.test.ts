import { describe, expect, it } from "vitest";
import { z } from "zod";

// Lot 134 — src/instrumentation-client.ts règle zod en mode « sans compilation dynamique » dans le navigateur, pour que
// la sonde `Function("")` de zod ne déclenche plus, à chaque page vue, une violation de la politique de sécurité
// (pas de 'unsafe-eval' en production). Le réglage est global à la page : ce test vérifie qu'il est bien posé, et que
// les schémas continuent de valider correctement en mode interprété.
describe("instrumentation-client (navigateur)", () => {
  it("met zod en mode jitless", async () => {
    expect(z.config().jitless).not.toBe(true); // avant : mode normal (le serveur garde sa compilation)
    await import("../src/instrumentation-client");
    expect(z.config().jitless).toBe(true);
  });

  it("les schémas valident et refusent exactement comme avant en mode interprété", async () => {
    await import("../src/instrumentation-client");
    const schema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), age: z.number().int().min(18), tags: z.array(z.string()).max(2) });

    expect(schema.parse({ email: "  Amina@Example.DZ ", age: 30, tags: ["a"] })).toEqual({ email: "amina@example.dz", age: 30, tags: ["a"] });
    expect(schema.safeParse({ email: "pas-un-email", age: 30, tags: [] }).success).toBe(false);
    expect(schema.safeParse({ email: "a@b.dz", age: 17, tags: [] }).success).toBe(false);
    expect(schema.safeParse({ email: "a@b.dz", age: 30, tags: ["a", "b", "c"] }).success).toBe(false);
    expect(schema.safeParse({ email: "a@b.dz", age: 30 }).success).toBe(false);
  });
});
