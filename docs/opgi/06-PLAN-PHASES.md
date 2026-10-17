# 06 — Plan de développement par phases

> Aligné sur le prompt maître §14 et adapté au dépôt (convention de « lots » versionnés + CI).
> Chaque phase livre un incrément **démontrable** avec **persistance réelle** et critères
> d'acceptation. Un écran sans logique, une donnée fictive non signalée ou une action non persistée
> ne comptent **pas** comme terminés.

## Critères d'acceptation génériques (tout incrément)
1. Le parcours métier fonctionne de bout en bout avec **persistance réelle**.
2. **Permissions et isolation d'organisme testées** (voir `02`/§4).
3. Erreurs compréhensibles, **sans divulgation** de données sensibles.
4. Migrations, tests, documentation et notes de version à jour (`CHANGELOG`-style).
5. Éléments non terminés et hypothèses restantes **explicitement listés**.
6. Gardes-fous du dépôt respectés : `tsc --noEmit`, `lint`, `test` verts avant push.

---

## Phase 0 — Cadrage et validation *(en cours — ce dossier en est le livrable)*
- **Livré :** vision/périmètre, architecture, modèle d'isolation + menaces, matrice rôles,
  registres hypothèses et conformité, ce plan.
- **Reste :** répondre aux 3 questions bloquantes (`01`/§4) ; idéalement, cartographie d'un OPGI pilote.
- **Acceptation :** décision D1 (emplacement) + D2 (mode) validées par le porteur.

## Phase 1 — Socle plateforme *(premier incrément de code, après validation Phase 0)*
- Authentification, organismes (tenants), utilisateurs, rôles, configuration, **audit**, fichiers
  (accès médié), migrations, sauvegardes documentées, interface FR, structure de déploiement.
- **Démontrer l'isolation entre deux OPGI AVANT toute donnée métier sensible** (les 10 tests de `02`).
- **Acceptation :** création de deux OPGI, comptes cloisonnés, 10 tests d'isolation verts en CI,
  séparation admin plateforme ↔ métier vérifiée.

## Phase 2 — Module A (patrimoine & locatif)
- Référentiel patrimoine, occupants, contrats, loyers, paiements/imputations, recouvrement, rapports
  prioritaires. Import initial testé. Règles configurées (barèmes saisis, aucun taux inventé).
- **Acceptation :** cycle contrat→appel→paiement→solde persisté et isolé ; import avec rapport d'erreurs.

## Phase 3 — Module C (réclamations & interventions)
- Portail de signalement, qualification, ordres de travail, affectation (technicien/entreprise),
  intervention, coûts estimés/constatés, historique rattaché au bien.
- **Acceptation :** parcours public/agent/prestataire de bout en bout, isolé ; accès prestataire
  limité aux interventions confiées.

## Phase 4 — Module B (projets, marchés, chantiers)
- Opérations, marchés, entreprises, planning, avancement physique/financier, situations, pièces,
  réceptions selon circuits **validés**.
- **Acceptation :** dépôt→vérification→validation d'une situation persisté ; **séparation** engagé /
  constaté / payé vérifiée ; calculs d'avancement testés.

## Phase 5 — Intégration & préparation au pilote
- Tableaux de bord, notifications, exports, imports, documentation d'installation (locale **et**
  centralisée), tests de sécurité, sauvegarde/restauration, formation. Recette métier sur périmètre pilote.
- **Acceptation :** `launch-check` OPGI vert ; restauration vérifiée ; recette métier signée.

## Phase 6 — Déploiement & commercialisation
- Déploiement selon le mode choisi, migration des données **après validation**, formation,
  guides, support/maintenance/mises à jour/incidents. Catalogue d'offres et d'options (**prix non
  inventés**, chiffrés par INGÉNICA CIVIL).

## Phase 7 — Évolutions
- Arabe/RTL complet, mobilité hors connexion, intégrations, analyses avancées, nouveaux modules.
- **Contrainte permanente :** préserver l'isolation inter‑OPGI, la compatibilité des migrations et la
  portabilité des installations.

---

## Premier incrément démontrable proposé (début de Phase 1)

Sous réserve de la validation de D1/D2, le premier incrément livrable et **vérifiable** est le
**socle d'isolation** :

1. Modèle `Organisation` + `Utilisateur` lié à un organisme ; `organisationId` non nullable sur les
   tables métier ; migrations versionnées.
2. Résolution de l'organisme **depuis la session serveur** (jamais le client) + garde d'autorisation.
3. RLS PostgreSQL (mode centralisé) comme filet de sécurité.
4. Deux OPGI de démonstration (données **fictives signalées**) + comptes.
5. Les **10 tests d'isolation** de `02`/§4 verts en CI.

**Vérification :** `npm run test` (unitaires/isolation) + e2e isolation en CI ; démonstration :
connexion à `OPGI-A`, tentative d'accès à un objet d'`OPGI-B` refusée (compte, recherche,
identifiant deviné, pièce jointe, export).

> Ce premier incrément **ne traite aucune donnée réelle** et ne dépend d'aucune règle juridique non
> validée : il établit uniquement la propriété d'isolation, socle de tout le reste.
