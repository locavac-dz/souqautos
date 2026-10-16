# 02 — Isolation multi‑OPGI, analyse des menaces, plan de tests

> L'isolation stricte des organismes est la propriété **n°1** du produit. Un utilisateur d'un OPGI
> ne doit jamais consulter, rechercher, exporter, modifier ou **déduire** les données d'un autre
> OPGI, sauf autorisation explicite et contrôlée.

## 1. Stratégie d'isolation retenue (proposition)

| Mode d'exploitation | Isolation des données | Filet de sécurité |
|---|---|---|
| Installé chez l'OPGI (Option 1) | **Une base PostgreSQL par OPGI** | Pas de données tierces présentes physiquement |
| Hébergement centralisé (Option 2) | **Base partagée** + colonne `organisationId` **non nullable** sur chaque table métier | **Row‑Level Security (RLS) PostgreSQL** + garde applicative |

**Schéma identique** dans les deux modes (portabilité, D7) ; seule la stratégie d'isolation diffère.

### Règles non négociables
1. **L'organisme vient de la session serveur**, jamais d'un en‑tête, cookie ou paramètre fourni par
   le navigateur (règle D3). Le jeton de session porte l'`organisationId` signé côté serveur.
2. **Chaque requête** (lecture, écriture, tâche de fond, export, accès fichier) est filtrée par
   `organisationId` **à deux niveaux** : (a) requête applicative paramétrée, (b) RLS en base comme
   filet si (a) oublie un filtre. Défense en profondeur.
3. **Clés d'objets fichiers préfixées** par organisme ; accès toujours médié par un contrôle
   d'autorisation (jamais d'URL publique devinable — risque d'accès indirect, cf. OWASP IDOR).
4. **Caches, recherches, notifications, files asynchrones, journaux visibles, sauvegardes** sont
   tous cloisonnés par organisme.
5. **Aucune API, export ou outil de support** ne doit exposer les données d'un OPGI à un autre.

## 2. Surfaces couvertes par l'isolation (liste de contrôle)

- [ ] Données métier (A/B/C) — filtre + RLS
- [ ] Fichiers et pièces jointes — préfixe + accès médié
- [ ] Caches (Redis) — clés préfixées par organisme
- [ ] Recherche / filtres — portée limitée à l'organisme actif
- [ ] Exports (CSV, PDF, états) — périmètre autorisé uniquement, tracés
- [ ] Notifications (interne, email, SMS) — destinataires du bon organisme
- [ ] Tâches asynchrones / balayages (cron) — itèrent par organisme sans fuite
- [ ] Journaux accessibles aux utilisateurs — filtrés par organisme
- [ ] Sauvegardes et restaurations — par organisme (ou base dédiée)
- [ ] Messages d'erreur — ne révèlent jamais l'existence de données d'un autre organisme

## 3. Analyse des menaces (STRIDE abrégé — à compléter en Phase 1)

| Menace | Vecteur | Contrôle |
|---|---|---|
| **Usurpation d'organisme** | Modifier l'`organisationId` côté client | Organisme déduit de la session signée serveur (D3) |
| **Élévation de privilège** | Rôle ou périmètre forgé | Permissions vérifiées serveur à chaque requête ; moindre privilège |
| **Accès indirect (IDOR)** | Deviner l'identifiant d'un bien/contrat d'un autre OPGI | Filtre `organisationId` + RLS ; identifiants non séquentiels (cuid) |
| **Fuite par recherche/export** | Recherche globale, export large | Portée organisme forcée ; exports tracés et limités |
| **Fuite par fichier** | URL de pièce jointe devinée | Accès médié, clé préfixée, contrôle d'autorisation |
| **Fuite par cache/queue** | Collision de clés entre organismes | Clés et files préfixées par organisme |
| **Fuite par journal/erreur** | Message d'erreur trop verbeux | Erreurs génériques, pas de données sensibles dans les logs |
| **Fuite par sauvegarde** | Restauration croisée | Sauvegardes chiffrées, séparées, périmètre par organisme |
| **Admin plateforme abusif** | Accès métier via rôle technique | Séparation admin plateforme ↔ droits métier (D-séparation) |

## 4. Plan de tests d'isolation (critère d'acceptation Phase 1)

Tests automatisés (Vitest + Playwright), rejoués en CI, **avant** l'ajout de données métier
sensibles. Deux organismes fictifs `OPGI-A` et `OPGI-B`, comptes dans chacun :

1. **Lecture croisée refusée** — un compte d'`OPGI-A` ne voit aucune donnée d'`OPGI-B` (listes, détails).
2. **Identifiant deviné refusé** — accès direct à un identifiant d'`OPGI-B` → 404/403, jamais 200.
3. **Recherche cloisonnée** — une recherche d'`OPGI-A` ne remonte jamais un résultat d'`OPGI-B`.
4. **Export cloisonné** — un export d'`OPGI-A` ne contient aucune ligne d'`OPGI-B`.
5. **Pièce jointe cloisonnée** — l'URL d'une pièce d'`OPGI-B` est refusée à `OPGI-A`.
6. **Écriture croisée refusée** — modification d'un objet d'`OPGI-B` depuis `OPGI-A` → refus.
7. **Session forgée refusée** — `organisationId` injecté côté client ignoré (session fait foi).
8. **RLS actif** — avec le filtre applicatif retiré en test, la RLS bloque toujours la fuite (mode centralisé).
9. **Admin plateforme sans métier** — le rôle technique n'accède à aucune donnée métier d'un OPGI.
10. **Permissions par rôle × périmètre** — chaque rôle limité à ses modules/actions/périmètre.

**Critère d'acceptation :** les 10 tests passent en CI ; aucune fuite inter‑OPGI possible par
compte, recherche, identifiant deviné, pièce jointe ou export.

## 5. Points à valider

- Choix du mode d'isolation par défaut du pilote (lié à la question bloquante D2 de `01-ARCHITECTURE.md`).
- Faisabilité RLS avec le pool de connexions choisi (RLS nécessite un paramètre de session par requête ;
  compatibilité PgBouncer en mode transaction à vérifier) — **À valider**.
- Règles d'autorisation explicite d'accès inter‑organisme (le prompt les permet « sauf autorisation
  explicite et contrôlée ») : qui l'accorde, comment la tracer — **À valider** avec l'OPGI.
