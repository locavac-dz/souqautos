import { algiersDayKey } from "@/lib/pro-stats";

// Lot 127 — suivi du rythme éditorial : logique pure, testée sans base.

export const EDITORIAL_SECTIONS = ["press", "roadTests", "magazine", "guides", "equipment"] as const;
export type EditorialSection = (typeof EDITORIAL_SECTIONS)[number];

// Objectif de cadence : un nouveau contenu au moins tous les N jours. Valeurs par défaut choisies
// d'après ce que l'équipe éditoriale s'est fixé (une revue de presse « renouvelée chaque semaine »,
// « quelques essais originaux ») ; à ajuster ici si le rythme réel de la rédaction est autre. Ce
// ne sont que des repères d'affichage : rien n'est bloqué ni envoyé.
export const TARGET_DAYS: Record<EditorialSection, number> = {
  press: 7,
  roadTests: 30,
  magazine: 30,
  guides: 60,
  equipment: 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Nombre de JOURS CALENDAIRES (heure d'Algérie) entre `date` et `now` : 0 le même jour, 1 pour hier,
// même si la publication date de quelques heures seulement (publiée hier à 23 h 30, elle s'affiche « hier »
// à côté de la date d'hier, jamais « aujourd'hui »). Jamais négatif : une date future vaut 0.
export function daysSince(date: Date, now: Date): number {
  const days = (Date.parse(algiersDayKey(now)) - Date.parse(algiersDayKey(date))) / DAY_MS;
  return Math.max(0, days);
}

export type Freshness =
  | { status: "empty" } // rien n'a jamais été publié
  | { status: "ok"; daysSince: number }
  | { status: "late"; daysSince: number; overdueBy: number };

// Une rubrique est « à jour » si sa dernière publication date d'au plus `targetDays` jours.
export function freshness(lastPublishedAt: Date | null, targetDays: number, now: Date): Freshness {
  if (!lastPublishedAt) return { status: "empty" };
  const elapsed = daysSince(lastPublishedAt, now);
  return elapsed <= targetDays ? { status: "ok", daysSince: elapsed } : { status: "late", daysSince: elapsed, overdueBy: elapsed - targetDays };
}

// Un brouillon qu'on n'a pas touché depuis 14 jours est probablement oublié.
export const STALE_DRAFT_DAYS = 14;

export function isStaleDraft(updatedAt: Date, now: Date): boolean {
  return daysSince(updatedAt, now) >= STALE_DRAFT_DAYS;
}

// Nombre de semaines affichées sur la courbe de publication.
export const RHYTHM_WEEKS = 12;

export type ModelCoverage = {
  modelId: number;
  brandName: string;
  modelName: string;
  brandSlug: string;
  modelSlug: string;
  listings: number; // annonces publiées de ce modèle
  views: number; // pages vues de la page du modèle sur la période
  guides: number; // guides parus
  roadTests: number; // essais parus
  pressReviews: number; // revues de presse parues
};

// Modèles qui méritent un guide : ceux qui n'en ont pas, d'abord les plus présents sur le site
// (annonces publiées), puis les plus consultés, puis par nom pour un ordre stable.
export function modelsWithoutGuide(models: ModelCoverage[]): ModelCoverage[] {
  return models
    .filter((m) => m.guides === 0)
    .sort(
      (a, b) =>
        b.listings - a.listings ||
        b.views - a.views ||
        `${a.brandName} ${a.modelName}`.localeCompare(`${b.brandName} ${b.modelName}`)
    );
}

// Part des modèles présents sur le site (au moins une annonce) qui ont un guide paru, en % arrondi ;
// `null` quand aucun modèle n'est présent (un pourcentage n'aurait aucun sens).
export function coveragePercent(withGuide: number, onSite: number): number | null {
  if (onSite <= 0) return null;
  return Math.round((Math.min(withGuide, onSite) / onSite) * 100);
}

// « ?modele= » de l'adresse du formulaire de guide : un entier positif, sinon rien.
export function parseModelParam(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}
