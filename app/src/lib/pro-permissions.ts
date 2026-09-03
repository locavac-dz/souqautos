// Lot 42 — permissions de collaborateur plus fines : remplace le rôle
// binaire GESTIONNAIRE/LECTURE_SEULE (Lot 13) par un JSON libre, une capacité
// par action réellement contrôlée dans l'app plutôt qu'un seul bloc
// tout-ou-rien. N'ajoute que les capacités qui existaient déjà (gestion des
// annonces = import de masse Lot 41, réponse aux avis Lot 27) — la gestion
// des collaborateurs elle-même reste toujours réservée au propriétaire, cf.
// canManageCollaborators dans pro-account.ts, jamais déléguable.
export type ProPermissions = {
  gererAnnonces: boolean;
  repondreAvis: boolean;
};

export const DEFAULT_PRO_PERMISSIONS: ProPermissions = {
  gererAnnonces: false,
  repondreAvis: false,
};

export function serializeProPermissions(permissions: ProPermissions): string {
  return JSON.stringify(permissions);
}

// Ne fait jamais confiance à la forme du JSON stocké (schéma qui pourrait
// évoluer, valeur corrompue) — chaque champ est explicitement coercé en
// booléen, avec repli sur "aucune permission" si le JSON est invalide.
export function parseProPermissions(raw: string): ProPermissions {
  try {
    const parsed = JSON.parse(raw);
    return {
      gererAnnonces: Boolean(parsed?.gererAnnonces),
      repondreAvis: Boolean(parsed?.repondreAvis),
    };
  } catch {
    return DEFAULT_PRO_PERMISSIONS;
  }
}
