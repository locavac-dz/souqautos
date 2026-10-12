export type MagTopicTemplate = {
  key: string;
  promptFr: string;
};

export const MAG_TOPIC_TEMPLATES: MagTopicTemplate[] = [
  {
    key: "entretien-saison",
    promptFr: "Rédige un article sur l'entretien automobile saisonnier en Algérie : conseils pratiques pour préparer sa voiture aux grandes chaleurs estivales (climatisation, pneus, liquide de refroidissement, batterie). Contexte local : climat semi-aride, routes variées.",
  },
  {
    key: "achat-occasion-pieges",
    promptFr: "Rédige un article sur les pièges à éviter lors de l'achat d'une voiture d'occasion en Algérie : vérification du kilométrage, état de la carrosserie, documents à exiger (carte grise, assurance, contrôle technique), arnaque au compteur, véhicule accidenté maquillé.",
  },
  {
    key: "controle-technique",
    promptFr: "Rédige un article explicatif sur le contrôle technique automobile en Algérie : quand le passer, les points vérifiés, les centres agréés, les conséquences en cas de non-conformité, les frais, et les changements réglementaires récents.",
  },
  {
    key: "assurance-auto",
    promptFr: "Rédige un article sur le fonctionnement de l'assurance automobile en Algérie : la RC obligatoire, les formules complémentaires (tiers collision, tous risques), le système bonus-malus, les principaux assureurs (SAA, CAAT, Alliance, GAM), et des conseils pour bien choisir.",
  },
  {
    key: "economie-carburant",
    promptFr: "Rédige un article sur les astuces pour réduire sa consommation de carburant en Algérie : conduite souple, entretien régulier, pression des pneus, climatisation, choix du carburant (essence, diesel, GPL/Sirghaz). Intègre le contexte des prix du carburant en Algérie.",
  },
  {
    key: "vignette-automobile",
    promptFr: "Rédige un article sur la vignette automobile en Algérie : barème par puissance fiscale, délais de paiement, points de vente, pénalités de retard, et exonérations éventuelles. Barème 2026 après les revalorisations.",
  },
  {
    key: "securite-routiere",
    promptFr: "Rédige un article sur la sécurité routière en Algérie : statistiques, principales causes d'accident, équipements de sécurité obligatoires, règles de conduite, ceinture de sécurité, téléphone au volant, et les campagnes de sensibilisation.",
  },
  {
    key: "permis-conduire",
    promptFr: "Rédige un article sur le permis de conduire en Algérie : catégories, conditions d'obtention, déroulement de l'examen (code + conduite), coût de la formation, renouvellement, et le système du permis à points.",
  },
  {
    key: "comparatif-citadines",
    promptFr: "Rédige un comparatif des citadines les plus vendues en Algérie : Dacia Sandero, Renault Clio, Peugeot 208, Hyundai i10/i20, Suzuki Swift. Compare prix, consommation, espace, équipements de série, coût d'entretien et disponibilité des pièces.",
  },
  {
    key: "comparatif-suv",
    promptFr: "Rédige un comparatif des SUV populaires en Algérie : Dacia Duster, Hyundai Tucson, Kia Sportage, Peugeot 3008, Toyota RAV4. Compare prix, motorisations, espace, équipements, et aptitude aux routes algériennes.",
  },
  {
    key: "gpl-sirghaz",
    promptFr: "Rédige un article sur le GPL (Sirghaz) en Algérie : avantages économiques, installation et conversion, stations de recharge, compatibilité des véhicules, réglementation, et retour d'expérience des utilisateurs.",
  },
  {
    key: "import-vehicule",
    promptFr: "Rédige un article sur l'importation de véhicules en Algérie : la réglementation en vigueur, les véhicules éligibles (neufs, moins de 3 ans), les droits de douane et taxes, les concessionnaires agréés, et les alternatives (marché local d'occasion).",
  },
];

export function pickNextTopic(recentTopicKeys: string[]): MagTopicTemplate {
  const unused = MAG_TOPIC_TEMPLATES.filter((t) => !recentTopicKeys.includes(t.key));
  if (unused.length > 0) return unused[0];
  return MAG_TOPIC_TEMPLATES[0];
}
