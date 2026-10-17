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
  aux handlers, **proxy unique** `src/proxy.ts` (CSRF d'origine + en‑têtes de sécurité/CSP via
  `src/lib/http/security-headers.ts`, configurables et testés), i18n next-intl (FR par défaut,
  AR/RTL préparé).
- **CSP durcie par nonce** (mode par défaut) : le proxy génère un nonce par requête,
  `script-src 'self' 'nonce-<n>' 'strict-dynamic'` (plus de `unsafe-inline`/`unsafe-eval` en
  production), rendu dynamique forcé (`src/app/layout.tsx`) pour que Next injecte le nonce.
  Configurable : `CSP_MODE` (`nonce`|`compat`|`off`), `CONTENT_SECURITY_POLICY` (override),
  `CSP_REPORT_ONLY`. HSTS/COOP/Permissions-Policy posés aussi. `style-src` conserve
  `unsafe-inline` (attributs de style React non couverts par un nonce — durcissement ultérieur).

### Incrément 3 — Module A (patrimoine : CRUD + occupants + contrats)

- **Modèle** : `Bien` (patrimoine), `Occupant` (physique/morale), `Contrat` (lie bien + occupant),
  tous cloisonnés par `organisationId` + RLS (migration `rls_module_a`). **Archivage logique**
  (jamais de suppression physique).
- **CRUD complet** via API (`src/http/` + services `src/lib/modules/a/`) :
  `GET/POST /api/biens`, `GET/PATCH/DELETE /api/biens/:id`, idem `occupants` et `contrats`.
  Validation zod (`schemas.ts`), erreurs traduites (400 invalide, 409 code dupliqué, 404 introuvable).
- **Lien contrat → bien/occupant vérifié DANS le tenant** : une clé étrangère seule ne suffit pas
  (la vérification FK de PostgreSQL contourne la RLS), donc le service refuse (400) un contrat
  pointant vers un bien/occupant d'un autre organisme.
- **Aucun calcul** : le loyer (`montantLoyerCentimes`) est une saisie libre ; aucun taux, pénalité
  ou règle inventé. Les statuts de contrat sont un point de départ configurable.
- **UI FR** : pages liste + création pour patrimoine, occupants, contrats ; navigation ;
  bouton d'archivage. Autorisations reflétées dans l'UI (création masquée sans le droit).

### Incrément 4 — Module A financier (appels de loyers, paiements, recouvrement)

- **Modèle** : `AppelLoyer` (montant dû par période), `Paiement` (encaissement constaté),
  `Imputation` (affectation paiement → appel), `ActionRecouvrement` (journal des relances/mises en
  demeure…). Tous cloisonnés par `organisationId` + RLS (migration dédiée).
- **Montants en centimes entiers — aucun flottant, aucun calcul inventé** : pas de pénalité ni
  d'intérêt. Le **solde** d'un appel et le **reste** d'un paiement sont calculés par différence avec
  les imputations (jamais stockés, donc jamais incohérents).
- **Suivi distinct engagement / encaissement** : un appel (dû) n'est jamais confondu avec un
  paiement (reçu) ; le lien passe par une imputation explicite.
- **Règles d'intégrité** (données, pas droit) : une imputation ne peut dépasser le solde de l'appel
  ni le reste du paiement (→ 409), et ne lie que des éléments du **même contrat** et du **même
  organisme**.
- **Recouvrement** : liste des **impayés** (appels à solde > 0) avec jours de retard **indicatifs**
  (aucune échéance réglementaire présumée) ; enregistrement d'actions (type, date, note, pièce).
- **UI FR** : fiche de contrat (appels/soldes, paiements/restes, actions) avec formulaires d'appel,
  de paiement, d'imputation et d'action ; page **Recouvrement — impayés**.

### Incrément 5 — Module C (réclamations, maintenance, interventions)

- **Modèle** : `Reclamation` (rattachable à un bien/occupant, déclarant portail ou guichet),
  `CommentaireReclamation` (échanges, avec notes **internes**), `OrdreTravail` (intervention issue
  d'une réclamation, affectée à un technicien interne ou un prestataire externe, coûts estimé/
  constaté). Tous cloisonnés par `organisationId` + RLS (migration dédiée). Références auto‑générées.
- **Cloisonnement par PROPRIÉTÉ** (au‑delà de l'organisme) :
  - un **OCCUPANT** ne voit et ne crée que **ses** réclamations (portail) ;
  - un **TECHNICIEN** ne voit et ne modifie que **ses** ordres de travail (même en écriture) ;
  - une **note interne** n'est jamais renvoyée à un déclarant.
- **Cycle** : dépôt → qualification (statut/urgence/catégorie) → ordre de travail → intervention
  (compte rendu, coûts) ; **détection de doublons** par regroupement (statut `DOUBLON` + lien),
  **sans suppression d'historique**.
- **Aucun calcul inventé** ; délais/catégories/statuts configurables, jours de retard indicatifs.
- **API REST + UI FR** : liste + dépôt de réclamation, fiche (qualification, commentaires, ordres)
  avec formulaires gated par rôle.

### Incrément 6 — Module B (projets, marchés, chantiers)

- **Modèle** : `Projet` (opération), `Entreprise`, `Marche` (montant **engagé**),
  `SituationTravaux` (montant **constaté**, avancement physique), `Reception`
  (provisoire/définitive, réserves). Tous cloisonnés par `organisationId` + RLS.
- **Séparation engagé / constaté / payé** : l'engagé (marché) et le constaté (situations
  **validées**) sont distincts ; le **paiement exécuté est hors périmètre** (suivi, pas système de
  paiement). Aucun calcul réglementaire.
- **Workflow des situations + permission `valider`** : dépôt → vérification → **validation**/rejet,
  avec traçage du décideur et de la date. La **validation** exige la permission `valider`
  (GESTIONNAIRE_MARCHES) ; un CHEF_PROJET peut déposer/vérifier mais **pas** valider (403) —
  mise en œuvre concrète d'une délégation.
- **Indicateurs indicatifs** (non réglementaires) : avancement financier (constaté/engagé),
  avancement physique, alertes **dépassement** (constaté > engagé) et **retard** (délai dépassé).
- **API REST + UI FR** : listes + création projets/entreprises/marchés ; fiche de marché
  (avancement, situations avec dépôt/décision, réceptions).

### Incrément 7 — Journal d'audit persistant (transverse)

- **Modèle** `AuditLog` : auteur, organisme, action normalisée, type/identifiant d'objet, résultat,
  date, résumé **sans donnée personnelle** (minimisation, brief §9). Cloisonné par organisme (RLS).
- **Append‑only** : le rôle applicatif `opgi_app` n'a que **SELECT + INSERT** sur `audit_log`
  (UPDATE/DELETE **révoqués** — migration `rls_audit` + `provision-roles.sql`). Le journal ne peut
  donc être ni modifié ni effacé par l'application.
- **Écriture atomique** : l'entrée d'audit est insérée **dans la même transaction `withTenant`** que
  l'action auditée (validées ou annulées ensemble).
- **Opérations sensibles tracées** (brief §9) : création de contrat, de paiement, d'imputation, de
  marché, **décision sur situation de travaux** (dont la validation), création de réception.
- **Consultation réservée** (`ADMIN_OPGI`, `DIRECTION`, `AUDITEUR`) — page `/audit` + `GET /api/audit`.

### Incrément 8 — Import initial du référentiel (CSV)

- **Import CSV des biens et des occupants** (brief §A/§11) avec les trois garanties : **contrôle des
  erreurs** (validation zod ligne à ligne), **détection des doublons** (dans le fichier **et** en
  base), **rapport d'import** (total, insérés, ignorés, et chaque ligne rejetée avec son numéro et
  son motif : invalide / doublon_fichier / doublon_base).
- Analyseur CSV maison, sans dépendance (champs entre guillemets, virgules et sauts de ligne
  protégés, guillemets doublés, BOM, CRLF) — testé unitairement.
- Insertion atomique dans une transaction `withTenant` (RLS) ; import **tracé au journal d'audit**.
  API `POST /api/import`, UI `/patrimoine/import` (coller du CSV ou choisir un fichier, rapport affiché).

### Incrément 9 — Tableaux de bord d'indicateurs

- **Indicateurs calculés en direct** (aucun chiffre figé/fictif), **isolés par organisme** et
  **gated par rôle** (chaque section n'apparaît que si le rôle a le droit `lire` sur le module).
- **Patrimoine & locatif** : biens actifs, taux d'occupation, contrats actifs, total dû, encaissé
  (imputé), solde, **taux de recouvrement**, appels impayés.
- **Réclamations** : ouvertes, répartition par statut, ordres de travail par statut.
- **Projets & marchés** : projets/marchés actifs, **engagé vs constaté**, avancement financier,
  marchés en **dépassement** et en **retard** (indicatifs).
- **Chaque indicateur affiche sa définition** (brief §11). Page `/tableau-de-bord` (server‑rendue).

### Incrément 10 — Exports CSV tracés

- **Exports CSV** des biens, contrats et impayés (format ouvert), **contrôlés par le droit
  `exporter`** du module A (brief §9), **isolés par organisme** et **tracés au journal d'audit**.
- Sérialiseur CSV conforme RFC 4180 (échappement guillemets/virgules/sauts, BOM UTF‑8).
- API `GET /api/export?type=biens|contrats|impayes` (téléchargement `attachment`), liens
  « Exporter (CSV) » sur les pages patrimoine, contrats et recouvrement (affichés selon le droit).

### Incrément 11 — Verrouillage de connexion (anti‑bruteforce)

- Après **N échecs consécutifs** (défaut 5), le compte est **verrouillé** pour une durée
  configurable (défaut 15 min, `LOGIN_MAX_ATTEMPTS` / `LOGIN_LOCK_MINUTES`) — brief §9 « limitation
  des tentatives ». Pendant le verrou, même le bon mot de passe est refusé ; une connexion réussie
  remet le compteur à zéro. Message d'erreur **générique** (aucun oracle sur la cause).

### Incrément 12 — Pièces jointes à accès médié

- **Pièces jointes de réclamations** (brief §7/§C) : contenu stocké **hors base** sous une clé
  **opaque préfixée par l'organisme**, **aucun accès direct** — le téléchargement passe par un
  handler qui vérifie **autorisation + propriété** (occupant → sa réclamation uniquement).
- **Contrôle du type** (jpeg/png/pdf → 415 sinon) et de la **taille** (10 Mo → 413) à l'upload.
- Cloisonnement RLS par organisme ; stockage local abstrait (interface `put/get/remove`,
  bascule S3 prévue) ; upload tracé au journal d'audit. Anti path‑traversal sur la clé.
- API `POST/GET /api/reclamations/:id/pieces`, `GET /api/pieces/:id` (téléchargement médié) ;
  UI : section « Pièces jointes » (liste + upload) sur la fiche de réclamation.

### Incrément 13 — Notifications internes

- Notifications **persistées**, cloisonnées par organisme (RLS) **et par destinataire** (chacun ne
  lit/marque que les siennes) — brief §7.
- **Émises sur événement** : qualification d'une réclamation → **déclarant** ; affectation d'un
  ordre de travail → **technicien** (émission atomique dans la transaction de l'événement).
- API `GET /api/notifications` (+ compteur non‑lues), `POST /api/notifications/:id/lu` ; UI : page
  « Mes notifications » + indicateur de non‑lues dans la navigation.
- Canal externe (email/SMS) **désactivé par défaut** (adaptateur à brancher, avec journalisation
  d'envoi/échec sans donnée sensible) — documenté, non activé.

### Incrément 14 — Changement de mot de passe (self-service)

- **Tout utilisateur authentifié** change **son** mot de passe (`PATCH /api/compte/motdepasse`,
  page `/compte`) : vérification du mot de passe actuel (bcrypt), longueur minimale **configurable**
  (`PASSWORD_MIN_LENGTH`, défaut 12 — **aucune règle de complexité imposée**, « à valider »),
  confirmation côté client, et le nouveau doit différer de l'ancien.
- Opère via le rôle restreint `opgi_app` + `withTenant` : l'utilisateur n'agit que sur **sa** ligne,
  dans **son** organisme (borné par `id`+`organisationId`). Un changement réussi **remet à zéro** le
  compteur de verrouillage (lève un verrou éventuel) et est **tracé au journal d'audit**. Message
  d'erreur générique sur le mot de passe actuel. Garde « session seule » (aucune permission de
  module requise pour son propre compte).

### Incrément 15 — Double authentification (2FA / TOTP)

- **Second facteur optionnel par compte** (RFC 6238, TOTP 30 s / 6 chiffres), implémenté **sans
  dépendance** (HMAC‑SHA1 via `node:crypto`, base32, fenêtre ±1 pas, comparaison à temps constant) —
  `src/lib/auth/totp.ts`, validé contre les **vecteurs RFC 6238**.
- **Enrôlement en deux temps** : `POST /api/compte/2fa/debut` génère un secret **provisoire** +
  l'URI `otpauth://` ; `POST /api/compte/2fa/activer` n'active qu'après **preuve d'un code**.
  Désactivation `POST /api/compte/2fa/desactiver` sous **vérification du mot de passe**. Statut
  `GET /api/compte/2fa`. Activation/désactivation **tracées au journal d'audit**.
- **Appliqué au login** : si la 2FA est active, `authenticate` exige un code TOTP valide après le
  mot de passe. Le handler renvoie `twoFactorRequired` (mot de passe correct) pour que l'UI affiche
  le champ du code ; sinon message générique. Secret et activation cloisonnés par `opgi_app` + RLS,
  bornés à (id, organisationId) de l'utilisateur. UI : section 2FA sur `/compte`, champ code sur
  `/connexion`.

### Incrément 16 — Canal de notification externe (opt-in)

- **Adaptateur générique par webhook**, **désactivé par défaut** (`NOTIF_CANAL=off`) : aucun
  fournisseur imposé — l'intégrateur branche son relais email/SMS derrière `NOTIF_WEBHOOK_URL`.
- **Dispatch best-effort HORS transaction** : l'envoi externe a lieu **après le commit** de
  l'événement (jamais d'I/O réseau dans la transaction) et un échec d'envoi **n'annule jamais** la
  notification interne déjà persistée (source de vérité). Branché sur la qualification d'une
  réclamation et l'affectation d'un ordre de travail.
- **Charge utile minimale, sans donnée sensible** : seuls `organisationId`, `notificationId`,
  `destinataireUtilisateurId`, `type`, `lien` sont transmis — jamais le titre, le corps, l'e-mail
  ou le téléphone. Résultat (envoyé/échec) **journalisé** sans contenu sensible. Canal et journal
  **injectables** (abstraction `CanalExterne`/`Journal`).

### Incrément 17 — Export PDF (récépissé de réclamation)

- **Générateur PDF minimal SANS dépendance** (`src/lib/pdf/simple.ts`) : une page A4, Helvetica
  en `WinAnsiEncoding` (accents français), titre + lignes « label : valeur », échappement correct
  des caractères spéciaux, table xref/trailer valides — pur et déterministe (testé par structure).
- **Récépissé imprimable** `GET /api/reclamations/:id/pdf` (`application/pdf`, `Content-Disposition`
  attachment), **médié par autorisation + propriété** (un occupant ne télécharge que SA réclamation ;
  cloisonnement RLS par organisme). Contenu = **données saisies uniquement** (aucun habillage
  juridique inventé ; mention « récépissé non contractuel / à valider »). Lien de téléchargement sur
  la fiche de réclamation.

### Incrément 18 — Export PDF (fiche marché, module B)

- Réutilise le générateur PDF sans dépendance pour une **fiche marché**
  `GET /api/marches/:id/pdf` (`application/pdf`, attachment), médiée par autorisation **B.lire** et
  cloisonnée par organisme (RLS). Reprend les **indicateurs indicatifs** (engagé, constaté,
  avancement financier/physique, dépassement, retard) — explicitement « non réglementaires ». Lien
  de téléchargement sur la fiche marché.

### Incrément 19 — Export PDF (bon d'ordre de travail, module C)

- `GET /api/ordres/:id/pdf` (`application/pdf`, attachment) : **bon d'ordre de travail** imprimable,
  médié par autorisation **C.lire** ET **propriété** — un technicien ne télécharge que SES ordres ;
  cloisonnement RLS par organisme. Reprend référence, statut, affectation, prestataire, dates,
  coûts estimé/constaté, compte rendu ; mention « non contractuel ». Lien par ligne dans le tableau
  des ordres de la fiche de réclamation.

### Incrément 20 — Bilingue FR/AR + RTL

- **Langue par cookie** `NEXT_LOCALE` (`fr`|`ar`) résolue côté serveur (`src/i18n/request.ts`),
  helpers purs testés (`resoudreLocale`, `direction`, `fusionner`) dans `src/i18n/locales.ts`.
- **Repli FR garanti** : les messages AR sont **fusionnés sur FR**, donc toute clé non encore
  traduite retombe sur le français — jamais de clé brute ni de page cassée (vérifié par test :
  couverture 100 % des clés après fusion).
- **RTL réel** : `dir="rtl"` posé par le layout quand la locale est `ar` (confirmé au runtime :
  `html dir=rtl lang=ar`). **Sélecteur de langue** FR/العربية dans la navigation et sur l'écran de
  connexion. **Traduction arabe complète** de toute l'interface (navigation, connexion, compte,
  tableau de bord, indicateurs, patrimoine, occupants, contrats, finances, réclamations, projets,
  entreprises, marchés, audit, recouvrement, import) — **parité FR↔AR vérifiée par test**.

### Incrément 23 — Portail public de dépôt de réclamation

- **Page publique** `/portail` accessible **sans authentification** (aucune garde de session),
  bilingue FR/AR, avec catégories traduites. Lien depuis l'écran de connexion.
- `POST /api/portail/reclamations` : le déclarant cible un organisme par son **code OPGI** (ou
  l'unique organisme en mode dédié), **validé côté serveur** (organisation active) ; l'écriture est
  confinée à ce seul organisme par la **RLS** (`withTenant`). La réclamation est créée sans compte
  (`declarantUtilisateurId` null, canal `PORTAIL`, statut `NOUVELLE`), tracée au journal d'audit
  (auteur système). La réponse n'expose **que la référence** d'accusé de réception — aucune autre
  donnée, aucune lecture inter‑OPGI.
- **Anti‑abus** : CSRF d'origine + **limiteur de débit** en mémoire par IP (configurable
  `PUBLIC_RL_MAX` / `PUBLIC_RL_WINDOW_MINUTES`, défaut 5/10 min ; WAF/CAPTCHA recommandés en
  production, « à valider »). Validation stricte (zod) des entrées.

### Incrément 24 — Révocation de session

- Chaque jeton de session porte un **epoch** ; l'incrémenter invalide tous les jetons émis avant
  (colonne `sessionEpoch` sur l'utilisateur). Contrôle de révocation à chaque accès authentifié
  (API et pages) : compte désactivé/absent ou epoch obsolète → session rejetée (401 / redirection).
- **Déconnexion globale** `POST /api/compte/sessions/revoquer` (bouton sur `/compte`) : incrémente
  l'epoch (toutes les sessions tombent, cookie courant effacé), tracée au journal d'audit.
- **Changement de mot de passe** invalide désormais les **autres** sessions (epoch++), tout en
  **ré‑émettant** le cookie de la session courante pour la garder active. Comble la faille où un
  jeton volé restait valable jusqu'à expiration.
- Rétro‑compatible : les jetons sans claim `epoch` valent 0, l'epoch par défaut est 0 → aucune
  déconnexion de masse au déploiement.

### Incrément 25 — Journal d'audit : filtres + pagination

- `GET /api/audit` et la page `/audit` acceptent un **filtre texte** `q` (action, type d'objet,
  résumé), un **filtre `resultat`** (SUCCES/ECHEC) et la **pagination** (`page`/`perPage`), avec
  en‑tête `X-Total-Count`. Fonctions `listAudit`/`countAudit` (filtres + comptage dans la même
  transaction `withTenant`). Page avec formulaire de filtre et navigation précédent/suivant.
- Au passage, le handler d'audit applique aussi le **contrôle de révocation de session** (comme les
  autres gardes).

### Incrément 26 — Compte prestataire externe (cloisonnement des OT)

- Un ordre de travail peut être affecté à un **compte PRESTATAIRE** externe
  (`prestataireUtilisateurId` sur l'OT, migration dédiée ; `prestataireNom` reste pour un prestataire
  sans compte). Notification d'affectation envoyée au prestataire comme au technicien.
- **Cloisonnement par propriété** étendu : un PRESTATAIRE ne voit/modifie **que SES** ordres de
  travail (comme un technicien avec les siens), sur toute la surface (liste, fiche, PATCH, PDF) — en
  plus de l'isolation RLS par organisme. UI : champ « compte prestataire » à l'affectation externe.

### Incrément 27 — Hiérarchie du patrimoine : niveau Site

- Nouvelle entité **Site** (code, nom, adresse) — premier niveau de la hiérarchie patrimoniale,
  avec **RLS dédiée** (migration `rls_site`, politique fail‑closed par organisme) et grants au rôle
  restreint. CRUD complet (`/api/sites`, pages `/sites` + `/sites/nouveau`, lien de navigation).
- Un **bien** peut être rattaché à un site (`siteId`), la référence étant **validée dans le tenant**
  (un bien ne peut pointer un site d'un autre organisme — rejet 400). Sélecteur de site au formulaire
  de création de bien. Pagination/recherche sur les sites (`listSites`/`countSites`).

### Incrément 28 — Hiérarchie du patrimoine : niveau Bâtiment

- Nouvelle entité **Bâtiment** (code, nom), **rattachée à un site** du même organisme (deuxième
  niveau de la hiérarchie patrimoniale), avec **RLS dédiée** (migration `rls_batiment`, politique
  fail‑closed par organisme) et grants au rôle restreint. CRUD complet (`/api/batiments`, pages
  `/batiments` + `/batiments/nouveau`, lien de navigation, filtre `?siteId=`).
- Le site de rattachement est **validé dans le tenant** à la création/mise à jour (un bâtiment ne
  peut pointer un site d'un autre organisme — rejet 400).
- Un **bien** peut en outre être rattaché à un bâtiment (`batimentId`), la référence étant elle
  aussi **validée dans le tenant** (rejet 400 sinon). Au formulaire de bien, le sélecteur de
  bâtiment est filtré par le site choisi.

### Incrément 29 — Génération en masse des appels de loyer

- Nouvelle opération **« générer les appels d'une période »** : crée un appel par **contrat ACTIF**
  au **montant de son loyer**. Opération purement mécanique — **aucune pénalité, aucun intérêt,
  aucune proratisation** (règles métier laissées « à valider »). Les contrats actifs **sans loyer**
  défini et les contrats non actifs sont ignorés.
- **Idempotente** : s'appuie sur la contrainte unique `organisme+contrat+période` ; relancer la
  génération sur la même période ne crée aucun doublon (contrats déjà pourvus ignorés). Aucune
  migration (le champ `periode` existait déjà).
- `genererAppels` (service, `createMany` + `skipDuplicates`), handler `POST /api/appels/generer`
  **tracé au journal d'audit** (résumé des compteurs), page `/appels` + formulaire client, lien de
  navigation. Renvoie un **récapitulatif** (créés / déjà existants / sans loyer / contrats actifs).

### Tests — **220 verts** (`npm test`)

Logique pure (résolution d'organisme, matrice, session, CSRF) **et** intégration réelle sur
PostgreSQL : lecture croisée refusée, identifiant deviné introuvable, écriture croisée refusée
(WITH CHECK), fail‑closed sans organisme, login (bon/mauvais/CSRF), isolation de bout en bout
(agent d'Alger ≠ agent d'Oran), rôle sans droit → 403. **Module A** : CRUD complet d'un bien,
code dupliqué → 409, données invalides → 400, AUDITEUR lit mais ne crée pas (403), bien d'Alger
introuvable pour Oran (404), contrat liant un bien d'un autre organisme → 400, période incohérente
→ 400. **Finances** : appel au montant du loyer par défaut, imputation mettant à jour solde/reste,
imputation dépassant le solde ou le reste → 409, imputation inter‑contrat → 409, imputation
inter‑organisme → 400, liste d'impayés, action de recouvrement isolée par organisme. **Module C** :
dépôt occupant (déclarant forcé, référence auto), un occupant ne voit pas les réclamations d'un
autre (404), qualification refusée à l'occupant (403), AUDITEUR ne peut pas déposer (403),
regroupement de doublons, notes internes masquées au déclarant, OT visible/modifiable seulement
par le technicien affecté (404 sinon), isolation inter‑OPGI. **Module B** : projet/entreprise/
marché, marché référençant un projet d'un autre organisme → 400, dépôt de situation, CHEF_PROJET
vérifie mais ne valide pas (403), GESTIONNAIRE_MARCHES valide, avancement reflétant le constaté
(≠ engagé), alerte dépassement, réception, isolation inter‑OPGI (404). **Audit** : une action
sensible crée une entrée tracée (auteur inclus), journal isolé par organisme, consultation réservée
(technicien → 403, auditeur → 200), **append‑only vérifié** (UPDATE/DELETE par le rôle applicatif
rejetés). **Import** : analyseur CSV (guillemets, virgules/sauts protégés), rapport (insérés/
ignorés), doublon dans le fichier et doublon en base détectés, ligne invalide rejetée, import isolé
par organisme, refusé à un AUDITEUR (403), tracé au journal d'audit. **Indicateurs** : scénario
contrôlé (organisme dédié) → taux d'occupation 60 %, dû/imputé/solde et taux de recouvrement 30 %,
réclamations ouvertes, engagé/constaté agrégés, dépassement et retard détectés. **Exports** :
sérialiseur CSV (échappements), export réservé au droit `exporter` (AGENT_LOCATIF → 403,
AGENT_RECOUVREMENT → 200), contenu attendu, isolation inter‑OPGI, trace d'audit. **Verrouillage** :
5 échecs → compte verrouillé (bon mot de passe refusé), succès remet le compteur à zéro.
**Pièces jointes** : upload (type → 415), téléchargement médié par le propriétaire, refus d'un autre
occupant et d'un autre OPGI (404), liste cloisonnée, upload tracé à l'audit.
**Notifications** : qualification → notifie le déclarant (pas les autres), affectation d'OT →
notifie le technicien, marquage « lu » réservé au destinataire, isolation inter‑OPGI.
**Patrimoine (hiérarchie)** : création d'un site puis d'un bâtiment rattaché, rattachement d'un bien
au site et au bâtiment, référence contrôlée dans le tenant (bien/bâtiment pointant une entité d'un
autre organisme → 400), entité d'Alger invisible et introuvable pour Oran (404), AUDITEUR refusé à
la création (403).
**Génération d'appels** : un appel par contrat ACTIF au loyer du contrat, contrats sans loyer et
BROUILLON ignorés, idempotence (seconde génération → 0 créé, aucun doublon), isolation inter‑OPGI
(la génération d'Oran n'affecte pas Alger), AUDITEUR refusé (403).

Vérifié aussi sur le serveur en marche (`next dev`) : login pose un cookie, `/api/biens` renvoie
uniquement les biens de l'organisme de la session, origine étrangère → 403, en‑têtes CSP présents,
`/tableau-de-bord` sans session → redirection vers `/connexion`.

**Comptes de démonstration** (seed, données fictives) : `OPGI-ALGER` / `OPGI-ORAN`,
e‑mails `*.demo`, mot de passe `Demo-1234!`.

## Intégration continue

Le workflow GitHub Actions `.github/workflows/opgi-ci.yml` s'exécute sur chaque push/PR touchant
`opgi/**` (indépendant de la CI du produit SOUQ AUTO). Il démarre un **PostgreSQL 16 jetable**, crée
le rôle applicatif restreint `opgi_app`, puis enchaîne : `npm ci`, `prisma generate`, `npm run build`
(inclut le typecheck), `tsc --noEmit`, **contrôle de cohérence schéma/migrations** (`prisma migrate
diff --exit-code` → échoue en cas de migration oubliée) et `npm test` (les 220 tests, dont
l'isolation réelle en base). Les mots de passe du workflow sont ceux d'un conteneur jetable, pas des
secrets.

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
npm test            # 220 tests (pur + isolation/HTTP réels sur opgi_test)
```

Les tests préparent automatiquement la base `opgi_test` (migrations + droits + seed fictif) via
`tests/global-setup.ts`. Un `tsc --noEmit` isolé nécessite un `npm run build` préalable (Next génère
`next-env.d.ts` et `.next/types`).

## Ce qui reste à faire (honnêtement)

Socle **livré et testé** : isolation inter‑OPGI à deux niveaux (filtre applicatif + RLS, deux modes
mutualisé/dédié), authentification (bcrypt, session JWT, CSRF, **verrouillage anti‑bruteforce**,
**2FA TOTP**, **changement de mot de passe self‑service**), Modules A/B/C (CRUD, finances
engagé/constaté, réclamations/ordres de travail, projets/marchés/situations/réceptions), journal
d'audit append‑only, import CSV, tableaux de bord d'indicateurs, **exports CSV et PDF** (récépissé
de réclamation, fiche marché, bon d'ordre de travail), pièces jointes médiées, **notifications
internes + canal externe webhook (opt‑in)**, **pagination + recherche** sur toutes les listes,
**CSP durcie par nonces** (+ HSTS/COOP/Permissions‑Policy), **interface bilingue FR/AR en RTL**
(parité des clés vérifiée, **y compris les libellés des valeurs d'enum** — statuts, types,
catégories, rôles), et **CI GitHub Actions + PostgreSQL** (migrate diff, suite verte).

Ne sont **pas** encore livrés :

- **Décisions métier/juridiques (préalable, pas du code)** : barèmes, délais, pénalités, durées de
  conservation restent configurables et **« à valider » par l'OPGI** (voir `../docs/opgi/04` et
  `05`). Rien n'est inventé à leur place.
- **Module A — compléments** : hiérarchie du patrimoine **au-delà du bâtiment** (cages → niveaux ;
  les niveaux **Site** et **Bâtiment** sont livrés), génération d'un **échéancier complet
  multi-périodes** (la génération d'appels **pour une période** est livrée), **écrans d'édition
  dédiés** (le `PATCH` existe en API), états de compte/reçus.
- **Module B — compléments** : planning (jalons/tâches), ordres de service et avenants, lots,
  écrans d'édition dédiés (le `PATCH` existe en API), import des marchés/projets.
- **Module C — compléments** : planification/visites détaillées, indicateurs par zone/délai. (Le
  **portail public** de dépôt de réclamation et le **cloisonnement des OT par prestataire** sont
  livrés.)
- **Sécurité (compléments)** : durcissement du
  `style-src` par nonces (styles inline React), analyse antivirus des pièces jointes.
- **Administration plateforme** (gestion des comptes/organismes/permissions via UI) + instrumentation
  de ces actions au journal d'audit ; politique de conservation (après validation métier).
- **Tableaux de bord** : séries temporelles et graphiques.
- **Exploitation/déploiement** : `docker-compose` (PostgreSQL + rôles), gestion des secrets de
  production, runbook de déploiement.
- Les tests d'isolation restants du plan (admin plateforme notamment) : ils s'attacheront quand ces
  surfaces existeront (voir `../docs/opgi/02-ISOLATION-MULTI-OPGI.md`).

En résumé : **MVP solide, testé et cohérent**, mais pas encore un produit prêt pour la production —
il manque surtout la **validation des règles métier** par l'OPGI, de la **profondeur** sur quelques
workflows, et le **volet exploitation/déploiement**.
