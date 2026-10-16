# Plateforme OPGI — socle multi‑organisme

Plateforme intégrée de gestion des OPGI algériens (INGÉNICA CIVIL). Ce dossier `opgi/` est un
projet **indépendant** du produit SOUQ AUTO (`app/`), avec lequel il partage uniquement les
**conventions** d'ingénierie (TypeScript strict, Prisma/PostgreSQL, migrations versionnées).

> **Statut : Phase 1 en cours — socle d'isolation.** Voir `../docs/opgi/` pour le cadrage complet
> (vision, architecture, matrice des rôles, registres d'hypothèses et de conformité, plan par phases).

## Ce que cet incrément livre (vérifiable)

Le **socle d'isolation inter‑organisme**, démontré **avant** toute donnée métier sensible :

- **Schéma multi‑tenant** (`prisma/schema.prisma`) : `Organisation`, `Utilisateur`, `Bien` — toute
  table métier porte `organisationId` **non null**. Schéma **identique** pour les deux modes
  d'exploitation (décision D2).
- **Isolation à deux niveaux (défense en profondeur)** :
  1. **couche applicative** — `src/lib/tenant/` résout l'organisme depuis la **session serveur**
     (jamais le client) et exécute chaque requête sous cet organisme ;
  2. **Row-Level Security PostgreSQL** (`prisma/migrations/*/rls.sql`) — filet « fail closed » :
     sans organisme fixé, le rôle applicatif ne voit **rien**.
- **Rôle applicatif restreint `opgi_app`** (soumis RLS), séparé du rôle propriétaire `opgi`
  (migrations/seed) — `prisma/provision-roles.sql`.
- **Matrice des permissions** (`src/lib/authz/`) : rôle × module × action, moindre privilège,
  séparation stricte admin plateforme ↔ métier.
- **21 tests verts** (`npm test`), dont **tests d'isolation réels contre PostgreSQL** :
  lecture croisée refusée, identifiant deviné introuvable, écriture croisée refusée (WITH CHECK),
  fail‑closed sans organisme, table organisation cloisonnée.

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
cp .env.example .env            # renseigner les URLs et SESSION_SECRET
npm install --legacy-peer-deps  # (contourne un bug d'arborist npm 10.9 sur les peers optionnels de vitest)
npx prisma migrate deploy       # crée tables + politiques RLS (rôle propriétaire)
# Créer le rôle applicatif + droits (UNE fois par base, en superutilisateur) :
psql -d opgi_dev  -f prisma/provision-roles.sql
psql -d opgi_test -f prisma/provision-roles.sql
npm run db:generate
npm run db:seed                 # 2 OPGI de DÉMONSTRATION (données fictives signalées)
```

### Vérifier
```bash
npm run typecheck   # tsc --noEmit
npm test            # 21 tests (pur + isolation réelle sur opgi_test)
```

Les tests préparent automatiquement la base `opgi_test` (migrations + droits + seed fictif) via
`tests/global-setup.ts`.

## Ce qui reste à faire (honnêtement)

Cet incrément établit **uniquement** la propriété d'isolation. Ne sont **pas** encore livrés :

- Couche HTTP / UI Next.js (auth, sessions signées, proxy CSRF/CSP, i18n FR/AR) — incrément suivant.
- Les modules A/B/C (patrimoine, projets/marchés, réclamations) — Phases 2‑4.
- Journal d'audit persistant, gestion des fichiers à accès médié, notifications.
- Les 4 autres tests d'isolation du plan (recherche, export, pièces jointes, admin plateforme) :
  ils s'attacheront quand ces fonctionnalités existeront (voir `../docs/opgi/02-ISOLATION-MULTI-OPGI.md`).
- Création du rôle `opgi_app` portable en CI (aujourd'hui prérequis documenté).

Aucune règle métier ou juridique n'est inventée : barèmes, délais, pénalités, durées de conservation
restent configurables et « à valider » (voir `../docs/opgi/04` et `05`).
