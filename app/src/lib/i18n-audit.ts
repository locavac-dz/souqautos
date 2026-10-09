import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";

// Lot 128 — contrôle de cohérence des textes français / arabes : logique pure, sans accès aux fichiers
// (les tests et le script `npm run i18n:check` lui fournissent le contenu). Elle ne juge PAS la qualité
// de la traduction — seul un locuteur natif le peut — mais détecte tout ce qu'une machine peut prouver
// faux : clé manquante d'un côté, variable oubliée, syntaxe de pluriel cassée, clé utilisée par le code
// mais absente des fichiers.

export type Messages = { [key: string]: string | Messages };

// { "Nav": { "home": "Accueil" } } → { "Nav.home": "Accueil" }
export function flattenMessages(messages: Messages, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [key, value] of Object.entries(messages)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[full] = value;
    else flattenMessages(value, full, out);
  }
  return out;
}

// Noms de variables et de balises d'un message, y compris celles qui sont DANS une branche de pluriel ou
// de sélection : « {count, plural, one {{name} a un}} » → ["count", "name"]. `null` si la syntaxe est invalide.
export function messageArguments(message: string): string[] | null {
  let ast: MessageFormatElement[];
  try {
    ast = parse(message);
  } catch {
    return null;
  }
  const names = new Set<string>();
  const walk = (elements: MessageFormatElement[]) => {
    for (const el of elements) {
      switch (el.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          names.add(el.value);
          break;
        case TYPE.select:
        case TYPE.plural:
          names.add(el.value);
          for (const option of Object.values(el.options)) walk(option.value);
          break;
        case TYPE.tag:
          names.add(`<${el.value}>`);
          walk(el.children);
          break;
        default:
          break;
      }
    }
  };
  walk(ast);
  return [...names].sort();
}

// Message d'erreur de syntaxe (accolade non fermée, pluriel sans « other »…), ou null s'il est valide.
export function messageSyntaxError(message: string): string | null {
  try {
    parse(message);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

export type LocaleComparison = {
  onlyInFirst: string[];
  onlyInSecond: string[];
  argumentMismatches: { key: string; first: string[]; second: string[] }[];
  syntaxErrors: { locale: "first" | "second"; key: string; error: string }[];
  empty: { locale: "first" | "second"; key: string }[];
};

// Compare deux langues clé par clé.
export function compareLocales(first: Record<string, string>, second: Record<string, string>): LocaleComparison {
  const result: LocaleComparison = { onlyInFirst: [], onlyInSecond: [], argumentMismatches: [], syntaxErrors: [], empty: [] };
  for (const key of Object.keys(first)) if (!(key in second)) result.onlyInFirst.push(key);
  for (const key of Object.keys(second)) if (!(key in first)) result.onlyInSecond.push(key);

  for (const [locale, messages] of [["first", first], ["second", second]] as const) {
    for (const [key, message] of Object.entries(messages)) {
      if (message.trim() === "") result.empty.push({ locale, key });
      const error = messageSyntaxError(message);
      if (error) result.syntaxErrors.push({ locale, key, error });
    }
  }

  for (const key of Object.keys(first)) {
    if (!(key in second)) continue;
    const a = messageArguments(first[key]);
    const b = messageArguments(second[key]);
    if (a && b && a.join("|") !== b.join("|")) result.argumentMismatches.push({ key, first: a, second: b });
  }
  return result;
}

// --- Clés utilisées par le code -----------------------------------------------------------------------------------------------

export type CallScan = {
  checked: number; // appels à clé littérale vérifiés
  missing: string[]; // clés littérales absentes des messages
  dynamic: { key: string; matched: boolean }[]; // clés construites (`status${x}`) : y a-t-il au moins une clé correspondante ?
};

const escapeRegex = (s: string) => s.replace(/[.+?^()|[\]\\{}*$]/g, "\\$&");

// Repère, dans le code source d'UN fichier, les variables issues de useTranslations("Espace") /
// getTranslations("Espace") (ou getTranslations({ …, namespace: "Espace" })) et vérifie chaque appel
// `variable("clé")` ou `variable.rich("clé")` contre l'ensemble des clés existantes. Ne voit pas les
// traductions passées en paramètre à une autre fonction (`t={t}`) : c'est un filet, pas une preuve.
export function scanTranslationCalls(source: string, keys: ReadonlySet<string>): CallScan {
  const scan: CallScan = { checked: 0, missing: [], dynamic: [] };
  const declaration = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([\w.]+)"|\{[^}]*namespace:\s*"([\w.]+)"[^}]*\})?\s*\)/g;
  let match: RegExpExecArray | null;
  const variables: { name: string; namespace: string }[] = [];
  while ((match = declaration.exec(source))) variables.push({ name: match[1], namespace: match[2] ?? match[3] ?? "" });

  for (const { name, namespace } of variables) {
    const call = new RegExp(`\\b${name}(?:\\.rich|\\.raw|\\.markup|\\.has)?\\(\\s*(["\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, "g");
    let c: RegExpExecArray | null;
    while ((c = call.exec(source))) {
      const [, quote, key] = c;
      const full = namespace ? `${namespace}.${key}` : key;
      if (quote === "`" && key.includes("${")) {
        const pattern = new RegExp("^" + escapeRegex(full).replace(/\\\$\\\{[^}]*\\\}/g, ".+") + "$");
        scan.dynamic.push({ key: full, matched: [...keys].some((k) => pattern.test(k)) });
        continue;
      }
      scan.checked += 1;
      if (!keys.has(full)) scan.missing.push(full);
    }
  }
  return scan;
}

// Lot 269 (audit E2) — balayage INVERSE : une clé des fichiers de messages que le code ne demande jamais. Une clé est
// tenue pour utilisée si (a) un appel littéral la demande, (b) un appel calculé (`status${x}`) peut la produire, ou
// (c) son dernier segment apparaît entre guillemets quelque part dans le code (tables de correspondance du type
// `ESSENCE: "fuelEssence"`, puis `t(FUEL_KEY[x])`). Ce qui reste est orphelin — ou consommé d'une façon que ce
// balayage ne voit pas : le test tient une liste d'exceptions explicite, courte, à justifier.
export function unusedMessageKeys(messages: Record<string, string>, sources: string[]): string[] {
  const keys = new Set(Object.keys(messages));
  const literal = new Set<string>();
  const patterns: RegExp[] = [];
  const quotedSegments = new Set<string>();
  for (const source of sources) {
    const scan = scanTranslationCalls(source, keys);
    for (const key of scanLiteralKeys(source)) literal.add(key);
    for (const { key } of scan.dynamic) patterns.push(new RegExp("^" + escapeRegex(key).replace(/\\\$\\\{[^}]*\\\}/g, ".+") + "$"));
    for (const m of source.matchAll(/["'`]([A-Za-z][\w]*)["'`]/g)) quotedSegments.add(m[1]);
  }
  return [...keys].filter((key) => {
    if (literal.has(key)) return false;
    if (patterns.some((p) => p.test(key))) return false;
    const segment = key.slice(key.lastIndexOf(".") + 1);
    return !quotedSegments.has(segment);
  });
}

// Clés complètes demandées littéralement (même détection que scanTranslationCalls, sans jugement d'existence).
function scanLiteralKeys(source: string): string[] {
  const declaration = /(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:"([\w.]+)"|\{[^}]*namespace:\s*"([\w.]+)"[^}]*\})?\s*\)/g;
  const found: string[] = [];
  let match: RegExpExecArray | null;
  const variables: { name: string; namespace: string }[] = [];
  while ((match = declaration.exec(source))) variables.push({ name: match[1], namespace: match[2] ?? match[3] ?? "" });
  for (const { name, namespace } of variables) {
    const call = new RegExp(`\\b${name}(?:\\.rich|\\.raw|\\.markup|\\.has)?\\(\\s*(["\`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, "g");
    let c: RegExpExecArray | null;
    while ((c = call.exec(source))) {
      const [, quote, key] = c;
      if (quote === "`" && key.includes("${")) continue;
      found.push(namespace ? `${namespace}.${key}` : key);
    }
  }
  return found;
}

// --- Aide à la relecture ------------------------------------------------------------------------------------------------------------

// Familles de mots à harmoniser : pour chaque notion, les variantes arabes qu'on rencontre. Sert
// UNIQUEMENT à montrer au relecteur où la terminologie hésite (« سعر » ou « ثمن » ?) : ce n'est pas un
// verdict, plusieurs variantes peuvent être justes selon le contexte.
export const TERM_FAMILIES: { concept: string; variants: string[] }[] = [
  { concept: "annonce", variants: ["إعلان", "اعلان"] },
  { concept: "voiture", variants: ["سيارة", "مركبة", "عربة"] },
  { concept: "vendeur", variants: ["بائع", "البائع", "مالك"] },
  { concept: "acheteur", variants: ["مشتري", "مشترٍ"] },
  { concept: "prix", variants: ["سعر", "ثمن"] },
  { concept: "favoris", variants: ["المفضلة", "المفضّلة", "مفضلة"] },
  { concept: "alerte / notification", variants: ["تنبيه", "إشعار", "اشعار", "تنبيهات", "إشعارات"] },
  { concept: "compte", variants: ["حساب"] },
  { concept: "message", variants: ["رسالة", "رسائل"] },
  { concept: "wilaya", variants: ["ولاية", "الولاية"] },
  { concept: "kilométrage", variants: ["كم", "كيلومتر", "المسافة المقطوعة"] },
];

export function termUsage(arabicMessages: Record<string, string>): { concept: string; counts: { variant: string; count: number }[] }[] {
  const texts = Object.values(arabicMessages);
  return TERM_FAMILIES.map(({ concept, variants }) => ({
    concept,
    counts: variants.map((variant) => ({ variant, count: texts.filter((t) => t.includes(variant)).length })),
  }));
}
