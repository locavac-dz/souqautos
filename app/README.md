# Souq Auto — app

Marketplace automobile algérienne (Ingenica Civil EURL). Voir [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) pour le cahier d'architecture et [../CHANGELOG.md](../CHANGELOG.md) pour l'avancement lot par lot.

Stack : Next.js 16 (App Router, TypeScript) · Prisma · SQLite en dev / PostgreSQL visé en staging-prod · next-intl (FR/AR RTL) · Tailwind CSS.

## Démarrer en dev

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

App sur http://localhost:5184 (redirige vers `/fr`).

## Tests

```bash
npm test
```

## Notes

- `.env` contient un `JWT_SECRET` de dev généré aléatoirement — à régénérer en production (`openssl rand -base64 48`).
- Base SQLite locale (`prisma/dev.db`), migrations dans `prisma/migrations/`. Cible PostgreSQL + PostGIS en staging/prod (cf. docs/ARCHITECTURE.md §06) — la bascule se fera par migration Prisma dédiée quand l'infra sera disponible.
- Rate limiting des endpoints d'auth actuellement en mémoire (mono-instance) — à remplacer par Redis dès le passage multi-instance.
- Schéma Lot 1 volontairement minimal (`User`, `Profile`, `Wilaya`) — `communes` et les autres tables du cahier d'architecture arriveront avec les modules qui en ont besoin.
- Photos d'annonces stockées localement sous `public/uploads/` (gitignoré) — à migrer vers un stockage S3-compatible en staging/prod (cf. docs/ARCHITECTURE.md §06).
- Si `next build` a été lancé, vider `.next` avant de relancer `npm run dev` (les caches de build et de dev de Turbopack ne sont pas interchangeables).
- Compte admin de dev créé par `npm run db:seed` : `admin@souqauto.dz` / `AdminSouqAuto2026!` — à régénérer avant tout déploiement réel (convention groupe : `admin@<nom-court>.dz`).
- Depuis le Lot 7, toute nouvelle annonce est créée en statut `EN_ATTENTE` et doit être approuvée dans `/admin/annonces` avant d'apparaître dans la recherche.
