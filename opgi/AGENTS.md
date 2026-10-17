<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Règles du projet OPGI

Projet `opgi/` : plateforme multi‑organisme, **indépendant** du produit SOUQ AUTO (`../app/`).
Cadrage complet dans `../docs/opgi/`.

- **Isolation d'abord.** Toute table métier porte `organisationId` non null. Tout accès aux données
  passe par le rôle restreint `opgi_app` + `withTenant` (RLS). Le rôle propriétaire `opgi` est
  réservé aux migrations/seed et au seul bootstrap d'authentification (`src/lib/auth/authenticate.ts`).
- **L'organisme vient de la session serveur**, jamais d'une entrée client (`src/lib/tenant/resolve.ts`).
- **Imports internes en alias `@/`** (sans extension), pas de `../x.js` — compatibilité build Next.
- **Logique de sécurité dans des modules framework‑agnostiques** (`src/lib`, `src/http`) testés par
  Vitest ; les routes Next (`src/app/api/*`) ne font que déléguer.
- **Un seul fichier proxy** (`src/proxy.ts`) pour la logique de requête (CSRF d'origine).
- **Avant de pousser :** `npm run build` (inclut le typecheck Next) puis `npm test`. Les tests
  d'isolation/HTTP exigent PostgreSQL (rôles `opgi`/`opgi_app`, voir README).
- **Jamais de règle métier/juridique inventée** : barèmes, délais, pénalités, rétention restent
  configurables et « à valider » (voir `../docs/opgi/04` et `05`).
