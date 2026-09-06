// Lot 88 — profondeur de catalogue (docs/ARCHITECTURE.md §5 : generations).
// Contrairement aux communes (Lot 87, source officielle unique), il n'existe
// aucune source unique fiable pour les générations par modèle sur le marché
// algérien : chaque ligne ci-dessous a été vérifiée individuellement (nom de
// génération, code châssis quand il existe, années de production réelles)
// via la page Wikipédia du modèle concerné — jamais inventée. Couverture
// volontairement PARTIELLE : uniquement les 24 modèles réellement utilisés
// par les annonces de démonstration (Lot 71), pas les 108 du catalogue.
// yearEnd `null` = génération toujours produite/vendue au moment de la
// vérification (2026-09-06).
export const generations: { modelId: number; name: string; yearStart: number; yearEnd: number | null }[] = [
  // Renault Clio (modelId 1)
  { modelId: 1, name: "Clio III", yearStart: 2005, yearEnd: 2012 },
  { modelId: 1, name: "Clio IV", yearStart: 2012, yearEnd: 2019 },
  { modelId: 1, name: "Clio V", yearStart: 2019, yearEnd: null },

  // Renault Mégane (modelId 3)
  { modelId: 3, name: "Mégane II", yearStart: 2002, yearEnd: 2008 },
  { modelId: 3, name: "Mégane III", yearStart: 2008, yearEnd: 2016 },
  { modelId: 3, name: "Mégane IV", yearStart: 2015, yearEnd: 2024 },

  // Peugeot 208 (modelId 8)
  { modelId: 8, name: "208 I", yearStart: 2012, yearEnd: 2019 },
  { modelId: 8, name: "208 II", yearStart: 2019, yearEnd: null },

  // Dacia Sandero (modelId 15)
  { modelId: 15, name: "Sandero I", yearStart: 2007, yearEnd: 2014 },
  // Années de production spécifiques à l'Algérie (Wikipédia) plutôt que la
  // plage mondiale générique — plus pertinent pour ce marché.
  { modelId: 15, name: "Sandero II", yearStart: 2016, yearEnd: 2021 },
  { modelId: 15, name: "Sandero III", yearStart: 2020, yearEnd: null },

  // Dacia Duster (modelId 16)
  { modelId: 16, name: "Duster I", yearStart: 2010, yearEnd: 2017 },
  { modelId: 16, name: "Duster II", yearStart: 2017, yearEnd: 2024 },
  { modelId: 16, name: "Duster III", yearStart: 2023, yearEnd: null },

  // Volkswagen Golf (modelId 18)
  { modelId: 18, name: "Golf Mk6", yearStart: 2008, yearEnd: 2012 },
  { modelId: 18, name: "Golf Mk7", yearStart: 2012, yearEnd: 2019 },
  { modelId: 18, name: "Golf Mk8", yearStart: 2019, yearEnd: null },

  // Volkswagen Passat (modelId 20)
  { modelId: 20, name: "Passat B6", yearStart: 2005, yearEnd: 2010 },
  { modelId: 20, name: "Passat B7", yearStart: 2010, yearEnd: 2014 },
  { modelId: 20, name: "Passat B8", yearStart: 2014, yearEnd: 2023 },

  // Hyundai Elantra (modelId 26)
  { modelId: 26, name: "Elantra 5e génération (MD/UD/JK)", yearStart: 2010, yearEnd: 2015 },
  { modelId: 26, name: "Elantra 6e génération (AD)", yearStart: 2015, yearEnd: 2020 },
  { modelId: 26, name: "Elantra 7e génération (CN7)", yearStart: 2020, yearEnd: null },

  // Hyundai Tucson (modelId 27)
  { modelId: 27, name: "Tucson II (LM)", yearStart: 2009, yearEnd: 2015 },
  { modelId: 27, name: "Tucson III (TL)", yearStart: 2015, yearEnd: 2021 },
  { modelId: 27, name: "Tucson IV (NX4)", yearStart: 2020, yearEnd: null },

  // Kia Sportage (modelId 32)
  { modelId: 32, name: "Sportage III (SL)", yearStart: 2010, yearEnd: 2015 },
  { modelId: 32, name: "Sportage IV (QL)", yearStart: 2015, yearEnd: 2021 },
  { modelId: 32, name: "Sportage V (NQ5)", yearStart: 2021, yearEnd: null },

  // Toyota Yaris (modelId 34)
  { modelId: 34, name: "Yaris II (XP90)", yearStart: 2005, yearEnd: 2013 },
  { modelId: 34, name: "Yaris III (XP130/XP150)", yearStart: 2011, yearEnd: 2019 },
  { modelId: 34, name: "Yaris IV (XP210)", yearStart: 2020, yearEnd: null },

  // Toyota Corolla (modelId 35)
  { modelId: 35, name: "Corolla 10e génération (E140/E150)", yearStart: 2006, yearEnd: 2012 },
  { modelId: 35, name: "Corolla 11e génération (E160/E170/E180)", yearStart: 2012, yearEnd: 2018 },
  { modelId: 35, name: "Corolla 12e génération (E210)", yearStart: 2018, yearEnd: null },

  // Suzuki Vitara (modelId 50)
  { modelId: 50, name: "Vitara/Grand Vitara III (JT)", yearStart: 2005, yearEnd: 2017 },
  { modelId: 50, name: "Vitara IV (LY)", yearStart: 2015, yearEnd: null },

  // Nissan Qashqai (modelId 57)
  { modelId: 57, name: "Qashqai I (J10)", yearStart: 2006, yearEnd: 2013 },
  { modelId: 57, name: "Qashqai II (J11)", yearStart: 2013, yearEnd: 2021 },
  { modelId: 57, name: "Qashqai III (J12)", yearStart: 2021, yearEnd: null },

  // Seat Ibiza (modelId 59)
  { modelId: 59, name: "Ibiza III", yearStart: 2002, yearEnd: 2008 },
  { modelId: 59, name: "Ibiza IV", yearStart: 2008, yearEnd: 2017 },
  { modelId: 59, name: "Ibiza V", yearStart: 2017, yearEnd: null },

  // Ford Fiesta (modelId 66)
  { modelId: 66, name: "Fiesta 5e génération", yearStart: 2002, yearEnd: 2008 },
  { modelId: 66, name: "Fiesta 6e génération", yearStart: 2008, yearEnd: 2019 },
  { modelId: 66, name: "Fiesta 7e génération", yearStart: 2017, yearEnd: 2023 },

  // Opel Corsa (modelId 70)
  { modelId: 70, name: "Corsa D", yearStart: 2006, yearEnd: 2014 },
  { modelId: 70, name: "Corsa E", yearStart: 2014, yearEnd: 2019 },
  { modelId: 70, name: "Corsa F", yearStart: 2019, yearEnd: null },

  // Mercedes-Benz Classe C (modelId 74)
  { modelId: 74, name: "Classe C W204", yearStart: 2006, yearEnd: 2015 },
  { modelId: 74, name: "Classe C W205", yearStart: 2014, yearEnd: 2021 },
  { modelId: 74, name: "Classe C W206", yearStart: 2021, yearEnd: null },

  // BMW Série 3 (modelId 80)
  { modelId: 80, name: "Série 3 E90/E91/E92/E93", yearStart: 2004, yearEnd: 2012 },
  { modelId: 80, name: "Série 3 F30", yearStart: 2011, yearEnd: 2019 },
  { modelId: 80, name: "Série 3 G20", yearStart: 2018, yearEnd: null },

  // Audi Q3 (modelId 88)
  { modelId: 88, name: "Q3 8U", yearStart: 2011, yearEnd: 2018 },
  { modelId: 88, name: "Q3 F3", yearStart: 2018, yearEnd: 2025 },
  { modelId: 88, name: "Q3 FJ", yearStart: 2025, yearEnd: null },

  // Chery Tiggo 7 (modelId 92)
  { modelId: 92, name: "Tiggo 7 (T15)", yearStart: 2016, yearEnd: 2020 },
  { modelId: 92, name: "Tiggo 7 Pro (T1E)", yearStart: 2020, yearEnd: null },

  // Fiat Tipo (modelId 42) — une seule génération moderne
  { modelId: 42, name: "Tipo (2e génération)", yearStart: 2015, yearEnd: null },

  // Citroën C4 (modelId 45)
  { modelId: 45, name: "C4 I", yearStart: 2004, yearEnd: 2010 },
  { modelId: 45, name: "C4 II", yearStart: 2010, yearEnd: 2018 },
  { modelId: 45, name: "C4 III", yearStart: 2020, yearEnd: null },

  // Skoda Octavia (modelId 63)
  { modelId: 63, name: "Octavia II", yearStart: 2004, yearEnd: 2013 },
  { modelId: 63, name: "Octavia III", yearStart: 2012, yearEnd: 2019 },
  { modelId: 63, name: "Octavia IV", yearStart: 2019, yearEnd: null },
];
