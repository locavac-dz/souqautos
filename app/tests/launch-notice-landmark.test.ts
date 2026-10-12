import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fr from "../messages/fr.json";
import ar from "../messages/ar.json";

// L'audit d'accessibilité e2e (axe-core, règle « region ») exige que le contenu de chaque page soit dans un repère :
// le bandeau du lancement doit donc être un <aside> nommé, pas un <div> nu.

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => `[${key}]` }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as string),
}));

import { LaunchNoticeContent } from "@/components/LaunchNoticeBanner";

describe("bandeau du lancement — repère d'accessibilité", () => {
  const html = renderToStaticMarkup(createElement(LaunchNoticeContent, { onDismiss: () => undefined }));

  it("est un <aside> nommé, donc un repère reconnu par les lecteurs d'écran", () => {
    expect(html.startsWith("<aside")).toBe(true);
    expect(html).toContain('aria-label="[ariaLabel]"');
  });

  it("garde le message, le lien de signalement et le bouton de fermeture", () => {
    expect(html).toContain("[message]");
    expect(html).toContain('href="/contact"');
    expect(html).toContain('aria-label="[close]"');
  });

  it("a un nom accessible en français et en arabe", () => {
    expect(fr.LaunchNotice.ariaLabel.trim()).not.toBe("");
    expect(ar.LaunchNotice.ariaLabel.trim()).not.toBe("");
  });
});
