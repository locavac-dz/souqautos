<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Règles du projet (apprises en rétablissant la CI ; les gardes-fous automatiques sont cités)

Plusieurs sessions (développement, correction de la CI) travaillent sur ce dépôt. Pour ne pas se marcher dessus :

- **Avant tout travail : `git pull origin master`.** Ne jamais forcer un push (`--force`) sur `master` ni sur la branche d'un autre. Les correctifs de CI passent par une branche et une PR, jamais directement sur `master`.
- **Un seul fichier proxy.** Next.js 16 refuse `src/middleware.ts` à côté de `src/proxy.ts` (le build de production et le serveur e2e s'arrêtent). Toute logique de requête (CSRF, CSP, langue) va dans `src/proxy.ts`, qui appelle des fonctions pures de `src/lib/` (ex. `csrf.ts`). Le matcher doit couvrir `/api/:path*` ET les pages.
- **Pas de `loading.tsx` au-dessus d'une page publique qui peut répondre 404.** Un `loading.tsx` fait diffuser la page en flux : le statut 200 part avant `notFound()`, et le code ne peut plus changer (soft 404). Il enveloppe aussi les routes imbriquées. Pour garder un squelette, vérifier l'existence dans un `layout.tsx` du segment (voir `annonce/[id]/layout.tsx`). Garde-fou : `tests/loading-not-found.test.ts`.
- **Un fichier `"use server"` n'exporte que des fonctions asynchrones** (et des types). Une constante exportée fait échouer le chargement du module à l'exécution. Les constantes vont dans un module voisin (ex. `price-estimate-limits.ts`). Garde-fou : `tests/use-server-exports.test.ts`.
- **Codes HTTP d'authentification (lot 279) :** sans session → `401 unauthenticated` ; connecté mais rôle insuffisant → `403`. Les tests e2e doivent suivre cette convention (table dans `src/lib/http.ts`).
- **Accessibilité :** tout contenu global (bandeau, avis) doit se trouver dans un repère (`<aside aria-label>`, `<header>`, `<main>`, `<footer>`) : l'audit axe de l'e2e échoue sinon (règle `region`).
- **La compilation n'a pas de base de données.** Aucune page ni route ne doit lire la base au prérendu sans tolérer son absence pendant `NEXT_PHASE=phase-production-build` (voir `src/app/sitemap.ts`) ; en service, l'erreur reste propagée.
- **La CI définit `NEXT_PUBLIC_SITE_URL=http://localhost:5185`** : un test qui suppose une origine doit la fixer lui-même (`vi.stubEnv`).
- **Écart schéma / migrations :** les trois index GIN `pg_trgm` créés en SQL brut sont tolérés (`src/lib/schema-drift.ts`) ; tout autre écart est une migration oubliée.
- **Avant de pousser :** `npx tsc --noEmit`, `npm run lint`, `npm test`. L'e2e ne tourne qu'en CI (PostgreSQL requis, ~45 min).
