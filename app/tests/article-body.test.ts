import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArticleBody } from "@/components/ArticleBody";

function render(content: string): string {
  return renderToStaticMarkup(createElement(ArticleBody, { content }));
}

describe("ArticleBody — mise en forme", () => {
  it("renders headings, emphasis and lists", () => {
    const html = render("## Le moteur\n\nUn **bon** moteur, *sobre*.\n\n- Souple\n- Économe\n\n1. Un\n2. Deux");
    expect(html).toContain("<h2");
    expect(html).toContain(">Le moteur</h2>");
    expect(html).toContain("<strong>bon</strong>");
    expect(html).toContain("<em>sobre</em>");
    expect(html).toContain("<ul");
    expect(html).toContain("<ol");
    expect(html.match(/<li>/g)).toHaveLength(4);
  });

  it("keeps paragraphs separated by a blank line", () => {
    const html = render("Premier paragraphe.\n\nSecond paragraphe.");
    expect(html.match(/<p>/g)).toHaveLength(2);
  });

  it("brings a level-1 heading down to level 2 (the page already has its one h1)", () => {
    const html = render("# Titre\n\n#### Détail");
    expect(html).not.toContain("<h1");
    expect(html).toContain(">Titre</h2>");
    expect(html).toContain(">Détail</h3>");
  });
});

describe("ArticleBody — contenu hostile", () => {
  it("drops raw HTML instead of running it", () => {
    const html = render('Avant\n\n<script>alert(1)</script>\n\n<iframe src="https://evil.example"></iframe>\n\nAprès');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<iframe");
    expect(html).toContain("Avant");
    expect(html).toContain("Après");
  });

  it("neutralises a javascript: link (the text stays, the address does not)", () => {
    const html = render("[cliquez ici](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<a");
    expect(html).toContain("cliquez ici");
  });

  it("neutralises other non-web protocols", () => {
    const html = render("[a](data:text/html;base64,PHNjcmlwdD4=) [b](vbscript:msgbox)");
    expect(html).not.toContain("data:");
    expect(html).not.toContain("vbscript:");
  });

  it("removes images (an essai's only image is its cover)", () => {
    const html = render("![tracker](https://evil.example/pixel.gif)\n\nTexte");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("evil.example");
    expect(html).toContain("Texte");
    expect(html.match(/<p>/g)).toHaveLength(1); // pas de paragraphe vide à la place de l'image
  });

  it("opens external links safely and leaves internal links as they are", () => {
    const html = render("[site](https://example.org) et [modèles](/fr/voitures)");
    expect(html).toContain('href="https://example.org"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain('href="/fr/voitures"');
    expect(html.match(/target="_blank"/g)).toHaveLength(1);
  });
});
