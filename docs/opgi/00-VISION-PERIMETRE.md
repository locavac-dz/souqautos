# 00 — Vision, périmètre, personas, glossaire

## 0. Résumé exécutif

Plateforme professionnelle, modulaire et commercialisable par INGÉNICA CIVIL auprès de plusieurs
**OPGI** algériens. Une seule application cohérente réunit trois domaines activables
indépendamment :

- **Module A — Gestion immobilière et locative :** patrimoine, immeubles, logements, locaux,
  occupants, contrats, loyers, paiements, recouvrement.
- **Module B — Projets, marchés et chantiers :** opérations, marchés, entreprises, planning,
  avancement physique/financier, situations de travaux, pièces, réception.
- **Module C — Réclamations, maintenance et interventions :** portail de signalement,
  qualification, ordres de travail, techniciens/entreprises, suivi des coûts, historique.

Principe fondateur : **une plateforme, plusieurs OPGI**, avec **isolation stricte** des données de
chaque organisme et deux modes d'exploitation (installation chez l'OPGI ou hébergement centralisé
mutualisé).

## 1. Ce que le produit est — et n'est pas

| Le produit EST | Le produit N'EST PAS |
|---|---|
| Un outil de **gestion et de suivi** du patrimoine, des chantiers et des réclamations | Un **système comptable officiel** (il s'interface, il ne remplace pas) |
| Un **registre de suivi** des marchés et situations de travaux | Une **plateforme officielle de passation des marchés publics** |
| Un **moteur de workflows configurables** (statuts, validations) | Un **système de paiement** ou d'exécution budgétaire |
| Un **référentiel** d'indicateurs avec définitions visibles | Une source de chiffres réglementaires ou juridiques confirmés |

Toute règle de calcul (loyer, pénalité, délai cible, avancement) est **configurable**, jamais
codée en dur, et les valeurs par défaut sont marquées « à valider » (voir
`05-REGISTRE-CONFORMITE.md`).

## 2. Périmètre fonctionnel par module

### Module A — Patrimoine et gestion locative
- Référentiel paramétrable : sites, résidences, bâtiments, cages, niveaux, logements, locaux.
- Identifiants uniques stables, adresses, caractéristiques, état d'occupation, historique.
- Import initial (formats documentés) : contrôle d'erreurs, détection de doublons, rapport d'import.
- Occupants et parties liées (collecte minimale).
- Contrats et avenants : dates, bien, parties, statut, documents, échéances configurables.
- Appels de loyers/charges paramétrables, échéancier, paiements, imputations, soldes, historique.
- Suivi des impayés et actions de recouvrement (statut, responsable, date, pièces).
- Reçus, états de compte, courriers depuis **modèles validés**.
- Indicateurs : occupation/vacance, échéances, encaissements, impayés, tendances (définitions visibles).
- Interfaces/exports vers les systèmes financiers existants (adaptateurs désactivés par défaut).

### Module B — Projets, marchés et chantiers
- Référentiel opérations/projets/programmes/sources de financement (catégories confirmées par l'OPGI).
- Dossiers de consultation/marché, lots, entreprises, montants, délais, ordres de service, avenants, pièces.
- Planning de référence, jalons, tâches, responsables, mises à jour datées.
- Avancement physique (mesures, unités, quantités, méthode configurable, justificatifs).
- Avancement financier (engagé/constaté selon définitions validées, **séparé** des paiements exécutés).
- Situations de travaux : dépôt → vérification → observations → validation/rejet, versions, pièces.
- Suivi des modifications de coût/délai (motif, auteur, date, état d'approbation).
- Réceptions provisoires/définitives, réserves, levées, PV, selon workflows validés.
- Alertes de retard/dépassement/échéance fondées sur paramètres documentés.
- Tableaux de bord et exports filtrés par projet, entreprise, période, statut, périmètre autorisé.

### Module C — Réclamations, maintenance et interventions
- Portail de signalement accessible, accusé de réception.
- Réclamation rattachée (si possible) à un bien/résidence/dossier.
- Catégories, urgence, localisation, description, pièces, canal d'entrée, consentements requis (à valider).
- Détection de doublons et regroupement **sans suppression d'historique**.
- Qualification, priorité, affectation, statut, commentaires, échanges visibles selon droits.
- Transformation en ordre de travail et planification d'intervention.
- Affectation à techniciens internes ou entreprises habilitées.
- Visites, diagnostic, travaux, pièces, coûts estimés/constatés, preuves avant/après, compte rendu.
- Validation de fin d'intervention et retour au déclarant.
- Délais cibles **configurables** (jamais présentés comme obligation réglementaire sans source).
- Historique rattaché au bien ; indicateurs par zone, catégorie, délai, statut, coût.
- Responsive / terrain ; mode hors connexion = évolution (Phase 7), limites à spécifier.

## 3. Personas (rôles de départ, configurables — détail dans `03-MATRICE-ROLES-PERMISSIONS.md`)

| Persona | Besoin principal | Périmètre |
|---|---|---|
| Administrateur **plateforme** | Exploitation technique, création des OPGI | Tous OPGI, **aucun** accès métier aux données |
| Administrateur **OPGI** | Config, utilisateurs, modules de **son** OPGI | Un OPGI |
| Direction / responsables de service | Pilotage, tableaux de bord | Un OPGI, périmètre service |
| Agent gestion locative / patrimoine | Référentiel, contrats, loyers | Module A |
| Agent recouvrement / responsable financier | Impayés, encaissements, états | Module A (financier) |
| Chef de projet / agent suivi chantier | Opérations, planning, avancement | Module B |
| Gestionnaire marchés / situations | Marchés, situations, réceptions | Module B |
| Responsable réclamations / maintenance | File des réclamations, ordres de travail | Module C |
| Technicien interne | Ses interventions | Module C, affectations propres |
| Entreprise / prestataire externe | Interventions/pièces confiées **uniquement** | Accès restreint |
| Locataire / occupant | Déposer et suivre **ses** réclamations | Portail, ses demandes |
| Auditeur / lecteur | Consultation (si activé) | Lecture seule, périmètre défini |

## 4. Glossaire

- **OPGI** — Office de Promotion et de Gestion Immobilière. Organisme = *tenant* de la plateforme.
- **Tenant / organisme** — Espace de données isolé d'un OPGI.
- **Bien** — Unité du patrimoine (logement, local, …) rattachée à un emplacement.
- **Appel de loyer** — Montant dû généré pour une période selon un contrat.
- **Imputation** — Affectation d'un paiement reçu à un ou plusieurs appels.
- **Situation de travaux** — État d'avancement financier déposé par une entreprise, à vérifier/valider.
- **Ordre de travail (OT)** — Instruction d'intervention issue d'une réclamation qualifiée.
- **Réception (provisoire/définitive)** — Acte de constat d'achèvement, avec réserves éventuelles.
- **Périmètre** — Sous-ensemble organisationnel (service, zone) limitant les droits d'un utilisateur.
- **Lot** — Incrément de livraison versionné (convention du dépôt, voir `CHANGELOG.md`).
- **Jeu de démonstration** — Données fictives explicitement signalées, interdites en production.
