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

**Annonces de démonstration** (développement et recette seulement, jamais en production) : `npm run db:seed:demo` crée des comptes vendeurs et 24 annonces avec une **vraie photo du modèle**. Ces photos viennent de Wikimedia Commons sous licence libre (dossier `prisma/demo-photos/`, crédits dans `CREDITS.json` et `README.md`) ; l'auteur, la licence et le lien source sont affichés sous la photo de l'annonce, comme les licences CC BY / CC BY-SA l'exigent. Sur une base créée avant le Lot 125, `npm run db:demo-photos` remplace les anciens visuels de texte par ces photos (sans effet s'ils y sont déjà).

### Sans accès administrateur à PostgreSQL (Windows)

Si le mot de passe du compte `postgres` de l'installation est inconnu, on peut créer un serveur PostgreSQL indépendant, dédié au projet (dossier de données dans le profil utilisateur, hors du dépôt, port 5433, accessible seulement depuis ce PC, tri français ICU) avec les outils déjà installés :

```powershell
$bin = "C:\Program Files\PostgreSQL\17\bin"
"le-mot-de-passe-du-rôle-souq_auto" | Set-Content $env:TEMP\pw.txt -NoNewline
& "$bin\initdb.exe" -D "$env:USERPROFILE\souq-auto-pgdata" -U souq_auto --pwfile=$env:TEMP\pw.txt -A scram-sha-256 -E UTF8 --locale=C --locale-provider=icu --icu-locale=fr-FR
Remove-Item $env:TEMP\pw.txt
powershell -File scripts/dev-db.ps1 start
$env:PGPASSWORD = "le-mot-de-passe-du-rôle-souq_auto"
& "$bin\createdb.exe" -h localhost -p 5433 -U souq_auto souq_auto
& "$bin\createdb.exe" -h localhost -p 5433 -U souq_auto souq_auto_e2e
```

Ensuite `DATABASE_URL` / `E2E_DATABASE_URL` pointent sur `localhost:5433`. Ce serveur ne redémarre pas seul avec Windows : `powershell -File scripts/dev-db.ps1 start` (aussi `stop` et `status`) avant de lancer le site. Attention : Next n'accepte qu'un seul serveur de développement à la fois dans ce dossier, donc arrêter `npm run dev` avant `npm run test:e2e`.

## Tests

```bash
npm test            # tests unitaires (trois fichiers créent une base temporaire s'ils le peuvent, et se sautent sinon : backup-chain, search-equivalence, price-estimation-equivalence)
npm run test:e2e    # tests de bout en bout Playwright, sur la base E2E_DATABASE_URL (vidée à chaque exécution)
npm run test:e2e:pwa # application installable : service worker et mode hors connexion, sur une version de PRODUCTION (compile puis démarre sur le port 5186)
npm run verify      # équivalent local de la chaîne d'intégration (types, lint, tests, écart schéma/migrations) ; `-- --e2e` ajoute les tests de bout en bout
```

## Dépannage

**Tests de sauvegarde échouent avec « permission denied to create database »**

Les tests `backup-chain` (`npm run db:restore-check`) créent une base temporaire. Le rôle `souq_auto` doit avoir `CREATEDB` (déjà inclus dans `CREATE ROLE … CREATEDB` ci-dessus ; absent si le rôle a été créé différemment) :

```sql
ALTER ROLE souq_auto CREATEDB;
```

Après cette commande, relancer `npm test` : les 6 tests concernés repassent au vert.

## Mise en production

Ne jamais réutiliser la base de développement : elle contient des comptes et des annonces de démonstration.

1. **Base neuve** sur le serveur PostgreSQL de production, avec une collation française/Unicode et un rôle dédié au mot de passe fort.
2. **Configuration** : partir de `.env.example` (section « Mise en production ») — `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY`, `NEXT_PUBLIC_SITE_URL` (https), `SMTP_*`, `TRUSTED_PROXY_HOPS`, `VAPID_*` (notifications push, `npm run push:keys -- --print`), `ADMIN_EMAIL` / `ADMIN_PASSWORD`, et si possible `REDIS_URL` et `S3_*`.
3. **Schéma et données de référence** : `npx prisma migrate deploy` puis `npm run db:seed` (wilayas, communes, catalogue, équipements et **votre** compte administrateur). **Jamais** `npm run db:seed:demo`.
4. **Contrôle** : `npm run launch:check` (ou `npm run launch:check -- --env chemin/du/fichier.env`). Il doit répondre « Prêt » : chaque point bloquant (✗) est expliqué avec sa correction.
5. **Démarrage** : `npm run build` puis `npm run start`, derrière un serveur web en https.
6. **Supervision** : surveiller `GET /api/health` (200 = base joignable, 503 = base injoignable ; Redis absent ou en panne ne fait pas échouer le contrôle).

## Notes

- `.env` contient un `JWT_SECRET` de dev généré aléatoirement — à régénérer en production (`openssl rand -base64 48`).
- Base PostgreSQL, migrations dans `prisma/migrations/` (une baseline unique depuis le Lot 109 ; l'historique SQLite antérieur reste dans git). En production, créer la base avec une **collation française/Unicode** (par ex. `fr_FR.UTF-8`) et non la collation `C`, qui trie les noms accentués (Aïn Defla, Béjaïa…) après « Z ». PostGIS, prévu à l'origine, n'est pas utilisé.
- Limites de débit : Redis dès que `REDIS_URL` est défini (partagé entre instances), sinon repli en mémoire par instance (purgé périodiquement) — suffisant pour un seul serveur ; `launch:check` le rappelle.
- Photos (annonces, avatars, pièces jointes, logos, couvertures) : stockage S3-compatible dès que `S3_*` est défini (`src/lib/storage.ts`), sinon disque local sous `public/uploads/` (gitignoré) — à sauvegarder avec la base dans ce cas (`npm run db:backup -- --with-uploads`).
- Si `next build` a été lancé, vider `.next` avant de relancer `npm run dev` (les caches de build et de dev ne sont pas interchangeables ; le serveur de dev tourne avec `--webpack`).
- Sous Windows, lancer `npm test` depuis Git Bash plutôt que PowerShell : `tests/backup-chain.test.ts` appelle `tar` et le `tar` Windows ne comprend pas les chemins `/c/…` (trois faux échecs sinon). `npx prisma generate` exige que le serveur de dev soit arrêté (verrou du moteur de requêtes).
- Compte admin de dev créé par `npm run db:seed` : `admin@souqauto.com` / `AdminSouqAuto2026!` (convention groupe : `admin@<nom-court-du-site>`, sur le domaine réel de chaque projet). **En production**, ce compte n'est jamais créé : `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont obligatoires (Lot 117).
- Depuis le Lot 7, toute nouvelle annonce est créée en statut `EN_ATTENTE` et doit être approuvée dans `/admin/annonces` avant d'apparaître dans la recherche.
