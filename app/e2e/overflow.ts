import type { Page } from "@playwright/test";

// Diagnostic d'un défilement horizontal : nomme les éléments qui sortent de la fenêtre, pour qu'un échec de la CI
// indique la cause (au lieu d'un simple « déborde de 4px »). On ne garde que les éléments les plus profonds : le
// conteneur qui les englobe déborde forcément aussi, mais ce n'est pas lui le fautif.
export async function overflowCulprits(page: Page, limit = 6): Promise<string> {
  return page.evaluate((max) => {
    // Origine du défilement (le bord droit en arabe) : sinon les positions mesurées sont décalées de ce qui a défilé.
    window.scrollTo(0, 0);
    const viewport = document.documentElement.clientWidth;
    const offending = new Set<Element>();
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      const style = getComputedStyle(element);
      if (style.position === "fixed" || style.display === "none" || style.visibility === "hidden") continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 1 || rect.height === 0) continue; // sr-only, lien d'évitement…
      if (rect.right > viewport + 0.5 || rect.left < -0.5) offending.add(element);
    }
    const overshoot = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return Math.max(rect.right - viewport, -rect.left);
    };
    const leaves = Array.from(offending)
      .filter((element) => !Array.from(offending).some((other) => other !== element && element.contains(other)))
      .sort((a, b) => overshoot(b) - overshoot(a)); // le pire d'abord
    return leaves
      .slice(0, max)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const className = String((element as HTMLElement).className?.toString?.() ?? "").replace(/\s+/g, " ").slice(0, 90);
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
        return `<${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""} class="${className}"> dépasse de ${Math.round(overshoot(element))}px (largeur ${Math.round(rect.width)}px, de ${Math.round(rect.left)} à ${Math.round(rect.right)} sur ${viewport}px), « ${text} »`;
      })
      .join(" ; ");
  }, limit);
}
