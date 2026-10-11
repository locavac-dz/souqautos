# Contribuer a Souq Autos

Merci de votre interet pour Souq Autos. Ce projet est la propriete d'Ingenica Civil EURL. Les contributions externes sont les bienvenues sous reserve d'accord prealable.

## Avant de contribuer

1. Ouvrez une **issue** pour discuter du changement propose avant de coder
2. Attendez la validation d'un mainteneur avant de soumettre une pull request
3. Lisez [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) pour comprendre la structure du projet

## Mise en place de l'environnement

```bash
cd app
cp .env.example .env
# Renseigner DATABASE_URL (PostgreSQL 15+)
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Voir [app/README.md](app/README.md) pour les details (creation du role PostgreSQL, base e2e, annonces de demo).

## Conventions de code

### Langages et outils

- **TypeScript** strict — zero erreur `tsc --noEmit`
- **ESLint** — zero warning `npm run lint`
- **Vitest** — tous les tests passent `npm run test`
- **Tailwind CSS 4** pour le style

### Style

- Pas de commentaires sauf quand le « pourquoi » n'est pas evident
- Noms de variables et fonctions en anglais, commentaires en francais
- Validation des entrees avec **zod** sur toutes les routes mutatrices
- Routes API enveloppees avec `apiHandler` (voir `src/lib/api-route.ts`)

### Internationalisation

- Toute chaine visible par l'utilisateur passe par `next-intl`
- Cles dans `messages/fr.json` et `messages/ar.json` (les deux sont obligatoires)
- Verifier avec `npm run i18n:check`

### Base de donnees

- Schema dans `prisma/schema.prisma`
- Migrations generees avec `npx prisma migrate dev --name lot_XXX_description`
- Ne jamais modifier une migration existante

## Workflow de contribution

1. **Fork** le repo et creez une branche descriptive (`lot-XXX-description`)
2. **Codez** en respectant les conventions ci-dessus
3. **Testez** :
   ```bash
   npm run test        # tests unitaires
   npm run lint        # lint
   npx tsc --noEmit    # types
   ```
4. **Commitez** avec un message clair :
   ```
   Lot XXX : description courte du changement
   ```
5. **Poussez** et ouvrez une pull request contre `master`

## Structure d'une pull request

- **Titre** : `Lot XXX : description courte`
- **Description** : contexte, ce qui a change, comment tester
- **Tests** : nouveaux tests ajoutes ou existants mis a jour
- **Screenshots** : pour les changements visuels (FR et AR)

## Ce qu'on attend

- Correction minimale — ne pas refactorer au-dela du necessaire
- Pas de dependances superflues
- Dark mode supporte (classes `dark:`)
- RTL supporte pour l'arabe
- Responsive (mobile-first)

## Signaler un bug

Ouvrez une issue avec :

- Description du probleme
- Etapes pour reproduire
- Comportement attendu vs observe
- Navigateur et version (si applicable)

## Questions

Pour toute question : **contact@souqautos.com**
