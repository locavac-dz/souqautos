# Souq Auto — app

Marketplace automobile algérienne (Ingenica Civil EURL). Voir [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) pour le cahier d'architecture et [../CHANGELOG.md](../CHANGELOG.md) pour l'avancement lot par lot.

Stack : Next.js 16 (App Router, TypeScript) · Prisma · PostgreSQL (dev, tests, production) · next-intl (FR/AR RTL) · Tailwind CSS.

## Démarrer en dev

Prérequis : un serveur PostgreSQL (17 en dev ; 15 ou plus recommandé). Créer un rôle et deux bases, une pour le développement et une pour les tests de bout en bout (dont le nom **doit** finir par `_e2e`) :

```sql
CREATE ROLE souq_auto LOGIN PASSWORD '...' CREATEDB;   -- CREATEDB : Prisma crée sa base « fantôme » pour `migrate dev`
CREATE DATABASE souq_auto OWNER souq_auto;
CREATE DATABASE souq_auto_e2e OWNER souq_auto;
```

Copier `.env.example` vers `.env` et renseigner `DATABASE_URL` et `E2E_DATABASE_URL`, puis :

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

App sur http://localhost:5184 (redirige vers `/fr`).

## Tests

```bash
npm test            # tests unitaires (aucun n'accède à la base)
npm run test:e2e    # tests de bout en bout Playwright, sur la base E2E_DATABASE_URL (vidée à chaque exécution)
```

## Notes

- `.env` contient un `JWT_SECRET` de dev généré aléatoirement — à régénérer en production (`openssl rand -base64 48`).
- Base PostgreSQL, migrations dans `prisma/migrations/` (une baseline unique depuis le Lot 109 ; l'historique SQLite antérieur reste dans git). En production, créer la base avec une **collation française/Unicode** (par ex. `fr_FR.UTF-8`) et non la collation `C`, qui trie les noms accentués (Aïn Defla, Béjaïa…) après « Z ». PostGIS, prévu à l'origine, n'est pas utilisé.
- Rate limiting des endpoints d'auth actuellement en mémoire (mono-instance) — à remplacer par Redis dès le passage multi-instance.
- Schéma Lot 1 volontairement minimal (`User`, `Profile`, `Wilaya`) — `communes` et les autres tables du cahier d'architecture arriveront avec les modules qui en ont besoin.
- Photos d'annonces stockées localement sous `public/uploads/` (gitignoré) — à migrer vers un stockage S3-compatible en staging/prod (cf. docs/ARCHITECTURE.md §06).
- Si `next build` a été lancé, vider `.next` avant de relancer `npm run dev` (les caches de build et de dev de Turbopack ne sont pas interchangeables).
- Compte admin de dev créé par `npm run db:seed` : `admin@souqauto.dz` / `AdminSouqAuto2026!` — à régénérer avant tout déploiement réel (convention groupe : `admin@<nom-court>.dz`).
- Depuis le Lot 7, toute nouvelle annonce est créée en statut `EN_ATTENTE` et doit être approuvée dans `/admin/annonces` avant d'apparaître dans la recherche.
