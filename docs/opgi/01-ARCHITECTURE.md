# 01 — État du dépôt, décisions d'architecture, déploiement

## 1. État du dépôt constaté (inspection du 2026-10-16)

Le dépôt `souqautos` contient **une application existante, mature et en production** :
**SOUQ AUTO**, marketplace automobile algérienne d'INGÉNICA CIVIL. Ce **n'est pas** une base de
départ vide ; c'est un produit différent du produit OPGI demandé.

### Technologies constatées (produit SOUQ AUTO, `app/`)

| Couche | Technologie | Version |
|---|---|---|
| Framework | Next.js (App Router, `--webpack`) | 16.3.4 |
| Langage | TypeScript (strict) | 5.x |
| UI | React, Tailwind CSS | 19.2 / 4 |
| ORM / BDD | Prisma / PostgreSQL | 6.19 / 17 |
| i18n | next-intl (FR + AR, **RTL complet**) | 4.14 |
| Auth | JWT `jose` + bcrypt, 2FA TOTP, révocation de session | — |
| Stockage | Disque local **ou** S3 (`@aws-sdk/client-s3`) | — |
| Cache / rate-limit | Redis (`ioredis`) **ou** repli mémoire mono‑instance | — |
| Tests | Vitest (~2 465) + Playwright (e2e) | 4.x / 1.63 |
| Mobile / PWA | Capacitor (Android), PWA | — |
| Modèle de données | ~64 modèles, ~30 enums, 68 migrations | — |

### Observations déterminantes pour l'OPGI

1. **SOUQ AUTO est mono‑organisme.** Le modèle `User` porte un `Role` **global**
   (`PARTICULIER`…`SUPER_ADMIN`) ; il n'existe **aucune** notion d'`organisation`/`tenant`.
   La plateforme OPGI exige au contraire une **isolation multi‑organisme stricte** dès le socle.
   → Le modèle d'autorisation de SOUQ AUTO n'est **pas réutilisable tel quel** ; les **patterns**
   (JWT, 2FA, audit, CSRF, CSP, rate-limit, uploads, migrations versionnées) le sont.
2. **Discipline d'ingénierie forte à respecter** (voir `app/AGENTS.md`) : un seul `src/proxy.ts`,
   règles sur `loading.tsx`/`"use server"`, codes HTTP 401/403 normalisés, accessibilité axe,
   « la compilation n'a pas de base de données », gardes-fous testés, `tsc --noEmit` + lint + test
   avant tout push. Le produit OPGI adoptera les **mêmes conventions**.
3. **Cadrage avant code** est la culture du dépôt (`docs/ARCHITECTURE.md` = « Lot 0 »).
4. **Déploiement déjà outillé** : `Dockerfile`, `docker-compose.example.yml`, `docs/DEPLOIEMENT.md`,
   `docs/EXPLOITATION.md`, scripts `db:backup`/`restore-check`/`ops-check`/`launch-check`.
   Réutilisables comme modèle pour les **deux modes** d'exploitation OPGI.

## 2. Risques et décisions d'architecture prioritaires

| # | Décision | Risque si mal tranchée | Recommandation provisoire |
|---|---|---|---|
| D1 | **Emplacement du code** OPGI | Mélanger deux produits dans `app/` casse le modèle mono‑tenant de SOUQ AUTO et fragilise la marketplace en production | **Projet séparé `opgi/`** à la racine, sœur de `app/` — stack identique, déploiement indépendant. *(Question bloquante — voir §4.)* |
| D2 | **Modèle d'isolation** multi‑OPGI | Fuite inter‑organismes = défaut produit rédhibitoire et risque juridique | **Base partagée + colonne `organisationId` obligatoire + Row‑Level Security PostgreSQL** comme filet serveur, pour le mode centralisé ; **une base par OPGI** pour le mode « installé chez l'OPGI ». *(Voir `02-ISOLATION-MULTI-OPGI.md`.)* |
| D3 | **Preuve d'appartenance** | Faire confiance à un `organisationId` du navigateur = contournable | L'organisme **déduit de la session serveur** uniquement ; jamais d'un en‑tête/paramètre client. |
| D4 | **Stockage des fichiers** | Pièces accessibles en direct = fuite | Accès **médié** par contrôle d'autorisation (jamais d'URL publique devinable) ; clé d'objet préfixée par organisme. |
| D5 | **Activation des modules** | Code spécifique client qui fragilise le tronc commun | Modules A/B/C **activables par configuration** par OPGI ; spécificités client isolées derrière des options/adaptateurs. |
| D6 | **Workflows et calculs** | Règles métier/juridiques inventées | Tout paramétrable (statuts, délais, taux) ; valeurs par défaut marquées « à valider ». |
| D7 | **Portabilité local ↔ centralisé** | Enfermement, migration impossible | Export/restauration documentés ; schéma identique entre les deux modes ; différence limitée à la stratégie d'isolation (schéma/base vs RLS). |

## 3. Architecture cible proposée (cohérente avec le dépôt)

Réutiliser la stack éprouvée de `app/`, **sans** réutiliser son modèle d'autorisation mono‑tenant :

```
souqautos/
  app/                      # SOUQ AUTO (existant — NON touché par le produit OPGI)
  opgi/                     # (proposé, D1) nouveau projet, stack identique
    prisma/                 # schéma multi‑tenant, migrations versionnées
    src/
      app/[locale]/         # UI FR par défaut, AR/RTL prévu
      app/api/              # routes API, autorisation vérifiée côté serveur
      lib/
        tenant/             # résolution d'organisme (session → organisationId), garde serveur
        authz/              # permissions rôle × module × action × périmètre
        audit/              # journal d'audit protégé
        modules/A|B|C/      # logique métier par module activable
    e2e/                    # tests Playwright, dont isolation inter‑OPGI
  docs/opgi/                # ce dossier de cadrage
```

Principes transverses (repris de SOUQ AUTO) :
- **Un seul proxy** de requêtes (CSRF d'origine, CSP, langue) appelant des fonctions pures de `lib/`.
- **Autorisation côté serveur sur chaque requête**, tâche de fond, export et accès fichier.
- **Migrations versionnées** ; « la compilation n'a pas de base de données ».
- **Secrets par environnement** (`.env` par instance) ; chiffrement au repos des données sensibles.
- **Dev / recette / production séparés** ; données de production interdites en test.

> **À confirmer après D1 :** si le porteur préfère éviter un second projet dans ce dépôt,
> l'alternative est un dépôt dédié `opgi` (meilleure séparation produit, mais hors de la branche
> actuelle). La consigne de travail impose la branche `claude/plateforme-opgi-algeriens-pryzm4` de
> **ce** dépôt ; l'option `opgi/` sœur de `app/` respecte à la fois la consigne et la séparation.

## 4. Questions bloquantes (empêchent de démarrer le code)

1. **D1 — Emplacement :** nouveau projet `opgi/` dans ce dépôt (recommandé), ou dépôt séparé ?
2. **D2 — Mode d'exploitation prioritaire du pilote :** installé chez l'OPGI (une base dédiée) ou
   hébergement centralisé mutualisé (base partagée + RLS) ? Détermine la stratégie d'isolation par défaut.
3. **OPGI pilote :** un organisme pilote est‑il identifié (Phase 0 du prompt) pour cadrer processus,
   volumes, formulaires et documents réels ?

Les autres inconnues ne bloquent **pas** un premier incrément : elles sont dans
`04-REGISTRE-HYPOTHESES.md` avec des choix provisoires configurables.

## 5. Déploiement — deux modes (à détailler en Phase 5)

### Option 1 — Installation chez l'OPGI
Instance autonome sur infrastructure contrôlée par l'OPGI. Prérequis, réseau, certificats, comptes
techniques, mises à jour, sauvegardes/restauration, supervision documentés. **Aucune dépendance
externe non documentée** ; toute dépendance Internet/tiers/licence/télémétrie explicite et
configurable. Isolation par **base dédiée** (un OPGI = une base).

### Option 2 — Hébergement centralisé mutualisé
Plusieurs OPGI sur une plateforme commune, **séparation stricte** (base partagée + `organisationId`
+ RLS). Mises à jour, sauvegardes, supervision, reprise mutualisées. **Ne pas présumer** que
l'hébergement centralisé ou la localisation des données est autorisé : vérifications préalables dans
`05-REGISTRE-CONFORMITE.md`.

### Portabilité
Schéma identique dans les deux modes ; procédures d'export/restauration/migration documentées ;
fenêtres d'arrêt identifiées. Objectifs RPO/RTO définis **avec chaque organisme**, non inventés.
