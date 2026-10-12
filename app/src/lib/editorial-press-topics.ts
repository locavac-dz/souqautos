export type PressReviewTopicTemplate = {
  key: string;
  promptFr: string;
};

export const PRESS_REVIEW_TEMPLATES: PressReviewTopicTemplate[] = [
  {
    key: "nouveaux-modeles",
    promptFr: "Rédige une synthèse de l'actualité automobile en Algérie sur les nouveaux modèles récemment lancés ou annoncés par les concessionnaires agréés. Couvre les marques les plus actives (Hyundai, Kia, Chery, Geely, Dacia, Renault, Peugeot), les gammes de prix constatées et ce que ça change pour l'acheteur algérien.",
  },
  {
    key: "reglementation-auto",
    promptFr: "Rédige une synthèse des évolutions réglementaires récentes liées à l'automobile en Algérie : contrôle technique, assurance, vignette, permis de conduire, importation, homologation. Explique l'impact concret pour le propriétaire ou l'acheteur.",
  },
  {
    key: "marche-occasion",
    promptFr: "Rédige une analyse des tendances du marché de l'occasion automobile en Algérie : modèles les plus recherchés, évolution des prix, segments en hausse ou en baisse, conseils pour acheter ou vendre au bon moment.",
  },
  {
    key: "electrique-hybride",
    promptFr: "Rédige un point sur l'électrification automobile en Algérie : véhicules électriques et hybrides disponibles ou annoncés, bornes de recharge, avantages fiscaux éventuels, freins à l'adoption, et comparaison avec les véhicules thermiques dans le contexte algérien.",
  },
  {
    key: "constructeurs-usines",
    promptFr: "Rédige une synthèse de l'actualité de l'industrie automobile en Algérie : projets d'usines d'assemblage (Fiat, Stellantis, constructeurs chinois), accords avec l'État, création d'emplois, et ce que cela signifie pour les prix et la disponibilité des véhicules neufs.",
  },
  {
    key: "prix-carburant-energie",
    promptFr: "Rédige un point sur les prix des carburants en Algérie (essence, diesel, GPL/Sirghaz) et leur impact sur le budget auto des ménages. Intègre les éventuelles subventions, les comparaisons régionales et les alternatives (GPL, véhicules économiques).",
  },
  {
    key: "securite-accidents",
    promptFr: "Rédige une synthèse de l'actualité de la sécurité routière en Algérie : bilan des accidents, actions de la Gendarmerie et de la DGSN, campagnes de sensibilisation, nouvelles mesures (radars, amendes), et recommandations pour les conducteurs.",
  },
  {
    key: "salon-auto-evenements",
    promptFr: "Rédige un article de veille sur les salons et événements automobiles (internationaux et locaux) pertinents pour l'Algérie : annonces de constructeurs, modèles susceptibles d'arriver sur le marché algérien, tendances du secteur.",
  },
  {
    key: "pieces-detachees-entretien",
    promptFr: "Rédige une synthèse sur le marché des pièces détachées et de l'entretien automobile en Algérie : disponibilité, contrefaçon, réseaux de distribution, coûts comparés entre marques, et conseils pour trouver des pièces fiables au meilleur prix.",
  },
  {
    key: "financement-credit-auto",
    promptFr: "Rédige un point sur le financement automobile en Algérie : crédit auto (banques, conditions, taux), leasing, formules islamiques (Mourabaha, Ijara), et conseils pour choisir la meilleure option selon son budget et son profil.",
  },
];

export function pickNextPressReviewTopic(recentTopicKeys: string[]): PressReviewTopicTemplate {
  const unused = PRESS_REVIEW_TEMPLATES.filter((t) => !recentTopicKeys.includes(t.key));
  if (unused.length > 0) return unused[0];
  return PRESS_REVIEW_TEMPLATES[0];
}
