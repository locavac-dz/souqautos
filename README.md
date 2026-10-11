# Souq Autos

Marketplace automobile algerienne — achat, vente et estimation de vehicules neufs et d'occasion.

**[souqautos.com](https://souqautos.com)**

## Fonctionnalites

- **Annonces** — publication en 11 etapes, photos, formules (gratuit / premium / premium+), renouvellement, archivage automatique
- **Recherche avancee** — filtres (marque, modele, generation, wilaya, prix, kilometrage, carburant, boite, carrosserie), autocompletion, tri par date/prix/pertinence
- **Cote Souq Auto** — estimateur de prix base sur les annonces du marche, avec indice de confiance
- **Comparateur** — comparaison cote a cote de vehicules
- **Catalogue** — marques, modeles, generations, fiches techniques
- **Comptes pro** — vitrine, abonnements, collaborateurs avec roles (gererAnnonces, gererVitrine, gererAbonnement)
- **Messagerie** — conversations vendeur/acheteur, messages vocaux, offres de prix
- **Magazine & Essais** — articles editoriaux et essais routiers avec notes, points forts/faibles
- **Administration** — moderation, anti-fraude (score + analyse IA), gestion des utilisateurs, roles (Admin, Moderateur, Support), journal d'audit
- **Paiement** — virement bancaire et Chargily Pay (CIB / Edahabia)
- **Securite** — JWT avec revocation individuelle, 2FA TOTP, verrouillage de compte, rate limiting, CSRF middleware, CSP headers
- **i18n** — francais et arabe (RTL complet)
- **PWA** — installation sur mobile, notifications push, mode hors-ligne
- **SEO** — sitemap dynamique, JSON-LD, meta OG, ISR

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Framework | Next.js 16 (App Router) |
| Langage | TypeScript |
| UI | React 19, Tailwind CSS 4 |
| Base de donnees | PostgreSQL 17, Prisma 6 (60 modeles, 29 enums) |
| Internationalisation | next-intl (FR / AR RTL) |
| Tests | Vitest (2 465 tests), Playwright (e2e) |
| Mobile | Capacitor (Android), PWA |
| Paiement | Chargily Pay |
| IA | Claude API (analyse anti-fraude) |

## Demarrage rapide

### Prerequis

- Node.js 20+
- PostgreSQL 15+ (17 recommande)

### Installation

```bash
# Creer le role et les bases PostgreSQL
psql -U postgres
```

```sql
CREATE ROLE souq_auto LOGIN PASSWORD 'votre_mot_de_passe' CREATEDB;
CREATE DATABASE souq_auto OWNER souq_auto;
CREATE DATABASE souq_auto_e2e OWNER souq_auto;
```

```bash
cd app
cp .env.example .env
# Renseigner DATABASE_URL et E2E_DATABASE_URL dans .env

npm install
npx prisma migrate deploy
npm run db:seed          # referentiel (69 wilayas, 1541 communes, catalogue)
npm run db:seed:demo     # annonces de demonstration (optionnel)
npm run dev
```

L'application demarre sur [http://localhost:5184](http://localhost:5184).

### Scripts utiles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Serveur de developpement |
| `npm run build` | Build de production |
| `npm run test` | Tests unitaires (Vitest) |
| `npm run test:e2e` | Tests end-to-end (Playwright) |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed referentiel |
| `npm run db:seed:demo` | Seed annonces de demo |
| `npm run i18n:check` | Verification cles i18n FR/AR |
| `npm run launch:check` | Verification pre-deploiement |

## Architecture

```
app/
  prisma/              # Schema, migrations, seeds
  src/
    app/
      [locale]/        # 102 pages (FR/AR)
      api/             # 124 routes API
    components/        # Composants React
    lib/               # Logique metier, validations, utilitaires
  tests/               # 221 fichiers de test
  e2e/                 # Tests Playwright
  public/              # Assets statiques
docs/                  # Architecture, guides
CHANGELOG.md           # Journal des lots
```

Voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour le cahier d'architecture complet et [CHANGELOG.md](CHANGELOG.md) pour l'historique des lots.

## Qualite

- **2 465+ tests** unitaires et d'integration (Vitest)
- **Audit AL HANDASSA QA** — score 91/100
- TypeScript strict, ESLint, zero erreur de compilation
- CSRF middleware, CSP headers, rate limiting, anti-fraude

## Licence

Projet prive — Ingenica Civil EURL. Tous droits reserves.
