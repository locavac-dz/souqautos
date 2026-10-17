# 04 — Registre des hypothèses et questions ouvertes

> Choix **provisoires et configurables** pris pour ne pas bloquer un premier incrément. Chaque
> hypothèse est à confirmer par l'OPGI pilote et/ou INGÉNICA CIVIL. Rien ici n'est présenté comme
> une règle métier ou juridique confirmée. Les points de droit sont dans `05-REGISTRE-CONFORMITE.md`.

## Légende statut
- 🔴 **Bloquant** — empêche de démarrer le code (voir `01-ARCHITECTURE.md` §4).
- 🟡 **Provisoire** — un défaut configurable est posé ; le travail peut avancer.
- ⚪ **À planifier** — sans impact sur le premier incrément.

## Registre

| # | Sujet | Hypothèse provisoire | Statut | À valider par |
|---|---|---|---|---|
| H1 | Emplacement du code | Projet `opgi/` dans ce dépôt, sœur de `app/` | 🔴 | Porteur projet |
| H2 | Mode d'exploitation du pilote | Centralisé mutualisé (base partagée + RLS) | 🔴 | Porteur / OPGI |
| H3 | OPGI pilote identifié | Aucun encore — données fictives signalées en attendant | 🔴 | INGÉNICA CIVIL |
| H4 | Stack | Next.js 16 + Prisma + PostgreSQL + next-intl (comme `app/`) | 🟡 | — |
| H5 | Langue | FR par défaut ; AR/RTL = architecture prévue, activée en Phase 7 | 🟡 | OPGI |
| H6 | Modèle d'isolation | `organisationId` non nullable + RLS (centralisé) ; base dédiée (installé) | 🟡 | Architecte |
| H7 | Identifiants de biens | Identifiant **interne** cuid stable + **code métier** lisible configurable par OPGI | 🟡 | OPGI |
| H8 | Calcul des loyers | Aucun taux/pénalité en dur ; barèmes **saisis et configurables** par OPGI | 🟡 | OPGI |
| H9 | Pénalités de retard | Non calculées par défaut ; activables et paramétrables | 🟡 | OPGI + conseil |
| H10 | Délais cibles réclamations | Configurables par catégorie ; **non** présentés comme obligation réglementaire | 🟡 | OPGI |
| H11 | Méthode d'avancement physique | Paramétrable (quantités/unités) ; pas de méthode imposée | 🟡 | OPGI |
| H12 | Séparation engagé / payé | Suivi financier **distinct** des paiements exécutés (jamais fusionnés) | 🟡 | OPGI + finance |
| H13 | Formats d'import initial | CSV/XLSX documentés + rapport d'erreurs ; modèle fourni | 🟡 | OPGI |
| H14 | Intégration système financier | Adaptateur **désactivé par défaut**, contrat d'interface à définir | ⚪ | OPGI |
| H15 | Notifications email/SMS | Fournisseurs choisis par l'OPGI ; interne par défaut | ⚪ | OPGI |
| H16 | Stockage fichiers | Disque local (installé) ou S3 compatible (centralisé), accès médié | 🟡 | Exploitation |
| H17 | Rétention / purge des données | **Aucune durée inventée** — à fixer après validation juridique | 🔴(droit) | Conseil + OPGI |
| H18 | Hébergement / localisation données | Non présumé autorisé — à vérifier avant production | 🔴(droit) | Conseil + OPGI |
| H19 | Signatures électroniques | Hors périmètre initial sauf demande ; cadre légal à vérifier | ⚪ | Conseil |
| H20 | Mode hors connexion (terrain) | Hors Phase 1‑5 ; évolution Phase 7, limites à spécifier | ⚪ | OPGI |
| H21 | RPO / RTO | Non inventés — définis avec chaque organisme | ⚪ | OPGI + exploitation |
| H22 | Valeur juridique des documents générés | Aucune présumée — modèles « à valider », mention explicite | 🔴(droit) | Conseil |

## Questions ouvertes à poser à l'OPGI pilote (Phase 0)

1. Cartographie réelle des processus locatifs, chantiers et réclamations.
2. Volumes (nombre de biens, contrats, projets, réclamations/mois).
3. Formulaires, documents et modèles actuellement utilisés (pour localisation et gabarits).
4. Services/périmètres organisationnels réels et qui valide quoi.
5. Systèmes financiers/comptables existants et interfaces attendues.
6. Contraintes d'hébergement et exigences de sécurité propres à l'organisme.
7. Données représentatives (anonymisées) pour tester imports et règles configurées.
