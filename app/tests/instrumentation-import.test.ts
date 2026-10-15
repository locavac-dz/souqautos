import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// `/* webpackIgnore: true */` laisse l'import() tel quel dans le code compilé : Node l'exécute alors avec le
// spécificateur « @/lib/… », qui n'existe pas hors de webpack (alias de tsconfig) → ERR_MODULE_NOT_FOUND
// « Cannot find package '@/lib' » en unhandledRejection, et l'alerte d'erreur serveur (lot 136) n'est jamais envoyée.
// Constaté en CI (journal du serveur de test) ; introduit par le lot 295.
const read = (file: string) => readFileSync(join(__dirname, "..", "src", file), "utf8");

describe("instrumentation.ts", () => {
  it("importe le module d'alertes par l'alias, résolu par webpack (pas de webpackIgnore)", () => {
    const source = read("instrumentation.ts");
    expect(source).toMatch(/import\(\s*"@\/lib\/server-error-alerts"\s*\)/);
    // L'annotation elle-même (le mot figure légitimement dans les commentaires qui expliquent pourquoi elle est bannie).
    expect(source).not.toMatch(/\/\*\s*webpackIgnore\s*:/);
  });

  it("garde l'import DANS un bloc « if (NEXT_RUNTIME === \"nodejs\") », que webpack supprime du bundle edge", () => {
    // Un retour anticipé (`!== "nodejs"` puis `return`) laisse l'import compilé pour l'edge : node:crypto y est introuvable
    // et le serveur de développement ne démarre plus (constaté en CI, PR n° 13, premier essai).
    const source = read("instrumentation.ts");
    expect(source).toMatch(/if\s*\(\s*process\.env\.NEXT_RUNTIME\s*===\s*"nodejs"\s*\)\s*\{[^}]*import\(\s*"@\/lib\/server-error-alerts"\s*\)[^}]*\}/);
  });

  it("aucun fichier de src n'ignore webpack pour importer un module par alias « @/ »", () => {
    // Un import ignoré par webpack doit être un vrai spécificateur Node (paquet, chemin relatif résolu à l'exécution).
    const files = ["instrumentation.ts", "lib/api-route.ts"];
    for (const file of files) {
      expect(read(file), file).not.toMatch(/webpackIgnore:\s*true\s*\*\/\s*"@\//);
    }
  });
});
