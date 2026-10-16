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

### Tests — **41 verts** (`npm test`)

Logique pure (résolution d'organisme, matrice, session, CSRF) **et** intégration réelle sur
PostgreSQL : lecture croisée refusée, identifiant deviné introuvable, écriture croisée refusée
(WITH CHECK), fail‑closed sans organisme, login (bon/mauvais/CSRF), isolation de bout en bout
(agent d'Alger ≠ agent d'Oran), rôle sans droit → 403.

Vérifié aussi sur le serveur en marche (`next dev`) : login pose un cookie, `/api/biens` renvoie
uniquement les biens de l'organisme de la session, origine étrangère → 403, en‑têtes CSP présents,
`/tableau-de-bord` sans session → redirection vers `/connexion`.

**Comptes de démonstration** (seed, données fictives) : `OPGI-ALGER` / `OPGI-ORAN`,
e‑mails `*.demo`, mot de passe `Demo-1234!`.

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

Le socle d'isolation et l'authentification sont en place. Ne sont **pas** encore livrés :

- **Modules A/B/C** (patrimoine complet, projets/marchés, réclamations) — Phases 2‑4. Seule une
  lecture minimale des `Bien` existe aujourd'hui, pour démontrer la chaîne d'accès isolée.
- **Journal d'audit persistant**, gestion des fichiers à accès médié, notifications.
- **CRUD complet** (création/édition via formulaires), pagination, recherche.
- **Durcissement CSP** avec nonces (aujourd'hui `unsafe-inline`/`unsafe-eval` tolérés pour Next).
- **Verrouillage de connexion** (anti‑bruteforce), rotation/révocation de session, 2FA.
- **Rôle `opgi_app` portable en CI** (aujourd'hui prérequis documenté) et workflow CI dédié.
- **AR/RTL** réellement activé (architecture en place, Phase 7).
- Les 4 autres tests d'isolation du plan (recherche, export, pièces jointes, admin plateforme) :
  ils s'attacheront quand ces surfaces existeront (voir `../docs/opgi/02-ISOLATION-MULTI-OPGI.md`).

Aucune règle métier ou juridique n'est inventée : barèmes, délais, pénalités, durées de conservation
restent configurables et « à valider » (voir `../docs/opgi/04` et `05`).
