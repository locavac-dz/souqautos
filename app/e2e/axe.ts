import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

// Lot 135 — audit d'accessibilité d'une page avec axe-core (le moteur de référence, celui des audits Lighthouse), selon
// les règles WCAG 2.x niveaux A et AA plus ses « bonnes pratiques » (zones de repère, ordre des titres…). Ce qu'il attrape : texte trop pâle sur son fond, image sans alternative, champ
// sans étiquette, bouton ou lien sans nom, titres mal ordonnés, identifiants en double, zones de repère manquantes…
// Ce qu'il ne peut PAS juger (parcours au clavier, qualité d'un texte alternatif) est vérifié à part, quand c'est mesurable.
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

type AxeNode = { target: string[]; html: string };
export type AxeViolation = { id: string; impact?: string; help: string; nodes: AxeNode[] };

export async function audit(page: Page): Promise<AxeViolation[]> {
  // Injecté par le navigateur de test (pas par la page) : la politique de sécurité du site interdit les scripts en ligne.
  await page.evaluate(AXE_SOURCE);
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: AxeViolation[] }> } }).axe;
    const result = await axe.run(
      // Le bandeau de l'outil de développement de Next.js n'est pas le site.
      { exclude: [["nextjs-portal"]] },
      { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }, resultTypes: ["violations"] },
    );
    return result.violations;
  });
}

export const describeViolation = (path: string, v: AxeViolation) =>
  `${path} — ${v.id} (${v.impact}) : ${v.help}\n${v.nodes.slice(0, 3).map((n) => `      ${n.target.join(" ")}  ${n.html.slice(0, 110)}`).join("\n")}${v.nodes.length > 3 ? `\n      … et ${v.nodes.length - 3} autre(s)` : ""}`;

// Audite une liste de pages et renvoie le rapport (texte vide = aucune violation). Le détail est aussi écrit dans la
// sortie : le rapport d'échec de Playwright abrège les longs textes.
export async function auditPages(page: Page, paths: string[], label: string): Promise<string> {
  const problems: string[] = [];
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const path of paths) {
    await page.goto(path, { waitUntil: "load" });
    await page.locator("h1, main").first().waitFor();
    for (const violation of await audit(page)) problems.push(describeViolation(path, violation));
  }
  if (problems.length > 0) console.log(`\n=== VIOLATIONS ${label} ===\n${problems.join("\n")}\n=== FIN ${label} ===`);
  return problems.join("\n");
}
