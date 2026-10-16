# Plateforme OPGI — socle multi‑organisme

Plateforme intégrée de gestion des OPGI algériens (INGÉNICA CIVIL). Ce dossier `opgi/` est un
projet **indépendant** du produit SOUQ AUTO (`app/`), avec lequel il partage uniquement les
**conventions** d'ingénierie (TypeScript strict, Prisma/PostgreSQL, migrations versionnées).

> **Statut : Phase 1 — socle d'isolation + couche HTTP/UI/auth.** Voir `../docs/opgi/` pour le
> cadrage complet (vision, architecture, matrice des rôles, hypothèses, conformité, plan par phases).

## Ce que ces incréments livrent (vérifiable)

### Incrément 1 — socle d'isolation inter‑organisme (avant toute donnée métier)

- **Schéma multi‑tenant** (`prisma/schema.prisma`) : `Organisation`, `Utilisateur`, `Bien` — toute
  table métier porte `organisationId` **non null**. Schéma **identique** pour les deux modes (D2).
- **Isolation à deux niveaux (défense en profondeur)** :
  1. **couche applicative** — `src/lib/tenant/` résout l'organisme depuis la **session serveur**
     (jamais le client) et exécute chaque requête sous cet organisme ;
  2. **Row-Level Security PostgreSQL** (`prisma/migrations/*/rls.sql`) — filet « fail closed » :
     sans organisme fixé, le rôle applicatif ne voit **rien**.
- **Rôle applicatif restreint `opgi_app`** (soumis RLS), séparé du propriétaire `opgi` —
  `prisma/provision-roles.sql`.
- **Matrice des permissions** (`src/lib/authz/`) : rôle × module × action, moindre privilège,
  séparation stricte admin plateforme ↔ métier.

### Incrément 2 — couche HTTP / UI / authentification (Next.js 16)

- **Authentification** : mot de passe bcrypt (`src/lib/auth/password.ts`), session signée JWT HS256
  via `jose` (`session.ts`) portant l'organisme ; cookie HttpOnly/SameSite (préfixe `__Host-` +
  Secure en production) — `cookies.ts`.
- **Bootstrap de login maîtrisé** (`authenticate.ts`) : seul chemin privilégié (le rôle restreint ne
  voit rien avant qu'une session fixe l'organisme), réduit à la vérification des identifiants ;
  messages d'erreur génériques (pas d'oracle sur l'existence du compte).
- **Handlers HTTP framework‑agnostiques** (`src/http/`, `Request → Response`) : login, logout, liste
  des biens — enchaînent session → organisme → autorisation → requête isolée (`withTenant`).
- **Next.js 16** : pages FR (`/connexion`, `/tableau-de-bord`), routes `src/app/api/*` qui délèguent
  aux handlers, **proxy unique** `src/proxy.ts` (CSRF d'origine), en‑têtes de sécurité + CSP
  (`next.config.mjs`), i18n next-intl (FR par défaut, AR/RTL préparé).

### Incrément 3 — Module A (patrimoine : CRUD + occupants + contrats)

- **Modèle** : `Bien` (patrimoine), `Occupant` (physique/morale), `Contrat` (lie bien + occupant),
  tous cloisonnés par `organisationId` + RLS (migration `rls_module_a`). **Archivage logique**
  (jamais de suppression physique).
- **CRUD complet** via API (`src/http/` + services `src/lib/modules/a/`) :
  `GET/POST /api/biens`, `GET/PATCH/DELETE /api/biens/:id`, idem `occupants` et `contrats`.
  Validation zod (`schemas.ts`), erreurs traduites (400 invalide, 409 code dupliqué, 404 introuvable).
- **Lien contrat → bien/occupant vérifié DANS le tenant** : une clé étrangère seule ne suffit pas
  (la vérification FK de PostgreSQL contourne la RLS), donc le service refuse (400) un contrat
  pointant vers un bien/occupant d'un autre organisme.
- **Aucun calcul** : le loyer (`montantLoyerCentimes`) est une saisie libre ; aucun taux, pénalité
  ou règle inventé. Les statuts de contrat sont un point de départ configurable.
- **UI FR** : pages liste + création pour patrimoine, occupants, contrats ; navigation ;
  bouton d'archivage. Autorisations reflétées dans l'UI (création masquée sans le droit).

### Incrément 4 — Module A financier (appels de loyers, paiements, recouvrement)

- **Modèle** : `AppelLoyer` (montant dû par période), `Paiement` (encaissement constaté),
  `Imputation` (affectation paiement → appel), `ActionRecouvrement` (journal des relances/mises en
  demeure…). Tous cloisonnés par `organisationId` + RLS (migration dédiée).
- **Montants en centimes entiers — aucun flottant, aucun calcul inventé** : pas de pénalité ni
  d'intérêt. Le **solde** d'un appel et le **reste** d'un paiement sont calculés par différence avec
  les imputations (jamais stockés, donc jamais incohérents).
- **Suivi distinct engagement / encaissement** : un appel (dû) n'est jamais confondu avec un
  paiement (reçu) ; le lien passe par une imputation explicite.
- **Règles d'intégrité** (données, pas droit) : une imputation ne peut dépasser le solde de l'appel
  ni le reste du paiement (→ 409), et ne lie que des éléments du **même contrat** et du **même
  organisme**.
- **Recouvrement** : liste des **impayés** (appels à solde > 0) avec jours de retard **indicatifs**
  (aucune échéance réglementaire présumée) ; enregistrement d'actions (type, date, note, pièce).
- **UI FR** : fiche de contrat (appels/soldes, paiements/restes, actions) avec formulaires d'appel,
  de paiement, d'imputation et d'action ; page **Recouvrement — impayés**.

### Incrément 5 — Module C (réclamations, maintenance, interventions)

- **Modèle** : `Reclamation` (rattachable à un bien/occupant, déclarant portail ou guichet),
  `CommentaireReclamation` (échanges, avec notes **internes**), `OrdreTravail` (intervention issue
  d'une réclamation, affectée à un technicien interne ou un prestataire externe, coûts estimé/
  constaté). Tous cloisonnés par `organisationId` + RLS (migration dédiée). Références auto‑générées.
- **Cloisonnement par PROPRIÉTÉ** (au‑delà de l'organisme) :
  - un **OCCUPANT** ne voit et ne crée que **ses** réclamations (portail) ;
  - un **TECHNICIEN** ne voit et ne modifie que **ses** ordres de travail (même en écriture) ;
  - une **note interne** n'est jamais renvoyée à un déclarant.
- **Cycle** : dépôt → qualification (statut/urgence/catégorie) → ordre de travail → intervention
  (compte rendu, coûts) ; **détection de doublons** par regroupement (statut `DOUBLON` + lien),
  **sans suppression d'historique**.
- **Aucun calcul inventé** ; délais/catégories/statuts configurables, jours de retard indicatifs.
- **API REST + UI FR** : liste + dépôt de réclamation, fiche (qualification, commentaires, ordres)
  avec formulaires gated par rôle.

### Incrément 6 — Module B (projets, marchés, chantiers)

- **Modèle** : `Projet` (opération), `Entreprise`, `Marche` (montant **engagé**),
  `SituationTravaux` (montant **constaté**, avancement physique), `Reception`
  (provisoire/définitive, réserves). Tous cloisonnés par `organisationId` + RLS.
- **Séparation engagé / constaté / payé** : l'engagé (marché) et le constaté (situations
  **validées**) sont distincts ; le **paiement exécuté est hors périmètre** (suivi, pas système de
  paiement). Aucun calcul réglementaire.
- **Workflow des situations + permission `valider`** : dépôt → vérification → **validation**/rejet,
  avec traçage du décideur et de la date. La **validation** exige la permission `valider`
  (GESTIONNAIRE_MARCHES) ; un CHEF_PROJET peut déposer/vérifier mais **pas** valider (403) —
  mise en œuvre concrète d'une délégation.
- **Indicateurs indicatifs** (non réglementaires) : avancement financier (constaté/engagé),
  avancement physique, alertes **dépassement** (constaté > engagé) et **retard** (délai dépassé).
- **API REST + UI FR** : listes + création projets/entreprises/marchés ; fiche de marché
  (avancement, situations avec dépôt/décision, réceptions).

### Incrément 7 — Journal d'audit persistant (transverse)

- **Modèle** `AuditLog` : auteur, organisme, action normalisée, type/identifiant d'objet, résultat,
  date, résumé **sans donnée personnelle** (minimisation, brief §9). Cloisonné par organisme (RLS).
- **Append‑only** : le rôle applicatif `opgi_app` n'a que **SELECT + INSERT** sur `audit_log`
  (UPDATE/DELETE **révoqués** — migration `rls_audit` + `provision-roles.sql`). Le journal ne peut
  donc être ni modifié ni effacé par l'application.
- **Écriture atomique** : l'entrée d'audit est insérée **dans la même transaction `withTenant`** que
  l'action auditée (validées ou annulées ensemble).
- **Opérations sensibles tracées** (brief §9) : création de contrat, de paiement, d'imputation, de
  marché, **décision sur situation de travaux** (dont la validation), création de réception.
- **Consultation réservée** (`ADMIN_OPGI`, `DIRECTION`, `AUDITEUR`) — page `/audit` + `GET /api/audit`.

### Incrément 8 — Import initial du référentiel (CSV)

- **Import CSV des biens et des occupants** (brief §A/§11) avec les trois garanties : **contrôle des
  erreurs** (validation zod ligne à ligne), **détection des doublons** (dans le fichier **et** en
  base), **rapport d'import** (total, insérés, ignorés, et chaque ligne rejetée avec son numéro et
  son motif : invalide / doublon_fichier / doublon_base).
- Analyseur CSV maison, sans dépendance (champs entre guillemets, virgules et sauts de ligne
  protégés, guillemets doublés, BOM, CRLF) — testé unitairement.
- Insertion atomique dans une transaction `withTenant` (RLS) ; import **tracé au journal d'audit**.
  API `POST /api/import`, UI `/patrimoine/import` (coller du CSV ou choisir un fichier, rapport affiché).

### Incrément 9 — Tableaux de bord d'indicateurs

- **Indicateurs calculés en direct** (aucun chiffre figé/fictif), **isolés par organisme** et
  **gated par rôle** (chaque section n'apparaît que si le rôle a le droit `lire` sur le module).
- **Patrimoine & locatif** : biens actifs, taux d'occupation, contrats actifs, total dû, encaissé
  (imputé), solde, **taux de recouvrement**, appels impayés.
- **Réclamations** : ouvertes, répartition par statut, ordres de travail par statut.
- **Projets & marchés** : projets/marchés actifs, **engagé vs constaté**, avancement financier,
  marchés en **dépassement** et en **retard** (indicatifs).
- **Chaque indicateur affiche sa définition** (brief §11). Page `/tableau-de-bord` (server‑rendue).

### Incrément 10 — Exports CSV tracés

- **Exports CSV** des biens, contrats et impayés (format ouvert), **contrôlés par le droit
  `exporter`** du module A (brief §9), **isolés par organisme** et **tracés au journal d'audit**.
- Sérialiseur CSV conforme RFC 4180 (échappement guillemets/virgules/sauts, BOM UTF‑8).
- API `GET /api/export?type=biens|contrats|impayes` (téléchargement `attachment`), liens
  « Exporter (CSV) » sur les pages patrimoine, contrats et recouvrement (affichés selon le droit).

### Incrément 11 — Verrouillage de connexion (anti‑bruteforce)

- Après **N échecs consécutifs** (défaut 5), le compte est **verrouillé** pour une durée
  configurable (défaut 15 min, `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES`) — brief §9 « limitation
  des tentatives ». Pendant le verrou, même le bon mot de passe est refusé ; une connexion réussie
  remet le compteur à zéro. Message d'erreur **générique** (aucun oracle sur la cause).

### Incrément 12 — Pièces jointes à accès médié

- **Pièces jointes de réclamations** (brief §7/§C) : contenu stocké **hors base** sous une clé
  **opaque préfixée par l'organisme**, **aucun accès direct** — le téléchargement passe par un
  handler qui vérifie **autorisation + propriété** (occupant → sa réclamation uniquement).
- **Contrôle du type** (jpeg/png/pdf → 415 sinon) et de la **taille** (10 Mo → 413) à l'upload.
- Cloisonnement RLS par organisme ; stockage local abstrait (interface `put/get/remove`,
  bascule S3 prévue) ; upload tracé au journal d'audit. Anti path‑traversal sur la clé.
- API `POST/GET /api/reclamations/:id/pieces`, `GET /api/pieces/:id` (téléchargement médié) ;
  UI : section « Pièces jointes » (liste + upload) sur la fiche de réclamation.

### Tests — **118 verts** (`npm test`)

Logique pure (résolution d'organisme, matrice, session, CSRF) **et** intégration réelle sur
PostgreSQL : lecture croisée refusée, identifiant deviné introuvable, écriture croisée refusée
(WITH CHECK), fail‑closed sans organisme, login (bon/mauvais/CSRF), isolation de bout en bout
(agent d'Alger ≠ agent d'Oran), rôle sans droit → 403. **Module A** : CRUD complet d'un bien,
code dupliqué → 409, données invalides → 400, AUDITEUR lit mais ne crée pas (403), bien d'Alger
introuvable pour Oran (404), contrat liant un bien d'un autre organisme → 400, période incohérente
→ 400. **Finances** : appel au montant du loyer par défaut, imputation mettant à jour solde/reste,
imputation dépassant le solde ou le reste → 409, imputation inter‑contrat → 409, imputation
inter‑organisme → 400, liste d'impayés, action de recouvrement isolée par organisme. **Module C** :
dépôt occupant (déclarant forcé, référence auto), un occupant ne voit pas les réclamations d'un
autre (404), qualification refusée à l'occupant (403), AUDITEUR ne peut pas déposer (403),
regroupement de doublons, notes internes masquées au déclarant, OT visible/modifiable seulement
par le technicien affecté (404 sinon), isolation inter‑OPGI. **Module B** : projet/entreprise/
marché, marché référençant un projet d'un autre organisme → 400, dépôt de situation, CHEF_PROJET
vérifie mais ne valide pas (403), GESTIONNAIRE_MARCHES valide, avancement reflétant le constaté
(≠ engagé), alerte dépassement, réception, isolation inter‑OPGI (404). **Audit** : une action
sensible crée une entrée tracée (auteur inclus), journal isolé par organisme, consultation réservée
(technicien → 403, auditeur → 200), **append‑only vérifié** (UPDATE/DELETE par le rôle applicatif
rejetés). **Import** : analyseur CSV (guillemets, virgules/sauts protégés), rapport (insérés/
ignorés), doublon dans le fichier et doublon en base détectés, ligne invalide rejetée, import isolé
par organisme, refusé à un AUDITEUR (403), tracé au journal d'audit. **Indicateurs** : scénario
contrôlé (organisme dédié) → taux d'occupation 60 %, dû/imputé/solde et taux de recouvrement 30 %,
réclamations ouvertes, engagé/constaté agrégés, dépassement et retard détectés. **Exports** :
sérialiseur CSV (échappements), export réservé au droit `exporter` (AGENT_LOCATIF → 403,
AGENT_RECOUVREMENT → 200), contenu attendu, isolation inter‑OPGI, trace d'audit. **Verrouillage** :
5 échecs → compte verrouillé (bon mot de passe refusé), succès remet le compteur à zéro.
**Pièces jointes** : upload (type → 415), téléchargement médié par le propriétaire, refus d'un autre
occupant et d'un autre OPGI (404), liste cloisonnée, upload tracé à l'audit.

Vérifié aussi sur le serveur en marche (`next dev`) : login pose un cookie, `/api/biens` renvoie
uniquement les biens de l'organisme de la session, origine étrangère → 403, en‑têtes CSP présents,
`/tableau-de-bord` sans session → redirection vers `/connexion`.

**Comptes de démonstration** (seed, données fictives) : `OPGI-ALGER` / `OPGI-ORAN`,
e‑mails `*.demo`, mot de passe `Demo-1234!`.

## Intégration continue

Le workflow GitHub Actions `.github/workflows/opgi-ci.yml` s'exécute sur chaque push/PR touchant
`opgi/**` (indépendant de la CI du produit SOUQ AUTO). Il démarre un **PostgreSQL 16 jetable**, crée
le rôle applicatif restreint `opgi_app`, puis enchaîne : `npm ci`, `prisma generate`, `npm run build`
(inclut le typecheck), `tsc --noEmit`, **contrôle de cohérence schéma/migrations** (`prisma migrate
diff --exit-code` → échoue en cas de migration oubliée) et `npm test` (les 85 tests, dont
l'isolation réelle en base). Les mots de passe du workflow sont ceux d'un conteneur jetable, pas des
secrets.

## Deux modes d'exploitation (décision D2 — sélection par configuration)

| `ISOLATION_MODE` | Usage | Isolation |
|---|---|---|
| `shared` (défaut) | Hébergement centralisé mutualisé | Base partagée + `organisationId` + RLS ; organisme = session |
| `dedicated` | Installation chez l'OPGI | Base dédiée ; `ORGANISATION_ID` fixe l'unique organisme |

## Démarrage

### Prérequis
- Node.js 20+, PostgreSQL 16+.
- Rôles : `opgi` (propriétaire, `CREATEDB`) et `opgi_app` (applicatif restreint).

```sql
-- En tant que superutilisateur PostgreSQL :
CREATE ROLE opgi LOGIN PASSWORD 'change-me' CREATEDB;
CREATE DATABASE opgi_dev  OWNER opgi;
CREATE DATABASE opgi_test OWNER opgi;
```

### Installation
```bash
cd opgi
cp .env.example .env            # renseigner les URLs et un SESSION_SECRET fort (>= 16 car.)
npm install --legacy-peer-deps  # (contourne un bug d'arborist npm 10.9 sur les peers optionnels de vitest)
npx prisma migrate deploy       # crée tables + politiques RLS (rôle propriétaire)
# Créer le rôle applicatif + droits (UNE fois par base, en superutilisateur) :
psql -d opgi_dev  -f prisma/provision-roles.sql
psql -d opgi_test -f prisma/provision-roles.sql
npm run db:generate
npm run db:seed                 # 2 OPGI de DÉMONSTRATION (données fictives signalées)
```

### Lancer et vérifier
```bash
npm run dev         # http://localhost:5186  (connexion : voir comptes de démonstration ci-dessus)
npm run build       # build de production — inclut le typecheck Next (génère .next/ + next-env.d.ts)
npm test            # 41 tests (pur + isolation/HTTP réels sur opgi_test)
```

Les tests préparent automatiquement la base `opgi_test` (migrations + droits + seed fictif) via
`tests/global-setup.ts`. Un `tsc --noEmit` isolé nécessite un `npm run build` préalable (Next génère
`next-env.d.ts` et `.next/types`).

## Ce qui reste à faire (honnêtement)

Le socle d'isolation, l'authentification et le Module A (patrimoine/occupants/contrats) sont en
place. Ne sont **pas** encore livrés :

- **Module A — compléments** : hiérarchie du patrimoine (sites → bâtiments → cages → niveaux),
  génération en masse des appels par échéancier, édition via formulaires (la mise à jour est
  exposée par l'API `PATCH` mais sans écran dédié), import initial, reçus/états de compte,
  indicateurs (occupation, encaissements, taux de recouvrement) avec définitions visibles.
- **Module C — compléments** : portail public (déclarant non authentifié avec accusé de réception),
  photos/pièces jointes des réclamations, planification/visites détaillées, cloisonnement
  **prestataire externe** (nécessite un modèle de compte prestataire), indicateurs par zone/délai.
- **Module B — compléments** : planning (jalons/tâches), ordres de service et avenants, lots,
  pièces justificatives, écrans d'édition dédiés (le `PATCH` existe en API), exports.
- **Audit — compléments** : instrumentation des créations de compte/permissions et des exports
  (à venir avec ces fonctions), pagination/filtres du journal, politique de conservation (après C5).
- **Notifications** (internes, puis email/SMS optionnels), pagination/recherche. Pièces jointes :
  extension aux autres modules (documents de contrats, marchés) et analyse antivirus selon
  l'environnement. Exports : états/reçus en PDF (le CSV est livré). Import : extension aux
  marchés/projets. Tableaux de bord : séries temporelles et graphiques.
- **Durcissement CSP** avec nonces (aujourd'hui `unsafe-inline`/`unsafe-eval` tolérés pour Next).
- Rotation/révocation de session, 2FA (le **verrouillage anti‑bruteforce** est livré).
- **Rôle `opgi_app` portable en CI** (aujourd'hui prérequis documenté) et workflow CI dédié.
- **AR/RTL** réellement activé (architecture en place, Phase 7).
- Les 4 autres tests d'isolation du plan (recherche, export, pièces jointes, admin plateforme) :
  ils s'attacheront quand ces surfaces existeront (voir `../docs/opgi/02-ISOLATION-MULTI-OPGI.md`).

Aucune règle métier ou juridique n'est inventée : barèmes, délais, pénalités, durées de conservation
restent configurables et « à valider » (voir `../docs/opgi/04` et `05`).
