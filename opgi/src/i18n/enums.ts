// Libellés traduits des valeurs d'énumération (statuts, types, catégories…).
// Pur et testable : repli SYSTÉMATIQUE sur la valeur brute si aucun libellé n'est
// défini (une nouvelle valeur d'enum ne casse donc jamais l'affichage).
//
// Les dictionnaires proviennent de la section `enums` des messages (fr/ar),
// déjà fusionnés avec repli FR par `src/i18n/request.ts`.
export type DictEnums = Record<string, Record<string, string>> | undefined;

/** Groupe d'enum → correspond aux clés de la section `enums` des messages. */
export type GroupeEnum =
  | "typeBien"
  | "etatOccupation"
  | "typeOccupant"
  | "statutContrat"
  | "modePaiement"
  | "typeActionRecouvrement"
  | "categorieReclamation"
  | "urgenceReclamation"
  | "statutReclamation"
  | "canalReclamation"
  | "affectationType"
  | "statutOrdreTravail"
  | "statutProjet"
  | "statutMarche"
  | "statutSituation"
  | "typeReception"
  | "resultatAudit"
  | "role";

/** Renvoie le libellé traduit d'une valeur d'enum, ou la valeur brute en repli. */
export function libelleEnum(
  enums: DictEnums,
  groupe: GroupeEnum,
  valeur: string | null | undefined,
): string {
  if (valeur == null || valeur === "") return "—";
  return enums?.[groupe]?.[valeur] ?? valeur;
}
