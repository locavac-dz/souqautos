# SOUQ AUTO — Cahier d'architecture & plan de développement
**Lot 0 — Document de cadrage (avant tout développement)**
Propriété : INGENICA CIVIL EURL — famille de marques : AL HANDASSA, LOCAVAC, SOUQONLINE, SOUQ AUTO

> Ce document répond au « Point 60 — Première mission » du master prompt. Il ne contient aucun code.
> **Aucun développement ne démarre avant validation explicite de ce document par le porteur du projet.**

---

## 0. Résumé exécutif

SOUQ AUTO est une marketplace automobile algérienne (particulier↔particulier, professionnel↔particulier, puis à terme pro↔pro), positionnée non pas comme un site de petites annonces généraliste mais comme une **plateforme automobile spécialisée** : moteur de recherche automobile dédié, cote de prix (« Cote SOUQ AUTO »), score de confiance vendeur, détection de fraude, et à terme un écosystème (financement, assurance, vérification technique, pièces détachées, garages).

Le modèle économique repose sur les vendeurs (annonces standard/premium/premium+, abonnements professionnels), complété par des services premium acheteurs, la publicité automobile ciblée et, à terme, des partenariats (assurance, financement, vérification).

Décision structurante proposée dans ce document : stack **web moderne SSR** (et non desktop), car SEO, indexation par marque/modèle/wilaya et vitesse d'affichage sont un besoin central (sections 31-33 du brief) — voir §6.

---

## 1. Architecture fonctionnelle complète

Modules fonctionnels, regroupés par domaine :

| Domaine | Modules |
|---|---|
| **Identité & comptes** | Inscription/connexion (particulier, pro), vérification téléphone/email/identité, profils publics, badges de confiance |
| **Catalogue véhicules** | Référentiel marque→modèle→génération→année→version→motorisation (base structurée, évolutive) |
| **Annonces** | Assistant de publication (11 étapes), statuts (brouillon/attente/publiée/suspendue/refusée/vendue/expirée), révision/renouvellement |
| **Recherche** | Moteur à facettes, recherche en langage naturel (NLP→filtres), pages SEO marque/modèle/wilaya |
| **Fiche véhicule** | Galerie médias, caractéristiques, prix + estimation marché, badges (bon prix, vérifié…) |
| **Pricing intelligence** | Système « Bon Prix » (badge par annonce), « Cote SOUQ AUTO » (estimateur autonome), historique de prix |
| **Confiance & sécurité** | Score de confiance, vérification vendeur, détection de fraude, signalement, modération (auto + humaine) |
| **Interaction** | Messagerie interne, révélation contrôlée du téléphone, favoris, alertes, comparateur (jusqu'à 4 véhicules) |
| **Vitrines pro** | Boutique professionnelle, CRM simplifié (stock, prospects, statistiques, collaborateurs) |
| **Monétisation** | Formules annonces particuliers, abonnements pro, services premium acheteurs, publicité, PaymentProvider abstrait |
| **IA** | AI Listing (rédaction d'annonce), AI Price (estimation), AI Fraud, AI Compare, AI Advisor/Buyer, analyse photo |
| **Contenu & SEO** | Pages marque/modèle/wilaya, blog « SOUQ AUTO MAG », données structurées schema.org |
| **Back-office** | Administration complète, modération, gestion des référentiels, statistiques, paiements/abonnements |
| **Plateforme** | Notifications (email/push/SMS à terme), i18n FR/AR (RTL)/EN, multi-devise (DZD pivot), analytics |

---

## 2. Arborescence du site (sitemap)

```
/                                    Accueil
/recherche                           Résultats (filtres en query string, SEO-friendly)
/voitures/{marque}                          Page marque — ex: /voitures/renault
/voitures/{marque}/{modele}                 Page modèle — ex: /voitures/renault/clio
/voitures/{marque}/{modele}/{annee}/{slug-id}  Fiche annonce (URL SEO)
/wilaya/{wilaya}                            Page wilaya — ex: /wilaya/alger
/comparateur
/cote-souq-auto                      Estimateur (formulaire → résultat)
/vendre                              Landing "Vendre mon véhicule" → assistant de publication
/publier/etape-1..11                 Assistant de publication (wizard)
/professionnels                      Landing pro (abonnements)
/boutique/{slug-pro}                 Vitrine professionnelle
/mag                                 Blog SOUQ AUTO MAG
/mag/{slug-article}
/compte/tableau-de-bord              Dashboard acheteur
/compte/mes-annonces                 Dashboard vendeur particulier
/compte/messages
/compte/favoris
/compte/alertes
/pro/tableau-de-bord                 CRM professionnel
/pro/stock
/pro/statistiques
/admin/...                           Back-office (auth séparée, rôle admin/modérateur)
/legal/confidentialite, /legal/cgu, /legal/cookies
```

Règles SEO : chaque niveau (marque, modèle, wilaya, annonce) génère automatiquement title/meta/canonical/OG/schema.org (`Vehicle`, `Product`, `Offer`) + sitemap.xml segmenté (annonces / marques / modèles / wilayas / mag).

---

## 3. Rôles utilisateurs

| Rôle | Description | Périmètre |
|---|---|---|
| **Visiteur** | Non connecté | Recherche, consultation, cote indicative limitée |
| **Acheteur** | Compte particulier | Favoris, alertes, messagerie, comparateur, services premium optionnels |
| **Vendeur particulier** | Compte particulier + annonces | Publication, dashboard vendeur, statistiques de base |
| **Professionnel** | Compte entreprise vérifié | Vitrine, CRM, stock, abonnement, collaborateurs (sous-comptes) |
| **Collaborateur pro** | Sous-compte rattaché à un professionnel | Droits limités définis par le pro (ex : gestion annonces seulement) |
| **Modérateur** | Back-office | Modération annonces/avis/signalements, pas d'accès financier |
| **Administrateur** | Back-office | Accès complet : utilisateurs, paiements, référentiels, configuration |
| **Support** (V2+) | Back-office restreint | Messagerie/litiges, pas d'accès configuration |

Un même compte peut cumuler acheteur + vendeur particulier. Le statut professionnel est une caractéristique du compte (vérification KYC légère), pas un rôle technique distinct au sens permissions.

---

## 4. Modèle économique

Principe directeur (règle 50 du brief) : **ne jamais dépendre d'une seule source de revenus.**

### A. Vendeurs particuliers
| Formule | Positionnement |
|---|---|
| Standard | Gratuite ou très faible coût, visibilité normale, durée limitée |
| Premium | Payante, remontée dans les résultats, badge, durée prolongée |
| Premium+ | Payante (supérieure), mise en avant homepage + top de liste |

### B. Professionnels (abonnements mensuels/annuels)
| Palier | Contenu |
|---|---|
| Starter | Quota d'annonces limité, vitrine basique |
| Business | Quota supérieur + statistiques |
| Pro | Stock important + outils avancés (renouvellement auto, export) |
| Premium | Stock illimité (ou très large) + visibilité maximale + API (V3+) |

### C. Services premium acheteurs
Rapport détaillé, estimation avancée, historique, comparaison avancée, alerte premium, rapport de risque — **toujours distingués visuellement** entre « estimation SOUQ AUTO » et « vérification par un tiers/partenaire officiel ».

### D. Autres revenus
Publicité automobile ciblée (assurance, banques, garages, pièces, financement), partenariats (V4), données/statistiques agrégées pour professionnels (V5, anonymisées).

### E. Paiement
Voir §11 — architecture `PaymentProvider` indépendante du prestataire.

---

## 5. Structure de base de données (schéma logique)

PostgreSQL relationnel. Tables principales et relations clés (types et contraintes détaillés en phase Architecture de chaque module, cf. §57 méthode de travail) :

```
users (id, email, phone, password_hash, role, email_verified, phone_verified,
       identity_verified, locale, created_at)
profiles (user_id FK, display_name, wilaya_id FK, bio, avatar_url)
professional_accounts (id, user_id FK, nom_commercial, logo_url, adresse,
       wilaya_id FK, horaires, presentation, reseaux_sociaux JSON,
       badge_verifie, subscription_id FK, created_at)
pro_collaborators (id, professional_account_id FK, user_id FK, permissions JSON)

wilayas (id, code, nom_fr, nom_ar)
communes (id, wilaya_id FK, nom_fr, nom_ar)

brands (id, slug, nom, logo_url)
models (id, brand_id FK, slug, nom)
generations (id, model_id FK, nom, annee_debut, annee_fin)
versions (id, generation_id FK, nom, motorisation, carburant, puissance_ch,
       cylindree, boite, transmission)
engines (id, version_id FK, ...)                -- détail moteur si nécessaire

listings (id, seller_id FK, seller_type ENUM(particulier,professionnel),
       version_id FK (nullable si véhicule hors référentiel),
       categorie ENUM(voiture,utilitaire,poids_lourd,deux_roues,autre),
       titre, description, prix, annee, kilometrage, etat ENUM(neuf,occasion),
       premiere_main BOOL, accidente BOOL, wilaya_id FK, commune_id FK,
       statut ENUM(brouillon,attente,publiee,suspendue,refusee,vendue,expiree),
       formule ENUM(standard,premium,premium_plus),
       score_confiance INT, vues INT, created_at, published_at, expires_at)
listing_equipements (listing_id FK, equipement_id FK)   -- table de jointure
equipements (id, nom, categorie)
listing_photos (id, listing_id FK, url, ordre, qualite_score, tags_ia JSON)
listing_videos (id, listing_id FK, url)

locations (id, listing_id FK, lat, lng)          -- géoloc facultative annonce

favorites (id, user_id FK, listing_id FK NULL, professional_account_id FK NULL)
searches (id, user_id FK, criteres JSON, created_at)     -- recherches sauvegardées
alerts (id, user_id FK, criteres JSON, canal ENUM(email,push,sms), actif BOOL)

conversations (id, listing_id FK, buyer_id FK, seller_id FK, created_at)
messages (id, conversation_id FK, sender_id FK, contenu, photo_url, lu_at, created_at)

reviews (id, professional_account_id FK NULL, seller_id FK NULL, author_id FK,
       note INT, commentaire, created_at)
reports (id, listing_id FK NULL, user_id_signale FK NULL, author_id FK,
       motif, statut ENUM(ouvert,traite,rejete), created_at)

payments (id, user_id FK, montant, devise, provider, statut, reference_externe,
       objet ENUM(annonce_premium,abonnement,service_premium,pub), created_at)
subscriptions (id, professional_account_id FK, palier, statut, date_debut, date_fin)
promotions (id, listing_id FK, type ENUM(premium,premium_plus), date_debut, date_fin)

price_estimations (id, version_id FK, wilaya_id FK NULL, annee, kilometrage_min,
       kilometrage_max, prix_bas, prix_moyen, prix_haut, confiance_pct,
       echantillon_taille, calculee_at)
vehicle_scores (id, listing_id FK, badge ENUM(tres_bonne_affaire,bon_prix,
       correct,eleve,tres_eleve), ecart_pct, calculee_at)
verification_reports (id, listing_id FK, type, statut, details JSON,
       verifie_par, created_at)

notifications (id, user_id FK, type, contenu JSON, lu_at, created_at)
audit_logs (id, admin_id FK, action, cible_type, cible_id, details JSON, created_at)
```

Index prioritaires (Lot d'implémentation) : `listings(statut, categorie, wilaya_id, prix, annee)`, recherche plein-texte/trigram sur `titre/description`, FK indexées systématiquement, `listings(version_id, kilometrage)` pour les calculs de cote.

---

## 6. Architecture technique

### Décision de stack (à valider par le porteur du projet)

Contrairement aux applications métier internes du groupe (Al Handassa Béton, Structure…, en PyQt6 desktop), **SOUQ AUTO est un produit grand public avec exigence SEO forte** (§31-33 du brief : URL par annonce/marque/modèle/wilaya, indexation Google, temps de chargement). Une SPA classique (React+Vite pur, sans rendu serveur) serait pénalisante pour le référencement. Recommandation :

| Couche | Choix proposé | Justification |
|---|---|---|
| Frontend | **Next.js (React, SSR/SSG/ISR)** | SEO natif, pages marque/modèle/wilaya en génération statique incrémentale, i18n intégré (FR/AR RTL/EN) |
| Backend API | **Node.js/NestJS** (ou API routes Next.js pour le MVP) | Cohérence TypeScript full-stack, écosystème mature |
| Base de données | **PostgreSQL + PostGIS** | Relationnel robuste, PostGIS pour recherche géographique par wilaya/commune/rayon |
| Recherche | **Meilisearch** (MVP) → réévaluer Elasticsearch en V3+ si volume l'exige | Facettes rapides, bon support FR/AR, plus simple à opérer que Elasticsearch |
| Stockage médias | **Objet compatible S3** (MinIO auto-hébergé ou fournisseur DZ/régional) | Photos/vidéos/documents de vérification |
| Cache/rate-limit/queues | **Redis + BullMQ** | Sessions, rate limiting, jobs asynchrones (notifications, calculs de cote, IA) |
| Couche IA | **API Claude (Anthropic)** avec repli heuristique si clé absente | Cohérent avec le pattern déjà utilisé sur les autres apps du groupe (repli honnête sans IA) |
| Paiement | Couche `PaymentProvider` abstraite (voir §11) | Aucun prestataire unique câblé en dur |
| Notifications | Email (SMTP réel), Web Push ; SMS en V3+ via passerelle DZ | Pas de simulation — preuve de livraison réelle comme sur les autres apps du groupe |
| Auth | JWT + refresh token, hash Argon2/bcrypt, 2FA optionnel (V2) | Cohérent avec le standard sécurité du groupe |

*(Si le porteur du projet préfère une stack alternative — ex. FastAPI/Python côté backend comme la majorité des autres apps filles — cela reste compatible : seul le frontend Next.js est structurant pour le SEO ; le backend peut être Node ou Python indifféremment derrière une API REST/GraphQL.)*

### Séparation en couches (conforme §45 du brief)
```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Next.js) — web responsive mobile-first          │
├─────────────────────────────────────────────────────────┤
│ API Gateway / Backend (REST, auth JWT)                    │
├───────────────┬───────────────┬───────────────┬──────────┤
│ Search Engine  │ AI Layer      │ Notification  │ Payment  │
│ (Meilisearch)  │ (Claude API)  │ (email/push)  │ Layer    │
├───────────────┴───────────────┴───────────────┴──────────┤
│ Database (PostgreSQL+PostGIS)   │  Storage (S3-compatible) │
├─────────────────────────────────────────────────────────┤
│ Analytics (événements produit, tableaux de bord internes)  │
└─────────────────────────────────────────────────────────┘
```

Sécurité transverse (§47) : validation stricte des uploads (type MIME réel, pas extension client — cf. leçon retenue sur d'autres apps du groupe : ne jamais utiliser le nom de fichier client dans un chemin de stockage), CSRF/XSS/SQLi standards (ORM paramétré), rate limiting par IP/compte, logs d'audit sur toute action admin, chiffrement des données sensibles au repos (téléphone, documents de vérification).

---

## 7. Pages principales

Accueil · Résultats de recherche · Fiche véhicule · Cote SOUQ AUTO (estimateur) · Comparateur · Assistant de publication (11 étapes) · Vitrine professionnelle · Page marque · Page modèle · Page wilaya · Blog (liste + article) · Dashboard acheteur · Dashboard vendeur particulier · CRM professionnel · Messagerie · Back-office (utilisateurs, annonces, modération, paiements, référentiels, statistiques).

---

## 8. Parcours acheteur

```
Accueil → recherche (filtres ou langage naturel)
       → résultats (tri, favoris, comparateur)
       → fiche véhicule (galerie, prix vs estimation, badges)
       → contact vendeur (messagerie interne OU révélation contrôlée du téléphone)
       → [option] service premium (rapport, historique)
       → [option] alerte sauvegardée si aucun résultat satisfaisant
       → suivi dans dashboard (messages, favoris, alertes)
```

## 9. Parcours vendeur particulier

```
Compte → "Vendre mon véhicule" → assistant 11 étapes
   (type vendeur → véhicule → caractéristiques → état → prix
    → photos → description [assistée IA] → coordonnées → prévisualisation
    → paiement formule → publication)
→ statut "en attente" (modération auto + éventuelle revue humaine)
→ publiée → dashboard (vues, contacts, messages, statistiques)
→ renouvellement / passage premium / marquage "vendue"
```

## 10. Parcours vendeur professionnel

```
Inscription pro → vérification (KYC léger : registre de commerce si disponible)
→ choix abonnement (Starter/Business/Pro/Premium)
→ configuration vitrine (logo, présentation, horaires)
→ import/saisie stock (unitaire ou en masse V2+)
→ CRM : suivi prospects, messages, statistiques, renouvellements
→ gestion collaborateurs (sous-comptes à droits limités)
```

---

## 11. Système de paiement

Architecture `PaymentProvider` (interface), aucun prestataire câblé en dur :

```
interface PaymentProvider {
  createPaymentIntent(amount, currency, metadata)
  confirmPayment(reference)
  handleWebhook(payload)
  refund(reference, amount?)
}
```

Implémentations envisageables pour le marché algérien (à confirmer selon disponibilité légale/technique au moment du développement) : carte interbancaire CIB/Edahabia (SATIM), virement bancaire avec confirmation manuelle back-office (fallback MVP fiable), et une option internationale (Stripe/PayPal) réservée si un jour pertinente pour la diaspora. Devise pivot : **DZD**, champ devise prévu dès le schéma pour extension future (§41).

---

## 12. Système de publication

Wizard en 11 étapes (détaillé §14 du brief) : type de vendeur → véhicule → caractéristiques → état → prix → photos → description → coordonnées → prévisualisation → paiement → publication. Sauvegarde en brouillon à chaque étape. Modération automatique (règles + IA) avant passage en « publiée », avec file de revue humaine pour les cas ambigus (prix aberrant, photos suspectes, compte à risque).

## 13. Moteur de recherche

- Facettes structurées : marque/modèle/version/année/prix/km/wilaya/commune, mécanique (carburant/boîte/transmission), équipements, état, type de vendeur.
- Recherche en langage naturel : un service NLP (Claude API) traduit une requête libre (« SUV diesel automatique moins de 4 millions à Alger ») en filtres structurés, jamais l'inverse — l'IA ne remplace pas les filtres, elle les pré-remplit.
- Index Meilisearch synchronisé de manière asynchrone (event-driven) à chaque changement de statut d'annonce.

## 14. Système de cote SOUQ AUTO

Deux composants distincts, jamais présentés comme une vérité absolue (formulation imposée : *« Estimation indicative basée sur les données disponibles sur le marché »*) :

1. **Badge « Bon Prix »** par annonce : compare le prix affiché à l'estimation calculée pour un véhicule comparable (marque/modèle/année/version/km/wilaya/état/équipements) → 5 niveaux (très bonne affaire → très élevé).
2. **Estimateur autonome** (« Cote SOUQ AUTO ») : formulaire libre (hors annonce) → fourchette basse/moyenne/haute + niveau de confiance basé sur la taille de l'échantillon comparable disponible.

Le moteur de calcul est un module isolé (`price_estimations`), recalculé périodiquement (job planifié) à mesure que la base d'annonces grandit — sa fiabilité progresse avec le volume de données, ce qui doit être communiqué honnêtement dès le MVP (échantillon faible au lancement).

## 15. Système de confiance

Score de confiance (0-100) par vendeur, basé sur des signaux vérifiables (téléphone/email/identité vérifiés, ancienneté du compte, complétude et cohérence des annonces, avis, absence de signalements) — jamais transformé en accusation, jamais affiché comme un jugement moral, uniquement un indicateur d'assistance à la décision.

## 16. Système anti-fraude

Règles + IA : détection de prix anormalement bas, photos dupliquées inter-annonces, comptes/comportements suspects, incohérences véhicule/prix, spam. Bandeau d'avertissement non accusatoire + circuit de signalement utilisateur. Statuts d'annonce dédiés (suspendue) pour isoler un cas sans le supprimer arbitrairement avant revue humaine.

## 17. Back-office

Gestion utilisateurs/vendeurs/professionnels, annonces (modération, statuts), référentiels (catégories, marques, modèles, équipements, wilayas/communes), paiements/abonnements/promotions, signalements/fraude, avis, statistiques produit, contenu (blog, pages SEO), publicité. Journal d'audit sur toute action sensible (cf. `audit_logs`).

---

## 18. Plan de développement (MVP → V5)

| Phase | Contenu | Sortie |
|---|---|---|
| **Lot 0 (ce document)** | Cadrage, architecture, validation | Ce cahier |
| **MVP (Phase 1)** | Comptes, publication (sans IA), recherche+filtres, fiche véhicule, photos, contact vendeur (messagerie), paiement (au moins 1 provider ou virement manuel), favoris, back-office de base, modération | Plateforme utilisable de bout en bout |
| **V2 (Phase 2)** | Estimation de prix, Cote SOUQ AUTO, comparateur, alertes, profils/vitrines professionnels | Différenciation prix + pro |
| **V3 (Phase 3)** | IA (AI Listing, recherche langage naturel), score de confiance, détection de fraude, analyse photo, historique des prix | Couche intelligence |
| **V4 (Phase 4)** | Véhicule vérifié, partenariats (financement, assurance), services automobiles | Écosystème de confiance |
| **V5 (Phase 5)** | Écosystème complet INGENICA AUTO (financer/assurer/entretenir/louer/pièces/garages) | Vision long terme §52 |

Méthode d'exécution (conforme §57-58 du brief) : chaque module suit Analyse → Architecture → Base de données → API → Interface → Tests → Sécurité → Audit → Optimisation → Validation, un module validé avant le suivant. Aucun lot ne démarre sans validation explicite du lot précédent par le porteur de projet — comme pour les autres applications du groupe INGENICA.

---

## Prochaine étape

Ce document couvre les 18 points demandés en clôture du brief (§60). **Aucun code n'a été écrit.** Merci de valider :
1. le choix de stack proposé (§6), notamment Next.js pour le SEO ;
2. le découpage MVP (§18) — contenu et ordre des lots ;
3. le schéma de données (§5) — noms/champs avant génération des migrations.

Une fois validé, le développement démarrera au Lot 1 du MVP, module par module, selon la méthode §57.
