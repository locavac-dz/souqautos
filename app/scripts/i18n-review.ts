// Lot 128 — prépare la relecture des textes arabes par un locuteur natif.
//
//   npm run i18n:review
//
// Écrit dans review-arabe/ (ignoré par git : fichiers dérivés, à régénérer) :
//   - revue-arabe.html : lecture confortable, français et arabe côte à côte, filtre de recherche ;
//   - revue-arabe.csv  : à ouvrir dans Excel, avec deux colonnes vides (« Correction », « Commentaire »)
//                        à remplir, puis à renvoyer.
//
// L'outil ne juge pas la qualité de la traduction : il met le relecteur en face de CHAQUE texte, dans
// l'ordre de ce que voient le plus les visiteurs, et lui montre les endroits où la terminologie hésite.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { flattenMessages, messageArguments, termUsage, type Messages } from "../src/lib/i18n-audit";

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "review-arabe");
const read = (file: string): Messages => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));
const fr = flattenMessages(read("messages/fr.json"));
const ar = flattenMessages(read("messages/ar.json"));

// Ordre de relecture : ce que voient tous les visiteurs d'abord, l'équipe en dernier.
const PUBLIC_FIRST = [
  "Brand", "Nav", "Footer", "Home", "Auth", "Search", "Listing", "Wizard", "Messages", "Favorites", "Alerts", "Dashboard", "MyListings",
  "ProfileEdit", "ListingEdit", "Estimate", "PriceBadge", "Compare", "AiAdvisor", "Catalogue", "Status", "Contact", "Notifications",
  "PushNotifications", "Pwa", "Verification", "TrustScore", "Report", "Review", "OwnerReview", "RoadTest", "Guide", "Blog", "PressReview",
  "ProDirectory", "ProLanding", "Pro", "ProStats", "ProProspects", "BulkImport",
];
const LEGAL = ["Legal", "Privacy", "Terms"];
const isStaff = (ns: string) => ns.startsWith("Admin") || ns === "Audience";

const namespaces = [...new Set(Object.keys(fr).map((k) => k.split(".")[0]))];
const rank = (ns: string) => {
  const i = PUBLIC_FIRST.indexOf(ns);
  if (i >= 0) return i;
  if (LEGAL.includes(ns)) return 1000 + LEGAL.indexOf(ns);
  if (isStaff(ns)) return 3000;
  return 2000;
};
namespaces.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const audience = (ns: string) => (LEGAL.includes(ns) ? "juridique (à faire valider par un juriste arabophone)" : isStaff(ns) ? "équipe seulement" : "tous les visiteurs");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const csv = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;

// Ce que le relecteur doit savoir d'un message : les {variables} à conserver telles quelles.
const variablesOf = (message: string) => (messageArguments(message) ?? []).map((v) => (v.startsWith("<") ? v : `{${v}}`));

const usage = termUsage(ar);
const totals = { messages: Object.keys(fr).length, sections: namespaces.length };

let html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Relecture des textes arabes — Souq Autos</title>
<style>
body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:24px auto;max-width:1100px;padding:0 16px;color:#1e293b}
h1{font-size:22px}h2{font-size:17px;margin:28px 0 4px;padding-top:12px;border-top:2px solid #e2e8f0}
.meta{color:#64748b;font-size:13px}.note{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;font-size:14px}
table{border-collapse:collapse;width:100%;margin-top:8px}td,th{border:1px solid #e2e8f0;padding:6px 8px;vertical-align:top;font-size:14px}
th{background:#f1f5f9;text-align:start}td.ar{direction:rtl;text-align:right;font-size:17px;line-height:1.7;width:38%}td.fr{width:34%}
td.key{font:11px ui-monospace,Consolas,monospace;color:#64748b;width:16%;word-break:break-all}td.var{font-size:12px;color:#b45309;width:12%}
input{width:100%;padding:8px;font-size:15px;margin:8px 0}.hidden{display:none}
.terms td{font-size:14px}.terms td.ar{font-size:16px;width:auto}
</style></head><body>
<h1>Relecture des textes arabes de Souq Autos</h1>
<p class="meta">${totals.messages} textes en ${totals.sections} sections. Généré par <code>npm run i18n:review</code>.</p>
<div class="note"><strong>Ce qu'on vous demande.</strong> Pour chaque ligne : le texte français est la référence, la colonne arabe est le texte actuel du site.
Dites si l'arabe est <em>juste</em> (sens fidèle), <em>naturel</em> (une personne l'écrirait ainsi) et <em>cohérent</em> avec les autres écrans (mêmes mots pour les mêmes notions).
Corrigez de préférence dans le fichier <strong>revue-arabe.csv</strong> (colonnes « Correction » et « Commentaire »).
<br>Les <span style="color:#b45309">{mots entre accolades}</span> sont remplacés par le site (un prix, un nom…) : ils doivent rester <strong>tels quels</strong>, à la bonne place dans la phrase.
Les sections marquées « juridique » (mentions légales, confidentialité, conditions) demandent en plus la validation d'un juriste arabophone.
Les sections « équipe seulement » ne sont vues que par l'équipe : à relire en dernier.</div>
<h2>Terminologie : où l'on hésite peut-être</h2>
<p class="meta">Nombre de textes contenant chaque variante arabe d'une même notion. Plusieurs variantes ne sont pas forcément une erreur : c'est à vous d'en juger.</p>
<table class="terms"><tr><th>Notion (français)</th><th>Variantes arabes rencontrées (nombre de textes)</th></tr>
${usage.map((u) => `<tr><td>${esc(u.concept)}</td><td class="ar">${u.counts.map((c) => `${esc(c.variant)} (${c.count})`).join(" &nbsp;·&nbsp; ")}</td></tr>`).join("\n")}
</table>
<input id="q" type="search" placeholder="Filtrer (français, arabe ou clé)…" oninput="const v=this.value.toLowerCase();document.querySelectorAll('tr[data-t]').forEach(r=>r.classList.toggle('hidden',v&&!r.dataset.t.includes(v)))">
`;
let csvText = "﻿" + ["Section", "Public", "Clé", "Français (référence)", "Arabe actuel", "Variables à conserver", "Correction", "Commentaire"].map(csv).join(";") + "\r\n";

for (const ns of namespaces) {
  const keys = Object.keys(fr).filter((k) => k.startsWith(ns + "."));
  html += `<h2>${esc(ns)} <span class="meta">— ${keys.length} textes · vus par : ${esc(audience(ns))}</span></h2><table><tr><th>Clé</th><th>Français</th><th>Arabe</th><th>Variables</th></tr>\n`;
  for (const key of keys) {
    const vars = variablesOf(fr[key]).join(" ");
    html += `<tr data-t="${esc((key + " " + fr[key] + " " + ar[key]).toLowerCase())}"><td class="key">${esc(key)}</td><td class="fr">${esc(fr[key])}</td><td class="ar">${esc(ar[key])}</td><td class="var">${esc(vars)}</td></tr>\n`;
    csvText += [ns, audience(ns), key, fr[key], ar[key], vars, "", ""].map(csv).join(";") + "\r\n";
  }
  html += "</table>\n";
}
html += "</body></html>\n";

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, "revue-arabe.html"), html, "utf8");
writeFileSync(path.join(OUT, "revue-arabe.csv"), csvText, "utf8");
console.log(`${totals.messages} textes, ${totals.sections} sections → ${path.relative(process.cwd(), OUT)}${path.sep}revue-arabe.html et .csv`);
console.log("Terminologie (nombre de textes par variante) :");
for (const u of usage) console.log(`  ${u.concept.padEnd(24)} ${u.counts.map((c) => `${c.variant}:${c.count}`).join("  ")}`);
