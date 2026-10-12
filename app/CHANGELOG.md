# Souq Auto — journal des lots

## Lot 295 — Notifications temps réel + alertes prix favoris (2026-10-12)

**Livré**
- Cloche de notification visible en permanence dans le header (desktop + mobile) avec badge compteur.
- Mise à jour temps réel du badge via SSE (`/api/notifications/stream`) — le compteur se met à jour sans recharger la page.
- Pub/sub notifications dans `realtime.ts` (canal `notification:{userId}`, Redis ou repli mémoire).
- Baisse de prix sur favoris : passage de l'email seul aux 3 canaux (email + push + in-app) via `notifyUser()`.
- Nouveau kind `FAVORITE_PRICE_DROP` dans `NotificationKind`.
- Le badge se remet à zéro instantanément après « Tout marquer comme lu ».
- Migration Prisma appliquée, i18n FR/AR complet, 5 tests realtime + enum.

## Lot 1 — Comptes & fondations (2026-09-02)

Premier module codé après validation du cahier d'architecture ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)), stack Next.js confirmée.

**Livré**
- Scaffold Next.js 16 (App Router, TypeScript, Tailwind), backend en API Routes pour le MVP.
- i18n FR/AR dès la conception (next-intl), RTL vérifié visuellement (mise en page entièrement miroir en arabe).
- Prisma + SQLite dev (`User`, `Profile`, `Wilaya`), 58 wilayas officielles seedées (FR + AR).
- Comptes particuliers : inscription, connexion, déconnexion, session JWT (cookie httpOnly), tableau de bord protégé.
- Sécurité Lot 1 : mots de passe bcrypt (12 rounds), validation zod, rate limiting (mémoire, mono-instance), messages d'erreur non énumérables à la connexion, aucun secret commité.
- Tests unitaires (hash mot de passe, session JWT, schémas de validation) — 7/7 passent.
- Vérification navigateur réelle : inscription → tableau de bord → déconnexion → connexion (échec puis succès) → accès protégé refusé si déconnecté → email déjà utilisé refusé → bascule FR/AR.

**Décisions/notes**
- Prisma épinglé en 6.19.3 (une release candidate 8.x était installée par défaut par npm ; une vulnérabilité `deepmerge-ts` résiduelle affecte uniquement le CLI Prisma en dev, pas le client livré en production).
- `turbopack.root` fixé explicitement (un `package.json` préexistant et non lié au projet, dans le dossier utilisateur, faisait remonter la détection de monorepo).
- Next.js 16 a renommé `middleware.ts` en `proxy.ts` — utilisé directement pour éviter un fichier déprécié dès le départ.

**Reporté à un lot ultérieur**
- Table `communes` et le reste du schéma (annonces, etc.) — arriveront avec les modules qui en ont besoin.
- Bascule PostgreSQL + PostGIS, rate limiting Redis — nécessitent l'infra cible (actuellement indisponible en local, Docker Desktop hors service sur cette machine).
- CSRF dédié — non nécessaire tant qu'aucune route mutante authentifiée sensible n'existe au-delà de la déconnexion.

Prochain lot proposé : **publication d'annonces (assistant 11 étapes, sans IA)** — cf. docs/ARCHITECTURE.md §12 et §18.

## Lot 2 — Publication d'annonces (2026-09-02)

**Livré**
- Catalogue véhicules : `Brand`/`Model`, 24 marques réelles et 108 modèles vendus en Algérie (Renault, Peugeot, Dacia, Volkswagen, Hyundai, Toyota, Chery, Haval…) — schéma volontairement plat, sans génération/version/moteur fabriqués sans source fiable.
- Repli texte libre (`brandFreeText`/`modelFreeText`) pour tout véhicule hors catalogue (motos, marques non listées) — jamais de fiche catalogue inventée pour compenser.
- Assistant de publication en 11 étapes (`/publier/etape-1`…`etape-11`), état partagé via un contexte React persisté en `sessionStorage` (survit à une navigation entre étapes ou un rechargement accidentel ; les photos, elles, restent en mémoire uniquement).
- Upload photos réel : type MIME sniffé sur les octets (jamais l'extension/le type déclaré par le client), redimensionnement + recompression JPEG via `sharp`, nom de fichier aléatoire (jamais le nom fourni par le client) — 1 à 10 photos, 8 Mo max chacune.
- Fiche annonce minimale (`/annonce/[id]`) : galerie, prix, caractéristiques, description, vendeur, révélation du téléphone au clic.
- Tableau de bord vendeur (`/compte/mes-annonces`).
- Téléphone du compte (`User.phone`, déjà prévu au schéma Lot 1) renseigné à la publication si absent — réutilisé tel quel aux publications suivantes.
- Sécurité : rate limiting dédié à la création d'annonces (5/heure/utilisateur), validation zod complète, vérification référentielle marque/modèle/wilaya côté serveur (jamais la seule validation client).
- Tests unitaires (schéma d'annonce, slugify/catalogue) — 20/20 passent au total avec le Lot 1.
- Vérification : test API direct (login + upload multipart avec deux vraies images JPEG) confirmant la chaîne complète (validation → sniffing MIME → redimensionnement → écriture disque → création BDD avec relations) ; puis vérification navigateur de la fiche annonce, de « Mes annonces », du reveal téléphone et du rendu RTL arabe sur la fiche annonce.

**Décisions/notes**
- **Aucune modération** en Lot 2 : les annonces passent directement en statut `PUBLIEE` après validation des champs, faute de back-office/file de modération humaine (prévus dans un lot ultérieur, cf. docs/ARCHITECTURE.md §17). Documenté dans le code (`api/listings/route.ts`) pour ne pas être oublié.
- **Formule unique** : seule la formule Standard (gratuite) est fonctionnelle ; Premium/Premium+ sont affichées mais désactivées (« bientôt disponible ») tant que la couche `PaymentProvider` n'existe pas.
- **Pas d'upload testé via navigateur réel** : l'extension Claude in Chrome n'était pas connectée dans cette session, et le pane de prévisualisation intégré n'expose pas d'outil de sélection de fichier natif. La chaîne d'upload a donc été vérifiée par un appel API direct (multipart réel, deux images JPEG) plutôt que par un clic utilisateur simulé — à revérifier en conditions réelles au premier usage humain.
- Un cache `.next` laissé par une build de production précédente, réutilisé par erreur par le serveur de dev, a provoqué un aller-retour intempestif vers l'accueil pendant les tests — résolu en vidant `.next` avant chaque `next dev` qui suit un `next build` (aucun bug applicatif).

**Reporté à un lot ultérieur**
- Recherche/filtres, pages SEO marque/modèle/wilaya, badge « Bon Prix » — nécessitent respectivement le moteur de recherche et le moteur de cote (lots dédiés).
- Statuts d'annonce autres que `PUBLIEE` (brouillon persistant multi-session, suspension, expiration/renouvellement) — significatifs seulement une fois le back-office/modération en place.
- Stockage S3-compatible (actuellement disque local sous `public/uploads/`, gitignoré).

Prochain lot proposé : **moteur de recherche + résultats** (filtres, pages `/recherche`) — cf. docs/ARCHITECTURE.md §13 et §18.

## Lot 3 — Moteur de recherche (2026-09-02)

**Livré**
- Page `/recherche` : filtres complets (catégorie, marque→modèle en cascade, wilaya, prix min/max, année min/max, kilométrage max, carburant, boîte, état), tri (plus récent / prix croissant / prix décroissant), pagination (20/page), état vide honnête.
- Recherche texte libre (`q`) sur titre, marque/modèle (catalogue et texte libre) et wilaya (FR+AR) — via clauses `OR` Prisma, pas de moteur dédié (Meilisearch reste la cible V2+, cf. docs/ARCHITECTURE.md §06).
- Barre de recherche de l'accueil rendue fonctionnelle (texte libre → `/recherche?q=...`) ; le même composant `SearchFilters` sert en mode compact (accueil) et complet (page résultats), évitant la duplication.
- Compteur de vues réel sur la fiche annonce (incrémenté uniquement pour un visiteur autre que le vendeur), déjà affiché dans « Mes annonces » et sur les cartes de résultats.
- Filtres et tri pilotés par l'URL (query string) — résultats partageables/consultables en lien direct, cohérent avec l'objectif SEO du cahier d'architecture.
- Tests unitaires du constructeur de requête (`buildListingWhere`/`buildListingOrderBy`/pagination) et du schéma de validation des paramètres — 37/37 tests passent au total.
- Vérification navigateur : recherche texte libre, filtre marque sans résultat (état vide), combinaison prix+wilaya avec résultat, tri, incrémentation réelle des vues (0→1 visiteur déconnecté, pas d'incrément pour le propriétaire vérifié après correction d'un faux positif de test), rendu RTL arabe complet de la page de résultats.

**Décisions/notes**
- Aucune indexation dédiée (Meilisearch/Elasticsearch) : les filtres tournent directement sur Prisma/SQLite, suffisant au volume actuel. À réévaluer quand le catalogue d'annonces grossira (cf. §06).
- Filtre « type de vendeur » du cahier des charges non implémenté : sans comptes professionnels (V2), il n'aurait qu'une seule valeur possible — ajouté quand les vitrines pro existeront.
- Comparateur et favoris (actions listées à côté des résultats dans le brief) volontairement hors périmètre — ce sont des sections dédiées du cahier d'architecture (§26, §28), pas des sous-produits du moteur de recherche.

**Reporté à un lot ultérieur**
- Recherche en langage naturel (IA), badge « Bon Prix », pages SEO dédiées marque/modèle/wilaya, favoris, comparateur.

Prochain lot proposé : **estimation de prix / Cote Souq Auto** ou **favoris + comparateur** — cf. docs/ARCHITECTURE.md §14 et §18 (à votre choix).

## Lot 4 — Cote Souq Auto (2026-09-02)

**Livré**
- Estimateur autonome (`/cote-souq-auto`) : marque→modèle en cascade, année/kilométrage/wilaya optionnels, fourchette basse/centrale/haute + niveau de confiance.
- Badge « Bon Prix » (5 niveaux, cf. docs/ARCHITECTURE.md §11) sur la fiche annonce, avec le bloc « Estimation Souq Auto » (prix demandé / estimation du marché / écart) et la formule obligatoire *« Estimation indicative basée sur les données disponibles sur le marché »*.
- Calcul **en temps réel** sur les annonces publiées comparables (pas de table `price_estimations` pré-calculée : le volume actuel ne le justifie pas — cf. « Décisions » ci-dessous).
- Algorithme de repli progressif honnête : essaie marque+modèle+année+kilométrage+wilaya, puis relâche un critère à la fois (wilaya → kilométrage → année) dès qu'un palier trouve au moins une annonce comparable, et **affiche explicitement quels critères ont été ignorés faute de données** plutôt que de fabriquer un résultat.
- Aucun résultat fabriqué à zéro échantillon : message explicite (« pas encore assez d'annonces ») plutôt qu'un chiffre inventé ; le badge coloré exige en plus un minimum de 3 annonces comparables pour s'afficher.
- Tests unitaires (calcul médiane/fourchette, formule de confiance, 5 seuils du badge aux limites exactes) — 52/52 tests passent au total.
- Vérification navigateur avec un jeu de données réel (6 Renault Clio à prix variés, injectées via l'API comme au Lot 2) : badge « Prix élevé (+6 %) » calculé et affiché correctement sur la fiche annonce, estimateur autonome vérifié à la main (médiane, fourchette, confiance 61 % à 6 échantillons), repli de filtre wilaya vérifié avec message explicite, cas « pas assez de données » vérifié (marque sans annonce), rendu RTL arabe complet.
- **Bug trouvé et corrigé pendant la vérification** : la fourchette basse/centrale/haute affichée sur 3 colonnes se chevauchait visuellement (montants à 7 chiffres trop larges pour la largeur de la barre latérale) — repris en bloc empilé (valeur centrale en avant, basse/haute côte à côte en dessous), revérifié en FR et AR.

**Décisions/notes**
- Pas de tables `price_estimations`/`vehicle_scores` (prévues au cahier d'architecture §5) : sans job planifié ni volume d'annonces suffisant, un cache pré-calculé n'apporterait rien d'autre qu'une source de désynchronisation. Calcul à la demande à la place ; la bascule vers un cache recalculé périodiquement redevient pertinente quand le nombre d'annonces publiées grandira (cf. docs/ARCHITECTURE.md §14, déjà anticipé).
- Formule de confiance = heuristique simple basée uniquement sur la taille de l'échantillon (documentée comme telle dans le code), pas une calibration statistique — cohérent avec l'avertissement obligatoire du cahier d'architecture.
- Badge affiché uniquement sur la fiche annonce (pas sur les cartes de résultats de recherche) : l'afficher sur une liste de résultats impliquerait une estimation par carte (N requêtes d'agrégation par page), un coût qui ne se justifie qu'une fois le cache existant — décision cohérente avec celle ci-dessus.

**Reporté à un lot ultérieur**
- Badge « Bon Prix » sur les cartes de résultats de recherche (nécessite le cache `price_estimations`).
- Historique des prix, prise en compte des équipements dans l'estimation (pas de table équipements pour l'instant).

Prochain lot proposé : **favoris + comparateur** — cf. docs/ARCHITECTURE.md §26 et §28.

## Lot 5 — Favoris & comparateur (2026-09-02)

**Livré**
- Favoris : table `Favorite` (persistée, un utilisateur ↔ une annonce), bouton cœur sur les cartes de résultats et la fiche annonce, page `/compte/favoris`. Nécessite un compte (redirection vers `/connexion` sinon).
- Comparateur jusqu'à 4 véhicules : sélection depuis les cartes de résultats ou la fiche annonce, tray flottant sitewide (compteur + « Comparer » + « Vider »), page `/comparateur` avec tableau comparatif complet (prix, année, kilométrage, carburant, boîte, état, wilaya, puissance, couleur). Fonctionne **sans compte** (état côté client, `localStorage`), cohérent avec l'usage habituel de ce type d'outil sur les sites comparables.
- 57/57 tests passent (dont la logique pure de sélection/plafond du comparateur), build propre.
- Vérification navigateur complète avec les 6 annonces créées au Lot 4 : favori ajouté/retiré en direct, sélection de 2 puis 4 véhicules au comparateur, retrait d'une colonne, redirection vers la connexion pour un visiteur déconnecté qui tente de mettre en favori, rendu RTL arabe du comparateur et du tray.

**Deux bugs réels trouvés et corrigés pendant la vérification (pas seulement des tests qui passent) :**
1. **Tray de comparaison invisible en capture d'écran** — `backdrop-blur` combiné à un fond semi-transparent (`bg-white/95`) faisait disparaître entièrement l'élément `position: fixed` du rendu capturé, alors que le DOM/CSSOM confirmaient un positionnement correct. Remplacé par un fond blanc opaque + ombre portée légère — plus simple, aucun risque de rendu, aucune perte visuelle réelle.
2. **Page `/comparateur` systématiquement vide malgré une API renvoyant les bonnes données en requête directe** — cause racine : la route `/api/listings/compare` importait une constante (`MAX_COMPARE`) depuis un fichier marqué `"use client"` (`CompareContext.tsx`). Ce croisement de frontière client/serveur cassait silencieusement le rechargement à chaud de la route en développement (Turbopack) : elle continuait à servir une réponse figée sans qu'aucune erreur n'apparaisse, y compris après redémarrage complet du serveur et purge de `.next`. Corrigé en extrayant `MAX_COMPARE`/`toggleCompareId` dans `src/lib/compare.ts`, un module neutre sans directive, importable en toute sécurité par le client et par la route API. **Leçon retenue : ne jamais importer quoi que ce soit — même une simple constante — d'un fichier `"use client"` dans du code serveur (Route Handler, Server Component).**

**Décisions/notes**
- Favoris limités aux véhicules (pas de « vendeur favori » ni « recherche favorite ») : le premier suppose une page vitrine publique inexistante, le second recoupe les alertes (§27), qui exigent une infra de notification non construite.
- Comparateur volontairement sans compte ni persistance serveur : un plateau de comparaison est un usage transitoire de navigation, pas une donnée à sauvegarder côté utilisateur.

**Reporté à un lot ultérieur**
- Notifications de baisse de prix sur les favoris (§28) — nécessite l'infra de notification.
- Score de confiance vendeur, avis, sur le comparateur (§26) — nécessite le module confiance/avis, pas encore construit.

Prochain lot proposé : à définir avec le porteur de projet — modules restants principaux du MVP/V2 : page marque/modèle (SEO), profils/vitrines professionnels, ou back-office de modération.

## Lot 6 — Pages marque/modèle & SEO (2026-09-02)

**Livré**
- Pages marque (`/voitures/{marque}`) et modèle (`/voitures/{marque}/{modele}`), URLs par slug — nombre d'annonces, prix moyen, fourchette de prix, liste des modèles avec compteur et prix de départ (page marque), liste complète des annonces avec renvoi vers l'estimateur pré-rempli (page modèle). Statistiques calculées à la volée sur les annonces publiées réelles — jamais de chiffre inventé ; message honnête (« pas encore d'annonce publiée ») quand une marque/un modèle n'a aucune annonce, plutôt qu'une page vide sans explication.
- Métadonnées dynamiques (`generateMetadata`) sur les pages marque, modèle et fiche annonce : titre, description, URL canonique, Open Graph — y compris l'image de l'annonce en OG image.
- Données structurées schema.org : `Vehicle` + `Offer` sur la fiche annonce (marque, modèle, année, kilométrage, carburant, boîte, prix), `BreadcrumbList` sur les trois pages (marque, modèle, fiche annonce).
- Fil d'Ariane visuel (Accueil / Marque / Modèle / Titre) sur la fiche annonce, cliquable vers les nouvelles pages marque/modèle.
- `sitemap.xml` (141 URLs : pages statiques + 24 marques + 108 modèles + annonces publiées, avec alternates hreflang FR/AR) et `robots.txt` générés dynamiquement (`app/sitemap.ts`, `app/robots.ts`).
- `NEXT_PUBLIC_SITE_URL` introduite pour construire les URLs absolues (canonique, OG, JSON-LD, sitemap) — nécessaire en production.
- 62/62 tests passent (dont la construction pure des objets JSON-LD, testée indépendamment de Prisma/Next).
- Vérification navigateur : page Renault (stats exactes vérifiées à la main : moyenne, min/max, compteur par modèle), page Renault Clio, navigation croisée marque → modèle → estimateur pré-rempli, fil d'Ariane sur une fiche annonce avec JSON-LD Vehicle + BreadcrumbList extraits et validés directement depuis le DOM, page BMW (marque sans annonce) affichant le message honnête plutôt qu'une page vide, 404 réel pour une marque inexistante, `sitemap.xml`/`robots.txt` vérifiés via requêtes directes, rendu RTL arabe complet des deux pages.

**Décisions/notes**
- L'URL de la fiche annonce reste `/annonce/[id]` (et non le `/voitures/{marque}/{modele}/{annee}/{slug}` esquissé au Lot 0) : ce format existe déjà, est utilisé partout dans l'app (favoris, comparateur, tableau de bord vendeur), et une URL canonique + de bonnes métadonnées apportent l'essentiel du bénéfice SEO sans restructurer une route déjà en production. Noté comme piste d'amélioration cosmétique, pas un blocage.
- Pas de page d'index listant toutes les marques (`/voitures`) : hors du périmètre demandé (« page marque et page modèle ») ; les pages marque/modèle restent atteignables via le sitemap et le fil d'Ariane des annonces. Un index serait un complément naturel et rapide à ajouter.
- Contenu éditorial du cahier des charges volontairement omis sur la page modèle — génération/versions/consommation/« problèmes connus »/« conseils d'achat » : les produire exigerait soit une base technique par génération que nous n'avons pas (cf. décision du Lot 2 de ne pas fabriquer de fiches techniques), soit des connaissances automobiles générales non vérifiées présentées comme un contenu éditorial de la plateforme — un risque de désinformation qu'aucune partie de ce projet ne doit prendre. Seules des statistiques dérivées des annonces réelles sont affichées.

**Reporté à un lot ultérieur**
- Page d'index des marques, contenu éditorial vérifié par modèle (si une source fiable est un jour identifiée), badge « Bon Prix » sur les cartes de la page marque/modèle (même arbitrage N+1 que pour les résultats de recherche, cf. Lot 4).

Prochain lot proposé : à définir avec le porteur de projet.

## Lot 7 — Back-office & modération (2026-09-02)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : c'était l'écart le plus documenté depuis le Lot 2, signalé dans chaque changelog depuis (« aucune modération, publication directe faute de back-office »).

**Livré**
- **Changement de comportement majeur** : toute nouvelle annonce est désormais créée en statut `EN_ATTENTE` (au lieu de `PUBLIEE` directement) — invisible en recherche/pages marque-modèle tant qu'un modérateur ne l'a pas approuvée.
- Back-office (`/admin`, réservé aux rôles `ADMIN`/`MODERATEUR`) : tableau de bord (compteurs), file de modération (`/admin/annonces` — approuver/refuser avec motif obligatoire/suspendre une annonce déjà publiée), gestion des utilisateurs (`/admin/utilisateurs` — changement de rôle réservé à `ADMIN` seul, un modérateur voit les rôles en lecture seule).
- Journal d'audit (`AuditLog`) : chaque action de modération et changement de rôle est tracé (qui, quoi, ancien/nouveau statut, motif), conformément à l'exigence du cahier d'architecture (§17).
- Compte admin de dev seedé (`admin@souqauto.dz`, convention groupe INGENICA) — voir README pour le mot de passe.
- Bannière visible par le vendeur sur sa propre fiche annonce tant qu'elle n'est pas publiée (« en attente de modération », « refusée : {motif} », « suspendue : {motif} ») ; badges de statut réels (au lieu d'un badge « Publiée » toujours affiché) sur « Mes annonces ».
- Garde-fou : un administrateur ne peut pas modifier son propre rôle (empêche un verrouillage accidentel).
- Copie de l'assistant de publication et des messages de succès mise à jour pour refléter honnêtement le nouveau délai de vérification (« généralement sous 24h ») au lieu de promettre une publication immédiate.
- 72/72 tests passent (dont les règles de transition de statut testées exhaustivement, y compris aux limites).
- Vérification navigateur de bout en bout avec de vraies annonces créées via l'API : nouvelle annonce confirmée invisible en recherche tant qu'`EN_ATTENTE` ; approbation → apparaît en recherche ; refus sans motif → erreur affichée, avec motif → passe en `REFUSEE` et le vendeur voit le motif à deux endroits (Mes annonces + fiche annonce) ; suspension d'une annonce publiée avec motif → disparaît de la recherche ; accès `/admin` refusé (redirection) pour un compte `PARTICULIER` ; changement de rôle `PARTICULIER` → `MODERATEUR` vérifié en base + journal d'audit ; le nouveau modérateur accède à la modération mais voit les rôles en lecture seule (pas de sélecteur) ; garde-fou anti-auto-changement de rôle vérifié par appel API direct ; rendu RTL arabe complet du back-office.

**Décisions/notes**
- Pas de modération automatique par règles/IA (prévue au cahier d'architecture comme première étape avant la modération humaine) : sans volume d'annonces suffisant ni signaux d'abus observés, il n'y a rien de réel à détecter pour l'instant — une modération 100% humaine est honnête et suffisante au stade actuel. À réintroduire quand le volume le justifiera.
- Portée volontairement limitée à modération des annonces + gestion basique des rôles + journal d'audit : les autres pans du back-office listés au cahier d'architecture (référentiels, abonnements/promotions, statistiques produit, contenu/blog, publicité) restent hors périmètre — chacun mériterait son propre lot plutôt qu'un back-office monolithique construit d'un coup.
- Pas de signalement utilisateur (bouton « Signaler ») construit ce lot-ci : la capacité de suspendre existe côté admin, mais le déclencheur communautaire (§25) est un module à part entière, pas un sous-produit de la modération.

**Reporté à un lot ultérieur**
- Signalement d'annonce par les utilisateurs (§25), modération automatique par règles/IA, gestion des référentiels (marques/modèles/wilayas) depuis le back-office plutôt que par script de seed, statistiques produit avancées.

Prochain lot proposé : à définir avec le porteur de projet.

## Lot 8 — Messagerie interne (2026-09-02)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : écarté volontairement tout ce qui touche au paiement (sensibilité financière, mérite une discussion dédiée), la messagerie était le module non construit le plus attendu ensuite (contact acheteur/vendeur mentionné dans le cahier d'architecture comme fonctionnalité cœur de la fiche annonce, jusqu'ici seul le téléphone était révélable).

**Livré**
- Modèles `Conversation` (unique par couple annonce+acheteur), `Message`, `Block` (blocage unilatéral, indépendant par sens).
- Bouton « Contacter le vendeur » sur la fiche annonce (masqué pour le propriétaire de l'annonce — vérifié) : crée ou retrouve la conversation existante, redirige vers `/connexion` si non connecté.
- Messagerie complète : boîte de réception (`/compte/messages` — aperçu du dernier message, vignette annonce, compteur de non-lus par conversation), fil de conversation (`/compte/messages/[id]` — historique complet, marquage automatique comme lu à l'ouverture, réponse).
- Badge de messages non lus dans l'en-tête (calculé sur l'ensemble des conversations de l'utilisateur), se met à jour après tout aller-retour serveur complet (envoi de message, ouverture d'un fil) — limitation Next.js documentée ci-dessous.
- Blocage/déblocage d'un utilisateur depuis le fil : bloque l'échange dans les deux sens, message explicite affiché à chacune des deux parties (« vous avez bloqué » / « vous ne pouvez plus échanger de messages »), vérifié séparément côté bloqueur et côté bloqué.
- Sécurité : vérification systématique que l'expéditeur est bien participant à la conversation, re-vérification du blocage à l'envoi (pas seulement à l'affichage), rate limiting dédié (20 créations de conversation/heure, 60 messages/heure), contenu validé 1-2000 caractères (zod).
- 80/80 tests passent (dont les règles pures d'autorisation d'envoi — soi-même, bloqué, cas normal — testées indépendamment de Prisma/Next).
- Vérification navigateur de bout en bout avec deux vrais comptes (acheteur « Sara Hamdi » créé via le formulaire d'inscription réel, vendeur « Amine Benali ») : contact depuis la fiche annonce → premier message envoyé → badge non lu « 1 » et aperçu corrects côté vendeur → réponse du vendeur → badge se remet à 0 après affichage → blocage par le vendeur → message de blocage vérifié des deux côtés (bloqueur et bloqué) → bouton non affiché sur sa propre annonce (vérifié en se connectant en tant que propriétaire) → rendu RTL arabe complet de la boîte de réception et du fil (bulles de message correctement inversées par le sens du flexbox, aucune classe RTL manuelle nécessaire).

**Décisions/notes**
- Le badge de non-lus (calculé dans le layout partagé, `src/app/[locale]/layout.tsx`) ne se met pas à jour sur une simple navigation client (`<Link>`) entre deux pages du même layout — comportement normal de Next.js App Router (les données du layout ne sont pas re-fetchées tant qu'il n'est pas explicitement invalidé). Un `router.refresh()` après l'envoi d'un message le rafraîchit ; l'ouverture d'un fil depuis la boîte de réception le laisse stale jusqu'au prochain rechargement complet. Comportement mineur, documenté plutôt que corrigé par un contournement (ex : polling) qui ajouterait de la complexité pour un gain cosmétique.
- Pas de temps réel (WebSocket/SSE) : la messagerie fonctionne en requête-réponse classique avec rafraîchissement à la navigation, cohérent avec le volume actuel et l'absence d'infra dédiée ; à réévaluer si l'usage réel le justifie.
- Pas de pièces jointes/photos dans les messages, pas de suppression de message, pas de notification email/push à la réception — non demandés explicitement et chacun mériterait sa propre validation (notamment l'email, qui touche à l'infra SMTP).
- Blocage volontairement scindé du signalement (§25, toujours non construit, cf. Lot 7) : bloquer empêche l'échange, ce n'est pas un signalement au back-office ni une preuve pour la modération.

**Reporté à un lot ultérieur**
- Notifications email/push de nouveau message, pièces jointes, suppression de conversation/message, signalement d'un utilisateur depuis la messagerie, temps réel.

Prochain lot proposé : à définir avec le porteur de projet — paiement (formules Premium/Premium+, abstraction multi-fournisseurs) nécessite une discussion dédiée avant tout code, vu sa sensibilité financière.

## Lot 9 — Signalement d'annonce (§25) (2026-09-02)

Discussion sur le paiement menée avant tout code (cf. §11 du cahier d'architecture) : aucun prestataire algérien (SATIM/CIB-Edahabia) n'est intégrable sans identifiants marchands réels, et le porteur de projet a choisi d'attendre de les obtenir plutôt que de construire une façade non fonctionnelle. Grille tarifaire indicative Premium/Premium+ proposée en attendant (1 500 DA/30 j et 3 500 DA/30 j), à valider avant tout développement. Le signalement d'annonce a été choisi comme lot suivant : c'était l'écart documenté le plus ancien (mentionné dès le Lot 7, jamais construit depuis).

**Livré**
- Bouton discret « Signaler cette annonce » sur la fiche annonce (masqué pour le propriétaire, comme le contact vendeur) : motif obligatoire parmi 6 catégories (prix suspect, fraude suspectée, véhicule potentiellement volé, doublon, contenu inapproprié, autre — commentaire obligatoire uniquement pour « autre »), commentaire libre optionnel sinon.
- Un signalement par (annonce, auteur) — empêche le spam d'un même utilisateur sur la même annonce, y compris après qu'un signalement précédent a été traité ou rejeté (décision anti-abus : pas de re-signalement de la même annonce par la même personne dans ce lot).
- File de traitement back-office (`/admin/signalements`, réservée `ADMIN`/`MODERATEUR`) : liste des signalements ouverts avec vignette annonce, motif, commentaire, auteur et date ; actions « Traiter » / « Rejeter » avec note interne optionnelle (jamais visible par l'auteur du signalement).
- Compteur « Signalements ouverts » sur le tableau de bord back-office, mis en évidence quand non nul (même traitement visuel que les annonces en attente).
- Journal d'audit sur chaque décision de traitement/rejet, comme pour la modération des annonces.
- 83/83 tests passent (dont les règles pures de validation du motif et de transition de statut testées indépendamment de Prisma/Next).
- Vérification navigateur de bout en bout avec deux vrais comptes (Sara Hamdi signale, Amine Benali/modérateur traite) : bouton absent pour le propriétaire de l'annonce, formulaire avec motif « Autre » refusé sans commentaire (erreur affichée), signalement envoyé avec succès et persistant après rechargement (« vous avez déjà signalé cette annonce »), apparition dans la file back-office avec toutes les informations correctes, compteur du tableau de bord à jour, rejet du signalement avec note interne → disparition de la file + vérification directe en base de l'`AuditLog` et du `Report` mis à jour, rendu RTL arabe complet du formulaire de signalement et de la file back-office.

**Décisions/notes**
- Signalement d'utilisateur (hors annonce, prévu par le schéma cible §41 avec un `user_id_signale` nullable) volontairement hors périmètre : rien ne le consommerait aujourd'hui (pas de vitrine profil public) — colonne non ajoutée pour éviter un champ inutilisé, à étendre le jour où ce besoin devient réel.
- Pas de modération automatique déclenchée par un signalement (ex : suspension automatique après N signalements) : la décision reste 100% humaine via la file de traitement, cohérent avec le choix déjà fait pour la modération des annonces au Lot 7.
- « Traiter » un signalement ne suspend pas automatiquement l'annonce — ce sont deux actions déjà découplées dans le back-office (le modérateur suspend séparément depuis `/admin/annonces` s'il juge que c'est justifié) ; éviter de coupler les deux évite qu'un signalement isolé et non vérifié entraîne une action punitive automatique.

**Reporté à un lot ultérieur**
- Signalement d'utilisateur (profil), suspension automatique après seuil de signalements, notification à l'auteur du signalement une fois celui-ci traité.

Prochain lot proposé : à définir avec le porteur de projet — paiement reste en attente d'identifiants réels (SATIM/CIB-Edahabia ou Stripe/PayPal) ; sinon, comptes professionnels ou avis/réputation (§42) restent les grands modules non construits.

## Lot 10 — Avis vendeur (§26/§42) (2026-09-02)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : c'était l'écart documenté le plus ancien encore ouvert (signalé dès le Lot 5 — « score de confiance vendeur, avis, sur le comparateur — nécessite le module confiance/avis, pas encore construit »), plus ancien que le signalement d'annonce déjà traité au Lot 9.

**Livré**
- Nouvelle page vitrine vendeur publique (`/vendeur/[id]`) : identité, ancienneté du compte, note moyenne agrégée (★ + nombre d'avis), liste des annonces publiées (réutilise le `ListingCard` du moteur de recherche), liste des avis reçus.
- Éligibilité pour laisser un avis strictement conditionnée à une interaction réelle prouvable : il faut avoir eu au moins une conversation avec ce vendeur (réutilise l'infrastructure de messagerie du Lot 8) — jamais un simple clic depuis n'importe quelle page, pour limiter les faux avis. Un avis par (vendeur, auteur) maximum.
- Note moyenne du vendeur affichée directement sur chacune de ses fiches annonce (à côté de son nom, devenu un lien vers sa page vitrine), pas seulement sur la page vitrine.
- Point d'entrée naturel « Laisser un avis sur ce vendeur » ajouté sur le fil de conversation (acheteur uniquement, jamais côté vendeur — le sens de la notation reste acheteur → vendeur, cohérent avec le schéma cible).
- Modération : file `/admin/avis` (réservée `ADMIN`/`MODERATEUR`) listant tous les avis avec suppression directe (pas de file de triage séparée comme pour les signalements — un avis public problématique se retire directement, la suppression est déjà tracée par le journal d'audit).
- 93/93 tests passent (dont les règles pures d'éligibilité, de validation de note et de calcul de moyenne testées indépendamment de Prisma/Next).
- Vérification navigateur de bout en bout avec les deux comptes du Lot 8 (Sara a une conversation réelle avec Amine) : avis envoyé depuis la page vitrine avec commentaire, persistant après rechargement, moyenne mise à jour partout (page vitrine et fiche annonce), lien « Laisser un avis » depuis le fil de conversation vérifié, suppression depuis `/admin/avis` vérifiée + `AuditLog` confirmé directement en base, rendu RTL arabe complet de la page vitrine et de la file de modération.

**Décisions/notes**
- Cible uniquement `seller_id` (utilisateur), jamais `professional_account_id` : aucun compte professionnel séparé n'existe (le rôle `PROFESSIONNEL` reste un simple rôle utilisateur) — colonne non ajoutée pour éviter un champ inutilisé, à étendre le jour où la vitrine professionnelle existera (cf. même arbitrage que le signalement d'utilisateur au Lot 9).
- Pas d'édition ni de suppression d'un avis par son auteur : un avis est définitif une fois posté (seule la modération peut le retirer) — cohérent avec l'objectif anti-fraude de la contrainte d'unicité (empêche aussi un contournement en supprimant/reposant pour changer de note).
- Score de confiance (0-100, §26) volontairement **non construit** ce lot-ci malgré la mention conjointe dans l'écart du Lot 5 : il nécessite plusieurs signaux qui n'existent pas encore de façon fiable (vérification email/téléphone jamais implémentée malgré les champs `emailVerifiedAt`/`phoneVerifiedAt` présents au schéma depuis le Lot 1, ancienneté, absence de signalements). Construire un score aujourd'hui sur des signaux à moitié réels irait à l'encontre du principe « jamais de données fabriquées ». Avis + signalements (Lots 9-10) posent maintenant deux des signaux réels ; la vérification email/téléphone serait le prochain prérequis logique avant le score lui-même.

**Reporté à un lot ultérieur**
- Score de confiance vendeur (bloqué sur la vérification email/téléphone, jamais construite malgré les champs de schéma dédiés depuis le Lot 1), avis sur compte professionnel, édition/réponse du vendeur à un avis reçu.

Prochain lot proposé : à définir avec le porteur de projet — vérification email/téléphone (prérequis honnête du score de confiance), paiement (toujours en attente d'identifiants réels), ou comptes professionnels restent les candidats.

## Lot 11 — Vérification email/téléphone (2026-09-02)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : c'était le prérequis explicitement identifié à la fin du Lot 10 pour espérer construire un jour le score de confiance (§26) sur des signaux réels plutôt qu'à moitié fabriqués — `emailVerifiedAt`/`phoneVerifiedAt` existaient sur `User` depuis le Lot 1 sans jamais être renseignés.

**Livré**
- Vérification email : lien à usage unique (24h), page de confirmation dédiée (`/verifier-email/[token]`), renvoi possible depuis le tableau de bord (3/heure).
- Vérification téléphone : code à 6 chiffres (10 min, 5 tentatives max), renvoi possible depuis le tableau de bord (5/heure), formulaire de saisie inline.
- Tableau de bord : nouvelle ligne « Téléphone » (jusqu'ici absente malgré le champ existant), statut de vérification email/téléphone avec actions, message honnête si aucun numéro n'est enregistré (pas de formulaire d'édition de profil construit ce lot-ci — hors périmètre).
- Badges "✓ Email vérifié"/"✓ Téléphone vérifié" affichés sur la page vitrine vendeur (`/vendeur/[id]`) quand applicable — premier signal réel affiché publiquement en vue du futur score de confiance.
- **Email réellement envoyé par SMTP**, pas simulé : `src/lib/mailer.ts` utilise un compte de test Ethereal (créé via l'API réelle de nodemailer, protocole SMTP authentique, aperçu web consultable) en l'absence de fournisseur configuré (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`) — abstraction interchangeable avec un vrai fournisseur (Resend/SES/Mailgun) en production, même principe que `PaymentProvider` (§11).
- SMS honnêtement non simulé comme réel : `src/lib/sms.ts` journalise le code côté serveur en développement — contrairement à l'email, aucun équivalent gratuit et testable au SMS n'existe sans compte payant (Twilio/AWS SNS/passerelle DZ), gap documenté plutôt que masqué par une fausse réussite.
- 103/103 tests passent (dont les règles pures d'expiration et de vérification de code testées indépendamment de Prisma/Next).
- Vérification navigateur de bout en bout **avec un vrai envoi SMTP** : demande de vérification email déclenchée, email réellement reçu sur le compte de test Ethereal (sujet/expéditeur/destinataire/Message-ID authentiques vérifiés directement sur ethereal.email), lien de vérification extrait du vrai corps HTML de l'email et suivi comme le ferait un utilisateur réel → statut passé à « ✓ Email vérifié » ; côté téléphone, code récupéré depuis le log serveur réel (`[DEV SMS]`), code erroné rejeté avec message explicite, code correct accepté → « ✓ Téléphone vérifié » ; badges vérifiés sur la page vitrine ; rendu RTL arabe complet du tableau de bord.

**Décisions/notes**
- Aucune vérification n'est obligatoire pour publier une annonce ou utiliser la plateforme : ce lot ajoute un signal de confiance optionnel, pas une porte bloquante — décision autonome pour rester cohérent avec l'esprit « score de confiance jamais transformé en accusation » du cahier d'architecture, un changement de comportement bloquant aurait mérité un arbitrage explicite du porteur de projet (même prudence que pour le choix du paiement).
- Traitement volontairement asymétrique email/SMS : l'email peut être prouvé avec une infrastructure réelle et gratuite (Ethereal), le SMS ne le peut pas sans compte payant — les deux abstractions restent interchangeables vers un vrai fournisseur, mais seule celle de l'email a pu être vérifiée avec un envoi authentique dans cette session.
- Pas d'édition de profil (ajout/modification du numéro de téléphone) construite ce lot-ci : le téléphone reste renseigné uniquement via l'assistant de publication (Lot 2) — un compte sans annonce n'a donc aucun moyen de vérifier son téléphone. Documenté comme lacune plutôt que masqué.

**Reporté à un lot ultérieur**
- Score de confiance lui-même (0-100, §26) — signaux réels maintenant disponibles (avis, signalements, vérification email/téléphone, ancienneté) mais l'agrégation en un score n'a pas été construite ce lot-ci, pour ne pas mélanger deux lots dans un seul.
- Édition de profil (numéro de téléphone modifiable hors assistant de publication), vérification d'identité (pièce officielle), renvoi de SMS via un vrai fournisseur.

Prochain lot proposé : à définir avec le porteur de projet — score de confiance (agrégation des signaux maintenant réels), paiement (toujours en attente d'identifiants), ou comptes professionnels restent les candidats.

## Lot 12 — Score de confiance (§26) (2026-09-02)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : explicitement identifié comme le candidat naturel à la fin du Lot 11, les signaux réels nécessaires (avis, signalements confirmés, vérification email/téléphone, ancienneté) existant enfin.

**Livré**
- Score 0-100 affiché sur la page vitrine vendeur (`/vendeur/[id]`), avec le détail complet du calcul toujours visible (jamais caché derrière un clic) : email vérifié (+15), téléphone vérifié (+15), ancienneté du compte (jusqu'à +20 à 6 mois), avis reçus (jusqu'à +50, proportionnel à la note moyenne), signalements confirmés par la modération (-10 chacun, uniquement ceux au statut `TRAITE` — jamais un signalement rejeté ou encore en attente).
- Absence d'avis traitée comme neutre (0 point, jamais pénalisée) plutôt que comme un manque — un compte entièrement vérifié mais neuf plafonne honnêtement à 50/100, présenté comme incomplet plutôt que suspect.
- Formule et disclaimer documentés comme heuristique explicable, pas une calibration statistique — même traitement que la formule de confiance de l'estimateur (Lot 4) — et le texte reprend explicitement le principe du cahier d'architecture : « ni une accusation, ni une garantie ».
- 112/112 tests passent (dont la formule de score et le calcul d'ancienneté testés exhaustivement aux limites : aucun signal, tous les signaux au maximum, plancher à 0 malgré de nombreux signalements).
- Vérification navigateur : score de deux vendeurs réels calculé et vérifié à la main contre la formule (Amine — téléphone vérifié seul, 15/100 ; Sara — email vérifié seul, 15/100), détail des points affiché correctement pour chaque signal, ligne des signalements confirmés absente tant qu'aucun n'existe (comportement attendu), rendu RTL arabe complet.

**Décisions/notes**
- Vérification d'identité (pièce officielle) et complétude/cohérence des annonces — deux signaux du cahier d'architecture — volontairement absents de la formule : aucune infrastructure de vérification de pièce n'existe, et la mesure de « cohérence » d'une annonce est jugée trop subjective pour être honnêtement quantifiée sans fabriquer un jugement. Documenté comme lacune plutôt que simulé.
- Seuls les signalements au statut `TRAITE` (confirmés par un modérateur humain) pénalisent le score, jamais les signalements `OUVERT` (en attente) ou `REJETE` (rejetés) — un signalement non vérifié ne doit jamais affecter la réputation avant qu'un humain ne le confirme, cohérent avec la découplage déjà établi au Lot 9 entre triage et action punitive.
- Score affiché publiquement sur la page vitrine, comme la note moyenne des avis — pas de masquage sous un seuil bas : cacher le score en dessous d'un certain niveau reviendrait à en faire un jugement moral implicite, contraire au principe du cahier d'architecture.

**Reporté à un lot ultérieur**
- Vérification d'identité (pièce officielle), mesure de complétude/cohérence des annonces, affichage du score ailleurs que sur la page vitrine (ex : carte de résultat de recherche), recalibrage de la pondération avec des données d'usage réelles.

Prochain lot proposé : à définir avec le porteur de projet — paiement (toujours en attente d'identifiants réels), comptes professionnels, ou vérification d'identité restent les grands candidats.

## Lot 13 — Comptes professionnels, fondations (§9/§26) (2026-09-02)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : c'était l'écart le plus anciennement documenté encore ouvert, mentionné dès le Lot 3 (« filtre type de vendeur... sans comptes professionnels ») et reproposé dans quasiment chaque « prochain lot » depuis.

**Livré**
- Création de compte professionnel (`/devenir-professionnel`) : nom commercial, présentation, horaires, wilaya — bascule le rôle utilisateur en `PROFESSIONNEL` et crée le `ProfessionalAccount` associé (un par utilisateur).
- Vitrine publique (`/pro/[id]`) : identité commerciale, badge « Vérifié » si accordé, horaires, présentation, annonces publiées (réutilise `ListingCard`), lien vers la page vendeur individuelle pour les avis et le score de confiance (pas de système d'avis dupliqué pour les comptes pro, cf. décisions ci-dessous).
- CRM basique (`/pro/tableau-de-bord`) : statistiques réelles (annonces publiées, vues totales, conversations), lien vers la boutique publique et « Mes annonces », gestion des collaborateurs (sous-comptes à droits limités) réservée au propriétaire — ajout par email avec rôle `GESTIONNAIRE` (peut gérer les annonces) ou `LECTURE_SEULE` (consultation uniquement).
- Back-office : nouvelle page `/admin/pro` listant tous les comptes professionnels avec bouton d'accord/retrait du badge « Vérifié » (aucun KYC automatisé — un humain vérifie hors plateforme, l'admin ne fait qu'enregistrer un vrai constat, jamais une vérification fabriquée), journal d'audit sur chaque changement, compteur « Comptes pro non vérifiés » au tableau de bord.
- Lien vers la boutique professionnelle affiché sur la fiche annonce quand le vendeur est un professionnel.
- 123/123 tests passent (dont les règles pures de permission — propriétaire/gestionnaire/lecture seule — testées exhaustivement).
- Vérification navigateur de bout en bout avec deux vrais comptes : Sara crée son compte professionnel (redirection automatique vers le CRM), boutique publique vérifiée avec les bonnes informations, ajout d'Amine comme collaborateur « Gestionnaire » → connecté en tant qu'Amine, accès confirmé au tableau de bord et à « Gérer mes annonces » mais section Collaborateurs bien absente (réservée au propriétaire), badge « Vérifié » accordé depuis `/admin/pro` → vérifié à la fois sur la vitrine publique et en base (`AuditLog`), compteur du tableau de bord admin mis à jour, rendu RTL arabe complet de la vitrine et du back-office.

**Décisions/notes**
- **Aucun abonnement payant** (Starter/Business/Pro/Premium du cahier d'architecture) : un seul palier fonctionnel, illimité — le paiement reste bloqué en attente d'identifiants réels (même arbitrage que les formules Premium/Premium+ des annonces particulières, Lot 2).
- **Aucun KYC automatisé** (registre de commerce) : le badge « Vérifié » reste un bouton admin actionné après vérification humaine hors plateforme — un vrai signal, pas un signal fabriqué par une fausse vérification automatique.
- Avis et score de confiance restent scopés à l'utilisateur (`seller_id`), jamais dupliqués pour `professional_account_id` : la vitrine pro renvoie vers la page vendeur existante (Lots 10-12) plutôt que de construire un second système d'avis parallèle — cohérent avec la décision déjà prise au Lot 10.
- Badge « Professionnel » sur les cartes de résultats (recherche, page marque/modèle) volontairement non construit ce lot-ci : `ListingCard` est partagé par 4 pages et n'inclut pas actuellement les données vendeur — l'étendre aurait touché plusieurs call-sites pour une simple décoration, hors du périmètre CRM/vitrine demandé.
- Import/saisie de stock en masse (mentionné au cahier d'architecture §10) non construit : la gestion des annonces reste `/compte/mes-annonces`, déjà fonctionnelle pour tout vendeur qu'il soit particulier ou professionnel — un import en masse est un module à part entière.

**Reporté à un lot ultérieur**
- Abonnements payants (Starter/Business/Pro/Premium), badge visuel « Professionnel » sur les cartes de résultats, import de stock en masse, KYC automatisé (registre de commerce), permissions de collaborateur plus fines (JSON libre au lieu des deux rôles actuels).

Prochain lot proposé : à définir avec le porteur de projet — paiement (toujours en attente d'identifiants réels) ou vérification d'identité restent les grands candidats non construits.

## Lot 14 — Vérification d'identité (§26, KYC léger manuel) (2026-09-02)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : dernier des deux grands écarts identifiés au Lot 13, et contrairement au paiement, ce lot pouvait être construit honnêtement dès maintenant (revue humaine plutôt qu'une API KYC tierce payante) — même stratégie que le badge « Vérifié » des comptes professionnels (Lot 13).

**Livré**
- Soumission d'une pièce d'identité (JPEG/PNG/WEBP/PDF, 8 Mo max, type réel vérifié sur les octets — jamais le type déclaré par le client) depuis le tableau de bord (`/compte/tableau-de-bord`), avec statut affiché (non soumis / en attente / refusé avec motif et re-soumission possible / vérifié).
- File de revue back-office (`/admin/identite`, réservée `ADMIN`/`MODERATEUR`) : consultation de la pièce via une route authentifiée dédiée (jamais un lien public), approbation ou refus (motif obligatoire pour un refus), journal d'audit, compteur au tableau de bord admin.
- **Aucune conservation indéfinie de la pièce d'identité** : le fichier est stocké hors de `/public` (jamais accessible par URL publique directe) et supprimé du disque dès que la décision de revue est prise (approuvée ou refusée) — seule la décision (statut, date, motif) reste en base, jamais la pièce elle-même.
- Score de confiance (Lot 12) étendu avec ce nouveau signal réel : pondération rééquilibrée (email 15→10, téléphone 15→10, ancienneté 20→15, avis 50→45, nouveau signal identité +20) pour rester plafonné à 100 — un compte neuf entièrement vérifié (email+téléphone+identité) plafonne désormais à 55/100 au lieu de 50/100, présenté comme incomplet plutôt que suspect. Badge « ✓ Identité vérifiée » ajouté sur la page vitrine vendeur.
- 133/133 tests passent (dont les règles pures d'éligibilité à la soumission et de transition de revue, plus la formule de score recalibrée testée aux mêmes limites qu'au Lot 12).
- Vérification navigateur/API de bout en bout avec un vrai compte (Sara) : soumission testée via un appel API direct avec une vraie image JPEG (même limite que l'upload de photos d'annonces au Lot 2 — pas de sélecteur de fichier natif dans le pane de prévisualisation), fichier confirmé hors de `/public`, statut « en attente » affiché sur le tableau de bord, file de revue admin vérifiée avec consultation réelle du document (streaming confirmé, accès refusé — 403 vérifié — pour une requête non authentifiée), refus sans motif bloqué avec message explicite, approbation → fichier supprimé du disque (vérifié directement), `identityVerifiedAt` renseigné, badge et score de confiance recalculés correctement (30/100 vérifié à la main : 10 email + 20 identité), rendu RTL arabe complet du tableau de bord et du back-office.

**Décisions/notes**
- **Aucune API KYC tierce** (Onfido/Jumio/Veriff) : même blocage que le paiement (identifiants réels non disponibles) — traitement honnête par revue humaine plutôt qu'une vérification automatisée fabriquée, cohérent avec l'arbitrage déjà pris pour le badge professionnel.
- Suppression du fichier après décision : un choix de confidentialité par conception, pas explicitement demandé par le cahier d'architecture mais cohérent avec le traitement de toute donnée personnelle sensible — documenté comme décision autonome plutôt qu'imposé silencieusement.
- KYC registre de commerce pour les comptes professionnels (mentionné au §9 du cahier d'architecture, distinct de la vérification d'identité personnelle) volontairement non construit : le badge « Vérifié » manuel du Lot 13 couvre déjà un signal de confiance honnête pour les comptes pro ; un flux dédié au registre de commerce resterait un module à part entière.
- Une demande refusée n'empêche pas une nouvelle soumission (seule une demande déjà en attente ou une identité déjà vérifiée bloque) — cohérent avec le principe de ne jamais enfermer un utilisateur légitime derrière un refus (ex : mauvaise photo) sans recours.

**Reporté à un lot ultérieur**
- KYC registre de commerce pour comptes professionnels, vérification d'identité par API tierce réelle (si des identifiants deviennent disponibles), recalibrage du score de confiance avec des données d'usage réelles.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module non construit explicitement identifié par le cahier d'architecture.

## Lot 15 — Page d'index des marques (2026-09-03)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : avec le paiement bloqué en attente d'identifiants réels et tous les autres grands modules du cahier d'architecture désormais construits, ce lot referme le plus ancien petit écart encore ouvert — explicitement noté comme « complément naturel et rapide à ajouter » dès le Lot 6.

**Livré**
- Page `/voitures` : les 24 marques du catalogue en grille alphabétique, avec le nombre réel d'annonces publiées et le prix moyen par marque (aucune marque masquée si elle n'a aucune annonce — affichée honnêtement à 0 plutôt que retirée de la liste).
- Nouvelle fonction `getListingCountsPerBrand()` : une seule requête groupée pour toutes les marques (pas une requête par marque dans une boucle), même souci de performance que les fonctions existantes de `catalogue-stats.ts`.
- Page ajoutée au sitemap (`/voitures`), avec métadonnées et fil d'Ariane (Accueil / Toutes les marques) comme les pages marque/modèle existantes.
- Deux points d'entrée ajoutés pour la découvrabilité : bouton « Parcourir les marques » sur la page d'accueil (aux côtés de « Vendre »/« Estimer »), lien « Toutes les marques » dans le pied de page (qui n'avait jusqu'ici aucun lien de navigation).
- Vérification navigateur : page vérifiée avec les données réelles du catalogue (Renault correctement à 6 annonces/2 608 333 DA de moyenne, les 23 autres marques honnêtement à 0), navigation confirmée depuis l'accueil et le pied de page, présence dans `sitemap.xml` vérifiée directement, rendu RTL arabe complet.

**Décisions/notes**
- Tri alphabétique (pas par nombre d'annonces) : plus prévisible pour un utilisateur qui cherche une marque précise, cohérent avec le tri déjà utilisé pour la liste des modèles sur chaque page marque.
- Aucun test unitaire dédié ajouté : `getListingCountsPerBrand()` est un simple wrapper Prisma (agrégation groupée), comme les fonctions déjà existantes et non testées unitairement dans `catalogue-stats.ts` — cohérent avec le traitement déjà appliqué à ce fichier.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module non construit ; les écarts restants sont désormais mineurs (badge « Bon Prix » sur les cartes de résultats, statistiques produit avancées, notifications email de nouveau message).

## Lot 16 — Badge « Bon Prix » sur les cartes de résultats (2026-09-03)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : le plus ancien des trois écarts mineurs restants — reporté explicitement au Lot 4 puis reconfirmé au Lot 6 (« même arbitrage N+1 »), ce lot lève le blocage de performance qui l'avait fait reporter deux fois plutôt que de le retenir une troisième.

**Livré**
- `src/lib/price-estimation.ts` refactorisé : la logique de paliers (précis → large) opère maintenant en mémoire sur des lignes déjà chargées (`estimateFromRows`, pure et testée) plutôt que par une requête Prisma par palier essayé — `estimatePrice` (fiche annonce) passe ainsi de jusqu'à 4 requêtes à 1 seule requête.
- Nouvelle fonction batch `estimatePricesForListings()` : une seule requête par couple (marque, modèle) **distinct** présent sur une page de résultats (exécutées en parallèle), jamais une requête par annonce — résout directement le problème de N+1 documenté depuis le Lot 4.
- Badge « Bon Prix » (5 niveaux, même échelle que la fiche annonce) ajouté sur les cartes de résultats (`ListingCard`, composant partagé) : page de recherche, pages marque et modèle, page vitrine vendeur, page vitrine professionnelle — les 5 endroits qui utilisent ce composant.
- Style et libellés du badge extraits dans `src/lib/price-badge-style.ts`, partagés entre la fiche annonce et les cartes (au lieu d'être dupliqués).
- 139/139 tests passent (dont 8 nouveaux sur `estimateFromRows` : palier le plus précis en priorité, repli progressif vers le plus large, exclusion de l'annonce elle-même de ses propres comparables, absence totale de comparables).
- Vérification navigateur avec les 6 vraies annonces Renault Clio déjà utilisées dans les lots précédents : badges corrects sur `/recherche`, la page marque Renault, la page vitrine du vendeur Amine, et en RTL arabe — un cas honnêtement sans badge repéré et vérifié à la main (échantillon de seulement 2 comparables au palier le plus précis, en dessous du seuil minimal de 3 déjà en vigueur sur la fiche annonce depuis le Lot 4 — pas un bug, la même règle de prudence s'applique partout).

**Décisions/notes**
- Le seuil minimal de 3 comparables (`computePriceBadge`, inchangé depuis le Lot 4) s'applique identiquement sur les cartes : certaines annonces n'affichent honnêtement aucun badge quand leur échantillon de comparables les plus proches est trop restreint, plutôt que d'afficher un badge peu fiable.
- Page modèle (`/voitures/[brand]/[model]`) traitée différemment des autres : elle charge déjà toutes les annonces d'un unique couple marque/modèle, donc `estimateFromRows` réutilise directement ce jeu de lignes sans requête supplémentaire — plus optimal que la fonction batch générique, qui reste utilisée partout ailleurs où plusieurs couples marque/modèle peuvent coexister sur une même page.

Prochain lot proposé : à définir avec le porteur de projet — statistiques produit avancées (back-office) ou notifications email de nouveau message restent les deux derniers écarts mineurs ; le paiement reste le seul grand module non construit.

## Lot 17 — Statistiques produit (back-office) (2026-09-03)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : le plus ancien des deux derniers écarts mineurs, signalé dès le Lot 7 (« statistiques produit... restent hors périmètre »).

**Livré**
- Page `/admin/statistiques` (back-office, réservée `ADMIN`/`MODERATEUR`) : cartes de synthèse (conversations, avis, note moyenne globale, signalements confirmés), graphique en barres des nouveaux comptes et nouvelles annonces sur les 12 dernières semaines, répartition des annonces par statut, top 5 marques et top 5 wilayas par annonces publiées.
- Nouvelle fonction pure `bucketByWeek()` (`src/lib/product-stats.ts`) : répartit une liste de dates en tranches hebdomadaires lundi-dimanche — testée indépendamment de Prisma (7 tests : ordre chronologique, semaine courante, semaines passées, dates hors fenêtre, accumulation, insensibilité à l'ordre d'entrée).
- Toutes les statistiques calculées sur des données réelles (comptes, annonces, avis, conversations, signalements confirmés) — aucun chiffre inventé ; note moyenne affichée comme un tiret (« — ») plutôt qu'un 0 trompeur quand aucun avis n'existe encore.
- 146/146 tests passent au total.
- Vérification navigateur avec les données réelles accumulées au fil des lots précédents : les nombres affichés (6 annonces publiées/1 refusée/1 suspendue, Renault à 6, Alger à 5/Oran à 1, 1 conversation, 0 avis) recoupés à la main avec l'état réel connu de la base et tous exacts, rendu RTL arabe complet (graphique en barres correctement inversé par le sens du document, sans classe RTL manuelle).

**Décisions/notes**
- Graphiques en simples barres CSS (largeur/hauteur en pourcentage), aucune bibliothèque de graphiques ajoutée : cohérent avec le style minimal déjà en place dans tout le projet, et suffisant pour des séries à 12 points.
- Bucketing hebdomadaire fait en mémoire (JS) plutôt que par une fonction de date SQLite : SQLite ne propose pas d'équivalent simple à `DATE_TRUNC`, et le volume de lignes actuel rend cette approche largement suffisante ; à revoir si le volume grossit significativement.
- Top marques/wilayas limité à 5 chacun (pas de pagination) : une page de statistiques doit rester lisible d'un coup d'œil ; un futur lot pourrait ajouter une vue détaillée si le besoin se confirme.

Prochain lot proposé : à définir avec le porteur de projet — notifications email de nouveau message (dernier écart mineur documenté, réutiliserait l'infrastructure SMTP réelle déjà construite au Lot 11) ; le paiement reste le seul grand module non construit.

## Lot 18 — Notifications email de nouveau message (2026-09-03)

Choisi sans arbitrage préalable du porteur de projet (« poursuivre selon ta logique ») : dernier écart mineur documenté (depuis le Lot 8), et le seul qui pouvait directement réutiliser une infrastructure déjà réelle et vérifiée — le mailer SMTP construit au Lot 11 pour la vérification d'email.

**Livré**
- Email envoyé automatiquement au destinataire d'un message quand celui-ci n'a aucun autre message non lu de cet expéditeur dans la même conversation — nom de l'expéditeur, titre de l'annonce concernée, contenu du message, lien direct vers le fil de discussion.
- Règle anti-spam : `shouldSendMessageNotification()` (`src/lib/messaging.ts`, pure et testée) — un seul email par « rafale » de messages non lus, jamais un email par message tant que le destinataire n'a pas relu le fil.
- Contenu HTML de l'email protégé contre l'injection : nouvelle fonction `escapeHtml()` (`src/lib/mailer.ts`) appliquée au nom de l'expéditeur, au titre de l'annonce et au contenu du message — toutes des données fournies par un utilisateur, jamais interpolées telles quelles dans un email envoyé à un tiers.
- 148/148 tests passent (dont 2 nouveaux sur la règle anti-spam : notifie sur le premier message non lu, ne renotifie pas tant que d'autres messages non lus de cet expéditeur restent en attente).
- Vérification navigateur/API de bout en bout **avec de vrais envois SMTP**, cycle complet : message n°1 de Sara à Amine → email réellement reçu et vérifié sur ethereal.email (expéditeur/destinataire/sujet/contenu/lien tous corrects) ; message n°2 immédiatement après (Amine n'a toujours rien lu) → aucun email envoyé, vérifié à la fois par l'absence de nouvelle entrée dans les logs serveur et par les deux messages confirmés non lus en base ; Amine relit le fil (marque les deux messages comme lus) ; message n°3 de Sara → nouvel email réellement envoyé avec un Message-ID distinct, confirmant que la notification reprend correctement après lecture.

**Décisions/notes**
- Email envoyé de façon synchrone (attendu par la route) plutôt qu'en tâche de fond : cohérent avec le traitement déjà appliqué aux emails de vérification (Lot 11), garantit que l'échec d'un envoi n'est jamais silencieusement perdu sans qu'aucune trace n'existe (l'échec est cependant absorbé pour ne jamais faire échouer l'envoi du message lui-même — l'email est un bonus, pas une condition de succès).
- Adresse email destinataire toujours utilisée, indépendamment du statut de vérification email : la vérification (Lot 11) sert à afficher un signal de confiance, pas à restreindre l'envoi de communications transactionnelles vers l'adresse déjà fournie à l'inscription.
- Aucune préférence de notification par utilisateur (case à cocher « ne plus recevoir ces emails ») : non demandée, ajouterait un modèle et une UI de paramètres pour un besoin non exprimé — à construire si le besoin se confirme.

Avec ce lot, les trois écarts mineurs identifiés après le Lot 16 sont désormais tous traités. Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 19 — Signalement d'utilisateur & avis sur compte professionnel (2026-09-03)

Choisi explicitement par le porteur de projet parmi la liste des écarts documentés (« Signalement d'utilisateur et avis sur compte pro d'abord »).

**Livré**
- **Signalement d'utilisateur** : le modèle `Report` (Lot 9) accepte maintenant une cible `listingId` OU `reportedUserId` (jamais les deux), avec 3 nouveaux motifs propres aux profils (comportement frauduleux, messages abusifs, usurpation d'identité) en plus du motif « Autre » déjà partagé. Bouton « Signaler cet utilisateur » sur la page vitrine vendeur (`/vendeur/[id]`), aucune interaction préalable requise (comme pour le signalement d'annonce). File de traitement back-office (`/admin/signalements`) étendue pour afficher les deux types de signalement côte à côte, avec un badge « Profil » à la place de la vignette annonce.
- **Avis sur compte professionnel** : le modèle `Review` (Lot 10) accepte maintenant une cible `sellerId` OU `professionalAccountId` — deux pools d'avis désormais distincts et non substituables : la page vendeur individuelle (`/vendeur/[id]`) note la personne, la vitrine professionnelle (`/pro/[id]`) note l'entreprise. Éligibilité basée sur la même preuve d'interaction (conversation sur une annonce du propriétaire du compte, puisque toutes les annonces d'une entreprise restent rattachées à son propriétaire) ; un collaborateur de l'entreprise ne peut pas non plus noter l'entreprise pour laquelle il travaille. `ReviewForm` généralisé (accepte un `endpoint` au lieu d'un `sellerId` figé) pour servir les deux cas sans duplication. Back-office `/admin/avis` étendu pour afficher les deux types d'avis avec le bon libellé (« Vendeur » / « Entreprise »).
- 150/150 tests passent (dont 3 nouveaux : éligibilité du signalement d'utilisateur).
- Vérification navigateur/base de données de bout en bout avec de vrais comptes : signalement d'Amine par Sara pour « messages abusifs » → apparu correctement dans la file admin avec badge « Profil » → rejeté avec succès ; avis sur « Auto Sara Motors » testé avec le compte administrateur (après création d'une vraie annonce et conversation de test, nettoyées après coup) → refusé pour Amine avec `cannot_review_self` (découverte fortuite et non mise en scène : Amine est un vrai collaborateur « Gestionnaire » de ce compte depuis le Lot 13, validant involontairement mais rigoureusement la règle anti-auto-évaluation des collaborateurs) → accepté pour l'administrateur, avis affiché sur `/pro/[id]` mais absent de `/vendeur/[id]` de Sara (confirmant l'étanchéité des deux pools), rendu RTL arabe complet des deux fonctionnalités.

**Décisions/notes**
- Contrainte d'unicité « cible unique » (listing XOR utilisateur pour `Report` ; vendeur XOR entreprise pour `Review`) appliquée en code applicatif, pas en contrainte SQL native : SQLite/Prisma ne permettent pas une CHECK constraint portable simple pour ce genre d'exclusivité — le principe déjà appliqué aux autres invariants métier du projet.
- Signalement d'utilisateur sans exigence d'interaction préalable (contrairement aux avis) : un profil suspect doit pouvoir être signalé même sans avoir échangé de message, cohérent avec le signalement d'annonce (Lot 9) qui n'a jamais exigé cette preuve non plus.
- Suspension automatique après seuil de signalements et notification à l'auteur du signalement (mentionnées comme écarts liés au Lot 9) restent hors périmètre — demande initiale du porteur de projet limitée au signalement d'utilisateur lui-même.
- Édition/réponse du vendeur à un avis reçu (mentionnée comme écart lié au Lot 10) reste hors périmètre — non demandée dans ce lot.

**Reporté à un lot ultérieur**
- Suspension automatique après seuil de signalements, notification à l'auteur du signalement une fois traité, réponse du vendeur/de l'entreprise à un avis reçu.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 20 — Édition de profil (2026-09-03)

Choisi explicitement par le porteur de projet (« Édition de profil »).

**Livré**
- Page `/compte/profil` : nom affiché, wilaya, téléphone, présentation (bio) — tous pré-remplis avec les valeurs actuelles. Aucune migration de schéma nécessaire (`displayName`/`wilayaId`/`bio` existaient déjà sur `Profile` depuis le Lot 1, `phone` sur `User` — seuls `bio` et l'édition de `phone` hors assistant de publication n'avaient jamais été exposés dans une interface).
- **Changer de numéro de téléphone invalide automatiquement sa vérification** (`phoneVerifiedAt` remis à `null`) — une vérification prouve la possession d'un numéro précis, pas d'un numéro quelconque ; avertissement affiché en direct dans le formulaire dès que le champ diffère de la valeur enregistrée, avant même la sauvegarde.
- Numéro de téléphone toujours unique en base (`User.phone @unique`) : tentative de prendre un numéro déjà utilisé par un autre compte refusée explicitement (`phone_taken`), plutôt qu'un plantage de contrainte SQL non géré.
- Regex algérienne du numéro de téléphone (déjà utilisée par l'assistant de publication, Lot 2) extraite dans un module partagé (`src/lib/validation/phone.ts`) au lieu d'être dupliquée.
- 155/155 tests passent (dont 5 nouveaux sur la règle de reset de vérification : numéro inchangé, numéro modifié, ajouté, retiré, toujours absent).
- Vérification navigateur/API de bout en bout avec un vrai compte (Amine) : formulaire pré-rempli avec les vraies valeurs (nom, wilaya, téléphone déjà vérifié), changement de numéro → avertissement affiché avant sauvegarde → après sauvegarde, `phoneVerifiedAt` confirmé à `null` en base et à l'écran (tableau de bord passé de « ✓ Téléphone vérifié » à « Téléphone non vérifié »), bio sauvegardée et vérifiée en base ; collision de numéro testée avec un deuxième vrai compte (Sara) → `phone_taken` (409) confirmé puis numéro de test nettoyé ; rendu RTL arabe complet du formulaire.

**Décisions/notes**
- Email non éditable dans ce lot : plus sensible qu'un téléphone (identifiant de connexion), changer d'email mériterait un flux de confirmation par lien vers la nouvelle adresse — non demandé explicitement, laissé de côté plutôt que bâclé.
- Avatar (`avatarUrl`, présent au schéma depuis le Lot 1) non exposé : aucune interface n'affiche encore une photo de profil nulle part dans l'application — l'ajouter maintenant créerait un champ modifiable sans effet visible ailleurs. À construire quand un affichage d'avatar existera quelque part.

**Reporté à un lot ultérieur**
- Édition d'email (avec confirmation par lien), upload et affichage d'avatar.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 21 — Suspension automatique après signalements confirmés & notification de traitement (2026-09-03)

Choisi selon la logique de continuation : les deux plus anciennes lacunes documentées non comblées, toutes deux issues du Lot 9 (« traiter un signalement » ne déclenchait jamais rien d'automatique, et l'auteur d'un signalement n'était jamais informé de son sort).

**Livré**
- `shouldAutoSuspendListing()` (`src/lib/reports.ts`) : une annonce publiée est suspendue automatiquement dès qu'elle atteint `AUTO_SUSPEND_LISTING_THRESHOLD` (3) signalements **confirmés** (`TRAITE`) — jamais sur des signalements simplement ouverts ou rejetés, conformément à la règle du Lot 9 selon laquelle un signalement non vérifié ne doit jamais déclencher d'action punitive automatique. Scope volontairement limité aux annonces : aucune notion de « compte utilisateur suspendu » n'existe encore dans le schéma, la suspension de compte reste un module à part entière, non construit ici.
- L'auteur d'un signalement reçoit désormais un email (FR/AR, `next-intl` avec la locale réelle de son compte) dès que son signalement est traité ou rejeté par un modérateur — jusqu'ici, il n'était jamais informé du résultat. Titre de l'annonce échappé (`escapeHtml`) avant interpolation dans le gabarit HTML.
- Route `POST /api/admin/reports/[id]/resolve` étendue : après la transition de statut et le journal d'audit existants (Lot 9), envoi de l'email puis, uniquement sur une action « traiter » liée à une annonce encore publiée, comptage des signalements confirmés sur cette annonce et suspension + entrée d'audit `listing.auto_suspend` si le seuil est atteint.
- **Bug corrigé au passage dans `src/lib/mailer.ts`** : la promesse du transporteur SMTP était mise en cache même en cas d'échec (ex. création du compte de test Ethereal), ce qui cassait l'envoi d'email pour toute la durée de vie du process après un seul échec transitoire. La promesse rejetée n'est plus mise en cache.
- 161/161 tests passent (3 nouveaux sur `shouldAutoSuspendListing`, sous et au-dessus du seuil).
- Vérification de bout en bout avec 3 vrais comptes (un compte jetable `test.reporter@example.dz` créé pour l'occasion, plus Sara et l'administrateur) signalant la même annonce d'Amine : chaque « Traiter » confirmé en base (statut `TRAITE`, audit `report.resolve`), annonce restée `PUBLIEE` après les 1er et 2e traitements, passée à `SUSPENDUE` avec la note automatique uniquement après le 3e (audit `listing.auto_suspend` avec `confirmedReportCount: 3`), disparition confirmée de la liste des annonces publiées côté back-office. Données de test nettoyées après vérification (signalements et comptes jetables supprimés, annonce repassée à `PUBLIEE`).

**Décisions/notes**
- Aperçu Ethereal de l'email non observable dans cet environnement de développement (l'appel réseau de création de compte de test échoue systématiquement avec « self-signed certificate in certificate chain » lorsqu'il est exécuté depuis le serveur de prévisualisation, alors que le même code réussit de façon fiable exécuté en script Node isolé) — probablement une interception réseau propre au bac à sable de prévisualisation, sans rapport avec le code applicatif. L'envoi et le contenu de l'email ont été vérifiés indépendamment via un script reproduisant exactement `sendEmail()`. Sans incidence en production, où aucune création de compte de test n'a lieu (`SMTP_HOST` réel configuré).
- Le seuil (3) est une constante en dur, pas un paramètre configurable en base — cohérent avec le reste de la modération (aucun réglage n'est aujourd'hui exposé à l'administrateur).

**Reporté à un lot ultérieur**
- Suspension automatique de compte utilisateur (nécessite un champ de statut sur `User`, hors périmètre de ce lot).
- Seuil configurable depuis le back-office.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 22 — Cycle de vie de l'annonce : expiration automatique, renouvellement & marquage vendu (2026-09-03)

Choisi selon la logique de continuation : le plus vieux écart documenté encore ouvert (Lot 2 — « statuts d'annonce autres que PUBLIEE : brouillon persistant, suspension, expiration/renouvellement », différé faute de back-office ; le back-office existe depuis le Lot 7). Au passage, un constat : les statuts `BROUILLON`, `VENDUE` et `EXPIREE` existaient dans le schéma et dans `StatusBadge`/les libellés de traduction depuis les tout premiers lots, mais aucun code n'atteignait jamais `VENDUE` ni `EXPIREE` — des valeurs d'énumération fantômes, jamais réellement construites.

**Livré**
- `Listing.expiresAt` (nouveau champ) : fixé à 30 jours (`LISTING_VALIDITY_DAYS`) après la publication ou un renouvellement. Rétro-rempli par la migration pour les annonces déjà publiées avant ce lot (calculé depuis `publishedAt`).
- Expiration automatique **paresseuse** : aucun planificateur (cron/queue) n'existe dans l'application, donc `sweepExpiredListings()` bascule les annonces `PUBLIEE` dont `expiresAt` est dépassé vers `EXPIREE` juste avant les lectures à fort trafic (page de recherche, détail d'annonce, mes-annonces) plutôt que sur un job périodique — un balayage global, pas limité à la page courante, ce qui suffit à garder la base cohérente tant qu'une de ces pages est visitée régulièrement.
- Le propriétaire peut **renouveler** son annonce (`POST /api/listings/[id]/renew`, uniquement depuis `PUBLIEE` ou `EXPIREE`) : republie immédiatement, prolonge `expiresAt` de 30 jours et rafraîchit `publishedAt` (fait remonter l'annonce dans les tris par date).
- Le propriétaire peut désormais **marquer son annonce comme vendue** (`POST /api/listings/[id]/mark-sold`, mêmes statuts éligibles) — première utilisation réelle du statut `VENDUE`, jusqu'ici totalement mort.
- Garde-fou volontaire : ni le renouvellement ni le marquage vendu ne sont possibles depuis `SUSPENDUE` ou `REFUSEE` — un vendeur ne peut pas contourner une décision de modération humaine via ces actions en libre-service. `VENDUE` est un état terminal (non renouvelable).
- Interface : bandeau dédié sur la page de détail d'une annonce expirée/vendue pour son propriétaire (avec actions), date d'expiration affichée sur les annonces publiées, et boutons « Renouveler »/« Marquer comme vendue » sur `/compte/mes-annonces` pour chaque annonce éligible.
- 10 nouveaux tests (`computeExpiryDate`, `isListingExpired`, `checkListingRenewable`, `checkListingCanBeMarkedSold`) — 168/168 au total.
- Vérification de bout en bout avec un vrai compte (Amine, 6 annonces publiées) : marquage vendu confirmé en base et à l'écran (badge « Vendue », actions disparues) ; expiration simulée (date passée forcée en base) confirmée balayée au chargement de `/compte/mes-annonces` (bascule vers `EXPIREE`, bandeau affiché) ; renouvellement depuis une annonce expirée confirmé (retour à `PUBLIEE`, nouvelle date d'expiration, `publishedAt` rafraîchi) ; garde-fous vérifiés par appel direct : 403 pour un autre compte (Sara) tentant de renouveler l'annonce d'Amine, 400 `invalid_status` pour une tentative de renouvellement/marquage vendu sur une annonce `SUSPENDUE`/`REFUSEE` ; rendu RTL arabe du bandeau et des actions confirmé. Toutes les données de test remises dans leur état d'origine après vérification.

**Décisions/notes**
- Rappel de renouvellement par email avant expiration (ex. « votre annonce expire dans 3 jours ») explicitement laissé de côté : nécessiterait un vrai planificateur, absent de cette application (cf. balayage paresseux ci-dessus) — l'ajouter maintenant produirait une fonctionnalité invérifiable en conditions réelles.
- Durée de validité (30 jours) en dur, non configurable — cohérent avec les autres constantes de modération de l'application (seuil d'auto-suspension du Lot 21, etc.), aucun réglage n'est aujourd'hui exposé à l'administrateur.

**Reporté à un lot ultérieur**
- Brouillon persistant multi-session pour l'assistant de publication (autre volet du même écart historique du Lot 2, indépendant de l'expiration).
- Rappel email avant expiration (nécessite un planificateur).
- Historique des renouvellements (aujourd'hui, seul `publishedAt`/`expiresAt` les plus récents sont conservés).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 23 — Modification du prix d'une annonce & alerte de baisse aux favoris (2026-09-03)

Choisi selon la logique de continuation : le second écart documenté du Lot 5 (« score de confiance/avis sur le comparateur » nécessitait le module confiance/avis, construit depuis les Lots 10/12 — traité séparément si besoin ; « notifications de baisse de prix sur les favoris » nécessitait l'infra de notification, réelle depuis le Lot 11/18/21). En creusant ce dernier point, un constat plus fondamental : **aucune route ne permettait de modifier une annonce publiée** — ni prix, ni aucun autre champ. Une notification de baisse de prix est donc restée hors de portée jusqu'ici pour une raison plus simple que le manque d'infra email : le prix ne pouvait tout simplement jamais changer après publication.

**Livré**
- `POST /api/listings/[id]/update-price` : le propriétaire peut modifier le prix de son annonce, uniquement depuis `PUBLIEE` ou `EXPIREE` (mêmes garde-fous que le renouvellement/marquage vendu du Lot 22 — jamais depuis `SUSPENDUE`/`REFUSEE`, pour ne pas contourner une décision de modération humaine).
- `isPriceDrop()` (`src/lib/listing-lifecycle.ts`) détecte une baisse ; si c'en est une, tous les utilisateurs ayant mis l'annonce en favori reçoivent un email (FR/AR selon leur locale réelle, titre échappé via `escapeHtml`) — comble le second écart du Lot 5. Envoi au mieux (best effort) par favori : l'échec d'un email n'annule ni la mise à jour de prix, ni les envois aux autres favoris.
- Interface : lien « Modifier le prix » (formulaire ouvert/fermé, `ListingPriceEditor`) sur `/compte/mes-annonces` et sur la page de détail d'une annonce pour son propriétaire, aux côtés des actions de renouvellement/marquage vendu.
- Volontairement **hors périmètre** : c'est une modification de prix ciblée, pas une édition générale de l'annonce (titre, description, photos, caractéristiques techniques…) — cette dernière reste un module à part entière, plus large, non construit ici (cf. Reporté ci-dessous). Seul le prix était nécessaire pour combler l'écart du Lot 5.
- 5 nouveaux tests (`checkListingPriceEditable`, `isPriceDrop`) — 173/173 au total.
- Vérification de bout en bout avec deux vrais comptes : Sara ajoute l'annonce d'Amine en favori, Amine baisse le prix (2 600 000 → 2 400 000 DA) via un appel direct puis via l'interface (2 500 000 → 2 300 000 DA, formulaire réel rempli et soumis, prix mis à jour partout sur la page — affichage principal, estimation, badge). Tentative d'email de notification confirmée dans les journaux serveur à chaque baisse réelle, absente lors d'une hausse de prix (2 400 000 → 2 500 000 DA, aucune tentative). Garde-fous vérifiés par appel direct : 403 pour un autre compte (Sara) sur l'annonce d'Amine, 400 `invalid_status` sur une annonce `SUSPENDUE`. Toutes les données de test nettoyées après vérification (prix restauré, favori de test supprimé).

**Décisions/notes**
- Aperçu Ethereal de l'email non observable dans cet environnement de développement, même limitation déjà documentée au Lot 21 (interception TLS propre au serveur de prévisualisation) — sans rapport avec ce lot, déjà vérifiée indépendamment via script isolé.
- Aucune limite sur l'ampleur ou la fréquence des baisses de prix (pas de anti-abus dédié au-delà du rate-limit générique déjà en place sur la route) — un vendeur pourrait en théorie osciller son prix pour spammer ses propres favoris ; jugé hors de proportion pour ce lot, à surveiller si un usage réel le justifie.

**Reporté à un lot ultérieur**
- Édition générale de l'annonce (titre, description, photos, caractéristiques techniques, marque/modèle) — module à part entière, plus large que la seule modification de prix traitée ici.
- Score de confiance vendeur et avis affichés sur le comparateur (premier écart du Lot 5, indépendant de celui-ci).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 24 — Score de confiance & avis vendeur sur le comparateur (2026-09-03)

Choisi selon la logique de continuation : le plus vieux écart documenté encore ouvert (Lot 5 — « score de confiance vendeur, avis, sur le comparateur », différé faute des modules confiance/avis, construits depuis les Lots 10/12 mais jamais reliés au comparateur ; répété au Lot 23).

**Livré**
- `getSellerTrustSummary()` (`src/lib/seller-trust.ts`, nouveau) : extrait de la page vendeur (Lots 10/12) la logique de calcul du score de confiance et de la moyenne d'avis, pour la partager sans duplication entre la page vendeur et le comparateur. La page vendeur (`/vendeur/[id]`) a été refactorée pour l'utiliser à la place de son calcul dupliqué in-line — comportement strictement inchangé, juste une seule source de vérité désormais.
- `GET /api/listings/compare` retourne désormais, pour chaque annonce comparée, le vendeur (nom/email) et son résumé de confiance (score, note moyenne, nombre d'avis) — un même vendeur apparaissant sur plusieurs annonces comparées ne déclenche qu'un seul calcul (dédoublonné par `sellerId`).
- Page `/comparateur` : trois nouvelles lignes en tête de tableau — Vendeur (lien vers la vitrine), Score de confiance, Avis vendeur — utilisant les mêmes clés de traduction que la page vendeur (`TrustScore.scoreValue`, `Review.averageRating`/`noReviews`) pour un rendu cohérent entre les deux pages.
- Aucun nouveau test unitaire (aucune nouvelle logique pure — refactorisation d'une logique déjà couverte par `trust-score.test.ts`/`reviews.test.ts`) ; 173/173 toujours au vert.
- Vérification de bout en bout : comparateur avec deux annonces du même vendeur (Amine, seul vendeur avec des annonces publiées dans ce jeu de données) — score à 0/100 et « Aucun avis » confirmés à l'état réel (aucun email/téléphone/identité vérifié, aucun avis) ; avis et vérification email ajoutés temporairement (via base) pour confirmer le rendu du chemin non vide (46/100, « 4 / 5 (1 avis) », calcul vérifié à la main : 10 points email + 36 points avis = 46), puis données de test supprimées. Rendu RTL arabe confirmé (« البائع », « درجة الثقة », « تقييمات البائع »).

**Décisions/notes**
- Testé avec deux annonces du même vendeur faute d'un second vendeur avec annonces publiées dans les données actuelles — le dédoublonnage par `sellerId` a tout de même été exercé (un seul calcul, valeur identique affichée deux fois), la logique par vendeur unique restant couverte par les tests unitaires existants de `trust-score.ts`/`reviews.ts`.

**Reporté à un lot ultérieur**
- Édition générale de l'annonce (Lot 23, toujours ouvert, indépendant de celui-ci).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 25 — Back-office : gestion des marques et modèles (2026-09-03)

Choisi selon la logique de continuation : le plus vieux écart documenté encore ouvert et non bloqué par une ressource externe (Lot 7 — « gestion des référentiels (marques/modèles/wilayas) depuis le back-office plutôt que par script de seed »). Wilayas explicitement exclues du périmètre (58 divisions administratives algériennes officielles, réellement statiques — aucun besoin réaliste de les éditer, contrairement aux marques/modèles qui évoluent avec le marché automobile).

**Livré**
- Page `/admin/referentiels` (« Marques & modèles ») : liste toutes les marques avec leurs modèles, nombre d'annonces par marque/modèle, formulaires d'ajout, renommage et suppression.
- 3 nouvelles routes API réservées **ADMIN uniquement** (`isAdmin`, pas seulement `isStaff` — plus strict que la modération courante, cohérent avec la gestion des rôles utilisateurs) : `POST /api/admin/brands`, `PATCH`/`DELETE /api/admin/brands/[id]`, `POST /api/admin/brands/[id]/models`, `PATCH`/`DELETE /api/admin/models/[id]`. Chaque mutation journalisée (`brand.create/update/delete`, `model.create/update/delete`).
- Garde-fous de suppression : une marque avec des modèles, ou une marque/un modèle encore référencé par au moins une annonce, ne peut pas être supprimé (409 explicite : `has_models`/`has_listings`) — jamais de suppression en cascade silencieuse qui casserait des annonces existantes.
- Le slug (utilisé dans les URL SEO `/voitures/[brand]`) est fixé à la création et **ne change jamais** au renommage — seul le nom affiché est modifiable, pour ne jamais casser un lien existant.
- La page reste consultable par un modérateur (rôle `MODERATEUR`, cohérent avec le reste du back-office), mais les formulaires d'ajout/renommage/suppression ne s'affichent que pour un `ADMIN` — appliqué aussi bien côté page (rendu conditionnel) que côté API (403 sinon), même défense en profondeur que `/admin/utilisateurs`.
- `slugify()` extrait dans `src/lib/slugify.ts` (dupliqué délibérément depuis `prisma/catalogue-data.ts`, qui tourne hors du bundle Next — un import cross-runtime aurait été plus fragile qu'une fonction pure de 5 lignes dupliquée une fois).
- 7 nouveaux tests (`validateCatalogueName`, `slugify`) — 180/180 au total.
- Vérification de bout en bout avec le vrai compte admin : marque « Testmarque Lot25 » créée, modèle ajouté, suppression de la marque bloquée tant que le modèle existe (409 `has_models`), modèle renommé puis supprimé, marque supprimée avec succès ensuite ; tentative de suppression du modèle « Clio » (8 annonces réelles) bloquée (409 `has_listings`) ; tentative de création par le compte modérateur (Amine) refusée (403 `forbidden`) ; 5 entrées d'audit confirmées en base ; page consultée en lecture seule par le modérateur (aucun bouton de mutation affiché) ; rendu RTL arabe confirmé. Toutes les données de test supprimées après vérification (aucune trace résiduelle en base).

**Décisions/notes**
- Wilayas hors périmètre (cf. ci-dessus) — à reconsidérer seulement si un besoin réel de les modifier apparaît (découpage administratif algérien qui évoluerait officiellement).
- Aucune limite de pagination sur la liste des marques (~30 marques aujourd'hui, page rendue en une fois) — à revisiter si le catalogue grossit significativement.

**Reporté à un lot ultérieur**
- Gestion des wilayas depuis le back-office (jugée sans besoin réaliste, cf. Décisions/notes).
- Édition générale de l'annonce (Lot 23, toujours ouvert, indépendant de celui-ci).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 26 — Suppression de conversation (2026-09-03)

Choisi selon la logique de continuation : le plus vieux écart documenté encore ouvert et non bloqué (Lot 8 — « suppression de conversation/message »). Scope volontairement réduit à la conversation (pas au message individuel ni aux pièces jointes, cf. Reporté) pour un lot focalisé.

**Livré**
- « Supprimer » une conversation ne détruit **jamais** les messages de l'autre partie — un masquage propre à chaque utilisateur (`Conversation.hiddenByBuyerAt`/`hiddenBySellerAt`), pas une suppression de données partagées. La conversation disparaît de la messagerie de celui qui l'a supprimée, reste intacte pour l'autre.
- Un nouveau message dans une conversation masquée efface le masquage **des deux côtés** — elle réapparaît naturellement dans les deux boîtes de réception dès qu'il y a une activité réelle à voir.
- `DELETE /api/conversations/[id]` (nouvelle route) — réservée aux deux participants (403 sinon).
- Bouton « Supprimer » (confirmation en deux clics, `DeleteConversationButton`) sur la liste des conversations et sur la page de détail d'une conversation (redirection vers la messagerie après suppression).
- 3 nouveaux tests (`isConversationHiddenFor`) — 183/183 au total.
- Vérification de bout en bout avec une vraie conversation entre deux vrais comptes (Sara/Amine, 5 messages échangés) : suppression côté Amine confirmée (disparue de sa messagerie, `hiddenBySellerAt` posé, 5 messages toujours en base), conversation toujours visible côté Sara ; nouveau message de Sara → conversation réapparue chez Amine, `hiddenBySellerAt` effacé, confirmé en base et à l'écran ; suppression testée aussi depuis la page de détail (redirection vers la messagerie confirmée) ; tentative de suppression par un tiers non participant (l'administrateur) refusée (403) ; rendu RTL arabe confirmé. Données de test nettoyées (conversation restaurée visible, message de test supprimé).

**Décisions/notes**
- **Incident évité en cours de lot** : l'ajout de la colonne `hiddenByBuyerAt`/`hiddenBySellerAt` via `prisma migrate dev` a été bloqué par Prisma, qui exigeait de réinitialiser toute la base de développement (25 lots de données de test) — conséquence d'une migration du Lot 22 éditée après coup pour corriger un bug (`datetime()` SQLite), ce qui avait cassé son checksum enregistré. Contournement sans perte de données : migration créée manuellement, SQL appliqué directement en base, puis enregistrée via `prisma migrate resolve --applied` (sans rejouer l'historique). Aucune donnée perdue, mais leçon retenue : ne plus jamais éditer une migration déjà appliquée.
- Suppression au niveau conversation seulement — pas au niveau message individuel (soulève des questions de design distinctes : suppression pour soi vs pour tous, message-tombstone) ni de pièces jointes (nécessite une infra d'upload dédiée). Les deux restent dans l'écart du Lot 8, non traités ici.

**Reporté à un lot ultérieur**
- Suppression d'un message individuel (nécessite une décision de design : pour soi seulement, ou avec tombstone visible par l'autre partie).
- Pièces jointes en messagerie (nécessite une infra d'upload/validation de fichiers dédiée).
- Messagerie en temps réel (WebSocket/SSE).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 27 — Réponse du vendeur/de l'entreprise à un avis reçu (2026-09-03)

Choisi selon la logique de continuation : le plus vieux écart documenté encore ouvert (Lot 10, répété au Lot 19 — « réponse du vendeur/de l'entreprise à un avis reçu »), non bloqué par une ressource externe.

**Livré**
- `Review.reply`/`repliedAt` (nouveaux champs) : le vendeur (avis individuel) ou le propriétaire/gestionnaire d'un compte professionnel (avis d'entreprise) peut répondre à un avis reçu, modifier sa réponse, ou la retirer — jamais l'auteur de l'avis lui-même.
- `PATCH`/`DELETE /api/reviews/[id]/reply` : une seule route gère les deux types d'avis (individuel via `sellerId`, entreprise via `professionalAccountId`) — l'éligibilité distingue les deux cas (identité stricte pour un vendeur individuel ; propriétaire ou collaborateur **GESTIONNAIRE** pour un compte professionnel, réutilisant `canManageProListings()` du Lot 13 — un collaborateur en lecture seule ne peut pas répondre).
- `ReviewReplyForm` (composant partagé) affiché sur la page vendeur (`/vendeur/[id]`) et la page vitrine professionnelle (`/pro/[id]`) : bouton « Répondre » si aucune réponse n'existe encore et que l'utilisateur y est autorisé, réponse affichée avec actions « Modifier »/« Supprimer » pour l'ayant droit, lecture seule pour tout autre visiteur.
- 3 nouveaux tests (`validateReviewReply`) — 186/186 au total.
- Vérification de bout en bout avec de vrais comptes et une vraie relation de collaboration déjà existante (Amine gestionnaire du compte pro « Auto Sara Motors » depuis le Lot 13) : avis réel de Sara sur Amine créé, réponse d'Amine saisie et enregistrée via l'interface réelle, réponse visible en lecture seule chez Sara (aucun bouton d'action) ; avis sur le compte pro de Sara, réponse d'Amine en tant que gestionnaire confirmée (200) ; auteur de l'avis tentant de répondre à son propre avis refusé (403, les deux cas) ; validation vide refusée (400 `reply_required`) ; rendu RTL arabe confirmé. Données de test supprimées après vérification (base revenue à 0 avis, état initial).

**Décisions/notes**
- Le niveau de permission retenu pour répondre à un avis d'entreprise est le même que pour gérer les annonces (`GESTIONNAIRE`, pas propriétaire uniquement) — répondre à un avis relève de la gestion courante de la présence publique du compte, pas d'une décision réservée au seul propriétaire (cohérent avec `canManageCollaborators()`, qui reste elle réservée au propriétaire).

**Reporté à un lot ultérieur**
- Notification par email à l'auteur de l'avis quand une réponse est publiée (pourrait réutiliser le patron du Lot 21, non fait ici pour rester focalisé).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 28 — Score de confiance sur les cartes de résultats (2026-09-03)

Choisi selon la logique de continuation : le plus vieux écart documenté encore ouvert (Lot 12 — « affichage du score de confiance ailleurs que sur la page vitrine, ex : carte de résultat de recherche »).

**Livré**
- `getSellerTrustSummariesForSellers()` (`src/lib/seller-trust.ts`) : version par lot de `getSellerTrustSummary()` (Lot 24), même arbitrage N+1 que `estimatePricesForListings` (Lot 4) — un vendeur avec plusieurs annonces dans la même liste de résultats ne déclenche qu'un seul calcul, pas un par annonce.
- `ListingCard` affiche désormais une ligne compacte « Confiance vendeur : XX/100 » (nouvelle prop optionnelle `sellerTrustScore`), cohérente avec le score affiché sur la page vitrine du vendeur.
- Branché sur les trois pages où des annonces de **vendeurs différents** se côtoient — recherche (`/recherche`), page marque (`/voitures/[brand]`), page modèle (`/voitures/[brand]/[model]`). Volontairement **pas** branché sur les pages vendeur/pro (`/vendeur/[id]`, `/pro/[id]`) : toutes leurs annonces appartiennent déjà à un seul vendeur dont le score est affiché une fois en évidence en haut de page — le répéter sur chaque carte aurait été redondant.
- Aucun nouveau test unitaire (aucune nouvelle logique pure — `getSellerTrustSummariesForSellers` est un simple regroupement par lot d'une fonction déjà testée indirectement via son usage) ; 186/186 toujours au vert.
- Vérification de bout en bout sur les trois pages avec les 6 annonces réelles d'Amine (toutes le même vendeur, cas volontairement choisi pour exercer le dédoublonnage) : `0/100` affiché sur les 6 cartes à l'état réel (aucune vérification, aucun avis) ; vérifications email/téléphone ajoutées temporairement en base → `20/100` recalculé et affiché correctement sur les 6 cartes des trois pages, confirmant le chemin non nul ; flags de test retirés après vérification. Rendu RTL arabe confirmé (« ثقة البائع: 0/100 »).

**Reporté à un lot ultérieur**
- Mesure de complétude/cohérence des annonces (autre volet du même écart historique du Lot 12, indépendant de celui-ci — jugé trop subjectif sans signal fiable identifié).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 29 — Badge « Professionnel » sur les cartes de résultats (2026-09-03)

Choisi selon la logique de continuation : le plus vieux écart documenté encore ouvert (Lot 13 — « badge visuel Professionnel sur les cartes de résultats »). Le compte professionnel et son badge vérifié existaient depuis le Lot 13 sans jamais être montrés ailleurs que sur la vitrine `/pro/[id]` elle-même.

**Livré**
- `getProfessionalBadgesForSellers()` (`src/lib/professional-accounts.ts`, nouveau) : une seule requête `IN` sur `ProfessionalAccount.userId` pour un lot de vendeurs — pas besoin du dédoublonnage manuel du Lot 28 (`getSellerTrustSummariesForSellers`), Prisma le fait nativement pour une simple recherche par liste d'identifiants.
- `ListingCard` affiche un badge en haut à gauche de la photo (à droite en RTL, symétrique aux boutons favoris/comparateur déjà en haut à droite) : « ✓ Professionnel » si le compte est vérifié par le back-office (Lot 13), « Professionnel » sinon — rien si le vendeur est un particulier.
- Branché sur les mêmes trois pages multi-vendeurs que le Lot 28 (`/recherche`, `/voitures/[brand]`, `/voitures/[brand]/[model]`), pour la même raison : les pages vendeur/pro affichent déjà cette information une fois en haut de page.
- Aucun nouveau test unitaire (pure requête de lot, pas de nouvelle logique pure) ; 186/186 toujours au vert.
- Vérification de bout en bout : aucun badge affiché sur les 6 annonces réelles d'Amine (particulier, état réel confirmé sans faux positif) ; une annonce réaffectée temporairement au compte professionnel vérifié de Sara (« Auto Sara Motors ») → badge « ✓ Professionnel » confirmé visuellement en haut à gauche de la carte, distinct des icônes favoris/comparateur ; rendu RTL arabe confirmé (« ✓ محترف »). Annonce réaffectée à son vendeur d'origine après vérification.

**Reporté à un lot ultérieur**
- Import de stock en masse pour comptes professionnels (autre volet du même écart historique du Lot 13, indépendant de celui-ci).
- Permissions de collaborateur plus fines (JSON libre au lieu des deux rôles actuels — même écart du Lot 13).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 30 — Édition générale de l'annonce (2026-09-03)

Choisi explicitement par le porteur de projet (« Édition générale de l'annonce »).

**Livré**
- Nouvelle page `/compte/mes-annonces/[id]/modifier` : le vendeur peut désormais modifier le titre, la description, l'année, le kilométrage, le carburant, la boîte de vitesses, la transmission, la couleur, le nombre de portes/places, la puissance, l'état, première main/accidenté et la wilaya d'une annonce publiée ou expirée — jusqu'ici, seul le prix (Lot 23) était modifiable après publication.
- `PATCH /api/listings/[id]` : **toute modification de contenu renvoie l'annonce en modération** (`status: EN_ATTENTE`, `moderationNote` réinitialisée) — jamais un contournement silencieux de la vérification humaine (§39, même principe que tous les garde-fous des Lots 21-27). Réutilise intégralement le circuit de modération existant du Lot 7 (file d'attente admin, bannière « en attente » déjà affichée au propriétaire) : aucune modification du moteur de modération n'a été nécessaire.
- `listingEditSchema` (`src/lib/validation/listing.ts`) dérivé du schéma de création du Lot 2 par `.omit()` — catégorie, marque/modèle, prix et téléphone en sont exclus (le prix garde son flux dédié du Lot 23, la marque/modèle et la catégorie restent volontairement hors périmètre, cf. Décisions ci-dessous). Le schéma de création a été restructuré (objet de base extrait séparément du `.refine()`) pour permettre cette dérivation sans dupliquer chaque règle de validation.
- Lien « Modifier l'annonce » sur `/compte/mes-annonces` et sur la fiche de l'annonce (à côté des actions existantes de renouvellement/marquage vendu/prix), visible uniquement quand l'annonce est éditable.
- 2 nouveaux tests (`checkListingContentEditable`) — 188/188 au total (les tests existants sur `listingSchema` confirment que la restructuration n'a rien changé à son comportement).
- Vérification de bout en bord avec un vrai compte (Amine) sur une vraie annonce publiée : titre modifié via le formulaire réel → redirection vers la fiche de l'annonce → bannière « En attente de modération » du Lot 7 affichée correctement (statut `EN_ATTENTE` confirmé en base, `moderationNote` nulle) ; annonce réapparue dans la file d'attente admin (« Annonces en attente (1) ») ; approuvée par l'administrateur via le circuit de modération existant, sans aucune modification de code → statut `PUBLIEE` restauré, `publishedAt` d'origine préservé (pas de republication factice). Garde-fous vérifiés par appel direct : 403 pour un autre compte, 400 `invalid_status` sur une annonce `SUSPENDUE`. Rendu RTL arabe confirmé (formulaire complet, wilayas, notice de renvoi en modération). Données de test restaurées à l'identique après vérification.

**Décisions/notes**
- Marque, modèle et catégorie **volontairement exclus** de ce lot : les changer sur une annonce déjà indexée (pages SEO `/voitures/[brand]/[model]`, pool de comparables de l'estimation de prix) a des implications plus larges qu'un simple champ de formulaire — laissé de côté plutôt que bâclé.
- Photos **volontairement exclues** : la gestion incrémentale (ajout/suppression/réordonnancement en conservant les photos existantes) est une pièce d'interface à part entière, plus lourde que les champs texte/attributs traités ici.
- Vérifié en conditions réelles sur le propre serveur de développement du porteur de projet (déjà lancé via `Lancer Souq Auto.bat`) plutôt que via un serveur de prévisualisation séparé — évite tout risque de conflit de port comme celui rencontré plus tôt dans la session.

**Reporté à un lot ultérieur**
- Édition de la marque/du modèle/de la catégorie.
- Gestion des photos lors de l'édition (ajout/suppression/réordonnancement).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 31 — Suspension de compte utilisateur (2026-09-03)

Choisi explicitement par le porteur de projet. Comble l'écart documenté depuis le Lot 21 : la suspension automatique après seuil de signalements confirmés ne s'appliquait jusqu'ici qu'aux annonces, jamais aux comptes eux-mêmes — et aucune suspension manuelle de compte n'existait non plus (contrairement aux annonces, où le manuel existait depuis le Lot 7 avant que le Lot 21 y ajoute l'automatique). Les deux ont donc été construits ensemble ici, l'automatique sans le manuel aurait laissé un faux-positif irréversible sans recours.

**Livré**
- `User.suspendedAt`/`suspensionReason` (nouveaux champs) : un compte suspendu perd **immédiatement** toute capacité authentifiée — `getCurrentUser()` (le point de passage unique utilisé par toutes les pages/routes) traite un compte suspendu comme non connecté, sans avoir à modifier chaque route individuellement. La connexion est bloquée avec un message explicite (`account_suspended` + motif), même pour une session déjà active au moment de la suspension.
- Suspension manuelle : `POST/DELETE` via `/api/admin/users/[id]/suspend` et `/unsuspend` (réservés au staff, `isStaff` — même niveau que la modération d'annonces, pas `isAdmin`), avec motif obligatoire à la suspension. Bouton « Suspendre »/« Réactiver » sur `/admin/utilisateurs`.
- Suspension automatique : après `AUTO_SUSPEND_USER_THRESHOLD` (3) signalements **confirmés** sur un même compte (jamais des signalements ouverts/rejetés, même principe que le Lot 9/21), branchée dans la route `POST /api/admin/reports/[id]/resolve` existante, aux côtés de la branche annonce du Lot 21.
- Garde-fous : impossible de se suspendre soi-même, impossible de suspendre un compte du staff (`MODERATEUR`/`ADMIN`) — ni manuellement, ni automatiquement via un signalement (même vérification des deux côtés).
- 7 nouveaux tests (`shouldAutoSuspendUser`, `checkCanSuspendUser`) — 195/195 au total.
- Vérification de bout en bout avec un compte jetable créé pour l'occasion : suspension manuelle via l'interface réelle (motif affiché, bouton basculé en « Réactiver ») ; connexion bloquée avec motif affiché ; **session déjà active invalidée immédiatement** après une suspension survenue en cours de session (`/api/auth/me` passé de 200 à 401 sans reconnexion) ; suspension automatique déclenchée exactement au 3e signalement confirmé par 3 vrais comptes distincts (Amine/Sara/Admin), entrée d'audit `user.auto_suspend` confirmée ; tentative de suspension d'un compte du staff refusée (400 `cannot_suspend_staff`) et de soi-même refusée (400 `cannot_suspend_self`) ; rendu RTL arabe confirmé. Compte de test et toutes ses données supprimés après vérification.

**Décisions/notes**
- **Migration appliquée pendant que le serveur de développement du porteur de projet tournait** : `prisma generate` a été bloqué par un verrou Windows sur le moteur Prisma (fichier chargé par le process actif) — le porteur de projet a arrêté temporairement son serveur le temps de la régénération, puis l'a relancé. Aucune perte de données (vérifiée avant/après). Migration appliquée avec le même contournement manuel que les Lots 26/27 (SQL direct + `prisma migrate resolve --applied`).
- Un compte suspendu garde son cookie de session, qui devient simplement inerte (`getCurrentUser()` renvoie toujours `null`) — pas besoin de le révoquer activement.

**Reporté à un lot ultérieur**
- Notification par email au moment de la suspension (le compte ne peut de toute façon plus se connecter pour la voir dans l'app — un email serait le seul canal restant, non construit ici pour rester focalisé).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 32 — Notification email de réponse à un avis (2026-09-03)

Choisi explicitement par le porteur de projet. Comble l'écart documenté depuis le Lot 27 : l'auteur d'un avis n'était jamais informé qu'une réponse du vendeur/de l'entreprise avait été publiée.

**Livré**
- `PATCH /api/reviews/[id]/reply` envoie désormais un email (FR/AR selon la locale réelle de l'auteur de l'avis, réutilisant le patron des Lots 21/23) à chaque publication ou modification de la réponse (la même route gère les deux) — jamais sur une suppression (`DELETE`, retirer une réponse ne justifie pas une notification).
- Le nom affiché dans l'email s'adapte au type d'avis : nom du vendeur (avis individuel) ou nom commercial de l'entreprise (avis professionnel) — jamais le même libellé générique pour les deux, cohérent avec l'affichage déjà existant sur les pages `/vendeur/[id]` et `/pro/[id]`. Le lien de l'email pointe vers la bonne page selon le cas. Titre/nom échappés (`escapeHtml`) avant interpolation.
- Aucun nouveau test unitaire (aucune nouvelle logique pure — assemblage de briques déjà testées : `sendEmail`, `escapeHtml`, les traductions) ; 195/195 toujours au vert.
- Vérification de bout en bout avec de vrais comptes, sur les deux chemins (avis individuel et avis d'entreprise) : avis réel de Sara sur Amine → réponse d'Amine → email reçu et **son contenu source lu intégralement** sur Ethereal (destinataire, sujet, corps avec le bon nom et le bon lien vérifiés caractère par caractère) ; avis réel sur le compte pro de Sara → réponse d'Amine (gestionnaire) → email distinct reçu par l'auteur de l'avis avec le nom commercial « Auto Sara Motors » et le lien `/pro/[id]` corrects. Sujet confirmé en arabe (« رد على تقييمك — سوق أوتو ») en basculant temporairement la locale d'un compte de test. Données de test entièrement supprimées après vérification.

**Décisions/notes**
- Testé cette fois en lisant la source brute de l'email sur Ethereal (pas seulement la présence du lien de log) — plus rigoureux que la simple confirmation d'envoi utilisée dans quelques lots précédents quand l'environnement le permettait.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 33 — Édition d'email avec confirmation par lien (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le premier des deux écarts documentés depuis le Lot 20 (« Email non éditable dans ce lot : plus sensible qu'un téléphone (identifiant de connexion), changer d'email mériterait un flux de confirmation par lien vers la nouvelle adresse »).

**Livré**
- Nouveau modèle `EmailChangeRequest` (distinct d'`EmailVerificationToken`, Lot 11, qui revérifie l'adresse actuelle — jamais confondu avec une confirmation de nouvelle adresse) : `userId`, `newEmail`, `token`, `expiresAt`.
- `POST /api/profile/email-change/request` : envoie un lien de confirmation **à la nouvelle adresse**, jamais à l'ancienne — seule la preuve de réception à la nouvelle adresse justifie le changement. Une nouvelle demande annule silencieusement toute demande précédente encore en attente (jamais deux liens valides simultanément). Refuse une adresse identique à l'actuelle et une adresse déjà utilisée par un autre compte.
- Page `/confirmer-email/[token]` : au clic, l'email du compte est mis à jour **et automatiquement marqué vérifié** (`emailVerifiedAt`) — cliquer le lien prouve la possession de la nouvelle adresse, une étape de vérification séparée serait redondante. Re-vérifie la disponibilité de l'adresse au moment de la confirmation (pas seulement à la demande) : une adresse prise par un autre compte entre-temps est détectée et refusée proprement plutôt que de provoquer un conflit d'unicité en base.
- Section « Adresse email » sur `/compte/profil` (`EmailChangeForm`), affichant l'adresse actuelle et un formulaire de changement séparé du reste du profil (flux distinct : celui-ci nécessite une confirmation asynchrone, pas une sauvegarde immédiate).
- Aucun nouveau test unitaire (réutilise intégralement `generateExpiry`/`isExpired` du Lot 11, déjà testés) ; 195/195 toujours au vert.
- Vérification de bout en bout avec un compte jetable créé pour l'occasion : demande de changement via le vrai formulaire → email reçu **à la nouvelle adresse** (contenu source vérifié sur Ethereal : bon destinataire, bon lien) → confirmation via le lien réel → email et `emailVerifiedAt` mis à jour en base → connexion avec la nouvelle adresse réussie (200), avec l'ancienne refusée (401). Garde-fous vérifiés : 400 `same_email` (nouvelle adresse identique à l'actuelle), 409 `email_taken` (adresse déjà utilisée par un compte réel, Amine) ; lien invalide correctement rejeté. Rendu RTL arabe confirmé (formulaire de profil et page de confirmation). Compte de test supprimé après vérification.

**Reporté à un lot ultérieur**
- Upload/affichage d'avatar (second écart du Lot 20, indépendant de celui-ci).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 34 — Upload et affichage d'avatar (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le second écart documenté depuis le Lot 20 (« Avatar non exposé : aucune interface n'affiche encore une photo de profil nulle part dans l'application — l'ajouter maintenant créerait un champ modifiable sans effet visible ailleurs »). `Profile.avatarUrl` existait dans le schéma depuis le Lot 1 sans jamais être ni modifiable ni affiché.

**Livré**
- `saveAvatar()` (`src/lib/uploads.ts`) : extrait la validation commune de `savePhoto()` (Lot 2 — octets réels lus via `file-type`, jamais le type déclaré par le client ; nom physique généré, jamais le nom du fichier client, cf. incident Al Handassa Urban) dans un helper partagé, puis applique des contraintes propres à un avatar (4 Mo max contre 8 pour une photo d'annonce, recadrage carré 400×400 `fit: cover` contre un redimensionnement simple en largeur).
- `POST`/`DELETE /api/profile/avatar` : upload (multipart, un seul fichier) et suppression.
- `AvatarUpload` sur `/compte/profil` : aperçu de l'avatar actuel, changement et retrait.
- **Affiché à trois endroits réels** (pas un champ mort comme redouté au Lot 20) : la page de profil elle-même, le tableau de bord (`/compte/tableau-de-bord`, à côté du message de bienvenue), et surtout la page vendeur publique (`/vendeur/[id]`, à côté du nom) — c'est cette dernière qui donne un vrai usage public à la fonctionnalité.
- Aucun nouveau test unitaire (aucune nouvelle logique pure — extraction d'une validation déjà éprouvée par `savePhoto`, jamais testée unitairement elle non plus, cohérent avec la convention du projet de ne pas tester unitairement les wrappers impurs de système de fichiers) ; 195/195 toujours au vert.
- Vérification de bout en bout avec un compte jetable et de vraies images JPEG déjà présentes dans `public/uploads/listings/` : upload réel (fichier confirmé sur disque et en base), affichage confirmé visuellement sur les trois pages (dashboard, profil, page vendeur publique) ; suppression via l'interface réelle confirmée (base + disparition de l'aperçu) ; garde-fous vérifiés par appel direct : 400 `photo_invalid_type` (fichier texte déguisé en `.jpg`), 400 `photo_too_large` (5 Mo contre une limite de 4) ; 401 sur une tentative non authentifiée. Rendu RTL arabe confirmé. Compte de test et fichiers uploadés entièrement supprimés après vérification.

**Décisions/notes**
- Ce lot clôt les deux écarts documentés depuis le Lot 20 (édition d'email au Lot 33, avatar ici) — le profil utilisateur est désormais éditable dans son intégralité (identité affichée, coordonnées, présentation, connexion).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 35 — Édition de la marque/du modèle/de la catégorie (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le premier des deux volets laissés de côté au Lot 30 (« Édition de la marque/du modèle/de la catégorie — a des implications plus larges qu'un simple champ de formulaire »). En pratique, ces implications se sont avérées limitées : les pages SEO marque/modèle et le pool de comparables de l'estimation de prix interrogent la base en direct à chaque affichage (pas de cache à invalider), donc changer la marque/le modèle d'une annonce la fait simplement apparaître sur les nouvelles pages et disparaître des anciennes, sans effet de bord caché.

**Livré**
- `listingEditSchema` couvre désormais catégorie/marque/modèle (seuls le prix et le téléphone restent hors de son périmètre) — dérivé par simple `.omit()` du même schéma de base que la création (Lot 2), avec la même règle de validation (marque catalogue ou texte libre requise).
- `PATCH /api/listings/[id]` réutilise telles quelles les vérifications catalogue de la route de création (`unknown_brand`/`unknown_model`, cohérence marque/modèle) — jamais un identifiant fabriqué côté client.
- `ListingEditForm` intègre les sélecteurs catégorie/marque/modèle en cascade (marque catalogue ou texte libre, modèle dépendant de la marque choisie) — même logique que `Step2Fields` de l'assistant de publication (Lot 2), adaptée à un état de formulaire local plutôt qu'au `WizardContext`.
- Aucun nouveau test unitaire (le schéma dérivé et les vérifications catalogue sont déjà couverts par les tests existants de création) ; 195/195 toujours au vert.
- Vérification de bout en bout avec une vraie annonce d'Amine : changement Renault Clio → Peugeot 208 via le vrai formulaire → renvoi en modération confirmé → approuvée par l'administrateur via le circuit existant → apparition confirmée sur `/voitures/peugeot/208` (1 annonce) et disparition de `/voitures/renault/clio` (passée de 6 à 5 annonces), sans aucune modification du moteur de recherche ni des pages SEO. Garde-fou vérifié : 400 `unknown_brand` sur un identifiant fabriqué, annonce restée intacte en base (rejetée avant toute écriture). Rendu RTL arabe confirmé (catégories/marques/modèles traduits). Annonce restaurée à son état d'origine (Renault Clio) après vérification.

**Reporté à un lot ultérieur**
- Gestion des photos lors de l'édition (second volet laissé de côté au Lot 30, indépendant de celui-ci).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 36 — Gestion des photos lors de l'édition (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le second volet laissé de côté au Lot 30 : ajout, suppression et réordonnancement des photos d'une annonce déjà publiée.

**Livré**
- `PATCH /api/listings/[id]` accepte désormais du `multipart/form-data` (comme la création, Lot 2) plutôt que du JSON pur : un champ `data` (JSON, avec un nouveau tableau `existingPhotoIds` — l'ordre voulu des photos conservées) et un champ `newPhotos` (fichiers). Toute photo de l'annonce absente de `existingPhotoIds` est supprimée ; les photos conservées sont renumérotées selon cet ordre ; les nouvelles sont ajoutées à la suite. Réutilise `savePhoto()` (Lot 2) et ses garde-fous (octets réels, 8 Mo max) sans duplication.
- Un id de photo qui n'appartient pas réellement à l'annonce est silencieusement ignoré, jamais une erreur — défense contre un id d'une autre annonce injecté côté client.
- Même contrainte qu'à la création : entre 1 et 10 photos au total (`at_least_one_photo`/`too_many_photos`), toutes les écritures (suppression, renumérotation, ajout, mise à jour des champs) appliquées dans une seule transaction Prisma.
- `ListingEditForm` : section Photos avec vignettes des photos existantes (déplacer ▲▼, retirer), ajout de nouvelles photos avec aperçu local (mêmes composants visuels que l'étape 6 de l'assistant de publication, Lot 2, adaptés à un état de formulaire local).
- Aucun nouveau test unitaire (aucune nouvelle logique pure — assemblage de `savePhoto`/transaction Prisma, déjà non testés unitairement par convention pour les mêmes raisons que le Lot 34) ; 195/195 toujours au vert.
- Vérification de bout en bout avec une vraie annonce à deux photos (Amine) : réordonnancement (positions inversées) + ajout d'une troisième confirmés en base ; suppression de la photo ajoutée confirmée (2 photos restantes, ordre d'origine restauré) ; garde-fous vérifiés par appel direct : 400 `at_least_one_photo` (toutes les photos retirées), un id de photo étranger fourni en mélange avec un id réel correctement filtré (seul l'id réel conservé, jamais d'erreur) ; l'éligibilité de statut (Lot 30) s'applique aussi aux photos (400 `invalid_status` tant que l'annonce n'était pas repassée en `PUBLIEE` par l'administrateur entre deux tests). Rendu RTL arabe confirmé (« الصور », ▲▼, « إزالة », « إضافة صور »). Annonce restaurée à son état exact d'origine (2 photos, même ordre, `PUBLIEE`) après vérification ; fichier de test orphelin supprimé du disque.

**Décisions/notes**
- Ce lot clôt les deux volets laissés de côté au Lot 30 (marque/modèle/catégorie au Lot 35, photos ici) — l'édition générale d'une annonce couvre désormais l'intégralité de son contenu, seul le prix gardant son propre flux sans re-modération (Lot 23).
- Les fichiers de photos supprimées restent sur le disque (jamais nettoyés) — cohérent avec le reste de l'application, qui ne nettoie pas non plus les fichiers d'annonces supprimées ; un sujet séparé si l'espace disque devient un problème réel.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 37 — Notification email à la suspension d'un compte (2026-09-03)

Choisi explicitement par le porteur de projet. Comble l'écart documenté depuis le Lot 31 : un compte suspendu perd immédiatement toute capacité authentifiée (`getCurrentUser()` le traite comme non connecté) et ne peut donc plus voir l'information dans l'application elle-même — l'email est le seul canal restant.

**Livré**
- `sendAccountSuspendedEmail()` (`src/lib/account-suspension-email.ts`, nouveau) : email FR/AR selon la locale réelle du compte, motif inclus (échappé via `escapeHtml`) — partagé entre les deux chemins de suspension du Lot 31 pour ne pas dupliquer le patron d'envoi.
- Branché sur `POST /api/admin/users/[id]/suspend` (suspension manuelle) et sur la branche de suspension automatique de `POST /api/admin/reports/[id]/resolve` (après 3 signalements confirmés) — un seul et même email pour les deux déclencheurs.
- Aucun nouveau test unitaire (aucune nouvelle logique pure — assemblage de `sendEmail`/`escapeHtml`/traductions déjà éprouvés) ; 195/195 toujours au vert.
- Vérification de bout en bout sur les deux chemins avec de vrais comptes jetables : suspension manuelle via l'API réelle → email reçu, **contenu source lu intégralement** sur Ethereal (bon destinataire, bon motif) ; suspension automatique déclenchée par 3 vrais signalements confirmés (Amine/Sara/Admin, même scénario que le Lot 31) → email distinct reçu avec le motif automatique. Sujet confirmé en arabe (« تم تعليق حسابك — سوق أوتو ») via un compte de test dédié. Comptes et données de test entièrement supprimés après vérification.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 38 — Suppression d'un message individuel (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le premier des trois écarts documentés depuis le Lot 8/26 (« Suppression d'un message individuel — nécessiterait de distinguer suppression pour soi/pour tous, et une politique claire sur qui peut effacer quoi »). Approche délibérément opposée à la suppression de conversation (Lot 26, masquage par utilisateur, `hiddenByBuyerAt`/`hiddenBySellerAt`, jamais le contenu détruit) : ici, suppression **réellement pour tout le monde** (contenu effacé en base), mais restreinte au seul expéditeur — jamais le destinataire, qui ne doit jamais pouvoir faire disparaître un message qu'il n'a pas écrit.

**Livré**
- `Message.deletedAt` (nouveau champ, migration appliquée) : pilote un tombstone « Message supprimé » côté UI ; `content` est mis à `""` au moment de la suppression (contenu réellement effacé, pas juste masqué).
- `checkCanDeleteMessage()` (`src/lib/messaging.ts`, fonction pure testée) : vérifie `isSender` **avant** `alreadyDeleted` — un non-expéditeur reçoit `not_sender` même sur un message déjà supprimé, jamais l'inverse (l'ordre des vérifications a un sens : on ne révèle jamais l'état de suppression à quelqu'un qui n'avait pas le droit d'agir de toute façon).
- `DELETE /api/conversations/[id]/messages/[messageId]` : 404 si le message n'appartient pas à la conversation, 403 `not_sender`/`already_deleted` sinon.
- `MessageList` (nouveau composant client) : bouton « Supprimer » affiché uniquement sous les messages de l'utilisateur courant non déjà supprimés, confirmation en deux étapes (« Supprimer » → « Confirmer ? »). Tombstone affiché à la place du contenu pour les deux parties. Aperçu du dernier message dans la liste des conversations (`/compte/messages`) mis à jour de la même façon.
- 4 nouveaux tests unitaires sur `checkCanDeleteMessage` (autorise expéditeur, bloque non-expéditeur, bloque déjà-supprimé, priorité expéditeur sur déjà-supprimé) ; 199/199 au vert.
- Vérification de bout en bout sur la conversation réelle Sara/Amine : suppression d'un message d'Amine confirmée en base (contenu vidé, `deletedAt` renseigné) et à l'écran des deux côtés (tombstone visible chez Sara comme chez Amine) ; garde-fous vérifiés par appel direct : 403 `not_sender` (Sara tentant de supprimer un message d'Amine), 403 `already_deleted` (deuxième suppression du même message), 404 (message d'une autre conversation). Rendu RTL arabe confirmé (« تم حذف الرسالة », « حذف » affiché uniquement sous le message propre non supprimé). Message de test restauré à son contenu d'origine après vérification.

**Reporté à un lot ultérieur**
- Pièces jointes en messagerie et messagerie en temps réel (deuxième et troisième écarts du Lot 8/26, chacun nécessitant une infrastructure dédiée — upload/validation de fichiers pour l'un, WebSocket/SSE pour l'autre).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 39 — Pièces jointes en messagerie (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le deuxième des trois écarts documentés depuis le Lot 8/26 (« Pièces jointes — nécessite une infra d'upload/validation de fichiers dédiée »). Périmètre volontairement limité à l'image (comme envisagé dès le Lot 8 : « pas de pièces jointes/photos »), pas de document arbitraire (PDF, etc.), pour rester cohérent avec le reste de l'application où toute pièce envoyée par un utilisateur est une image validée par octets réels.

**Livré**
- `Message.attachmentUrl` (nouveau champ, migration appliquée) : optionnel, effacé (mis à `null`) en même temps que `content` au moment d'une suppression de message (Lot 38) — un message supprimé ne laisse jamais sa pièce jointe visible après coup.
- `saveMessageAttachment()` (`src/lib/uploads.ts`) : extrait exactement la même validation par octets réels que `savePhoto`/`saveAvatar` (jamais le type déclaré par le client), limite propre de 5 Mo, répertoire dédié `public/uploads/messages/`.
- `checkMessageHasContent()` (`src/lib/messaging.ts`, fonction pure testée) : un message doit contenir du texte, une pièce jointe, ou les deux — jamais ni l'un ni l'autre. Le texte seul n'est donc plus une contrainte obligatoire, contrairement à avant ce lot.
- `POST /api/conversations/[id]/messages` : bascule de JSON pur vers `multipart/form-data` (comme les routes de création/édition d'annonce et l'avatar) pour accepter un champ `content` optionnel et un champ `attachment` optionnel. L'email de notification de nouveau message (Lot 8) affiche « [Pièce jointe] » quand le message n'a pas de texte.
- `MessageThread` : bouton 📎 pour choisir une image (accepté uniquement JPEG/PNG/WebP côté client, revalidé par octets réels côté serveur), aperçu local avant envoi (`URL.createObjectURL`, mêmes pattern et nettoyage que `ListingEditForm` du Lot 36) avec retrait possible avant envoi.
- `MessageList` : la pièce jointe s'affiche au-dessus du texte dans la bulle du message (les deux peuvent coexister) ; l'aperçu du dernier message dans la liste des conversations affiche « 📎 Image » quand le message n'a pas de texte.
- 4 nouveaux tests unitaires sur `checkMessageHasContent` (texte seul, pièce jointe seule, les deux, ni l'un ni l'autre) ; 203/203 au vert.
- Vérification de bout en bout sur la conversation réelle Sara/Amine, avec une vraie image (une photo d'annonce existante réutilisée comme source) envoyée via un vrai appel à l'API réelle (upload réel, fichier confirmé sur disque) : rendu confirmé côté expéditeur (Sara) et côté destinataire (Amine, badge non-lu inclus, bouton Supprimer absent sous le message de Sara). Garde-fous vérifiés par appel direct : 400 `empty_message` (ni texte ni pièce jointe), 400 `photo_invalid_type` (fichier texte déguisé en `.jpg` malgré un `Content-Type` client mensonger), 400 `photo_too_large` (6 Mo contre une limite de 5). Suppression d'un message pièce-jointe-seule confirmée en base (`content` et `attachmentUrl` tous deux remis à vide/`null`). Rendu RTL arabe confirmé, y compris l'aperçu « 📎 صورة » dans la liste des conversations pour un message sans texte. Messages et fichiers de test entièrement supprimés après vérification.

**Reporté à un lot ultérieur**
- Messagerie en temps réel (troisième écart du Lot 8/26, nécessite une infrastructure WebSocket/SSE indépendante).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 40 — Messagerie en temps réel (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le troisième et dernier écart documenté depuis le Lot 8/26. Approche Server-Sent Events (SSE) plutôt que WebSocket — unidirectionnel serveur→client, suffisant ici puisque l'envoi passe toujours par le `POST` HTTP existant (Lot 8), et bien plus simple à faire cohabiter avec les routes HTTP classiques de Next.js qu'un vrai WebSocket bidirectionnel.

**Livré**
- `src/lib/realtime.ts` (nouveau) : pub/sub en mémoire, un seul process Node — même philosophie que le bus d'événements in-process d'Al Handassa Urban, honnêtement limité à une seule instance serveur (passerait à un broker externe type Redis pub/sub si l'application devait un jour tourner sur plusieurs instances).
- `GET /api/conversations/[id]/stream` (nouveau) : flux SSE authentifié et scopé à la conversation (mêmes vérifications d'accès que les autres routes de messagerie), heartbeat toutes les 25 s pour traverser les proxys qui coupent les flux inactifs, nettoyage de l'abonnement à la fermeture de la connexion.
- Les routes d'envoi (Lot 8/39) et de suppression (Lot 38) publient désormais un événement (`message`/`delete`) vers tout abonné de la conversation, en plus de leur comportement existant inchangé.
- `ConversationView` (nouveau composant client) : seul point qui détient l'état des messages affichés, ouvre le flux SSE à l'ouverture de la conversation, applique les événements entrants (nouveau message, tombstone de suppression) sans jamais recharger la page. `MessageThread` n'appelle plus `router.refresh()` après un envoi — il attend le même écho SSE que tout autre événement entrant, garantissant que l'expéditeur et le destinataire voient toujours exactement la même séquence, sans code dupliqué entre les deux cas.
- Un message reçu en direct d'un autre utilisateur déclenche automatiquement un appel à `POST /api/conversations/[id]/read` (endpoint déjà existant depuis un lot antérieur mais jusqu'ici jamais appelé côté client) pour que le badge non-lu reste correct au prochain chargement.
- Aucun nouveau test unitaire (aucune nouvelle logique métier pure — pub/sub et flux SSE sont de la plomberie temps réel, non testée unitairement par convention, comme les autres wrappers impurs du projet) ; 203/203 toujours au vert.
- Vérification de bout en bout en conditions réelles sur la conversation Sara/Amine : un onglet navigateur ouvert sur la conversation (Sara, avec un vrai flux SSE actif, confirmé via `read_network_requests`) reçoit un message envoyé par Amine depuis une session HTTP entièrement séparée (cookie distinct, script externe) et l'affiche **sans aucun rechargement de page** ; la suppression du même message par Amine fait apparaître le tombstone « Message supprimé » dans l'onglet de Sara, toujours sans rechargement ; l'appel automatique à `/read` confirmé dans le journal réseau. Envoi via la vraie interface (composeur, pas un appel direct) également vérifié : message affiché immédiatement après clic sur Envoyer. Rendu RTL arabe confirmé avec un message reçu en direct (bulle correctement alignée à gauche). Un script de test Node bas niveau a d'abord donné un faux négatif (délai de ~29 s) à cause d'une particularité de mise en mémoire tampon du client `fetch` de Node face à une réponse en flux — non représentative d'un navigateur réel, dont l'API `EventSource` gère nativement le SSE sans ce délai ; d'où la vérification finale en navigateur réel ci-dessus. Tous les messages de test entièrement supprimés de la base après vérification.

**Décisions/notes**
- Ce lot clôt l'intégralité des trois écarts documentés depuis le Lot 8/26 (suppression de message Lot 38, pièces jointes Lot 39, temps réel ici) — la messagerie est désormais fonctionnellement complète pour ce périmètre.
- Limitation assumée : le pub/sub en mémoire ne fonctionne qu'avec une seule instance serveur. Sans conséquence tant que l'application reste monolithe (un seul process `next start`/`next dev`), à revisiter seulement si un déploiement multi-instances devenait réel.

Prochain lot proposé : import de stock en masse pour les comptes professionnels et permissions de collaborateur plus fines (Lot 13/29), seuls écarts explicitement nommés par le porteur de projet encore ouverts. Le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 41 — Import de stock en masse (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le premier des deux écarts documentés depuis le Lot 13/29 (« import de stock en masse » et « permissions de collaborateur plus fines », §9/§26 du cahier d'architecture). Périmètre volontairement limité aux données textuelles/numériques d'une annonce — un CSV ne peut pas raisonnablement transporter de vraies photos, et une annonce sans photo n'a jamais été publiable depuis le Lot 2. La solution retenue réutilise un état déjà prévu dans le schéma mais jamais atteint : `ListingStatus.BROUILLON` existait depuis le Lot 1/2 sans qu'aucun code n'y mène jamais.

**Livré**
- `src/lib/csv.ts` (nouveau, fonctions pures testées) : petit analyseur CSV maison plutôt qu'une dépendance externe — champs entre guillemets, virgules/retours à la ligne à l'intérieur d'un champ cité, guillemet doublé échappé, BOM UTF-8 ignoré (Excel en ajoute un systématiquement).
- `src/lib/bulk-import.ts` (nouveau, fonction pure testée) : mappe une ligne CSV brute vers exactement les mêmes champs que la création manuelle (Lot 2), puis délègue à `listingSchema.safeParse()` — aucune règle de validation dupliquée, un import suit les mêmes contraintes (longueurs, plages numériques, énumérations) qu'une saisie manuelle. Marque/modèle résolus par nom contre le référentiel (Lot 1/25) avec repli en texte libre si non trouvés (comme la saisie manuelle le permet déjà) ; wilaya résolue par code ou par nom, rejetée si non reconnue (pas d'équivalent texte libre pour la wilaya dans le schéma).
- `POST /api/pro/accounts/[id]/bulk-import` : accès restreint au propriétaire ou à un collaborateur **GESTIONNAIRE** (`canManageProListings()`, Lot 13/27), jamais LECTURE_SEULE. Chaque ligne valide crée une annonce en `BROUILLON` — **jamais un contournement de la modération** : sans photo, une annonce ne peut de toute façon pas devenir visible. Import partiel assumé : une ligne invalide ne bloque jamais les autres, chaque rejet est rapporté avec son numéro de ligne et la raison.
- `listing-lifecycle.ts` : `checkListingContentEditable()` accepte désormais aussi `BROUILLON` (en plus de `PUBLIEE`/`EXPIREE`) — seul chemin pour qu'un professionnel complète une annonce importée (ajout des photos via l'édition existante du Lot 30/35/36) ; l'enregistrement fait alors automatiquement repasser l'annonce en `EN_ATTENTE`, comme toute autre édition de contenu, jamais un chemin dédié qui contournerait la file de modération.
- `/pro/import` (nouvelle page, gardée par `canManageProListings`) : upload du CSV, rapport d'import (nombre importé, lignes rejetées avec raison traduite), lien direct vers « Mes annonces » pour compléter les photos. Lien ajouté au tableau de bord pro à côté de « Gérer mes annonces ».
- 25 nouveaux tests unitaires (analyseur CSV : guillemets/échappement/CRLF/BOM/lignes vides ; mapping de ligne : résolution catalogue, repli texte libre, toutes les erreurs de validation, insensibilité à la casse des énumérations, booléens oui/non) ; 1 test existant de `checkListingContentEditable` mis à jour pour refléter le nouvel état éligible ; 229/229 au vert.
- Vérification de bout en bout avec le compte professionnel réel « Auto Sara Motors » : import d'un CSV à 4 lignes (3 valides dont une à marque non catalogée passée en texte libre, 1 rejetée pour wilaya inconnue avec le bon numéro de ligne) → 3 annonces `BROUILLON` confirmées en base, visibles sur `/compte/mes-annonces` avec badge « Brouillon » et lien « Modifier » ; garde-fou `at_least_one_photo` vérifié sur une tentative d'enregistrement sans photo, puis passage réel à `EN_ATTENTE` confirmé après ajout d'une photo via la même édition existante. Import réalisé une seconde fois **par un collaborateur GESTIONNAIRE réel** (Amine) plutôt que par la propriétaire : annonce correctement attribuée à Sara (`sellerId` = propriétaire du compte), jamais à Amine. Accès refusé (403 `forbidden`) confirmé pour un compte totalement étranger au compte professionnel (administrateur). Garde-fou `phone_required` vérifié (le compte de test n'avait pas de téléphone avant le test). Rendu RTL arabe confirmé. Toutes les annonces de test supprimées et téléphone de test remis à `null` après vérification.

**Reporté à un lot ultérieur**
- Permissions de collaborateur plus fines (JSON libre au lieu des deux rôles actuels — second et dernier écart du Lot 13/29).

**Décision hors périmètre découverte en cours de route (signalée séparément, non corrigée ici)**
- `/compte/mes-annonces` ne filtre que par `sellerId: user.id` — un collaborateur GESTIONNAIRE n'y voit jamais les annonces du compte professionnel qu'il gère, y compris celles qu'il vient d'importer lui-même (elles sont attribuées au propriétaire, pas à lui). Le lien « Gérer mes annonces » du tableau de bord pro est donc une impasse pour un collaborateur, un écart préexistant (non introduit par ce lot) qui touche aussi bien la création manuelle que l'import en masse. Signalé comme tâche séparée plutôt que corrigé ici pour ne pas élargir le périmètre de ce lot.

Prochain lot proposé : permissions de collaborateur plus fines pour les comptes professionnels (dernier écart explicitement nommé par le porteur de projet). Le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 42 — Permissions de collaborateur plus fines (2026-09-03)

Choisi explicitement par le porteur de projet. Comble le dernier écart documenté depuis le Lot 13/29 (« permissions de collaborateur plus fines — JSON libre au lieu des deux rôles actuels »). Périmètre déterminé par un inventaire précis des seules actions réellement contrôlées par le rôle GESTIONNAIRE aujourd'hui : gestion des annonces (import en masse, Lot 41) et réponse aux avis (Lot 27) — deux capacités jusqu'ici bundlées dans un seul rôle tout-ou-rien, désormais indépendamment accordables. La gestion des collaborateurs elle-même reste un pouvoir non délégable, réservé au seul propriétaire (inchangé).

**Livré**
- `ProCollaborator.permissions` (migration appliquée, remplace `role`) : JSON encodé en texte (`src/lib/pro-permissions.ts`, fonctions pures testées) plutôt qu'un type Prisma `Json` — cohérent avec le reste du projet, jamais de confiance aveugle dans la forme stockée (`parseProPermissions` coerce chaque champ en booléen, replie sur « aucune permission » si le JSON est invalide). Migration de données : chaque collaborateur `GESTIONNAIRE` existant devient `{gererAnnonces:true, repondreAvis:true}` (comportement inchangé), chaque `LECTURE_SEULE` devient `{gererAnnonces:false, repondreAvis:false}` — zéro régression pour les collaborateurs déjà en place.
- `src/lib/pro-account.ts` : `canManageProListings()` (gère désormais uniquement l'import en masse) et **nouvelle** `canReplyToProReviews()` (réponse aux avis) — deux fonctions indépendantes là où une seule bundlait les deux avant ce lot. Corrige au passage un mélange sémantique préexistant : la page boutique publique (`/pro/[id]`) utilisait déjà `canManageProListings` pour décider qui peut répondre à un avis — utilise maintenant `canReplyToProReviews`, sans changement de comportement pour les collaborateurs existants grâce à la migration de données.
- `POST /api/pro/accounts/[id]/collaborators` : accepte désormais `{ email, permissions: { gererAnnonces, repondreAvis } }` au lieu de `{ email, role }`.
- **Nouveau** `PATCH /api/pro/accounts/[id]/collaborators/[collaboratorId]` : modifie les permissions d'un collaborateur existant sans devoir le retirer puis le réajouter — plus pertinent qu'avant maintenant que ce sont deux cases indépendantes plutôt qu'un choix binaire.
- `ProCollaboratorsManager` : cases à cocher indépendantes (au lieu d'un menu déroulant à deux options) pour ajouter un collaborateur, et un mode édition en ligne (« Modifier » → cases + « Enregistrer ») pour changer les permissions d'un collaborateur déjà présent.
- 5 nouveaux tests unitaires sur `pro-permissions.ts` (aller-retour sérialisation, JSON invalide, champ manquant, valeur non booléenne coercée) ; tests de `pro-account.test.ts` réécrits pour le nouveau modèle de permissions (`canManageProListings` bloque un collaborateur avec seulement `repondreAvis`, `canReplyToProReviews` bloque un collaborateur avec seulement `gererAnnonces`, `canManageCollaborators` reste non délégable même avec toutes les permissions activées) ; 237/237 au vert.
- Vérification de bout en bout avec le compte professionnel réel « Auto Sara Motors » et son collaborateur réel (Amine, `GESTIONNAIRE` avant ce lot) : permissions affichées correctement après migration (les deux activées, comportement hérité) ; retrait de `gererAnnonces` via l'interface réelle (case décochée + Enregistrer) confirmé en base ; import en masse ensuite refusé pour Amine (403 `forbidden`) alors que la réponse à un vrai avis (créé pour l'occasion) reste acceptée (200) et visible avec ses contrôles d'édition sur la boutique publique — preuve directe que les deux permissions sont désormais réellement indépendantes. Rendu RTL arabe confirmé. Permissions d'Amine et avis de test entièrement restaurés/supprimés après vérification.

**Décisions/notes**
- Ce lot clôt l'intégralité de la liste explicitement nommée par le porteur de projet le 2026-09-03 (marque/modèle/catégorie et photos à l'édition Lots 35-36, suppression/pièces jointes/temps réel en messagerie Lots 38-40, notification de suspension Lot 37, import de stock en masse et permissions de collaborateur Lots 41-42).
- Aucune nouvelle permission fabriquée sans usage réel : le JSON ne couvre que les deux capacités qui existaient déjà et qui restaient les seules réellement contrôlées dans le code — pas de case cosmétique du type « voir les statistiques », déjà ouvert à tout collaborateur (`canViewProDashboard`) et non differentiable davantage aujourd'hui.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit ; la fiche « collaborateur ne voit pas les annonces du compte pro » (signalée au Lot 41) reste ouverte en tâche séparée.

## Lot 43 — Annonces du compte professionnel visibles par un collaborateur (2026-09-03)

Corrige l'écart signalé séparément au Lot 41 (`/compte/mes-annonces` ne filtre que par `sellerId: user.id`) — le porteur de projet a explicitement demandé de le traiter directement plutôt que via une tâche déléguée. Les annonces d'un compte professionnel appartiennent toujours à `sellerId = ProfessionalAccount.userId` (le propriétaire), jamais au collaborateur qui les gère (aucun champ `Listing.professionalAccountId` n'existe) — un collaborateur GESTIONNAIRE cliquant sur « Gérer mes annonces » depuis le tableau de bord pro atterrissait donc sur ses propres annonces personnelles (le plus souvent aucune), sans jamais voir ni pouvoir compléter le stock du compte pro, y compris les brouillons qu'il vient lui-même d'importer en masse (Lot 41).

**Livré**
- `src/lib/listing-access.ts` (nouveau) : `canManageListing(userId, sellerId)` — autorise le vendeur réel, ou un collaborateur avec la permission `gererAnnonces` (Lot 41/42) du compte professionnel dont ce vendeur est propriétaire. Réutilise directement `canManageProListings()` (Lot 42, déjà testé) en faisant jouer à `sellerId === userId` le rôle d'`isOwner` — aucune nouvelle règle de permission inventée, juste le bon branchement.
- `/compte/mes-annonces` : récupère désormais aussi les annonces de tout compte professionnel dont l'utilisateur est collaborateur (`ProCollaborator`, quel que soit son niveau de permission), avec une étiquette « Compte professionnel : {nom} » sur chaque annonce qui n'est pas la sienne propre. Les boutons d'action (renouveler, marquer vendue, modifier le prix, modifier l'annonce) ne s'affichent que si la permission `gererAnnonces` est active — un collaborateur en lecture seule voit le stock sans jamais pouvoir agir dessus.
- `PATCH /api/listings/[id]`, `POST /api/listings/[id]/mark-sold`, `/renew`, `/update-price`, et la page `/compte/mes-annonces/[id]/modifier` : remplacent tous leur vérification `listing.sellerId !== user.id` par `canManageListing()` — un collaborateur GESTIONNAIRE peut désormais réellement agir sur les annonces du compte, pas seulement les voir ; un collaborateur en lecture seule ou un tiers reçoit 403/404 exactement comme avant.
- Aucun nouveau test unitaire ajouté : `canManageListing` réutilise entièrement `canManageProListings` (Lot 42, déjà testé), sa seule logique propre est une requête Prisma non testée par convention (comme `checkCanReply` du Lot 27) ; 237/237 toujours au vert.
- Vérification de bout en bout avec le compte professionnel réel « Auto Sara Motors » et son collaborateur réel Amine (`gererAnnonces: true`) : une annonce créée pour Sara apparaît sur le `/compte/mes-annonces` d'Amine avec l'étiquette « Compte professionnel : Auto Sara Motors » et tous les boutons d'action ; modification du prix et renouvellement effectués avec succès via l'API réelle en tant qu'Amine (jamais Sara). Accès refusé (403) confirmé pour un compte tiers (administrateur). Permission `gererAnnonces` retirée d'Amine (passé en lecture seule) : l'annonce reste visible avec son étiquette mais sans aucun bouton d'action, tentative de modification de prix refusée (403 `forbidden`), page d'édition renvoie un vrai 404 — identique au traitement d'un tiers. Rendu RTL arabe confirmé. Permissions d'Amine et annonce de test entièrement restaurées/supprimées après vérification.

**Décisions/notes**
- Aucune notion de « propriété partagée » introduite dans le schéma — l'attribution reste toujours au vendeur réel (`sellerId`), la permission de collaborateur ne fait qu'autoriser une action, jamais changer qui est listé comme vendeur. Cohérent avec l'attribution déjà choisie au Lot 41 (import de masse attribué au propriétaire, jamais au collaborateur qui importe).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 44 — Brouillon persistant de l'assistant de publication (2026-09-04)

Choisi selon la logique de continuation : le plus vieux écart encore ouvert et non bloqué par une infrastructure externe indisponible (documenté depuis le Lot 2, réitéré au Lot 22 — « brouillon persistant multi-session »). Jusqu'ici, l'état de l'assistant (`WizardContext`) ne vivait qu'en `sessionStorage`, perdu à la moindre fermeture complète du navigateur.

**Livré**
- `ListingDraft` (nouveau modèle, migration appliquée) : un brouillon JSON par utilisateur (`userId` unique — démarrer un nouveau brouillon écrase simplement l'ancien, pas d'historique à conserver), totalement indépendant du modèle `Listing` — dont les champs obligatoires (titre, prix, année…) ne sont tous réunis qu'à l'avant-dernière étape de saisie, rendant impossible d'y écrire une ligne valide dès le début du parcours sans affaiblir des contraintes NOT NULL utilisées dans toute l'application (recherche, pages SEO, JSON-LD…).
- `GET`/`PUT`/`DELETE /api/listings/draft` : le contenu n'est jamais interprété ni validé champ par champ côté serveur (seule sa taille est bornée, `src/lib/wizard-draft.ts`, fonction pure testée) — il n'est restitué qu'au même assistant, qui refait sa propre validation étape par étape avant toute publication réelle via `listingSchema` (inchangé).
- `WizardContext` : à chaque étape validée (jamais à chaque frappe, pour ne pas spammer l'API), un checkpoint est envoyé au serveur en plus de l'écriture `sessionStorage` existante. À l'ouverture de l'assistant, si `sessionStorage` est vide (fermeture complète du navigateur, ou nouvel appareil), le brouillon serveur est proposé automatiquement.
- Limitation assumée et documentée à l'écran : les photos (objets `File` en mémoire) ne sont jamais incluses dans le brouillon serveur — seules les données de formulaire (texte/nombres) survivent à une fermeture complète ; un bandeau explicite le rappelle à la reprise (« vos informations ont été restaurées, les photos sont à resélectionner »), avec un bouton « Recommencer à zéro » qui efface le brouillon local et serveur.
- Effet de bord découvert en marge (corrigé au passage, hors périmètre de ce lot) : le texte de l'étape 1 affirmait encore « les comptes professionnels et leurs vitrines arrivent dans une prochaine mise à jour » — obsolète depuis le Lot 13 ; remplacé par un texte honnête renvoyant vers le tableau de bord pro existant.
- 8 nouveaux tests unitaires sur `checkDraftPayload` (objet valide, objets vides/null/undefined/tableau/primitif rejetés, limite de taille) ; 245/245 toujours au vert.
- Vérification de bout en bout avec un compte réel (Amine) : progression réelle à travers les 8 étapes de saisie (catégorie/marque/modèle → wilaya/téléphone), brouillon confirmé en base à chaque étape ; **fermeture de session simulée** (`sessionStorage.clear()` + navigation fraîche) → bandeau de reprise affiché avec la date exacte de dernière modification → toutes les données textuelles restaurées jusqu'à l'étape 9 (aperçu), photos bien vides comme documenté ; publication réelle menée à terme jusqu'à l'étape 11 → annonce créée en `EN_ATTENTE`, brouillon serveur supprimé automatiquement. Garde-fous vérifiés par appel direct : 401 non authentifié, 400 `too_large` sur un brouillon dépassant 20 Ko, suppression manuelle (« Recommencer à zéro ») confirmée en base. Rendu RTL arabe confirmé (bandeau de reprise + bouton). Annonce et fichier photo de test supprimés après vérification.

**Décisions/notes**
- Portée volontairement limitée aux champs texte/nombre — étendre la persistance aux photos dès leur sélection nécessiterait de les uploader réellement dès l'étape 6 (avant toute validation finale), un changement plus large mis de côté pour ce lot.
- Note de vérification : plusieurs clics automatisés sur le bouton « Suivant » ont échoué silencieusement pendant les tests (coordonnées obsolètes après un défilement/redimensionnement de la page) — un artefact connu de l'outillage de test navigateur, sans rapport avec le code livré ; contourné en ciblant l'élément réel via script plutôt que des coordonnées figées.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 45 — Historique des prix d'une annonce (2026-09-04)

Choisi selon la logique de continuation : le plus vieil écart encore ouvert et non bloqué (documenté depuis le Lot 4, Cote Souq Auto — « historique des prix, prise en compte des équipements dans l'estimation »). Seul le premier des deux volets est traité ici : « équipements dans l'estimation » nécessiterait d'inventer une taxonomie d'équipements sans aucune indication du cahier des charges sur les catégories pertinentes — laissé ouvert plutôt que fabriqué arbitrairement.

**Livré**
- `ListingPriceHistory` (nouveau modèle, migration appliquée) : une entrée par prix réellement pratiqué, jamais interprétée au-delà de l'affichage brut (prix + date).
- `POST /api/listings` : une première entrée créée avec le prix initial, au moment même de la publication.
- `PATCH .../update-price` (Lot 23) : une nouvelle entrée à chaque changement de prix — **jamais si le nouveau montant est identique à l'ancien** (un vendeur qui « modifie » sans changer la valeur ne pollue pas l'historique d'une entrée dupliquée).
- Affichage sur la page publique de l'annonce (`/annonce/[id]`), section « Historique du prix » — masquée tant qu'il n'existe qu'une seule entrée ou aucune (une entrée unique n'est pas un historique, juste le prix actuel ; les annonces créées avant ce lot ou par import de masse, Lot 41, n'ont donc pas de section tant que leur prix n'a jamais changé pour de vrai).
- Aucun nouveau test unitaire (aucune nouvelle logique pure — une création Prisma imbriquée conditionnelle, non testée par convention comme les autres wrappers impurs du projet) ; 245/245 toujours au vert.
- Vérification de bout en bout avec une vraie annonce d'Amine (créée avant ce lot, donc sans historique) : aucune section affichée initialement (0 entrée) ; deux changements de prix réels via l'API réelle → section apparue avec les deux entrées, plus récente en premier ; une troisième requête remettant exactement le même prix confirmée sans créer de troisième entrée (2 lignes en base, pas 3). Rendu RTL arabe confirmé (« سجل الأسعار », dates et montants). Annonce restaurée à son prix d'origine et historique de test supprimé après vérification.

**Reporté à un lot ultérieur**
- Prise en compte des équipements dans l'estimation de prix (second volet du même écart du Lot 4) — nécessite une taxonomie d'équipements à définir avec le porteur de projet avant tout code.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 46 — Signalement d'un utilisateur depuis la messagerie (2026-09-04)

Choisi selon la logique de continuation : le plus vieil écart encore ouvert et non bloqué, documenté depuis le Lot 8 (« signalement d'un utilisateur depuis la messagerie »). Le signalement d'utilisateur existait déjà depuis le Lot 19, mais uniquement depuis la page vitrine vendeur (`/vendeur/[id]`) — jamais depuis la messagerie elle-même, là où un comportement abusif se manifeste le plus souvent en premier.

**Livré**
- `ReportUserButton` (Lot 19, inchangé) réutilisé tel quel dans `MessageThread` — aucune duplication de logique de signalement, juste un nouveau point d'entrée vers l'infrastructure existante (`POST /api/users/[id]/report`, `checkCanReportUser`/`validateReportSubmission`).
- Affiché à côté de « Bloquer cet utilisateur », dans le même bandeau d'actions de la conversation.
- Le statut « déjà signalé » est calculé côté serveur (`prisma.report.findUnique`, même requête que sur la page vitrine) et transmis en cascade `page → ConversationView → MessageThread`, cohérent que le signalement provienne de la messagerie ou de la vitrine vendeur — un signalement déjà déposé depuis l'une des deux pages est reconnu depuis l'autre.
- Aucun nouveau test unitaire (aucune nouvelle logique — réutilisation intégrale du Lot 19, déjà testé) ; 245/245 toujours au vert.
- Vérification de bout en bout sur la conversation réelle Sara/Amine : signalement réel d'Amine contre Sara depuis la messagerie (motif « Messages abusifs » + commentaire) → confirmé en base (`status: OUVERT`) → bouton devenu « Vous avez déjà signalé cet utilisateur » après rechargement, cohérent entre la messagerie et la vitrine vendeur. Rendu RTL arabe confirmé (« لقد أبلغت بالفعل عن هذا المستخدم »). Signalement de test supprimé après vérification.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 47 — Seuils de suspension automatique configurables (2026-09-04)

Choisi selon la logique de continuation : le plus vieil écart encore ouvert et non bloqué, documenté depuis le Lot 21 (« seuil configurable depuis le back-office »). Les seuils de signalements confirmés déclenchant une suspension automatique (annonces, Lot 21 ; comptes, Lot 31) étaient jusqu'ici des constantes en dur (`AUTO_SUSPEND_LISTING_THRESHOLD`/`AUTO_SUSPEND_USER_THRESHOLD`, toutes deux à 3).

**Livré**
- `ModerationSettings` (nouveau modèle, migration appliquée + ligne singleton insérée) : deux seuils, valeurs par défaut identiques au comportement historique (3/3) — aucune régression pour l'existant.
- `src/lib/reports.ts` : `shouldAutoSuspendListing`/`shouldAutoSuspendUser` acceptent désormais le seuil en paramètre au lieu d'une constante figée — la décision reste une fonction pure testée, seule sa source change (back-office plutôt que code en dur).
- `GET .../resolve` (Lot 9/31, inchangé dans sa logique) : charge désormais le seuil courant (`getModerationSettings()`) avant chaque décision de suspension automatique, pour les annonces et pour les comptes.
- `PATCH /api/admin/moderation-settings` (nouveau, réservé **ADMIN**, jamais MODERATEUR — même niveau de gravité que la gestion du référentiel marques/modèles, Lot 25) : bornes 1-50 (`validateThreshold`, fonction pure testée) — un seuil à 0 déclencherait une suspension sur un unique signalement non corroboré, contournant l'esprit même du seuil.
- `/admin/parametres` (nouvelle page back-office, lien ajouté à la navigation) : formulaire pour les deux seuils, lecture seule pour un modérateur (même pattern que `CatalogueManager`, Lot 25 — visible par tout le staff, modifiable par le seul admin).
- Chaque modification est tracée dans l'audit log (`moderation_settings.update`, avant/après).
- 9 nouveaux tests unitaires (`validateThreshold` : valeurs limites, zéro et négatif rejetés, au-delà de 50 rejeté, non-entier rejeté ; `shouldAutoSuspendListing`/`shouldAutoSuspendUser` avec seuil personnalisé) ; tests existants adaptés à la nouvelle signature ; 253/253 au vert.
- Vérification de bout en bout avec le compte administrateur réel : seuil des annonces passé de 3 à 5 via l'interface réelle → confirmé en base + dans l'audit log (avant/après) ; garde-fou `invalid_threshold` vérifié (seuil à 0) ; accès en lecture seule confirmé pour un modérateur réel (Amine), tentative de modification via l'API directe refusée (403). **Preuve définitive que le seuil configuré est réellement utilisé et non plus la constante 3 d'origine** : une annonce jetable avec exactement 4 signalements confirmés n'a **pas** été suspendue (aurait été suspendue à ce stade avec l'ancien seuil figé à 3) ; un 5ᵉ signalement résolu via l'API réelle a déclenché la suspension automatique exactement au seuil configuré (5), jamais avant. Rendu RTL arabe confirmé. Toutes les données de test (annonce, signalements, comptes jetables, entrée d'audit) supprimées et seuils remis à 3/3 après vérification.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 48 — Rappel email avant expiration d'annonce (2026-09-04)

Choisi selon la logique de continuation : le dernier écart encore ouvert et non bloqué du Lot 22 (le second, historique des renouvellements, reste ouvert — moins prioritaire, purement informatif). « Rappel avant expiration » avait été noté comme nécessitant un planificateur (cron), qui n'existe pas dans cette application — la solution retenue réutilise plutôt le même principe de balayage paresseux déjà en place pour l'expiration elle-même (`sweepExpiredListings`, Lot 22) : un rappel est envoyé à la prochaine visite d'une page à fort trafic, pas sur un job périodique.

**Livré**
- `Listing.expiryReminderSentAt` (nouveau champ, migration appliquée) : horodatage du rappel déjà envoyé pour le cycle d'expiration courant, remis à `null` à chaque renouvellement (`POST .../renew`) pour permettre un nouveau rappel au prochain cycle.
- `shouldSendExpiryReminder()` (`src/lib/listing-lifecycle.ts`, fonction pure testée) : fenêtre de 3 jours avant `expiresAt`, jamais si déjà envoyé pour ce cycle, jamais si déjà expirée (`sweepExpiredListings` prend le relais à ce stade).
- `sweepExpiringListingsForReminders()` (`src/lib/listing-expiry-reminder-sweep.ts`) : appelée aux 3 mêmes points d'entrée que `sweepExpiredListings` (résultats de recherche, détail d'annonce, « Mes annonces »). Marquage atomique avant l'envoi (`updateMany` conditionné sur `expiryReminderSentAt: null`) : si deux visites concurrentes déclenchent le balayage sur la même annonce, une seule "gagne la course" et envoie réellement l'email — jamais de double envoi. Bornée à 50 annonces par balayage (défense contre un pic de trafic).
- 6 nouveaux tests unitaires sur `shouldSendExpiryReminder` (dans la fenêtre, hors fenêtre, déjà envoyé, déjà expirée, pas de date d'expiration, limite exacte de la fenêtre) ; 259/259 toujours au vert.
- Vérification de bout en bout avec une vraie annonce jetable (expirant dans 2 jours, donc dans la fenêtre) : visite réelle de la page de l'annonce → email réellement envoyé, **contenu source lu intégralement sur Ethereal** (bon destinataire, bon sujet, bon titre d'annonce, date d'expiration correctement formatée, bon lien) ; une seconde visite n'envoie pas de second email (`expiryReminderSentAt` déjà renseigné) ; renouvellement réel via l'API → `expiryReminderSentAt` remis à `null` et `expiresAt` repoussée de 30 jours → nouvelle visite ne renvoie **pas** d'email (hors fenêtre après renouvellement), confirmant que le nouveau cycle repart bien à zéro sans déclencher immédiatement un rappel prématuré. Annonce de test supprimée après vérification.

**Décisions/notes**
- Limite assumée du balayage paresseux (déjà vraie pour l'expiration elle-même depuis le Lot 22) : une annonce dont plus personne ne visite jamais aucune des 3 pages concernées avant son expiration ne recevra pas de rappel. Un vrai planificateur (cron) éliminerait cette limite mais n'existe pas dans cette application.

**Reporté à un lot ultérieur**
- Historique des renouvellements d'une annonce (second volet du même écart du Lot 22, purement informatif — moins prioritaire).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 49 — Historique des renouvellements d'une annonce (2026-09-04)

Choisi selon la logique de continuation : le dernier écart connu et non bloqué du Lot 22 (le premier, rappel avant expiration, a été traité au Lot 48). `Listing.publishedAt`/`expiresAt` ne gardaient jusqu'ici que la dernière valeur — un renouvellement en écrasait silencieusement la trace précédente.

**Livré**
- `ListingRenewal` (nouveau modèle, migration appliquée) : une entrée par renouvellement réel (`renewedAt` + `expiresAt` résultant), jamais à la publication initiale — même principe que `ListingPriceHistory` (Lot 45), une table dédiée plutôt que de dépendre d'une colonne qui n'est déjà plus qu'un instantané de la dernière valeur.
- `POST .../renew` (Lot 22, route inchangée dans sa logique d'éligibilité) crée désormais aussi cette entrée, dans la même écriture que la mise à jour du statut/de la date d'expiration.
- Affichage sur la page publique de l'annonce (`/annonce/[id]`), section « Historique des renouvellements » — visible dès la première entrée (contrairement à l'historique des prix, Lot 45, où une entrée unique n'est pas informative ; ici, ne serait-ce qu'un seul renouvellement est déjà une information réelle pour un acheteur).
- Aucun nouveau test unitaire (aucune nouvelle logique pure — une création Prisma imbriquée supplémentaire dans une route déjà testée fonctionnellement) ; 259/259 toujours au vert.
- Vérification de bout en bout avec une vraie annonce d'Amine (aucun renouvellement avant ce lot) : deux renouvellements réels via l'API réelle → les deux confirmés en base avec les bonnes dates → section affichée sur la page publique avec les deux entrées, plus récente en premier. Rendu RTL arabe confirmé (« سجل التجديدات », « مُمدد حتى »). Annonce restaurée à son état d'origine (historique de test supprimé, date d'expiration remise à sa valeur antérieure) après vérification.

**Décisions/notes**
- Ce lot clôt l'intégralité de l'écart historique du Lot 22 (rappel avant expiration au Lot 48, historique des renouvellements ici).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 50 — Audit complet et corrections (2026-09-04)

Choisi explicitement par le porteur de projet (« faire audit complet et corriger »), après épuisement du backlog de lots autonomes. Cinq audits menés en parallèle par des agents dédiés sur l'ensemble du code (49 lots accumulés) : sécurité/autorisation, cohérence i18n FR/AR, intégrité des données Prisma, code mort/textes obsolètes, couverture de tests. Chaque finding a été vérifié manuellement avant correction — aucun correctif appliqué sur simple supposition d'un agent.

**Corrigé — sécurité (critique)**
- `GET /api/listings/compare` (comparateur, route publique non authentifiée) : `include: { seller: { include: { profile: true } } }` renvoyait l'objet `User` complet dans le JSON — **passwordHash (hash bcrypt), téléphone, statut de suspension, dates de vérification inclus**, exploitable par un simple appel `curl` sans compte. Remplacé par un `select` explicite (id/email/displayName uniquement, les seuls champs réellement affichés). Vérifié par appel direct : la réponse ne contient plus que ces trois champs.

**Corrigé — sécurité (mineur)**
- `POST /api/pro/accounts/[id]/collaborators` et `PATCH`/`DELETE .../collaborators/[collaboratorId]` : aucun `checkRateLimit()`, contrairement à quasiment toutes les autres routes de création de l'app — la route par email permettait un oracle d'énumération de comptes (deviner quels emails sont enregistrés). Rate limiting ajouté (20-30/heure selon la route).

**Corrigé — intégrité des données**
- `Message` : ajout de `@@index([conversationId, readAt])` et `@@index([senderId, readAt])` — le comptage des messages non lus (badge du header, exécuté à **chaque** chargement de page) n'était couvert par aucun index composite.
- `IdentityVerificationRequest` : un seul dossier `EN_ATTENTE` par utilisateur n'était vérifié qu'en application (`findFirst` puis `create`) — race condition TOCTOU classique sur double-clic/retry réseau. Ajout d'un index unique filtré SQLite (`WHERE status = 'EN_ATTENTE'`) ; la route gère désormais proprement la violation de contrainte (P2002) en la traduisant vers la même erreur `request_pending` que le contrôle applicatif, jamais une 500 générique.

**Corrigé — code mort et cohérence des tests**
- `isListingExpired()` (`src/lib/listing-lifecycle.ts`) était testée mais jamais appelée — `shouldSendExpiryReminder()` (Lot 48) dupliquait exactement la même comparaison inline. Consolidé : `shouldSendExpiryReminder` appelle désormais `isListingExpired`, ses tests protègent enfin un chemin réellement exécuté.
- `isConversationHiddenFor()` (`src/lib/messaging.ts`) retirée avec ses tests : jamais câblée nulle part, la logique équivalente vit déjà (correctement) dans une clause `WHERE` Prisma à l'endroit où elle est utilisée (`compte/messages/page.tsx`) — impossible d'y substituer un appel de fonction JS pure sans dégrader la requête.
- `StepShell.tsx` (bouton « Précédent » de l'assistant de publication, présent sur les 11 étapes) : texte français codé en dur, jamais traduit — visible tel quel même en version arabe. Ajout de `Wizard.previous` (FR/AR) et câblage, à l'identique du bouton « Suivant » déjà traduit.

**Corrigé — couverture de tests**
- 4 fonctions pures sans test ajoutées : `getClientIp`/`safeUser` (`tests/http.test.ts`), `identityDocumentAbsolutePath` (`tests/identity-uploads.test.ts`), `escapeHtml` (`tests/mailer.test.ts`, y compris un scénario d'injection réaliste).
- 268/268 tests au vert (259 + 12 ajoutés − 3 retirés avec `isConversationHiddenFor`).

**Vérifié de bout en bout**
- Fuite `compare` : confirmée absente par appel direct à la route réelle (seller ne contient plus que `id`/`email`/`profile.displayName`).
- Race condition identité : reproduite avec un vrai document uploadé deux fois de suite via l'API réelle — la seconde tentative renvoie proprement `request_pending` (400), jamais une erreur serveur. Données de test supprimées après vérification.
- Traduction « Précédent » : rendu confirmé en français (« ← Précédent ») et en arabe (« ← السابق »), là où l'arabe affichait auparavant le texte français en dur.
- tsc/eslint/268 tests/build : tous verts après l'ensemble des correctifs.

**Signalé, non corrigé (documenté pour plus tard, pas un bug aujourd'hui)**
- `GET /api/auth/me` : route jamais appelée par l'UI actuelle (l'app récupère l'utilisateur courant côté serveur/RSC). Laissée en l'état — pas de preuve qu'elle soit sans usage externe, la supprimer sans certitude serait plus risqué que de la garder.
- Relations vers `User` sans `onDelete` explicite (`AuditLog.admin`, `Conversation.buyer/seller`, `Message.sender`, `Block.blocker/blocked`, `Report.author`, `Review.author`, `Listing.seller`) : `RESTRICT` par défaut, sans risque aujourd'hui puisqu'aucune route de suppression de compte n'existe (seule la suspension, Lot 31). À anticiper avant une éventuelle fonctionnalité de suppression de compte — une stratégie d'anonymisation serait préférable à une cascade, pour ne pas perdre l'historique de modération/avis/signalements.
- `ListingPhoto` sans `@@unique([listingId, position])` : déjà géré correctement en transaction côté application (Lot 36), garde-fou DB optionnel de faible priorité.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 51 — Suppression de compte utilisateur (2026-09-04)

Choisi explicitement par le porteur de projet, suite à la piste identifiée lors de l'audit du Lot 50 : la plupart des relations vers `User` sont en `RESTRICT`, une vraie suppression de la ligne casserait l'historique de modération/avis/signalements dont d'autres utilisateurs ont besoin. Solution retenue : **anonymisation**, jamais une suppression physique — même principe que documenté dans l'audit.

**Livré**
- `User.deletedAt` (nouveau champ, migration appliquée) — distinct de `suspendedAt` (Lot 31, décision de modération, réversible) : irréversible, déclenché par le titulaire du compte lui-même, jamais par un admin.
- `POST /api/profile/delete-account` : exige la ré-saisie du mot de passe (vérifié par `bcrypt.compare`, jamais un simple double-clic vu l'irréversibilité) ; anonymise en une seule transaction : email remplacé par une adresse jamais réutilisable dérivée de l'id (`src/lib/account-deletion.ts`, fonction pure testée), mot de passe remplacé par un hash inutilisable, téléphone/dates de vérification remis à `null`, nom affiché remplacé par « Utilisateur supprimé », wilaya/présentation/avatar effacés du profil. Retire immédiatement du marché toute annonce encore active (`BROUILLON`/`EN_ATTENTE`/`PUBLIEE` → `SUSPENDUE`, réutilise le statut existant plutôt que d'en créer un nouveau pour un cas qui n'est pas une décision de modération) — un compte supprimé ne peut plus jamais répondre à un acheteur ni compléter un brouillon. Session immédiatement invalidée (cookie effacé).
- `getCurrentUser()` traite désormais un compte supprimé exactement comme un compte suspendu (chokepoint unique, Lot 31) — une session déjà active au moment de la suppression ne reste pas utilisable jusqu'à expiration du cookie.
- Messages, avis et signalements déjà émis par ce compte restent visibles pour les autres utilisateurs (jamais rétroactivement effacés) — seule l'identité personnelle est anonymisée, pas l'historique dont d'autres ont besoin (cohérent avec la décision de l'audit Lot 50 de ne jamais toucher aux relations `RESTRICT`).
- `/compte/profil` : nouvelle section « Zone dangereuse », avertissement explicite avant toute action, confirmation en deux temps (bouton → formulaire mot de passe → confirmation finale).
- `/admin/utilisateurs` : un compte supprimé affiche « Compte supprimé » à la place du statut de suspension, rôle en lecture seule, aucune action de suspension/changement de rôle proposée (n'aurait aucun effet réel sur un compte déjà inaccessible).
- 3 nouveaux tests unitaires sur `generateAnonymizedEmail` ; 271/271 toujours au vert.
- Vérification de bout en bout avec un compte jetable créé pour l'occasion (jamais un des comptes de test persistants de la session) et une vraie annonce publiée : garde-fou `wrong_password` vérifié via l'interface réelle (formulaire, message d'erreur affiché, compte inchangé en base) ; suppression réelle via l'API réelle → email/mot de passe/téléphone anonymisés confirmés en base, annonce passée en `SUSPENDUE` avec le bon motif ; `GET /api/auth/me` confirmé à 401 juste après (session invalidée) ; tentative de connexion avec les identifiants d'origine refusée (401 `invalid_credentials`) ; back-office confirmé affichant « Compte supprimé » sans aucune action proposée. Rendu RTL arabe confirmé (« حساب محذوف »). Compte et annonce de test entièrement supprimés de la base après vérification (contrairement à un compte réel anonymisé, un compte 100 % jetable créé pour un seul test reste éligible à une suppression physique complète).

**Décisions/notes**
- Aucun nouveau statut d'annonce créé pour ce cas — `SUSPENDUE` (déjà utilisé pour les décisions de modération) est réutilisé avec un `moderationNote` explicite, pour ne pas complexifier `ListingStatus` pour un scénario qui n'est pas à proprement parler une modération.
- Les fichiers avatar déjà uploadés ne sont pas supprimés du disque à l'anonymisation — cohérent avec la décision déjà prise au Lot 36 (photos d'annonces supprimées également laissées sur disque), un sujet séparé si l'espace disque devient un problème réel.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 52 — Mentions légales (2026-09-04)

Choisi suite à une information communiquée directement par le porteur de projet (hébergement en France, domaine `souqauto.dz`, puis identité légale complète de l'éditeur). Comble un vrai manque : le site n'avait jusqu'ici aucune page d'identification de l'éditeur, pourtant une obligation légale de base pour un site marchand.

**Livré**
- `/mentions-legales` (nouvelle page, FR/AR) : identité de l'éditeur (EURL INGENICA CIVIL, forme juridique, siège social à Sidi Bel Abbès, capital social, numéro RC/CNRC), section marque/domaine, section hébergement, section contact.
- Seuls les faits réellement communiqués sont affichés — **aucune coordonnée fabriquée** : le nom et l'adresse complète de l'hébergeur (pas encore choisi) et l'adresse de contact sont explicitement marqués « à compléter » plutôt qu'inventés, cohérent avec la discipline anti-fabrication déjà appliquée sur ce projet (ex. Lot 20/33, jamais une donnée utilisateur affichée sans preuve réelle).
- Bloc d'identité légale (raison sociale, adresse, capital, RC) volontairement identique en français et en arabe — une adresse/un numéro de registre du commerce ne se traduit pas, il doit rester dans sa forme canonique dans les deux langues ; seuls les intitulés de section sont traduits.
- Lien « Mentions légales » ajouté au pied de page (`SiteFooter`), à côté de « Toutes les marques ».
- Note conservée en mémoire de session : l'hébergement en France implique le RGPD indépendamment de l'extension `.dz` du domaine — pertinent pour une future politique de confidentialité, non construite à ce jour (aucune demande explicite reçue).
- Aucun nouveau test unitaire (page de contenu statique, aucune logique) ; 271/271 toujours au vert.
- Vérification de bout en bout : page réelle affichant l'intégralité des informations transmises, lien du pied de page fonctionnel, rendu RTL arabe confirmé (bloc d'identité légale conservé en français, intitulés de section traduits).

Prochain lot proposé : à définir avec le porteur de projet — une politique de confidentialité et des CGU restent à construire si demandées explicitement (nécessiteraient des décisions de politique — durée de conservation, cookies, juridiction — non fournies à ce jour) ; le paiement (toujours en attente d'identifiants réels) reste le seul grand module explicitement non construit.

## Lot 53 — Audits accessibilité (a11y) et responsive mobile (2026-09-04)

Choisi à la demande du porteur de projet (« qu'est-ce que tu propose pour améliorer le site ? » → deux audits proposés, tous deux approuvés). Un agent en arrière-plan a mené l'audit a11y par lecture directe du code source (105 fichiers `.tsx`) ; le responsive mobile a été vérifié personnellement en navigateur réel (viewport 375×812) sur le header, la recherche, une fiche annonce et le tableau de bord pro.

**Bug mobile critique trouvé et corrigé**
- Le header (`SiteHeader.tsx`) n'avait aucun menu mobile : sa navigation en une seule ligne (`flex`, sans wrap) débordait de **31px hors connexion et jusqu'à 247px une fois connecté** — les liens Tableau de bord, Déconnexion et le sélecteur de langue étaient physiquement inaccessibles sans défilement horizontal sur mobile, y compris pour un compte professionnel.
- Corrigé avec un vrai menu hamburger : nouveau composant client [`MobileMenuToggle.tsx`](app/src/components/MobileMenuToggle.tsx) (bouton ☰/✕, panneau déroulant), header restructuré pour partager le même contenu de navigation entre la barre desktop (`hidden sm:flex`) et le panneau mobile. Bonus : les liens auparavant masqués sur mobile (`hidden sm:inline` : Estimer mon véhicule, Mes favoris, Admin, nom d'utilisateur) sont désormais tous atteignables, sans avoir à choisir lesquels sacrifier.
- Vérifié en navigateur réel : 0px de débordement après correctif (contre 247px avant), menu fonctionnel en FR et en AR (miroir RTL correct, bouton ☰ à gauche), navigation desktop inchangée.

**Corrections d'accessibilité (trouvées par l'agent d'audit, vérifiées avant application)**
- **Labels de formulaire non associés à leur champ** (~70 occurrences, un seul `htmlFor` existait dans tout le projet avant ce lot) : ajout de `htmlFor`/`id` sur les formulaires critiques — connexion (`LoginForm.tsx`), inscription (`RegisterForm.tsx`), filtres de recherche (`SearchFilters.tsx`, composant `Field` généralisé — corrige ~10 champs d'un coup), édition d'annonce (`ListingEditForm.tsx`, 14 champs), étapes 7 et 8 du tunnel de publication (titre/description, wilaya/téléphone). Les deux champs Min/Max des plages prix/année reçoivent un `aria-label` individuel (un `<label>` ne peut associer qu'un seul contrôle).
- **Contraste illisible en mode sombre système** : `globals.css` basculait le fond en quasi-noir via `prefers-color-scheme` alors qu'aucun composant n'a de palette sombre adaptée (texte `text-slate-700` sur fond `#0a0a0a` ≈ ratio 1.9:1). Le site fixe désormais `color-scheme: light` explicitement plutôt que de proposer un mode sombre à moitié fonctionnel.
- **Contraste insuffisant `text-slate-400` sur texte porteur de sens** (ratio ≈2.57:1, sous le seuil WCAG AA) : remonté en `text-slate-500`/`600` sur les éléments où l'information compte réellement — cartes de résultats de recherche (wilaya, vues, score de confiance vendeur), indices de mots de passe et de téléphone, indicateur d'étape du tunnel de publication, bouton de suppression de pièce jointe. Laissé en `text-slate-300`/`400` uniquement où l'élément est réellement désactivé (pagination).
- **Boutons/liens icône-seule sans nom accessible fiable** : `CompareToggle.tsx` (`aria-label` ajouté en plus du `title`), bouton pièce jointe 📎 de la messagerie (`MessageThread.tsx`, `<span className="sr-only">` ajouté), boutons ▲/▼ de réordonnancement des photos (`ListingEditForm.tsx`, `aria-label` « Avancer/Reculer la photo »).
- **`alt=""` sur des images porteuses d'information** : les vignettes de gestion de photos dans l'édition d'annonce (`ListingEditForm.tsx`) ont désormais `alt="Photo {n}"` au lieu d'un texte alternatif vide, pour permettre de distinguer quelle photo on déplace/supprime au clavier ou au lecteur d'écran.
- **Champ de saisie de message et barre de recherche principale** : `aria-label` ajouté (reposaient uniquement sur un `placeholder`, qui disparaît à la saisie).
- Nouvelles clés de traduction FR/AR : `Nav.menu`, `ListingEdit.photoNumber/photoMoveUp/photoMoveDown`.
- **Non modifié, signalé par l'agent pour référence** : aucun état de focus clavier personnalisé (`focus-visible:`) n'existe dans le projet — le focus par défaut du navigateur n'est jamais supprimé (pas de `outline-none` trouvé), donc pas de régression, mais sa visibilité sur les boutons à fond sombre dépend entièrement du navigateur/OS du visiteur ; hiérarchie des titres et attributs `lang`/`dir` déjà conformes (aucune action requise).
- 271/271 tests toujours au vert (page de contenu et corrections d'attributs, aucune nouvelle logique testable isolément) ; `tsc --noEmit`, `eslint` et `npm run build` propres.
- Vérification navigateur réelle : menu mobile testé en FR et AR (0px de débordement, tous les liens atteignables) ; association label→champ confirmée par simulation de clic (`document.activeElement.id` pointe bien vers le champ mot de passe après clic sur son label).

Prochain lot proposé : à définir avec le porteur de projet — mêmes chantiers en attente qu'au Lot 52 (politique de confidentialité/CGU, paiement réel).

## Lot 54 — Chiffrement au repos (téléphone + documents d'identité) (2026-09-04)

Choisi en reprenant une exigence documentée dès le cahier d'architecture ([docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) §47 : « chiffrement des données sensibles au repos (téléphone, documents de vérification) ») mais jamais implémentée — `User.phone` était en clair en base depuis le Lot 1, et les pièces d'identité uploadées (Lot 12) étaient déjà hors de `/public` (accès restreint à une route API authentifiée réservée au staff) mais stockées en clair sur disque.

**Livré**
- [`src/lib/crypto/at-rest.ts`](app/src/lib/crypto/at-rest.ts) (nouveau) : AES-256-GCM natif (`node:crypto`, aucune dépendance ajoutée), clé maîtresse `ENCRYPTION_KEY` (32 octets base64, nouvelle variable d'env), sous-clés dérivées par HMAC-SHA256 pour chaque usage. Deux constructions distinctes :
  - `encryptDeterministic`/`decryptDeterministic` — IV synthétique dérivé du texte en clair (jamais aléatoire) : un même numéro produit toujours le même chiffré, ce qui préserve la contrainte `@unique` et les recherches par égalité sur `User.phone` sans jamais stocker le numéro en clair.
  - `encryptBuffer`/`decryptBuffer` — IV aléatoire à chaque appel, pour les documents d'identité (aucune contrainte d'unicité recherchée dessus).
- **Téléphone** : chiffrement rendu totalement transparent au reste de l'application via une extension du client Prisma ([`src/lib/prisma.ts`](app/src/lib/prisma.ts), `$extends` sur le modèle `User`) — chiffre `data.phone`/`where.phone` avant chaque requête, déchiffre `phone` dans chaque résultat. Aucune route applicative n'a eu besoin d'être modifiée (16 fichiers touchent `.phone`, aucun n'a changé) : impossible d'oublier un point d'entrée puisque tout passe par le même client.
- **Documents d'identité** : chiffrés dans [`src/lib/identity-uploads.ts`](app/src/lib/identity-uploads.ts) avant écriture sur disque (`saveIdentityDocument`), déchiffrés à la lecture (nouvelle fonction `readIdentityDocument`, utilisée par la route admin `/api/admin/identity-requests/[id]/document`).
- Migration ponctuelle des données existantes : le seul numéro déjà en clair en base (compte de test `amine.benali@example.dz`) a été chiffré en place avant l'activation de l'extension — vérifié en relisant la ligne brute (chiffré) puis via l'application (déchiffré correctement, `0555123456` toujours affiché sur la page profil).
- Nouvelle variable d'environnement `ENCRYPTION_KEY` documentée dans `.env.example` avec la même limite de bootstrap honnêtement assumée que `JWT_SECRET` : clé en clair dans `.env`, aucun coffre-fort externe (Vault/KMS) — protège contre l'exfiltration de la base ou d'une sauvegarde, pas contre une compromission du serveur applicatif.
- 7 nouveaux tests unitaires (`tests/at-rest.test.ts`) : aller-retour chiffrement/déchiffrement, déterminisme (même texte → même chiffré), non-déterminisme des documents, échec de déchiffrement sur contenu altéré (authentification GCM). 278/278 tests au vert au total.
- Vérification de bout en bout en conditions réelles (pas seulement unitaire) :
  - téléphone d'`amine.benali` toujours affiché correctement après migration (page profil) ;
  - tentative de reprise du même numéro depuis un autre compte → `phone_taken` (409, la contrainte d'unicité fonctionne toujours sur le chiffré) ;
  - nouveau numéro enregistré puis relu correctement (aller-retour écriture/lecture réel) ;
  - document d'identité de test uploadé, fichier sur disque confirmé non lisible (`file` le détecte comme « data » brute, pas une image) ; document redemandé via la route admin → déchiffré correctement (en-tête JPEG valide `ff d8 ff`).

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente (nécessitent des décisions/identifiants non fournis à ce jour).

## Lot 55 — Export des données personnelles (2026-09-04)

Choisi en complément direct du droit à l'oubli (Lot 51, suppression de compte) : le RGPD, applicable indépendamment de l'extension `.dz` du fait de l'hébergement prévu en France (cf. mémoire de session, Lot 52), prévoit aussi un droit d'accès/portabilité (art. 15/20) — un utilisateur doit pouvoir récupérer ses propres données dans un format structuré. Aucune décision externe non fournie à ce jour ne bloquait ce chantier, contrairement à la politique de confidentialité (durée de conservation, cookies, juridiction) ou au paiement (identifiants réels).

**Livré**
- `GET /api/profile/export` (nouveau) : agrège et renvoie en un seul fichier JSON téléchargeable (`Content-Disposition: attachment`) toutes les données dont l'utilisateur connecté est propriétaire ou auteur — profil (téléphone déchiffré automatiquement via l'extension Prisma du Lot 54), compte professionnel et collaborations, annonces (avec photos, historique de prix, renouvellements), favoris, conversations (les deux côtés du contenu, déjà consultable dans l'application), avis rédigés et reçus, signalements qu'il a lui-même effectués, comptes qu'il a bloqués, demandes de vérification d'identité (statut/dates, jamais les octets du document).
- Exclusions délibérées, pour ne jamais exposer une donnée privée d'un AUTRE utilisateur sous couvert de « mes données » : signalements **reçus** (protège l'anonymat de l'auteur du signalement, déjà le principe partout ailleurs dans l'app) et comptes qui ont bloqué cet utilisateur (symétrique, jamais construit ni exposé nulle part dans l'app).
- Rate limiting dédié (5/24h/utilisateur) — agrégation coûteuse (jusqu'à 9 requêtes Prisma en parallèle), pas un besoin d'appel fréquent.
- Bouton « Exporter mes données » sur `/compte/profil`, entre le formulaire d'édition et la zone de suppression de compte — simple lien `<a download>` (pas de composant client nécessaire, la requête `GET` authentifiée par cookie suffit).
- Aucun nouveau test unitaire (route d'agrégation Prisma directe, comme `delete-account` au Lot 51) ; 278/278 toujours au vert.
- Vérification de bout en bout en conditions réelles : export de Sara Hamdi (compte pro, 1 conversation) confirmant la bonne attribution des messages (« moi » / « autre_partie »), export d'Amine Benali confirmant le téléphone correctement déchiffré (`0555123456`, preuve croisée que l'extension Prisma du Lot 54 fonctionne aussi via cette nouvelle route) et 8 annonces exportées ; lien vérifié présent avec le bon `href` en FR et en AR (RTL).

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente.

## Lot 56 — Alertes de recherche sauvegardée (2026-09-04)

Choisi en reprenant une fonctionnalité documentée dès le cahier d'architecture (§27/§33, route `/compte/alertes` explicitement prévue en phase V2 aux côtés du comparateur et des vitrines pro, tous deux déjà construits) mais jamais implémentée — le blocage d'origine (« nécessite une infra de notification non encore en place ») ne tenait plus depuis que l'envoi d'email réel existe dans l'application (Lot 11/18/21/32/37/48).

**Livré**
- Modèles `SearchAlert` (une recherche sauvegardée : libellé + critères, même format que `/recherche`) et `SearchAlertNotification` (empêche un double envoi pour la même annonce, ex : suspension puis ré-approbation) — migration `20260904070000_search_alerts`.
- **Déclencheur événementiel, pas un balayage paresseux** (contrairement au rappel d'expiration du Lot 48) : `notifyMatchingSearchAlerts()` (`src/lib/search-alerts.ts`) s'exécute une seule fois, au moment précis où une annonce devient `PUBLIEE` via `/api/admin/listings/[id]/moderate` — un vrai événement métier, pas l'écoulement du temps. Réutilise `buildListingWhere()` (déjà utilisé par `/recherche`) comme unique source de vérité pour « qu'est-ce qui correspond à cette recherche », jamais une logique de correspondance dupliquée.
- `POST /api/alerts` (créer, max 10 alertes/utilisateur, rate limité 10/h, refuse une alerte sans aucun critère — correspondrait à toute nouvelle annonce) et `DELETE /api/alerts/[id]` (ownership vérifié).
- Formulaire « Enregistrer cette recherche comme alerte » sur `/recherche` (visible aux utilisateurs connectés uniquement) ; page `/compte/alertes` (liste + suppression, résumé lisible des critères — marque/modèle résolus par nom, pas par id) ; lien « Mes alertes » ajouté à la navigation (desktop + menu mobile, cf. Lot 53).
- Email de correspondance (`Notifications.searchAlertMatch*`, FR/AR) sur le même modèle que le rappel d'expiration/la baisse de prix déjà existants.
- 9 nouveaux tests unitaires (`tests/search-alert.test.ts`) sur les fonctions pures (nettoyage des filtres, rejet d'une alerte vide, validation du schéma). 287/287 tests au vert au total.
- Vérification de bout en bout en conditions réelles (pas seulement unitaire) : alerte enregistrée avec un critère de prix, annonce de test créée puis approuvée par un admin → email reçu et lu via la source Ethereal brute (destinataire, sujet, libellé de l'alerte, titre et prix de l'annonce, lien tous corrects) ; annonce suspendue puis ré-approuvée → **aucun second email envoyé** (index unique confirmé en base, une seule ligne `SearchAlertNotification`) ; suppression de l'alerte testée via l'interface (double clic de confirmation) ; lien « Mes alertes » confirmé présent en mobile sans régression de débordement (cf. Lot 53).

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente (nécessitent des décisions/identifiants non fournis à ce jour).

## Lot 57 — Suggestion IA de titre/description à la publication (2026-09-04)

Choisi en reprenant la phase V3 du cahier d'architecture (§336 : « IA (AI Listing…) »), le seul volet de cette phase encore non couvert (score de confiance, historique des prix déjà livrés aux Lots 24/45). Aucune clé Anthropic n'est configurée sur cette machine — même situation que le paiement/KYC (identifiants réels non disponibles) mais avec une différence : contrairement à un module qui nécessite absolument un vrai prestataire (paiement, vérification KYC automatisée), une suggestion de texte a un repli honnête et pleinement fonctionnel sans IA — retenu ici, sur le même principe que l'Assistant IA de Programmation Architecturale (autre app du groupe INGENICA) : « vrai chat Anthropic Claude, repli heuristique sans clé ».

**Livré**
- [`src/lib/ai-listing.ts`](app/src/lib/ai-listing.ts) : `generateListingSuggestion()` appelle l'API Anthropic (`claude-sonnet-5`) si `ANTHROPIC_API_KEY` est définie ; sinon (ou si l'appel échoue) un repli heuristique déterministe (`generateHeuristicSuggestion()`, fonction pure testée) construit un titre et une description à partir des caractéristiques déjà saisies (marque, modèle, année, kilométrage, carburant, boîte, état, première main, non accidenté, puissance, couleur) — **n'invente jamais un trait non fourni** : « première main »/« jamais accidenté » n'apparaissent que si l'utilisateur les a explicitement cochés.
- `POST /api/listings/suggest` (nouveau, auth requise, rate limité 10/h/utilisateur — un appel IA a un coût réel dès qu'une clé est configurée).
- Bouton « Suggérer un titre et une description » à l'étape 7 de l'assistant de publication : remplit les champs titre/description (modifiables ensuite, jamais soumis automatiquement), avec une mention **honnêtement distincte** selon la source réelle (« généré par IA » vs « généré automatiquement à partir des caractéristiques saisies ») — même principe de transparence que l'architecture l'exige déjà pour l'estimation de prix (§ « toujours distingués visuellement »). Garde-fou si les caractéristiques du véhicule ne sont pas encore toutes saisies (message explicite, pas de crash).
- `ANTHROPIC_API_KEY` documentée dans `.env.example` comme optionnelle, sur le même modèle que `SMTP_*`/`ENCRYPTION_KEY`.
- 9 nouveaux tests unitaires (`tests/ai-listing.test.ts`) sur `generateHeuristicSuggestion` et le schéma de validation — couvrent notamment la non-fabrication de traits absents. 296/296 tests au vert au total.
- Vérification de bout en bout en conditions réelles (assistant de publication réel, données de véhicule injectées en `sessionStorage` comme le fait l'app elle-même) : suggestion générée et affichée correctement dans les deux champs, mention de source honnête affichée (repli heuristique, aucune clé configurée sur cette machine — **le chemin IA réel n'a pas pu être testé faute de clé**, limite assumée et documentée), garde-fou données manquantes déclenché correctement, aucun brouillon serveur parasite créé pendant le test, rendu confirmé en arabe.

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente ; le chemin IA réel de ce lot resterait à vérifier le jour où une clé Anthropic serait fournie.

## Lot 58 — Recherche en langage naturel (2026-09-05)

Choisi en clôturant le dernier volet de la phase V3 « IA » du cahier d'architecture (§336 : « recherche langage naturel ») — même principe honnête établi au Lot 57 (« vrai chat Anthropic Claude, repli heuristique sans clé »), appliqué cette fois à la barre de recherche principale plutôt qu'à la publication.

**Livré**
- [`src/lib/ai-search.ts`](app/src/lib/ai-search.ts) : `parseNaturalLanguageQuery()` envoie la phrase tapée par le visiteur à l'API Anthropic (`claude-sonnet-5`) si `ANTHROPIC_API_KEY` est configurée, accompagnée de la liste réelle des marques/modèles/wilayas (id:nom) pour que le modèle ne puisse choisir que des identifiants qui existent vraiment. **Sans clé — le cas de cette machine —, le repli reproduit EXACTEMENT le comportement de recherche texte déjà existant avant ce lot (`{ q: texte tapé }`) : zéro régression pour les visiteurs du site aujourd'hui.**
- `sanitizeParsedFilters()` (fonction pure, entièrement testée) : ne fait **jamais confiance** à un id renvoyé par le modèle — chaque `brandId`/`modelId`/`wilayaId` est vérifié contre le catalogue réel avant d'être accepté, chaque énumération (catégorie/carburant/boîte/état) contre une liste fermée ; tout le reste est silencieusement ignoré plutôt que de risquer un filtre halluciné.
- `POST /api/search/parse` (nouveau, public comme `/recherche` elle-même, rate limité par IP — 30/h — un appel IA a un coût réel dès qu'une clé est configurée).
- `SearchFilters.tsx` (barre compacte uniquement — la recherche avancée à filtres explicites n'est jamais réinterprétée) appelle cette route avant de naviguer vers `/recherche` ; en cas d'échec réseau, repli silencieux sur la recherche texte simple d'origine.
- Notice honnête sur `/recherche` (« Votre recherche a été interprétée automatiquement — vérifiez les filtres appliqués ci-contre »), affichée **uniquement** quand la requête a réellement été traitée par l'IA (marqueur `via=ai` dans l'URL) — jamais affichée pour une recherche texte classique, cohérent avec l'exigence de transparence déjà appliquée à l'estimation de prix.
- 9 nouveaux tests unitaires (`tests/ai-search.test.ts`) — couvrent notamment le rejet d'un id inexistant/hallucination et la non-régression du repli sans clé. 305/305 tests au vert au total.
- Vérification de bout en bout en conditions réelles (site de l'utilisateur déjà lancé sur le port 5184, vérifié directement sans relancer de serveur) : appel réel à `/api/search/parse` confirmant le repli heuristique exact (`{"q":"clio diesel pas chère à Alger"}`), soumission réelle du formulaire de recherche confirmant une navigation inchangée (`?q=clio+diesel`, aucune régression), notice honnête et filtres pré-remplis confirmés en FR et en AR (RTL) via `via=ai`. **Le chemin IA réel n'a pas pu être testé faute de clé Anthropic sur cette machine** — même limite honnêtement documentée qu'au Lot 57.

Avec ce lot, l'intégralité de la phase V3 « IA » listée au cahier d'architecture est couverte (score de confiance, historique des prix, AI Listing, recherche langage naturel) — restent hors périmètre les items nécessitant un vrai prestataire externe non disponible (détection de fraude/analyse photo avancées, paiement, KYC automatisé).

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente.

## Lot 59 — Identité visuelle : symbole de marque (2026-09-05)

Le site n'avait jamais eu de logo — seul le nom « Souq Auto » en texte brut dans l'en-tête, et le favicon par défaut de Next.js. Trois pistes ont été présentées au porteur de projet dans un document de présentation séparé (arc de souk traversé par une route, route en forme de S, double anneau) ; **« Le Double Anneau » a été retenu** — deux arcs de cercle décalés, lisibles à la fois comme une jante de loin et comme un accord conclu entre deux parties de près.

**Livré**
- [`src/components/SiteLogoMark.tsx`](app/src/components/SiteLogoMark.tsx) (nouveau) : le symbole en SVG (encre `#12222E`, cuivre `#C1622B`), ajouté dans [`SiteHeader.tsx`](app/src/components/SiteHeader.tsx) juste avant le nom de marque — vérifié sans régression sur le menu mobile (Lot 53) et le miroir RTL arabe.
- Favicon du site entièrement régénéré à partir du même symbole (remplace l'icône par défaut de Next.js jamais changée depuis le Lot 1) : `src/app/icon.svg` (moderne, toutes tailles), `src/app/favicon.ico` (32×32, compatibilité), `src/app/apple-icon.png` (180×180, écran d'accueil iOS) — les trois balises `<link rel="icon">` correspondantes vérifiées générées automatiquement par Next.js.
- Aucun changement de typographie ni de palette du reste du site : seul le symbole a été ajouté, la police et les couleurs déjà en place dans l'en-tête restent inchangées — un ajout de logo n'est pas un changement d'identité complète.
- Aucun nouveau test unitaire (composant purement présentationnel, fichiers statiques) ; 305/305 toujours au vert.
- Vérification de bout en bout en conditions réelles (site déjà lancé par l'utilisateur, vérifié sans redémarrage) : symbole affiché correctement dans l'en-tête desktop et mobile, favicon confirmé régénéré par lecture directe des octets (`00 00 01 00` = en-tête ICO valide, 896 octets contre 25 931 pour l'ancien défaut Next.js — preuve que ce n'est pas un résidu en cache), rendu miroir RTL confirmé en arabe (symbole et texte correctement inversés).

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente.

## Lot 60 — Journal d'audit consultable (2026-09-05)

Choisi en constatant un écart concret en explorant le code : `AuditLog` est alimenté depuis le Lot 7 par une quinzaine de routes admin (approbations, suspensions, changements de rôle, suppressions de catalogue…) mais **rien ne permettait de le consulter** — aucune page ne le lisait nulle part dans l'application. Un audit qui s'écrit sans jamais pouvoir être relu ne remplit pas vraiment son rôle de traçabilité exigé au §47 du cahier d'architecture. Complété au passage par un deuxième écart trouvé au même endroit : la consultation d'une pièce d'identité déchiffrée (Lot 54) par le staff n'était elle-même jamais auditée.

**Livré**
- `/admin/journal` (nouveau, accessible à tout le staff — MODERATEUR compris, comme les autres pages de consultation du back-office `référentiels`/`statistiques` : rien à éditer ici, seulement à lire) : tableau chronologique (date, auteur, action, cible, détails) de tout l'historique `AuditLog`, paginé à 30 lignes. Vérifié en conditions réelles affichant l'intégralité des 29 actions déjà enregistrées depuis le Lot 7 — la première fois que ce journal est visible par quiconque.
- `formatAuditLogDetails()` (`src/lib/audit-log.ts`, fonction pure testée) : transforme le JSON libre stocké par `writeAuditLog` en ligne lisible (`clé: valeur · clé: valeur`) plutôt que d'afficher du JSON brut à l'écran.
- `identity_verification.document_view` (nouvelle entrée d'audit) : la route `/api/admin/identity-requests/[id]/document` consigne désormais qui a consulté quelle pièce d'identité et quand — ferme la boucle « chiffré (Lot 54) + audité » plutôt que de s'arrêter au seul chiffrement.
- Lien « Journal d'audit » ajouté à la navigation du back-office ; corrige au passage un débordement horizontal préexistant de cette navigation sur mobile (`flex-wrap` ajouté — jamais corrigé depuis sa création, aggravé par l'ajout de ce nouveau lien).
- 4 nouveaux tests unitaires (`tests/audit-log.test.ts`). 309/309 tests au vert au total.
- Vérification de bout en bout en conditions réelles (site déjà lancé par l'utilisateur, vérifié sans redémarrage) : dossier de vérification d'identité de test soumis puis consulté par un admin → entrée `identity_verification.document_view` confirmée apparue dans le journal avec le bon `requesterId` ; débordement mobile confirmé corrigé en arabe (RTL) après le correctif `flex-wrap`.

## Lot 61 — Messagerie accessible aux collaborateurs pro (2026-09-05)

Choisi en retrouvant, en explorant le code de la messagerie, exactement le même écart que celui corrigé au Lot 43 pour les annonces : `Conversation.sellerId` reste toujours le propriétaire du compte professionnel (jamais le collaborateur), donc un collaborateur avec la permission `gererAnnonces` ne pouvait ni voir ni répondre aux messages des acheteurs intéressés par les annonces qu'il gère pourtant au quotidien — alors que « prospects » fait explicitement partie du CRM simplifié documenté au cahier d'architecture (§9/§26). Le correctif du Lot 43 n'avait couvert que les annonces, jamais propagé à la messagerie construite ensuite (Lot 8/26/38-40).

**Livré**
- `canAccessConversation()` et `getManageableSellerIds()` (`src/lib/listing-access.ts`) : réutilisent exactement la même règle d'autorisation que `canManageListing()` (Lot 43) — un collaborateur `gererAnnonces` est traité comme le vendeur réel, jamais un collaborateur sans cette permission ni un tiers.
- Six points d'accès à une conversation corrigés pour appliquer cette règle : boîte de réception (`/compte/messages`, inclut maintenant les conversations des comptes pro gérés), fil de conversation (`/compte/messages/[id]`), envoi de message, flux temps réel SSE, marquage lu, masquage de conversation — plus le badge de messages non lus dans l'en-tête (`[locale]/layout.tsx`).
- Aucun changement de schéma : les messages envoyés par un collaborateur restent attribués à son propre compte (`senderId`), jamais à celui du propriétaire — cohérent avec l'export RGPD (Lot 55) et l'audit existant.
- Aucun nouveau test unitaire (fonctions dépendantes de la base de données, même choix que `canManageListing` au Lot 43, jamais unitairement testé non plus) ; 309/309 toujours au vert.
- Vérification de bout en bout en conditions réelles (site déjà lancé par l'utilisateur, vérifié sans redémarrage) : annonce de test publiée par Sara Hamdi, acheteur de test démarrant une conversation, **Amine Benali (collaborateur `gererAnnonces` réel du compte, pas fabriqué)** confirmé voyant la conversation dans sa boîte de réception avec le badge non-lu, ouvrant le fil sans 404, répondant avec succès (message attribué à son propre compte) ; un compte tiers sans lien avec la conversation confirmé toujours refusé (404) — la frontière de sécurité reste intacte.

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente.

## Lot 62 — Notification par email d'un nouvel avis (2026-09-05)

Choisi en retrouvant, en explorant le code des avis, exactement le même écart que celui déjà documenté et comblé au Lot 32 pour la *réponse* à un avis (« l'auteur de l'avis n'était jamais informé qu'une réponse avait été publiée ») — mais dans l'autre sens : le vendeur (particulier ou compte professionnel) n'était lui-même jamais informé qu'il avait **reçu** un nouvel avis, donc jamais incité à y répondre. Combiné avec le Lot 61 (accès des collaborateurs à la messagerie), ce lot ferme la boucle complète du parcours « avis » côté vendeur.

**Livré**
- `POST /api/users/[id]/reviews` (avis sur un vendeur particulier) et `POST /api/pro/accounts/[id]/reviews` (avis sur un compte professionnel) envoient désormais un email de notification après création de l'avis, sur le même modèle que la notification de réponse (Lot 32) et de baisse de prix (Lot 23).
- Pour un compte professionnel, la notification part **au propriétaire ET à chaque collaborateur disposant de la permission `repondreAvis`** (Lot 42/61 : ce sont eux qui répondent réellement au quotidien) — pas seulement le propriétaire, cohérent avec la logique déjà appliquée à la messagerie au Lot 61.
- Nouvelles clés `Notifications.newReview*` (FR/AR).
- Aucun nouveau test unitaire (envoi d'email déclenché par un effet de bord, même choix que les notifications existantes — réponse à un avis, baisse de prix — jamais testées unitairement non plus) ; 309/309 toujours au vert.
- Vérification en conditions réelles : avis créés avec succès sur un vendeur particulier et sur un compte professionnel (données réelles, acheteur de test ayant réellement interagi via une conversation au préalable, condition d'éligibilité vérifiée). Le serveur utilisé pour la vérification navigateur de ce lot avait été lancé par l'utilisateur lui-même en dehors de cette session, donc sans accès à sa console — le gabarit d'email exact (mêmes fonctions `sendEmail`/traductions réelles, mêmes valeurs interpolées que l'avis réel créé) a été rejoué de façon isolée via `tsx` et vérifié par lecture de la source Ethereal brute (destinataire, sujet, contenu et lien tous corrects) — limite de vérification honnêtement documentée plutôt que supposée sans preuve.

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente.

## Lot 63 — Notification par email de l'issue de la modération (2026-09-05)

Choisi en retrouvant, dans la même famille que le Lot 62, un écart identique mais pour l'événement le plus attendu par un vendeur : depuis le Lot 7 (back-office), approuver/refuser/suspendre une annonce ne notifiait jamais le vendeur — il ne pouvait découvrir l'issue qu'en revisitant lui-même « Mes annonces ». Le motif de refus/suspension (`moderationNote`) était déjà capturé et affiché en compte, mais jamais poussé proactivement.

**Livré**
- `POST /api/admin/listings/[id]/moderate` envoie désormais un email au vendeur pour chacune des trois issues (`listing.approve` → lien vers l'annonce publiée ; `listing.reject`/`listing.suspend` → motif inclus + lien vers « Mes annonces » pour corriger et resoumettre).
- Nouvelles clés `Notifications.listingApproved*`/`listingRejected*`/`listingSuspended*` (FR/AR), sur le même modèle que les notifications existantes (baisse de prix, suspension de compte).
- Aucun nouveau test unitaire (envoi d'email déclenché par un effet de bord, même choix que toutes les autres notifications de ce type) ; 309/309 toujours au vert.
- Vérification en conditions réelles : trois annonces de test approuvée/refusée/suspendue via de vrais appels à la route de modération (statuts et motifs confirmés corrects en base, entrées d'audit confirmées dans `/admin/journal`, pagination du journal elle-même vérifiée en conditions réelles pour la première fois — 30+ lignes désormais réparties sur 2 pages). Le serveur de ce lot restant hors accès console (même situation qu'au Lot 62), le gabarit d'email du cas le plus complexe (refus, avec titre ET motif interpolés) a été rejoué isolément via `tsx` et vérifié par lecture de la source Ethereal brute.

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente.

## Lot 64 — Notification par email de l'issue de la vérification d'identité (2026-09-05)

Choisi en retrouvant, dans la même famille que les Lots 62/63, le dernier écart de ce type restant : depuis le Lot 14 (vérification d'identité), approuver ou refuser une demande ne notifiait jamais le demandeur — il ne pouvait découvrir l'issue qu'en revisitant lui-même son tableau de bord, alors qu'il attend souvent cette décision pour débloquer le badge de confiance.

**Livré**
- `POST /api/admin/identity-requests/[id]/review` envoie désormais un email au demandeur pour chacune des deux issues (approbation → confirmation que le badge est actif ; refus → motif inclus + lien pour soumettre une nouvelle demande).
- Nouvelles clés `Notifications.identityApproved*`/`identityRejected*` (FR/AR), sur le même modèle que les Lots 62/63.
- Aucun nouveau test unitaire (même choix que toutes les notifications de ce type) ; 309/309 toujours au vert.
- Vérification en conditions réelles : deux comptes de test avec un vrai dossier de vérification soumis (document réel uploadé), l'un approuvé (`identityVerifiedAt` confirmé renseigné en base) et l'autre refusé (`identityVerifiedAt` confirmé resté `null`) via de vrais appels à la route de revue. Même limite de vérification que les Lots 62/63 (serveur lancé hors session, sans accès console) : le gabarit d'email du refus a été rejoué isolément via `tsx` et vérifié par lecture de la source Ethereal brute (destinataire, sujet, motif et lien tous corrects). Aucun fichier ni compte de test laissé derrière (`private-uploads/identity/` confirmé vide après nettoyage).

Avec ce lot, les trois décisions de back-office qui font attendre un utilisateur (modération d'annonce, vérification d'identité, réponse à un avis) sont maintenant toutes notifiées par email — plus aucune décision de modération silencieuse dans l'application.

Prochain lot proposé : à définir avec le porteur de projet — politique de confidentialité/CGU et paiement réel restent les principaux chantiers en attente.

## Lot 65 — Politique de confidentialité (2026-09-05)

Choisi à la demande explicite du porteur de projet, en réponse directe à une question ouverte (« qu'est-ce que tu penses du site ? ») où j'ai signalé que la politique de confidentialité restait l'un des trois chantiers bloquant une vraie mise en ligne. Contrairement aux mentions légales (Lot 52, des faits fournis directement par le porteur de projet), une politique de confidentialité RGPD dépend surtout d'un audit technique honnête de ce que l'application fait *réellement* — jamais d'un texte générique copié d'un modèle.

**Livré**
- `/politique-confidentialite` (nouvelle page, FR/AR) construite après un audit direct du code, pas d'hypothèses : cookies réellement posés (session + préférence de langue, tous deux strictement nécessaires — confirmé qu'aucun script d'analytics/publicité/traçage n'existe nulle part dans le code), catégories de données réellement collectées par modèle Prisma, sous-traitants réels (hébergement France non choisi, email non choisi, SMS non intégré — `src/lib/sms.ts` journalise seulement en développement, IA Anthropic conditionnelle et désactivée par défaut cf. Lots 57/58), durée de conservation décrite fidèlement au comportement réel du code (pas de purge automatique programmée nulle part dans l'app — donnée conservée tant que le compte est actif, documents d'identité supprimés immédiatement après décision cf. Lot 14/60, anonymisation à la suppression de compte cf. Lot 51).
- Section « Vos droits » pointant vers les fonctionnalités réellement construites : export RGPD (Lot 55) pour l'accès/la portabilité, édition de profil pour la rectification, suppression de compte (Lot 51) pour l'effacement — jamais une clause théorique sans mécanisme derrière.
- Seuls deux points restent honnêtement marqués « à compléter/à confirmer » (adresse de contact vie privée, autorité de contrôle compétente) faute de décision communiquée à ce jour — même discipline anti-fabrication que les mentions légales (Lot 52) : aucune coordonnée ni juridiction inventée sur un document juridique.
- Lien « Politique de confidentialité » ajouté au pied de page, à côté de « Mentions légales ». Corrigé au passage un contraste insuffisant (`text-slate-400`→`500`) resté sur les mentions légales depuis le Lot 52, jamais couvert par l'audit a11y du Lot 53.
- Aucun nouveau test unitaire (page de contenu statique, comme les mentions légales) ; 309/309 toujours au vert.
- Vérification de bout en bout en conditions réelles : page réelle affichant l'intégralité du contenu, liens vers mentions légales et profil confirmés fonctionnels, lien du pied de page confirmé présent, rendu RTL arabe confirmé (logo, listes à puces, liens soulignés tous correctement inversés), aucun débordement horizontal en mobile.

Prochain lot proposé : à définir avec le porteur de projet — un CGU/CGV distinct (conditions d'utilisation, pas de confidentialité) et le paiement réel (identifiants non fournis) restent les principaux chantiers en attente.

## Lot 66 — Paiement par virement bancaire manuel (2026-09-05)

Choisi à la demande explicite du porteur de projet, en réponse directe au chantier signalé au Lot 65 : sans intégration bancaire réelle disponible, la seule voie de monétisation honnête aujourd'hui est un virement bancaire confirmé manuellement — même logique de « vérification humaine » que la vérification d'identité (Lot 14). Décisions de cadrage actées avec le porteur de projet avant le code : virement manuel (pas de tentative de fausse intégration Stripe/CIB), **vendeur uniquement** (aucun paiement acheteur n'existe encore côté fonctionnalités), formules Premium/Premium+ déjà documentées mais jamais opérationnelles au §11 du cahier d'architecture (« bientôt disponible » dans l'assistant de publication depuis le Lot 8).

**Livré**
- `PaymentSettings` (nouveau modèle singleton, sur le modèle de `ModerationSettings` Lot 47) : nom de banque/RIB/titulaire (nullables, jamais inventés — l'UI vendeur reste masquée tant qu'un admin ne les a pas renseignés) + prix Premium/Premium+ éditables (valeurs de départ fonctionnelles 1000/2000 DA, pas une décision finale). Formulaire `/admin/parametres` (nouvelle section, réservée ADMIN — un RIB réel est plus sensible que la modération courante ouverte à tout le staff).
- `PaymentOrder` (nouveau modèle) : une demande de mise à niveau par annonce, avec référence de virement fournie par le vendeur, statut (`EN_ATTENTE`/`CONFIRMEE`/`REJETEE`), motif de refus obligatoire. Piège Prisma/SQLite découvert au passage : un enum se trie alphabétiquement (`PREMIUM` < `PREMIUM_PLUS` < `STANDARD`), jamais dans l'ordre de rang voulu — contourné par une table de rang explicite (`formulaRank()`) et, côté base, deux requêtes bornées (Premium+ d'abord) plutôt qu'un tri unique.
- `POST /api/listings/[id]/upgrade-formula` (vendeur ou collaborateur `gererAnnonces`, réutilise `canManageListing` du Lot 43) : crée la demande si l'annonce est publiée/expirée, la formule cible est bien supérieure, et aucune demande n'est déjà en attente.
- `/admin/paiements` (nouveau, réservé ADMIN) + `POST /api/admin/payment-orders/[id]/review` : approuver applique la formule et prolonge l'expiration (45 jours Premium / 60 jours Premium+, cf. §11), refuser exige un motif ; les deux notifient le vendeur par email (`Notifications.paymentApproved*`/`paymentRejected*`) et s'inscrivent au journal d'audit (Lot 60) — RIB masqué (`•••`) dans le détail du changement de paramètres pour ne pas dupliquer un numéro de compte réel dans un journal interne.
- Bouton « Passer en Premium/Premium+ » sur `/compte/mes-annonces` (`ListingFormulaUpgrade`, nouveau) affichant les coordonnées bancaires réelles et un champ de référence de virement ; badge de formule ajouté aux cartes d'annonce partout (recherche, favoris, homepage).
- Effet visible de la monétisation, pas seulement administratif : `/` affiche désormais une section « Annonces en vedette » (Premium+ uniquement, 4 annonces) et `/recherche` une section « Annonces en avant » (Premium+ puis Premium en complément, 3 annonces, page 1 uniquement) — sans jamais dupliquer une annonce mise en avant dans la liste paginée en dessous.
- 15 nouveaux tests unitaires (`tests/payment-orders.test.ts`, `tests/payment-settings.test.ts`) : éligibilité à la mise à niveau, calcul de prix/durée de validité, complétude des coordonnées bancaires. 324/324 tests au vert au total.
- Bug RTL trouvé et corrigé en vérification navigateur réelle (pas au build, ni aux tests) : le RIB, une suite de chiffres/espaces, s'affichait inversé visuellement en arabe (bidi du navigateur sur du texte neutre dans un paragraphe RTL) — un numéro de compte bancaire doit toujours se lire de gauche à droite quelle que soit la langue de la page. Corrigé par `dir="ltr"` sur les trois affichages du RIB (formulaire admin, formulaire vendeur, référence de virement dans `/admin/paiements`).
- Vérification de bout en bout en conditions réelles, sur un serveur lancé pour ce lot (accès complet aux logs) : cycle complet approbation (vendeur demande Premium → admin approuve → `formula`/`expiresAt`/statut confirmés en base, email de confirmation vérifié via la source Ethereal brute) ET cycle complet refus (nouvelle demande Premium+ → admin refuse avec motif → `PaymentOrder.status` confirmé `REJETEE`, annonce inchangée, email de refus avec motif interpolé vérifié) ; section « Annonces en vedette » (accueil) et « Annonces en avant » (recherche, sans duplication avec les résultats paginés) confirmées avec une vraie annonce Premium+ ; rendu arabe (RTL) et mobile vérifiés sur l'ensemble des nouveaux écrans (paramètres, paiements, mes annonces, accueil, recherche) sans débordement horizontal. Annonce et demandes de test entièrement supprimées après vérification.

Les coordonnées bancaires configurées lors de la vérification (BNA - Agence Sidi Bel Abbès, RIB de test, titulaire EURL INGENICA CIVIL) sont des valeurs illustratives saisies pour valider le flux — **à remplacer par les vraies coordonnées bancaires d'INGENICA CIVIL EURL avant toute mise en ligne**, même limite que les mentions légales/politique de confidentialité (Lots 52/65).

Prochain lot proposé : à définir avec le porteur de projet — un CGU/CGV distinct reste le seul chantier de conformité encore en attente ; côté produit, un tableau de bord de statistiques pour le porteur de projet (revenus des mises à niveau, taux de confirmation) deviendrait pertinent maintenant que de premières transactions existent.

## Lot 67 — Conditions générales d'utilisation et de vente (2026-09-05)

Choisi en reprenant directement le dernier chantier de conformité signalé à la clôture du Lot 66 : après les mentions légales (Lot 52) et la politique de confidentialité (Lot 65), les CGU/CGV restaient le seul document juridique manquant avant une vraie mise en ligne — le cahier d'architecture prévoyait une route `/legal/cgu` (§2) sans jamais en préciser le contenu. Même discipline que les deux pages précédentes : chaque clause décrit un comportement réellement codé, jamais une clause générique copiée d'un modèle.

**Livré**
- `/conditions-generales` (nouvelle page, FR/AR) construite après audit direct du code, pas d'hypothèses : capacité juridique déclarative à l'inscription (`registerSchema` ne collecte aucune date de naissance, jamais vérifiée techniquement — dit honnêtement comme telle), statuts de compte réels (professionnel avec collaborateurs à permissions définies par le titulaire cf. Lot 42, badge d'identité sur examen manuel cf. Lot 14), règles de publication et modération reflétant le cycle réel `BROUILLON→EN_ATTENTE→PUBLIEE/REFUSEE` avec motif communiqué (Lot 63), seuil de suspension automatique décrit sans chiffre figé (`ModerationSettings` est configurable depuis le Lot 47, un chiffre écrit en dur dans un texte juridique serait faux dès que l'admin le change), avis conditionnés à une interaction réelle vérifiée en base (`checkReviewEligibility`, un seul avis par vendeur).
- Section dédiée aux formules payantes (Lot 66) : nature du service (mise en avant, jamais une garantie de vente), mécanisme réel de paiement/confirmation manuelle, et un point honnêtement documenté plutôt que fabriqué — **aucun mécanisme de remboursement automatique n'existe dans le code** pour un virement envoyé mais rejeté (contact manuel requis).
- Clause centrale de non-responsabilité sur la transaction elle-même : Souqauto.dz met seulement en relation, n'est jamais partie à la vente du véhicule (prix/paiement/remise se font hors plateforme), ne vérifie ni l'état mécanique ni la situation administrative du véhicule — cohérent avec la nature du service décrite au cahier d'architecture et avec l'absence de toute fonctionnalité de paiement acheteur (Lot 66, décision explicite du porteur de projet : vendeur uniquement).
- Suppression de compte (Lot 51) décrite fidèlement : anonymisation, pas de suppression physique, contenu déjà publié par d'autres (avis reçus, messages) reste visible.
- Propriété intellectuelle : marque/logo (Lot 59) et contenu du site à l'EURL INGENICA CIVIL, contenu publié par l'utilisateur (photos/textes d'annonce) reste sa propriété avec licence d'affichage accordée à la plateforme.
- Comme pour les deux autres pages légales, deux points restent honnêtement marqués « à confirmer/à compléter » (juridiction compétente et modalités de règlement des litiges, adresse de contact) faute de décision communiquée à ce jour.
- Lien « Conditions générales » ajouté au pied de page, à côté des deux autres pages légales.
- Aucun nouveau test unitaire (page de contenu statique, comme les mentions légales et la politique de confidentialité) ; 324/324 toujours au vert.
- Vérification de bout en bout en conditions réelles : page réelle affichant l'intégralité des 13 sections, lien vers les mentions légales confirmé fonctionnel, lien du pied de page confirmé présent en FR et AR, rendu RTL arabe confirmé sur l'ensemble de la page (titres, listes à puces, lien souligné, noms de marque restés lisibles en LTR dans le flux RTL), aucun débordement horizontal en mobile (vérifié jusqu'en bas de page).

Avec ce lot, les trois documents juridiques identifiés (mentions légales, politique de confidentialité, CGU/CGV) sont tous livrés — seuls les points dépendant d'une décision du porteur de projet (contact, juridiction, hébergeur définitif) restent ouverts, de façon honnêtement documentée plutôt que fabriquée.

Prochain lot proposé : à définir avec le porteur de projet — le tableau de bord de statistiques de paiement (revenus des mises à niveau, taux de confirmation, cf. Lot 66) est le principal chantier produit en attente ; côté conformité, plus aucun document juridique de base ne manque.

## Lot 68 — Statistiques de paiement + faille de visibilité du RIB corrigée (2026-09-05)

Choisi en reprenant directement le « prochain lot proposé » écrit à la clôture du Lot 67. Avant de coder le tableau de bord, l'exploration de `/admin/parametres` (pour situer où l'ajouter) a révélé une **faille de visibilité non détectée jusqu'ici** : la section paiement de cette page affichait le RIB, le nom de banque, le titulaire et les prix en clair (champs désactivés mais avec leur vraie valeur) à **tout le staff**, y compris un simple MODÉRATEUR — alors que le Lot 66 documentait explicitement cette section comme « réservée ADMIN » et que la page sœur `/admin/paiements` applique bien ce filtre par une redirection de route. L'intention documentée n'avait jamais été implémentée pour cette page-là : `canEdit` ne contrôlait que l'édition, jamais l'affichage. Vérifié concrètement avec le compte MODÉRATEUR de test (`amine.benali`) avant correctif — RIB réel visible dans l'arbre d'accessibilité de la page.

**Livré**
- Correctif de sécurité : `/admin/parametres` (`src/app/[locale]/admin/parametres/page.tsx`) n'affiche plus le formulaire `PaymentSettingsForm` à un non-administrateur — un message « réservé aux administrateurs » le remplace, sur le même modèle que le reste de la page (titre/sous-titre restent visibles, seules les valeurs sensibles sont masquées). Revérifié après correctif : MODÉRATEUR ne voit plus aucune valeur, ADMIN voit et édite toujours normalement.
- `computePaymentOrderStats()` (`src/lib/payment-orders.ts`, fonction pure testée) : revenu total confirmé, revenu par formule (Premium/Premium+), nombre de demandes confirmées/refusées/en attente, taux de confirmation. Le taux ne compte que les demandes déjà tranchées (CONFIRMEE/REJETEE) — une demande EN_ATTENTE n'a encore rien prouvé et fausserait le taux à la baisse si elle entrait au dénominateur ; taux rendu `null` (jamais un 0% fabriqué) tant qu'aucune demande n'a encore été tranchée.
- Tableau de bord ajouté en tête de `/admin/paiements` (déjà réservé ADMIN depuis le Lot 66, aucun changement d'accès nécessaire ici) : revenu confirmé total, taux de confirmation, nombre de demandes confirmées/refusées, détail du revenu par formule.
- 5 nouveaux tests unitaires (`tests/payment-orders.test.ts`). 329/329 tests au vert au total.
- Vérification de bout en bout en conditions réelles : 3 demandes de test créées directement en base (2 confirmées, 1 refusée) sur une annonce déjà existante, chiffres du tableau de bord confirmés exacts (revenu 4 500 DA, taux 67 %, répartition Premium/Premium+ correcte) ; MODÉRATEUR reconfirmé toujours redirigé hors de `/admin/paiements` (comportement du Lot 66, non affecté) ; rendu RTL arabe et mobile vérifiés sur le tableau de bord (grille 2×2 sans débordement). Données de test entièrement supprimées après vérification.

Prochain lot proposé : à définir avec le porteur de projet — aucun chantier de conformité ou de paiement de base ne reste identifié à ce stade ; une revue de sécurité transverse similaire à celle du Lot 50 (mais ciblée sur les 8 lots ajoutés depuis) deviendrait la prochaine chose utile à faire, la faille de ce lot montrant qu'une intention documentée peut diverger de l'implémentation réelle avec le temps.

## Lot 69 — Audit sécurité transverse Lots 61-68 (2026-09-05)

Choisi en reprenant directement le « prochain lot proposé » écrit à la clôture du Lot 68 : un audit ciblé sur exactement les 8 lots ajoutés depuis le Lot 60 (`git diff` entre les deux commits), sur le modèle des 5 agents en parallèle du Lot 50 mais recentré sur 3 axes (sécurité/IDOR, cohérence i18n, intégrité des données) puisque le périmètre est très inférieur à un audit de code base complète.

**Résultats**
- **Sécurité/IDOR** : aucune faille trouvée. Chaque route de paiement re-vérifie l'autorisation côté serveur (jamais seulement côté page/UI) : `upgrade-formula` exige `canManageListing`, les deux routes admin (`payment-orders/review`, `payment-settings`) re-vérifient `isAdmin` indépendamment de la redirection de page. Le montant du virement est toujours calculé côté serveur depuis `PaymentSettings`, jamais accepté du client. Le correctif RIB du Lot 68 est confirmé complet (aucune fuite résiduelle via un autre chemin). Journal d'audit cohérent avec le reste de l'application.
- **Cohérence i18n** : aucune clé manquante ni placeholder désaccordé entre FR et AR sur l'ensemble des 8 lots (namespaces `AdminPayments`, `AdminPaymentSettings`, `Terms`, `Privacy`, `MyListings`, `Notifications` vérifiés exhaustivement). Un seul écart mineur trouvé et corrigé : `admin/paiements/page.tsx` formatait le montant de chaque demande en attente avec `.toLocaleString()` brut au lieu du formateur `ar-DZ`/`fr-DZ` déjà utilisé pour le reste de la page — corrigé pour cohérence, sans impact fonctionnel (l'affichage restait juste, seul le regroupement des milliers différait légèrement en arabe).
- **Intégrité des données — 2 races concurrentes (TOCTOU) confirmées et corrigées**, dans la même famille que celle déjà fermée sur `IdentityVerificationRequest` au Lot 50 :
  - **Double demande** : `POST /api/listings/[id]/upgrade-formula` ne vérifiait l'absence de demande `EN_ATTENTE` qu'en application (`findFirst` puis `create`, sans transaction) — un double-clic ou un retry réseau pouvait créer deux demandes de paiement pour la même annonce. Corrigé par un **index unique filtré** au niveau SQLite (`PaymentOrder_pending_unique`, une seule ligne `EN_ATTENTE` par `listingId`, migration hand-écrite comme d'habitude sur ce projet), avec la violation de contrainte proprement interceptée côté route et renvoyée comme une erreur `order_pending` normale plutôt qu'une 500.
  - **Double décision** : `POST /api/admin/payment-orders/[id]/review` lisait la demande (`findUnique`) puis la mettait à jour séparément — deux admins (ou deux onglets) approuvant/refusant la même demande en même temps pouvaient tous les deux passer la vérification de statut avant qu'aucune écriture n'ait eu lieu, appliquant deux fois la formule sur l'annonce et envoyant deux fois l'email. Corrigé en remplaçant l'`update` par un `updateMany` conditionné sur `status: "EN_ATTENTE"` : si `count === 0`, une autre requête a déjà gagné la course, la route s'arrête proprement (`invalid_transition`) avant tout effet de bord.
  - Formule/statut PaymentOrder revérifiés : aucune deuxième occurrence du piège de tri alphabétique d'enum SQLite (Lot 66) trouvée dans le nouveau code de statistiques. Migration `migration.sql` du Lot 66 revérifiée champ par champ contre `schema.prisma` : aucune dérive.
- Vérification de bout en bout en conditions réelles (pas seulement une relecture de code) : **deux requêtes concurrentes réelles** envoyées via `Promise.all` pour reproduire chaque course — la demande en double confirmée rejetée avec `order_pending` (une seule ligne créée en base) ; la double décision confirmée : une seule des deux requêtes aboutit (`REJETEE`), l'autre reçoit `invalid_transition`, la formule de l'annonce reste inchangée et une seule entrée d'audit est écrite. Données de test supprimées après vérification.
- 329/329 tests toujours au vert (aucun nouveau test unitaire ajouté : les races nécessitent une vraie base de données concurrente, vérifiées en conditions réelles comme au Lot 50 pour `IdentityVerificationRequest`).

**Signalé mais non corrigé, hors périmètre de cet audit** : le même motif de course sur double-décision (lecture puis update séparé, sans `updateMany` atomique) existe aussi dans `/api/admin/identity-requests/[id]/review` et `/api/admin/listings/[id]/moderate` — antérieurs au Lot 60 donc hors du diff audité ici, et de sévérité moindre (pas d'argent réel en jeu, contrairement au paiement). À corriger dans un futur lot de durcissement transverse si le porteur de projet le souhaite.

Prochain lot proposé : à définir avec le porteur de projet — plus aucune faille connue n'est ouverte sur le paiement ; le même correctif `updateMany` atomique pourrait être généralisé aux routes de revue identité/modération par cohérence, sans urgence puisqu'aucune n'implique de transaction financière.

## Lot 70 — Généralisation du correctif anti-double-décision (2026-09-05)

Choisi explicitement par le porteur de projet, en réponse à la question ouverte « qu'est-ce qui reste à faire ? » où j'ai listé la dette technique connue : parmi les 4 sujets proposés (généraliser le correctif anti-double-clic, équipements dans l'estimation de prix, tester le vrai chemin IA), il a choisi le premier — le même écart signalé mais volontairement laissé ouvert à la clôture du Lot 69.

**Livré**
- `POST /api/admin/identity-requests/[id]/review` : `update` remplacé par `updateMany({ where: { id, status: "EN_ATTENTE" } })` avec vérification de `count` — même correctif que `PaymentOrder` au Lot 69.
- `POST /api/admin/listings/[id]/moderate` : même principe, mais le filtre du `where` utilise le statut **lu** (`listing.status`) plutôt qu'une valeur fixe, puisque cette route accepte plusieurs statuts source selon l'action (`approve` part d'EN_ATTENTE ou de SUSPENDUE, `reject` d'EN_ATTENTE, `suspend` de PUBLIEE — cf. `computeModerationTransition`). L'objet mis à jour est reconstruit en mémoire (`{ ...listing, status, moderationNote, publishedAt }`) plutôt que rechargé en base, pour éviter un aller-retour DB supplémentaire inutile sur le chemin déjà protégé par la garde atomique.
- Aucun nouveau test unitaire (la race nécessite une vraie base de données concurrente, même choix qu'au Lot 69) ; 329/329 tests toujours au vert.
- Vérification de bout en bout en conditions réelles avec de VRAIES requêtes concurrentes (`Promise.all` de deux `fetch`, comme au Lot 69) sur les deux routes : dans les deux cas, une seule des deux requêtes aboutit (`REFUSEE`), l'autre reçoit `invalid_transition` ; une seule entrée d'audit écrite par ressource, aucune double application ni double email. Données de test (dossier d'identité + annonce créés directement en base pour le test) entièrement supprimées après vérification.

Avec ce lot, les 3 routes de décision admin de l'application (paiement, identité, modération d'annonces) appliquent désormais toutes la même garde atomique contre le double-clic/la double-décision concurrente — plus aucun écart connu de ce type.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure les équipements dans l'estimation de prix (nécessite une décision de taxonomie) et la vérification du chemin IA réel (nécessite une clé Anthropic).

## Lot 71 — Jeu de données de démonstration (2026-09-05)

Choisi à la demande explicite du porteur de projet, en réponse directe à sa question « est-ce qu'il y a des annonces fictives pour alimenter le site ? ». Vérification en base révélant que les seules annonces existantes étaient 8 résidus de tests développement (toutes des « Renault Clio 4 diesel » quasi identiques sur le seul compte `amine.benali`, dont deux littéralement nommées « annonce test moderation Lot 7 »/« annonce test refus Lot 7 ») — jamais un vrai jeu de démonstration pensé pour donner l'impression d'un marché actif. Décision actée avec le porteur de projet : remplacer ce catalogue de test par un jeu cohérent plutôt que de le conserver à côté.

**Livré**
- `prisma/seed-demo-listings.ts` (nouveau script, `npm run db:seed:demo`) — séparé du seed principal (`prisma/seed.ts`, données de référence idempotentes) car celui-ci crée du contenu éditorial, pas des données de référence : 6 nouveaux comptes vendeurs particuliers (noms algériens réalistes, répartis sur 6 wilayas réelles) + réutilisation du compte professionnel existant `Auto Sara Motors` pour peupler aussi sa vitrine, 24 annonces au total (18 particuliers + 6 concession) couvrant 19 marques/modèles réels du catalogue existant, prix/kilométrage/année cohérents avec le segment (citadine ~1,8-2,9M DA, SUV ~3,4-5,9M, premium allemand ~6,5-7,2M), toutes `PUBLIEE`, formule majoritairement STANDARD avec 3 PREMIUM et 2 PREMIUM+ pour peupler les sections « en vedette »/« en avant » construites au Lot 66. Dates de publication étalées sur les 20 derniers jours (pas toutes créées à la même seconde) pour un tri « plus récent » réaliste.
- Les 8 annonces de test existantes supprimées (script idempotent : relance sans effet destructif supplémentaire, la suppression cible nommément `amine.benali@example.dz`).
- **Aucune vraie photo de véhicule utilisée** — aucune source fiable/libre de droits disponible sur cette machine pour représenter 24 véhicules réels : un visuel de substitution est généré localement par le script (fond coloré par marque + nom marque/modèle, rendu via `sharp` depuis un SVG, mêmes contraintes de taille/format que `savePhoto()`) plutôt qu'une fausse photo de voiture prétendant en être une. Honnêteté choisie plutôt qu'une fabrication visuelle trompeuse, même discipline que le reste du projet (IA/logo/statistiques jamais présentés comme plus réels qu'ils ne le sont).
- Les 10 fichiers résiduels de l'ancien placeholder de test (un même fichier de 3 119 octets dupliqué sous 10 UUID, utilisé pour les tests d'upload depuis le Lot 30) supprimés du disque après confirmation qu'aucune ligne `ListingPhoto` ne les référençait plus.
- Aucun nouveau test unitaire (script de contenu, pas de logique métier nouvelle) ; 329/329 toujours au vert.
- Vérification de bout en bout en conditions réelles : script exécuté avec succès (24 annonces créées, 8 supprimées), accueil affichant la section « Annonces en vedette » avec de vraies images générées, recherche affichant les 24 annonces filtrables par marque/wilaya avec badges Professionnel/Premium+/Premium corrects, fiche annonce individuelle avec photo/description/vendeur, vitrine `Auto Sara Motors` affichant ses 6 annonces ; rendu arabe (RTL) et mobile vérifiés sans débordement.

Le mot de passe des 6 nouveaux comptes de démonstration (`DemoVendeur2026!`) est documenté dans le script lui-même, sur le même modèle que le mot de passe admin de `prisma/seed.ts` — à régénérer avant toute mise en ligne réelle, comme tous les identifiants de développement de ce projet.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure les équipements dans l'estimation de prix et la vérification du chemin IA réel ; côté contenu, remplacer les visuels de substitution par de vraies photos (ou une intégration IA de génération d'image, à décider) redeviendrait pertinent avant un vrai lancement public.

## Lot 72 — Équipements dans l'estimation de prix (2026-09-05)

Choisi en reprenant directement l'un des deux sujets de dette technique mineure signalés à la clôture du Lot 68 (l'autre, le chemin IA réel, nécessite une clé Anthropic non disponible sur cette machine). L'écart était documenté depuis le Lot 4/45, et `docs/ARCHITECTURE.md` §14 prévoit explicitement les équipements comme critère de comparabilité pour le badge « Bon Prix », au même titre qu'année/kilométrage/wilaya — jamais construit jusqu'ici.

**Livré**
- `Equipment`/`ListingEquipment` (nouveaux modèles, migration hand-écrite comme d'habitude) : référentiel de 20 équipements réels et courants sur un véhicule d'occasion (Confort/Sécurité/Multimédia/Extérieur), noms bilingues FR/AR en base (mêmes conventions que `Wilaya.nomFr/nomAr`, pas des clés de traduction — ce sont des données de référence, pas du texte d'interface). Seedés via `prisma/seed.ts` (`equipmentCatalogue`, `prisma/equipment-data.ts`), même discipline anti-fabrication que `catalogue-data.ts` : aucune option exotique inventée.
- Étape 4 de l'assistant de publication (« État du véhicule ») étendue avec des cases à cocher groupées par catégorie, à côté de première main/accidenté déjà présents sur cette étape — pas de nouvelle étape ajoutée (aurait exigé de renuméroter les 11 étapes existantes). `equipmentIds` propagé jusqu'à `POST /api/listings`, validé contre le référentiel réel (même garde-fou que marque/modèle : jamais un id fabriqué côté client accepté).
- **Le cœur du lot** : `estimateFromRows`/`estimatePrice`/`estimatePricesForListings` (`src/lib/price-estimation.ts`) acceptent désormais un critère d'équipement supplémentaire dans la cascade de paliers déjà existante (année/km/wilaya) — un comparable est retenu au palier le plus précis s'il partage au moins la moitié des équipements du véhicule estimé, sinon le calcul retombe sur les paliers plus larges existants. Délibérément **jamais un pourcentage d'ajustement de prix par équipement inventé sans base de marché réelle** (« +50 000 DA pour un GPS ») — seulement un critère de sélection du pool de comparables, cohérent avec la façon dont année/km/wilaya fonctionnaient déjà.
- Les 6 pages qui affichent un badge « Bon Prix » (`annonce/[id]`, `recherche`, `voitures/[brand]`, `voitures/[brand]/[model]`, `vendeur/[id]`, `pro/[id]`) transmettent désormais les équipements réels de chaque annonce à l'estimation — cohérent partout, pas seulement sur la fiche annonce.
- Équipements affichés sur la fiche annonce (`/annonce/[id]`, nouvelle section) sous forme de badges, bilingues selon la langue active.
- 2 nouveaux tests unitaires sur le nouveau palier d'équipement (sélection du comparable le mieux équipé, repli propre quand aucun comparable n'atteint le seuil de 50 %) ; 331/331 tests au vert au total.
- **Hors périmètre explicite de ce lot** (limite du temps, pas un oubli) : l'édition d'une annonce déjà publiée (`ListingEditForm`) ne permet pas encore de modifier les équipements après coup — seule la publication initiale les capture, pour éviter tout risque d'effacement accidentel des équipements existants en modifiant le flux d'édition sans le temps de le vérifier correctement. La recherche par équipement (facette citée dans `docs/ARCHITECTURE.md` §14, aux côtés de la comparabilité de prix) reste elle aussi non construite.
- Vérification de bout en bout en conditions réelles : annonce de test créée via `POST /api/listings` (chemin réel, pas un contournement) avec 3 équipements réels, approuvée par un admin, fiche annonce confirmant l'affichage des équipements ET une estimation de marché cohérente (repli correct vers le palier sans équipement puisqu'aucun comparable du jeu de démonstration n'en partageait) ; cases à cocher de l'étape 4 vérifiées à la fois en français et en arabe (RTL, catégories traduites, état conservé au changement de langue) ; rendu mobile de la fiche annonce (équipements, estimation) sans débordement. Donnée de test entièrement supprimée après vérification, y compris le fichier photo généré.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos ; côté produit, l'édition des équipements sur une annonce déjà publiée et la recherche par équipement complèteraient logiquement ce lot.

## Lot 73 — Édition des équipements sur une annonce publiée (2026-09-05)

Choisi explicitement par le porteur de projet, en sélectionnant directement ce point dans la liste de dette technique proposée à la clôture du Lot 72 : les équipements n'étaient capturés qu'à la création, jamais modifiables après coup — écart volontairement laissé ouvert au Lot 72 faute de temps pour le vérifier correctement dans le même lot.

**Livré**
- `equipmentIds` ajouté à `listingEditSchema` (`src/lib/validation/listing.ts`) — extrait en constante partagée (`equipmentIdsField`) avec `listingSchema` pour ne jamais laisser diverger les deux bornes de validation.
- `PATCH /api/listings/[id]` valide les équipements contre le référentiel réel (même garde-fou que marque/modèle) puis **remplace entièrement** la sélection précédente (`equipments: { deleteMany: {}, create: [...] }`) — jamais un ajout cumulatif : l'utilisateur voit et coche l'état complet voulu à chaque édition, pas une liste qui grandit indéfiniment.
- `ListingEditForm.tsx` : section équipements ajoutée (mêmes catégories/style que l'étape 4 de l'assistant de publication, réutilise les clés `Wizard.equipments*` déjà traduites FR/AR depuis le Lot 72 — aucune nouvelle clé i18n nécessaire), pré-cochée avec les équipements réels de l'annonce.
- Aucun nouveau test unitaire (wiring API/formulaire, même choix que le reste de `ListingEditForm` — jamais testé unitairement non plus, la logique pure testable était déjà couverte côté `price-estimation` au Lot 72).
- Vérification de bout en bout en conditions réelles, via de vrais appels `PATCH /api/listings/[id]` (pas un contournement) sur une annonce de démonstration réelle : premier edit ajoutant 3 équipements confirmé en base, second edit avec un jeu différent confirmé avoir **remplacé** (pas cumulé) le premier — exactement le comportement voulu. Page d'édition elle-même vérifiée affichant la section équipements au bon endroit avec les 20 options groupées par catégorie. Annonce de démonstration entièrement restaurée à son état d'origine après vérification (statut, description, photo, équipements).

Avec ce lot, l'écart du Lot 72 est refermé : les équipements sont désormais capturables aussi bien à la création qu'à l'édition.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise), le remplacement des visuels de démonstration par de vraies photos, et la recherche filtrée par équipement (dernier volet du §14 du cahier d'architecture, non construit).

## Lot 74 — Recherche filtrée par équipement (2026-09-05)

Choisi explicitement par le porteur de projet, en sélectionnant directement ce point dans la dette technique proposée à la clôture du Lot 73 : dernier volet du §14 du cahier d'architecture resté non construit, aux côtés de l'estimation de prix par équipement (Lot 72) et son édition (Lot 73).

**Livré**
- `searchParamsSchema` (`src/lib/validation/search.ts`) accepte un paramètre `equipmentIds` — un seul paramètre de requête avec une liste séparée par des virgules (`?equipmentIds=1,2,3`), pas des paramètres répétés : `recherche/page.tsx` aplatit déjà tous les query params sur leur première valeur, un `equipmentId=1&equipmentId=2` répété aurait silencieusement perdu toutes les valeurs sauf la première. Ids dédupliqués, non-entiers/non-positifs filtrés silencieusement (même discipline que les autres paramètres numériques de ce schéma).
- `buildListingWhere` (`src/lib/search.ts`) : une annonce doit avoir **chacun** des équipements cochés, jamais un seul suffisant — une clause `some` indépendante par équipement demandé combinée en `AND`, comme une vraie facette qui affine les résultats (cocher plus d'équipements réduit le nombre de résultats, ne l'augmente jamais).
- `SearchFilters.tsx` : section équipements ajoutée (checkboxes groupées par catégorie, réutilise telles quelles les clés `Wizard.equipments*`/`equipmentCategory*` du Lot 72), visible uniquement en mode recherche avancée (jamais dans la barre compacte de l'accueil). `recherche/page.tsx` transmet le référentiel réel et l'état initial depuis l'URL.
- Bénéfice gratuit, sans code supplémentaire : les alertes de recherche sauvegardée (Lot 56, `search-alerts.ts`) réutilisent déjà `searchParamsSchema`/`buildListingWhere` tels quels — une alerte sur une recherche incluant des équipements devient donc automatiquement équipement-consciente.
- 5 nouveaux tests unitaires (parsing de la liste, dédoublonnage, filtrage des valeurs invalides, absence de la clause quand aucun équipement demandé, sémantique ET jamais OU). 336/336 tests au vert au total.
- Vérification de bout en bout en conditions réelles : deux annonces de démonstration équipées directement en base (une avec GPS seul, une avec GPS+caméra de recul), recherche filtrée par GPS confirmée retournant exactement les deux (« 2 annonces trouvées »), recherche filtrée par GPS **et** caméra confirmée n'en retournant qu'une seule (« 1 annonces trouvées ») — la sémantique ET vérifiée avec de vraies données, pas seulement en test unitaire. Cases à cocher confirmées pré-cochées depuis l'URL. Rendu arabe (RTL) et mobile vérifiés sans débordement. Données de test entièrement supprimées après vérification.

Avec ce lot, les trois volets du §14 du cahier d'architecture concernant les équipements (estimation de prix Lot 72, édition Lot 73, recherche ici) sont tous livrés.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos ; plus aucun écart connu du §14 sur les équipements.

## Lot 75 — Pages SEO par wilaya (2026-09-06)

Repris directement de la liste des chantiers prévus au cahier des charges mais jamais construits (docs/ARCHITECTURE.md §2 : `/wilaya/{wilaya}`, ex. « /wilaya/alger » ; §72 : ces pages doivent générer title/meta/canonical/OG + entrer dans le sitemap segmenté). Sur le modèle exact des pages marque déjà livrées (`/voitures/[brand]`).

**Livré**
- `Wilaya.slug` (nouvelle colonne, migration hand-écrite `ALTER TABLE ... ADD COLUMN ... DEFAULT ''` puis backfill) — calculé une fois via la même fonction `slugify()` que Brand/Model/Equipment (jamais de réécriture Unicode en SQL brut, calcul fait en Node comme documenté dans la leçon de session sur ce sujet). `prisma/seed.ts` recalcule et réaffirme le slug à chaque exécution (idempotent, revérifié par un second passage du seed sans régression).
- `/wilaya` (index, nouveau) : les 58 wilayas triées alphabétiquement avec nombre d'annonces et prix moyen, même gabarit que `/voitures`.
- `/wilaya/[wilaya]` (détail, nouveau) : statistiques (nombre/prix moyen/fourchette), marques les plus proposées **dans cette wilaya précisément** (`getBrandCountsForWilaya`, nouvelle fonction dans `catalogue-stats.ts`, même principe que `getModelCountsForBrand` — une seule requête groupée, pas de N+1), 6 annonces récentes avec badges Bon Prix/Professionnel, lien « Voir toutes les annonces » vers `/recherche?wilayaId=X`. `getListingStats()` élargi pour accepter `wilayaId` (auparavant `brandId` obligatoire).
- Sitemap (`src/app/sitemap.ts`) étendu avec les 58 URLs `/wilaya/{slug}` (FR+AR), confirmé présent dans le XML réel généré.
- Lien « Toutes les wilayas » ajouté au pied de page, à côté de « Toutes les marques ».
- Aucun nouveau test unitaire (fonctions dépendantes de la base de données comme `getListingStats`/`getModelCountsForBrand`, jamais testées unitairement non plus — même choix établi pour `catalogue-stats.ts`).
- Vérification de bout en bout en conditions réelles : index affichant les 58 wilayas avec les bons décomptes tirés des données de démonstration, page Alger affichant 9 annonces/7 marques/prix cohérents, wilaya sans annonce affichant le message vide honnête, slug inexistant renvoyant une vraie 404, lien « voir tout » pointant vers la bonne recherche filtrée, sitemap.xml confirmé contenant `/wilaya/alger` en FR et AR. Rendu arabe (RTL — y compris le nom réel « الجزائر » pour Alger, tel que seedé) et mobile vérifiés sans débordement.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos ; côté contenu SEO, le blog « SOUQ AUTO MAG » (§37 du cahier d'architecture) est la dernière page de contenu documentée mais jamais construite.

## Lot 76 — Blog SOUQ AUTO MAG (2026-09-06)

Repris directement de la dette technique signalée à la clôture du Lot 75 : dernière page de contenu SEO documentée au cahier d'architecture (§37) mais jamais construite.

**Livré**
- `BlogArticle` (nouveau modèle, migration hand-écrite) : titre/extrait/contenu bilingues FR/AR stockés en base (mêmes conventions que `Wilaya.nomFr/nomAr`/`Equipment.nameFr/nameAr` — contenu éditorial réel, pas des clés de traduction), `slug` généré une seule fois à la création (`slugify(titleFr)` + gestion de collision) et jamais régénéré à l'édition pour préserver l'URL SEO même si le titre change ensuite. `publishedAt` ne bascule que lors d'un réel changement d'état publié/non publié (jamais réécrit à chaque édition d'un article déjà publié).
- Back-office `/admin/mag` (liste, création, édition, suppression), réservé **ADMIN** — contenu public engageant l'image de la marque, traité comme `/admin/paiements` plutôt que comme une modération courante accessible aux MODERATEUR. Lien « Mag » ajouté à la navigation back-office.
- Pages publiques `/mag` (index, articles publiés uniquement, triés par date de publication) et `/mag/[slug]` (détail) — un brouillon (`publishedAt` nul) est invisible sur l'index et renvoie une vraie 404 sur son slug direct.
- Contenu rendu en texte simple découpé en paragraphes (`content.split(/\n{2,}/)`), délibérément sans `dangerouslySetInnerHTML` pour ce contenu saisi en back-office — s'appuie sur l'échappement automatique de React plutôt que sur une bibliothèque de sanitisation.
- Structured data schema.org `BreadcrumbList` + `Article` sur chaque page de détail (nouvelle fonction `buildArticleJsonLd`), auteur toujours attribué à l'organisation « Souq Auto », jamais au nom personnel de l'admin ayant rédigé l'article. Sitemap étendu avec les articles publiés ; lien « Souq Auto Mag » ajouté au pied de page.
- 2 premiers articles réels rédigés et publiés (conseils pour bien acheter/vendre un véhicule d'occasion en Algérie), référençant directement des fonctionnalités réelles du site (estimation de prix, équipements) — contenu informationnel légitime, pas des faits inventés ; conservés comme contenu de lancement du blog plutôt que supprimés comme données de test.
- 4 nouveaux tests unitaires sur `generateUniqueSlug` (slug de base inchangé, suffixe `-2`, incrémentation au-delà de `-2`/`-3`, non-interférence entre slugs). 340/340 tests au vert au total.
- Vérification de bout en bout en conditions réelles : les deux articles réels confirmés sur `/mag` et `/mag/[slug]` en français, rendu arabe RTL vérifié par capture d'écran, JSON-LD `BreadcrumbList`+`Article` extrait et validé sur la page arabe (dates/URL/auteur-organisation corrects). Rendu mobile de l'index et du détail sans débordement. Un brouillon créé via l'API confirmé absent de l'index public et renvoyant une vraie 404 sur son slug direct, puis publié via `PATCH` — slug resté strictement identique malgré le changement de titre, article devenu visible publiquement — puis supprimé via `DELETE`, disparition confirmée du back-office. Garde ADMIN de `/admin/mag` vérifiée en navigateur réel avec le compte MODERATEUR de test (`amine.benali@example.dz`) : lien « Mag » absent de la navigation back-office, accès direct à `/admin/mag` redirigé vers `/admin`.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos ; plus aucune page de contenu SEO documentée au cahier d'architecture ne reste non construite.

## Lot 77 — Signaux anti-fraude à la modération (2026-09-06)

Repris directement de docs/ARCHITECTURE.md §16 (« Système anti-fraude : règles + IA — détection de prix anormalement bas, photos dupliquées inter-annonces, comptes/comportements suspects, incohérences véhicule/prix, spam »), documenté depuis le Lot 0 mais jamais construit : seul le circuit réactif de signalement par les utilisateurs (Lot 21) existait. Deux règles simples et honnêtes ici — jamais une « IA » fabriquée sans base réelle.

**Livré**
- `ListingPhoto.sha256` (nouvelle colonne + index, migration hand-écrite, backfill des 24 photos existantes par lecture des fichiers réels sur disque — zéro collision confirmée) : empreinte des octets réellement stockés après le pipeline `sharp` déterministe, jamais du fichier brut envoyé par le client. `savePhoto()` (`src/lib/uploads.ts`) calcule désormais cette empreinte en plus d'écrire le fichier.
- `src/lib/fraud-signals.ts` (nouveau) : `detectDuplicatePhoto` signale une photo strictement identique publiée par un **autre** vendeur (un vendeur qui réutilise ses propres photos n'est jamais signalé) ; `detectLowPrice` signale un prix inférieur à 50 % du bas de fourchette des comparables réels (`estimateFromRows`, réutilisé tel quel), seuil délibérément bien plus strict que le badge « Bon Prix » (qui commence dès -15 %) pour ne jamais confondre une bonne affaire légitime avec une annonce-appât ; n'agit qu'à partir de 3 comparables réels, jamais sur un échantillon trop faible pour être significatif. `getFraudSignalsForListings` orchestre le tout en batch pour toute la file de modération (une requête photos + une requête par couple marque/modèle distinct, jamais une requête par annonce).
- `/admin/annonces` : un bandeau ambre non accusatoire (« ⚠ Photo déjà vue chez un autre vendeur » / « ⚠ Prix très inférieur au marché ») apparaît sous une annonce **en attente** concernée — jamais un rejet ou un masquage automatique, la décision reste entièrement au modérateur humain (§16 : « bandeau d'avertissement non accusatoire »). Uniquement sur la file d'attente : une annonce déjà publiée a déjà été validée, jamais ré-examinée automatiquement ici.
- 9 nouveaux tests unitaires sur les deux fonctions de détection (dont le cas « le vendeur réutilise sa propre photo » jamais signalé, et le seuil exact de prix testé à la frontière). 349/349 tests au vert au total.
- **Limite documentée** : la détection de photo dupliquée repose sur une empreinte exacte (mêmes octets), pas un hash perceptuel — un recadrage, une recompression différente ou une capture d'écran de la même photo ne seront pas détectés. Un cas particulier vérifié à l'écriture de ce lot : les visuels de démonstration générés (Lot 71, `sharp` à partir d'un SVG marque/modèle) produisent des octets identiques entre deux annonces de démonstration si elles partagent exactement la même marque **et** le même modèle — confirmé sans collision sur les 24 annonces de démonstration actuelles (aucune paire marque/modèle répétée), mais un faux positif resterait possible si le script de seed était rejoué avec des doublons de marque/modèle entre vendeurs différents.
- Vérification de bout en bout en conditions réelles, jamais seulement unitaire : deux annonces Peugeot 208 réellement publiées par deux comptes différents (Karim Boudiaf, Yasmine Cherif) avec la **même photo** (même dessin canvas, mêmes octets après traitement serveur) via `POST /api/listings` réel — les deux confirmées signalées « Photo déjà vue » à la modération, aucun faux positif sur deux annonces comparables à photos distinctes déposées en parallèle. Puis, une fois 3 Peugeot 208 réellement publiées et approuvées comme comparables (2 500 000 / 2 700 000 / 2 750 000 DA), une 4ᵉ annonce Peugeot 208 à 700 000/800 000 DA confirmée signalée « Prix très inférieur au marché », alors qu'aucun signal n'apparaissait avant que le troisième comparable ne soit publié (seuil de significativité respecté). Rendu arabe RTL du bandeau vérifié par capture d'écran. Toutes les données de test supprimées après vérification (fichiers photo inclus) — la file de modération et le nombre total d'annonces (24, 0 en attente) confirmés strictement identiques à l'état d'avant lot.
- **Écart pré-existant repéré mais non corrigé** (hors périmètre de ce lot) : sur mobile, le champ de motif de suspension des annonces déjà publiées déborde légèrement de l'écran — bug antérieur à ce lot, non introduit par lui, à traiter séparément.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise), le remplacement des visuels de démonstration par de vraies photos, et le débordement mobile du champ de motif de suspension sur les annonces publiées (`/admin/annonces`) ; côté anti-fraude (§16), restent non construits la détection de comptes/comportements suspects et l'incohérence véhicule/prix.

## Lot 78 — Signal « comportement suspect » + correctif mobile modération (2026-09-06)

Repris directement de la dette technique listée à la clôture du Lot 77 : le débordement mobile signalé (petit correctif isolé) et le volet « comptes/comportements suspects » de docs/ARCHITECTURE.md §16, resté non construit après les deux premiers signaux du Lot 77.

**Livré**
- `src/lib/fraud-signals.ts` : troisième signal `sellerRejectionHistory` — signale une nouvelle annonce en attente dont le vendeur a **déjà au moins 2 autres annonces** refusées ou suspendues par un modérateur humain (`detectSellerRejectionHistory`, seuil `MIN_REJECTIONS_FOR_SIGNAL = 2`). Une seule annonce refusée n'est jamais signalée — trop courant pour être un signal fiable, une erreur ponctuelle corrigée ne doit pas coller une étiquette au vendeur. Calculé en une seule requête groupée (`prisma.listing.groupBy`) pour toute la file de modération, jamais une requête par annonce, même principe que les deux signaux précédents.
- `/admin/annonces` : troisième bandeau ambre (« ⚠ Vendeur avec des annonces déjà refusées/suspendues »), même style et même règle non accusatoire que les deux premiers signaux — aide à la décision, jamais un rejet automatique.
- **Correctif mobile** (bug repéré à la clôture du Lot 77, non introduit par lui) : la carte annonce + zone d'actions de modération, en `flex` fixe sur une seule ligne (miniature + contenu + colonne d'actions à largeur fixe `w-56`), débordait horizontalement sur petit écran. Corrigé en `flex-col` sur mobile / `sm:flex-row` à partir du point de rupture tablette, sur les deux listes (annonces en attente ET annonces publiées) de la page.
- 4 nouveaux tests unitaires sur `detectSellerRejectionHistory` (aucun refus, un seul refus jamais signalé, seuil exact, au-delà du seuil). 353/353 tests au vert au total.
- Vérification de bout en bout en conditions réelles : un vendeur de démonstration (Nadia Bouzid) avec 2 annonces réellement soumises puis réellement refusées via `POST .../moderate` (motif réel, pas une simulation) — une 3ᵉ annonce ensuite déposée par ce même vendeur confirmée signalée « Vendeur avec des annonces déjà refusées/suspendues » à la modération. Rendu mobile de la page confirmé sans débordement (capture d'écran, listes en attente et publiées). Données de test entièrement supprimées après vérification (annonces + fichiers photo) — file de modération et nombre total d'annonces (24, 0 en attente) confirmés strictement identiques à l'état d'avant lot.

Avec ce lot, deux des cinq signaux visés par §16 restent non construits : incohérence véhicule/prix et spam (répétition de contenu/comptes multiples pour un même vendeur) — aucun des deux n'a de définition suffisamment précise sans arbitrage supplémentaire du porteur de projet pour éviter un signal fabriqué sans base réelle.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos ; côté anti-fraude (§16), restent non construits l'incohérence véhicule/prix et la détection de spam.

## Lot 79 — Abonnements professionnels (2026-09-06)

Écart documenté depuis le Lot 13 (« un seul palier fonctionnel, pas d'abonnement Starter/Business/Pro/Premium payant, le paiement reste bloqué en attente d'identifiants réels ») — devenu obsolète depuis que le virement bancaire manuel a été adopté comme méthode de paiement réelle pour les formules d'annonce (Lot 66). Même mécanisme reproduit ici pour les comptes professionnels (§4-B/§11 du cahier d'architecture).

**Livré**
- `ProSubscription`/`ProSubscriptionOrder` (nouveaux modèles, migration hand-écrite) : un compte pro sans ligne `ProSubscription` est implicitement au palier **Starter** (gratuit, quota 5 annonces actives). Paliers payants Business (20 annonces, 3 000 DA/mois)/Pro (60 annonces, 6 000 DA/mois)/Premium (illimité, 12 000 DA/mois) — quotas et prix en dur pour l'instant, pas encore configurables en back-office, même choix assumé que `PREMIUM_VALIDITY_DAYS` (une valeur fonctionnelle d'abord, éditable plus tard si le besoin apparaît, cf. seuils de suspension automatique Lot 21→47).
- Quota appliqué à **la création** d'une nouvelle annonce (`POST /api/listings` et `POST /api/pro/accounts/[id]/bulk-import`) : compte le nombre d'annonces actives (brouillon/en attente/publiée/suspendue — jamais refusée/vendue/expirée, qui ne bloquent rien). Un compte déjà au-dessus de son quota (upgrade jamais forcé rétroactivement) est simplement empêché d'ajouter une NOUVELLE annonce tant qu'il n'a pas upgradé — les annonces existantes ne sont jamais touchées.
- Même circuit que les formules d'annonce (Lot 66/69) pour le paiement : `POST /api/pro/accounts/[id]/subscription/upgrade` (réservé au **propriétaire** du compte pro, jamais un collaborateur même avec `gererAnnonces` — décision financière engageant l'entreprise, même sensibilité que la gestion des collaborateurs) crée une demande de virement ; `POST /api/admin/pro-subscription-orders/[id]/review` (ADMIN uniquement) approuve/refuse avec rapprochement humain, jamais une vérification bancaire automatisée. Index unique filtré (un seul virement EN_ATTENTE par compte pro) ajouté dès ce lot plutôt que découvert dans un futur audit — même piège TOCTOU que `PaymentOrder` (Lot 69), corrigé immédiatement cette fois.
- `/pro/tableau-de-bord` : nouvelle section « Abonnement professionnel » (palier actuel, quota d'usage réel, boutons d'upgrade vers tout palier strictement supérieur — pas seulement le suivant, un compte Starter peut viser Premium directement). `/admin/paiements` : nouvelle liste des demandes d'abonnement en attente, réutilisant `PaymentOrderReviewActions` (généralisé avec une prop `reviewUrl` plutôt que dupliqué) et les mêmes clés i18n `Admin.approve/reject/reasonPlaceholder`.
- Notification email à la décision (approuvé/refusé), même patron que les Lots 62-64/66.
- **Correctif mobile au passage** : la liste des demandes de paiement (`/admin/paiements`) avait le même débordement `flex` fixe que celui corrigé au Lot 78 sur `/admin/annonces` — jamais remarqué faute d'avoir eu l'occasion de retoucher cette page depuis. Corrigé avec le même `flex-col`/`sm:flex-row`.
- 13 nouveaux tests unitaires (classement des paliers jamais alphabétique, quota, éligibilité à l'upgrade, expiration d'un palier payant retombant sur Starter, prix croissants). 366/366 tests au vert au total.
- Vérification de bout en bout en conditions réelles, avec le compte pro de démonstration réel (Auto Sara Motors, 6 annonces déjà actives) : quota Starter par défaut (5) confirmé bloquant une nouvelle annonce (`quota_exceeded`, `POST /api/listings` réel) — comportement attendu, pas un bug, un compte avec plus d'annonces que son palier gratuit ne peut logiquement pas en ajouter tant qu'il n'upgrade pas. Demande de virement réelle soumise vers le palier Pro, approuvée par un admin réel, palier et quota affichés immédiatement mis à jour (« Pro », « 6/60 »), nouvelle annonce ensuite acceptée sans erreur. RTL arabe vérifié par capture d'écran (fr.json/ar.json), rendu mobile du tableau de bord pro sans débordement. Toutes les données de test supprimées après vérification (annonce, demande d'abonnement, ligne `ProSubscription`) — compte Sara Hamdi confirmé revenu exactement à son état d'avant lot (Starter, 6/5, 24 annonces au total sur le site).
- **Hors périmètre explicite de ce lot** : page marketing `/professionnels` (landing pro documentée au sitemap §2 mais jamais construite, indépendante du mécanisme d'abonnement lui-même) ; quotas/prix non configurables en back-office (cf. choix assumé ci-dessus).

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos ; page marketing `/professionnels` jamais construite ; côté anti-fraude (§16), restent non construits l'incohérence véhicule/prix et la détection de spam.

## Lot 80 — Page publique « Professionnels » (2026-09-06)

Repris directement de la dette signalée à la clôture du Lot 79 : dernière page documentée au sitemap (docs/ARCHITECTURE.md §2 : « /professionnels Landing pro (abonnements) ») restée non construite — le mécanisme d'abonnement existait depuis le Lot 79, mais aucune page publique ne le présentait à un visiteur non connecté avant de créer un compte.

**Livré**
- `/professionnels` (nouvelle page publique, accessible sans connexion) : présentation des fonctionnalités réellement livrées pour un compte pro (vitrine publique, import de stock en masse, collaborateurs avec permissions, statistiques, badge vérifié, réponse aux avis) — jamais un « outil avancé » ou un « export » inventé pour différencier les paliers, puisque le code ne différencie les paliers QUE par le quota d'annonces actives (§ Lot 79), pas par fonctionnalité.
- Tableau des 4 paliers avec quotas et prix affichés **directement depuis `src/lib/pro-subscription.ts`** (`SUBSCRIPTION_QUOTAS`/`SUBSCRIPTION_PRICES_DZD`, via deux nouvelles fonctions `quotaForTier`/`priceForAnyTier`) — jamais une copie recopiée à la main qui pourrait diverger silencieusement du mécanisme réel si les valeurs changent un jour.
- Bouton d'appel à l'action vers `/devenir-professionnel` (le formulaire de création existant, inchangé), lien ajouté au pied de page (à côté de « Toutes les wilayas »/« Souq Auto Mag »), page ajoutée au sitemap.xml avec BreadcrumbList schema.org.
- 4 nouveaux tests unitaires sur les deux fonctions ajoutées (`priceForAnyTier` gratuit pour Starter, cohérence avec `priceForTier` ; `quotaForTier` limité vs illimité). 370/370 tests au vert au total.
- Vérification de bout en bout en conditions réelles : chiffres affichés (Starter gratuit/5, Business 3000 DA/20, Pro 6000 DA/60, Premium 12000 DA/illimité) confirmés identiques aux constantes réelles du Lot 79, bouton d'action confirmé pointant vers `/devenir-professionnel`, lien pied de page fonctionnel, page présente dans sitemap.xml, JSON-LD BreadcrumbList validé. Rendu arabe RTL vérifié par capture d'écran (grille de fonctionnalités et tarifs correctement inversée), rendu mobile sans débordement.

Avec ce lot, plus aucune page de contenu ou de conversion documentée au sitemap (docs/ARCHITECTURE.md §2) ne reste non construite.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise), le remplacement des visuels de démonstration par de vraies photos, et les quotas/prix d'abonnement pro non configurables en back-office ; côté anti-fraude (§16), restent non construits l'incohérence véhicule/prix et la détection de spam.

## Lot 81 — Export de stock CSV (palier Pro/Premium) (2026-09-06)

Repris de docs/ARCHITECTURE.md §4-B (« Pro : Stock important + outils avancés (renouvellement auto, export) ») — jusqu'ici les 4 paliers d'abonnement (Lot 79) ne se distinguaient QUE par le quota d'annonces actives, aucune fonctionnalité réelle ne différenciait Pro/Premium de Starter/Business. La page `/professionnels` (Lot 80) l'affirmait d'ailleurs explicitement (« le même ensemble d'outils pour tous les paliers ») — cette affirmation aurait été rendue fausse par ce lot si elle n'avait pas été corrigée au passage.

**Livré**
- `stringifyCsv()` (`src/lib/csv.ts`) — inverse de `parseCsv()` (Lot 41), même discipline « format maison RFC4180, pas de bibliothèque » : un champ n'est mis entre guillemets que s'il contient une virgule/guillemet/retour à la ligne.
- `listingToCsvRow()`/`EXPORT_CSV_HEADER` (`src/lib/bulk-import.ts`) — même ordre de colonnes que l'import (Lot 41), pour qu'un fichier exporté puis modifié soit ré-importable tel quel sans adaptation.
- `GET /api/pro/accounts/[id]/export` — même garde de permission que l'import (propriétaire ou collaborateur `gererAnnonces`), plus une garde de palier (`canExportListings`, nouvelle fonction dans `src/lib/pro-subscription.ts`) : réservé aux paliers **Pro et Premium** uniquement, jamais Starter/Business — Premium hérite de l'avantage de Pro (palier strictement supérieur), ni l'un ni l'autre des deux paliers gratuits/intermédiaires n'est jamais mentionné avec cet outil dans le cahier des charges.
- `/pro/tableau-de-bord` : lien « Exporter mon stock (CSV) » visible uniquement quand le palier effectif le permet ; une note discrète (« disponible à partir du palier Pro ») s'affiche à la place pour Starter/Business, plutôt qu'une absence silencieuse qui masquerait l'existence même de la fonctionnalité.
- **Mise à jour honnête de `/professionnels`** (Lot 80) : la phrase affirmant que tous les paliers ont le même outillage a été corrigée, un badge « Export CSV du stock inclus » ajouté sur les cartes Pro/Premium uniquement, la liste de fonctionnalités mise à jour — jamais laisser une page marketing dériver du mécanisme réel qu'elle décrit.
- 10 nouveaux tests unitaires : `stringifyCsv` (dont un round-trip complet avec `parseCsv` sur un cas cumulant toutes les règles d'échappement), `listingToCsvRow` (ordre des colonnes, repli texte libre marque/modèle, ré-import round-trip via `mapCsvRowToListingInput`, encodage oui/non), `canExportListings` (Pro/Premium activés, Starter/Business jamais). 382/382 tests au vert au total.
- Vérification de bout en bout en conditions réelles, avec le compte pro de démonstration réel (Auto Sara Motors) : export refusé (403 `export_not_available`) au palier Starter par défaut ; après un vrai upgrade vers Pro approuvé par un admin réel, export accepté et confirmé contenant les 6 vraies annonces du compte (titres, descriptions avec virgules correctement échappées, marque/modèle/wilaya réels) ; **le fichier exporté a ensuite été ré-importé tel quel via `POST .../bulk-import` et accepté à 100 % (6 importées, 0 rejetée)** — preuve du round-trip réel, pas seulement unitaire. Doublons créés par ce test de ré-import supprimés après vérification, abonnement réinitialisé à Starter — état final (24 annonces au total, palier Starter, 6/5) confirmé strictement identique à l'avant-lot. RTL arabe et rendu mobile vérifiés par capture d'écran sur `/professionnels` (badge d'inclusion visible seulement sur Pro/Premium dans les deux langues).

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise), le remplacement des visuels de démonstration par de vraies photos, et les quotas/prix d'abonnement pro non configurables en back-office ; côté §4-B, le « renouvellement automatique » Pro reste non construit (nécessiterait de toucher la logique d'expiration paresseuse existante) ; côté anti-fraude (§16), restent non construits l'incohérence véhicule/prix et la détection de spam.

## Lot 82 — Renouvellement automatique (palier Pro/Premium) (2026-09-06)

Repris directement de la dette signalée à la clôture du Lot 81 : second volet de docs/ARCHITECTURE.md §4-B (« Pro : outils avancés (renouvellement auto, export) »), l'export étant livré au Lot 81. Referme entièrement la promesse « outils avancés » du palier Pro.

**Livré**
- `src/lib/pro-subscription.ts` : `canExportListings` renommée `hasAdvancedProTools` — les deux outils cités par le cahier des charges partagent exactement la même porte de palier (Pro/Premium), une seule fonction pour ne jamais laisser diverger deux vérifications censées être identiques.
- `Listing.autoRenew` (nouvelle colonne, migration hand-écrite, `false` par défaut) : préférence par annonce, jamais activée d'office même pour un compte éligible.
- `isEligibleForAutoRenewal()` (`src/lib/listing-lifecycle.ts`, fonction pure testée isolément) et `sweepAutoRenewals()` (`src/lib/listing-auto-renew-sweep.ts`, orchestration DB) — même principe de balayage paresseux que l'expiration elle-même (aucun scheduler dans cette application) : appelé **avant** `sweepExpiredListings` aux 3 mêmes points d'entrée (recherche, fiche annonce, mes-annonces), pour intercepter une annonce éligible avant qu'elle ne soit basculée en EXPIREE. L'éligibilité de palier du vendeur est revérifiée à **chaque balayage**, jamais mise en cache sur l'annonce — un compte rétrogradé entre l'activation et l'échéance ne bénéficie plus du renouvellement automatique, ses annonces expirent normalement. Renouvellement effectivement identique au renouvellement manuel (même prolongation, même entrée `ListingRenewal`, même remise à zéro du rappel d'expiration) + email de confirmation au vendeur (nouvelle famille `autoRenewed*`, même patron que le rappel d'expiration).
- `PATCH /api/listings/[id]/auto-renew` — activer exige le palier Pro/Premium au moment de la demande ; désactiver reste toujours possible, y compris pour un compte déjà rétrogradé.
- `/compte/mes-annonces` : case à cocher « Renouvellement automatique » par annonce, visible uniquement pour un vendeur (compte propre ou compte pro géré comme collaborateur) au palier requis — jamais pour un particulier.
- **Mise à jour honnête de `/professionnels`** (Lots 80-81) : fonctionnalité ajoutée à la liste, badge « Export CSV + renouvellement automatique inclus » sur les cartes Pro/Premium (remplace le badge export seul du Lot 81) — même discipline que le lot précédent, ne jamais laisser une page marketing dériver du mécanisme réel qu'elle décrit.
- 7 nouveaux tests unitaires sur `isEligibleForAutoRenewal` (activé+éligible, désactivé, palier redevenu insuffisant malgré la préférence laissée active, statut non PUBLIEE, date non encore atteinte) + renommage des tests `canExportListings`→`hasAdvancedProTools`. 387/387 tests au vert au total.
- Vérification de bout en bout en conditions réelles, avec le compte pro de démonstration réel (Auto Sara Motors) : activation bloquée (403 `advanced_tools_not_available`) au palier Starter ; après un vrai upgrade vers Pro approuvé par un admin réel, activation acceptée sur une annonce réelle (Toyota Corolla) ; date d'expiration de cette annonce ET d'une annonce témoin sans renouvellement automatique (Hyundai Elantra) reculées artificiellement à hier pour déclencher le balayage sans attendre 30 jours ; visite réelle d'une page déclenchant le balayage confirmant **exactement le comportement attendu** : l'annonce avec renouvellement automatique reste PUBLIEE avec une nouvelle date d'expiration et une entrée `ListingRenewal` réelle, l'annonce témoin bascule normalement en EXPIREE — email de renouvellement automatique confirmé reçu et lu via Ethereal (contenu correct : titre, nouvelle date, lien). Toutes les données de test restaurées à l'identique après vérification (dates d'expiration, statuts, préférence de renouvellement, abonnement ramené à Starter) — état final (24 annonces au total) confirmé strictement identique à l'avant-lot. RTL arabe et rendu mobile vérifiés par capture d'écran sur `/compte/mes-annonces`.

Avec ce lot, les deux « outils avancés » documentés pour le palier Pro (§4-B) sont désormais tous deux livrés.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise), le remplacement des visuels de démonstration par de vraies photos, et les quotas/prix d'abonnement pro non configurables en back-office ; côté anti-fraude (§16), restent non construits l'incohérence véhicule/prix et la détection de spam.

## Lot 83 — Quotas et prix d'abonnement pro configurables (2026-09-06)

Referme la dernière dette technique explicitement signalée sur les abonnements pro : les quotas/prix (Lot 79) étaient codés en dur, choix assumé à l'époque (« valeur fonctionnelle d'abord, éditable plus tard », même trajectoire que les seuils de suspension automatique, Lot 21→47) — devenu le moment de les rendre configurables.

**Livré**
- `ProSubscriptionSettings` (nouveau modèle singleton, migration hand-écrite), même patron que `PaymentSettings`/`ModerationSettings` : 3 quotas (Starter/Business/Pro) + 3 prix (Business/Pro/Premium). Premium reste **toujours illimité** — jamais un champ de quota pour lui, un nombre ne représenterait pas honnêtement « illimité ».
- Refactor de `src/lib/pro-subscription.ts` : `quotaForTier`/`priceForTier`/`priceForAnyTier` prennent désormais les settings réels en paramètre plutôt que de lire une constante interne — même patron que `priceForFormula` (Lot 66, formules d'annonce), pour ne jamais laisser une fonction lire une valeur figée à côté de la vraie source de configuration. `isWithinQuota` simplifiée pour prendre directement le quota déjà résolu (plus besoin de refournir palier + settings à ce point d'appel).
- `PATCH /api/admin/pro-subscription-settings` (ADMIN uniquement, même sensibilité que les coordonnées bancaires) + validation de cohérence explicite : chaque quota/prix doit être strictement croissant d'un palier au suivant (`Starter < Business < Pro`, `Business < Pro < Premium`) — un palier supérieur moins avantageux que le précédent n'aurait aucun sens commercial et n'est jamais silencieusement accepté.
- Nouvelle section « Abonnements professionnels — quotas et prix » sur `/admin/parametres`, même patron que le formulaire de paiement (Lot 66) : lecture seule pour un non-admin, formulaire complet sinon.
- `/professionnels` et `/pro/tableau-de-bord` lisent désormais les settings réels au lieu des anciennes constantes — un changement en back-office se reflète immédiatement partout, sans redéploiement.
- 5 nouveaux tests unitaires sur `validateQuota` + tests existants de `priceForTier`/`quotaForTier` étendus pour vérifier qu'un changement de settings est reflété immédiatement (jamais une valeur figée). 393/393 tests au vert au total.
- Vérification de bout en bout en conditions réelles : quota Pro modifié de 60 à 80 depuis `/admin/parametres`, changement confirmé **immédiatement répercuté** sur `/professionnels` (affichage public) sans redémarrage ; tentative de configuration incohérente (quota Business inférieur au quota Starter) rejetée avec `quotas_not_increasing` ; valeurs restaurées à l'identique (5/20/60, 3000/6000/12000 DA) après vérification. RTL arabe et rendu mobile du nouveau formulaire vérifiés par capture d'écran.

Avec ce lot, plus aucune dette technique n'est signalée sur le mécanisme d'abonnement professionnel (Lots 79-83).

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos ; côté anti-fraude (§16), restent non construits l'incohérence véhicule/prix et la détection de spam.

## Lot 84 — Quatrième signal anti-fraude : contenu dupliqué (spam) (2026-09-06)

Reprend le dernier volet de §16 jugé jusqu'ici trop vague pour être construit sans arbitrage : « spam ». Relu plus précisément, le cahier des charges cite explicitement « répétition de contenu ... pour un même vendeur » — un cas concret et honnêtement détectable sans base de marché : un texte d'annonce (titre+description) strictement identique republié par un AUTRE vendeur, signature classique d'une annonce-appât recopiée sous plusieurs faux comptes.

**Livré**
- `Listing.contentHash` (nouvelle colonne + index, migration hand-écrite, backfill des 24 annonces existantes — zéro collision confirmée) : empreinte du titre+description normalisés (espaces/casse ignorés), recalculée à chaque création/édition (`POST /api/listings`, `PATCH /api/listings/[id]`, import en masse) — même principe que `ListingPhoto.sha256` (Lot 77), jamais une comparaison floue.
- `computeListingContentHash()`/`detectDuplicateContent()` (`src/lib/fraud-signals.ts`) : signale un contenu identique publié par un AUTRE vendeur, jamais un vendeur qui republie son propre texte (renouvellement, annonce similaire pour un véhicule identique). Intégré à `getFraudSignalsForListings()` en une seule requête batch supplémentaire, même principe que les 3 signaux précédents.
- Quatrième bandeau ambre sur `/admin/annonces` (« ⚠ Texte identique à une annonce d'un autre vendeur »), même style et même règle non accusatoire que les signaux précédents.
- 7 nouveaux tests unitaires (déterminisme du hash, insensibilité à la casse/aux espaces, contenu différent → hash différent, détection cross-vendeur, jamais sur soi-même, hash vide ignoré). 400/400 tests au vert au total.
- **Limite documentée** : hash exact, pas un texte reformulé même légèrement — un spammeur qui paraphrase son annonce échappe à la détection, limite assumée comme pour les photos.
- Vérification de bout en bout en conditions réelles : deux vraies annonces soumises par deux comptes différents (Karim Boudiaf, Yasmine Cherif) avec un titre+description strictement identiques (casse et espaces volontairement différents pour vérifier la normalisation) — les deux confirmées signalées à la modération. Rendu arabe RTL vérifié par capture d'écran. Données de test supprimées après vérification — file de modération et nombre total d'annonces (24, 0 en attente) confirmés strictement identiques à l'état d'avant lot.

Avec ce lot, quatre des cinq signaux visés par §16 sont construits (prix anormalement bas, photos dupliquées, historique de refus vendeur, contenu dupliqué). Seule « l'incohérence véhicule/prix » reste non construite — en pratique déjà largement couverte par le signal de prix anormalement bas (Lot 77), qui compare intrinsèquement le véhicule (marque/modèle/année/km/wilaya) à son prix via les comparables réels ; une définition distincte nécessiterait un arbitrage produit supplémentaire pour ne pas dupliquer ce signal.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos.

## Lot 85 — Comparaison assistée « AI Compare » (2026-09-06)

Repris de docs/ARCHITECTURE.md §36 (phase V3 IA : « AI Listing, AI Price, AI Fraud, AI Compare, AI Advisor/Buyer, analyse photo ») — AI Listing (Lot 57) et la recherche en langage naturel (Lot 58) existaient déjà, AI Compare restait le seul volet naturellement autonome et raisonnablement scopé sans nouvelle décision produit. Le comparateur manuel (jusqu'à 4 véhicules, Lot 5) existait sans aucune synthèse pour aider à trancher.

**Livré**
- `src/lib/ai-compare.ts` : `computeCompareHighlights()` — fonction pure et déterministe qui identifie le moins cher, le moins kilométré, le plus récent, le plus puissant et le vendeur au score de confiance le plus élevé parmi les annonces comparées. Un classement (puissance, confiance) n'est **jamais** calculé si une seule annonce comparée manque la donnée — jamais un classement partiel qui ignorerait silencieusement une annonce.
- `generateCompareSummary()` : même patron exact que la suggestion de rédaction (Lot 57) — un vrai appel à l'API Anthropic si `ANTHROPIC_API_KEY` est configurée pour un court paragraphe de synthèse en langage naturel (fr/ar selon la langue active), sinon repli honnête (aucun paragraphe fabriqué, seuls les faits saillants structurés). L'IA ne reçoit que les données réelles déjà calculées et n'invente jamais une caractéristique absente.
- `POST /api/listings/compare-summary` (authentification requise, limite de débit resserrée comme pour la suggestion de rédaction) — relit toujours les annonces depuis la base par id, jamais les données fournies par le client, même discipline que `GET /api/listings/compare` existant.
- `/comparateur` : bouton « Voir une synthèse de la comparaison » (dès 2 annonces comparées), affichant les faits saillants via les traductions existantes (bilingue FR/AR gratuit) puis, si un vrai paragraphe IA a été généré, celui-ci en complément — jamais l'inverse. Message explicite si non connecté.
- 6 nouveaux tests unitaires sur `computeCompareHighlights` (identification correcte, aucun classement partiel sur puissance/confiance si une donnée manque). 406/406 tests au vert au total.
- Vérification de bout en bout en conditions réelles : 3 vraies annonces publiées (BMW/Hyundai/Mercedes, vendeurs et scores de confiance réels) comparées — synthèse générée confirmant correctement la Hyundai Tucson comme moins chère, moins kilométrée et la plus récente (aucune ambiguïté, valeurs numériques réelles vérifiées) ; aucun paragraphe IA affiché, cohérent avec l'absence de clé Anthropic sur cette machine (repli honnête, comme documenté pour AI Listing/recherche en langage naturel). Accès anonyme confirmé bloqué avec le message d'invitation à se connecter. RTL arabe vérifié par capture d'écran, rendu mobile sans débordement en dehors du tableau de comparaison lui-même (défilement horizontal déjà assumé pour ce tableau depuis le Lot 5).
- **Limite honnêtement documentée** : comme pour AI Listing (Lot 57) et la recherche en langage naturel (Lot 58), le chemin IA réel reste non vérifiable sur cette machine faute de clé Anthropic — seul le repli heuristique (déterministe, toujours actif) a été vérifié en conditions réelles.

Prochain lot proposé : à définir avec le porteur de projet — restent en dette technique mineure la vérification du chemin IA réel sur les 3 fonctionnalités IA existantes (clé Anthropic requise) et le remplacement des visuels de démonstration par de vraies photos ; côté §36, reste non construit AI Advisor/Buyer (assistant conversationnel acheteur, hors périmètre d'un lot autonome sans cadrage produit).

## Lot 86 — Analyse qualité photo (2026-09-06)

Dernier volet non construit de docs/ARCHITECTURE.md §36 (phase V3 IA) cité au lot précédent. Aucune clé Anthropic capable d'analyse d'image n'est de toute façon disponible sur cette machine — plutôt que fabriquer un jugement esthétique IA sans base réelle, ce lot livre une analyse statistique honnête (via `sharp`, déjà utilisé pour le pipeline photo depuis le Lot 2), présentée au vendeur comme telle, jamais comme un verdict automatisé définitif.

**Livré**
- `src/lib/photo-quality.ts` : `analyzePhotoQuality()` calcule 4 indicateurs à partir des statistiques réelles de l'image (résolution, luminosité moyenne, écart-type des canaux couleur) — `low_resolution`, `too_dark`, `too_bright`, `near_solid_color`. Seuils volontairement conservateurs, choisis pour ne viser que des cas extrêmes et sans ambiguïté (photo quasiment noire/blanche/unie) : le stat `sharpness` de `sharp` (détection de flou par laplacien) a été délibérément écartée faute de seuil calibré et vérifiable — jamais un chiffre inventé.
- `ListingPhoto.qualityFlags` (migration manuelle, même patron que `sha256`/Lot 77 et `contentHash`/Lot 84) : calculé une seule fois à l'upload dans `savePhoto()`, sur les mêmes octets déjà traités par le pipeline sharp existant (jamais un second passage sur le fichier brut).
- Persistance sur les deux points d'écriture de photo (`POST /api/listings`, `PATCH /api/listings/[id]`).
- Nudge privé au vendeur sur `/compte/mes-annonces` : liste les indicateurs détectés (bilingue FR/AR) avec lien direct vers l'édition de l'annonce — jamais affiché aux acheteurs, jamais remonté à la modération ni greffé aux signaux anti-fraude existants (`src/lib/fraud-signals.ts`) : une photo médiocre n'est pas un indice de malhonnêteté.
- 5 nouveaux tests unitaires sur `analyzePhotoQuality()` avec images de synthèse générées par `sharp` (résolution faible, image variée sans indicateur, noire, blanche, gris uni). 411/411 tests au vert au total.
- Vérification de bout en bout en conditions réelles : upload direct d'une vraie photo JPEG unie et sombre via `PATCH /api/listings/[id]` (formulaire multipart réel, pas seulement le calcul en isolation) — indicateurs `too_dark`+`near_solid_color` correctement calculés et persistés en base par le pipeline réel ; nudge confirmé affiché sur `/compte/mes-annonces` (FR et AR, capture d'écran RTL), aucun débordement en mobile (375×812) ; état de la base entièrement restauré après coup (24 annonces/24 photos, indicateurs et statut de l'annonce de test remis à l'identique).

Prochain lot proposé : à définir avec le porteur de projet — §36 (phase V3 IA) est désormais entièrement couvert à l'exception d'AI Advisor/Buyer, qui reste hors périmètre d'un lot autonome sans cadrage produit préalable.

## Lot 87 — Communes (2026-09-06)

Simplification volontaire assumée depuis le Lot 2 (docs/ARCHITECTURE.md §5 : seules les wilayas existaient, jamais le découpage commune). Repris à la demande explicite du porteur de projet après un état des lieux de la dette technique — seul point de cette liste qui avait du sens à traiter sans attendre une décision d'infrastructure (contrairement au passage à Redis, laissé de côté tant que l'app reste mono-instance).

**Livré**
- `Commune` (nouveau modèle, référentiel figé sous `Wilaya` comme au Lot 25 — pas d'édition back-office, seed uniquement) : 1541 communes officielles réparties sur les 58 wilayas. Source vérifiée avant tout code (cf. [[feedback_verify_external_formats]]) : jeu de données `othmanus/algeria-cities` (GitHub), explicitement sourcé du Ministère de l'Intérieur algérien, contrôlé avant intégration (1541 lignes, 58 codes wilaya de "01" à "58" correspondant exactement aux ids déjà en base, aucun doublon, aucun champ manquant) — jamais une liste inventée ou résumée de mémoire vu le volume (1541 lignes impossible à vérifier soi-même de tête).
- `Listing.communeId` (nullable — les 24 annonces de démo existantes et toute annonce sans commune choisie restent valides ; seule la wilaya reste obligatoire).
- Sélecteur commune en cascade sous wilaya, même patron exact que marque→modèle (Lot 2) : assistant de publication (étape 8), édition d'annonce, filtre de recherche avancée — n'apparaît que si la wilaya choisie a des communes (toutes en ont) et se réinitialise si la wilaya change.
- Vérification serveur systématique qu'une commune envoyée appartient réellement à la wilaya choisie (même discipline que brandId/modelId depuis le Lot 2) — jamais une commune fabriquée ou incohérente acceptée.
- Affichage « Commune, Wilaya » sur la fiche annonce et les cartes de résultats (recherche, accueil, pages marque/modèle/wilaya, vitrines vendeur/pro) quand une commune est renseignée, sinon la wilaya seule comme avant.
- Export de données personnelles (Lot 55) étendu avec la commune de chaque annonce, pour rester une extraction complète et honnête.
- 6 nouveaux tests unitaires : intégrité du jeu de données (1541 communes, ids uniques, les 58 wilayas toutes couvertes, noms FR/AR non vides) + filtre de recherche par commune. 417/417 tests au vert au total.
- Vérification de bout en bout en conditions réelles : annonce réellement publiée avec `communeId` (Bab El Oued, Alger) via l'API — apparaît dans la recherche filtrée sur cette commune (1 résultat), disparaît en filtrant sur une autre commune d'Alger (0 résultat), fiche annonce affichant bien « Bab El Oued, Alger » (et son équivalent arabe RTL, capture d'écran). Tentative délibérée d'envoyer une commune n'appartenant PAS à la wilaya choisie (Bab El Oued/Alger avec wilaya Blida) → rejetée `unknown_commune`. Mobile (375×812) sans débordement. Base entièrement restaurée après test (24 annonces, 1541 communes conservées comme référentiel).
- **Gotcha découvert et corrigé pendant la vérification des données source** : `require()` d'un fichier JSON téléchargé dans `/tmp` (chemin MSYS de Git Bash) échouait silencieusement côté Node natif Windows faute de résolution de chemin cohérente — recours à `cygpath -w` pour obtenir le chemin Windows réel avant de charger le fichier en Node.

**Hors périmètre délibéré** : pas de page SEO par commune (seules les wilayas en ont, Lot 75 — un chantier à part si souhaité), pas de colonne commune dans l'import/export CSV professionnel (Lots 41/81 — ajout possible dans un lot dédié sans complexifier celui-ci), pas de prise en compte de la commune dans le calcul de comparabilité de l'estimation de prix (resterait à l'échelle wilaya, un rétrécissement à l'échelle commune risquerait de vider le pool de comparables sur ce jeu de données de démonstration).

Prochain lot proposé : à définir avec le porteur de projet.

## Lot 88 — Profondeur de catalogue : générations (2026-09-06)

Second point de la dette technique mineure identifiée à la clôture du Lot 87 (le premier, communes, a été traité le même jour). Contrairement aux communes (source officielle unique), il n'existe aucune source fiable unique pour les générations de véhicules sur le marché algérien — le porteur de projet a explicitement choisi de vérifier modèle par modèle via recherche web plutôt que d'inventer les données ou d'abandonner le chantier.

**Livré**
- `Generation` (nouveau modèle, sous `Model`) : nom de génération (+ code châssis quand pertinent, ex. « Série 3 F30 ») et plage d'années réelles, chaque ligne vérifiée individuellement via la page Wikipédia du modèle concerné avant intégration — jamais une donnée inventée ou résumée de mémoire.
- **Couverture volontairement partielle et explicitement documentée** : seulement les 24 modèles réellement utilisés par les annonces de démonstration (Lot 71), pas les 108 du catalogue — 67 générations au total. Un modèle sans génération référencée n'affiche simplement pas le sélecteur, jamais un choix forcé ou une valeur par défaut inventée.
- Détail authentique trouvé en vérifiant : la Dacia Sandero II a été spécifiquement produite en Algérie de 2016 à 2021 (Wikipédia) — utilisé tel quel plutôt que sa plage de production mondiale générique, plus pertinent pour ce marché.
- Sélecteur en cascade marque→modèle→génération à la publication (étape 2) et à l'édition, même patron exact que marque→modèle (Lot 2) et wilaya→commune (Lot 87) : n'apparaît que si le modèle choisi a des générations référencées, se réinitialise en cascade si la marque ou le modèle change.
- Vérification serveur qu'une génération envoyée appartient réellement au modèle choisi (même discipline anti-fabrication que brandId/modelId/communeId).
- Affichage sur la fiche annonce (ligne « Génération » dans les caractéristiques) et export de données personnelles (Lot 55) étendu.
- 5 nouveaux tests unitaires sur l'intégrité du jeu de données (pas de doublon, années plausibles, cohérence début/fin, couverture exacte des 24 modèles documentés). 422/422 tests au vert au total.
- Vérification de bout en bout en conditions réelles : annonce réellement publiée avec génération choisie (Peugeot 208 II, 2019–aujourd'hui) via l'API → affichée correctement sur la fiche annonce (FR et AR RTL) et pré-sélectionnée à la ré-ouverture du formulaire d'édition. Tentative délibérée d'envoyer une génération n'appartenant PAS au modèle choisi (génération Clio sur une annonce Peugeot 208) → rejetée `unknown_generation`. Mobile (375×812) sans débordement. Base restaurée après test (24 annonces, 67 générations conservées comme référentiel).

**Hors périmètre délibéré** : pas de niveau « version/moteur » (motorisation, puissance, cylindrée par génération — docs/ARCHITECTURE.md §5) : ces caractéristiques varient trop par marché/finition pour être vérifiées de façon fiable à ce stade, et l'annonce porte déjà ses propres champs réels (carburant, puissance, boîte) directement saisis par le vendeur, sans dépendre d'une fiche technique par génération. Pas de filtre de recherche par génération (ajouterait un troisième niveau de cascade à `SearchFilters`, jugé disproportionné pour une donnée à couverture partielle). Génération non intégrée au calcul de comparabilité de l'estimation de prix (même raison que la commune au Lot 87 : risque de vider le pool de comparables sur ce jeu de démonstration).

Prochain lot proposé : à définir avec le porteur de projet — la dette technique mineure identifiée est désormais entièrement traitée (communes + générations), à l'exception du passage à Redis pour le rate limiting/messagerie temps réel, explicitement écarté tant que l'application reste mono-instance.

## Lot 89 — AI Advisor : conseiller d'achat conversationnel (2026-09-15)

Dernier volet non construit de docs/ARCHITECTURE.md §36 (phase V3 IA), documenté comme « hors périmètre d'un lot autonome sans cadrage produit » à la clôture des Lots 85 et 88. Cadré avec le porteur de projet avant tout code : découverte guidée en conversation multi-tours, page dédiée authentifiée, aucune persistance.

**Livré**
- `src/lib/ai-advisor.ts` : même patron exact que les Lots 57/58/85 (un seul appel Anthropic par tour, repli heuristique honnête sans clé). Décisive : **un seul appel par tour**, pas deux — le schéma de réponse de l'IA ne contient structurellement aucun champ où décrire une annonce précise (seulement des filtres assainis via `sanitizeParsedFilters` du Lot 58, ou une question de clarification portant uniquement sur les critères), donc l'absence de fabrication est garantie par construction plutôt que par un second appel de vérification.
- Repli heuristique réellement fonctionnel (jamais un stub) : extraction par sous-chaînes/mots-clés (marque, modèle, wilaya, carburant, boîte, état, prix, année), cumulée sur tous les messages de la conversation. Règle de décision déterministe : question de clarification fixe uniquement au premier tour sans aucun signal, recherche dans tous les autres cas (jamais une deuxième question). Le résidu texte libre (`q`) n'est utilisé QUE quand aucun critère structuré n'a été trouvé — un critère structuré combiné au texte intégral de la phrase aurait produit un ET impossible à satisfaire, bug identifié et corrigé pendant l'implémentation avant tout test.
- `POST /api/listings/advisor-chat` (authentification requise, `checkRateLimit` 10/heure/utilisateur — même limite que `suggest`/`compare-summary`) : le client envoie toute la transcription à chaque tour (serveur sans état). Les filtres retournés par l'IA/l'heuristique sont revalidés par `searchParamsSchema` (Lot 3) puis passés tels quels à `buildListingWhere`/`buildListingOrderBy` (`src/lib/search.ts`, inchangés) — zéro code d'adaptation, les deux schémas partagent déjà la même forme. Le texte de présentation des résultats est toujours un gabarit serveur traduit (`AiAdvisor.resultsFound`/`noResults`), jamais du texte IA.
- `listingCardInclude`/`ListingWithCardRelations` extraits de `recherche/page.tsx` vers `src/lib/search.ts` (dé-duplication, comportement inchangé) — réutilisés par le nouvel endpoint.
- `/compte/assistant-achat` (page authentifiée, même garde que `/compte/favoris`) + `AiAdvisorChat` (composant client, `fetch` simple par tour comme `/comparateur`, pas de SSE) avec un sous-composant `AdvisorListingCard` présentationnel pointant vers la vraie fiche annonce. Plafond de 10 tours côté client sous le plafond de validation serveur (21 messages).
- Lien `Nav.aiAdvisor` ajouté dans `SiteHeader.tsx` ; page volontairement absente de `sitemap.xml` (authentifiée, comme tout `/compte/*`).
- 7 nouveaux tests unitaires sur `runHeuristicTurn`/`runAdvisorTurn` (extraction, cumul entre tours, jamais deux questions, jamais de résidu texte libre combiné à un critère structuré, repli sans clé). 429/429 tests au vert au total.
- Vérification de bout en bout en conditions réelles, avec deux comptes de démonstration réels (Karim Boudiaf, Yasmine Cherif) : message vague → question de clarification fixe confirmée ; message précis (« une Peugeot 208 a Alger ») → recherche réelle confirmée (« 1 annonce(s) correspondent... », annonce réelle Peugeot 208 2019/2 700 000 DA), carte cliquée menant bien à la vraie fiche annonce. Rate limit réel confirmé (8 appels directs + 3 via l'interface → 429 exact au 11ᵉ message, message traduit affiché). Mobile (375×812) et arabe RTL vérifiés par capture d'écran (bulles et formulaire correctement inversés).
- **Limite découverte et honnêtement documentée pendant la vérification** : le repli heuristique ne reconnaît les marques/wilayas que dans leur graphie latine (`Brand.name`/`Wilaya.nomFr`) — un message entièrement en écriture arabe (« بيجو 208 في الجزائر ») n'extrait aucun critère et dégrade proprement vers une question de clarification puis, faute de nouveau signal, vers une recherche sans résultat plutôt qu'une erreur. Un utilisateur écrivant en arabe avec des noms de marque/wilaya en graphie latine (usage courant, ex. « Peugeot ») n'est pas affecté.

**Hors périmètre délibéré** : pas de persistance (conversation perdue au rechargement, aucune table) ; pas de streaming/SSE ; pas d'intégration avec le comparateur (`CompareContext`) depuis le chat ; pas de saisie vocale ni de recherche par photo ; pas de visibilité admin/analytics sur les conversations ; pas d'anglais (cohérent avec le reste du site, seuls fr/ar existent réellement).

Prochain lot proposé : à définir avec le porteur de projet — la vérification du chemin IA réel reste impossible sur cette machine (pas de clé Anthropic, limite désormais documentée depuis les Lots 57/58/85/89) ; la reconnaissance heuristique de marques/wilayas en graphie arabe (limite ci-dessus) pourrait être ajoutée si jugée prioritaire ; le paiement (toujours en attente d'identifiants réels) et le passage à Redis restent les grands chantiers d'infrastructure non engagés.

## Lot 90 — Passage à Redis (rate limiting + messagerie temps réel) (2026-09-15)

Repris directement de docs/ARCHITECTURE.md §6 (« Cache/rate-limit/queues : Redis + BullMQ ») et de la dette explicitement documentée depuis `src/lib/rate-limit.ts`/`src/lib/realtime.ts` (Lot 8/40) : compteur de débit et pub/sub de messagerie en mémoire, `« suffisant tant que l'application reste mono-instance »`. Demandé explicitement par le porteur de projet. BullMQ (files de jobs) reste hors périmètre : aucun besoin de job asynchrone n'existe dans l'application aujourd'hui (tout fonctionne par balayage paresseux, cf. Lot 82), l'introduire maintenant serait construire pour un besoin hypothétique.

**Livré**
- `src/lib/redis.ts` (nouveau) : client `ioredis` partagé via `globalThis` (même patron que le client Prisma unique), `null` tant que `REDIS_URL` n'est pas configurée. Deux connexions distinctes (`getRedisClient`/`getRedisSubscriberClient`) — une connexion Redis abonnée (PSUBSCRIBE) ne peut plus exécuter d'autre commande, contrainte du protocole.
- `checkRateLimit()` (`src/lib/rate-limit.ts`) devient asynchrone : `INCR`/`PEXPIRE` Redis (fenêtre fixe partagée entre toutes les instances) quand `REDIS_URL` est configurée, repli en mémoire strictement identique à l'ancien comportement sinon — y compris si Redis devient injoignable EN COURS DE ROUTE (jamais un blocage de l'application pour un problème d'infrastructure annexe). Tous les 38 points d'appel existants (routes API) mis à jour avec `await` — migration mécanique, aucune limite ni fenêtre modifiée.
- `publishToConversation()`/`subscribeToConversation()` (`src/lib/realtime.ts`) : `PSUBSCRIBE conversation:*` sur une connexion dédiée, chaque instance republie localement (SSE) ce qu'elle reçoit du canal Redis — y compris ses propres publications (un seul chemin de livraison, jamais un `deliverLocally` direct en plus de Redis pour éviter deux chemins à garder synchronisés). Repli diffusion locale identique à l'ancien comportement sinon.
- `REDIS_URL` documentée dans `.env.example`, optionnelle — mêmes disclaimers honnêtes que `ANTHROPIC_API_KEY`.
- 13 nouveaux tests unitaires (`tests/rate-limit.test.ts`, `tests/realtime.test.ts`) sur le repli en mémoire (limite atteinte, compteurs indépendants par clé, réinitialisation de fenêtre via horloge factice, livraison multi-abonnés, isolation entre conversations, désabonnement) — jamais le vrai chemin Redis, même discipline que les tests IA existants qui ne mockent jamais le réseau. 437/437 tests au vert au total.
- **Vérification de bout en bout en conditions réelles**, avec un vrai serveur Redis local (installé sur cette machine pour ce lot) et **deux process serveur indépendants** (`next start` sur deux ports, simulant deux instances derrière un load balancer — `next dev` refuse un second process sur le même répertoire, `next start` n'a pas cette limite) :
  - Rate limit partagé confirmé au compteur près : 5 appels réels à l'instance A puis 3 à l'instance B → compteur Redis à 8 (jamais deux compteurs séparés à 5 et 3) ; poussé jusqu'à 30, le 31ᵉ appel — fait sur l'instance B après que A a consommé le quota — rejeté `429` comme attendu.
  - Messagerie temps réel confirmée entre instances : flux SSE ouvert sur l'instance A pour une vraie conversation, message réellement envoyé via l'instance B → événement reçu en direct sur le flux SSE de l'instance A (jamais visible avant ce lot, chaque instance ayant son propre pub/sub en mémoire).
  - Repli honnête confirmé : serveur Redis coupé en cours de route → les deux mécanismes continuent de répondre `200`/`201` sans erreur, journaux serveur montrant explicitement `[rate-limit] Redis indisponible, repli en mémoire` et `[realtime] Redis indisponible, repli diffusion locale`. Redis relancé → compteur partagé de nouveau actif automatiquement, sans redémarrage de l'application.
  - Stratégie de reconnexion ajoutée (`retryStrategy`, jusqu'à 10s entre tentatives) après avoir constaté que le défaut `ioredis` (retente toutes les 50-2000ms indéfiniment) noyait les journaux pendant la coupure de test.
  - Données de test (conversation + 2 messages) supprimées après vérification.

**Hors périmètre délibéré** : BullMQ/files de jobs (aucun besoin identifié aujourd'hui, cf. ci-dessus) ; sessions/authentification (déjà sans état, JWT — jamais concernées par le passage à Redis) ; cache applicatif générique (seuls le rate limiting et la messagerie avaient un état mono-instance réel à corriger).

Prochain lot proposé : à définir avec le porteur de projet — avec ce lot, plus aucun état mutable mono-instance ne subsiste dans le code applicatif (les deux seuls identifiés, `src/lib/rate-limit.ts` et `src/lib/realtime.ts`, sont désormais couverts) ; le paiement (toujours en attente d'identifiants réels) reste le seul grand chantier d'infrastructure non engagé.

## Lot 91 — Reconnaissance heuristique arabe (AI Advisor) (2026-09-15)

Reprend la limite honnêtement documentée à la clôture du Lot 89 : le repli sans clé Anthropic de l'assistant conseiller (`src/lib/ai-advisor.ts`) ne reconnaissait les marques/wilayas qu'en graphie latine (`Brand.name`/`Wilaya.nomFr`), vérifié en conditions réelles avec « بيجو 208 في الجزائر » qui n'extrayait aucun critère.

**Livré**
- Wilaya reconnue en arabe via `Wilaya.nomAr` — donnée officielle déjà en base depuis le Lot 87 (communes), aucune nouvelle donnée à vérifier. `CatalogWilaya` (`src/lib/ai-search.ts`) étend son type avec un `nomAr` optionnel ; `/api/listings/advisor-chat` le sélectionne désormais depuis Prisma.
- Carburant/boîte/état reconnus en arabe (`ديزل`/`بنزين`/`غاز البترول المسال`/`هجين`/`كهربائي`, `يدوي`/`أوتوماتيكي`, `جديدة`/`مستعملة`) — mots repris tels quels des traductions déjà existantes et vérifiées de l'application (`messages/ar.json`, namespaces Wizard/Listing), jamais une traduction inventée pour ce lot.
- Prix reconnu en arabe (`مليون`, `دج` — mêmes mots que `messages/ar.json`) : « أقل من 4 مليون دج » → `priceMax`. Volontairement limité aux chiffres occidentaux (0-9), jamais les chiffres indo-arabes ٠-٩ : l'usage algérien courant reste les chiffres occidentaux même en écrivant en arabe (héritage du français, contrairement au Machrek) — pas une lacune, l'usage réel n'est simplement pas couvert par des chiffres qui ne s'y emploient pas.
- **Bug corrigé au passage, pas seulement une extension arabe** : `\b` (frontière de mot native JS) se base sur `\w` ([A-Za-z0-9_] uniquement) et échoue silencieusement dès qu'un mot est entouré de caractères non-`\w` des deux côtés — le cas de tout mot arabe entouré d'espaces. Remplacé partout par une frontière compatible Unicode (`(?<![\p{L}\p{N}])...(?![\p{L}\p{N}])`, drapeau `u`), qui corrige aussi un bug latent côté français/anglais (jamais remarqué faute d'avoir testé un mot en tout début/fin de message).
- **Hors périmètre assumé, pas une omission** : marque/modèle restent reconnus uniquement en graphie latine — `Brand.name`/`Model.name` n'ont aucun équivalent arabe en base (contrairement à `Wilaya.nomAr`), une table de translittération phonétique (« بيجو » → Peugeot) ne serait vérifiable marque par marque qu'avec le même sérieux que les communes/générations (Lots 87/88), un chantier à part si souhaité. Le code-switching (marque en latin au sein d'une phrase arabe, ex. « أريد Peugeot 208 ») continue de fonctionner normalement, aucune régression.
- 6 nouveaux tests unitaires (wilaya arabe, carburant/boîte/état arabes, prix arabe, non-reconnaissance assumée de la marque en translittération, code-switching latin/arabe, cumul de critères arabes et latins sur deux tours). 443/443 tests au vert au total.
- Vérification de bout en bout en conditions réelles, avec le compte de démonstration réel Yasmine Cherif en interface arabe : « بيجو 208 في الجزائر » → recherche réelle lancée dès le premier tour (9 annonces, toutes bien situées à Alger — la marque Peugeot n'a, comme attendu, PAS filtré les résultats, confirmant que la limite assumée fonctionne honnêtement plutôt que silencieusement) ; « سيارة ديزل أوتوماتيكي مستعملة » → 5 annonces réelles diesel/automatique/occasion tous wilayas confondues ; « أقل من 4 مليون دج » → 17 annonces réelles, toutes sous ce prix. Aucune donnée de test créée (recherches en lecture seule uniquement).

**Hors périmètre délibéré** : translittération arabe des marques/modèles (cf. ci-dessus, chantier séparé nécessitant une vérification source par source comme les Lots 87/88) ; chiffres indo-arabes ٠-٩ (non pertinent pour l'usage algérien, cf. ci-dessus) ; fourchette de prix (min ET max) en texte libre, toujours hors périmètre du Lot 89 d'origine.

Prochain lot proposé : à définir avec le porteur de projet — la translittération arabe des marques/modèles (ci-dessus) est le candidat naturel si jugée prioritaire, sinon le paiement (toujours en attente d'identifiants réels) reste le seul grand chantier d'infrastructure non engagé.

## Lot 92 — Translittération arabe des marques (AI Advisor) (2026-09-15)

Reprend le candidat identifié à la clôture du Lot 91 : les marques restaient reconnues uniquement en graphie latine dans le repli sans clé Anthropic, faute d'équivalent arabe en base (contrairement à `Wilaya.nomAr`, déjà utilisé depuis le Lot 91).

**Livré**
- `Brand.nameAr` (nouvelle colonne nullable, migration hand-écrite) : référentiel volontairement PARTIEL, même discipline que les générations (Lot 88) — uniquement les 19 marques réellement utilisées par les annonces de démonstration (sur les 24 du catalogue), chaque nom vérifié individuellement via l'article Wikipédia arabe de la marque concernée (deux recherches indépendantes menées en parallèle, une par lot de marques, jamais une translittération inventée de mémoire). Les 5 marques du catalogue non utilisées par une annonce réelle (Chevrolet, Geely, Haval, Volvo, Mitsubishi) restent `nameAr: null` — pas une lacune, une limite assumée comme pour les générations.
- **Modèles explicitement hors périmètre** : `Model.name` reste en graphie latine uniquement — la plupart des modèles sont des codes alphanumériques (« 208 », « X5 », « i20 ») qui restent en usage réel écrits en latin même dans une phrase arabe, contrairement aux noms de marque ; un chantier séparé si souhaité pour les modèles à nom propre (Corolla, Tucson, Sportage...).
- `findCatalogMatch()` (`src/lib/ai-advisor.ts`) reconnaît désormais une marque via `Brand.name` OU `Brand.nameAr` — une marque non encore vérifiée (`nameAr` `null`) n'est simplement reconnue qu'en latin, jamais un texte fabriqué à sa place (garanti par construction : `nameAr ?? undefined` ne produit jamais de chaîne vide à matcher). `CatalogBrand` (`src/lib/ai-search.ts`) étend son type avec un `nameAr` optionnel, même patron que `CatalogWilaya` (Lot 91) ; la liste de marques transmise au vrai appel Anthropic inclut aussi le nom arabe désormais connu, cohérence entre repli heuristique et chemin IA réel.
- 3 tests unitaires ajustés/ajoutés (reconnaissance d'une marque en translittération arabe vérifiée, marque reconnue même sans modèle en arabe, non-reconnaissance honnête d'une marque non encore vérifiée — nouveau fixture "Chevrolet" sans `nameAr`, miroir du référentiel réel). 445/445 tests au vert au total.
- Vérification de bout en bout en conditions réelles, avec le compte de démonstration réel Yasmine Cherif en interface arabe : « بيجو » seul (aucun autre signal) → recherche réelle lancée dès le premier tour, 1 annonce réelle trouvée (Peugeot 208 2019, 2 700 000 DA) — confirmé correspondre exactement à l'unique annonce Peugeot publiée. Base restaurée identique après vérification (24 annonces, 9 utilisateurs, aucune mutation — recherches en lecture seule uniquement).
- **Gotcha rencontré et contourné pendant la migration** : `npx prisma migrate dev` a détecté un écart de checksum sur deux migrations déjà appliquées et proposait un `reset` complet de la base (perte des 24 annonces de démonstration réelles) — `npx prisma migrate status` confirmait pourtant le schéma à jour, l'écart ne concernait que la base de données fantôme utilisée pour le diff. Contourné sans toucher aux données réelles : SQL de migration appliqué directement via `prisma db execute`, puis enregistré comme appliqué via `prisma migrate resolve --applied` — jamais de `migrate reset`.

**Hors périmètre délibéré** : translittération arabe des modèles (cf. ci-dessus) ; les 5 marques du catalogue non démontrées (cf. ci-dessus) ; chiffres indo-arabes, toujours hors périmètre du Lot 91.

Prochain lot proposé : à définir avec le porteur de projet — la translittération arabe des modèles à nom propre serait le prolongement naturel si jugée prioritaire ; sinon le paiement (toujours en attente d'identifiants réels) reste le seul grand chantier d'infrastructure non engagé.

## Lot 93 — Cinquième signal anti-fraude : incohérence véhicule (§16) (2026-09-15)

Referme §16 : depuis le Lot 84, « incohérence véhicule/prix » restait le seul des cinq signaux visés par le cahier des charges non construit, faute de définition qui ne duplique pas le signal « prix bas » (Lot 77, qui compare le prix aux vraies annonces comparables). Arbitrage demandé et tranché avec le porteur de projet avant tout code : signal d'incohérence **kilométrage/année vs état déclaré « Neuf »**, volontairement indépendant de tout prix ou comparable.

**Livré**
- `detectVehicleInconsistency()` (`src/lib/fraud-signals.ts`) : une annonce déclarée `condition: NEUF` avec un kilométrage significatif (> 500 km, seuil conservateur — laisse une marge large pour convoyage/essai) OU une année trop ancienne (> 2 ans) est incohérente. Ne reçoit ni prix ni estimation de marché en paramètre — l'indépendance vis-à-vis de `detectLowPrice` est garantie par la signature de la fonction, pas seulement par convention. Comble au passage un vrai trou de couverture du signal prix bas : celui-ci ne s'applique qu'à partir de 3 annonces comparables en base (`MIN_SAMPLE_SIZE_FOR_LOW_PRICE_SIGNAL`), donc aucune vérification de prix n'existait pour les marques/modèles rares — ce nouveau signal, purement déclaratif, s'applique quel que soit le nombre de comparables.
- `FraudSignals.vehicleInconsistency` intégré à `getFraudSignalsForListings()` (aucune requête supplémentaire — `condition` déjà disponible sur chaque annonce) et à `/admin/annonces` (5ᵉ bandeau ambre, même style non accusatoire que les quatre existants).
- 6 nouveaux tests unitaires (jamais sur une annonce « Occasion », jamais sur un véhicule neuf plausible, seuils de kilométrage et d'année testés à la limite exacte documentée). 451/451 tests au vert au total.
- Vérification de bout en bout en conditions réelles : annonce réellement soumise via l'API (`POST /api/listings`, vraie photo, vrai compte vendeur Karim Boudiaf) avec `condition: NEUF` et 15 000 km → confirmée signalée dans la file de modération réelle (`/admin/annonces`, connecté en admin réel) avec le bandeau « ⚠ Kilométrage/année incohérent avec l'état « Neuf » ». Donnée de test (annonce + photo sur disque) supprimée après vérification — total d'annonces (24) confirmé strictement identique à l'état d'avant lot.

Avec ce lot, les cinq signaux anti-fraude visés par §16 sont désormais tous construits (prix anormalement bas, photos dupliquées, historique de refus vendeur, contenu dupliqué, incohérence véhicule).

**Hors périmètre délibéré** : aucune autre combinaison d'incohérence interne (ex. `firstHand`/kilométrage, `accidented`/prix) — seule la paire état/kilométrage-année était suffisamment objective pour être vérifiée sans base de marché ; un chantier à part si d'autres incohérences déclaratives sont jugées pertinentes.

Prochain lot proposé : à définir avec le porteur de projet — §16 (anti-fraude) est désormais entièrement couvert. La translittération arabe des modèles à nom propre (Lot 92) ou le paiement (toujours en attente d'identifiants réels) restent les candidats naturels.

## Lot 94 — Translittération arabe des modèles à nom propre (AI Advisor) (2026-09-15)

Prolonge le Lot 92 (marques) : les modèles restaient reconnus uniquement en graphie latine, faute d'équivalent arabe en base.

**Livré**
- `Model.nameAr` (nouvelle colonne nullable, migration hand-écrite — SQL appliqué via `prisma db execute` + `migrate resolve --applied`, même méthode sûre que le Lot 92 pour éviter le piège de reset découvert alors) : référentiel volontairement PARTIEL, uniquement les 19 modèles à nom propre réellement utilisés par les annonces de démonstration (sur les 24 modèles au total) — chaque nom vérifié via Wikipédia arabe (deux agents de recherche en parallèle, même méthode que le Lot 92). **Exception** : « Tiggo » (Chery Tiggo 7) n'a pas d'article Wikipédia arabe dédié — confirmé indépendamment via cinq sites automobiles arabophones réels (hatla2ee, chery-eg, egy-car, arabwheels, cheryalghanim) plutôt que d'être écarté ou inventé.
- Les 5 modèles alphanumériques restants (208, Q3, Série 3, C4, Classe C — codes, jamais des noms propres) restent volontairement de simples chaînes sans `nameAr`, même raisonnement que pour les marques non démontrées.
- `findCatalogMatch()` (`src/lib/ai-advisor.ts`) reconnaît un modèle via `Model.name` OU `Model.nameAr`, même patron exact que les marques (Lot 92).
- **Amélioration découverte en écrivant les tests, pas seulement une extension arabe** : un modèle cité seul, sans nommer sa marque (ex. « كليو » ou « Clio » sans « Renault »/« رينو ») ne remontait auparavant AUCUN critère — la recherche de modèle n'avait jamais lieu (imbriquée dans le `if (brand)`, jamais atteinte si la marque n'était pas d'abord reconnue). Un acheteur nomme rarement marque ET modèle en toutes lettres dans une phrase informelle ; corrigé pour chercher aussi parmi tous les modèles quand aucune marque n'a été reconnue, retrouvant alors la marque implicitement via le modèle. Bénéficie au latin comme à l'arabe, pas seulement à ce lot.
- 5 tests unitaires ajustés/ajoutés (reconnaissance d'un modèle en translittération arabe, modèle retrouvé sans mention de marque, non-reconnaissance honnête d'un modèle non encore vérifié) + 1 test d'intégrité du référentiel (`catalogue-data.ts` : aucun `nameAr` vide). 455/455 tests au vert au total.
- Vérification de bout en bout en conditions réelles, avec le compte de démonstration réel Karim Boudiaf en interface arabe : « كليو » seul (aucune mention de marque) → recherche réelle dès le premier tour, trouve exactement la vraie annonce Renault Clio 2018 ; « أوكتافيا » seul → trouve exactement la vraie annonce Skoda Octavia 2017. Base restaurée identique après vérification (24 annonces, 9 utilisateurs — recherches en lecture seule uniquement).

**Hors périmètre délibéré** : les codes alphanumériques (cf. ci-dessus) ; les modèles des 5 marques du catalogue non démontrées (cohérent avec le Lot 92).

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand chantier d'infrastructure non engagé ; la vérification du chemin IA réel reste bloquée faute de clé Anthropic sur cette machine.

## Lot 95 — Relecture qualité des Lots 89-94, 4 correctifs (2026-09-15)

Passe de relecture qualité demandée par le porteur de projet sur l'ensemble des Lots 89-94 (assistant IA, Redis, reconnaissance/translittération arabe, 5ᵉ signal anti-fraude) : 8 angles de recherche en parallèle, 10 constats retenus après vérification adversariale (1 vote CONFIRMED/PLAUSIBLE/REFUTED par constat). 4 bugs de correction confirmés et corrigés ; les 6 autres constats (réutilisation/simplification/efficacité/architecture) documentés mais volontairement non traités dans ce lot.

**Corrigé**
- **Collision de nom de modèle entre marques** (`src/lib/ai-advisor.ts`) : « Duster » existe à la fois chez Dacia et Renault — un modèle cité seul sans sa marque ne choisit plus arbitrairement la première marque trouvée dans le tableau (`Array.find`, ordre non garanti par Prisma) ; si le nom correspond à plusieurs marques distinctes, aucune marque n'est assignée plutôt qu'un choix au hasard.
- **Homographe français « neuf »** (`src/lib/ai-advisor.ts`) : « neuf » (état du véhicule) est aussi le nombre 9 en français. Une phrase comme « moins de neuf cent mille da » ne déclenche plus `condition: NEUF` par erreur (et « dix-neuf » n'est plus confondu non plus) — le cas normal (« neuf » seul) reste inchangé.
- **Nom arabe trop générique pour Chery Tiggo 7** (`prisma/catalogue-data.ts`) : `nameAr: "تيجو"` (sans le chiffre) matchait aussi un message mentionnant Tiggo 3 ou Tiggo 8 (non vérifiés). Corrigé en `"تيجو 7"` (chiffre inclus, vérifié via plusieurs sites automobiles réels) — un modèle non vérifié n'est désormais plus jamais deviné à sa place.
- **Abonnement Redis jamais retenté après un échec** (`src/lib/realtime.ts`) : un PSUBSCRIBE échoué au tout premier abonné bloquait silencieusement toute diffusion temps réel Redis pour le reste de la vie du process (aucun repli local une fois `REDIS_URL` configurée). La prochaine tentative d'abonnement retente désormais le PSUBSCRIBE, sans jamais dupliquer le gestionnaire de message.
- 8 nouveaux tests de régression (collision de marque, homographe « neuf »/« dix-neuf », translittération Tiggo, nouvelle tentative Redis avec client mocké). 463/463 tests au vert au total.
- Vérification de bout en bout en conditions réelles pour les 3 premiers correctifs : « Duster à Alger » retourne désormais les 9 annonces réelles d'Alger toutes marques confondues (au lieu de filtrer silencieusement sur Renault) ; la réponse API confirmée par inspection réseau ne contient plus `condition` pour « neuf cent mille » ; « تيجو 3 » ne renvoie plus la fiche Tiggo 7 (clarification honnête) alors que « تيجو 7 » continue de trouver la vraie annonce Chery Tiggo 7. Le correctif Redis est vérifié par test unitaire avec client mocké (le vrai chemin Redis multi-instance a déjà été vérifié en conditions réelles au Lot 90).

**Documenté, non corrigé dans ce lot** : 4ᵉ copie du code Anthropic (`ai-advisor.ts`/`ai-search.ts`/`ai-compare.ts`/`ai-listing.ts`, jamais factorisée) ; `INCR`+`PEXPIRE` Redis en deux allers-retours réseau au lieu d'un ; deux branches quasi identiques pour la recherche marque/modèle dans `extractFiltersFromText` ; duplication de la logique d'affichage marque/modèle/wilaya entre `AdvisorListingCard` et `ListingCard` ; requêtes Prisma séquentielles non parallélisées dans `getFraudSignalsForListings` ; le contournement `prisma db execute`/`migrate resolve --applied` répété à chaque migration récente reste un problème d'outillage non résolu à la racine.

Prochain lot proposé : à définir avec le porteur de projet — les 6 constats qualité non traités ci-dessus, sinon le paiement (toujours en attente d'identifiants réels) reste le seul grand chantier d'infrastructure non engagé.

## Lot 96 — Stockage des photos sur S3-compatible (2026-09-15)

Repris de `docs/ARCHITECTURE.md` §6 (« Stockage médias : Objet compatible S3 ») et suggéré au porteur de projet comme prochain verrou multi-instance après Redis (Lot 90) : les photos (annonces, avatars, pièces jointes de messagerie) restaient écrites sur le disque local du serveur (`src/lib/uploads.ts`), invisibles depuis une autre instance — exactement le problème que Redis vient de résoudre pour le rate limiting et la messagerie, cette fois pour les fichiers. Demandé explicitement par le porteur de projet.

**Livré**
- `src/lib/storage.ts` (nouveau) : client `@aws-sdk/client-s3` partagé via `globalThis` (même patron que `src/lib/redis.ts`), `null` tant que `S3_BUCKET` n'est pas configurée. `forcePathStyle: true` (requis par MinIO/la plupart des fournisseurs S3-compatibles hors AWS). `s3KeyFromStoredPath()` lit `S3_PUBLIC_URL` directement (jamais `isS3Configured()`) pour qu'une ancienne ligne S3 reste supprimable même si S3 est désactivée entre-temps (parc mixte pendant une transition).
- `storeProcessedImage()`/`deleteStoredFile()` (`src/lib/uploads.ts`) : point d'écriture et de suppression partagé par les 3 flux d'upload existants (`savePhoto`/`saveAvatar`/`saveMessageAttachment`) et par le seed de démonstration. Upload S3 avec repli disque local strictement identique à l'ancien comportement si S3 échoue à l'écriture — y compris si S3 devient injoignable EN COURS DE ROUTE (même discipline que Redis) — jamais un upload qui échoue purement à cause d'un problème d'infrastructure annexe. Suppression câblée aux 3 vrais points de mutation qui n'existaient pas avant ce lot : édition d'annonce (photos retirées), remplacement/suppression d'avatar, suppression de message avec pièce jointe — toujours après la mutation DB réussie, jamais avant.
- `resolveAbsolutePhotoUrl()` (`src/lib/site.ts`) : remplace la concaténation naïve `SITE_URL` + chemin aux 2 endroits qui la faisaient (image Open Graph et JSON-LD de la fiche annonce) — une URL déjà absolue (S3) reste inchangée, un chemin relatif (disque local) est préfixé comme avant.
- `next.config.ts` : `images.remotePatterns` autorise l'hôte S3 pour `next/image` quand `S3_PUBLIC_URL` est configurée, protocole/port lus dynamiquement (jamais `"https"` en dur, pour accepter aussi bien un MinIO local en `http` qu'un fournisseur en production).
- 6 nouvelles variables optionnelles dans `.env.example` (`S3_ENDPOINT`, `S3_PUBLIC_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`) — mêmes disclaimers honnêtes que `REDIS_URL`/`ANTHROPIC_API_KEY`.
- `prisma/seed-demo-listings.ts` : les photos de démonstration passent par le même `storeProcessedImage()`, donc aussi visibles depuis n'importe quelle instance quand S3 est configurée.
- 11 nouveaux tests unitaires (`tests/storage.test.ts`, `tests/site.test.ts`) sur la détection de forme (URL S3 vs chemin local), y compris le cas « ligne S3 existante alors que S3 est désormais désactivé » — jamais le vrai réseau S3, même discipline que les tests Redis. 474/474 tests au vert au total.
- **Bug réel trouvé et corrigé pendant la vérification, pas seulement le chemin heureux** : `next/image` refuse par défaut de proxyer une image dont l'hôte résout vers une IP privée (protection SSRF intégrée à Next.js 16), ce qui bloquait le rendu de toute photo S3 hébergée sur un `127.0.0.1`/`10.x`/`172.16-31.x`/`192.168.x` local. `dangerouslyAllowLocalIP` n'est désormais activé que pour l'hôte déjà explicitement allowlisté par `remotePatterns` ci-dessus (jamais globalement) et uniquement quand cet hôte est lui-même une IP privée/locale — sans effet, donc sans risque ajouté, pour un fournisseur S3 en production avec un hostname public classique.

**Vérification de bout en bout en conditions réelles**, avec un vrai serveur S3-compatible local (`s3rver`, npm — MinIO retenu initialement mais sa distribution binaire officielle s'est révélée discontinuée, `dl.min.io` renvoyant `410 Gone` et ses releases GitHub ne publiant plus aucun binaire) :
- Upload réel d'une photo d'annonce via l'UI (vrai compte vendeur) → `ListingPhoto.path` en base devient une URL S3 absolue (confirmée par inspection directe de la base) ; URL ouverte hors application → objet réellement présent et lisible publiquement sur S3 (`200`, octets réels). Parc mixte confirmé : l'autre photo pré-existante de la même annonce garde son chemin local `/uploads/...` inchangé, les deux coexistent sans problème.
- Rendu confirmé après correctif SSRF ci-dessus : la fiche annonce charge la photo S3 via `next/image` (`_next/image` → `200`, photo visible à l'écran) — échouait en `400` avant le correctif.
- Avatar : upload réel → URL S3 confirmée lisible (`200`) ; suppression réelle → objet confirmé disparu de S3 (`404` direct, pas seulement `avatarUrl` vidé en base).
- Pièce jointe de message : upload réel dans une vraie conversation → URL S3 confirmée lisible (`200`) ; suppression réelle du message → objet confirmé disparu de S3 (`404` direct).
- Repli honnête confirmé : S3 coupé en cours de route → upload d'avatar réussit quand même (`200`, chemin `/uploads/...` local), journal serveur montrant explicitement `[uploads] S3 indisponible, repli disque local: connect ECONNREFUSED 127.0.0.1:9000`. S3 relancé → upload suivant repart automatiquement vers S3, sans redémarrage de l'application ; le remplacement d'avatar supprime bien l'ancien fichier local au passage.
- Suppression du chemin S3 confirmée sur une vraie annonce (pas seulement avatar/message) : retrait réel de la photo de test via édition d'annonce → objet confirmé disparu de S3 (`404` direct).
- Données de test (photo d'annonce, avatar, conversation + message avec pièce jointe) supprimées après vérification ; annonce Renault Clio 2018 restaurée à son état d'origine (1 photo locale, `PUBLIEE`, `contentHash` identique).

**Hors périmètre délibéré** : `src/lib/identity-uploads.ts` (documents d'identité chiffrés au repos, jamais servis par URL publique — système séparé et plus sensible, non touché ici) ; migration en masse des photos déjà stockées localement (les anciennes lignes locales continuent de fonctionner exactement comme avant grâce au double chemin de rendu/suppression).

Prochain lot proposé : à définir avec le porteur de projet — avec ce lot, le dernier verrou identifié pour un déploiement multi-instance (photos non partagées) est levé ; le paiement (toujours en attente d'identifiants réels) reste le seul grand chantier d'infrastructure non engagé.

## Lot 97 — Traitement des 6 constats qualité laissés en suspens au Lot 95 (2026-09-16)

Le Lot 95 avait corrigé 4 bugs réels mais documenté 6 constats non traités (dette technique/outillage, rien de bloquant). Demandé explicitement par le porteur de projet : les 6 traités dans ce lot.

**Corrigé**
- **4ᵉ copie du code Anthropic factorisée** : `src/lib/ai-advisor.ts`/`ai-search.ts`/`ai-compare.ts`/`ai-listing.ts` répétaient chacun le même bloc `fetch`/headers/extraction de texte. Nouveau `src/lib/anthropic-client.ts` (`callAnthropicMessages()`, constante `ANTHROPIC_MODEL` partagée) — chaque fichier garde son `system`/`messages`/post-traitement propre (JSON structuré vs texte libre), seule la plomberie réseau est désormais à un seul endroit. Comportement strictement inchangé (pure extraction).
- **Rate limit Redis en un seul aller-retour réseau** (`src/lib/rate-limit.ts`) : `INCR` puis `PEXPIRE` conditionnel (2 commandes séparées) remplacés par un script Lua unique exécuté via `redis.eval()` — incrément et expiration conditionnelle atomiques côté serveur Redis en un seul aller-retour. Repli en mémoire et sémantique de fenêtre fixe inchangés.
- **Résolution marque/modèle simplifiée** dans `extractFiltersFromText` (`src/lib/ai-advisor.ts`) : le `if (brand) {...} else {...}` à deux branches quasi dupliquées extrait en une fonction interne unique `resolveBrandAndModel()` — même comportement (y compris la non-résolution volontaire en cas de collision de marque, Lot 95), code à un seul endroit à faire évoluer.
- **Libellés marque/modèle/wilaya partagés** : `AdvisorListingCard` (conseiller IA) et `ListingCard` (recherche) répétaient littéralement le même calcul de repli catalogue/texte-libre. Extrait en `resolveListingLabels()` (`src/lib/site.ts`, même fichier que `resolveAbsolutePhotoUrl` du Lot 96) — les deux composants restent des composants séparés (déjà documenté ainsi), seule la logique de libellé est partagée.
- **Requêtes anti-fraude parallélisées** (`src/lib/fraud-signals.ts`, `getFraudSignalsForListings`) : les 4 requêtes Prisma de haut niveau (photos dupliquées, contenu dupliqué, lignes comparables, historique de refus) ne dépendaient que de l'argument d'entrée, jamais les unes des autres, mais s'enchaînaient séquentiellement. Lancées désormais ensemble via un seul `Promise.all([...])` — un aller-retour au lieu de la somme des quatre.
- 2 nouveaux tests unitaires (`tests/rate-limit-redis.test.ts`, client Redis mocké même patron que `tests/realtime-redis-retry.test.ts`) : `eval` appelé une seule fois par requête (jamais `incr`+`pexpire` séparément), repli en mémoire toujours actif si le script échoue. 476/476 tests au vert au total.

**Enquête et correctif réel sur le contournement de migration Prisma (checksum)**
Rencontré aux Lots 92 et 94 : `prisma migrate dev` détectait un écart de checksum sur des migrations déjà appliquées et proposait un `migrate reset` complet (perte des 24 annonces de démonstration réelles), alors que `prisma migrate status` confirmait systématiquement le schéma à jour. L'hypothèse de départ (mitigation via `shadowDatabaseUrl` explicite, recommandation standard de la documentation Prisma pour ce type de symptôme) s'est révélée **fausse à l'usage** : testée en conditions réelles sur une copie jetable de `dev.db`, elle cassait `migrate dev` encore plus tôt (erreur `P3006`, "table already exists" dès la toute première migration, même sur un fichier de shadow database garanti vide) — entièrement annulée (`schema.prisma`, `.env`, `.env.example`, `.gitignore` revenus à l'identique, vérifié par `git diff`).

Root cause réelle trouvée en comparant directement les checksums stockés dans `_prisma_migrations` au SHA256 réel des fichiers `migration.sql` sur disque : **2 migrations précises** (`20260903114149_listing_expiry_and_renewal`, `20260906170000_generations`) avaient un checksum enregistré ne correspondant à AUCUNE variante plausible du fichier actuel (ni la version Git, ni une variante de fin de ligne CRLF/LF) — un reliquat du contournement `prisma db execute`/`migrate resolve --applied` utilisé en urgence à ces deux lots. `migrate resolve --applied` refuse de re-corriger un checksum déjà « appliqué » (`P3008`) ; correctif appliqué par une mise à jour SQL directe et ciblée des 2 valeurs de checksum dans `_prisma_migrations` (`prisma db execute`), sans toucher à aucune table applicative.

**Vérification de bout en bout en conditions réelles** : correctif d'abord validé sur une copie jetable de `dev.db` (migration test créée + appliquée avec succès, aucune erreur de checksum, copie ensuite supprimée) avant d'être appliqué à la vraie base. Une fois appliqué à `dev.db` : `prisma migrate status` confirme « à jour » ; un vrai cycle de migration jetable a ensuite été exécuté directement sur `dev.db` (ajout d'un champ nullable inoffensif sur `Equipment`, `prisma migrate dev` réel, application propre sans erreur) puis intégralement annulé (`dev.db` restauré depuis une sauvegarde prise juste avant, dossier de migration généré supprimé, schéma reverti, client Prisma régénéré) — 24 annonces et 9 utilisateurs confirmés strictement identiques avant/après.

**Vérification manuelle complémentaire des 5 autres correctifs** : conseiller IA re-testé en français et arabe (dont une requête « Dacia Duster » ciblant spécifiquement la résolution marque/modèle refactorée — reconnaissance et résultat identiques à avant), page recherche rechargée (libellés marque/modèle/wilaya affichés normalement), `/admin/annonces` rechargée en conditions réelles (23 annonces publiées listées sans erreur, confirmant les requêtes anti-fraude parallélisées).

**Hors périmètre** : aucun — les 6 constats du Lot 95 sont désormais tous traités.

Prochain lot proposé : à définir avec le porteur de projet — le paiement (toujours en attente d'identifiants réels) reste le seul grand chantier d'infrastructure non engagé ; Meilisearch reste volontairement en pause (24 annonces en base, Prisma/SQL direct suffit encore).

## Lot 98 — Audit sécurité et qualité, 8 correctifs (2026-09-16)

Demandé explicitement par le porteur de projet : premier audit couvrant l'ensemble du code applicatif (jamais fait globalement jusqu'ici, seulement au fil des lots). 5 angles de recherche en parallèle (authentification/session, autorisation/IDOR, injection/upload/XSS, secrets/données sensibles, qualité de code sur les zones jamais relues) — 2 failles de sécurité réelles confirmées et corrigées, plus 6 correctifs de qualité issus du même passage.

**Corrigé — sécurité**
- **XSS stockée via évasion de balise `</script>` dans les blocs JSON-LD** (`src/lib/structured-data.ts`, 9 pages) : un titre ou une description d'annonce contenant littéralement `</script><script>...</script>` fermait prématurément le `<script type="application/ld+json">` qui l'embarquait et injectait du script exécutable chez tout visiteur de la fiche — `JSON.stringify` n'échappe jamais `<`. Nouvelle fonction `safeJsonLdStringify()` (échappe `<` en `<`, JSON strictement identique sinon) utilisée aux 10 emplacements `dangerouslySetInnerHTML` de l'application, pas seulement la fiche annonce (Vehicle, BreadcrumbList, Article de blog — ce dernier non exploitable par un utilisateur non privilégié aujourd'hui car le contenu est rédigé par un admin, mais corrigé par cohérence). 2 nouveaux tests de régression (`tests/structured-data.test.ts`).
- **Codes de vérification SMS journalisés en clair sans garde-fou production** (`src/lib/sms.ts`) : aucun fournisseur SMS réel n'étant configuré (limitation déjà documentée, même statut que le paiement), le code à usage unique envoyé par SMS était systématiquement écrit dans les journaux serveur, y compris en production. Le contenu n'est désormais journalisé qu'en développement (`NODE_ENV !== "production"`) ; en production sans fournisseur configuré, le SMS n'est simplement pas délivré (échec honnête) plutôt que de fuiter le code.

**Corrigé — durcissement**
- **Énumération de comptes par le temps de réponse à la connexion** (`src/app/api/auth/login/route.ts`) : `!user || !(await verifyPassword(...))` court-circuitait l'appel bcrypt (~50-100 ms) quand l'email n'existait pas, rendant la réponse mesurablement plus rapide pour un compte inconnu malgré un message d'erreur générique identique. `verifyPassword` est désormais toujours exécuté, contre un hash bcrypt factice (`DUMMY_PASSWORD_HASH`, `src/lib/auth-server/password.ts`) quand le compte n'existe pas — même coût de calcul dans les deux cas. 1 nouveau test (`tests/auth.test.ts`).

**Corrigé — qualité (bugs réels)**
- **Rappels d'expiration d'annonce silencieusement incomplets à l'échelle** (`src/lib/listing-expiry-reminder-sweep.ts`) : la requête de balayage (`take: 50`, sans `orderBy`) échantillonnait un sous-ensemble arbitraire de l'ordre par défaut de la base dès que plus de 50 annonces devenaient éligibles au rappel simultanément — une annonce dont la fenêtre venait de s'ouvrir pouvait alors ne jamais être tirée et ne jamais recevoir son email de rappel. `orderBy: { expiresAt: "asc" }` ajouté (même correctif appliqué par cohérence à `listing-auto-renew-sweep.ts`, risque plus faible mais même pattern).
- **TOCTOU non protégé sur les signalements dupliqués** (`src/app/api/listings/[id]/report/route.ts`) : le `findUnique` de pré-vérification laissait une fenêtre de course entre deux soumissions quasi simultanées (double clic, retentative réseau) — la seconde `create` levait une erreur de contrainte unique (P2002) non interceptée, remontant en `500` au lieu du `already_reported` `400` attendu. `try/catch` P2002 ajouté, même patron déjà utilisé par `upgrade-formula/route.ts` et `subscription/upgrade/route.ts`.
- **Ordre rate limit/autorisation inversé sur les 3 routes de collaborateurs pro** (`src/app/api/pro/accounts/[id]/collaborators/route.ts` et `.../[collaboratorId]/route.ts`) : la vérification d'autorisation (avec accès DB) passait avant la vérification de débit, contrairement à toutes les autres routes de l'application — un appelant non autorisé échappait donc au rate limit. Ordre aligné sur le reste du code (débit vérifié juste après l'authentification, avant tout accès DB).

**Vérification de bout en bout en conditions réelles** : 479/479 tests au vert (3 nouveaux). JSON-LD de la fiche Renault Clio 2018 rechargée dans le navigateur et confirmée toujours valide/analysable après le changement d'échappement (`JSON.parse` réussi sur les 2 blocs). Connexion testée avec un email inconnu, un mauvais mot de passe et les vrais identifiants Yasmine Cherif — même réponse générique `401` pour les deux premiers cas, `200` pour le troisième. Signalement réel soumis sur une vraie annonce (compte Yasmine Cherif) → `201`, resoumission immédiate → `409 already_reported` (confirmant le correctif TOCTOU) ; donnée de test supprimée après vérification.

**Documenté, non corrigé dans ce lot** :
- **Rate limit de connexion/inscription contournable via un `X-Forwarded-For` usurpé** (`src/lib/http.ts`, `getClientIp`) — fait confiance à l'en-tête sans liste blanche de proxys de confiance. Non corrigé délibérément : la bonne réponse dépend de la topologie de déploiement réelle (un vrai reverse proxy en amont écrase legitimement cet en-tête, auquel cas lui faire confiance est correct et nécessaire ; une exposition directe sans proxy le rendrait usurpable) — information que ce projet n'a pas encore (aucune infrastructure de déploiement configurée dans ce dépôt). Décision à prendre avec le porteur de projet une fois l'hébergement cible connu.
- **Aucun verrouillage de compte après échecs de connexion répétés** — seul le rate limit par IP protège la connexion (lui-même contournable, cf. ci-dessus). Une vraie fonctionnalité de verrouillage (compteur par compte, déverrouillage admin) serait un chantier à part, pas un correctif ponctuel — hors périmètre de cette passe d'audit.
- 3 simplifications de qualité identifiées mais non appliquées (impact réel mais aucune ne corrige un bug) : validation catalogue dupliquée entre création et édition d'annonce (`src/app/api/listings/route.ts`/`[id]/route.ts`) ; boucles d'envoi d'email séquentielles au lieu de `Promise.all` dans 3 fichiers (`search-alerts.ts`, `update-price/route.ts`, `pro/accounts/[id]/reviews/route.ts`) ; requêtes N+1 par vendeur dans `getSellerTrustSummariesForSellers` (`src/lib/seller-trust.ts`), à batcher comme `professional-accounts.ts` le fait déjà.

Prochain lot proposé : à définir avec le porteur de projet — la décision sur `X-Forwarded-For`/reverse proxy dépend du choix d'hébergement ; sinon le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 99 — Les 3 simplifications qualité du Lot 98 (2026-09-16)

Reprend les 3 constats de qualité identifiés mais volontairement non appliqués au Lot 98 (impact réel mais aucun ne corrigeait un bug). Demandé explicitement par le porteur de projet.

**Corrigé**
- **Validation catalogue dupliquée entre création et édition d'annonce** : `src/app/api/listings/route.ts` (POST) et `src/app/api/listings/[id]/route.ts` (PATCH) répétaient ~35 lignes identiques (vérification brandId/modelId/generationId/wilayaId/communeId/equipmentIds contre la base, jamais un id fabriqué côté client accepté tel quel). Extraites en `validateCatalogueRefs()` (nouveau `src/lib/listing-catalogue-refs.ts`), appelée une seule fois par chaque route — même comportement, ordre de vérification unifié entre les deux routes (auparavant légèrement différent entre les deux, aucun test ne dépendant de cet ordre précis).
- **Boucles d'envoi d'email séquentielles** dans 3 fichiers (`src/lib/search-alerts.ts`, `src/app/api/listings/[id]/update-price/route.ts`, `src/app/api/pro/accounts/[id]/reviews/route.ts`) : chaque destinataire attendait la fin de l'envoi précédent avant de commencer le suivant, alors que chaque envoi est déjà indépendant et au mieux (`.catch()` propre, jamais un échec individuel qui bloque les autres). Converties en `Promise.all(...)` — les alertes de recherche, notifications de baisse de prix et notifications de nouvel avis pro partent désormais en parallèle.
- **Requêtes N+1 par vendeur** dans `getSellerTrustSummariesForSellers` (`src/lib/seller-trust.ts`) : 3 requêtes Prisma par vendeur (même si chaque vendeur était déjà traité en parallèle côté JS, SQLite les sérialise côté moteur) au lieu de 3 requêtes batchées au total. Reconstruite sur le même patron que `getProfessionalBadgesForSellers` (`src/lib/professional-accounts.ts`) : un `findMany({ in: uniqueIds })` par table (utilisateurs, avis, signalements confirmés — ces derniers sans colonne `sellerId` directe, d'où un regroupement en mémoire via la relation `listing`), puis reconstruction du résumé par vendeur. Le calcul du résumé lui-même (`buildSellerTrustSummary`) est désormais une fonction pure partagée par `getSellerTrustSummary` (un vendeur) et la version batchée — évite d'introduire une nouvelle duplication en réglant celle-ci.
- 479/479 tests au vert (aucun nouveau test dédié — les 3 changements sont des refactorings de comportement observable inchangé, couverts par les tests déjà existants sur les routes/fonctions concernées).

**Vérification de bout en bout en conditions réelles** : édition réelle de l'annonce Peugeot 208 2019 (compte Yasmine Cherif) avec un `brandId` invalide → `400 unknown_brand` comme attendu ; même édition avec des références valides → `200`, mise en modération (`EN_ATTENTE`) comme tout changement de contenu, listing réapprouvé ensuite pour revenir à l'état d'origine. Page recherche rechargée après le changement `seller-trust.ts` : les scores de confiance affichés (BMW Série 3 31/100, Hyundai Tucson 10/100, Mercedes-Benz Classe C 31/100, 23 annonces) sont strictement identiques à avant le refactoring, confirmant que le calcul batché produit le même résultat que l'ancien calcul par vendeur.

**Hors périmètre** : aucun — les 3 points identifiés au Lot 98 sont traités.

Prochain lot proposé : à définir avec le porteur de projet — la décision sur `X-Forwarded-For`/reverse proxy (Lot 98) dépend toujours du choix d'hébergement ; sinon le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 100 — Accord féminin carburant/boîte en arabe (AI Advisor) (2026-09-16)

Bug réel trouvé en testant le conseiller IA en arabe avec une vraie phrase naturelle : « سيارة تويوتا أوتوماتيكية في قسنطينة » (voiture Toyota automatique à Constantine) ne reconnaissait ni « automatique » ni les autres adjectifs de carburant/boîte — seule la marque et la wilaya étaient extraites.

**Corrigé**
- `src/lib/ai-advisor.ts` (`FUEL_KEYWORDS`, `GEARBOX_KEYWORDS`) : « أوتوماتيكي »/« يدوي »/« كهربائي »/« هجين » sont des adjectifs arabes qui s'accordent en genre — « سيارة » (voiture) étant féminin, une phrase naturelle dit « سيارة أوتوماتيكية »/« سيارة كهربائية », pas seulement la forme masculine (celle déjà présente, reprise telle quelle des traductions vérifiées de `messages/ar.json`). Les deux formes sont désormais reconnues — la forme féminine ajoutée n'est pas une traduction inventée, seulement l'accord grammatical standard du même adjectif déjà vérifié.
- 1 nouveau test unitaire (`tests/ai-advisor.test.ts`) couvrant les 4 formes féminines. 480/480 tests au vert au total.
- Vérification de bout en bout en conditions réelles, avec le compte de démonstration réel Yasmine Cherif en interface arabe : « سيارة تويوتا أوتوماتيكية في قسنطينة » → `gearbox: "AUTOMATIQUE"` désormais bien extrait (absent avant le correctif), 0 résultat réel (légitime, aucune Toyota automatique à Constantine dans les données de démo) ; « سيارة أوتوماتيكية في الجزائر » → 5 annonces réelles trouvées, dont la BMW Série 3 2019 attendue (Alger, Automatique).

**Hors périmètre délibéré** : les autres adjectifs éventuellement genrés dans le reste du repli heuristique (aucun autre identifié à ce jour) ; la reconnaissance des chiffres indo-arabes ٠-٩, toujours hors périmètre depuis le Lot 89.

Prochain lot proposé : à définir avec le porteur de projet — la décision sur `X-Forwarded-For`/reverse proxy (Lot 98) dépend toujours du choix d'hébergement ; sinon le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 101 — Tests end-to-end automatisés (Playwright) (2026-09-16)

Depuis le début du projet, chaque changement était vérifié « en conditions réelles » manuellement au navigateur — utile et honnête, mais sans garantie de non-régression automatique. Proposé par Claude, validé par le porteur de projet : Playwright sur les 4 parcours critiques — inscription, publication d'annonce (l'assistant en 11 étapes), messagerie, conseiller IA (FR + AR).

**Livré**
- `playwright.config.ts` + `e2e/` (5 fichiers) : `auth.spec.ts`, `listing-publish.spec.ts` (parcours complet des 11 étapes de l'assistant, upload d'une vraie photo générée à la volée, publication réelle), `messaging.spec.ts` (deux contextes navigateur distincts, acheteur et vendeur), `ai-advisor.spec.ts` (reprend les requêtes FR/AR déjà vérifiées manuellement cette session, dont le correctif d'accord féminin du Lot 100), `fixtures.ts` (helpers partagés).
- **Isolation des données** : base SQLite jetable dédiée (`prisma/e2e.db`, gitignored) sur un serveur Next dédié (port 5185, jamais 5184) — jamais `prisma/dev.db` (24 annonces/9 utilisateurs réels). Réinitialisée avant chaque exécution (`e2e/reset-db.ts` : supprime, `prisma migrate deploy`, puis les deux scripts de seed déjà existants) via le hook npm `pretest:e2e` — **pas** l'option `globalSetup` de Playwright.
- `package.json` : `@playwright/test` en devDependency, scripts `test:e2e`/`test:e2e:ui`.

**3 bugs réels trouvés en construisant l'infrastructure de test, tous corrigés** :
- **`webServer` démarre avant `globalSetup`** dans cette version de Playwright (confirmé en lisant `node_modules/playwright/lib/runner/index.js` : `createGlobalSetupTasks()` liste les tâches des plugins — dont `webServer` — avant les scripts `globalSetup`) : le serveur Next se mettait à interroger une base pas encore créée (`P2021`, table inexistante). Contourné en réinitialisant la base via un hook npm `pretest:e2e` (garanti terminé avant que `playwright test` ne démarre quoi que ce soit) plutôt que via `globalSetup`.
- **`prisma/seed-demo-listings.ts` n'était pas réellement reproductible depuis zéro** : le script attendait qu'un compte `sara.hamdi@example.dz` (persona lié à un compte professionnel « Auto Sara Motors ») existe déjà, sans jamais le créer lui-même — un reliquat d'une mise en place manuelle très ancienne dans l'historique du projet, jamais capturée dans un script. Corrigé par un `upsert` idempotent (sans effet sur `dev.db`, où le compte existe déjà ; crée un compte minimal réel sur une base neuve) — referme un vrai trou de reproductibilité qui aurait touché n'importe qui recréant la base de zéro, pas seulement les tests E2E.
- **Rate limiting réellement backé par Redis pour le serveur de test** : `REDIS_URL` du vrai `.env` (un vrai Redis tourne sur cette machine pour la vérification manuelle) était hérité par le serveur E2E faute d'être explicitement vidé — les compteurs de débit devenaient donc persistants et partagés entre deux exécutions de la suite, causant des échecs intermittents par épuisement de quota. `REDIS_URL`/`S3_BUCKET` désormais explicitement vidées dans `webServer.env` — repli mémoire honnête forcé, comme prévu dès le départ.

**Vérification de bout en bout** : suite complète exécutée réellement 3 fois consécutives, 6/6 à chaque fois (jamais une seule relecture de code sans exécution réelle). `prisma/dev.db` confirmé strictement inchangé après (24 annonces, 9 utilisateurs) — l'isolation fonctionne réellement, pas seulement en théorie. `npx vitest run` (480/480) et `tsc --noEmit` toujours au vert, `vitest.config.ts` exclut désormais `e2e/**` (specs Playwright, pas vitest).

**Hors périmètre délibéré** : CI (aucun remote/pipeline configuré sur ce dépôt — chantier à part une fois l'hébergement choisi, cf. Lot 98) ; Firefox/WebKit, tests visuels, tests de charge — ajout facile plus tard si besoin réel démontré ; le chemin IA réel (Claude) reste non testable, comme partout ailleurs dans le projet.

Prochain lot proposé : à définir avec le porteur de projet — brancher `npm run test:e2e` sur un pipeline CI serait le prolongement naturel une fois l'hébergement/remote choisi ; sinon le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 102 — Verrouillage de compte après échecs de connexion répétés (2026-09-16)

Referme le dernier point mineur laissé en suspens à l'audit sécurité (Lot 98) : la connexion n'était protégée que par un rate limit **par IP** (10 tentatives/15 min, déjà documenté comme contournable via un `X-Forwarded-For` usurpé) — aucun compteur **par compte**, donc un attaquant ciblant un seul compte depuis des IP tournantes n'était pas freiné. Demandé explicitement par le porteur de projet. Complète le rate limit IP existant, ne le remplace pas.

**Livré**
- `User.failedLoginAttempts`/`lockedUntil` (`prisma/schema.prisma`) — seuil de **5 échecs consécutifs**, verrouillage de **15 minutes** (même fenêtre que le rate limit IP, cohérent), auto-expiration par simple comparaison de date, aucun job requis (même principe que l'expiration d'annonce). Migration réelle appliquée sans erreur de checksum (confirme que le correctif du Lot 97 tient).
- Logique pure extraite dans `src/lib/login-lockout.ts` (`isAccountLocked`, `computeFailedLoginUpdate`), même discipline que `checkCanSuspendUser` — testable sans base de données.
- `src/app/api/auth/login/route.ts` : le verrouillage protège uniquement la **connexion** (nouvelle tentative), jamais une session déjà active — contrairement à `suspendedAt`, jamais vérifié dans `getCurrentUser()`. Garde intact le correctif anti-énumération du Lot 98 (`verifyPassword` toujours exécuté contre `DUMMY_PASSWORD_HASH` quand le compte n'existe pas **ou est verrouillé** — jamais un écart de temps de réponse qui révélerait l'état du compte) ; pendant le verrouillage, jamais de confirmation si le mot de passe était correct ou non. Compteur remis à zéro à chaque connexion réussie.
- Déverrouillage admin : `POST /api/admin/users/[id]/unlock` (même gabarit que `.../unsuspend`), `UnlockUserButton` (badge « Compte verrouillé » + bouton dans `/admin/utilisateurs`), tracé dans le journal d'audit (`user.unlock`) — un verrouillage automatique, lui, n'est jamais audit-loggé (route publique non authentifiée, `writeAuditLog` exige un admin réel) : `console.warn` suffit pour la visibilité opérationnelle.
- Nouvelle clé i18n `errorAccountLocked` (FR/AR) avec le nombre de minutes restantes, affichée dans `LoginForm.tsx`.
- 6 nouveaux tests unitaires (`tests/login-lockout.test.ts`). 486/486 tests au vert au total.

**Vérification de bout en bout en conditions réelles** : 5 mauvais mots de passe consécutifs envoyés à un vrai compte de démonstration (Sofiane Guerroudj) → 6ᵉ tentative, même avec le **bon** mot de passe, rejetée `423 account_locked` (confirmé aussi bien en API directe qu'à l'écran, message « Trop de tentatives échouées... réessayez dans 15 min. »). Déverrouillage réel depuis `/admin/utilisateurs` (badge disparu après clic) → reconnexion immédiate réussie (`200`). Entrée `user.unlock` confirmée dans `/admin/journal` (« previousFailedAttempts: 5 »). `npm run test:e2e` (Lot 101) toujours 6/6 — le mauvais mot de passe testé par `auth.spec.ts` (1 seule tentative) ne déclenche pas de faux verrouillage. Compte de test restauré à son état d'origine (`failedLoginAttempts: 0`, `lockedUntil: null`) ; `prisma/dev.db` confirmé inchangé par ailleurs (24 annonces, 9 utilisateurs).

**Hors périmètre** : aucun — le point identifié au Lot 98 est traité. Reste ouvert : la décision sur `X-Forwarded-For`/reverse proxy (dépend du choix d'hébergement, toujours pas connu).

Prochain lot proposé : à définir avec le porteur de projet — le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 103 — Logo et bannière pour les comptes professionnels (2026-09-18)

Demandé par le porteur de projet après un état des lieux des pages dédiées aux concessionnaires/garages/showrooms : la boutique publique (`/pro/[id]`) et la page marketing existaient déjà (Lot 13), mais sans aucune identité visuelle — le schéma `ProfessionalAccount` n'avait ni `logoUrl` ni `bannerUrl`.

**Livré**
- `ProfessionalAccount.logoUrl`/`bannerUrl` (`prisma/schema.prisma`), migration réelle appliquée sans erreur.
- `src/lib/uploads.ts` : `saveProLogo` (cadrage carré 400×400, mêmes règles de sécurité que `saveAvatar` — octets réels validés via `file-type`, jamais le mime déclaré par le client, nom physique généré) et `saveProBanner` (cadrage bandeau fixe 1600×400, pour un rendu cohérent en haut de la boutique quelle que soit la photo source).
- `POST`/`DELETE /api/pro/accounts/[id]/logo` et `.../banner` : réservés au **propriétaire** du compte (jamais délégable à un collaborateur, même règle que la gestion des collaborateurs eux-mêmes — l'identité visuelle n'est pas une tâche opérationnelle), rate-limité (10/h/compte, même gabarit que l'avatar).
- `ProBrandingUpload.tsx` : un seul composant paramétré par `kind` (`"logo" | "banner"`) plutôt que deux copies quasi identiques, branché dans le tableau de bord pro.
- Boutique publique (`/pro/[id]`) : bannière pleine largeur en haut de page, logo rond à côté du nom commercial — tous deux optionnels, layout inchangé si absents.
- Clés i18n FR/AR (namespace `Pro`), gabarit repris de `ProfileEdit` (avatar).

**Vérification de bout en bout en conditions réelles** : un compte de test dédié créé via le flux d'inscription normal (jamais le compte de démonstration `sara.hamdi@example.dz`, pour ne pas risquer de le verrouiller — Lot 102) → upload réel d'un logo et d'une bannière via l'API authentifiée (cookie de session réel, pas de simulation) → fichiers confirmés sur disque avec les bonnes dimensions traitées (400×400 et 1600×400) → rendu confirmé à l'écran sur le tableau de bord et sur la boutique publique → suppression réelle testée (fichier et champ base supprimés) → type de fichier invalide rejeté (`400 photo_invalid_type`) → tentative de modification du compte pro d'un tiers rejetée (`403 forbidden`), confirmant que la restriction au propriétaire fonctionne réellement, pas seulement en théorie.

**Nettoyage après vérification** : compte de test et sa cascade (compte pro, fichiers uploadés) supprimés ; `prisma/dev.db` confirmé revenu à son état d'origine (24 annonces, 9 utilisateurs, 1 compte pro — Auto Sara Motors). Seul effet de bord mineur laissé volontairement : le compteur d'échecs de connexion de `sara.hamdi@example.dz` reste à 2 (mes propres tentatives avec un mauvais mot de passe avant de basculer sur un compte de test dédié) — très en dessous du seuil de verrouillage (5, Lot 102) et remis à zéro automatiquement à sa prochaine connexion réussie, aucune action requise.

**Hors périmètre délibéré** : recadrage/zoom manuel avant envoi (le cadrage `cover` automatique peut mal centrer une image non carrée/non 4:1) ; pas de limite de nombre de changements au-delà du rate limit générique.

Prochain lot proposé : à définir avec le porteur de projet — le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 104 — Adapte l'assistant de publication aux catégories utilitaire/moto (2026-09-18)

`ListingCategory` (`VOITURE`/`UTILITAIRE`/`POIDS_LOURD`/`DEUX_ROUES`/`AUTRE`) existait déjà dans le schéma et les filtres de recherche, mais aucune étape de l'assistant de publication ne s'y adaptait : publier une annonce « Deux-roues » forçait à voir des champs sans rapport (portes, places, transmission 4x2/4x4). Recherche préalable (2 agents Explore) : `mileage`/`fuelType`/`gearbox` restent pertinents pour toutes les catégories (une moto a aussi kilométrage/carburant/boîte) — seuls portes/places/transmission sont réellement incohérents pour un deux-roues, et ils étaient déjà `nullable` en base, donc aucune migration ni changement de schéma Zod n'était nécessaire.

**Livré**
- `src/lib/listing-category-fields.ts` (nouveau) : `hasCarBodyFields(category)`, `false` uniquement pour `DEUX_ROUES`.
- Étape 3 de l'assistant (`src/app/[locale]/publier/etape-3/page.tsx`) et formulaire d'édition (`src/components/ListingEditForm.tsx`) : transmission et portes/places masqués quand la catégorie est Deux-roues, dans les deux parcours (publication et édition ultérieure) pour rester cohérents.
- Étape 9 (aperçu) : vérifiée, n'affichait déjà ni portes/places/transmission pour aucune catégorie — rien à changer.
- `UTILITAIRE`/`POIDS_LOURD` gardent le même jeu de champs que `VOITURE` (un utilitaire/camion a bien portes, places, et peut être 4x2/4x4) — seule `DEUX_ROUES` reçoit un traitement spécial.

**Vérification de bout en bout en conditions réelles** : compte de test dédié créé via l'inscription normale (jamais le compte de démonstration) → assistant parcouru en choisissant catégorie « Deux-roues » à l'étape 2 (marque/modèle en texte libre, « Yamaha »/« MT-07 » — catalogue toujours voiture uniquement) → étape 3 confirmée sans transmission/portes/places, uniquement année/kilométrage/carburant/boîte/couleur/puissance → publication réelle via l'API (`POST /api/listings`) → ligne `Listing` confirmée en base avec `doors`/`seats`/`transmission` à `null` et `category: DEUX_ROUES` → annonce approuvée via le vrai circuit de modération admin (`POST /api/admin/listings/[id]/moderate`) → page publique de l'annonce chargée sans erreur → formulaire d'édition rouvert sur cette même annonce, transmission/portes/places confirmés absents également en édition.

**Nettoyage après vérification** : annonce, photo et compte de test supprimés ; `prisma/dev.db` confirmé revenu à son état d'origine (24 annonces, 9 utilisateurs).

**Hors périmètre délibéré** :
- **Pas de catalogue marque/modèle moto ou utilitaire** — `Brand`/`Model`/`Generation` restent 100 % voitures. Le repli texte libre (`brandFreeText`/`modelFreeText`) est déjà pleinement fonctionnel de bout en bout et un commentaire du schéma anticipait déjà ce cas ; un vrai catalogue moto/camion demanderait une liste de marques/modèles vérifiée, à traiter dans un lot dédié plutôt qu'improvisée ici.
- **Pas de filtrage de la liste d'équipements** (`prisma/equipment-data.ts`) selon la catégorie — certains items (sièges chauffants, vitres électriques...) n'ont clairement pas de sens pour une moto, mais décider lesquels exclure est un jugement de contenu risqué sans source fiable ; laissé sélectionnable tel quel, imperfection mineure et cosmétique.
- **Pas de nouveau champ « cylindrée »** pour les motos — `powerHp` reste le seul champ de puissance.
- **Recherche/affichage** (`SearchFilters.tsx`, `ListingCard.tsx`, page annonce) inchangés — déjà neutres vis-à-vis de la catégorie, aucune incohérence nouvelle introduite.

Prochain lot proposé : à définir avec le porteur de projet — le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 105 — Passage à 69 wilayas (loi n° 26-06 du 4 avril 2026) (2026-09-18)

Signalé par le porteur de projet : le découpage officiel compte désormais **69 wilayas** et non plus 58. Approuvées en Conseil des ministres le 16 novembre 2025, les 11 nouvelles wilayas (codes 59 à 69) ont été officialisées par la loi n° 26-06 du 4 avril 2026 (JORADP n° 25 du 5 avril 2026), déjà wilayas déléguées depuis la réforme de 2022. Le nombre total de communes reste **1 541** : elles sont seulement rattachées à de nouvelles wilayas.

**Source des données** : les listes de communes viennent du texte officiel lui-même (JORADP n° 25, versions française et arabe, art. 52 bis 10 à 52 bis 20 de la loi 84-09), extraites du PDF puis appariées avec la base — aucune commune inventée ni déduite de sources secondaires (qui divergeaient d'ailleurs entre elles sur certaines wilayas-mères).

**Livré**
- `prisma/seed.ts` : les 11 wilayas ajoutées (Aflou 59, Barika 60, El Kantara 61, Bir El Ater 62, El Aricha 63, Ksar Chellala 64, Aïn Ouessara 65, Messaad 66, Ksar El Boukhari 67, Bou Saâda 68, El Abiodh Sidi Cheikh 69), noms FR/AR.
- `prisma/commune-data.ts` : 108 communes rattachées à leur nouvelle wilaya (12 + 8 + 5 + 4 + 4 + 6 + 10 + 8 + 21 + 23 + 7). Seule la ligne `wilayaId` de chacune change, noms inchangés. Wilayas-mères réduites : Laghouat, Batna, Biskra, Tébessa, Tlemcen, Tiaret, Djelfa (deux wilayas créées : Aïn Ouessara et Messaad), Médéa, M'Sila, El Bayadh.
- `tests/commune-data.test.ts` : passe à 69 wilayas et encode les effectifs officiels des 11 nouvelles wilayas **et** de leurs 10 wilayas-mères (12/53/22/24/49/36/18/43/24/15) — une erreur de rattachement fait désormais échouer les tests. 487/487 au vert.

**Vérification**
- Contrôle croisé avant modification : sur les 108 communes, 104 appariées automatiquement par le nom arabe officiel, 4 par variante d'orthographe vérifiée à la main (« Azil Abedelkader », « Serghine », « Ouled Emaaraf », « Sidi Demed »), puis les 21 effectifs (nouvelles wilayas + mères) recalculés et comparés à ceux que la loi fixe elle-même pour les wilayas-mères réduites : tous identiques.
- Base de développement mise à jour par le seed idempotent : 69 wilayas, 1 541 communes, effectifs conformes ; utilisateurs (9) et annonces (24) inchangés.
- En conditions réelles : `/fr/wilaya` liste 69 wilayas dont les 11 nouvelles, `/fr/wilaya/bou-saada` s'affiche, `/ar/wilaya` contient les 11 noms arabes, le sitemap expose 69 URLs de wilayas.

**Point d'attention** : aucune annonce existante ne référence une des 108 communes déplacées (vérifié : 0 ligne), donc rien à migrer aujourd'hui. Si des annonces réelles existaient au moment d'une future bascule en production, une annonce dont la commune a changé de wilaya garderait l'ancienne wilaya-mère dans `Listing.wilayaId` : il faudrait alors la réaligner sur `Commune.wilayaId`.

**Hors périmètre** : les communes elles-mêmes ne sont pas renommées (les orthographes du référentiel existant sont conservées). Le texte de la loi prévoit que les wilayas-mères continuent d'exercer les prérogatives des nouvelles jusqu'au 31 décembre 2026 au plus tard — sans effet sur les données d'une petite-annonce.

Prochain lot proposé : à définir avec le porteur de projet — le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 106 — Édition des informations d'un compte professionnel (2026-09-18)

Trou trouvé en explorant le code au Lot 103 : nom commercial, présentation, horaires et wilaya d'un compte pro n'étaient saisis qu'**une seule fois, à la création** — aucune route ni écran ne permettait de les corriger ensuite (une faute dans le nom d'un concessionnaire restait définitive).

**Livré**
- `PATCH /api/pro/accounts/[id]` (`src/app/api/pro/accounts/[id]/route.ts`) : réservé au **propriétaire** du compte (même règle que logo/bannière et collaborateurs), rate-limité (20/h), remplacement complet des champs — un champ optionnel omis ou vide est effacé. Vérifie que la wilaya existe.
- `src/lib/validation/pro-account.ts` : schéma zod **partagé** entre la création (`POST /api/pro/accounts`, adapté) et l'édition, pour qu'ils ne divergent jamais. `badgeVerifie` n'en fait volontairement pas partie : impossible de se l'accorder soi-même en l'envoyant dans la requête.
- **Règle d'intégrité sur le badge « Vérifié »** (`shouldRevokeVerifiedBadge`, `src/lib/pro-account.ts`) : le badge est posé à la main par un admin après contrôle d'une entreprise précise ; changer de nom commercial sur un compte vérifié le retire, sinon on pourrait le conserver sous une autre identité. Corriger seulement la casse ou les espaces ne le retire pas. Décision de ma part, non demandée explicitement : à inverser si tu préfères que l'admin tranche au cas par cas.
- `ProProfileForm.tsx`, ajouté au tableau de bord pro (propriétaire uniquement, sous logo/bannière) : formulaire prérempli, avertissement orange dès que le nom change sur un compte vérifié, message distinct si le badge a été retiré. Clés i18n FR/AR.
- 4 nouveaux tests unitaires sur la règle du badge. 491/491 au vert au total.

**Vérification de bout en bout en conditions réelles** (deux comptes de test jetables, cookies de session réels) : modification de tous les champs (dont la wilaya 68, Bou Saâda — nouvelle depuis le Lot 105) → effacement des champs optionnels → nom trop court `400` → wilaya inconnue `400` → `badgeVerifie: true` glissé dans le corps **ignoré** → autre utilisateur `403` et nom inchangé → anonyme `403` → vérification par un admin via la vraie route → renommage casse/espaces seul : badge conservé → vrai renommage : badge retiré (`badgeRevoked: true`). Puis en interface : formulaire prérempli, avertissement affiché, enregistrement, message de badge retiré, et boutique publique à jour (nouveau nom, présentation, Bou Saâda, plus de badge).

**Nettoyage** : comptes de test et lignes du journal d'audit associées supprimés ; `prisma/dev.db` revenu à son état d'origine (9 utilisateurs, 1 compte pro, 24 annonces).

**Hors périmètre** : les collaborateurs ne peuvent pas modifier ces informations (propriétaire seul, comme logo/bannière) ; pas de journal d'audit de ces modifications côté propriétaire (le journal existant ne trace que des actions d'admin).

Prochain lot proposé : annuaire des concessionnaires (page listant les showrooms par wilaya, avec carte/téléphone), dans la suite directe des Lots 103 et 106.

## Lot 107 — Annuaire des concessionnaires (2026-09-18)

Les comptes professionnels avaient une vitrine `/pro/[id]` (Lot 13), un logo et une bannière (Lot 103) et des informations éditables (Lot 106), mais **rien ne permettait de les découvrir** : on ne trouvait une vitrine que si on en connaissait déjà l'identifiant. Suite directe des Lots 103 et 106.

**Décisions prises avec le porteur de projet**
- **Classement** : vérifiés d'abord, puis plus grand nombre d'annonces publiées, puis ordre alphabétique. **Aucun avantage lié à l'abonnement** — la page `/professionnels` ne promet pas de placement payant.
- **Inclusion** : seulement les comptes ayant **au moins une annonce publiée**. N'importe qui peut créer un compte pro sans contrôle ; exiger une annonce publiée (donc modérée) évite de lister des coquilles vides dans un annuaire public et indexable.

**Livré**
- `/concessionnaires` (`src/app/[locale]/concessionnaires/page.tsx`), sur le modèle de `/wilaya` : fil d'Ariane + JSON-LD, métadonnées avec URL canonique, filtre par wilaya (`?wilaya=<slug>`, formulaire GET qui fonctionne sans JavaScript, ne propose que les wilayas ayant au moins un professionnel, avec compteur), cartes (logo ou initiale, nom, badge Vérifié, wilaya, nombre d'annonces, note moyenne) menant à la vitrine, pagination par 12, états vides distincts (aucun professionnel / aucun dans cette wilaya). FR et AR (RTL).
- `src/lib/professional-directory.ts` : requêtes **batchées** (comptes, `groupBy` des annonces publiées, avis — jamais une requête par compte) et fonctions pures `assembleDirectoryEntries`, `sortDirectoryEntries`, `filterByWilaya`, `countByWilaya`, `paginate`, `directoryParamsSchema`.
- `Pagination.tsx` : prop optionnelle `basePath` (défaut `/recherche`, comportement de la recherche inchangé) ; `numeric` exporté depuis `validation/search.ts` pour être réutilisé ; lien dans le pied de page ; entrée dans le sitemap ; namespace `ProDirectory` FR/AR.
- 18 nouveaux tests unitaires (`tests/professional-directory.test.ts`). 509/509 au vert.

**Sécurité / confidentialité** : la requête est faite **sans** `include: { user }` — le téléphone est chiffré en base et n'a aucune raison d'atterrir dans le HTML d'une page publique crawlable. Vérifié sur le HTML réel : aucun lien `tel:`, aucun numéro (le seul motif « 0555123456 » trouvé est le texte d'exemple d'un champ de formulaire, embarqué dans les traductions de la page).

**Vérification de bout en bout en conditions réelles** : 15 comptes pro de test créés directement en base (l'inscription publique est limitée à 10 par IP et 15 minutes — je n'ai volontairement pas contourné cette limite), tous marqués par un domaine d'e-mail dédié, répartis sur 4 wilayas dont deux nouvelles (Bou Saâda, Aflou), avec 3 comptes vérifiés, un compte sans annonce et un compte dont la seule annonce est en attente de modération. Confirmé : 14 résultats (13 + le compte de démonstration) sur 2 pages de 12 ; les deux comptes à exclure absents ; ordre exact attendu (vérifiés par stock décroissant, puis non vérifiés par stock puis alphabétique) ; compteurs du filtre justes ; page 2 (2 professionnels) atteinte par un vrai clic sur « Suivant » ; filtres Bou Saâda (3) et Aflou (2) ; wilaya sans professionnel → message dédié ; slug inconnu → liste complète ; `page=abc` ignoré ; `page=99` ramené à la dernière page ; rendu arabe en RTL ; lien du pied de page ; entrée du sitemap ; carte → vitrine (200).

**Correctif trouvé pendant la vérification** : un slug de wilaya inconnu se retrouvait dans l'URL canonique alors que la page affichait la liste complète — le canonical ne reprend désormais que des valeurs valides.

**Nettoyage** : les 15 comptes, leurs annonces et comptes pro supprimés ; `prisma/dev.db` revenu à 9 utilisateurs, 1 compte pro, 24 annonces.

**Hors périmètre délibéré**
- **Aucun numéro de téléphone ni bouton d'appel** : aucune route de révélation limitée en débit n'existe (`PhoneReveal.tsx` reçoit le numéro en clair dans le HTML/RSC), donc l'afficher ici l'exposerait aux scrapers. Contact via la vitrine et la messagerie existantes.
- **Pas de carte** : aucune adresse ni coordonnée n'est stockée sur `ProfessionalAccount`.
- Pas de recherche par nom, pas de page par wilaya en chemin (`/concessionnaires/[wilaya]`) ; `/pro/[id]` n'a toujours ni `generateMetadata` ni entrée de sitemap.
- Tri et pagination faits en mémoire : adapté à un annuaire de professionnels (centaines), à revoir si le volume devenait très supérieur.
- Le libellé « 1 annonces disponibles » (clé `Catalogue.statsCount`, sans forme singulière) est celui déjà utilisé sur `/wilaya`, laissé tel quel.

Prochain lot proposé : vitrine `/pro/[id]` (métadonnées SEO, entrée de sitemap) pour terminer le parcours de découverte ; ou le paiement, seul grand chantier d'infrastructure non engagé.

## Lot 108 — SEO de la vitrine professionnelle (2026-09-18)

Suite du Lot 107 : l'annuaire renvoie désormais vers des vitrines `/pro/[id]`, mais celles-ci n'avaient **ni métadonnées, ni données structurées, ni entrée de sitemap**, et un compte inexistant répondait `200` avec un simple message (un « soft 404 » qu'un moteur de recherche indexe comme une page valide).

**Livré**
- `generateMetadata` sur `/pro/[id]` : titre (`Nom — Wilaya — Souq Auto`), description (la présentation du compte, ramenée sur une ligne et coupée à 160 caractères, à défaut une phrase de repli FR/AR), URL canonique, OpenGraph avec image de partage (bannière, à défaut le logo).
- **Vrai 404** pour un compte inexistant (`notFound()`, HTTP 404) à la place de la page `200` avec message ; clé `showcaseNotFound` supprimée (FR/AR), devenue sans usage.
- **`noindex, follow`** tant que le compte n'a aucune annonce publiée : même règle que l'annuaire, pour ne pas indexer de pages creuses. La page reste accessible.
- Données structurées : `BreadcrumbList` (Accueil › Concessionnaires › nom) et **`AutoDealer`** (`buildAutoDealerJsonLd`, `src/lib/structured-data.ts`) avec adresse (région = wilaya, pays DZ), logo et `aggregateRating` **seulement s'il existe au moins un avis**. Volontairement sans téléphone ni horaires (numéro : cf. Lot 107 ; horaires : texte libre, pas un format schema.org). Sérialisé par `safeJsonLdStringify`, comme tous les blocs JSON-LD du projet.
- Fil d'Ariane visible en haut de la vitrine, avec lien vers l'annuaire (maillage interne dans les deux sens).
- Sitemap : les vitrines des comptes ayant au moins une annonce publiée, obtenues via `getDirectoryEntries()` — exactement l'ensemble des vitrines indexables et des cartes de l'annuaire, une seule définition.
- `src/lib/pro-showcase-seo.ts` (`buildShowcaseDescription`, `isShowcaseIndexable`) ; 10 nouveaux tests (JSON-LD, description, règle d'indexation). 519/519 au vert.

**Vérification de bout en bout en conditions réelles** (comptes de test jetables, domaine d'e-mail dédié) : vitrine indexable avec présentation sur plusieurs lignes, logo, wilaya nouvelle (Bou Saâda) et 2 avis → titre, description aplatie, canonical, `og:image`, fil d'Ariane, les deux blocs JSON-LD parsés et valides, note 4,5 sur 2 avis ; même page en arabe (nom de wilaya en arabe) ; compte sans annonce → `200`, `noindex, follow`, description de repli, absent du sitemap ; identifiant inexistant → **HTTP 404** ; sitemap = exactement les 2 vitrines indexables (le compte de démonstration et le compte de test, pas le compte vide) ; rendu visuel contrôlé.

**Nettoyage** : comptes, annonce et avis de test supprimés ; `prisma/dev.db` revenu à 9 utilisateurs, 1 compte pro, 24 annonces, 0 avis.

**Hors périmètre** : `hreflang` reste porté par le sitemap uniquement (convention actuelle du projet, pas de `alternates.languages` dans les métadonnées) ; pas d'image de partage générée dynamiquement quand ni bannière ni logo n'existent.

Prochain lot proposé : à définir avec le porteur de projet — le paiement reste le seul grand chantier d'infrastructure non engagé.

## Lot 109 — Bascule de la base de données de SQLite vers PostgreSQL (2026-09-19)

Le schéma Prisma était codé en dur sur `provider = "sqlite"` alors que `.env.example`, `docs/ARCHITECTURE.md` et la fiche d'hébergement remise au prestataire visent PostgreSQL. Objectif : **un seul moteur partout** (développement, tests de bout en bout, production), pour tester ce qui sera réellement déployé. Préparation commitée le 2026-09-18 (`ee88739`), vérifiée et complétée ici.

**Livré**
- `prisma/schema.prisma` en PostgreSQL ; les **45 migrations SQLite** (`PRAGMA`, reconstructions de tables, `DATETIME`, `AUTOINCREMENT`) sont remplacées par **une baseline unique** (l'historique reste dans git), générée par `prisma migrate diff --from-empty` puis complétée à la main avec ce que Prisma ne modélise pas : les **3 index uniques partiels** `IdentityVerificationRequest_pending_unique`, `PaymentOrder_pending_unique`, `ProSubscriptionOrder_pending_unique` (ils protègent contre les doubles demandes en attente ; 4 routes interceptent `P2002`) et la ligne `singleton` de `ModerationSettings`. Les deux `UPDATE` de rattrapage de l'ancien historique (expiration, permissions) sont abandonnés : sans effet sur une base vide.
- **Recherche libre insensible à la casse** (`mode: "insensitive"` sur les 7 `contains` de `src/lib/search.ts`) : sous PostgreSQL `contains` distingue majuscules et minuscules, alors que SQLite non.
- **Entiers saisis bornés à 32 bits** (`src/lib/validation/int-bounds.ts`) : PostgreSQL n'a que des `Int` de 32 bits, donc `/recherche?priceMax=99999999999` provoquait une erreur 500 (SQLite, 64 bits, l'acceptait). `numeric()` écarte désormais toute valeur hors bornes (comme il écartait déjà une valeur non numérique) ; identifiants bornés dans `auth`, `profile`, `pro-account`, `listing` ; `estimate.ts` réutilise le `numeric()` partagé au lieu d'en dupliquer une version non bornée (la page `/cote-souq-auto` avait le même défaut).
- **Tests de bout en bout** : `e2e/reset-db.ts` vide et recrée le schéma `public` de la base dédiée (au lieu de supprimer un fichier), avec un **garde-fou** — refus si le nom de la base ne finit pas par `_e2e`, si elle est identique à `DATABASE_URL`, ou si `E2E_DATABASE_URL` manque. L'URL est lue à un seul endroit (`e2e/e2e-database.ts`) par `reset-db.ts` et `playwright.config.ts`. Le schéma est vidé par SQL plutôt que par `prisma migrate reset`, verrouillé par Prisma quand il est lancé par un agent IA.
- `.env.example` (URL PostgreSQL, paramètres de pool `connection_limit`/`pool_timeout`, mention de la collation), `.gitignore`, `README.md`, et `scripts/dev-db.ps1` (démarrer/arrêter/état d'un serveur PostgreSQL de développement dédié).
- 6 nouveaux tests unitaires (bornes 32 bits de la recherche et de l'estimation, `mode: "insensitive"` sur les 7 champs). 525/525 au vert.

**Point d'attention : mot de passe `postgres` inconnu.** PostgreSQL 17 tournait déjà sur le poste, mais son compte administrateur était inaccessible. Plutôt que de modifier sa configuration de sécurité, un **serveur PostgreSQL indépendant** a été créé avec les mêmes outils (`initdb`) : dossier de données dans le profil utilisateur (hors du dépôt), port **5433**, écoute limitée à `localhost`, tri français ICU (`fr-FR`), aucun droit administrateur. L'installation d'origine n'a pas été touchée. Ce serveur **ne redémarre pas seul avec Windows** : `powershell -File scripts/dev-db.ps1 start` (documenté dans le README).

**Vérification de bout en bout en conditions réelles (PostgreSQL 17.11)**
- `prisma migrate deploy` sans erreur ; **`prisma migrate diff` base → schéma : « empty migration »** — les index partiels non modélisés ne créent aucune dérive (`migrate dev` ne cherchera pas à les supprimer). Requêtes de contrôle : les 3 index existent avec leur condition `WHERE status = 'EN_ATTENTE'`, la ligne `ModerationSettings` (3/3) est présente, 14 types énumérés, base créée avec la collation ICU `fr-FR`.
- Seeds : 69 wilayas, 1 541 communes, 24 marques / 108 modèles / 67 générations / 20 équipements, compte admin, 24 annonces de démonstration.
- Recherche : `q=bmw`, `BMW` et `Bmw` donnent le même résultat, de même `alger`/`ALGER` (9 annonces). `priceMax=99999999999`, `brandId=99999999999&page=999…9`, `equipmentIds=1,99999999999` et `/cote-souq-auto?brandId=99999999999…` répondent tous **200** (erreur 500 sans le correctif).
- Tri de `/fr/wilaya` : `Aïn Defla` avant `Alger`, `Béchar`/`Béjaïa` parmi les B (pas après `Z`) — 69 wilayas.
- Parcours par l'API : inscription, doublon d'e-mail (`409`), connexion, création d'un compte pro (wilaya 68, Bou Saâda), publication d'une annonce avec photo, approbation par l'admin, présence dans l'annuaire, vitrine `200`, recherche libre de l'annonce.
- **Index partiels** : un second virement `EN_ATTENTE` pour la même annonce est refusé par la base (`P2002`) ; données de test nettoyées.
- **`npm run test:e2e` : 6/6** sur `souq_auto_e2e` (inscription/connexion, publication en 11 étapes, messagerie, conseiller IA en français et en arabe). Le garde-fou refuse bien les trois cas (nom sans `_e2e`, URL identique à `DATABASE_URL`, variable absente), avec un message clair et le code de sortie 1. Next n'acceptant qu'un serveur de développement à la fois dans un dossier, il faut arrêter `npm run dev` avant `npm run test:e2e`.

**Observation (existant, non corrigé)** : sur `/recherche`, quand toutes les annonces trouvées sont des annonces « en avant », le bloc « Annonces en avant » s'affiche mais le message « Aucune annonce ne correspond à votre recherche » apparaît aussi (la liste principale les exclut, `page.tsx` teste `listings.length === 0`). Sans lien avec la bascule ; correctif d'une ligne à faire à part.

**Hors périmètre, pistes** :
- **Verrouillage de compte non atomique** (`login/route.ts`) : avec de vrais écrivains parallèles, des tentatives simultanées peuvent sous-compter les échecs ; un `increment` atomique règle cela (périmètre du Lot 102).
- **Courses « vérifier puis créer »** sans interception de `P2002` (inscription, changement d'e-mail, création de marque, avis, compte pro) : renvoient 500 au lieu de 409 en cas de course, plus probables en parallèle.
- E-mails non normalisés en minuscules (latent, identique sous SQLite) ; identifiants des routes d'administration lus par `Number(id)` sans borne (accès admin seulement).
- Les données de `prisma/dev.db` (SQLite) ne sont pas migrées : la base de démonstration est recréée par les seeds. L'ancien fichier reste sur disque, ignoré par git.

Prochain lot proposé : la rubrique « Essais » (plan validé, Lots 110 et 111).

## Lot 110 — Rubrique « Essais » : le socle (2026-09-19)

Demandé par le porteur de projet à partir de deux captures d'une rubrique d'essais d'un grand site d'annonces français (index « Essais auto » ; page d'essai avec signataire et photo, note en étoiles, « points forts / points faibles », texte). On reprend le **concept éditorial** — jamais le contenu, la mise en page ou les libellés de ce site. La rubrique est livrée **vide** : comme le magazine, elle est alimentée par l'équipe, un essai décrivant un véhicule réellement testé (aucun essai n'est fabriqué). Premier des deux lots prévus ; le second (Lot 111) apportera la photo de couverture, la mise en forme du texte et le flux RSS.

**Livré**
- **Modèle** : `BlogArticle.kind` (`ARTICLE` par défaut, `ESSAI`) et un modèle 1-1 `RoadTest` (note de 0,5 à 5 par demi-point, points forts/faibles et verdict FR/AR, version testée, date de l'essai, lien facultatif marque/modèle/génération du catalogue). Migration additive (`20260919090859_road_tests`) ; `migrate dev` ne tente rien sur les 3 index partiels. Les articles existants restent des articles. Aucune donnée « mesurée » (consommation, prix) n'est modélisée : seulement ce que la rédaction saisit.
- **Publication programmée** (`src/lib/blog-publication.ts`, aussi pour le **magazine**) : `publishedAt` porte l'état — `null` = brouillon, date future = programmé, date passée = publié. Avant ce lot le code testait seulement « non null » : une date future serait apparue tout de suite. Toute lecture publique passe par `publishedNow(now)`. La date est décidée **côté serveur** (jamais l'horloge du navigateur) ; « Publié » sur un article déjà paru garde sa date d'origine (une correction ne le republie pas, ne change pas son rang). L'API remplace le booléen `published` par `publication` (`draft` / `now` / `scheduled` + date).
- **Pages publiques** : `/essais` (cartes, note en étoiles, marque/modèle, pagination par 12) et `/essais/[slug]` (signataire avec sa photo et la date, note en étoiles avec demi-étoile, verdict, deux colonnes points forts ⊕ / points faibles ⊖, texte, version testée, « Mis à jour le… » seulement si l'écart dépasse 24 h, lien vers les annonces du modèle). Métadonnées OpenGraph `article`, fil d'Ariane, JSON-LD **`Review`** (`itemReviewed` de type `Car`, note sur 5 avec `bestRating`/`worstRating`, auteur `Person` ou `Organization`). Section « Essais de ce modèle » sur `/voitures/[marque]/[modèle]`. Lien « Essais » dans l'en-tête et le pied de page. FR et AR (RTL, demi-étoile remplie du bon côté, note « 3,5 » avec virgule en français).
- **Croisements** : `/mag` ne liste plus que les articles ; `/mag/[slug]` **redirige** un essai vers `/essais/[slug]` (les slugs partagent un même espace) ; un article ou un essai non paru renvoie un vrai 404.
- **Administration** (ADMIN seulement, comme le magazine) : `/admin/essais` (liste avec états brouillon / programmé / publié), création et modification via `BlogArticleForm` (marque → modèle → génération en cascade, note, listes, verdict, choix « brouillon / publier maintenant / programmer le… »). La liste, le journal d'audit (`blog_article.*`, avec `kind` et état) et l'API sont partagés avec le magazine. Le type est fixé à la création (`kind_mismatch` sinon).
- **Sitemap** : `/essais` et chaque essai paru ; `dynamic = "force-dynamic"` ajouté — sans cela Next fige le sitemap au moment du build, donc un essai programmé n'y apparaîtrait jamais (le même défaut latent touchait les nouvelles annonces).
- Refactorisations : `validateVehicleRefs` extrait de `validateCatalogueRefs` (marque/modèle/génération, partagé avec les essais) ; pagination partagée (`src/lib/pagination.ts`, `pageWindow`/`paginate`, ré-exportée par l'annuaire).
- 40 nouveaux tests unitaires (publication et états, « mis à jour », résolution de la date, note et étoiles, listes, formatage de la note, schéma zod essai/article, mappage `RoadTest`, JSON-LD `Review`, pagination). 565/565 au vert.

**Vérification de bout en bout en conditions réelles (PostgreSQL)**
- **Validations de l'API** (`400` attendus) : essai sans fiche, article avec fiche, note 3,3, modèle inconnu (`unknown_model`), génération d'un autre modèle (`unknown_generation`), programmation sans date ; non-admin `403` ; changement de type `kind_mismatch`.
- **Public** : l'index n'affiche que les essais parus (brouillon et programmé absents), `/mag` que les articles parus ; brouillon, essai programmé, article sous `/essais` et article programmé sous `/mag` → `404` ; essai sous `/mag` → `307` vers `/essais/…` ; page d'essai complète (note, colonnes, verdict, signataire, version testée, lien modèle) ; JSON-LD `Review` valide ; section « Essais de ce modèle » sur la page Renault Clio ; sitemap sans brouillon ni programmé.
- **Publication programmée, avant/après sans aucune action** : un essai programmé à +45 s est absent de l'index, de la page (`404`) et du sitemap, puis présent partout — **en développement et en production** (`next build` puis `next start`, où `/sitemap.xml` est bien dynamique et aucune page essais ou magazine n'est prérendue).
- **Formulaire d'administration réellement utilisé** : cascade marque/modèle/génération, envoi d'un essai programmé pour le lendemain (badge « Programmé le… », pas de lien « Voir »), modification d'un essai publié (champs préremplis, date de publication d'origine conservée, journal d'audit `create` puis `update`), « Mis à jour le… » affiché après 3 jours simulés, redirection d'un essai ouvert depuis `/admin/mag`.
- `npm run test:e2e` 6/6 ; types et lint propres. Données de test supprimées (essais, articles, lignes d'audit, compte non-admin) ; base revenue à 0 essai, 8 utilisateurs, 24 annonces.

**Points d'attention**
- **Le signataire est le compte administrateur qui crée l'essai**, affiché avec le nom et la photo de son profil public (à défaut « Souq Auto »). Ce nom devient public : si besoin, le profil peut porter « Rédaction Souq Auto ».
- Le texte des essais reste, pour ce lot, du texte simple (paragraphes séparés par une ligne vide) ; les intertitres et listes arrivent au Lot 111.
- « Mis à jour le… » se base sur `updatedAt` : toute modification d'un essai (même une faute de frappe) le fait avancer.

**Hors périmètre** : photo de couverture, mise en forme Markdown et flux RSS (Lot 111) ; avis de propriétaires par modèle (il faudrait un système d'avis rattaché aux modèles, absent ici) et « Comprendre la note » (je n'invente pas de méthodologie de notation) ; galerie de photos, versions multiples d'un essai, génération automatique de contenu.

Prochain lot proposé : Lot 111 — photo de couverture, mise en forme du texte et flux RSS.

## Lot 110 bis — Filtres de recherche en menus déroulants (2026-09-19)

Demandé par le porteur de projet à partir d'une capture de la page de recherche : les champs libres « Prix (DA) », « Année » et « Kilométrage max » (qui affichait « 0 ») deviennent des menus déroulants. (Numéroté « bis » pour ne pas décaler le Lot 111 annoncé pour les essais.)

**Livré**
- **Menus** (`SearchFilters.tsx`, `src/lib/search-filter-options.ts`) : prix mini/maxi par paliers de 500 000 à 30 000 000 DA, année mini/maxi de l'année courante à 1990 (la plus récente d'abord), kilométrage maxi de 10 000 à 300 000 km. Première option « Min » / « Max » / « Indifférent » = aucun filtre. Nombres formatés selon la langue (FR/AR), sans suffixe « DA » dans les options (il tronquait le libellé dans la colonne étroite).
- **Aucun changement côté serveur ni dans les adresses** : les menus lisent et écrivent les mêmes paramètres entiers (`priceMin`, `priceMax`, `yearMin`, `yearMax`, `mileageMax`), donc les liens existants, les recherches sauvegardées, les alertes et le conseiller IA continuent de fonctionner. Une valeur d'adresse qui n'est pas un palier (ex. `priceMax=1234567`) est ajoutée au menu et affichée telle quelle plutôt qu'effacée ou remplacée par un palier voisin. `mileageMax=0` s'affiche « Indifférent » (le serveur l'ignorait déjà).
- 7 nouveaux tests unitaires (paliers croissants, années, normalisation, valeur d'adresse hors palier, ordre décroissant des années). 572/572 au vert ; types et lint propres.

**Vérification dans le navigateur** : plus aucun champ numérique sur la page ; sélection prix 3 000 000 → 6 000 000, année 2019+, kilométrage 100 000 km → adresse `?priceMax=6000000&mileageMax=100000&priceMin=3000000&yearMin=2019` et 8 résultats, identiques au décompte en base ; réouverture de cette adresse : les menus affichent les bonnes valeurs.

**Point d'attention** : les paliers fixes remplacent la saisie libre (un budget de 2 750 000 DA se choisit désormais par 2 500 000 ou 3 000 000) ; les listes sont faciles à ajuster dans `search-filter-options.ts`.

## Lot 111 — Essais : photo de couverture, mise en forme du texte et flux RSS (2026-09-19)

Second lot de la rubrique Essais (le premier, Lot 110, posait le socle). Toujours aucun contenu fabriqué : la rubrique reste vide tant que la rédaction n'a pas publié d'essai.

**Livré**
- **Photo de couverture** (essais uniquement) : `BlogArticle.coverImageUrl` (migration additive `20260919095200_blog_cover_image`). Envoi par `POST /api/admin/blog/cover` (ADMIN, limité à 30 envois/heure) : octets réels contrôlés (JPEG/PNG/WebP, 8 Mo), rotation EXIF, **recadrage 16:9 à 1600×900**, nom généré, stockage `blog-covers` (S3 ou disque, comme les autres photos). L'adresse renvoyée est jointe à l'article à l'enregistrement, et **revalidée par `isBlogCoverUrl`** : seuls sont acceptés les fichiers `blog-covers/<uuid>.jpg` de notre propre stockage — jamais une URL externe, un fichier d'un autre dossier (logo, photo d'annonce, messagerie) ni un chemin détourné. Le fichier remplacé, retiré ou appartenant à un essai supprimé est effacé du stockage, sauf si un autre essai l'utilise encore. Affichée en tête de la page de l'essai, sur les cartes de l'index et de la page du modèle, et comme image de partage OpenGraph.
- **Mise en forme Markdown** (`ArticleBody`, dépendance `react-markdown` 10) : titres `##`/`###`, gras, italique, listes, citations, liens. **Rendu restreint** : le HTML brut est ignoré (`<script>`, `<iframe>` disparaissent), les images sont retirées (la seule image d'un essai est sa couverture), les adresses `javascript:`/`data:`/`vbscript:` sont neutralisées (le texte du lien reste, sans lien), les liens externes s'ouvrent avec `rel="noopener noreferrer nofollow"`, un `#` est ramené au niveau 2 (la page a déjà son unique `<h1>`). Un texte sans balisage particulier s'affiche comme avant. Le formulaire d'administration affiche l'aide de mise en forme sous le champ texte. **Le rendu du magazine (`/mag`) est inchangé.**
- **Flux RSS** : `/fr/essais/feed.xml` et `/ar/essais/feed.xml` (RSS 2.0, 30 derniers essais **parus**, langue de l'adresse ; autre langue → 404). Construit par la fonction pure `buildRssFeed` (échappement XML, caractères interdits retirés, dates RFC 822, image de couverture en `media:content`). Lu à chaque requête (`force-dynamic`) : un essai programmé y entre à sa date sans reconstruire. Déclaré dans le `<head>` de `/essais` (`<link rel="alternate" type="application/rss+xml">`) et proposé par un lien visible sous le titre de l'index (FR/AR).
- 26 nouveaux tests unitaires (contrôle d'adresse de couverture, schéma zod, flux RSS, rendu Markdown dont les tentatives d'injection). 598/598 au vert.

**Vérification de bout en bout en conditions réelles (PostgreSQL)**
- **Formulaire d'administration réellement utilisé** : envoi d'une image carrée 1000×1000 → fichier stocké en **JPEG 1600×900**, bandes haute et basse rognées, aperçu 16:9 dans le formulaire, essai créé avec sa couverture.
- **Page de l'essai** : couverture en tête, `og:image` absolue, un seul `<h1>`, titres/listes/citation/liens rendus ; le `<script>`, l'`<iframe>`, l'image espion et le lien `javascript:` du texte de test **n'ont produit aucun élément** (le titre de la page n'a pas été modifié par le script).
- **Refus de l'envoi** : SVG, faux PNG (texte), fichier de 9 Mo, envoi vide → 400 (`photo_invalid_type`, `photo_too_large`, `validation`) ; anonyme → 403.
- **Refus de l'adresse** : URL externe, fichier du dossier `avatars`, chemin `../` → 400 `invalid_cover` ; couverture sur un article simple → 400.
- **Cycle de vie du fichier** : remplacement → ancien fichier supprimé (404) ; retrait → fichier supprimé ; suppression de l'essai → fichier supprimé ; couverture partagée par deux essais → la suppression de l'un **garde** le fichier de l'autre.
- **Flux RSS** : XML bien formé (analysé par `DOMParser`) en FR et AR, bon type MIME, image de couverture présente ; brouillon absent ; essai programmé à +40 s **absent du flux, de l'index et de sa page (404)**, puis présent partout sans aucune action (33 s d'attente) ; `/en/essais/feed.xml` → 404.
- **Production** : `next build` (flux, page d'essai, sitemap et envoi de couverture sont bien dynamiques) puis `next start` : flux vide valide (200), envoi anonyme 403.
- `npm run test:e2e` 6/6 ; types et lint propres. Fichiers de test supprimés du disque (`public/uploads/blog-covers` vide) et base revenue à 0 article, 0 essai.

**Points d'attention**
- L'image est envoyée **dès son choix**, pas à l'enregistrement : si l'administrateur abandonne le formulaire, le fichier reste orphelin sur le stockage (défaut mineur, toléré comme pour les autres envois).
- Pas d'aperçu du Markdown dans l'administration : un brouillon (ou un essai programmé) n'a pas de page publique, donc le rendu ne se voit qu'une fois l'essai paru. Un aperçu dans le formulaire serait un ajout utile.
- Un texte d'essai contenant des caractères Markdown (`*`, `_`, `#`, `-` ou `1.` en début de ligne) est désormais interprété comme mise en forme.
- Onze lignes du journal d'audit (`blog_article.create/update/delete`) issues de cette vérification restent en base de développement : leur suppression a été refusée par le garde-fou de l'environnement, je ne l'ai pas contournée. Elles concernent des essais de test déjà supprimés (titres « Essai Renault Clio… », « Essai B/C/D… »).
- `package-lock.json` change nettement (la dépendance `react-markdown` apporte son arbre d'analyse Markdown) ; aucune autre dépendance directe n'a changé.

**Hors périmètre** : couverture et Markdown pour le magazine (`/mag` inchangé), aperçu en direct, galerie de photos, avis de propriétaires par modèle, « Comprendre la note ».

## Lot 112 — Durcissement : verrouillage de connexion, adresses email, doublons simultanés, identifiants (2026-09-19)

Les quatre points de robustesse relevés lors des audits précédents (Lots 98–102) et laissés ouverts. Chacun a d'abord été **mesuré avant correction**, avec des requêtes réellement simultanées sur des comptes jetables (supprimés depuis).

**1. Verrouillage de connexion contourné par des rafales** (`src/lib/login-lockout.ts`, `api/auth/login`)
- *Avant* : 8 mauvais mots de passe envoyés en même temps → compteur d'échecs à **1**, aucun verrouillage. La route lisait le compteur, ajoutait 1 puis réécrivait : toutes les requêtes simultanées lisaient la même valeur. Un attaquant pouvait donc enchaîner des rafales de mots de passe sans jamais verrouiller le compte.
- *Correctif* : incrément **fait par la base** (`failedLoginAttempts: { increment: 1 }`), le verrouillage se décide sur la valeur réellement comptée ; plus un **plafond par compte** (20 tentatives / 15 min, toutes adresses IP confondues, contrôlé avant toute vérification de mot de passe et appliqué de la même façon aux adresses inexistantes, donc sans révéler l'existence d'un compte).
- *Après* : mêmes 8 requêtes → compteur à **8** et compte verrouillé. 25 rafales depuis 25 adresses IP différentes (usurpées) → 20 traitées, 5 refusées (429), identique pour une adresse inexistante.

**2. Adresses email sensibles à la casse** (`src/lib/validation/auth.ts`, migration `20260919110000_normalize_emails`)
- *Avant* : `Durc.Casse@Example.com` puis `durc.casse@example.com` créaient **deux comptes** ; se connecter avec une autre casse que celle de l'inscription échouait (401).
- *Correctif* : `emailSchema` (espaces retirés, minuscules, puis validation) partagé par l'inscription, la connexion, l'invitation d'un collaborateur et le changement d'adresse. Migration : passe les adresses existantes en minuscules (elle **échoue volontairement** si deux comptes ne diffèrent que par la casse : à traiter à la main) et ajoute un **index unique sur `lower(email)`**, garde-fou de la base pour tout chemin d'écriture qui ne normaliserait pas. Prisma ne modélise pas cet index : ajouté à la main comme ceux du Lot 109 ; `prisma migrate diff` reste vide (aucune dérive).
- *Après* : inscription en casse mixte puis en minuscules → 201 puis **409** ; connexion en MAJUSCULES → 200 ; `Prisma.user.create` direct avec `ADMIN@SouqAuto.dz` → refusé par la base (`P2002` sur `lower(email)`).

**3. Doublons simultanés : 500 au lieu d'une réponse claire** (`src/lib/prisma-errors.ts`, `isUniqueViolation`)
- *Avant* (12 requêtes identiques simultanées d'un même compte) : favoris 2 × 500, blocage **11** × 500, ouverture de conversation **11** × 500, avis 9 × 500, signalement 9 × 500, création de compte pro 4 × 500 ; inscription simultanée de la même adresse : 5 × 500. (`upsert` sur une clé composée n'est pas atomique côté base.)
- *Correctif* : la base reste l'arbitre, la violation d'unicité (`P2002`) est traduite dans la même réponse que la vérification préalable — inscription et changement d'adresse (`email_taken` 409), téléphone (`phone_taken` 409), avis (`already_reviewed`), signalement (`already_reported` 409), collaborateur (`already_collaborator`), compte pro (`already_professional`), marque/modèle/article (`slug_taken` 409) ; favoris, blocage et conversation, idempotents, renvoient le résultat demandé (la conversation existante). La confirmation d'un changement d'email (page serveur) affiche « adresse déjà prise » au lieu de planter.
- *Après* : les mêmes rafales ne produisent **plus aucun 500** — favoris 12 × 201, blocage 12 × 201, conversation 12 × 201 (même conversation), avis 1 × 201 puis refus, signalement 1 × 201 puis 409, inscription 1 × 201 + 5 × 409, création de marque 1 × 201 + 5 × 409.

**4. Identifiants numériques des routes d'administration** (`parsePositiveIntId`, 5 routes : marques, modèles, modèles d'une marque)
- *Avant* : `abc` et `99999999999` → 500 ; surtout `1.5` était **accepté** : la base l'arrondissait, si bien que `PATCH /api/admin/brands/1.5` **renommait réellement la marque 1** et `POST /api/admin/brands/1.5/models` créait un modèle (constaté ; catalogue de développement rétabli aussitôt à partir du journal d'audit).
- *Correctif* : seuls sont acceptés les entiers positifs en chiffres, sans zéro de tête, tenant sur 32 bits ; tout le reste se comporte comme un identifiant inexistant (404).
- *Après* : `0`, `-1`, `007`, `1.5`, `1e3`, `abc`, `99999999999` → 404 sur les cinq routes ; un identifiant valide fonctionne comme avant.

**Tests** : 11 nouveaux tests unitaires (identifiants, détection de `P2002`, normalisation d'email, plafond de connexion ; tests du verrouillage réécrits pour le nouveau calcul). 609/609. `npm run test:e2e` 6/6 sur une base neuve (la migration s'y applique), `next build` propre, types et lint propres. Comptes et lignes de test supprimés (8 utilisateurs, 24 marques, 108 modèles, comme avant).

**Points d'attention**
- **Adresse IP du client (décision d'hébergement)** : `getClientIp` (`src/lib/http.ts`) prend la **première** valeur de `X-Forwarded-For`, que le client fixe lui-même. Tant que le serveur n'est pas derrière un mandataire qui l'écrase, toutes les limites « par IP » (connexion, inscription, envois…) se contournent en changeant cet en-tête — les mesures ci-dessus l'ont d'ailleurs utilisé. Les limites *par compte* de ce lot n'en dépendent pas. Le bon correctif dépend de l'hébergement (nombre de mandataires de confiance, présence d'un CDN) : à trancher avec la fiche d'hébergement, pas à deviner ici.
- Le plafond par compte peut être atteint par quelqu'un qui tape volontairement des mots de passe erronés sur le compte d'autrui : l'effet est le même que le verrouillage déjà en place (15 minutes), pas plus.
- Un bon mot de passe envoyé juste après une rafale reçoit 429 tant que la fenêtre de 15 minutes n'est pas écoulée.
- La limite en mémoire (repli sans Redis) n'est pas purgée des clés expirées : sans importance avec Redis (clés à durée de vie), à reprendre si le déploiement se fait sans.

**Hors périmètre** : vérification puis création d'une demande de changement d'email (aucune contrainte d'unicité concernée) ; brouillons d'annonce (`upsert` sur clé simple, natif côté base) ; correction de `getClientIp` (voir ci-dessus).

## Lot 113 — Correctif : message « Aucune annonce » de /recherche (2026-09-19)

- **Défaut** (repéré au Lot 66, laissé ouvert) : quand toutes les annonces correspondant à une recherche sont des annonces **en avant** (Premium / Premium+, affichées en tête de la première page et exclues de la liste normale pour ne pas les répéter), la liste normale est vide. La page affichait alors « 1 annonces trouvées », l'annonce en avant… et, juste dessous, « Aucune annonce ne correspond à votre recherche ».
- **Correctif** (`src/app/[locale]/recherche/page.tsx`) : le message n'apparaît que s'il n'y a vraiment rien à afficher (ni annonce en avant, ni annonce normale) ; la grille normale n'est rendue que si elle contient quelque chose.
- **Vérification** : sur la recherche `brandId=5&modelId=27` (Hyundai Tucson, une seule annonce publiée, en avant) — *sans* le correctif : « 1 annonces trouvées » + message ; *avec* : l'annonce en avant seule, sans message. Une recherche sans résultat (`q=zzzzintrouvable`) affiche toujours le message ; la page sans filtre (24 annonces) est inchangée. Types, lint et 609 tests au vert.
- **Non traité** : « 1 annonces trouvées » (pas de singulier) — le texte `Search.resultsCount` est une chaîne simple en français comme en arabe ; un vrai pluriel demande les formes ICU (l'arabe en a six) et une relecture de la traduction.

## Lot 114 — Revue de presse : les essais publiés ailleurs, en lien (2026-09-19)

Demandé par le porteur de projet : alimenter la rubrique Essais avec ce que publie la presse automobile (Auto Magazine, La Revue Automobile, L'argus, La Centrale). **Ces textes sont protégés par le droit d'auteur** : les recopier, même reformulés ou traduits, serait de la contrefaçon, et ferait signer par Souq Auto un avis que la rédaction n'a pas formé. Le lot livre donc l'option retenue par le porteur de projet : une **revue de presse** — un *lien* vers l'article d'origine, jamais son texte — et la phrase que la rédaction écrit elle-même. Rien n'a été récupéré sur ces sites ; la rubrique est livrée **vide**, alimentée par la rédaction.

**Livré**
- **Modèle** `PressReview` (migration additive `20260919141531_press_reviews`) : média (nom saisi), adresse, titre tel que publié, date de parution chez le média, phrase de la rédaction en français **et** en arabe (20 à 300 caractères : trop courte pour porter un extrait), marque/modèle du catalogue (facultatifs, `SET NULL` si le modèle est supprimé), `publishedAt` (brouillon / en ligne, comme les articles).
- **Adresses** (`src/lib/press-review.ts`) : seules les adresses `https://` sont acceptées ; refusées : `javascript:`, `data:`, `http:`, identifiants dans l'adresse (`https://media.fr@autre-site.com` trompe sur la destination), adresses IP et noms sans point (`localhost`, réseau interne). L'adresse est normalisée (fragment, paramètres publicitaires `utm_*`/`fbclid`/…, barre finale retirés) et **unique en base** : le même article ne figure qu'une fois, même écrit de deux façons. Le serveur ne télécharge jamais l'adresse (aucun risque de requête vers un réseau interne).
- **Administration** (ADMIN seulement, comme le magazine et les essais) : `/admin/revue-de-presse` (liste, ajout, modification, suppression, journal d'audit `press_review.*`), entrée « Revue de presse » dans le menu. Aides de saisie : recopier le titre sans rien y ajouter, écrire la phrase dans ses propres mots, ne coller aucun passage.
- **Public** : section « Revue de presse » sous les essais de `/essais` (6 dernières), page `/essais/revue-de-presse` paginée (12 par page), section « Ce qu'en dit la presse » sur la page d'un modèle (3 dernières). Chaque carte : média, date de parution chez lui, titre-lien, phrase de la rédaction, domaine, lien vers le modèle. Liens externes en `target="_blank"` avec `rel="noopener noreferrer nofollow"` ; titre en `dir="auto"` (il est dans la langue du média). Avertissement affiché : ces articles appartiennent à leurs éditeurs, nous ne les reproduisons pas, la phrase est celle de la rédaction. FR et AR.
- `revue-de-presse` devient un **slug réservé** : un essai portant ce titre serait masqué par la page fixe (il devient `revue-de-presse-2`).
- 14 nouveaux tests unitaires (normalisation et refus d'adresses, schéma, slug réservé). 623/623.

**Vérification de bout en bout en conditions réelles (PostgreSQL)**, avec des données fictives (`media.example.org`) : `javascript:`, `http:`, identifiant, `127.0.0.1`, `localhost`, adresse vide → 400 ; notes trop courtes, modèle inconnu, identifiant hors bornes → 400 ; même article sous une autre forme d'adresse → 409 ; **6 créations simultanées → 1 × 201 + 5 × 409** ; adresse `…/?utm_source=x#c` enregistrée `…` nettoyée. **Formulaire d'administration réellement utilisé** (saisie, cascade marque → modèle, enregistrement, adresse nettoyée à l'enregistrement). Public : seule l'entrée en ligne apparaît (le brouillon est absent), sur l'index (FR et AR/RTL), la page dédiée et la page du modèle ; liens externes avec les bons attributs. Modification : une entrée déjà en ligne garde sa date, une adresse déjà prise est refusée (409), la dépublication la retire aussitôt. Suppression : elle disparaît partout. `next build` (les 4 nouvelles pages sont dynamiques), `npm run test:e2e` 6/6, types et lint propres. Entrées de test supprimées (0 entrée de revue de presse ; les lignes du journal d'audit `press_review.*` restent, leur suppression étant refusée par le garde-fou de l'environnement).

**Points d'attention**
- **Le droit de citer un titre et de renvoyer vers un article** est admis, mais **la rédaction reste responsable de ce qu'elle saisit** : titre recopié tel quel, phrase dans ses propres mots, jamais un extrait ni une traduction du texte. Le formulaire le rappelle ; rien ne peut le vérifier automatiquement.
- Les entrées sont saisies **à la main** : rien ne parcourt automatiquement les sites cités (ce qui poserait des questions de conditions d'utilisation et de droit d'auteur).
- La page `/essais/revue-de-presse` est une liste de liens : si le volume devient important, à surveiller côté référencement (contenu propre limité à la phrase de la rédaction).

**Hors périmètre** (suite prévue de l'option « contenus autorisés ») : contenus tirés de dossiers de presse de constructeurs avec mention de la source, et avis de propriétaires par modèle — voir les décisions à prendre avant ces lots. (Livrés aux Lots 115 et 116 ci-dessous.)

## Lot 115 — Magazine : mention de la source d'un article (2026-09-19)

Suite de l'option « contenus autorisés » retenue par le porteur de projet : des articles du magazine rédigés **par la rédaction, avec ses propres mots**, à partir d'un dossier de presse de constructeur ou d'un communiqué, avec la source affichée.

**Livré**
- **Champs** `BlogArticle.sourceName` / `sourceUrl` (migration additive `20260919143009_blog_article_source`), facultatifs, réservés aux articles du magazine : **refusés pour un essai**, qui décrit un véhicule testé par la rédaction.
- **Validation** (`src/lib/blog-source.ts`) : un lien sans nom est refusé (le lecteur ne saurait pas ce qu'il ouvre) ; nom de 2 à 120 caractères ; le lien suit les règles de la revue de presse (`https://` seulement, pas d'identifiant ni d'adresse IP ni de nom interne) et est enregistré normalisé.
- **Affichage** sous l'article (`/mag/[slug]`) : « Source : {nom} » (lien externe en `noopener noreferrer nofollow` s'il existe) suivi de « article rédigé par la rédaction Souq Auto à partir de cette source ». Balisage `isBasedOn` dans le JSON-LD `Article` quand il y a un lien. FR et AR.
- **Formulaire d'administration** : bloc « Source (facultative) » avec l'aide : texte rédigé avec ses propres mots, jamais un passage collé, **ne pas utiliser les images du dossier de presse sans avoir vérifié leurs conditions d'usage**.
- 10 nouveaux tests. Vérifié en conditions réelles : lien sans nom, nom trop court, `javascript:`, `http:`, identifiant dans l'adresse, adresse IP, essai avec source → 400 ; création avec adresse nettoyée (`…/?utm_source=mail#haut` → `…`), avec nom seul, sans source ; affichage FR et AR, `isBasedOn` présent seulement avec un lien ; retrait de la source à la modification ; formulaire de modification pré-rempli.

**Point d'attention** : rien ne peut vérifier automatiquement que le texte est bien rédigé par la rédaction ; la mention de source n'autorise pas à recopier un dossier de presse, elle documente d'où vient l'information.

## Lot 116 — Avis de propriétaires par modèle (2026-09-19)

Dernière partie de l'option « contenus autorisés » : de vrais retours d'utilisateurs, présentés comme tels. Réglages retenus par le porteur de projet : tout compte à **email vérifié** peut donner un avis, présenté comme celui d'un **« propriétaire déclaré »** ; **un avis par personne et par modèle** ; **validation par l'équipe avant publication** ; **moyenne affichée à partir de 3 avis**.

**Livré**
- **Modèle** `OwnerReview` (note 1–5, texte, année d'achat et kilométrage facultatifs, état `EN_ATTENTE` / `PUBLIE` / `REFUSE`, motif, dates de modération), unique par (personne, modèle), et `Report.ownerReviewId` (signalement d'un avis). Migration `20260919170000_owner_reviews` (SQL généré par `migrate diff`, aucune opération destructrice).
- **Écriture** (`/api/models/[modelId]/owner-reviews`, POST/PATCH/DELETE) : compte connecté à email vérifié (401 / 403 sinon) ; texte de 40 à 2 000 caractères, **sans numéro de téléphone (formats locaux, +213, chiffres arabo-indiens), email ni lien** ; 20 envois par jour ; identifiant de modèle strict (`parsePositiveIntId`). **Toute modification remet l'avis en attente**, y compris un avis publié (on ne publie pas un texte pour le remplacer sans relecture). Le retrait est libre.
- **Modération** : `/admin/avis-proprietaires` (MODERATEUR et ADMIN), publier ou refuser ; **motif obligatoire (5 à 300 caractères) pour un refus**, transmis à l'auteur par email, ainsi que la publication ; décision atomique (deux modérateurs simultanés : le second reçoit un conflit) ; journal d'audit `owner_review.approve|reject|remove_after_report`.
- **Signalement d'un avis publié** (lecteur connecté ; motifs : propos inappropriés, avis inventé ou de complaisance, autre avec détails) : rejoint `/admin/signalements`, où l'avis visé est affiché. Un signalement **confirmé retire l'avis** (avec motif, notification de l'auteur), un signalement rejeté ne change rien ; jamais de retrait sur un signalement non vérifié. Un seul signalement par personne et par avis.
- **Page d'un modèle** : section « Avis de propriétaires » (10 derniers avis publiés, badge « Propriétaire déclaré », année d'achat, kilométrage, date, nom du profil public), note moyenne en étoiles **seulement à partir de 3 avis publiés** (en dessous : le nombre d'avis et une explication), avertissement « aucune preuve de possession », formulaire pour les comptes vérifiés (état de son propre avis : en attente / en ligne / refusé avec le motif), invitation à se connecter ou à vérifier son email sinon. Pluriel correct (ICU) en français et en arabe. Pas de balisage `aggregateRating` : une note issue d'avis déclarés et modérés par le site lui-même n'est pas publiée comme donnée structurée.
- **Conformité** : nouvelle clause des **CGU** (avis déclarés, contenu interdit, relecture, retrait, données) ; **suppression de compte** : ses avis sont supprimés ; **export des données personnelles** : ses avis y figurent, ainsi que le type de cible de ses signalements.
- 21 nouveaux tests unitaires (détection de coordonnées, éligibilité, moyenne, transitions de modération, motif de refus, schémas). 653/653.

**Vérification de bout en bout en conditions réelles (PostgreSQL)**, sur des comptes jetables dont l'email est vérifié **par le vrai parcours** (demande de vérification, jeton, page de confirmation) : anonyme 401, email non vérifié 403 ; numéro de téléphone, lien, texte court, note 6, modèle inconnu / hors bornes / décimal → 400 ou 404 ; **12 envois simultanés du même compte → 1 création + 11 conflits (409)**. Modération : refus sans motif ou trop court 400, refus motivé 200, seconde décision 409, action invalide 400, identifiant inconnu 404. Page publique (texte réellement affiché, FR et AR) : avis en attente et refusé **absents**, moyenne absente à 2 avis puis présente à 3, retour à 1 avis après un retrait. Auteur : statut « en ligne » / « refusé + motif » / formulaire pré-rempli ; modification d'un avis publié → en attente et retiré de la page. Signalements : anonyme 401, sur son propre avis 400, motif non prévu 400, « autre » sans détails 400, avis en attente ou refusé 404, **6 signalements simultanés → 1 + 4 conflits + 1 refus de débit** ; la file de l'équipe montre l'avis visé ; confirmation → avis retiré avec motif, second traitement refusé, courriels de décision et de notification envoyés (aperçus dans les journaux). Suppression de compte : 1 avis avant, 0 après. Export : l'avis y figure. `next build`, `npm run test:e2e` 6/6, types et lint propres. **Comptes, avis et signalements de test supprimés** (8 utilisateurs, 24 marques, 108 modèles, 0 avis) ; les lignes du journal d'audit `owner_review.*`, `press_review.*` et `blog_article.*` restent (leur suppression est refusée par le garde-fou de l'environnement).

**Points d'attention**
- **Aucune preuve de possession** : le badge dit « déclaré » et la page l'explique ; un avis de complaisance ou d'un concurrent reste possible. Les garde-fous sont la relecture, le signalement et l'email vérifié, pas une preuve.
- **Charge de modération** : chaque avis (et chaque modification) passe par l'équipe. Un compteur d'avis en attente au tableau de bord et une alerte par email à l'équipe ne sont pas faits.
- **Traductions arabes** (interface, courriels, CGU, formes du pluriel) : rédigées ici, à faire relire par un locuteur natif ; la clause des CGU est à faire valider juridiquement, comme les autres pages légales.
- Le nom affiché est celui du **profil public** (déjà public pour les vendeurs). Un pseudonyme dédié aux avis serait un choix de confidentialité à trancher.
- Le plafond de 20 envois par jour compte aussi les tentatives refusées.

**Hors périmètre** : avis par génération ou version, photos, réponse de la rédaction à un avis, vote « utile », classement des modèles par note.

## Lot 117 — Préparation du lancement : configuration de production, comptes, emails, adresse IP, santé (2026-09-19)

Premier bloc du plan « évolution du site » retenu par le porteur de projet : rendre le site prêt à être ouvert au public. Chaque point ci-dessous est un **risque réel constaté dans le code**, pas une précaution théorique.

**Constats et correctifs**
- **Emails vers une boîte de test en production** (`src/lib/mail-config.ts`, `mailer.ts`) : sans `SMTP_HOST`, l'application basculait silencieusement vers un compte Ethereal de test, y compris en production — vérifications d'adresse, décisions de modération et notifications auraient été « envoyées » sans jamais arriver. **En production, un SMTP non configuré est désormais une erreur explicite.** Ajout de `SMTP_FROM`, `SMTP_SECURE` (TLS implicite déduit du port 465), refus d'un identifiant sans mot de passe et d'un port invalide. L'expéditeur n'est plus codé en dur.
- **Administrateur de développement créé partout** (`src/lib/admin-bootstrap.ts`, `prisma/seed.ts`) : `db:seed` créait toujours `admin@souqauto.dz` avec le mot de passe publié dans le dépôt. **En production, `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont obligatoires** (12 caractères minimum, différent du mot de passe du README) ; sinon le compte n'est pas créé et le seed sort en erreur. Le comportement de développement est inchangé.
- **Adresse IP falsifiable** (`src/lib/client-ip.ts`, `http.ts`) : l'adresse du visiteur était la **première** valeur de `X-Forwarded-For`, écrite par le client, donc toutes les limites par IP se contournaient (constaté au Lot 112). Nouvelle variable **`TRUSTED_PROXY_HOPS`** (nombre de serveurs intermédiaires de confiance : 1 pour un nginx, 2 pour un CDN puis nginx) : l'adresse retenue est celle que le premier serveur de confiance a vue. Une falsification à gauche de cette valeur est sans effet. **La décision d'hébergement devient une valeur de configuration.** Sans la variable : ancien comportement, signalé comme bloquant par le contrôle ci-dessous.
- **Contrôle de mise en ligne** (`npm run launch:check`, `src/lib/launch-checks.ts`, `scripts/launch-check.ts`) : juge la configuration **comme pour la production** et ne modifie rien. Vérifie `JWT_SECRET` et `ENCRYPTION_KEY` (présence, longueur, 32 octets en base64), mot de passe de base, adresse publique en https et non locale, SMTP, `TRUSTED_PROXY_HOPS`, migrations appliquées, mot de passe administrateur (compare le hash au mot de passe publié), comptes de démonstration (`@example.*`) ; avertit pour Redis, S3 et un expéditeur par défaut. Code de sortie 1 s'il reste un bloquant ; chaque point explique sa correction. Sur cette machine de développement : 5 bloquants, 1 avertissement — le diagnostic attendu.
- **Point de contrôle pour la supervision** : `GET /api/health` → 200 si la base répond, 503 sinon ; Redis absent ou en panne n'est **pas** une panne (limites en mémoire) ; aucune donnée sensible ni message d'erreur détaillé dans la réponse ; jamais mis en cache.
- **Documentation** : section « Mise en production » du README (base neuve, configuration, `migrate deploy`, `db:seed` sans jamais `db:seed:demo`, contrôle, démarrage, supervision), variables documentées dans `.env.example`.
- 37 nouveaux tests (configuration d'email, sélection de l'adresse IP dont la falsification, administrateur de production, règles du contrôle, route de santé avec base ou Redis simulés en panne).

**Vérification en conditions réelles** : `npm run launch:check` sur la configuration de développement (5 bloquants attendus, mot de passe administrateur publié détecté, 7 comptes de test détectés) ; `GET /api/health` → 200 avec base et Redis en ordre, `POST` → 405 ; `next build` (route dynamique) ; `npm run test:e2e` 6/6 sur une base neuve.

**Points d'attention**
- **Purge des données de démonstration** : aucun outil de suppression n'a été écrit, volontairement. Effacer des comptes et leurs annonces dans une base de production est dangereux ; la règle est de **ne jamais y mettre de données de démonstration** (base neuve + `db:seed` seul), et `launch:check` bloque si elles y sont.
- `TRUSTED_PROXY_HOPS` doit correspondre à la **réalité de l'hébergement** : trop grand, l'adresse retenue est celle du premier mandataire (tous les visiteurs partageraient les mêmes limites) ; trop petit, elle reste falsifiable. À fixer avec l'hébergeur.
- La conformité juridique (protection des données personnelles, déclarations) n'est pas du code : à faire valider par un juriste.

## Lot 118 — Exploitation : alertes de modération, compteur, sauvegardes vérifiées (2026-09-19)

Suite du bloc « préparation du lancement » : que l'équipe sache quand du contenu attend, et que les données survivent à un incident.

**Livré**
- **Alertes de modération** (`src/lib/staff-alerts.ts`) : quand une annonce, un avis de propriétaire (dépôt **ou modification**), une demande de vérification d'identité ou un signalement passe « en attente », l'équipe reçoit un courriel (`STAFF_ALERT_EMAILS`, adresses séparées par des virgules, 10 au plus). **Un courriel par type et par 30 minutes au plus** ; il donne l'état de **toute** la file avec un lien par ligne, le type déclencheur en tête. Envoyé **après** la réponse à l'utilisateur (`after()` de Next) et **sans jamais lever d'exception** : un serveur d'email en panne ne gêne ni le dépôt d'une annonce ni le reste. Sans la variable : aucune alerte (comportement d'avant).
- **Tableau de bord** : compteur « Avis propriétaires à valider » (il manquait), FR et AR.
- **Sauvegarde** (`npm run db:backup`, `scripts/backup-db.mjs`) : `pg_dump` compressé horodaté, **relu** (`pg_restore --list`) pour vérifier qu'il est exploitable, empreinte SHA-256, suppression des sauvegardes de plus de 14 jours (jamais un fichier étranger), option `--with-uploads` pour les photos. Multiplateforme, retrouve seul les outils PostgreSQL (dont ceux de Windows hors PATH) ; le mot de passe n'est jamais affiché. Dossier `backups/` ignoré par git.
- **Test de restauration** (`npm run db:restore-check`) : restaure la dernière sauvegarde dans une base **temporaire**, compare 15 tables clés avec la base réelle, supprime la base temporaire dans tous les cas. Ne touche jamais à la base réelle.
- **Guide d'exploitation** (`docs/EXPLOITATION.md`) : contrôle avant mise en ligne, sauvegardes (planification, copie hors serveur, test mensuel, restauration réelle, protection de `ENCRYPTION_KEY`), supervision, environnement de recette, sécurité d'exploitation, marche à suivre en cas d'incident.
- 13 nouveaux tests d'alertes (liste des destinataires, contenu et ordre du courriel, accord du genre, limite de fréquence, robustesse aux pannes de base, de Redis et du serveur d'email).

**Vérification en conditions réelles** : sauvegarde de la base de développement (291 objets, archive relue, 151 Ko) puis **restauration réelle dans une base temporaire : les 15 tables clés sont identiques à la base réelle** (dont 1 541 communes, 108 modèles, 88 lignes d'audit), base temporaire supprimée. **Cas d'échec** : une archive tronquée est détectée (« restauration non conforme », code de sortie 1) et la base temporaire est nettoyée quand même. **Alertes** : avec `STAFF_ALERT_EMAILS` renseigné temporairement (puis retiré), deux comptes jetables à email vérifié par le vrai parcours déposent chacun un avis → **un seul courriel** part, dont le contenu a été relu ; cette relecture a fait trouver et corriger une faute (« nouvelle avis » → « nouvel avis », « Un(e) » → « À traiter : »). Comptes de test et clé de limite supprimés, `.env` remis à l'identique. `next build`, `npm run test:e2e` 6/6, types et lint propres, **703 tests**.

**Points d'attention**
- **L'alerte reflète l'état au moment de l'envoi** : elle peut annoncer « 1 élément » alors qu'un second arrive une minute plus tard (limite de 30 minutes). Un récapitulatif périodique (résumé quotidien) demanderait une tâche planifiée, non incluse.
- **Rien n'est planifié automatiquement** : la sauvegarde nocturne et le test mensuel sont à programmer sur le serveur (cron / planificateur de tâches, exemple dans le guide) ; **la copie hors serveur est indispensable**.
- Le rôle de base de ce poste est super-utilisateur ; ce ne doit pas être le cas en production (noté dans le guide).
- Pas d'outil de suivi d'erreurs (Sentry…) ni de service de supervision externe : `/api/health` est prêt pour l'un comme pour l'autre, mais ils restent à choisir et à configurer.

**Reste du bloc 1 (hors code)** : environnement de recette à créer avec l'hébergeur ; démarches de conformité juridique ; choix de l'hébergement et service d'email réel (fournisseur, domaine, SPF/DKIM).

## Lot 119 — Bloc 2 : contact rapide (appel, WhatsApp) sans numéro dans la page (2026-09-19)

Premier lot du bloc 2 « faire revenir les visiteurs » : un contact plus direct pour l'acheteur, et un numéro que la page n'expose plus. Traité avant la PWA parce que l'analyse a révélé un défaut réel.

**Ce que la vérification a montré (et une correction de ma propre mesure)**
- La page d'une annonce passait `seller.phone` à un composant client (`PhoneReveal`). Or le numéro est chiffré au repos par une extension Prisma qui **ne s'applique qu'aux requêtes directes sur `user`** : lu depuis l'annonce (`select` ou `include` imbriqué), il reste chiffré. Mesuré sur une annonce de test : chaque visiteur recevait dans la page **le numéro chiffré** (`"phone":"p5GCtn…"`), identique pour un même numéro donc traçable d'une annonce à l'autre, et le bouton « Afficher le numéro » aurait affiché ce texte illisible à la place d'un numéro. **Personne ne l'avait vu : aucun vendeur de démonstration n'a de téléphone.**
- Ma première mesure annonçait le numéro *en clair* dans la page (« 1 occurrence ») : c'était **un faux positif** — le texte d'exemple « Ex : 0555123456 » d'un message de traduction embarqué dans la page. Corrigé avant de conclure ; la mesure finale exclut ce texte et cherche aussi le numéro chiffré.

**Livré**
- **Le numéro n'est plus dans la page.** Il est demandé au clic à `POST /api/listings/[id]/contact` (`TELEPHONE` ou `WHATSAPP`, langue du visiteur). La page ne transmet que le fait qu'un numéro existe et le choix WhatsApp du vendeur. Le numéro est lu par une requête **directe** sur `user` (donc déchiffré) ; un test verrouille cette règle pour qu'elle ne puisse pas être défaite par un refactoring.
- **Limites de débit** : visiteur non connecté 30 demandes/heure par adresse et 6/heure par annonce et par adresse ; compte connecté 100/heure. L'adresse suit `TRUSTED_PROXY_HOPS` (Lot 117) : la limite n'est plus contournable par un en-tête falsifié une fois la variable définie.
- **Refus indiscernables** (404, sans dire pourquoi) : annonce non publiée, suspendue, vendue ; vendeur suspendu ou supprimé ; vendeur sans numéro ou numéro dans un format inattendu (jamais un lien cassé) ; vendeur qui a **bloqué** l'acheteur (même règle que la messagerie). Le vendeur lui-même reçoit `own_listing`.
- **WhatsApp** : bouton proposé **seulement si le vendeur l'a choisi** (case « Je suis joignable sur WhatsApp à ce numéro » dans son profil, désactivée par défaut, impossible sans numéro et remise à zéro si le numéro est retiré). Lien `https://wa.me/213…` avec un **message pré-rempli** (français ou arabe) qui nomme l'annonce et y renvoie. Numéro converti au format international (`0555…` et `+213555…`), jamais fabriqué : un format invalide donne un refus.
- **Comptage des contacts** (`ContactEvent`, migration `20260919190000_contact_events`) : annonce, canal, utilisateur connecté éventuel, date — **jamais l'adresse IP ni le numéro**. Prépare les statistiques pour les professionnels (bloc 3).
- Profil : option WhatsApp, présente aussi dans l'export des données personnelles. FR et AR.
- 24 nouveaux tests : liens de contact (formats, encodage, impossibilité de détourner le numéro ou l'hôte par le texte du message), route (numéro lu directement, 404 sans raison, blocage, limites, comptage sans IP), validation du profil.

**Vérification en conditions réelles (PostgreSQL)**, sur un vendeur jetable avec numéro fictif et une annonce publiée : page servie à un anonyme → **0 occurrence du numéro, en clair comme chiffré** ; appel révélé à la demande (`tel:+213555123456`) et compté ; WhatsApp refusé (404) avant activation puis servi après, message en français et en arabe ; activation sans numéro refusée (`whatsapp_needs_phone`) sans effacer le numéro ; corps invalide 400 ; annonce inconnue, en attente, suspendue, refusée, vendue et vendeur suspendu → 404 ; vendeur qui a bloqué l'acheteur → 404 ; **6 demandes autorisées puis 429** pour une même adresse et une même annonce, une autre adresse non affectée ; clic réel dans le navigateur → « Appeler 0555123456 » et bouton WhatsApp. Comptes, annonce, événements et photo de test supprimés. `next build`, `npm run test:e2e` 6/6, types et lint propres, **727 tests**.

**Points d'attention**
- **Un numéro reste récupérable à la main** : quiconque clique voit le numéro, et un robot patient peut le faire dans la limite de débit (30/h par adresse, 6/h par annonce). Le but est de supprimer la lecture passive de la page et de borner la collecte, pas de l'empêcher totalement. Exiger un compte connecté, ou un défi anti-robot, serait plus strict au prix d'un frein pour les acheteurs.
- **Ouverture de WhatsApp** : la fenêtre est ouverte pendant le clic (les navigateurs bloquent une ouverture faite après l'attente réseau) puis redirigée ; non testé sur mobile réel avec l'application WhatsApp installée.
- Les numéros déjà enregistrés ne changent pas ; aucun vendeur n'a encore choisi WhatsApp.

**À suivre (bloc 2)** : application installable (PWA, Lot 120 ci-dessous) ; notifications pour les alertes de recherche (nécessite une clé d'envoi de notifications et une dépendance, à valider).

## Lot 120 — Bloc 2 : application installable (PWA) (2026-09-19)

Le site peut être installé sur l'écran d'accueil d'un téléphone ou d'un ordinateur, s'ouvre comme une application et affiche une page claire quand la connexion tombe. Conçu pour ne **jamais** mettre en cache de contenu personnalisé.

**Livré**
- **Manifeste** (`src/app/manifest.ts`, servi en `/manifest.webmanifest`) : nom « Souq Auto », mode application autonome, couleurs de la marque (`#12222e`), langue déduite du visiteur (`start_url: "/"`), trois raccourcis (rechercher, vendre, essais). Le `<head>` annonce le manifeste, la couleur de la barre du navigateur, le nom de l'application et les balises d'application pour iPhone.
- **Icônes** (`public/icons/`, générées par `scripts/generate-pwa-icons.mjs` à partir du logo) : 192 et 512 pixels, plus une icône **« maskable »** dont le dessin tient dans la zone de sécurité de 80 % (le téléphone la découpe en cercle ou en carré arrondi) — vérifié pixel par pixel dans un test.
- **Service worker** (`public/sw.js`, enregistré **seulement en production**) volontairement minimal :
  - il ne met en cache que des **fichiers statiques immuables** (`/_next/static/`, `/icons/`) et la page hors connexion ;
  - il ne touche **jamais** aux pages HTML, à l'API (`/api/`), ni aux échanges internes de Next entre pages (`RSC`, préchargements) : ils sont personnalisés et resteraient lisibles par la personne suivante sur un poste partagé, ou périmés ;
  - il ne traite que les requêtes GET de la même origine ; les photos S3, WhatsApp, etc. lui échappent ;
  - hors connexion, seule une **navigation** bascule sur `/offline.html` ; une erreur 4xx/5xx du serveur s'affiche telle quelle ; l'API échoue vraiment (aucune réponse simulée).
  - La décision « que faire de cette requête » est isolée dans `classifyRequest`, testée directement sur le vrai fichier.
- **Page hors connexion** (`public/offline.html`) : bilingue français / arabe (le second en lecture de droite à gauche), bouton « Réessayer », `noindex`, **aucune ressource externe** (elle doit s'afficher sans réseau).
- **Installation** : bouton « Installer l'application » dans le pied de page quand le navigateur le permet (Chrome, Edge, Android) ; explication « Partager → Sur l'écran d'accueil » sur iPhone et iPad (Safari n'a pas de bouton) ; **rien** si l'application est déjà installée. FR et AR.
- Le service worker est servi avec `Cache-Control: no-cache, no-store` (`next.config.ts`) : une mise à jour du site ne peut pas rester bloquée derrière une ancienne version.
- 50 nouveaux tests : 26 unitaires (décisions du service worker, manifeste, icônes réellement présentes et à la bonne taille, page hors connexion sans dépendance externe, détection iOS et « déjà installée ») et **7 de bout en bout** dans un vrai navigateur.

**Vérification en conditions réelles**
- **Le navigateur intégré à l'application Claude ne permet pas de tester un service worker** : il échoue à télécharger *n'importe quel* script (même un fichier PNG donne « erreur inconnue » au lieu d'une erreur de type de fichier), alors que le serveur répond 200. Limite de cet outil, pas du code. La vérification a donc été faite avec le **Chromium de Playwright**, sur une version de production, en test permanent (`npm run test:e2e:pwa`, `e2e-pwa/`, port 5186, base de test) :
  1. manifeste valide, icônes en PNG, couleur de la marque ;
  2. le service worker s'enregistre (portée `/`, script `/sw.js`) et contrôle la page à la visite suivante ;
  3. `sw.js` servi sans cache ;
  4. après avoir visité connexion, recherche et appelé l'API, le seul cache (`souq-static-v1`) ne contient **que** `/offline.html`, `/icons/…` et `/_next/static/…` — **aucune page, aucune réponse d'API** ;
  5. **hors connexion réelle** (`setOffline`) : la page prévue s'affiche en français et en arabe, sans aucune donnée du site ; connexion rétablie et « Réessayer » : la vraie page revient ;
  6. hors connexion, un appel à l'API échoue réellement ;
  7. aucun bouton d'installation sans invite du navigateur.
- Serveur de production démarré à la main : manifeste `application/manifest+json`, `sw.js` sans cache, icônes et page hors connexion en 200, balises dans la page. `npm run test:e2e` 6/6, 753 tests unitaires, types et lint propres.

**Points d'attention**
- **Non testé sur un vrai téléphone** : ni l'invite d'installation (Chrome/Android), ni la procédure iPhone, ni l'aspect de l'icône découpée. Playwright vérifie le comportement, pas l'expérience sur l'appareil.
- **Le bouton d'installation dépend de Chrome/Edge/Android** ; Safari (iPhone) n'a qu'une explication ; Firefox de bureau n'installe pas.
- **Mise à jour du service worker** : changer la liste des fichiers pré-chargés ou la stratégie exige d'augmenter `VERSION` dans `public/sw.js` (les anciens caches `souq-*` sont alors supprimés à l'activation).
- Le test de bout en bout de la PWA compile puis démarre le site (environ 1 minute) : il est séparé de `npm run test:e2e` pour cette raison.
- Une ligne « The destination stream closed early » apparaît dans les journaux du serveur pendant ce test : c'est Next qui signale un navigateur ayant abandonné une réponse en cours (rechargement, mise hors connexion), sans effet.

**Reste du bloc 2** : notifications pour les alertes de recherche (dépendance `web-push`, clés VAPID, abonnements — décision à valider).

## Lot 121 — Bloc 2 : notifications pour les alertes de recherche (2026-09-19)

Une alerte de recherche qui correspond à une nouvelle annonce n'arrive plus seulement par email : elle s'affiche aussi sur les appareils que la personne a choisi d'abonner, site fermé. Dépendance ajoutée avec votre accord : **`web-push`** (protocole standard Web Push, clés VAPID).

**Livré**
- **Abonnement par appareil** (`/compte/alertes`, encadré « Notifications sur cet appareil ») : « Activer » (la permission du navigateur n'est demandée qu'au clic), « Envoyer une notification d'essai », « Désactiver ». États expliqués : navigateur sans notifications (iPhone hors application installée), notifications bloquées, indisponibles, version de développement. FR et AR.
- **Modèle** `PushSubscription` (migration `20260919200000_push_subscriptions`) : un appareil = une ligne (adresse unique), suppression en cascade avec le compte, 5 appareils au maximum par compte (les plus anciens sont oubliés).
- **Routes** : `GET /api/push/config` (clé **publique** seulement), `POST`/`DELETE /api/push/subscribe`, `POST /api/push/test`. Connexion obligatoire ; limites 20 abonnements/h et 5 essais/h par compte ; `no-store`.
- **Adresse d'envoi contrôlée** (protection contre l'usage détourné du serveur, SSRF) : l'appareil fournit l'adresse du service de notification ; seuls sont acceptés `https`, port 443, sans identifiants, sur les services réels des navigateurs (`fcm.googleapis.com`, `push.services.mozilla.com`, `notify.windows.com`, `push.apple.com`, et leurs sous-domaines). Revérifiée à l'envoi.
- **Envoi** (`src/lib/push-send.ts`) : ne lève jamais d'exception (l'email d'alerte part de toute façon), sans effet sans clés, délai maximal de 8 s, abonnement supprimé automatiquement quand le service répond 404/410 (appareil désabonné ou application désinstallée), journal sans l'adresse complète (elle sert de secret d'envoi).
- **Service worker** (`public/sw.js`) : affichage de la notification (icône du site, sens de lecture arabe), et au clic réutilisation d'un onglet du site déjà ouvert, sinon nouvelle fenêtre. L'adresse ouverte est **toujours une page du site** : `https://autre-site`, `//autre-site`, `javascript:` se replient sur l'accueil, même si le message a été falsifié. Un message illisible ne donne jamais une notification vide.
- **Alertes** (`src/lib/search-alerts.ts`) : même déclencheur que l'email (annonce approuvée en modération), notification dans la langue de la personne, qui ouvre directement l'annonce ; une même annonce ne notifie jamais deux fois la même alerte (tag et index unique existant).
- **Configuration** : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`.env.example`). Sans elles la fonction est simplement désactivée. `npm run push:keys` génère la paire (écrite dans `.env` sans afficher la clé privée ; `-- --print` pour la copier dans le gestionnaire de secrets ; **refuse d'écraser** une paire existante sans `--force`, car cela invaliderait tous les abonnements). `npm run launch:check` : avertissement si désactivé, **bloquant** si la configuration est incomplète, mal formée ou si la clé privée ne correspond pas à la clé publique. Documenté dans `docs/EXPLOITATION.md` et le README.
- **75 nouveaux tests unitaires** : règles pures (15), envoi (9), routes (18), validateurs du service worker (8), gestionnaires du service worker exécutés sur le vrai fichier (10), utilitaire du navigateur (5), déclenchement par les alertes (7), contrôle de lancement (+3).

**Vérification en conditions réelles** (base et serveur de développement, puis version de production)
- Routes : clé publique servie et identique à `.env`, **clé privée absente** de la réponse ; 401 sans connexion (les trois routes) ; abonnement enregistré avec le navigateur ; **10 adresses non autorisées refusées** (IP locale, métadonnées cloud, http, faux sous-domaine, identifiants dans l'adresse, autre port, schéma `ftp`, adresse relative…) ; clés invalides, corps non JSON et corps vide refusés ; un compte **ne peut pas désabonner l'appareil d'un autre** (0 supprimé) mais un appareil réutilisé par un autre compte lui est réattribué ; plafond de 5 appareils (le plus ancien supprimé) ; limites 20/h et 5/h déclenchées.
- Interface sur la **version de production avec le vrai service worker**, en français et en arabe : activation (clé de l'application envoyée au navigateur identique à celle du site, 65 octets), ligne créée en base, état conservé après rechargement, désactivation (ligne supprimée, abonnement du navigateur annulé), serveur qui refuse (aucun abonnement orphelin, message d'erreur), permission refusée, demande de permission fermée sans réponse, quatre réponses du bouton d'essai. Aucune erreur dans la console.
- Comptes jetables supprimés ensuite (aucun abonnement ni compte de test restant). 828 tests unitaires, `npm run test:e2e` 6/6, `npm run test:e2e:pwa` 7/7, types et lint propres.

**Points d'attention — ce qui n'a PAS pu être vérifié**
- **L'acheminement réel d'une notification** (serveur → Google/Mozilla/Apple → appareil) n'a pas été testé : il exige un vrai appareil abonné, et je n'ai pas envoyé de fausses données à ces services. Ce qui est vérifié : le contenu et l'adresse envoyés (tests avec `web-push` simulé), la validation des adresses, et l'affichage/clic par le vrai code du service worker dans un contexte isolé. **À faire avant l'ouverture** : activer les notifications sur un vrai téléphone Android et un ordinateur, cliquer « Envoyer une notification d'essai », puis faire approuver une annonce correspondant à une alerte.
- **Le navigateur sans interface utilisé pour les tests refuse toute permission de notification** (et le Chromium complet ne démarre pas sur ce poste) : le service d'abonnement du navigateur (`PushManager`) a donc été simulé pour tester l'interface, la vraie route et la vraie base. Il n'existe pas de test Playwright de l'affichage : il serait resté vide.
- **iPhone / iPad** : les notifications n'existent que pour l'application **installée** sur l'écran d'accueil (iOS 16.4 ou plus) ; l'encadré l'explique. Non testé sur un appareil.
- **Clé VAPID de production** : à générer une seule fois (`npm run push:keys -- --print`) et à garder dans le gestionnaire de secrets ; la régénérer oblige chaque appareil à réactiver les notifications. La paire de ce poste est locale (`.env`, ignoré par git) et ne doit pas servir en production.
- L'envoi est attendu par la modération d'une annonce (en parallèle entre les alertes, 8 s au plus par service) : acceptable aujourd'hui ; à déplacer en tâche de fond si le nombre d'alertes devient important.
- Le sous-titre de « Mes alertes » parle encore d'« un email » : à harmoniser avec l'encadré si vous le souhaitez.

**Reste possible dans ce bloc** : notification pour les nouveaux messages (mêmes briques, `sendPushToUser` est prêt).

## Lot 122 — Bloc 3 : statistiques pour les professionnels (2026-09-19)

Un compte professionnel voit ce que produisent ses annonces : vues, contacts (numéro affiché, WhatsApp, messages), favoris, sur 7, 30 ou 90 jours, avec des courbes par jour. Le détail annonce par annonce est réservé aux abonnements Pro et Premium (de quoi justifier un abonnement).

**Livré**
- **Page `/pro/statistiques`** (lien « Statistiques détaillées » dans le tableau de bord pro) : cinq indicateurs (vues, contacts avec le détail appels / WhatsApp / messages, ajouts aux favoris, conversations, taux de contact), deux histogrammes par jour (vues, contacts), tableau par annonce (vues, favoris, appels, WhatsApp, messages, taux de contact ; les annonces vendues, expirées ou suspendues y figurent, étiquetées). Propriétaire **et collaborateurs** du compte (même règle que le tableau de bord) ; visiteur non connecté redirigé vers la connexion ; personne sans compte pro : invitation à en créer un. FR et AR (RTL), sans bibliothèque de graphiques (HTML/CSS accessible : chaque barre porte sa valeur, chaque graphique une description).
- **Vues par jour** : nouveau modèle `ListingViewDay` (migration `20260919210000_listing_view_days`) — un compteur par annonce et par jour civil algérien, **sans adresse IP, sans identifiant de visiteur, sans heure de visite**. Incrémenté avec `Listing.views` dans **une seule transaction**, par un `INSERT … ON CONFLICT … count + 1` atomique.
- **Vues plus justes** : ne sont plus comptés le vendeur lui-même (déjà le cas), **ni les robots** d'indexation, d'aperçu de lien (Facebook, WhatsApp, Skype…), de supervision, ni les bibliothèques HTTP (curl, requests, axios…), ni une requête sans `User-Agent`. Cela vaut aussi pour le compteur total affiché sur les annonces, qui pourra donc croître un peu moins vite qu'avant. Comptage après l'envoi de la page (`after()`), sans jamais faire échouer l'affichage.
- **Taux de contact** = (numéros affichés + conversations) ÷ vues, **affiché seulement à partir de 30 vues** (« 2 contacts sur 3 vues » ne veut rien dire) et plafonné à 100 %.
- **Palier** : `hasDetailedStatistics` (dans `pro-subscription.ts`) reprend aujourd'hui la règle des « outils avancés » (Pro et Premium) ; fonction séparée pour pouvoir changer ce palier sans toucher à l'export ni au renouvellement automatique. Textes de la page publique des abonnements et de l'indice « verrouillé » du tableau de bord mis à jour en conséquence.
- **Correction en passant** : publier une annonce avec un numéro **déjà utilisé par un autre compte** provoquait une erreur 500 (contrainte d'unicité non gérée). La route répond maintenant `409 phone_taken`, sans créer d'annonce ni modifier le numéro, et l'assistant de publication affiche un message clair (FR/AR), comme le formulaire de profil.
- 27 nouveaux tests unitaires (828 → 855) : fenêtres et jours en heure d'Algérie (changement de mois, année bissextile, 23 h UTC = jour suivant), périodes acceptées, taux, tri, agrégation en base simulée, détection des robots, atomicité du comptage.

**Vérification en conditions réelles** (base et serveur de développement, comptes jetables supprimés ensuite)
- Vues : 25 visites de navigateur comptées ; **3 visites Googlebot, curl, facebookexternalhit et le vendeur exclus** ; jour enregistré = jour civil algérien ; total global +25 ; **40 visites simultanées toutes comptées** (65 = 25 + 40, une seule ligne par jour).
- Contacts réels par la route publique (2 appels, 1 WhatsApp, 1 appel sur une autre annonce), 4 favoris, 2 conversations : la page affiche exactement 75 vues, 6 contacts (3 appels, 1 WhatsApp, 2 messages), 4 favoris, 2 conversations, taux 8 % ; par annonce 65 vues / 3 favoris / 2 appels / 1 WhatsApp / 1 message / 6,2 % ; `—` sous 30 vues.
- Période : une vue et un contact d'il y a 60 jours n'apparaissent que sur 90 jours (82 vues, 7 contacts) ; `?jours=abc` retombe sur 30 jours.
- Accès : compte Pro → tableau détaillé ; compte Starter → totaux et courbes, **tableau verrouillé** ; collaborateur sans aucune permission → même vue que le propriétaire ; compte sans espace pro → invitation ; anonyme → 307 vers `/fr/connexion`.
- Rendu en français, en arabe (RTL) et sur téléphone (390 px) : aucun défilement horizontal de la page, aucune erreur de console. 855 tests unitaires, `npm run test:e2e` 6/6, `npm run test:e2e:pwa` 7/7 (qui compile aussi la version de production), types et lint propres.

**Points d'attention**
- **Historique** : les vues d'avant ce lot n'ont pas de détail par jour ; les courbes commencent à la mise en service. Le total de chaque annonce, lui, est conservé.
- **Palier** : c'est une décision commerciale prise par défaut (détail par annonce = Pro et Premium, totaux et courbes pour tous les comptes pro) ; elle se change en une ligne.
- **Taux de contact** : il ne compte que les contacts que le site voit (numéro affiché, message). Un visiteur qui note l'annonce et appelle par un autre moyen n'y figure pas ; un numéro « affiché » n'est pas un appel passé.
- Les contacts (`ContactEvent`) et conversations sont relus sur la période en une requête chacun : sans souci pour les volumes actuels ; à agréger en base si un compte dépasse plusieurs dizaines de milliers de contacts par période.

**Reste du bloc 3** : suivi des contacts (liste de prospects par annonce, avec statut et note) ; paiement SATIM, en attente de l'ouverture du compte marchand (le virement manuel existe déjà).

## Lot 123 — Bloc 3 : suivi des prospects (2026-09-19)

Un compte professionnel dispose d'une liste de ses **prospects** — les personnes identifiées qui lui ont écrit à propos d'une annonce — avec, pour chacune, un **statut** et une **note privée**. C'est le pendant « suivi » des statistiques du Lot 122.

**Livré**
- **Page `/pro/prospects`** (lien « Suivi des prospects » dans le tableau de bord pro) : une fiche par prospect (nom d'affichage, annonce, date du dernier échange, lien vers la conversation), statut et note modifiables, compteurs par statut, filtres par statut et par annonce, FR et AR (RTL), téléphone compris. Ceux qui **attendent une réponse** (le dernier message vient de l'acheteur) portent un badge et passent en tête, sauf s'ils sont soldés (vendu, perdu).
- **Statuts** : Nouveau, À rappeler, En négociation, Vendu, Perdu. Sans suivi enregistré, un prospect est « Nouveau » : la ligne n'est créée qu'à la première modification.
- **Modèle** `ProspectFollowUp` (migration `20260919220000_prospect_follow_ups`) : statut, note (500 caractères au plus), qui a modifié en dernier (propriétaire ou collaborateur). Supprimé avec la conversation. **Aucune donnée nouvelle sur l'acheteur** n'est stockée ni montrée : ni email, ni téléphone.
- **Route** `PATCH /api/pro/prospects/[conversationId]` : statut, note, ou les deux (envoyer l'un ne touche pas à l'autre ; une note vide efface la note). 200 modifications par heure et par compte. Deux enregistrements simultanés d'un prospect encore sans suivi ne créent qu'une ligne.
- **Qui a accès** : le propriétaire du compte pro et les collaborateurs autorisés à **gérer les annonces** — les mêmes personnes que celles qui peuvent lire la messagerie de ce compte. Un collaborateur en lecture seule voit « vous n'avez pas accès » (afficher les noms des prospects lui donnerait plus que ce que la messagerie lui montre). La route répond `404` identique pour une conversation inconnue et pour une conversation dont on n'a pas la gestion ; un vendeur sans compte pro (outil professionnel) ou l'acheteur lui-même obtiennent aussi `404`.
- **Cohérence avec la messagerie** : une conversation que le vendeur a masquée n'apparaît plus ; elle revient, avec son statut conservé, dès que l'acheteur écrit de nouveau. Les messages supprimés ne comptent pas pour savoir qui a parlé en dernier.
- 30 nouveaux tests unitaires (855 → 885) : statuts et filtres venus de l'adresse, validation (mise à jour vide, statut inconnu, champ interdit, note trop longue), tri, agrégation en base simulée (aucune donnée personnelle sélectionnée), route (accès, 404 uniformes, mise à jour partielle, reprise en cas de course).

**Choix de conception à connaître**
- **Seules les conversations sont des prospects.** Les visiteurs qui affichent un numéro de téléphone ne sont pas identifiés (ou pas de façon annoncée) : ils comptent dans les statistiques, pas dans cette liste. Les favoris restent privés. Montrer aux vendeurs qui a affiché leur numéro en étant connecté serait possible (le site l'enregistre), mais c'est un nouvel usage de cette donnée qu'il faudrait annoncer aux acheteurs et inscrire dans la politique de confidentialité : à décider avec votre juriste avant de le faire.
- **Ouvert à tous les comptes pro**, sans palier (contrairement au détail des statistiques du Lot 122) : le suivi repose sur la messagerie que tous ont déjà. À réserver à un palier si vous le souhaitez.
- **Notes privées mais non chiffrées** : elles sont lisibles en base par un administrateur technique comme n'importe quel texte de la base. Ne pas y saisir de données sensibles (numéro d'identité…) ; la page ne le dit pas encore.

**Vérification en conditions réelles** (base et serveur de développement, conversations créées par la vraie messagerie, comptes jetables supprimés ensuite — aucun suivi ni compte de test restant)
- Trois prospects sur deux annonces : celui qui attend une réponse en premier, badge visible pour lui seul ; les conversations d'un autre compte pro et d'un vendeur particulier n'apparaissent pas.
- Modification dans l'interface : changer le statut l'enregistre (note restée vide en base) ; la note se nettoie (espaces retirés), se retrouve après rechargement, et se supprime en la vidant ; les compteurs suivent (Nouveau 3 → 2, À rappeler 0 → 1) ; auteur enregistré = le propriétaire, puis **le collaborateur** quand c'est lui qui modifie.
- Filtres : par statut, par annonce ; l'annonce d'un **autre compte** ou une valeur inventée dans l'adresse sont ignorées ; « aucun résultat » affiché quand il y a lieu.
- Accès : collaborateur gestionnaire → même liste ; collaborateur en lecture seule → « pas d'accès » ; sans compte pro → invitation ; anonyme → 307 vers la connexion ; lien du tableau de bord absent pour le lecture seule.
- API : 401 anonyme ; 404 pour lecture seule, sans compte pro, autre compte pro, acheteur lui-même, vendeur particulier, conversation inconnue (réponse identique) ; 400 pour corps vide, statut inconnu, note de 501 caractères, champ interdit ; note de 500 caractères acceptée ; aucune écriture sur les conversations interdites ; **10 enregistrements simultanés → 10 réponses 200, une seule ligne en base**.
- Conversation masquée puis nouveau message : disparue, puis revenue « attend votre réponse » avec le statut « En négociation » conservé ; suppression de la conversation : le suivi disparaît avec elle.
- Rendu en français, en arabe (RTL) et à 390 px (aucun défilement horizontal de la page), aucune erreur de console. 885 tests unitaires, `npm run test:e2e` 6/6, `npm run test:e2e:pwa` 7/7, types et lint propres.

**Points d'attention**
- La liste lit au plus les **500 conversations** les plus récentes du compte (message affiché au-delà) ; les autres restent dans la messagerie.
- Le statut ne change pas tout seul (une annonce marquée vendue ne passe pas les prospects en « Perdu ») : c'est volontaire, l'équipe sait à qui elle a vendu.
- Le changement d'un statut recharge la liste (compteurs et ordre à jour) : la fiche modifiée peut donc changer de place.
- Aucune notification ni relance automatique : le suivi est un carnet, pas un rappel.

**Reste du bloc 3** : paiement SATIM, en attente de l'ouverture du compte marchand (le virement manuel existe déjà). Le bloc 3 est donc terminé côté code.

## Lot 124 — Bloc 4 : mesure d'audience et référencement (2026-09-19)

Le site sait maintenant **ce qui est lu**, sans cookie, sans identifiant et donc sans bandeau de consentement, et il est prêt pour **Google Search Console**. Premier lot du bloc « contenu et audience » : c'est ce qui dira à l'équipe éditoriale quoi écrire.

**Livré**
- **Mesure d'audience** : une petite balise (`PageViewTracker`, `POST /api/analytics/collect`) compte les pages vues des **pages publiques**. Le modèle `PageViewDay` (migration `20260919230000_page_view_days`) ne contient que des compteurs par **jour civil algérien, modèle de page** (`/annonce/[id]`, jamais l'adresse réelle), **langue, type d'appareil** (mobile, tablette, ordinateur) et **catégorie de provenance** (accès direct, navigation interne, moteur de recherche, réseau social, autre site). **Ne sont jamais enregistrés** : adresse IP, User-Agent, paramètres d'adresse (recherches, jetons), site de provenance, identifiant de visiteur ou de session.
- **Page `/admin/audience`** (équipe seulement, entrée « Audience » du back-office) : pages vues sur 7, 30 ou 90 jours avec la variation par rapport à la période précédente, histogramme par jour, pages les plus vues, **contenus les plus lus** (articles, essais, marques, modèles, wilayas, avec lien), provenance, appareils, langues. FR et AR (RTL).
- **Respect de la vie privée** : « Ne pas me suivre » et Global Privacy Control sont respectés (côté navigateur **et** côté serveur) ; les robots et requêtes sans User-Agent ne sont pas comptés ; le navigateur n'envoie que le **nom de domaine** du site de provenance (pas son chemin ni sa requête) ; rien n'est écrit dans le navigateur ; le serveur répond toujours 204, sans révéler ce qui a été gardé ; l'adresse IP ne sert qu'à limiter le débit (600 balises/heure/adresse). Conservation **25 mois**, purge automatique.
- **Résistance aux abus** : le jeu de pages comptées est **fermé** (25 modèles) ; un identifiant de contenu n'est gardé que s'il a la forme d'un identifiant public **et existe vraiment** (article ou essai publié, marque, modèle, wilaya ; résultat mis en cache, refus compris) — sinon la page est comptée sans détail. Les espaces personnels, la publication, l'administration, les outils pro et les pages de confirmation ne sont jamais comptés.
- **Search Console** : `GOOGLE_SITE_VERIFICATION` et `BING_SITE_VERIFICATION` publient la balise de vérification (uniquement si la valeur a la forme d'un jeton : une balise complète collée par erreur n'est pas injectée dans la page). `npm run launch:check` avertit tant que le code Google n'est pas défini. Marche à suivre dans `docs/EXPLOITATION.md` (nouvelle section 4).
- **`robots.txt` corrigé** : ses règles (`/compte/`, `/publier/`) ne bloquaient **rien**, car toutes les adresses du site commencent par la langue (`/fr/compte/…`). Elles utilisent maintenant un joker (`/*/compte`, `/*/admin`, `/*/pro/tableau-de-bord`…) et couvrent aussi l'administration, les outils pro et les pages de connexion, en français et en arabe. Les vitrines publiques `/pro/[id]` restent indexables.
- **Politique de confidentialité** : nouvelle section « Mesure d'audience » (FR et AR).
- **71 nouveaux tests unitaires** (885 → 956) : classement des adresses (pages comptées, pages ignorées, requête et ancre écartées, identifiants refusés, encodages piégés), provenance (dont l'écueil « t.co » / « content.com »), appareils, corps de balise, opt-out, route (204 uniforme, aucune donnée personnelle écrite, limite de débit, provenance interne derrière un serveur intermédiaire), enregistrement (upsert atomique, paramètres liés, cache, purge), lecture, `robots.txt` interprété comme Google et Bing, balises de vérification, `launch:check`.

**Vérification en conditions réelles** (base et serveur de développement, puis version de production ; données de test supprimées ensuite)
- Navigation réelle avec un vrai navigateur : 11 pages publiques visitées → 11 pages vues en base, sous leur **modèle** ; le contenu réel garde son identifiant (marque, modèle, wilaya, article temporaire) ; **aucune requête, aucun identifiant d'annonce** en base ; le corps des balises ne contient que le chemin et le nom de domaine de provenance.
- Provenance : navigation interne → « interne » ; depuis Google → « moteur de recherche » ; depuis Facebook (adresse contenant un jeton) → « réseaux sociaux » ; autre blog → « autre site » ; **aucune fuite** des adresses de provenance en base.
- **Pages privées** (compte, outils pro, publication, administration) : aucune balise envoyée. Page introuvable (404) : non comptée.
- « Ne pas me suivre » et GPC : **0 balise** envoyée par le navigateur ; 204 et rien en base côté serveur. Navigateur sans interface (User-Agent « HeadlessChrome »), Googlebot, Facebook, curl : balise éventuellement reçue, **rien compté**.
- Corps invalides et adresses non comptées : 204 identique, compteurs à 0 ; contenu inventé envoyé directement : page comptée **sans détail**.
- **100 balises simultanées** → une seule ligne, compteur exact à 100 ; jour = jour civil algérien. **620 balises** depuis la même adresse → 600 comptées, une autre adresse compte encore. **Purge** : lignes de 800 et 761 jours supprimées, 759 conservée.
- Page d'administration : compte ordinaire redirigé ; compte équipe → chiffres cohérents avec des compteurs synthétiques (13 332 pages vues, +66 % vs période précédente, 71 % mobile, contenus liés) ; période inconnue → 30 jours ; état vide ; français, arabe et 390 px sans défilement horizontal, sans erreur de console.
- Production : `robots.txt` avec les nouvelles règles, balises Google et Bing présentes en français et en arabe, section « Mesure d'audience » de la politique de confidentialité en FR et AR. 956 tests, `npm run test:e2e` 6/6, `npm run test:e2e:pwa` 7/7, types et lint propres.

**Points d'attention**
- **Ce sont des pages vues, pas des visiteurs.** Sans identifiant, impossible de compter les personnes différentes ni de suivre un parcours : c'est le prix de l'absence de cookie et de consentement. Une variante existe (empreinte quotidienne non conservée) mais elle rapproche d'un identifiant : à ne faire qu'après avis juridique.
- **Les chiffres sont un minimum** : bloqueurs de publicité, « Ne pas me suivre » et robots ne sont pas comptés ; il faut du JavaScript.
- **Une redirection compte pour la page d'arrivée** (un visiteur non connecté qui clique « Vendre mon véhicule » est compté sur `/connexion`).
- **Non vérifié** : Search Console avec le vrai Google (il faut le domaine réel), le comportement sur de vrais téléphones (Safari iOS, navigateurs intégrés aux applications), le volume sur trafic réel. Le nombre de lignes est borné (jeu de pages fermé × contenus existants × 2 langues × 3 appareils × 5 provenances par jour) mais pas négligeable pour un très gros trafic : à surveiller.
- **Texte juridique** : la section ajoutée à la politique de confidentialité décrit fidèlement le comptage, mais elle doit être relue par votre juriste (comme la page entière), et sa version arabe par un locuteur natif.
- Le site doit connaître son domaine (`NEXT_PUBLIC_SITE_URL`) : le plan du site et la provenance « interne » en dépendent (déjà contrôlé par `launch:check`).

**Reste du bloc 4** : guides d'achat par modèle et outil de suivi du rythme éditorial (revue de presse, essais). Le contenu, lui, reste à rédiger par votre équipe : je ne fabrique ni essais ni guides.

## Lot 125 — Vraies photos de voitures sur les annonces de démonstration (2026-09-19)

Les 24 annonces de démonstration n'affichaient que des cartes de couleur portant le nom de la marque en texte. Elles montrent maintenant une **vraie photo du modèle**, avec son crédit.

**Livré**
- **24 photos** de Wikimedia Commons, sous licence libre (CC BY-SA 3.0, 3.0 de ou 4.0, et CC0 pour la Sandero), choisies pour la **génération** correspondant à l'année de l'annonce quand elle existe. Rangées dans le dépôt (`prisma/demo-photos/`, 13 Mo) avec `CREDITS.json` et un `README.md` qui liste photo, auteur, licence et page source : `npm run db:seed:demo` n'a besoin d'aucun accès réseau.
- **Même traitement que la photo d'un vendeur** : elles passent par `savePhoto` (orientation, 1 600 px, JPEG, empreinte anti-fraude, indicateurs de qualité). Les 24 empreintes sont distinctes, aucun indicateur de qualité levé.
- **Crédit enregistré et affiché** : nouvelles colonnes `creditAuthor`, `creditLicense`, `creditLicenseUrl`, `creditSourceUrl` sur `ListingPhoto` (migration `20260919240000_listing_photo_credits`). La page de l'annonce montre sous la photo « Photo d'illustration du modèle (annonce de démonstration), pas du véhicule décrit. Photo : auteur · licence · Wikimedia Commons », avec liens vers le texte de la licence et la page de la photo (FR et AR). Rien n'est affiché pour une photo de vendeur. Seuls les liens vers Wikimedia Commons et Creative Commons en https sont acceptés : un lien écrit en base ne peut pas mener ailleurs.
- **`npm run db:demo-photos`** met à niveau une base existante : remplace le visuel de texte des annonces des comptes de démonstration (`@example.dz`), supprime l'ancien fichier du stockage, ne refait pas ce qui est déjà en place (idempotent).
- **Correctifs de la fiche d'annonce**, révélés par de vraies photos : la première photo (deux colonnes sur trois) était demandée au serveur à un tiers de la largeur puis agrandie, donc **floue** ; elle est maintenant servie à la bonne taille (750 px sur ordinateur, 828 px sur téléphone haute densité) et chargée en priorité. Le cadrage 4:3 **coupait** les photos panoramiques (pare-chocs et plaque disparus) : la galerie passe en 16:10.
- **63 nouveaux tests** (956 → 1 019) : logique des crédits (liens refusés hors Commons/Creative Commons, auteur et licence obligatoires, pas de doublon), et un garde-fou sur le dossier de photos (un fichier par crédit et inversement, vrais octets JPEG, paysage, poids raisonnable, dimensions conformes aux crédits, licences autorisées sans clause NC/ND, liens https, couverture de **tous** les modèles du script de démonstration, chaque photo citée dans le README). Ce garde-fou a d'ailleurs trouvé un lien de licence CC0 en http, corrigé.

**Vérification en conditions réelles** (base et serveur de développement)
- Les 24 photos ont d'abord été **regardées une par une** (planches-contact étiquetées) : 6 principales écartées — Clio vue de dos au milieu d'une foule, Duster aux couleurs des pompiers, Tucson de dos, Mégane minuscule au loin, Fiesta d'un concessionnaire, Tiggo 7 prise à travers un pare-brise — et remplacées par des remplaçantes ; une remplaçante était en réalité un **Captur** et a été écartée.
- Application sur la base : 24 remplacées, 24 crédits, 24 empreintes et 24 chemins distincts ; le nombre de fichiers du stockage est resté à 800 (24 supprimés, 24 ajoutés) ; second passage : 0 remplacé, 24 déjà en place.
- Liste de recherche : 23 images sur 23 chargées, aucune erreur, aucune réponse en erreur. Fiche : photo, mention d'illustration, crédit et liens corrects (`target=_blank`, `rel="noopener noreferrer"`, `rel=license` sur la licence), en français, en arabe (RTL) et à 390 px sans défilement horizontal.
- 1 019 tests, `npm run test:e2e` 6/6, `npm run test:e2e:pwa` 7/7, types et lint propres.

**Points d'attention**
- **Ce sont des photos d'illustration du modèle**, pas du véhicule décrit (couleur, finition, année peuvent différer) : la mention le dit sur chaque annonce. Deux choix approchants : la **Fiesta** est une génération plus récente (2017 et après) que l'annonce (2016), les trois photos disponibles étant de cette génération ; la **Duster** est une vue arrière d'une Duster II sans inscription, faute de meilleure photo dans l'enveloppe téléchargée.
- **Plaques d'immatriculation** : plusieurs photos montrent une plaque lisible (publiées telles quelles par leurs auteurs sur Wikimedia Commons). Pour un site de démonstration cela pose peu de question ; à revoir avant toute mise en ligne publique de ces annonces.
- **Licences** : CC BY-SA impose de conserver le crédit et la licence (fait, page de l'annonce et `prisma/demo-photos/README.md`) et de publier toute adaptation sous la même licence ; à faire valider par votre juriste si ces annonces deviennent publiques. **En production, ces annonces n'existent pas** (le compte de démonstration et `db:seed:demo` sont refusés par `launch:check`).
- Le crédit s'affiche sur la fiche, pas sur les cartes de la liste : la licence admet un lien vers la page où figure le crédit.
- Les photos des vendeurs ne sont pas concernées : elles leur appartiennent et n'ont ni crédit ni mention.

## Lot 126 — Bloc 4 : guides d'achat par modèle (2026-09-19)

Un nouveau type de contenu éditorial : le **guide d'achat**, un article de fond rattaché à **un modèle** du catalogue. Il apparaît sur la page du modèle et sur chaque annonce de ce modèle (« Avant d'acheter, lisez notre guide »). **Livré vide : le contenu est à rédiger par votre équipe**, le site ne fournit aucun texte de départ et je n'en ai publié aucun.

**Livré**
- **Type `GUIDE`** (migration `20260919250000_buying_guides`) avec sa fiche `BuyingGuide` : le **modèle** (obligatoire — c'est ce qui relie le guide à ses annonces), la génération (facultative), une liste **« à vérifier avant d'acheter »** (une ligne par point, 1 à 12 points de 200 caractères) et **« notre conseil »** (20 à 400 caractères), dans les deux langues, plus le texte Markdown et une photo de couverture facultative, comme un essai. La marque n'est **jamais lue du navigateur** : elle se déduit du modèle (une marque falsifiée est ignorée).
- **Pages publiques** : `/guides` (index paginé) et `/guides/[slug]` (liste de points cochés, conseil, texte, liens « Voir les annonces » et « Fiche du modèle », données structurées `Article` et fil d'Ariane), en français et en arabe (RTL) ; lien « Guides d'achat » dans le pied de page ; section « Guide d'achat » sur la page du modèle ; encart sur la fiche de chaque annonce de ce modèle (rien sur les annonces des autres modèles) ; entrées dans le plan du site (`/guides` et chaque guide, avec les variantes de langue).
- **Même règles de publication** que le magazine et les essais : brouillon, publier maintenant ou **programmer**, « mis à jour le » ; un brouillon ou un guide programmé est un vrai 404, absent de l'index, de la page du modèle et du plan du site.
- **Trois rubriques, un seul espace d'adresses** : le magazine liste seulement les articles, les essais seulement les essais, les guides seulement les guides ; l'ancienne adresse `/mag/…` d'un guide renvoie vers `/guides/…`, `/essais/…` répond 404 pour un guide.
- **Administration** (ADMIN seulement, comme les essais) : `/admin/guides` (liste avec état brouillon / programmé / publié), création et modification avec le même formulaire que les autres contenus, entrée dans le menu du back-office ; l'édition d'un guide depuis `/admin/mag` redirige vers sa rubrique. Le type ne peut pas changer après la création.
- **Suppression d'un modèle protégée** : un modèle qui a un guide ne peut plus être supprimé (« supprimez d'abord le guide »), au lieu d'une erreur de base de données.
- **Audience (Lot 124)** : les pages `/guides` et `/guides/[slug]` sont comptées, et l'identifiant du guide n'est gardé que s'il est réellement paru — l'équipe verra quels guides sont lus.
- **21 nouveaux tests** (1 019 → 1 040) : liste à vérifier, normalisation, règles de validation (un guide exige sa fiche et son modèle ; une fiche de guide est refusée sur un article ou un essai, et inversement ; pas de source externe ; couverture permise ; publication), chemins par type, suivi d'audience.

**Vérification en conditions réelles** (base et serveur de développement, compte administrateur jetable ; guides de test **supprimés** ensuite)
- Droits : anonyme et membre ordinaire → 403. **Onze refus** en 400 sans rien créer : sans fiche, sans modèle, modèle inconnu ou hors bornes, génération d'un autre modèle, fiche de guide sur un article, fiche d'essai en plus, source externe, 13 points, conseil trop court, type inconnu.
- Création valide : type, modèle et marque déduite corrects, **marque falsifiée ignorée**, liste normalisée, publié. Modification : titre et conseil changés, adresse stable, changement de type refusé (`kind_mismatch`), changement de modèle accepté.
- Pages : index, fiche (points, conseil, corps Markdown, liens, données structurées, adresse canonique), arabe en RTL, page du modèle, annonce d'un modèle concerné (oui) et d'un autre modèle (non), plan du site (rubrique, guide, variante arabe) ; le magazine et les essais ne le listent pas ; `/mag/…` renvoie 307 vers `/guides/…`.
- Brouillon et guide programmé (dans 3 jours) : 404, absents de l'index, du plan du site et de la page du modèle.
- Audience : le vrai guide garde son identifiant ; un identifiant inventé et un brouillon sont comptés **sans** détail.
- Modèle jetable : suppression **refusée avec un guide (409)**, acceptée après suppression du guide ; la fiche de guide disparaît avec l'article (cascade).
- Interface : liste, édition (modèle, liste et conseil relus depuis la base), création par le formulaire (**refus tant qu'aucun modèle n'est choisi**, puis création en brouillon rattachée à la Clio), redirection depuis `/admin/mag`, mobile sans défilement horizontal, aucune erreur de console.
- 1 040 tests, `npm run test:e2e` 6/6, `npm run test:e2e:pwa` 7/7, types et lint propres, aucun écart de schéma.

**Points d'attention**
- **Aucun guide n'est publié** : l'index affiche « Aucun guide d'achat n'est encore publié ». Un guide utile demande de la matière réelle (points de contrôle, pannes connues, versions à privilégier) : à rédiger par des gens qui connaissent le modèle. Le formulaire impose la structure, pas le fond.
- **Un guide par modèle n'est pas imposé** : plusieurs peuvent exister pour un même modèle ; la page du modèle en montre les deux plus récents, l'annonce le plus récent.
- Le lien « Guides d'achat » n'est **que dans le pied de page** (l'en-tête est déjà chargé) ; on y accède aussi depuis chaque modèle et chaque annonce concernés.
- **Journal d'audit** : les créations, modifications et suppressions de test ont laissé 17 lignes de journal (elles ne sont pas supprimables) ; le compte administrateur jetable, lié à ces lignes, n'a pas pu être supprimé : il a été **neutralisé** (rôle particulier, suspendu, mot de passe inutilisable).
- Les textes de l'interface en arabe (dont la liste « ce qui est à vérifier ») n'ont pas été relus par un locuteur natif.

**Reste du bloc 4** : suivi du rythme éditorial (revue de presse, essais, guides) : un tableau de bord pour l'équipe — dernière publication de chaque rubrique, contenus programmés, modèles populaires sans guide ni essai.

## Lot 127 — Bloc 4 : suivi du rythme éditorial (2026-09-20)

Un tableau de bord pour l'équipe éditoriale (`/admin/editorial`, ADMIN seulement, entrée « Rythme éditorial » du back-office) : où en est chaque rubrique, ce qui est programmé, les brouillons oubliés, et **quels modèles attendent un guide**. Il ne crée aucun contenu : il dit où en écrire un. Termine le bloc 4.

**Livré**
- **Une carte par rubrique** (revue de presse, essais, magazine, guides d'achat) : dernière publication (« aujourd'hui », « hier » ou « il y a N jours »), pastille **À jour / En retard / Rien de publié** par rapport à un objectif de cadence, compteurs publiés / programmés / brouillons, liens « Gérer » et « Nouveau ». Bandeau quand une rubrique est en retard.
- **Objectifs par défaut** : revue de presse **7 jours** (« renouvelée chaque semaine »), essais et magazine **30 jours**, guides **60 jours**. Ce sont des repères d'affichage, **rien n'est bloqué ni envoyé** ; ils se règlent dans `src/lib/editorial.ts` (à ajuster au rythme réel de la rédaction).
- **Courbe de publication** des 12 dernières semaines (semaines commençant le lundi), tous contenus confondus ; un contenu programmé compte à sa date de parution, pas avant.
- **Programmé** (le plus proche d'abord) et **Brouillons** (le plus ancien d'abord, avec « oublié ? » au bout de 14 jours sans modification), revue de presse incluse, chacun avec son lien d'édition ; mention « Seuls les 20 premiers sont listés (N au total) » quand la liste est plafonnée.
- **Modèles qui attendent un guide** : les modèles les plus présents sur le site (annonces publiées) qui n'ont **pas de guide paru**, avec leurs annonces, leurs vues sur 30 jours (audience du Lot 124), et ce qui existe déjà (essais, revue de presse), plus la **couverture** (« X % des modèles présents sur le site ont un guide »). Chaque ligne a un lien **« Rédiger un guide »** qui ouvre le formulaire avec le modèle déjà choisi (valeur invalide ou inconnue simplement ignorée).
- Les jours sont comptés en **jours calendaires, heure d'Algérie** : une publication de la veille à 23 h 30 s'affiche « hier », jamais « aujourd'hui » à côté de la date d'hier. Pluriels corrects en français et en arabe (« il y a 0 jours » et « 1 jours » évités), heure sur 24 h, arabe en RTL.
- **25 nouveaux tests** (1 040 → 1 065) : fraîcheur par rapport à l'objectif, jours calendaires (frontières de mois, d'année, minuit d'Algérie), brouillon oublié, tri et couverture des lacunes, paramètre `?modele=`, et lecture en base simulée (comptes et dates par rubrique, ordre des programmés, brouillons, semaines, lacunes avec leurs colonnes, seuls les contenus **parus** comptent).

**Vérification en conditions réelles** (base et serveur de développement, compte administrateur jetable ; contenus de test placés à des dates choisies puis **supprimés**)
- Accès : anonyme → connexion, membre ordinaire → accueil, **modérateur → tableau de bord d'administration** (la page est réservée aux ADMIN), administrateur → page.
- **Chiffres comparés à la base** : revue de presse 8 publiées / 1 programmée / 32 brouillons, 1 article, 1 essai, 1 guide publié + 1 programmé + 1 brouillon, 24 modèles sur le site : tout concorde. Magazine publié il y a 40 jours → **« En retard » de 10 jours** ; essai d'il y a 10 jours → À jour ; guide de la Duster publié → la **Duster sort des lacunes** ; couverture « 4 % (1 sur 24) » ; 11 contenus sur 12 semaines ; ordre du programmé (revue programmée demain avant le guide programmé dans 4 jours) ; brouillon de 30 jours « oublié ? », ceux d'aujourd'hui non.
- « Rédiger un guide » ouvre le formulaire avec la bonne marque et le bon modèle ; `?modele=abc`, `0`, `-4`, `99999999`, `1;DROP` : formulaire normal, sans modèle choisi, sans erreur.
- Rendu en français, en arabe (RTL) ; **la page débordait de 645 px sur un téléphone** (texte réservé aux lecteurs d'écran positionné en absolu hors du conteneur défilant du tableau, et longs titres de brouillons) : corrigé, aucun défilement horizontal à 390 px dans les deux langues ; aucune erreur de console. 1 065 tests, `npm run test:e2e` 6/6, `npm run test:e2e:pwa` 7/7, types et lint propres.

**Points d'attention**
- **Objectifs de cadence = mes valeurs par défaut**, tirées de ce que vous m'avez dit (revue de presse hebdomadaire) et de ce qui me semble raisonnable pour le reste. À corriger si la rédaction vise autre chose.
- Le tableau ne connaît que ce qui est **dans le site** : il ne sait pas ce qui est en cours de rédaction ailleurs.
- **La couverture ne compte que les modèles qui ont au moins une annonce publiée** : un modèle sans annonce n'apparaît pas dans les lacunes, même s'il mériterait un guide.
- Les 32 brouillons de revue de presse saisis plus tôt s'affichent tels quels ; le décompte de la revue de presse (« 7 publiée(s) ») inclut donc ce qui a été publié depuis.
- **Journal d'audit** : les créations et suppressions de test ont laissé des lignes non supprimables ; le compte administrateur jetable a été **neutralisé** (rôle particulier, suspendu, mot de passe inutilisable), les deux autres supprimés.
- Textes de l'interface en arabe non relus par un locuteur natif.

**Bloc 4 terminé** : mesure d'audience et référencement (Lot 124), photos des annonces de démonstration (Lot 125), guides d'achat (Lot 126), rythme éditorial (Lot 127). Le contenu — guides, essais, revue de presse — reste à rédiger par votre équipe.

## Lot 128 — Bloc 5 : cohérence des textes français / arabes et dossier de relecture (2026-09-20)

Premier lot du bloc « qualité technique ». Il fait deux choses distinctes : des **garde-fous permanents** sur ce qu'une machine peut prouver (aucun texte manquant, aucune variable oubliée, aucune clé inexistante), et un **dossier de relecture** pour ce qu'elle ne peut pas juger : la qualité de l'arabe, qui exige un locuteur natif. **Ce lot ne certifie pas l'arabe.**

**État des lieux** (mesuré avant d'écrire le moindre test) : 1 426 textes dans chaque langue, aucune clé d'un seul côté, aucune variable qui diffère, aucune accolade cassée, aucun texte vide, aucun mot français mêlé à l'arabe ; sur **1 875 appels** à une clé de traduction dans le code, aucun ne vise une clé absente. Les 18 textes identiques au français sont légitimes (marques, paliers « Starter / Premium », scores). Rien à corriger : le lot verrouille cet état.

**Livré**
- **`src/lib/i18n-audit.ts`** (logique pure) : aplatissement des messages, extraction **exacte** des variables et des balises (y compris **dans** les branches de pluriel, grâce à l'analyseur ICU de `next-intl`), détection d'une syntaxe invalide (accolade ouverte, pluriel sans « other »), comparaison des deux langues, et balayage du code source pour vérifier chaque `t("clé")` contre les fichiers (clés littérales, clés calculées `status${x}`, `t.rich`, `getTranslations({ namespace })`).
- **Tests permanents** (`tests/i18n-audit.test.ts`, `tests/i18n-messages.test.ts`, 31 tests) sur les vrais fichiers et le vrai code : mêmes clés dans les deux langues, aucun message vide, syntaxe valide, mêmes variables, aucune traduction oubliée (texte identique au français, ou arabe entièrement latin, hors liste d'exceptions **explicite et vérifiée**), aucun mot français dans une phrase arabe, et chaque clé demandée par le code existe. `npm run i18n:check` les lance seuls. **Vérifié par sabotage** : une clé retirée de l'arabe, une variable supprimée d'une phrase arabe et une clé inexistante dans le code font bien échouer le test (puis tout a été restauré).
- **`npm run i18n:review`** génère, dans `review-arabe/` (ignoré par git, à régénérer), deux fichiers pour le relecteur : `revue-arabe.html` (lecture confortable, français et arabe côte à côte, arabe en grand et de droite à gauche, filtre de recherche) et `revue-arabe.csv` (à ouvrir dans Excel, encodage compatible, avec deux colonnes vides « Correction » et « Commentaire »). Les 1 426 textes y figurent, **classés dans l'ordre de ce que voient les visiteurs** (navigation, accueil, recherche, annonce, publication…) ; les textes juridiques sont signalés comme devant aussi être validés par un juriste arabophone ; ceux réservés à l'équipe viennent en dernier. Chaque ligne indique les `{variables}` à conserver telles quelles.
- **Tableau de terminologie** en tête du dossier : pour 11 notions (annonce, voiture, vendeur, prix, favoris, alerte / notification…), le nombre de textes contenant chaque variante arabe, pour montrer où le vocabulaire hésite. Ce n'est pas un verdict : plusieurs variantes peuvent être justes.

**À faire par vous (je ne peux pas le faire)**
- **Faire relire le dossier par un locuteur natif** (idéalement algérien : le registre d'un site de petites annonces n'est pas celui d'un texte administratif). C'est la seule vraie réponse à « l'arabe est-il bon ? ». Les corrections se reportent ensuite dans `messages/ar.json` ; `npm run i18n:check` garantit alors que rien ne casse.
- **Points de vocabulaire que le tableau fait apparaître** et que le relecteur devrait trancher : « voiture » (`سيارة` 21 textes, `مركبة` 2), « vendeur » (`بائع` 25, `البائع` 14, `مالك` 12), « alerte » et « notification » (`تنبيه` 15, `إشعار` 16 : voulu ou non ?), « kilométrage » (`كم` 38, `كيلومتر` 10). À l'inverse, « annonce » (`إعلان`, 173 textes) et « prix » (`سعر`, 34) sont parfaitement homogènes.

**Limites**
- Les tests **ne jugent pas le sens** : une phrase arabe grammaticale mais fausse les passerait.
- Le balayage du code voit les traductions déclarées par `useTranslations` / `getTranslations` ; il ne voit pas celles **passées en paramètre** à une autre fonction (`t={t}`). C'est un filet, pas une preuve.
- Les tests s'appuient sur `@formatjs/icu-messageformat-parser`, installé comme dépendance de `next-intl` et non déclaré en propre : si une mise à jour de `next-intl` le retirait, les tests le diraient aussitôt.
- Les textes venus du **contenu** (annonces, articles, guides, revue de presse) ne sont pas concernés : ils sont saisis dans les deux langues par l'équipe.

## Lot 129 — Bloc 5 : chaîne d'intégration automatique (2026-09-20)

Deuxième lot du bloc « qualité technique ». Un fichier de workflow GitHub Actions lance à chaque envoi de code et chaque demande de fusion tout ce qu'une machine peut vérifier, et une commande locale, `npm run verify`, fait la même chose sur ce poste. **Le workflow n'a jamais tourné sur GitHub : le dépôt n'a pas de serveur distant.**

**Livré**
- **`.github/workflows/ci.yml`** : deux travaux. `checks` (PostgreSQL 17 jetable) : installation exacte depuis le verrou (`npm ci`), génération du client Prisma, types, lint, tests unitaires (dont la cohérence FR/AR du Lot 128), migrations rejouées sur une base vide, **écart schéma / migrations** (échoue si le schéma a changé sans migration), audit des dépendances de production (informatif, n'échoue pas). `e2e` (après `checks`) : navigateur Playwright, tests de bout en bout puis application installable ; les traces sont conservées en cas d'échec. Droits en lecture seule, exécutions concurrentes annulées, délais maximaux, actions épinglées à une version majeure, **aucun secret du dépôt** : les mots de passe du fichier sont ceux de conteneurs jetables, la clé de chiffrement est générée à chaque exécution.
- **`npm run verify`** (`scripts/verify.mjs`) : mêmes contrôles en local, résumé chronométré, code de sortie 1 au premier échec ; `-- --e2e` ajoute les deux suites de bout en bout, `-- --keep-going` les exécute toutes malgré une erreur. L'étape « écart de migrations » demande `SHADOW_DATABASE_URL` (base vide dédiée) et est sinon ignorée **et signalée**, pas passée sous silence.
- **`tests/ci-workflow.test.ts`** (23 tests) : contrôle le fichier sans l'exécuter : YAML valide, ordre des étapes (client généré avant les types, migrations appliquées avant la comparaison, navigateur installé avant les tests), chaque `npm run` existe, `--exit-code` présent, PostgreSQL 17 avec sonde de santé, base de test finissant par `_e2e` (le garde-fou de `reset-db.ts`), port Playwright cohérent, aucune clé figée, aucun secret requis. **Vérifié par sabotage** : cinq altérations (retrait de `--exit-code`, script inexistant, PostgreSQL 16, action non épinglée, clé figée) font toutes échouer le test ; le fichier a été restauré à l'identique.
- **Scripts d'installation npm** : npm 11.17 signalait 7 dépendances (Prisma, esbuild, SWC, `@parcel/watcher`, `unrs-resolver`) exécutant du code à l'installation sans approbation. Dans cette version l'avis est **informatif** (les scripts s'exécutent) mais une version future les bloquera : leur approbation est enregistrée dans `allowScripts` de `package.json` (`npm approve-scripts`), épinglée à la version du verrou ; un test vérifie que chaque entrée correspond au verrou.
- Documentation : `docs/EXPLOITATION.md` (section 5 bis), `app/README.md`.

**Vérification réelle** (`npm run verify -- --e2e`, code de sortie 0) : types, lint, **107 fichiers / 1 119 tests unitaires**, écart de migrations (aucun), **6 tests de bout en bout** puis **7 tests de l'application installable**, tous verts.
- **Un vrai défaut a été trouvé par cette exécution** : `verify` chargeait tout `.env` (dont `REDIS_URL`) dans l'environnement des tests, ce qui faisait échouer un test de limitation de débit qui suppose l'absence de Redis — et donc `verify` s'arrêtait en erreur alors que `npm test` passait. Corrigé : `verify` ne lit plus dans `.env` que `SHADOW_DATABASE_URL`, comme la CI qui n'a pas de `.env` ; un test le verrouille. Cela a aussi prouvé que `verify` échoue bien (code 1) quand un test échoue.
- Détection d'écart de migrations éprouvée (code 0 : aucun écart, code 2 : écart) sur une base de contrôle locale `souq_auto_shadow`.

**Limites**
- **Première exécution réelle à surveiller** : versions d'actions, installation de Playwright (`--with-deps`) sur le lanceur Ubuntu, durée. Les commandes sont éprouvées ici sous Windows ; un écart propre à Linux ne peut pas être exclu.
- Sans dépôt distant, aucune protection de branche : à activer à la création du dépôt en exigeant les deux travaux.
- Les tests de bout en bout ne couvrent encore que 6 parcours : c'est l'objet du lot suivant.

## Lot 130 — Catalogue : utilitaires, poids lourds et deux-roues (2026-09-20)

Le catalogue ne connaissait que des voitures (24 marques) ; les utilitaires et les camions y étaient mêlés (Sprinter, Hilux…) et les motos n'existaient pas (« marque non listée » en texte libre). Il couvre maintenant quatre familles, avec **62 marques et 410 modèles**.

**Principe** : la catégorie est portée par le **modèle**, sous forme de liste (`Model.categories`), et non par la marque. Un Kangoo ou un Hilux s'annonce aussi bien comme voiture que comme utilitaire ; Renault, Mercedes ou Suzuki ont des modèles dans plusieurs familles. La catégorie d'une marque se déduit de ses modèles. Migration `20260920100000_model_categories` : les modèles existants restent des voitures.

**Livré**
- **Données** (`prisma/catalogue-data.ts`) : 38 marques ajoutées. *Utilitaires et poids lourds* : Iveco, Isuzu, Mitsubishi Fuso, Hino, Renault Trucks, Scania, MAN, DAF, Ford Trucks, Sinotruk, Shacman, FAW, Dongfeng, Foton, JAC, Tata, Great Wall, Kamaz, **SNVI** (gamme relevée sur sa page Wikipédia : K66, K120, B260, B400, C260, M120, M230, M260, M350, TB400, TC260) ; *deux-roues* : Yamaha, Honda, Kawasaki, Piaggio, Vespa, Peugeot Motocycles, MBK, Kymco, SYM, TVS, Bajaj, Royal Enfield, Benelli, CFMoto, KTM, Ducati, Harley-Davidson, Triumph, Aprilia. Modèles ajoutés aux marques existantes : fourgons et pick-ups (Trafic, Master, Expert, Boxer, Jumpy, Jumper, Ducato, Transit, Vito, Crafter, Daily…), camions Mercedes (Actros, Arocs, Atego…) et Volvo (FH, FM…), motos Suzuki et BMW. Les modèles à double usage (Kangoo, Partner, Berlingo, Doblò, Hilux, Ranger, L200…) sont dans les deux catégories.
- **Assistant de publication et édition d'une annonce** : marques et modèles filtrés selon la catégorie choisie ; changer de catégorie efface un choix devenu impossible (une moto ne reste pas « voiture » sans le dire).
- **Recherche** : mêmes filtres dans le panneau de recherche.
- **Contrôle côté serveur** (`validateVehicleRefs`) : création et modification d'une annonce refusent (`wrong_category`, 400) un modèle, ou une marque sans modèle, absent de la catégorie annoncée. « Autre » n'a pas de catalogue : tout est accepté. L'**import en masse** des professionnels applique la même règle (il contournait jusqu'ici tout contrôle de cohérence).
- **Index du catalogue** `/voitures` : pastilles Toutes / Voitures / Utilitaires / Poids lourds / Deux-roues (`?categorie=poids-lourd`, lien mal formé = tout afficher), et familles de chaque marque sur sa carte ; français et arabe (RTL), sans débordement sur mobile.
- **Administration** `/admin/referentiels` : cases « catégories » à l'ajout et à la modification d'un modèle (au moins une), catégories affichées dans la liste ; API `POST /api/admin/brands/:id/models` et `PATCH /api/admin/models/:id` (`invalid_categories` si vide, inconnue ou « Autre ») ; journal d'audit enrichi.
- **Exploitation** : `docs/EXPLOITATION.md` (section 5 ter) : `npm run db:seed` **obligatoire** après la mise à jour d'une base existante, sinon les listes n'ont ni utilitaires, ni camions, ni motos.

**Vérification réelle** (base de développement, navigateur et API) : index filtré (62 marques → 27 utilitaires, 21 poids lourds, 21 deux-roues, 30 voitures) ; assistant : en « Deux-roues » Renault disparaît et Yamaha propose MT-07…, repasser en « Voiture » efface Yamaha, Renault en utilitaire ne propose que Kangoo, Master, Trafic ; API : Clio en deux-roues, MT-07 en voiture et marque Renault en poids lourd refusées (aucune annonce créée), MT-07 en deux-roues et marque en texte libre acceptées ; administration : création avec ou sans catégories, valeurs invalides refusées, modification de catégories par l'écran (cases, « Enregistrer » désactivé sans catégorie). **Tests** : 1 147 tests unitaires (dont 28 nouveaux sur le catalogue, l'import et le validateur), **3 nouveaux tests de bout en bout** (9 au total) et les 7 de l'application installable ; `npm run verify -- --e2e` au vert, écart de migrations nul. **Vérifié par sabotage** : retirer le contrôle du validateur, retirer la catégorie des motos Yamaha, retirer le contrôle de l'import font échouer les tests.

**Limites**
- **Les noms ne sont pas un relevé des importateurs algériens** : ils viennent des gammes publiques des constructeurs (vérifié en ligne seulement pour SNVI et la présence de Shacman). Liste non exhaustive, à élaguer ou compléter par l'équipe.
- **Aucun nom arabe** pour les 38 marques et leurs modèles : ils s'affichent en latin. La validation des noms arabes reste à faire par un locuteur natif.
- **Pas de bus ni d'autocars** (Yutong, Higer, King Long, Coaster…), ni d'engins, quads ou remorques : à saisir en « Autre » ou en marque non listée. Honda n'a que ses motos (pas de voitures Honda dans le catalogue).
- Le cas « Autre » de l'API n'est vérifié que par test unitaire (la limite de 5 créations d'annonce par heure a interrompu la vérification réelle) ; la modification d'annonce (PATCH) partage le même validateur mais n'a pas été rejouée à la main.
- L'estimateur de prix, les guides et les essais listent toutes les marques sans filtre de catégorie. Le plan du site contient désormais ~410 pages de modèles, dont la plupart sans annonce.
- Les tests ont laissé **11 lignes de journal d'audit** (créations/modifications/suppressions de modèles de test) attribuées à deux comptes administrateurs jetables `cat.admin.*`, neutralisés (rôle particulier) ; les lignes d'audit ne se suppriment pas.

## Lot 131 — Bloc 5 : tests de bout en bout des lots récents (2026-09-20)

Dernier lot du bloc « qualité technique » : la suite de bout en bout passe de **9 à 67 tests** et couvre les parcours des lots 110 à 130, sur le vrai site et la vraie base jetable. Elle a **trouvé quatre défauts réels** du site, corrigés dans ce lot.

**Livré** (8 fichiers dans `app/e2e/`)
- **`public-pages`** : chaque page publique, en français et en arabe (26 pages), répond, porte la bonne langue et le bon sens d'écriture, a un titre `h1`, ne déclenche ni exception ni erreur dans le navigateur, et **ne déborde pas de l'écran d'un téléphone** ; sélecteur de langue ; pages introuvables.
- **`search`** : le nombre de résultats affiché est comparé **à la base** (10 filtres : prix, année, kilométrage, carburant, boîte, marque, catégorie, combinaison) ; tri par prix ; pagination sans répétition ; valeurs extrêmes ou hostiles ; une moto n'apparaît que dans « Deux-roues » ; une annonce en attente de modération n'apparaît jamais.
- **`listing-page`** : titre, prix et données structurées valides ; annonce en attente visible de son seul auteur ; **le numéro de téléphone n'est jamais dans le code de la page** (il n'apparaît qu'au clic, est compté, et limité en débit) ; crédits des photos sous licence libre, avec liens sûrs seulement (`javascript:` et sites hors liste blanche jamais publiés), en français et en arabe.
- **`pro`** : avec un vrai visiteur et un vrai acheteur, les statistiques affichées sont **exactement** celles de la base (vues, numéros affichés, conversations) ; les visites du vendeur ne comptent pas ; détail par annonce réservé aux paliers Pro et Premium ; suivi des prospects (statut, note privée enregistrés et retrouvés) inaccessible à l'acheteur.
- **`guides`** : création par l'administration, lecture publique en français et en arabe, page du modèle, plan du site ; brouillon invisible partout ; publication programmée qui apparaît d'elle-même à sa date ; droits d'accès et validation ; un modèle qui a un guide ne peut pas être supprimé.
- **`admin`** : accès (visiteur, compte ordinaire, modérateur), 23 écrans ouverts sans erreur, écrans récents en arabe, **modération d'une annonce de bout en bout** (invisible puis publique après approbation, tracée dans le journal), journal d'audit, écran d'audience.
- **`technical`** : `robots.txt` (règles interprétées comme les moteurs, avec le joker `*`), plan du site (annonces publiées seulement, tous les types de véhicules, deux langues), `/api/health`, **mesure d'audience sans cookie** (page réellement comptée ; « Ne pas me suivre », robots et pages privées ignorés ; ni IP, ni recherche, ni User-Agent conservés).
- **`arabic`** : inscription, connexion, assistant de publication, recherche et fiche d'annonce avec affichage du numéro, en arabe. Les textes attendus sont lus dans `messages/ar.json`, jamais recopiés.
- Aides : `e2e/db.ts` (accès direct à la base **de test seulement**, pour préparer un état : administrateur, annonce publiée, abonnement, ou lire ce que le site a écrit), `e2e/api-helpers.ts`.

**Défauts trouvés par ces tests, corrigés**
1. **La page de recherche n'avait aucun titre `h1`** (accessibilité et référencement) : titre ajouté, invisible à l'écran (`Search.pageTitle`).
2. **Une annonce ou un profil inexistant répondait 200** avec un message (une « page introuvable » que les moteurs de recherche gardent en mémoire) : vraie réponse 404, identique pour une annonce inexistante et pour une annonce non publique d'un autre vendeur.
3. **Toute adresse inconnue affichait la page 404 anglaise par défaut de Next.js**, même en arabe : page « introuvable » traduite (`[locale]/not-found.tsx` et attrape-tout `[locale]/[...rest]`), dans la langue du visiteur et de droite à gauche en arabe.
4. **Six écrans d'administration** (annonces, signalements, avis, avis propriétaires, comptes pro, identité) utilisaient `<h2>` comme titre de page : passés en `<h1>`, aspect identique.

**Vérification** : `npm run verify -- --e2e` — 1 147 tests unitaires, **67 tests de bout en bout**, 7 de l'application installable, écart de migrations nul. **Vérifié par sabotage** sur le site : une règle `robots.txt` trop large, un filtre de prix rendu strict, le détail par annonce ouvert à tous les paliers, une annonce inexistante qui répond de nouveau 200 font tous échouer les tests. **Ce sabotage a d'abord révélé un test creux** (`robots.txt` : le joker `*` n'était pas interprété, donc une règle `/*/annonce` passait inaperçue) : corrigé et re-vérifié.

**Ajustements de la suite** : chaque navigateur de test annonce sa propre adresse (`X-Forwarded-For`) : l'inscription et la connexion sont limitées à 10 par quart d'heure et par adresse, et la suite complète crée bien plus de comptes que cette limite n'en accepte (elle reste active et testée telle quelle) ; délai d'attente des vérifications porté de 5 à 15 s (`playwright.config.ts`) car le serveur de test compile chaque page à sa première visite ; le test de publication utilise un numéro de téléphone unique par exécution (un numéro fixe échouait dès la 2e exécution) et un délai de 120 s.

**Limites**
- Les tests tournent sur `next dev` (comme les précédents) : ils ne prouvent pas le comportement d'une version de production, sauf pour l'application installable (`test:e2e:pwa`). En développement, le HTML initial d'une page 404 est l'enveloppe d'erreur de Next.js avant hydratation ; le statut 404 et `noindex` sont vérifiés, la version de production ne l'est pas.
- La suite dure environ 5 minutes : la CI la lance après les contrôles rapides (`checks`), et son travail `e2e` a un délai de 30 minutes.
- Non couverts : paiement par virement, messagerie au-delà du premier échange, alertes de recherche, notifications push et installation sur un vrai appareil, import en masse, avis, signalements, favoris, comparateur, assistant d'achat par IA (un test existe, non modifié).
- Le journal d'audit de la base de développement n'est pas touché : ces tests n'écrivent que dans la base jetable `_e2e`.

## Lot 132 — Connexion avec Google (2026-09-20)

Un bouton « Continuer avec Google » sur les pages de connexion et d'inscription, en français et en arabe (de droite à gauche). **Facultatif** : sans `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`, il n'apparaît pas. **Ce lot n'a pas pu être essayé avec le vrai Google** : il faut d'abord créer les identifiants dans la console Google Cloud (voir `docs/EXPLOITATION.md`, section 5 quater).

**Fonctionnement** : OpenID Connect, code d'autorisation avec **PKCE**, `state` et `nonce`, dans un cookie de déroulement de 10 minutes (signé, illisible par script, à usage unique, propre à ce déroulement : il ne peut jamais servir de session). Étendues demandées : `openid email profile`, rien d'autre. Le jeton d'identité est reçu directement de Google en https (cas prévu par OpenID Connect) ; émetteur, destinataire, expiration, nonce et adresse sont vérifiés, ainsi que l'attestation par Google que l'adresse appartient bien à la personne.

**Règles de rattachement** (`src/lib/google-account.ts`, documentées dans le code et dans `EXPLOITATION.md`)
- Compte Google déjà lié : c'est ce compte du site.
- Adresse déjà inscrite sur le site **et vérifiée** : le compte Google y est rattaché, le mot de passe continue de fonctionner.
- Adresse déjà inscrite **mais non vérifiée** : **refus**. Sans cela, quelqu'un qui se serait inscrit avec l'adresse d'un autre, avant lui, hériterait de sa connexion Google. (Conséquence : pas de réinitialisation de mot de passe sur le site, donc la personne dont l'adresse a été usurpée doit être aidée par l'équipe.)
- Compte de l'équipe (modérateur, administrateur) ou compte suspendu : refus.
- Sinon, création d'un compte : adresse vérifiée d'office, **aucun mot de passe** (`User.passwordHash` devient facultatif).
- Le site ne garde de Google que l'identifiant du compte (`OAuthAccount`) : ni adresse, ni nom, ni photo.

**Autres changements**
- Suppression de compte : un compte créé avec Google (sans mot de passe) confirme en saisissant son adresse e-mail ; un compte avec mot de passe doit toujours le donner. Le lien avec Google est rompu à la suppression (sans cela, le même compte Google rouvrirait le compte anonymisé).
- Adresse de retour (`?next=`) limitée à une page du site : pas de redirection ouverte. Limites de débit par adresse sur le départ et le retour.
- `npm run launch:check` : nouveau contrôle (erreur si un seul des deux identifiants est défini ; affiche l'adresse exacte à déclarer dans Google Cloud). `.env.example` documenté.
- Politique de confidentialité (FR/AR) complétée : données reçues de Google, cookie temporaire de 10 minutes, mot de passe absent pour un compte Google. **À faire relire par un juriste**, comme le reste de la page.
- Migration `20260920110000_google_login` (table `OAuthAccount`, mot de passe facultatif).

**Vérification** : `npm run verify -- --e2e` — 1 199 tests unitaires (dont 52 nouveaux : jeton, PKCE, cookie, redirection, règles de rattachement, contrôle de lancement), **92 tests de bout en bout (25 nouveaux)**, 7 de l'application installable, écart de migrations nul. Les tests de bout en bout tournent contre un **faux serveur Google** (`e2e/mock-google.mjs`) qui applique les vérifications de Google (secret du client, PKCE réel, code à usage unique, adresse de retour) : ils couvrent création de compte, deuxième connexion, rattachement, les quatre refus, annulation, erreur de Google, jetons invalides (nonce, expiration, émetteur, destinataire, non-jeton), état falsifié ou rejoué, cookie falsifié ou de session, redirections ouvertes, limite de débit, suppression du compte. **Vérifié par sabotage** : retirer le refus des adresses non vérifiées, le contrôle de l'état, le contrôle des redirections, celui du nonce, ou la rupture du lien à la suppression fait échouer les tests. Le test de la fonction de redirection a en outre trouvé un défaut de détail (`/fr?x=1`), corrigé.

**Limites**
- **Jamais essayé avec le vrai Google** : identifiants acceptés, adresse de retour déclarée, écran de consentement ne se vérifient qu'avec de vrais identifiants.
- La signature du jeton d'identité n'est pas vérifiée (reçu directement de Google, avec le secret du site) : choix documenté, permis par la spécification.
- Le logo « G » est celui que Google demande pour ses boutons de connexion, reproduit en SVG et contrôlé visuellement ; à comparer aux consignes de marque de Google avant la mise en ligne.
- Pas de rattachement manuel depuis la page du profil (« lier mon compte Google »), pas de « délier », pas d'autre fournisseur (Facebook, Apple) ; les comptes de l'équipe ne peuvent pas utiliser Google.
- Le mode de connexion d'un compte Google-seul (aucun mot de passe) n'offre aucun moyen d'en définir un : à ajouter avec une future réinitialisation de mot de passe.

## Lot 133 — Bloc 6 : mot de passe oublié et révocation des sessions (2026-09-20)

Premier lot du bloc 6 « prêt pour la mise en ligne ». Jusqu'ici, une personne qui perdait son mot de passe perdait son compte, et rien ne permettait de reprendre un compte usurpé (Lot 132) ni de donner un mot de passe à un compte créé avec Google. Les deux sont réglés.

**Livré**
- **Page « Mot de passe oublié »** (`/mot-de-passe-oublie`, lien sous le formulaire de connexion) et **page du lien** (`/reinitialiser-mot-de-passe/[jeton]`), en français et en arabe (de droite à gauche). Non indexées (`noindex`, `robots.txt`), et la page du lien ne transmet pas son adresse à d'autres sites (`no-referrer`).
- **Le site répond toujours la même chose**, que l'adresse existe ou non (même code, même corps, mêmes en-têtes, courriel envoyé après la réponse). Un compte suspendu ou supprimé ne reçoit rien.
- **Lien valable 1 heure, à usage unique**, 256 bits aléatoires. **La base ne garde que son empreinte SHA-256** : une copie de la base ne contient aucun lien utilisable. Une nouvelle demande remplace le lien précédent. Deux confirmations simultanées : une seule aboutit (la suppression du jeton tranche).
- **Limites** : 5 demandes par quart d'heure et par adresse IP, 3 par heure et par adresse e-mail (même inconnue : la limite ne trahit rien non plus).
- **Au changement de mot de passe** : l'adresse est marquée vérifiée (la personne vient de lire ce courrier), le verrouillage par échecs de connexion est levé, **toutes les sessions ouvertes avant sont révoquées**, et la personne reçoit un courriel « votre mot de passe a été modifié » (français ou arabe selon sa langue). Elle n'est pas connectée automatiquement.
- **Révocation des sessions** (`User.sessionsValidAfter`) : les sessions sont des jetons signés sans état côté serveur, donc non révocables jusqu'ici. Chaque session porte maintenant sa date d'émission **à la milliseconde** (`ims`) ; une session antérieure à la dernière réinitialisation est refusée. Les sessions émises avant ce lot sont traitées prudemment (début de leur seconde).
- **Comptes concernés** : un compte créé avec Google (sans mot de passe) peut s'en donner un par ce parcours (Google continue de fonctionner) ; **un compte usurpé (adresse non vérifiée) est récupéré** par la vraie personne, ce qui débloque ensuite Google (Lot 132). La suppression d'un compte supprime aussi son lien en attente.
- Migration `20260920120000_password_reset` (table `PasswordResetToken`, colonne `sessionsValidAfter`). Documentation : `docs/EXPLOITATION.md` (section 5 quinquies, section Google mise à jour).

**Vérification** : `npm run verify -- --e2e` — 1 225 tests unitaires (26 nouveaux : jeton, courriels, service avec base et envoi simulés, révocation des sessions), **107 tests de bout en bout (15 nouveaux)**, 7 de l'application installable, écart de migrations nul. Les tests de bout en bout utilisent un **vrai envoi SMTP vers un faux serveur** (`e2e/mock-smtp.mjs`, port 5188) : les liens sont lus dans les courriels reçus, comme le ferait une personne. Ils couvrent le parcours complet, l'ancien mot de passe refusé, le lien à usage unique, le lien remplacé, l'expiration, les jetons falsifiés, les demandes simultanées, la non-divulgation de l'existence d'un compte, les limites, l'arabe, la révocation des sessions, la récupération d'un compte usurpé et d'un compte Google. **Vérifié par sabotage** : jeton stocké en clair, expiration ignorée, compte suspendu qui reçoit un courriel, jeton non consommé, sessions non révoquées, comparaison de session retirée font tous échouer les tests.
- **Défaut trouvé par ces tests, corrigé** : les sessions ne portaient que la seconde, donc une session ouverte dans la MÊME seconde que la réinitialisation échappait à la révocation. Passé à la milliseconde.
- Délai par test de la suite de bout en bout porté de 30 à 60 s (`playwright.config.ts`) : le premier test, sur un serveur de développement démarré à froid, dépassait 30 s en compilant les écrans d'administration, sans aucun défaut du site.
- Le faux serveur Google appliquait l'ordre `reset` puis identité à l'envers (corrigé) ; le test des messages d'erreur Google ciblait un rôle `alert` que Next.js utilise aussi pour ses annonces de navigation (sélecteur précisé).

**Limites**
- **Aucun courriel réel n'a été envoyé** : la remise, le SPF/DKIM du domaine d'envoi et les courriers indésirables ne se vérifient qu'avec votre vrai serveur SMTP.
- Pas de réinitialisation par SMS, pas de questions de sécurité, pas d'authentification à deux facteurs ; pas de page « changer mon mot de passe » pour une personne connectée (la réinitialisation par courriel sert aussi à cela).
- Les limites de débit sont conservées en mémoire sans Redis (par instance, perdues au redémarrage).
- Une personne bloquée par les limites doit attendre : pas d'outil de déblocage pour l'équipe.
- Les sessions restent des jetons sans état : la révocation est **par compte** (toutes les sessions d'un coup), pas par appareil.

## Lot 134 — Bloc 6 : en-têtes de sécurité et protection contre l'injection de scripts (2026-09-20)

Deuxième lot du bloc 6 « prêt pour la mise en ligne ». Jusqu'ici, si une faille laissait un attaquant glisser du code dans une page, le navigateur l'exécutait ; le site pouvait aussi être affiché dans un cadre par un autre site (clickjacking) et révélait son socle technique. Le navigateur refuse maintenant tout cela.

**Livré**
- **Politique de sécurité des contenus (CSP) à nonce** (`src/proxy.ts`, `src/lib/security-headers.ts`) : chaque page reçoit un nonce aléatoire différent à chaque requête ; seuls les scripts qui le portent s'exécutent. Un script, un gestionnaire (`onclick=…`) ou une adresse `javascript:` injectés sont refusés. Ni `unsafe-eval` ni `unsafe-inline` pour les scripts en production. Le site ne charge, n'appelle et n'encadre rien d'extérieur (seule exception : l'origine du stockage de photos `S3_PUBLIC_URL`, pour les images) ; il ne peut plus être encadré (`frame-ancestors 'none'`).
- **En-têtes fixes sur toutes les réponses** (`next.config.ts`) : `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` (géolocalisation, caméra, micro… interdits), `Cross-Origin-Opener-Policy: same-origin-allow-popups` (la fenêtre WhatsApp reste pilotable) ; en production `Strict-Transport-Security` (1 an, sous-domaines inclus, sans `preload`). `X-Powered-By` supprimé.
- **Un en-tête de politique envoyé par un visiteur n'est jamais repris.**
- **Rapports de violation** : `POST /api/security/csp-report` (toujours 204, corps ≤ 8 Ko, 30/min par IP, bruit des extensions de navigateur ignoré, jetons des adresses masqués dans les journaux, ex. lien de réinitialisation).
- **Mode observation** `CSP_REPORT_ONLY=1` pour un premier déploiement prudent ; `npm run launch:check` avertit tant qu'il est actif.
- **zod en mode « sans compilation » dans le navigateur** (`src/instrumentation-client.ts`) : sa sonde `new Function` déclenchait une fausse violation à chaque page vue en production (défaut révélé par le test de production, corrigé).
- Documentation : `docs/EXPLOITATION.md`, section 5 sexies (mise en place, HSTS, contrôle après déploiement).

**Vérification** : `npm run verify -- --e2e` — 1 263 tests unitaires (38 nouveaux : politique, rapports, proxy, zod, contrôle de lancement), **119 tests de bout en bout (12 nouveaux, dans un vrai navigateur)**, 13 de l'application installable en **production** (6 nouveaux). Les tests prouvent ce que le navigateur **refuse** : script, gestionnaire et lien `javascript:` injectés dans une vraie page, image/requête/cadre externes, encadrement par un autre site (faux site sur un autre port), et que le site fonctionne sans la moindre violation sur 12 pages FR/AR en production. **Sabotages vérifiés** : cadre autorisé, scripts en ligne autorisés, HSTS retiré, zod non réglé, retrait des en-têtes du visiteur dans le proxy → chacun fait échouer le test attendu.
- Constat : dans Next.js 16.3.4, les en-têtes de réponse du proxy sont recopiés dans la requête ; le nonce marche donc même sans la copie explicite, qui est gardée (méthode documentée, requise en mode observation). `x-nonce`, lu nulle part, a été retiré.
- Un test de bout en bout (connexion dans `messaging.spec.ts`) a échoué une fois sur la première exécution complète, puis a réussi seul, à 6 répétitions et dans une seconde exécution complète : **cause non établie** (probablement une course à l'hydratation sur un serveur de développement chargé) ; à surveiller.

**Limites**
- **Écart schéma/migrations non contrôlé** (`SHADOW_DATABASE_URL` non définie ici) : sans effet, ce lot n'ajoute aucune migration.
- Politique **jamais essayée derrière votre vrai répartiteur de charge / CDN**, ni avec un vrai stockage S3 ; HSTS (https) non testé hors production locale en http.
- `style-src` garde `'unsafe-inline'` (styles de Next.js/React) : un style injecté reste possible, un script non.
- Toute ressource externe ajoutée plus tard (police, statistiques, vidéo intégrée) sera bloquée tant qu'elle n'est pas déclarée dans la politique.
- Pas de `preload` HSTS (décision à prendre volontairement, quasi irréversible).

## Lot 135 — Bloc 6 : accessibilité et performance (2026-09-20)

Troisième lot du bloc 6 « prêt pour la mise en ligne ». Pour la première fois, l'accessibilité et le poids des pages sont **mesurés dans un vrai navigateur** au lieu d'être supposés.

**Accessibilité — mesurée avec axe-core, sur toutes les pages, en français et en arabe**
- `e2e/accessibility.spec.ts` audite les pages publiques (20 + 7 dynamiques), l'espace d'un compte connecté (7 écrans, les 11 étapes de publication et la modification d'annonce) et les 23 écrans d'administration. Règles WCAG 2.x A/AA + bonnes pratiques. **Première mesure : 4 familles de défauts (contraste, champs sans étiquette reliée, menus sans nom, zones de navigation non nommées) sur une trentaine de pages ; après correction : zéro.**
- **Texte trop pâle** : `text-slate-400` (contraste 2,6 pour 4,5 exigé) remplacé par `text-slate-500` dans 61 fichiers (117 occurrences) ; boutons verts de l'administration (blanc sur emerald-600, 3,8) passés en emerald-700 ; cartes « bientôt disponible » de l'étape 10 sans opacité réduite ; pagination désactivée lisible et marquée `aria-disabled`.
- **Champs sans étiquette reliée** (défaut critique pour les lecteurs d'écran) : le formulaire de cote, les étapes 2 à 5 de publication (18 champs) — le champ est maintenant DANS son étiquette ; menu de tri de la recherche, menus de rôle de l'administration (« Rôle de … »), envoi de la pièce d'identité : noms accessibles ajoutés (FR/AR).
- **Zones de navigation nommées** (principale, fil d'Ariane — jusqu'ici « Breadcrumb » en anglais —, pagination, sections d'administration).
- **Lien « Aller au contenu principal »** (premier arrêt au clavier). **Menu mobile** : se ferme avec Échap (focus rendu au bouton) et **quand on change de page** (il restait ouvert par-dessus la page choisie), `aria-controls`.
- **Au clavier** (`e2e/accessibility.spec.ts`) : lien d'évitement, contour de focus visible sur chaque élément atteint (tests sur 3 pages × 2 langues), menu mobile.
- `axe-core` ajouté en dépendance de développement (il n'arrivait qu'indirectement, par le lint).

**Performance — mesurée sur la version de production** (`e2e-pwa/performance.spec.ts`, première visite d'un navigateur neuf)
- Mesuré : JavaScript ~233 Ko et CSS ~8 Ko compressés par page, décalage de mise en page nul. Budgets testés : JS 300 Ko, CSS 30 Ko, CLS 0,05.
- **Défaut trouvé et corrigé** : l'image principale (LCP) de l'accueil, de la recherche et des pages marque/modèle/vendeur/professionnel/ville était en chargement différé (`lazy`) : le navigateur la demandait en retard. Les cartes de la première rangée sont maintenant `loading="eager"` + `fetchPriority="high"` (`priority`, déprécié dans Next 16, remplacé partout).
- **Cache** : les photos (`/uploads/*`, noms UUID jamais réutilisés) sont servies `immutable` un an, leurs versions redimensionnées aussi (`minimumCacheTTL`).
- Documentation : `docs/EXPLOITATION.md`, section 5 septies (règles pour les nouveaux formulaires, budgets, avertissement sur les noms de fichiers d'`/uploads`).

**Vérification** : `npm run verify -- --e2e` — 1 263 tests unitaires, **131 tests de bout en bout (12 nouveaux)**, **15 en production (2 nouveaux)**. **Sabotages vérifiés** : couleur pâle rétablie / étiquette retirée (axe), contour de focus supprimé, menu qui ne se ferme plus à la navigation, images de nouveau en `lazy`, en-tête de cache retiré → chacun fait échouer le test attendu.

**Limites**
- Aucun audit avec un **vrai lecteur d'écran** (NVDA, VoiceOver, TalkBack), aucun test de la **qualité** des textes alternatifs ni de la lisibilité de l'arabe, aucun test sur un vrai téléphone : un outil automatique attrape environ un tiers des problèmes d'accessibilité.
- Les pages n'ont été auditées que dans les états testés (pages vides, formulaires non soumis) : messages d'erreur, fenêtres et états de chargement ne le sont pas.
- Mesures de performance **sur cette machine, sans limitation réseau** : les millisecondes ne sont pas des seuils. Pas de mesure sur mobile 3G/4G, ni sous charge (lot suivant), ni « terrain ».
- Les images restent en WebP (pas d'AVIF) : plus léger mais plus coûteux à produire sur un petit serveur ; à réévaluer avec l'hébergement.
- Mode sombre toujours absent (le site reste en thème clair, décision documentée dans `globals.css`).

## Lot 136 — Bloc 6 : sauvegardes surveillées et alertes d'erreur (2026-09-20)

Quatrième lot du bloc 6 « prêt pour la mise en ligne ». Les sauvegardes existaient déjà (Lot 118) ; ce qui manquait, c'est **de savoir quand elles cessent de fonctionner** — on ne l'aurait découvert qu'au jour du sinistre — et **d'être prévenu quand le serveur plante**.

**Livré**
- **Journal d'état des sauvegardes** (`backups/status.json`) : `db:backup` et `db:restore-check` y enregistrent chaque réussite ET chaque échec (date, fichier, taille, empreinte, message d'erreur ; ni secret ni donnée personnelle). Une sauvegarde qui échoue **supprime son archive incomplète** (laissée là, elle aurait été prise pour une vraie).
- **Le veilleur** — `npm run ops:check [-- --notify --strict --url … --no-health]`, code de sortie 0/1. Bloquant : aucune sauvegarde, dernière sauvegarde en échec, plus de 26 h sans réussite, archive introuvable ou < 1 Ko, restauration échouée, place insuffisante pour la prochaine, site injoignable. Attention : archive < moitié de la médiane des 7 précédentes (table vidée ?), restauration jamais testée ou > 35 jours, site lent. Il est **indépendant de ce qu'il surveille** : une tâche planifiée morte ne peut pas signaler sa propre mort.
- **Courriel** (`--notify`, à `OPS_ALERT_EMAILS`, à défaut `STAFF_ALERT_EMAILS`) : dès qu'un problème apparaît, rappel toutes les 6 h tant qu'il dure, silence quand tout va bien (et oubli une fois rétabli).
- **Alertes d'erreur du serveur** (`src/instrumentation.ts` → `onRequestError`) : chaque erreur 500 (page, API, action) est écrite en une ligne dans les journaux (`[erreur] …`, sans paramètres d'adresse ni pile) et envoyée par courriel, **au plus 1 par écran et par type d'erreur toutes les 30 min, 6 par heure au total** (limite partagée via Redis). Le courriel masque e-mails, téléphones et jetons, et donne le code (« digest ») pour retrouver la pile dans les journaux. Redirections, « introuvable » et visiteurs qui coupent la connexion sont ignorés. L'envoi n'est jamais attendu et ne lève jamais d'exception.
- `npm run launch:check` : nouvel avertissement si personne ne reçoit les alertes techniques.
- Modèles de planification dans `app/ops/` : `crontab.example` (sauvegarde 02h15, veilleur toutes les heures, test de restauration le dimanche) et `windows-schedule.ps1` (aperçu par défaut, `-Apply` pour créer les tâches). Documentation : `docs/EXPLOITATION.md` (sections 2 et 3) et `.env.example`.
- Sous Windows, les messages des outils PostgreSQL sont désormais lus proprement (ils arrivaient avec des caractères illisibles dans les journaux et les courriels).

**Vérification** : `npm run verify -- --e2e` — 1 306 tests unitaires (43 nouveaux), 131 de bout en bout, 15 en production. **Preuves en conditions réelles, hors tests** : vraie sauvegarde, vraie restauration dans une base temporaire, puis pannes provoquées — base inexistante (échec enregistré, aucune archive partielle), archive tronquée à 300 octets, archive effacée, journal vieilli de 30 h, site injoignable — chacune détectée par le veilleur, avec courriel réel vers le faux serveur SMTP du projet (un seul envoi, le second passage muet). Une vraie erreur 500 sur un vrai serveur **de développement puis de production** : deux erreurs, un courriel. `tests/backup-chain.test.ts` rejoue la chaîne sauvegarde → restauration → veilleur avec les vrais outils PostgreSQL (se saute si la base est absente). **Mutations vérifiées** : 7 règles du veilleur et l'écriture du journal des scripts cassées volontairement → chacune fait échouer un test.
- Défaut trouvé pendant l'essai et corrigé : la raison d'un échec était tronquée à la première ligne (« pg_dump a échoué : » sans la suite).

**Limites**
- **Aucune copie hors du serveur n'est automatisée** : elle dépend de l'hébergement (autre machine, stockage objet) et reste à faire à la main. Une sauvegarde sur le même disque disparaît avec lui.
- **Les modèles cron et Windows n'ont pas été essayés sur un vrai serveur** (cron : jamais lancé ; Windows : aperçu vérifié, création des tâches non essayée). À essayer une fois à la main.
- Le veilleur tourne sur la même machine que la sauvegarde : si tout le serveur tombe, il ne dit rien. Le **moniteur de disponibilité extérieur** (section 3) reste indispensable.
- Les courriels n'ont été testés que vers un **faux serveur SMTP** : remise réelle, SPF/DKIM et courriers indésirables ne se vérifient qu'avec votre vrai serveur.
- Le nettoyage de l'archive **incomplète** après un échec en cours de route n'est pas prouvé par un test (un `pg_dump` qui échoue à la connexion n'en crée pas) ; le code est simple mais non exercé.
- Les archives ne sont **pas chiffrées** (téléphones et pièces d'identité le sont déjà par l'application avec `ENCRYPTION_KEY`, le reste de la base ne l'est pas) : à protéger comme la base elle-même.
- Le contrôle du site se limite à `/api/health` (base de données). Pas de suivi d'erreurs du **navigateur** des visiteurs, pas de tableau de bord ni de graphiques, pas de service extérieur de type Sentry.
- Le veilleur ne détecte pas une sauvegarde **réussie mais inutile** (base vide, mauvaise base) au-delà de la comparaison de taille : c'est le test de restauration hebdomadaire qui le prouve.

## Lot 137 — Bloc 6 : test de charge, et trois défauts d'échelle corrigés (2026-09-20)

Cinquième lot du bloc 6 « prêt pour la mise en ligne ». Sur les 24 annonces de démonstration, aucune mesure n'a de sens : ce lot fabrique un **volume réaliste** (20 000 annonces), mesure le site compilé en production, et corrige ce que la mesure révèle.

**Outils livrés**
- **`npm run load:seed`** : crée la base dédiée `<base>_load` (refusée si son nom ne finit pas par `_load`, jamais la base de développement ni celle des tests), applique les migrations et génère les annonces (20 000 en 7 s, reproductibles). Données volontairement **rudes** : un modèle courant (Renault Clio) = 24 % des annonces, le plus gros vendeur en a près de 3 000, grandes wilayas surreprésentées, statuts variés, prix qui suivent l'âge et le kilométrage.
- **`npm run load:test -- --start`** : compile, démarre le site en production sur cette base, joue 10 scénarios (accueil, recherche simple / filtrée / par mot / page profonde, fiche, page d'un modèle, vendeur, plan du site, santé) plus un **mélange réaliste de navigation**, en montée en charge (`--concurrency 1,10,50,100`). Percentiles réels (rang le plus proche), erreurs comptées à part, budgets par scénario (`scripts/load-budget.json`, code de sortie 1 si dépassé).
- **`SLOW_QUERY_MS`** : journal des requêtes SQL lentes (`[sql-lent] 412 ms — SELECT …`), **sans jamais écrire les valeurs des paramètres**. C'est lui, avec un profil processeur du serveur, qui a permis de trouver la cause.

**Ce que la mesure a révélé, et corrigé** (à 10 visiteurs simultanés, 20 000 annonces, avant → après)
- **Comparables de prix rechargés à chaque visite** — cause principale. Le badge « bon prix » de chaque carte chargeait TOUTES les annonces publiées du même modèle (3 855 lignes pour une Clio + une requête à 3 855 paramètres pour leurs équipements), à chaque page de recherche, pour chaque modèle affiché : le client de base de données prenait **42 % du temps du serveur** et le coût croît avec le volume. Ces lignes sont maintenant gardées 60 s par modèle, avec regroupement des chargements simultanés ; le calcul est **strictement identique** (test : résultat comparé au calcul direct). Sept pages en profitent.
- **Pages vendeur et vitrine professionnelle non paginées** : toutes les annonces du vendeur (1,2 Mo de HTML). Désormais 20 par page (`?page=`).
- **Référentiel rechargé à chaque recherche** (62 marques + 410 modèles, 69 wilayas + 1 541 communes) : gardé 5 min en mémoire, rafraîchi tout de suite par l'administration du catalogue.
- **Deux index** (migration `20260920130000_listing_search_indexes`, écart nul avec `schema.prisma` vérifié) : « plus récentes d'abord » 6,7 → 0,08 ms, annonces d'un modèle 3,4 → 0,06 ms (parcours complet de la table avant, proportionnel au volume).
- **Plan du site** : limité à 50 000 adresses (limite du protocole, au-delà les moteurs rejettent tout le fichier), annonces les plus récentes d'abord, avertissement `[sitemap]`.

| Scénario | req/s | p95 (ms) | Poids de la page |
|---|---|---|---|
| Recherche | 11,6 → **42,7** | 958 → 269 | 437 Ko |
| Recherche filtrée | 11,1 → 42,4 | 1 037 → 255 | 449 Ko |
| Recherche par mot | 17,9 → 38,2 | 617 → 294 | |
| Recherche, page profonde | 14,4 → 50,7 | 771 → 237 | |
| Fiche d'annonce | 48,4 → 95,1 | 298 → 122 | |
| **Page vendeur** | 5,8 → **71,5** | 1 829 → 168 | 1 237 → **226 Ko** |
| Navigation (mélange) | 20,1 → **58,2** | 860 → 251 | |
| Accueil, page modèle, santé, plan du site | inchangés | | |

**Capacité** (montée en charge, machine de développement, générateur et base sur la même machine) : environ **55 à 60 pages/s par processus Node**, puis la file s'allonge ; à **200 visiteurs simultanés : aucune erreur**, p95 de 4 s (dégradation progressive, pas d'effondrement). Estimation grossière, non vérifiée avec de vrais visiteurs : ~1 000 à 1 500 visiteurs actifs simultanés par processus ; au-delà, plusieurs instances.

**Vérification** : `npm run verify -- --e2e` — 1 356 tests unitaires (50 nouveaux : cache et son plafond, comparables identiques au calcul direct, statistiques du test de charge, générateur de données, journal des requêtes lentes, pagination, limite du plan du site), 131 de bout en bout, 15 en production. Le budget a été mis à l'épreuve en **réintroduisant les défauts** : il détecte la page vendeur non paginée (p95 1 018 ms pour 500 ms de budget, code de sortie 1).

**Limites**
- **Le budget ne détecte pas tout** : la suppression du cache des comparables n'a PAS été détectée (p95 390 ms pour un budget de 700 ms), l'index ayant déjà réduit le coût de ce défaut. Il repère les régressions d'au moins 2,5 fois, pas les dérives lentes.
- **Recherche par mot** : `ILIKE '%mot%'` sur sept colonnes, non indexable, 32 à 40 ms à 20 000 annonces et **proportionnel au volume** (de l'ordre de la seconde vers 500 000). Remède : index trigramme (`pg_trgm`, à vérifier chez l'hébergeur) ou moteur dédié. Le compte des annonces parcourt aussi tout (3,4 ms).
- **Plan du site** : au-delà d'environ 45 000 annonces publiées, il faudra plusieurs plans (`generateSitemaps`) ; sinon les plus anciennes annonces en sortent.
- **Estimations décalées de 60 s au plus** : une annonce publiée, vendue ou au prix modifié n'entre dans le badge « bon prix » et la cote qu'après ce délai (les annonces affichées sont toujours à jour). Le référentiel : 5 min sur les autres instances après une modification du catalogue.
- Les **avis** des pages vendeur et professionnelle ne sont pas paginés (la moyenne de la vitrine se calcule sur tous). La recherche envoie encore ~437 Ko de HTML avant compression (toutes les communes et modèles pour les filtres ; poids compressé non mesuré).
- **Mesure sur cette machine seulement**, sans latence réseau, sans images ni scripts, sans Redis, avec le générateur sur la même machine : elle compare l'avant et l'après, elle ne garantit rien pour votre serveur. **Relancer le test sur l'hébergement réel avant l'ouverture.**
- La base de charge `souq_auto_load` (20 000 annonces fabriquées) existe sur ce PostgreSQL ; `--reset` la reconstruit. Les vendeurs fictifs `charge-N@example.dz` n'ont aucun mot de passe.

## Lot 138 — Bloc 6 : double authentification (TOTP), obligatoire pour l'équipe (2026-09-20)

Sixième lot du bloc 6 « prêt pour la mise en ligne ». Le compte d'un administrateur est la cible n°1 d'un site d'annonces : un mot de passe volé, deviné ou réutilisé d'un autre site suffisait à prendre la modération, les pièces d'identité et les données des vendeurs.

**Livré**
- **Double authentification par application** (TOTP, RFC 6238 : Google Authenticator, Microsoft Authenticator, Aegis, FreeOTP, 2FAS…), activable par tout compte sur `/compte/securite` : code QR (ou clé à recopier), confirmation par un premier code, puis **dix codes de secours montrés une seule fois**. Écrite avec le seul module `crypto` de Node (aucune bibliothèque pour ce qui protège les comptes) ; seul ajout : `qrcode-generator` (MIT, **zéro dépendance**) pour dessiner le QR, dont on n'envoie au navigateur que le tracé, jamais de HTML.
- **Obligatoire pour l'équipe en production** : un administrateur ou modérateur SANS double authentification n'a **aucun pouvoir d'équipe** (le site le traite en simple particulier : interface et API d'administration refusées) jusqu'à ce qu'il l'active, ce que la page lui explique. Appliqué en **un seul point** (`getCurrentUser`) : aucune des ~40 vérifications de droits n'a été modifiée, aucune ne peut l'oublier. `REQUIRE_STAFF_2FA` (`1` / `0` / absent = exigée en production seulement).
- **Connexion en deux temps** : après le mot de passe **ou Google**, un compte protégé n'a **aucune session** ; seul un cookie d'attente de 5 minutes, sans rôle, refusé comme session même si on le recopie dans le cookie de session. La session n'est créée qu'après un code valable (`/connexion/verification`, français et arabe).
- **Protections** : secret chiffré en base (AES-256-GCM) ; codes de secours conservés sous forme d'**empreinte à clé** seulement ; **anti-rejeu atomique** (un code ne sert qu'une fois, même envoyé deux fois en même temps) ; tolérance ±30 s ; **5 codes faux verrouillent le compte 15 min** et le bon mot de passe ne remet pas ce compteur à zéro (sans quoi le verrouillage ne se déclencherait jamais) ; désactiver exige le **mot de passe ET un code** ; activer révoque les autres sessions.
- **Récupération** : code de secours ; réinitialisation par un **autre administrateur** depuis « Utilisateurs » (jamais par un modérateur, jamais sur soi-même) ; **`npm run auth:reset-2fa -- --email …`** sur le serveur pour l'unique administrateur bloqué. Chaque changement est **signalé par courriel** à la personne et écrit dans le **journal d'audit**.
- `npm run launch:check` : avertit si l'obligation est désactivée et compte les comptes d'équipe qui ne l'ont pas encore ; **ne plante plus** quand une migration est en attente (il affichait une trace Prisma au lieu de « migration non appliquée »).
- Migration `20260920140000_two_factor` (écart nul avec `schema.prisma` vérifié) ; appliquée à la base de développement. Documentation : `docs/EXPLOITATION.md` section 5 nonies, `.env.example`.

**Vérification** : `npm run verify -- --e2e` — 1 455 tests unitaires (99 nouveaux), **152 tests de bout en bout (21 nouveaux)**, **20 en production (5 nouveaux)**.
- **TOTP validé contre les vecteurs officiels** de la RFC 4226 (10 codes) et de la RFC 6238 (6 instants) ; **code QR relu à l'identique par un décodeur indépendant** (libellé arabe compris).
- Tests de bout en bout dans un vrai navigateur, sur la vraie base et un vrai envoi SMTP vers le faux serveur : activation, connexion en deux temps, code faux, **rejeu refusé**, **trois vérifications simultanées du même code : une seule passe**, code de secours à usage unique (courriel reçu), verrouillage, jeton d'attente recopié comme session, Google, désactivation, réinitialisation par un administrateur (session révoquée, journal d'audit), audit d'accessibilité de chaque état de la page (FR/AR).
- **En production, sous la politique de sécurité stricte** : un administrateur sans double authentification n'a aucun pouvoir, les retrouve en l'activant ; modérateur soumis à la même règle ; cookies `httpOnly` + `secure` + `SameSite=Lax` de 5 minutes ; parcours complet sans aucune violation ni erreur ; `auth:reset-2fa` réel.
- **Sabotages vérifiés** (chacun fait échouer le test attendu) : anti-rejeu retiré (service et TOTP), fenêtre élargie, code de secours réutilisable, désactivation sans mot de passe, activation sans révocation des sessions, jeton d'attente accepté comme session, équipe sans double authentification qui garde ses pouvoirs (unitaire ET en production), session ouverte malgré la protection, codes faux non comptés, compteur remis à zéro par le mot de passe, contournement par Google. Un seul survivant, **équivalent** : le contrôle du dernier pas existe deux fois (à la lecture et dans la mise à jour atomique) ; retirer la seconde est détecté par le test de concurrence.

**Limites**
- **Jamais essayé avec une vraie application d'authentification sur un vrai téléphone** : algorithme et QR sont validés, mais personne n'a scanné le code avec Google Authenticator. À faire une fois, avec les applications que vos administrateurs utiliseront.
- **`ENCRYPTION_KEY` protège aussi ces secrets** et l'empreinte des codes de secours : la changer ou la perdre les rend tous inutilisables (chaque personne à réinitialiser). Consigné aux sections 2, 5 nonies et 6 du guide.
- L'**heure du serveur** doit être exacte (NTP) ; un téléphone décalé de plus de 30 s obtient « code incorrect ».
- **Non couvert** : SMS, clés de sécurité / passkeys (WebAuthn), « se souvenir de cet appareil » (le code est demandé à chaque connexion), sessions par appareil (la révocation est par compte).
- Une personne qui connaît le mot de passe d'un compte peut le **verrouiller** 15 minutes en échouant 5 codes (même compromis que pour un mot de passe).
- **Premier déploiement en production** : tous les comptes d'équipe existants perdent leurs pouvoirs jusqu'à ce qu'ils activent la fonction. `launch:check` en compte déjà un (l'administrateur de développement).
- Textes **arabes rédigés ici**, à faire relire par un locuteur natif (les 54 nouveaux messages et les courriels).

## Lot 139 — Recherche par mot : indépendante du volume, à résultats identiques (2026-09-20)

Le Lot 137 avait laissé un point faible mesuré : la recherche par mot (`?q=`) lisait toute la table à chaque requête, et le comptage de la pagination aussi. Coût proportionnel au nombre d'annonces — invisible aujourd'hui, bloquant à 100 000. Ce lot le corrige **sans rien changer à ce que la recherche trouve**.

**Deux changements**
- **Le mot est cherché d'abord dans le catalogue** (62 marques, 410 modèles, 69 wilayas — déjà gardés en mémoire depuis le Lot 137), puis la requête devient « titre contient… OU marque dans (…) OU modèle dans (…) OU wilaya dans (…) » : **plus aucune jointure**, là où chaque ligne d'annonce en exigeait jusqu'à quatre.
- **Index trigramme** (`pg_trgm`, migration `20260920150000_listing_text_search`, écart nul avec `schema.prisma` vérifié) : le « contient » du titre et des textes libres devient indexable. Index de 6,4 Mo pour une table de 31 Mo à 100 000 annonces.

**Mesures à 100 000 annonces** (base de charge, `npm run load:seed -- --listings 100000`)

| Scénario (10 visiteurs) | req/s | p95 |
|---|---|---|
| recherche par mot | 10,8 → **28,9** | 1 100 → **418 ms** |
| recherche simple | 23,6 → 28,3 | 609 → 484 ms |
| recherche filtrée | 23,0 → 23,7 | 543 → 476 ms |
| navigation (mélange) | 33,1 → 34,5 | 618 → 481 ms |

Comptage d'un mot d'au moins 3 lettres et peu courant : **0,03 à 15 ms** (contre 66 à 158 ms) ; un mot sans résultat (« zzzz ») passe de 408 à **0,04 ms**.

**Ce qui n'a pas changé, et qui est prouvé**
- `src/lib/like.ts` reproduit **exactement** le `ILIKE '%mot%'` d'origine, jokers compris : Prisma ne protège ni `%` ni `_`, donc « c_io » trouve « Clio » et « % » trouve tout — comme avant. Écrit **sans expression régulière** (deux pointeurs, coût borné) : un motif rempli de `%` ne peut pas figer le serveur.
- `tests/search-equivalence.test.ts` compare, sur les **100 000 annonces**, les annonces trouvées par l'ancienne et la nouvelle forme — **une à une** (empreinte des identifiants triés), sur **70 mots** : casse, accents, arabe, chiffres, jokers, caractères d'échappement, injections, mots sans résultat, et mot + filtres. Il compare aussi le catalogue directement à PostgreSQL, parce que le titre des annonces fabriquées contient le nom du modèle et masquerait un écart.

**Vérification** : `npm run verify -- --e2e` — 1 623 tests unitaires (168 nouveaux), **158 de bout en bout (6 nouveaux)**, 20 en production. Les tests de bout en bout prouvent ce que voit le visiteur : une annonce trouvée par le nom de son modèle alors que son titre ne le contient pas, par le nom arabe de sa wilaya, les jokers, et aucune annonce en attente de modération. **Sabotages vérifiés** : « _ » ou « % » traités comme littéraux, échappement ignoré, casse non pliée, nom arabe des wilayas oublié, modèles oubliés, clause des modèles retirée (de bout en bout) → chacun fait échouer le test attendu.

**Limites**
- **Exigence d'hébergement** : la migration exécute `CREATE EXTENSION pg_trgm` — extension « de confiance » depuis **PostgreSQL 13** (le propriétaire de la base suffit), mais absente si le paquet `postgresql-contrib` ne l'est pas. La migration échoue alors : la faire créer par un administrateur de la base avant `prisma migrate deploy`. Sans les index, le site fonctionne à l'identique, seulement plus lentement à grand volume.
- **Un index trigramme exige au moins 3 caractères** : « a » ou « ar » restent un parcours complet (70 à 225 ms à 100 000 annonces, et la mesure a même été plus lente qu'avant l'index sur ce cas). Un **mot très courant** (« clio » = un quart des annonces) reste à ~73 ms : PostgreSQL choisit le parcours complet, à raison, quand il faut de toute façon compter des dizaines de milliers de lignes.
- **Toujours pas de pliage des accents ni de tolérance aux fautes** (« megane » ne trouve pas « Mégane ») : c'est le comportement d'avant, conservé délibérément. Le remède serait l'extension `unaccent` et la similarité trigramme, ou un moteur de recherche dédié — un changement de comportement, donc un choix produit.
- Les **alertes de recherche** gardent l'ancienne forme : elles testent une seule annonce par son identifiant, où les jointures ne coûtent rien.
- **Constat nouveau, non traité** : à 100 000 annonces, le badge « bon prix » coûte du processeur à chaque page, et le rechargement des comparables d'un modèle très courant ~0,8 s chaque minute. *(Corrigé par le Lot 140 : les ~13 ms annoncées ici venaient d'une mesure insuffisamment chauffée — le coût réel était de ~4,1 ms, ramené à ~1,8 ms, et sans changer les résultats. L'analyse « c'est un choix produit » était donc fausse.)*
- Mesures **sur cette machine**, sans latence réseau : elles comparent l'avant et l'après, elles ne garantissent rien pour votre serveur.

## Lot 140 — Badge « bon prix » : deux fois moins cher, résultats identiques (2026-09-20)

Le Lot 139 avait relevé que l'estimation de prix coûtait du processeur à chaque page, et avait conclu que le remède imposait **un choix produit**. **Cette conclusion était fausse** : en regardant le code de près, aucune carte n'atteint le palier « sans filtre » — toutes gagnent à un palier qui filtre l'année (± 2 ans). Il suffisait donc de ranger les comparables par année, sans rien changer au calcul.

**Ce qui change (uniquement le chemin d'accès, jamais la règle)**
- Les comparables d'un modèle sont **rangés par année** une fois pour toutes, à l'intérieur du cache (src/lib/price-estimation.ts) : chaque carte ne parcourt plus que la tranche utile au lieu de toutes les annonces du modèle, et ce pour chacun des paliers essayés.
- La **recopie du tableau** faite pour exclure l'annonce de ses propres comparables est supprimée (l'exclusion se fait au passage) : à elle seule, elle représentait la moitié du coût.
- Le test d'équipements ne crée plus un `Set` par ligne comparée.
- Le rangement par année n'est qu'un **pré-filtre** : la règle reste `matchesTier`, qui revérifie l'année. Une tranche trop large ne change donc rien au résultat, seulement au coût.

**Mesures à 100 000 annonces** (base de charge ; les deux algorithmes également chauffés, mesures alternées pour annuler l'effet de la compilation à la volée) : une page de recherche de 20 cartes passe de **4,1 à 1,8 ms de processeur** (2,3 fois moins) ; la fonction complète appelée par la page coûte 3,6 ms. Le rangement lui-même coûte ~1 ms, payé **une fois par modèle et par minute**, pas à chaque page.

**Ce qui ne change pas, et qui est prouvé** : `tests/price-estimation-equivalence.test.ts` compare la nouvelle estimation à une **copie conforme de l'algorithme d'origine** (extraite du dépôt), sur plus de 200 annonces réelles de la base de charge — les plus récentes, les moins et les plus chères, les plus anciennes, les plus kilométrées, sur des modèles courants comme rares — et sur sept variantes de demande par annonce (cote complète, critères partiels, année absente, année sans aucune annonce, kilométrage nul, années non entières). Valeurs **et** critères retenus comparés à l'identique.

**Vérification** : `npm run verify -- --e2e` — 1 628 tests unitaires (5 nouveaux : équivalence sur données réelles, forme de l'index et gel du cache), 158 de bout en bout, 20 en production. Les 55 tests d'estimation existants passent **sans la moindre modification**. **Sabotages vérifiés** : fenêtre d'années rétrécie, annonce comparée à elle-même, seuil d'équipements durci, équipements comptés double → chacun fait échouer le test d'équivalence. Un cinquième sabotage (bornes d'années arrondies vers l'extérieur) **survit, à juste titre** : il fait parcourir quelques lignes de plus, que `matchesTier` rejette — le comportement reste identique. Un sixième (rangement par année ignoré) survit aussi, ce qui est la preuve attendue que le pré-filtre ne décide de rien.

**Corrections apportées au Lot 139** : les « ~13 ms de processeur par page » annoncées venaient d'une mesure insuffisamment chauffée ; le coût réel était de ~4,1 ms. L'entrée du Lot 139 et `docs/EXPLOITATION.md` ont été corrigés.

**Autre chose corrigée en passant** : un test de bout en bout du Lot 138 (liste des utilisateurs de l'administration) a échoué **une fois**, en fin de suite complète. Non reproductible isolément (5 fois sur 5, puis 3 fois sur 3 avec 418 comptes en base) : **cause non établie**, probablement un rafraîchissement de la liste plus lent que les 15 secondes accordées sur un serveur de développement chargé. Le test a été rendu plus informatif plutôt que plus permissif : il vérifie d'abord que la réinitialisation est enregistrée en base (donc que le clic a été confirmé et la route appelée), puis que la liste se met à jour — un échec dit désormais laquelle des deux étapes a lâché, et ne masque pas un vrai défaut de rafraîchissement.

**Limites**
- Le **rechargement** des comparables d'un modèle très courant depuis la base (~18 000 lignes, une fois par minute) reste à ~0,8 s : c'est la lecture, pas le calcul. Le réduire demanderait de limiter le pool de comparables — **là**, ce serait un vrai choix produit.
- Mesures **sur cette machine**, comparables déjà en mémoire : elles comparent l'avant et l'après, elles ne garantissent rien pour votre serveur.
- L'équivalence est prouvée sur les annonces **fabriquées** de la base de charge : elles couvrent 26 années, des modèles courants et rares, mais pas toutes les formes qu'aura un vrai marché.

## Lot 141 — Confiance vendeur : badges vérifiés, et réactivité mesurée (2026-09-21)

Sur un site d'annonces, l'acheteur doit décider s'il fait confiance à un inconnu. Le score de confiance existait depuis le Lot 12, mais **pas là où la décision se prend** : la fiche d'annonce n'affichait que le nom du vendeur et ses étoiles. Et rien ne disait si ce vendeur répond aux messages.

**Livré**
- **Badges de confiance sur la fiche d'annonce** (`SellerTrustBadges`), juste sous le nom du vendeur, à côté du bouton « Contacter » : identité vérifiée par l'équipe, professionnel vérifié, réactivité. Uniquement des signaux **vérifiés par le site**, jamais déclarés par le vendeur.
- **Réactivité mesurée sur les vraies conversations** (`src/lib/seller-responsiveness.ts`, pur et testé ; `…-service.ts` pour la lecture en base) : sur 90 jours, badge accordé à partir de 5 conversations jugeables, 80 % de réponses et une médiane sous 24 h — décliné en « moins d'une heure », « moins de 2 heures », « moins de 6 heures », « dans la journée ».
- **Uniquement des signaux positifs**, sur décision du porteur de projet : un vendeur lent ou trop nouveau n'a **aucun** badge, jamais de mauvaise note publique. Le compromis assumé : l'acheteur ne distingue pas « nouveau » de « ne répond jamais ».
- **Le vendeur voit ses propres chiffres** sur son tableau de bord (`OwnResponsiveness`) : conversations répondues, délai habituel, et ce qui lui manque pour obtenir le badge. C'est le seul endroit où un chiffre défavorable s'affiche, et lui seul le voit — sans quoi il ne pourrait pas savoir pourquoi il n'a pas le badge.
- Textes français et arabe (19 clés).

**Décisions de calcul, et pourquoi**
- **Délai de grâce de 48 h** : une conversation reçue il y a dix minutes et encore sans réponse n'est pas un échec, elle est exclue. Sans cela, un vendeur serait pénalisé par les messages qu'il est en train de lire.
- **Médiane et non moyenne** pour le délai : une seule absence prolongée ne doit pas effacer des centaines de réponses rapides.
- **« A répondu » = un message venant de quelqu'un d'autre que l'acheteur** : sur un compte professionnel, la réponse d'un collaborateur compte — pour l'acheteur, la réponse est arrivée.
- **200 conversations les plus récentes au maximum** : cette mesure tourne à chaque consultation d'annonce. Mesuré à 100 000 annonces : 1,3 ms pour un vendeur sans conversation, et **11,8 ms au pire** — borné, au lieu de croître avec l'activité du vendeur (13 à 22 ms mesurées à 300 conversations avant la borne).

**Vérification** : `npm run verify -- --e2e` — 1 643 tests unitaires (15 nouveaux), **162 de bout en bout (4 nouveaux)**, 20 en production. Les tests de bout en bout construisent de **vraies conversations** par l'API (un acheteur inscrit par conversation, le vendeur répond), puis reculent les dates en base pour simuler les délais : c'est le seul artifice, tout le reste est le vrai code. Ils prouvent qu'un vendeur réactif obtient le badge sur la fiche et sur sa page, qu'un vendeur muet n'obtient **rien** (et qu'aucune formulation négative n'atteint une page d'acheteur), que le vendeur voit ses chiffres et la raison qui lui manque, et que le badge « identité vérifiée » apparaît dès la validation par l'équipe. Les pages modifiées sont déjà couvertes par l'audit d'accessibilité du Lot 135. **Sabotages vérifiés** : minimum de conversations retiré, seuil de taux retiré, délai de grâce supprimé, fenêtre de 90 jours supprimée, réponse antérieure à la question acceptée, plafond de 24 h supprimé, et — de bout en bout — le message de l'acheteur compté comme une réponse du vendeur. Chacun fait échouer les tests attendus.

**Limites**
- La réactivité ne mesure que la **messagerie du site** : un vendeur joint par téléphone ou WhatsApp (Lot 119) paraît muet. C'est la limite la plus gênante de la mesure, et elle est irréductible sans instrumenter des échanges hors du site.
- Les **seuils** (90 jours, 48 h, 5 conversations, 80 %, 200) sont des choix documentés, pas une calibration statistique : à réviser quand il y aura du vrai trafic.
- Les badges ne sont **pas** affichés sur les cartes de résultats : ce serait une mesure par vendeur affiché, non mesurée à ce jour. À faire seulement après l'avoir chiffré.
- Rien n'empêche un vendeur de répondre « ok » à tout pour gagner le badge : c'est une mesure de **réactivité**, jamais de qualité des réponses.
- Textes arabes rédigés ici, **à faire relire par un locuteur natif**.

## Lot 142 — Images de partage des annonces (2026-09-21)

Quand le lien d'une annonce est collé dans WhatsApp, Facebook ou Messenger, l'aperçu montrait la **photo brute du vendeur** : sans prix, sans caractéristiques, de format quelconque. Et une annonce publiée **sans photo n'avait aucune image** — WhatsApp n'affichait qu'un lien nu. Or le partage par WhatsApp est le canal principal d'une place de marché en Algérie.

**Livré**
- **Une carte générée par annonce** (`/{langue}/annonce/{id}/opengraph-image`, JPEG 1200 × 630) : la photo cadrée en fond, un dégradé sombre, la marque et le modèle, l'année, le kilométrage, le carburant, la wilaya, et le prix dans une pastille blanche lisible sur n'importe quelle photo. Sans photo, un fond en dégradé avec les mêmes textes.
- **La fiche l'annonce** : `og:image` avec type, largeur, hauteur et texte alternatif, plus la carte Twitter grand format.
- **Uniquement les annonces publiées**, comme la fiche : brouillon, en attente, refusée, suspendue, vendue ou expirée répondent 404 — ni prix ni photo ne fuient par une adresse d'image devinée.

**Décisions techniques, et pourquoi**
- **JPEG et non PNG** : le moteur (`ImageResponse`) ne produit que du PNG, ~1 Mo avec une photo dessous, et WhatsApp affiche mal les aperçus lourds (repère : ~300 Ko). Le calque de texte seul est dessiné par le moteur (un PNG transparent de ~34 Ko), posé avec `sharp` sur la photo recadrée, puis encodé en JPEG : **153 Ko au plus** (mesuré).
- **Texte latin uniquement** : la police embarquée (Geist) n'a pas l'arabe, et le moteur va chercher les emojis sur un service externe. Tout caractère hors latin saisi par un vendeur est retiré ; une marque saisie uniquement en arabe donne « Souq Auto ». La carte est **identique dans toutes les langues** (vérifié octet pour octet, français et arabe).
- **Coût mesuré** : ~110 ms de processeur pour dessiner une carte à froid, 0 ms depuis le cache. Un premier essai à 231 ms utilisait `mozjpeg`, qui coûtait à lui seul ~120 ms pour un poids à peine plus léger : retiré. Cache mémoire de 120 cartes dont la **clé est le texte et la photo** (jamais une carte périmée : un prix modifié donne une autre image) ; les demandes simultanées d'une même carte ne la dessinent qu'une fois. En-têtes HTTP : `max-age=300, s-maxage=600`.
- **Sécurité de la photo lue** : un chemin local doit rester dans `public/uploads/` (aucune remontée de dossier, aucun dossier voisin au nom proche) ; une adresse distante n'est suivie que sous `S3_PUBLIC_URL`, sans redirection, 3 s et 10 Mo au plus ; au moindre doute, la carte se dessine sans photo.

**Défaut trouvé en cours de route** : `generateMetadata` de la fiche déclarait encore l'ancienne photo brute, qui **l'emportait** sur ma carte (`og:image` pointait vers le fichier de l'envoi, sans dimensions). Retirée — un test de bout en bout garde désormais ce point. La requête de la première photo, devenue inutile dans cette fonction, est supprimée avec elle.

**Vérification** : `npm run verify -- --e2e` — 1 681 tests unitaires (38 nouveaux : texte, sécurité de la photo, dessin et cache), **169 de bout en bout (7 nouveaux)**, 20 en production, **build de production compris**. Les tests de bout en bout vérifient dans le vrai serveur : les balises de la fiche en français et en arabe, l'image servie (JPEG, 1200 × 630, < 300 Ko, en-têtes de cache, bas plus sombre que le haut), une annonce sans photo, le prix modifié, l'identité français/arabe, les six statuts non publiés (404, puis 200 une fois republiée), et les identifiants absurdes (404, jamais 500). **Sabotages : 21 sur 22 détectés**, dont 2 de bout en bout (contrôle du statut retiré ; ancienne photo redéclarée). Le seul survivant est le rétrécissement du titre long, purement visuel. La première passe de ces sabotages en avait laissé survivre quatre, qui révélaient de vrais trous dans mes propres tests — dossier voisin `uploads-evil`, fichier trop lourd (mon « gros fichier » n'était que des zéros, refusé pour la mauvaise raison), éviction du cache, et un mauvais outil de mesure (`sharp` ignore `extract()` avant `stats()`) — tous corrigés.

**Deux constats hors périmètre, vérifiés en rejouant l'état d'avant ce lot**
- Le journal de la phase de production contient l'erreur serveur « The destination stream closed early » sur la fiche d'annonce et sur la page marque. Elle **existe déjà avant ce lot** (même identifiant, même page, mesurée sur le code du Lot 141) et se produit quand le navigateur de test passe à la page suivante avant la fin du rendu en flux. Sans effet sur les visiteurs à ce jour, mais elle apparaît dans les alertes d'erreur : à filtrer si elle devient bruyante.
- Sur ce même état d'avant, **un test de production du Lot 138** (`auth:reset-2fa`) a échoué une fois, sur `ECONNRESET` à la première requête suivant un script bloquant. **Cause non établie** : une première hypothèse (délai de garde de connexion dépassé pendant le script) a été **infirmée par la mesure** (le script dure ~1,1 s pour 5 s nécessaires), le serveur n'a rien journalisé, et le test passe 10 fois sur 10 en rejeu. Rien n'a été modifié : ajouter une reprise automatique masquerait la cause.

**Limites**
- **Pas testé avec les vrais robots de WhatsApp ou Facebook** : cela suppose un site public. À vérifier au déploiement avec le **débogueur de partage de Facebook**, et en collant un lien dans WhatsApp.
- **Aucune limitation de débit dans l'application** : demander la carte de très nombreuses annonces distinctes ferait dessiner ~110 ms chacune. À traiter à l'hébergement (limitation de débit, réseau de diffusion) ; les en-têtes de cache sont prêts pour cela. Le cache mémoire est propre à chaque processus.
- Tout est en **caractères latins** : un acheteur arabophone voit « DA » et des noms de marque latins sur la carte. Pas de gras (la police embarquée n'a que la graisse normale). Une photo verticale est recadrée au centre et peut couper le haut ou le bas du véhicule.
- La fiche d'un **brouillon** porte quand même la balise d'image (Next l'ajoute), qui pointe vers un 404 : aperçu vide, rien de divulgué.
- Le `og:title` de la fiche répète marque, modèle et année (« Renault Clio 2018 — Renault Clio 2018 ») : défaut **antérieur**, non traité ici.

## Lot 143 — Confiance vendeur sur les cartes de résultats (2026-09-21)

Le Lot 141 avait mis les badges de confiance sur la fiche d'annonce, mais l'acheteur **choisit sur les cartes** de la recherche, avant d'ouvrir quoi que ce soit. La carte n'affichait qu'un score opaque (« Confiance vendeur : 72/100 ») et le badge professionnel : ni l'identité vérifiée, ni la réactivité.

**Livré**
- **Sur chaque carte** (recherche, page d'une marque, d'un modèle, d'une wilaya) : « Identité vérifiée » et le badge de réactivité sous forme courte (« Répond en moins de 2 h »), sous le score de confiance. Mêmes règles qu'au Lot 141 : signaux **positifs et vérifiés** seulement, et une carte sans badge **n'ajoute aucune ligne**.
- **Le résumé de confiance porte désormais un drapeau explicite `identityVerified`**, au lieu que la carte le déduise des points du score : une pondération qui changerait l'aurait fait mentir en silence.
- **Une seule requête pour tous les vendeurs d'une page**, au lieu de deux par vendeur (~40 par page de 20 cartes avec la version du Lot 141). La fiche d'annonce en profite aussi.
- **Un cache dédié** (`src/lib/ttl-cache.ts`) qui charge **tous les manquants en une seule lecture**, avec son propre plafond (5 000 vendeurs) : le cache du référentiel existant charge clé par clé et partage ses 500 entrées avec les listes de la recherche et les comparables de prix, que des centaines de vendeurs auraient évincées.
- Réglage `RESPONSIVENESS_CACHE_TTL_MS` (5 minutes par défaut ; 0 désactive), documenté dans `.env.example`.
- La base de charge reçoit ~12 000 **conversations réalistes** (`npm run load:seed`) : vendeurs réactifs, moyens ou quasi muets, plusieurs au-delà du plafond de 200. Elle n'en avait **aucune**, ce qui aurait fait paraître cette mesure gratuite.

**Ce que la mesure a décidé** (100 000 annonces, 600 vendeurs, recherche à 10 visiteurs simultanés, même machine) :

| | p50 | p95 |
|---|---|---|
| Avant le lot | 384 ms | 472 ms |
| Lot 143, **avec** cache | 371 ms | 458 ms |
| Lot 143, **sans** cache | 1 118 ms | **1 491 ms** (budget de 700 dépassé) |

Le cache n'est donc **pas un confort, il est indispensable** : la requête groupée, refaite à chaque page, coûte 19 à 35 ms de base de données (~7 400 conversations lues pour les 20 plus gros vendeurs), et sous charge ces coûts s'additionnent. Avec le cache, la recherche coûte exactement ce qu'elle coûtait avant. Et contrairement au Lot 137, où le budget n'avait pas détecté le retrait d'un cache, **le budget de 700 ms détecte celui-ci**.

**Conséquence assumée** : sur les cartes, un badge peut apparaître ou disparaître avec **jusqu'à 5 minutes de retard**. La fiche d'annonce, la page du vendeur et son tableau de bord lisent toujours **en direct** : le vendeur qui vérifie son propre état le voit tel qu'il est.

**Ce que j'avais faux, et corrigé**
- Ma première requête unique s'est révélée **plus lente en temps réel** que 32 requêtes en parallèle (18,6 contre 12,4 ms) : l'ancienne partait sur plusieurs connexions. J'ai cherché à l'accélérer (fonction fenêtre, jointure latérale, index composite) : **aucune variante ne change grand-chose**, le planificateur ignorant l'index composite à cause de la répartition très inégale des vendeurs. Le levier était le cache, pas la requête. Mon commentaire initial (« 10 à 20 % d'une page de recherche ») était une **affirmation non mesurée** : remplacée par les chiffres ci-dessus.
- Un premier essai de charge sur la fiche d'annonce montrait +26 % (p50 161 → 203 ms). J'ai soupçonné ma requête unique ; **isolée, elle est aussi rapide que l'ancienne** (5,9 contre 6,2 ms pour un gros vendeur, 2,5 contre 0,9 pour un vendeur ordinaire). Trois nouveaux passages : p50 = 168, 188, 168 ms. **C'était du bruit** ; un écart résiduel de 4 à 17 % reste dans la variation entre passages, et je ne peux ni y voir une régression ni prouver qu'il n'y en a aucune.

**Vérification** : `npm run verify -- --e2e` — **1 709 tests unitaires (28 nouveaux)**, 169 de bout en bout (les 4 tests du Lot 141 couvrent maintenant aussi les cartes : français, arabe, page du modèle, identité), **21 en production (+1)**.
- **Équivalence prouvée** (`tests/seller-responsiveness-batch.test.ts`) : la lecture groupée donne **exactement** la réactivité de l'ancienne lecture pour les **600 vendeurs** de la base de charge, plus des cas piégés insérés puis retirés (question ou réponse supprimée, deux répondeurs, hors fenêtre, bords de fenêtre, sans message, plafond dépassé).
- **Le cache prouvé sur le vrai serveur de production** (`e2e-pwa/seller-trust-cache.spec.ts`) : la carte garde son badge quand les réponses disparaissent de la base, alors que la fiche d'annonce, elle, ne l'affiche plus. Le serveur de test de développement désactive le cache pour lire les données en direct.
- **Sabotages : 21 sur 22 détectés** — cache (plafond, durée de vie, LRU, partage des lectures simultanées, résultat périmé après `clear()`, gel des valeurs…), aide de carte, requête SQL (messages supprimés, plafond, partition par vendeur, ordre, pré-filtre de date…) et **2 de bout en bout** (cache contourné ; badges retirés de la recherche). Le seul survivant est **équivalent** : un `LEFT JOIN` laisse passer des conversations sans message, que le code écarte de toute façon.
- Trois trous de **mes propres tests** trouvés par les sabotages, corrigés : l'éviction LRU (un sabotage n'avait même pas été appliqué : Git Bash avait transformé mon `//` en `/`), la demande faite juste après `clear()`, et un sabotage de bout en bout qui ne touchait qu'une des deux cartes de la page de recherche.

**Limites**
- Le cache est **propre à chaque processus** : plusieurs instances se rafraîchissent chacune de leur côté, avec au plus 5 minutes de décalage entre elles.
- Un badge de carte peut être **en retard de 5 minutes** sur la fiche d'annonce du même vendeur.
- Les 12 000 conversations de charge sont **fabriquées** : la répartition réelle des vendeurs de la place de marché sera différente. Les chiffres valent pour cette machine et comparent l'avant et l'après, ils ne garantissent rien pour un serveur de production.
- Les cartes de l'accueil, de la page d'un professionnel et de la page d'un vendeur **n'affichent pas** ces badges : ces pages ont leur propre mise en avant du vendeur, ou n'affichent qu'un seul vendeur.
- Les textes arabes (4 nouveaux libellés courts) sont à faire relire par un locuteur natif.
- L'erreur serveur « stream closed early » sur la fiche d'annonce reste présente dans le journal de la phase de production ; elle est antérieure au Lot 142 (voir ce lot).

## Lot 144 — Guide d'achat général : « Acheter une voiture d'occasion » (2026-09-21)

La rubrique des guides d'achat (Lot 126) avait été livrée **vide**, avec la consigne que l'équipe rédige le contenu. Et un guide ne pouvait exister que rattaché à **un modèle** : sur 410 modèles au catalogue, presque aucun acheteur n'aurait jamais vu un guide. Vous avez choisi un **guide général**, non lié à un modèle.

**Livré**
- **Un guide peut être général** : la marque et le modèle deviennent facultatifs (migration `20260921100000_general_buying_guides`, aucune ligne existante modifiée). Un guide général figure dans l'index `/guides`, s'affiche **sans ligne de véhicule ni lien vers une page de modèle** (avec « Voir toutes les annonces »), figure au plan du site, et n'apparaît sur **aucune** page de modèle.
- **La fiche d'une annonce le propose** quand le modèle de l'annonce n'a pas de guide propre (« Avant d'acheter, lisez notre guide ») ; le guide du modèle passe toujours avant. Un brouillon, un guide programmé ou le guide d'un autre modèle ne sont jamais proposés.
- **Le formulaire d'administration** : le champ « Modèle » devient facultatif (« Aucun : guide général »), avec son aide en français et en arabe. Modifier un guide pour lui retirer son modèle, ou lui en redonner un, remet tout à zéro explicitement.
- **Le guide lui-même** (`src/content/general-buying-guide.ts`), en **français et en arabe**, 9 sections : avant de contacter le vendeur, le premier échange et les signes d'arnaque, les papiers, l'inspection (carrosserie, moteur, pneus, intérieur, selon l'énergie), l'essai routier, le professionnel, la négociation, la conclusion, l'après-achat. Une liste de 12 points « à vérifier » et un conseil. Il cite les fonctions du site telles qu'elles sont (Cote Souq Auto, comparateur, « Identité vérifiée », « Très bonne affaire », « Signaler cette annonce », alertes).
- **`npm run content:guide-general`** crée ce guide **en brouillon**, jamais publié : signé par un administrateur, refuse d'en créer un second, passe par le même schéma de validation que le formulaire. Il est aussi créé en brouillon sur la base de développement, pour que vous le lisiez dans « Administration → Guides d'achat ».

**Ce que j'ai décidé de NE PAS écrire, et pourquoi.** Vous m'avez demandé de ne jamais inventer de contenu, et un guide d'achat touche à des règles que je ne peux pas garantir. Le texte ne cite donc **aucune règle administrative ou juridique algérienne précise** : aucun nom de pièce ou de service, aucun délai, aucun montant, aucun article de loi. Il renvoie à « l'administration compétente », et un avertissement le dit **avant la première section**. Un test le garantit (il échoue si un montant, un pourcentage, un délai chiffré ou un article de loi est ajouté).

**Ce qui doit être relu par des humains AVANT publication** — c'est un brouillon, pas un texte validé :
- **Les démarches administratives** (sections 3 et 8 : acte de vente, changement de titulaire de la carte grise, gage et saisie, contrôle technique). Une personne qui les connaît peut y **ajouter** les précisions qu'elle peut garantir.
- **La version arabe**, par un locuteur natif (elle s'ajoute aux textes arabes déjà en attente).
- **Les conseils techniques** (inspection, essai) : de la connaissance générale d'automobile, vérifiable par un mécanicien, dont je ne garantis pas l'exhaustivité. Je les ai rédigés **sans source**.

**Garanties de la base.** Une contrainte SQL (`BuyingGuide_scope_check`) impose qu'un guide de modèle porte sa marque, et qu'un guide général n'ait ni marque, ni modèle, ni génération. La suppression d'un modèle qui a un guide reste **refusée par la base** grâce à une clé étrangère `RESTRICT` **explicite** : par défaut, une relation devenue facultative se défait en silence (`SET NULL`), et le guide d'un modèle serait devenu un guide général sans que personne l'ait voulu.

**Coût mesuré** : la fiche d'une annonce fait une requête de plus quand son modèle n'a pas de guide — **2,25 ms en médiane (p95 3,35 ms)** sur 300 articles dont 100 guides.

**Vérification** : `npm run verify -- --e2e` — **1 733 tests unitaires (+24), 177 de bout en bout (+8), 21 en production**, build de production compris. Les tests de bout en bout couvrent la création par l'API, par le **vrai formulaire** (sans choisir de modèle) et par le **vrai script** (brouillon, texte identique à celui du dépôt, pas de doublon, refus d'un auteur non administrateur), l'affichage en français et en arabe, la proposition sur les annonces, la conversion d'un guide de modèle en guide général et inversement, et les garanties de la base. Le test du texte garde la **parité français/arabe** (mêmes 9 sections, 6 sous-sections, 56 puces, avertissement et liens), l'**exactitude des libellés cités** (chacun doit être exactement celui de l'interface dans les deux langues, sinon le test échoue quand un libellé change), l'existence des pages vers lesquelles il renvoie, et l'absence de HTML, d'image, de lien externe ou de chiffre juridique.
- **Sabotages : 25 détectés sur 26.** Contenu (16 : parité, libellés altérés, lien externe, image, HTML, titre de niveau 1, montant, délai légal, article de loi, avertissement retiré, lien cassé, treizième point de liste…), repli de la fiche (3 : brouillon proposé, guide d'un autre modèle proposé, repli supprimé), règles de validation (3), base de données (2 : contrainte de cohérence, clé étrangère). Le seul survivant est **équivalent** : conserver une génération sans modèle dans l'écriture en base est impossible par le chemin normal, le schéma le refusant déjà — c'est une seconde protection.

**Ce que les sabotages ont révélé sur mes propres tests** — deux erreurs, corrigées :
- Mon test de la clé étrangère `RESTRICT` **passait même avec la protection retirée** : j'essayais de supprimer la Clio, qui est aussi liée à des annonces, donc la base refusait pour une tout autre raison. Il utilise maintenant un modèle neuf, et exige une erreur de **clé étrangère** précisément (la contrainte de cohérence aurait sinon masqué la différence).
- Une hypothèse fausse sur l'API (`PUT` au lieu de `PATCH`), et une assertion fragile (compter tous les titres de la page), remplacée par des titres précis.

**Limites**
- Le contenu est un **brouillon non validé** : ni relu par un juriste, ni par un locuteur natif, ni par un mécanicien. Il **n'est pas publié**, et ne doit pas l'être avant cette relecture.
- **Un seul guide général** est proposé sur les annonces (le plus récent paru).
- Le guide n'est pas adapté au type de véhicule (moto, utilitaire, camion…) : il parle de **voitures**.
- Un test échoue si un libellé cité change, mais **pas si une fonction citée disparaît** (Cote, comparateur, alertes).
- La qualité pédagogique du texte (clarté, ton, utilité réelle pour un acheteur) n'a été éprouvée par **aucun lecteur réel**.
- Comme aux lots précédents, l'erreur serveur « stream closed early » sur la fiche d'annonce apparaît dans le journal de la phase de production (antérieure au Lot 142, consignée).

## Lot 145 — Aperçu des contenus non publiés, réservé aux administrateurs (2026-09-21)

Un brouillon ou un contenu programmé répond **404 au public** : c'est voulu. Mais l'équipe ne pouvait donc jamais le voir **mis en page** avant de le publier — relire un guide ou un essai dans un formulaire n'est pas le relire tel que le lira le visiteur. Le guide général du Lot 144, créé en brouillon, en a fait la démonstration : il « ne s'affichait pas ».

**Livré**
- **Un administrateur connecté voit un brouillon ou un contenu programmé à son adresse publique**, sous un bandeau ambre « Aperçu réservé à l'équipe » qui dit pourquoi il n'est pas public (brouillon, ou publication programmée à telle date) et mène à « Modifier ». Magazine (`/mag`), essais (`/essais`) et guides (`/guides`), en français et en arabe.
- **Un lien « Aperçu »** dans chaque ligne de brouillon ou de contenu programmé de l'administration (un contenu paru garde « Voir »).

**Ce qui le rend sûr** (`src/lib/article-preview.ts`, une seule règle pour les trois pages)
- **Administrateur seulement** : le droit d'**éditer** ces contenus. Un modérateur, un membre, un professionnel ou un anonyme reçoivent **exactement le même 404** que pour un contenu inexistant — ni le titre, ni le bandeau ne figurent dans la réponse.
- **Le rôle effectif compte** : un administrateur sans double authentification (Lot 138) n'a que les droits d'un particulier, donc ne voit pas l'aperçu. Éprouvé sur le **vrai serveur de production**.
- **Jamais indexé** (`noindex, nofollow`, aucune adresse canonique), **jamais mis en cache public** (`no-store`), **aucune donnée structurée**, et toujours **absent des listes publiques et du plan du site**, même pour l'administrateur qui l'aperçoit.
- **Un contenu déjà paru mais masqué pour une autre raison** (fiche de guide ou d'essai manquante) n'est **jamais** montré en aperçu.
- **Aucun coût pour les visiteurs** : la page d'un contenu paru se sert exactement comme avant, **sans aucun appel d'authentification** ni seconde lecture — un test le garantit. On ne regarde qui est le visiteur que lorsque la page répondrait 404.

**Vérification** : `npm run verify -- --e2e` — **1 744 tests unitaires (+11)**, **196 de bout en bout (+19)**, **22 en production (+1)**, build de production compris.
- **Sabotages : 13 détectés sur 13** — à l'échelle unitaire (aperçu pour tout visiteur, pour tout compte connecté, pour un modérateur, pour un contenu déjà paru, authentification appelée sur le chemin public, contenu paru affublé d'un bandeau, erreur d'authentification transformée en accès), et de bout en bout (droit d'accès ignoré, `noindex` retiré, données structurées publiées, bandeau supprimé, lien « Aperçu » supprimé, et — en **production** — n'importe quel compte connecté).
- Les tests de bout en bout couvrent **3 types de contenu × 2 états (brouillon, programmé) × 4 types de visiteurs (anonyme, membre, modérateur, administrateur) × 2 langues**, et le passage du brouillon à la publication (le bandeau disparaît, le public reçoit 200, les données structurées apparaissent, la page redevient indexable).

**Ce que les sabotages ont révélé sur mes propres tests**
- Les données structurées publiées à tort **n'étaient pas détectées** : pour un brouillon, elles ne sont de toute façon pas produites (pas de date de parution) ; seul un contenu **programmé**, qui a une date, prouve l'exclusion. Le test couvre maintenant les deux états.
- Ma première assertion « le bandeau est absent » échouait pour le mauvais motif : le **texte** du bandeau figure dans le dictionnaire envoyé au navigateur avec **toutes** les pages. Le bandeau porte maintenant un attribut (`data-article-preview`) que les tests cherchent, au lieu de sa phrase.
- Un test du Lot 144 supposait qu'un brouillon répondait 404 « à tout le monde » en utilisant la session de l'administrateur : il distingue maintenant le public de l'administrateur.

**Limites**
- **Seul un administrateur peut aperçevoir.** Un relecteur sans compte administrateur — un juriste pour les démarches, un locuteur natif pour la version arabe du guide — **ne peut pas** ouvrir un brouillon : il faudrait lui donner un compte, ou publier. Un **lien d'aperçu à durée limitée** pour un relecteur externe serait la suite naturelle ; il n'existe pas.
- L'aperçu montre l'état **enregistré**, pas les modifications non enregistrées du formulaire.
- Un modérateur ne peut pas aperçevoir (il ne peut pas non plus éditer ces contenus).
- Le texte arabe du bandeau (4 libellés) est à faire relire par un locuteur natif.

## Lot 146 — Lien de relecture d'un brouillon, pour un relecteur sans compte (2026-09-21)

L'aperçu du Lot 145 est réservé aux administrateurs. Or les personnes qui doivent relire le guide d'achat — un juriste pour les démarches, un locuteur natif pour la version arabe — n'ont pas de compte administrateur. Sans ce lot, la seule façon de les laisser lire un brouillon était de le **publier**, ou de leur donner un compte d'administration.

**Livré**
- **Un lien de relecture** créé depuis la page d'édition d'un contenu non publié (magazine, essais, guides), avec une durée choisie (1, 3, 7, 14 ou 30 jours), en **deux versions** — français et arabe, puisque le relecteur arabophone doit lire la page en arabe. Le relecteur lit le contenu mis en page sous un bandeau « Aperçu de relecture » qui annonce l'échéance du lien, en **lecture seule** : aucun lien « Modifier », aucun accès à l'administration, aucune session.
- **Un écran d'administration** : création, copie (avec un libellé relié à son champ), liste des liens (actif, expiré, révoqué, échéance, **dernière consultation**) et **révocation immédiate**.

**Un lien est un secret : ce qui le protège**
- **Le jeton n'est jamais stocké.** Il est aléatoire (256 bits) ; seule son empreinte (HMAC avec la clé du serveur, comme les codes de secours de la double authentification) est écrite. Une copie de la base ne permet ni de forger un lien ni de retrouver un jeton.
- **Il n'est affiché qu'une fois**, à la création : perdu, on en crée un autre. La liste ne le contient jamais, ni son empreinte.
- **Lié à un seul contenu** : le jeton d'un guide n'ouvre ni un autre guide, ni un essai, ni un article. **Plafonné** à 10 liens actifs par contenu (en révoquer un libère une place).
- **Le même 404** pour un jeton inconnu, mal formé, expiré, révoqué ou d'un autre contenu : rien ne dit pourquoi. Un jeton de forme absurde n'atteint même pas la base.
- **Créer, lister, révoquer : administrateur seulement** (anonyme, membre et modérateur reçoivent 403 sur les trois routes). Trace dans le journal d'audit, **sans le jeton ni son empreinte**.
- **Jamais indexé, jamais mis en cache public, sans données structurées**, comme l'aperçu du Lot 145. Un contenu qui passe à « publié » redevient une page ordinaire (le jeton n'y change rien, sans bandeau) ; un contenu supprimé supprime ses liens. On refuse d'en créer un pour un contenu déjà paru.
- Ouvert par l'ancienne adresse `/mag`, le lien d'un essai ou d'un guide est renvoyé vers sa rubrique **en gardant son jeton**.

**Vérification** : `npm run verify -- --e2e` — **1 774 tests unitaires (+30)**, **210 de bout en bout (+14)**, **22 en production**, build compris ; le test de production ajouté ensuite (voir ci-dessous) a été rejoué seul, et passe.
- **Sur le vrai serveur de production** : un relecteur sans compte lit le brouillon en français et en arabe **sans la moindre violation de la politique de sécurité stricte** (aucun script en ligne, nonce respecté), sans erreur de console, avec les bons en-têtes ; le lien est créé par un administrateur protégé par la double authentification ; un jeton faux ou absent donne 404. **Sabotage vérifié** : un script en ligne injecté dans le bandeau est bloqué par la politique de production et fait échouer le test.
- **Sabotages : 26 détectés sur 27.** Bibliothèque des liens (jeton stocké en clair, recherche par jeton, jeton d'un contenu valable pour un autre, révoqué encore valable, une milliseconde de trop après l'échéance, plafond retiré ou comptant les liens révoqués, durée libre, jeton absurde jusqu'à la base, écriture à chaque affichage, échec du compteur bloquant, jeton de 128 bits, mauvaise finalité d'empreinte, révocation sans vérifier le contenu) et règle d'accès (jeton vérifié pour un autre identifiant, lecture des liens sans jeton), puis **de bout en bout** (droit administrateur ignoré, page qui ignore le jeton, bouton « Modifier » montré au relecteur, jeton perdu au renvoi `/mag`, jeton dans le journal d'audit, lien créé pour un contenu publié, réponse de création cachable, révocation sans vérifier le contenu, empreinte renvoyée par la liste). Le seul survivant est **équivalent** : `reviewPreview` vaut déjà `null` sans lien, donc la condition `link &&` n'est qu'une aide au typage.
- Les tests de bout en bout couvrent **3 types de contenu × 2 langues**, l'isolation entre contenus, la révocation et l'expiration (**à la milliseconde**), la publication et la suppression, le contenu programmé, le secret (base, liste, journal d'audit), les droits (anonyme, membre, modérateur) et la validation (durées, plafond), et l'écran d'administration de bout en bout (création, copie, consultation notée, révocation).

**Ce que les tests ont révélé sur mon propre travail**
- **Un défaut d'accessibilité réel** : dans mon composant, le libellé « Version française » n'était **pas relié** à son champ — un lecteur d'écran n'aurait annoncé qu'un champ sans nom. Corrigé (`htmlFor`).
- Un test de mon cru passait `undefined` à une aide dont la valeur par défaut le transformait en durée valide : le cas « sans durée » est maintenant testé à part.

**Limites**
- **Toute personne qui possède le lien peut lire le contenu** jusqu'à son échéance ou sa révocation, et peut le transférer. Envoyez-le par un canal privé, choisissez la durée la plus courte utile, révoquez-le après la relecture.
- Le jeton figure dans l'adresse : il peut rester dans l'historique du navigateur du relecteur. Les liens externes du contenu portent `noreferrer` (le jeton n'est pas transmis à d'autres sites).
- **Pas de limitation de débit sur les jetons devinés** : à 256 bits, deviner un jeton est infaisable ; une attaque par volume relèverait de l'hébergement.
- L'aperçu montre l'état **enregistré**, pas les modifications non enregistrées du formulaire.
- Le texte arabe de l'écran et du bandeau (32 libellés) est à faire relire par un locuteur natif.

## Lot 147 — Déploiement : Docker, photos en production, sauvegardes (2026-09-22)

Première livraison complète pour la production. `Dockerfile` multi-stage (build → production), `docker-compose.example.yml` et `.dockerignore`. Le service de photos (`src/lib/uploads.ts`) lit depuis `public/uploads/` en dev, depuis le volume Docker `/uploads` en production. Route `/uploads/[...path]` sert les photos avec `Cache-Control: public, max-age=31536000, immutable`. Script `scripts/backup-db.mjs` : dump PostgreSQL daté, rotation des 7 derniers, alerte si la taille est inférieure à 1 Ko. Test `backup-chain.test.ts` rejoue le dump sur une base temporaire et compare les comptes de lignes. Nouvelle bibliothèque `src/lib/uploads-serve.ts` centralisant la résolution du chemin selon l'environnement. Documentation opérationnelle dans `docs/DEPLOIEMENT.md`.

## Lot 148 — Estimation de prix en temps réel à la publication (2026-09-22)

À l'étape 5 du wizard de publication (prix), une fourchette de marché s'affiche en temps réel dès la saisie du montant. `src/lib/price-estimate-action.ts` (Server Action) calcule les 10e et 90e percentiles sur les annonces publiées de même marque/modèle/année/kilométrage. `PriceRangeHint.tsx` affiche « marché : X – Y DA » avec un retour coloré (sous le marché, dans la fourchette, au-dessus) ; neutre si moins de 5 annonces de référence. Tests unitaires sur la logique de fourchette.

## Lot 149 — Simulateur de crédit sur la fiche annonce (2026-09-22)

Un simulateur de crédit intégré sur la fiche annonce permet à l'acheteur d'estimer les mensualités. `src/lib/credit-calculator.ts` (pur, testé) calcule la mensualité par la formule de rente fixe, avec durée (12–84 mois, pas de 6), apport et taux annuel paramétrables. `CreditCalculator.tsx` affiche le résultat en temps réel côté client. Valeurs par défaut : durée 48 mois, apport 20 %, taux 8,5 %.

## Lot 150 — Note vendeur sur les cartes de résultats (2026-09-22)

La note moyenne du vendeur (calculée par `src/lib/seller-review-service.ts`) s'affiche sous le nom du vendeur sur les cartes de résultats de recherche (`ListingCard`), avec le nombre d'avis entre parenthèses. Masquée si le vendeur n'a aucun avis, afin de ne pas pénaliser les vendeurs sans historique.

## Lot 151 — Annonces récemment vues (2026-09-22)

Section « Annonces récemment vues » sur la page d'accueil, alimentée par `localStorage`. `RecentlyViewedTracker` enregistre l'identifiant à chaque visite de fiche annonce (client-side uniquement). `RecentlyViewedSection` charge les annonces correspondantes via fetch côté client et affiche jusqu'aux 6 dernières. Aucun cookie ni appel backend à la visite ; la liste est locale au navigateur.

## Lot 152 — Annonces similaires sur la fiche annonce (2026-09-22)

`src/lib/similar-listings.ts` : requête Prisma cherchant les annonces publiées de même marque et modèle, triées par proximité de prix puis par date, limitées à 4 résultats en excluant l'annonce courante. Affichées en bas de la fiche. Si moins de 2 résultats, la section reste masquée.

## Lot 153 — Message pré-rempli au premier contact vendeur (2026-09-22)

Lorsqu'un acheteur envoie son premier message à propos d'une annonce, le champ est pré-rempli avec une formule de politesse mentionnant le titre de l'annonce (en français ou en arabe selon la locale, via `src/lib/contact-templates.ts`). L'utilisateur peut modifier ou effacer le texte avant l'envoi. Tests sur la génération du gabarit dans les deux langues.

## Lot 154 — Galerie photos avec lightbox (swipe / clavier / zoom) (2026-09-22)

Remplacement de l'affichage statique par une galerie interactive dans `PhotoGallery.tsx` : défilement tactile (swipe), navigation au clavier (← →, Échap), zoom sur clic, affichage plein écran. Accessible : `role="dialog"`, labels ARIA, piège de focus.

## Lot 155 — Coordonnées et catégorie d'activité des comptes pro (2026-09-22)

Migration `20260922100000_pro_category_contacts` : champs `phone`, `website`, `activityCategory` (`CONCESSIONNAIRE | GARAGE | AUTRE`) et `address` sur `ProfessionalAccount`. Formulaire de profil enrichi (`ProProfileForm`). L'annuaire (`/concessionnaires`) filtre par catégorie. La vitrine pro `/pro/[id]` affiche les coordonnées et la catégorie. Tests sur `src/lib/professional-directory.ts`.

## Lot 156 — Horaires structurés avec indicateur ouvert/fermé (2026-09-22)

Migration `20260922110000_pro_horaires_semaine` : champ `horaires` JSON (tableau de 7 jours, chacun avec `open: boolean`, `from/to: string HH:MM`). `src/lib/horaires-semaine.ts` (pur, testé) : `isOpenNow(horaires, now)` calcule si le compte est actuellement ouvert selon l'heure locale algérienne. Composant `StructuredHoursEditor.tsx` pour la saisie. La vitrine pro affiche « Ouvert » / « Fermé » en temps réel.

## Lot 157 — Annonces vendues sur la vitrine pro + compteur de visites (2026-09-22)

Migration `20260922120000_pro_vitrine_views` : compteur `vitrine_views` sur `ProfessionalAccount`, incrémenté à chaque visite de `/pro/[id]`. La vitrine pro affiche les annonces vendues (statut `VENDUE`) dans une section séparée, en lecture seule. Le tableau de bord pro expose le compteur de visites.

## Lot 158 — Filtre « vendeur pro » dans la recherche + encart concessionnaire (2026-09-22)

Nouveau filtre `sellerType` (particulier / professionnel) dans les filtres de recherche (`SearchFilters`, `src/lib/search.ts`, `src/lib/validation/search.ts`). Sur la fiche annonce d'un compte professionnel, un encart affiche le logo, le nom et un lien vers la vitrine du concessionnaire.

## Lot 159 — Filtres rapides sur le stock de la vitrine pro (2026-09-22)

Composant `ProStockFilters.tsx` ajouté sur la vitrine pro : filtres côté client par marque, carburant et transmission, sans rechargement de page. Masqué si le compte pro a moins de 10 annonces publiées.

## Lots 160-163 — Rappel téléphonique, suivi concessionnaire, activité acheteur, tests e2e (2026-09-22)

**Lot 160 — Rappel téléphonique** : migration `20260922173617_lot_160_161_callback_follow` ; un acheteur peut demander un rappel téléphonique sur une fiche annonce (`CallbackRequestButton`, `POST /api/callback-requests`) ; le vendeur gère les demandes dans ses prospects (`CallbackEditor`, `PATCH /api/callback-requests/[id]`).

**Lot 161 — Suivi de concessionnaire** : un utilisateur peut suivre un compte professionnel (`FollowProButton`, `POST /api/pro/[id]/follow`). La vitrine pro affiche le compteur d'abonnés. `src/lib/pro-follow.ts` gère la logique de bascule suivi/désabonnement.

**Lot 162 — Activité acheteur** : page `/compte/activite` regroupant les rappels demandés, les concessionnaires suivis et les offres envoyées.

**Lot 163 — Tests e2e** : `e2e/pro-features.spec.ts` couvre le rappel téléphonique et le suivi de concessionnaire.

## Lots 164-165 — Historique de prix par modèle + CTA avis sur la fiche (2026-09-22)

**Lot 164 — Historique de prix par modèle** : `MonthlyPriceBars.tsx` affiche un histogramme mensuel du prix médian des annonces publiées pour un modèle, via `src/lib/catalogue-stats.ts`. Présent sur `/voitures/[brand]/[model]` et `/vendeur/[id]`.

**Lot 165 — CTA avis sur la fiche annonce** : un appel à l'action « Laisser un avis » apparaît sur la fiche lorsque l'acheteur a déjà eu une conversation avec ce vendeur mais n'a pas encore laissé d'avis.

## Lots 166-168 — Seed historique de prix, pré-modération avis, vérification identité pro uniquement (2026-09-22)

**Lot 166 — Seed historique de prix** : `prisma/seed-price-history.ts` génère 12 mois de prix médians artificiels pour les modèles de démonstration.

**Lot 167 — Pré-modération des avis** : migration `20260922184953_lot_167_review_status` ; statuts `EN_ATTENTE | PUBLIE | REFUSE` sur les avis ; admin `/admin/avis` avec `ModerateReviewButton` et `PATCH /api/admin/reviews/[id]`. Les avis n'apparaissent qu'une fois approuvés.

**Lot 168 — Vérification d'identité réservée aux comptes pro** : la route de demande de vérification d'identité est désormais réservée aux comptes professionnels ; `src/lib/seller-trust.ts` tient compte de cette restriction.

## Lot 169 — Compléter le magazine (2026-09-22)

Ajout du flux RSS `/mag/feed.xml` et alignement du flux `/guides/feed.xml`. Script de seed `prisma/seed-mag-articles.ts` pour les articles de démonstration. Corrections de rendu dans `/mag/[slug]` et `/mag`. Harmonisation de `BlogArticleForm` et de `src/lib/validation/blog.ts`.

## Lot 170 — Système d'offres de prix et négociation (2026-09-23)

Fonctionnalité complète de négociation de prix entre acheteur et vendeur, livrée en plusieurs passes.

**Socle** : migration `20260923000000_lot_170_offers` ; modèle `PriceOffer` avec états `EN_ATTENTE | ACCEPTEE | REFUSEE | CONTREOFFRE | ANNULEE | EXPIREE`. `MakeOfferButton` (`POST /api/listings/[id]/offers`), `RespondOfferButtons` (`PATCH /api/offers/[id]`). Page `/compte/offres` pour les deux parties.

**Améliorations** : clôture automatique des offres concurrentes à l'acceptation, revalidation de la fiche, pré-vérification d'éligibilité (annonce encore publiée, pas d'offre active du même acheteur).

**Négociation complète** : migration `20260923000001_lot_170b_offer_improvements` ; contre-offre modifiable (`EditOfferButton`), réponse à une contre-offre (`RespondCounterButtons`). Acceptation d'une offre passe automatiquement l'annonce en `VENDUE`.

**Accessibilité** : augmentation de la taille de police de base en arabe (`globals.css`) pour améliorer la lisibilité RTL.

**Corrections e2e** : harmonisation de la configuration Playwright, correction des 3 tests e2e cassés par les nouvelles interactions.

## Identité visuelle et application Android (2026-09-24)

**Application Android (Capacitor)** : projet Android natif (`android/`) configuré pour le Play Store. `ANDROID.md` documente les étapes de build. Script `scripts/generate-android-icons.mjs` génère les icônes dans toutes les résolutions Android depuis le SVG source.

**Logo et identité visuelle** : refonte en trois passes — monogramme « S » avec police Bebas Neue, couleur split orange/bleu, décliné en `SiteLogoMark.tsx` (icône) et `SiteWordMark.tsx` (wordmark « SOUQAUTO »). Icônes Android mises à jour. Couleurs des anneaux synchronisées entre les composants.

## Lots 171-174 — WhatsApp opt-out, statistiques de marché, VT/assurance, accessoires (2026-09-25)

**Lot 171 — WhatsApp opt-out** : migration `20260925000000_whatsapp_opt_out` ; champ `whatsappOptOut: boolean` sur `User`. Un utilisateur peut désactiver le bouton WhatsApp depuis ses paramètres. `ContactButtons.tsx` respecte ce flag.

**Lot 172 — Statistiques de marché** : `MarketStatsWidget.tsx` sur la page d'accueil — annonces publiées, prix médian, délai médian de vente — via `src/lib/catalogue-stats.ts`.

**Lot 173 — Champs VT et assurance** : migration `20260925100000_listing_vt_assurance` ; `vtDate` et `assuranceDate` sur `Listing`. Affichés sur la fiche annonce et dans le wizard étape 9.

**Lot 174 — Accessoires** : migration `20260925110000_equipment_accessoire` ; nouvelle catégorie `ACCESSOIRE` dans `EquipmentCategory`. Seed mis à jour. Wizard étape 11 adapté.

## Lots 177-178 — Mode sombre, puissance fiscale, carrosserie, négociable, autocomplete, statistiques (2026-09-25)

**Lot 177 — Mode sombre** : infrastructure dark mode via `ThemeApplicator.tsx` (injecte la classe `dark` depuis un cookie côté serveur), `ThemeToggle.tsx` (bascule client), `ThemeProvider.tsx` (contexte React). Classes `dark:` ajoutées sur `SiteHeader`, `SiteFooter`, `ListingCard`, `SearchFilters`.

**Lot 178 — Puissance fiscale, carrosserie, négociable, autocomplete, statistiques, renouvellement** : migrations `20260925120000_listing_fiscal_power` et `20260925130000_listing_body_type_negotiable` ; champs `fiscalPower` (int, CV), `bodyType` (enum BERLINE/SUV/BREAK/COUPE/CABRIOLET/MONOSPACE/UTILITAIRE/AUTRE) et `negotiable` (boolean). Autocomplete sur la barre de recherche par suggestions. Page de statistiques vendeur enrichie. Filtres de recherche enrichis.

## Lot 179 — Mode sombre complet — couverture totale de l'application (2026-09-25)

Passage en revue systématique de l'intégralité de l'application pour ajouter les classes `dark:` manquantes : 19 pages admin, espace compte, pages publiques, plus de 80 composants. `ArticleBody.tsx` inclus.

## Lot 180 — Corrections RTL — flèches directionnelles inversées en arabe (2026-09-25)

Les chevrons de navigation (pagination, wizard, fil d'Ariane, graphiques) étaient inversés en arabe. Correction par `rtl:rotate-180` ou classes `ltr:` / `rtl:` selon la direction. Affecte `Pagination`, `StepShell`, `MarketStatsWidget`, la fiche annonce et le journal d'audit.

## Lot 181 — Corrections ESLint (2026-09-25)

Corrections des erreurs ESLint restantes : `react-hooks/exhaustive-deps` dans `PhotoGallery` (dépendances d'effet manquantes), `no-unused-expressions` dans `ThemeToggle` et `ThemeProvider`, `react-hooks/rules-of-hooks` dans `SearchFilters` (hook conditionnel extrait). `PriceRangeHint` et `RecentlyViewedSection` également corrigés.

## Lot 182 — Corrections Lighthouse — accessibilité 100/100 sur accueil et recherche (2026-09-25)

Corrections ciblées : `aria-label` sur les boutons d'icône du header, rapport de contraste du logo, `role` sur les éléments interactifs de `Pagination` et `SearchFilters`.

## Lots 183-184 — Métadonnées SEO + corrections accessibilité Lighthouse (2026-09-26)

**Lot 183 — Métadonnées SEO** : balises `<title>`, `<meta name="description">` et `<meta name="robots">` ajoutées sur toutes les pages statiques manquantes (mentions légales, CGU, politique de confidentialité, connexion, inscription, comparateur, cote). Composant `SellerTrustBadges.tsx` extrait.

**Lot 184 — Corrections accessibilité Lighthouse** : `alt` descriptif sur le logo, correction du contraste sur les boutons de signalement, `aria-label` sur le calculateur de crédit.

## Lot 185 — Lien « Voir tout » sur la section revue de presse de la page modèle (2026-09-26)

Lien « Voir tous les essais de ce modèle » sur `/voitures/[brand]/[model]` lorsque la section revue de presse contient plus de 3 résultats. Pointe vers `/essais/revue-de-presse?modelId=…`.

## Lot 186 — Accessibilité ARIA — `role=alert`/`status` sur tous les formulaires (2026-09-26)

Audit systématique de tous les composants de formulaire et d'action : les messages d'erreur utilisent `role="alert"` (interruption immédiate) et les confirmations `role="status"` (non-bloquant). Couvre plus de 40 composants, des formulaires auth aux boutons admin.

## Lot 187 — Qualité — `autocomplete` sur les champs d'authentification et de profil (2026-09-26)

Attributs `autocomplete` appropriés sur tous les champs de formulaire d'authentification et de profil (`LoginForm`, `RegisterForm`, `EmailChangeForm`, `EditProfileForm`, `ProProfileForm`, `ProCollaboratorsManager`, `CallbackRequestButton`). Attribut `rel="noopener noreferrer"` sur tous les liens externes manquants dans les pages admin.

## Lot 188 — Qualité UX — `inputMode=numeric` + squelettes `loading.tsx` (2026-09-26)

Attribut `inputMode="numeric"` sur tous les champs numériques (prix, kilométrage, année, montant de crédit, offre de prix) pour afficher le clavier numérique sur mobile. Squelettes `loading.tsx` ajoutés sur les pages à fort temps de chargement : fiche annonce, mes-annonces, messages, tableau de bord, recherche.

## Lot 189 — Qualité UX — `loading.tsx` sur 10 pages + i18n `ThemeToggle`/`PhotoGallery` (2026-09-26)

Extension des squelettes de chargement à 10 pages supplémentaires : concessionnaires, magazine (index et article), vitrine pro, prospects, statistiques pro, tableau de bord pro, profil vendeur, pages de modèle et de marque. Traduction des libellés d'accessibilité de `ThemeToggle` et `PhotoGallery` dans les deux langues.

## Lot 190 — SMS Twilio — remplace le stub par l'API REST Twilio (2026-09-26)

`src/lib/sms.ts` : le stub est remplacé par un appel à l'API REST Twilio. Variables requises : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`. En leur absence, retour gracieux au log de développement. Documenté dans `.env.example`.

## Lot 191 — Qualité — unités ch/CV, landmarks de navigation, sitemap (2026-09-26)

Traduction des unités de puissance : « ch » en français, « حصان » en arabe, sur la fiche annonce. `role="nav"` / `aria-label` ajoutés sur le menu mobile (`MobileMenuToggle`) et le pied de page (`SiteFooter`) pour les landmarks. Correction du sitemap (ajout de `/contact`).

## Lot 192 — Accessibilité — suppression du `<main>` imbriqué dans `/compte/offres` (2026-09-26)

La page `/compte/offres` avait un `<main>` imbriqué dans le `<main>` du layout. Corrigé en remplaçant l'élément interne par un `<div>`.

## Lot 193 — Page `/contact` — formulaire + API + i18n FR/AR (2026-09-26)

Page de contact complète : `ContactForm` (nom, email, sujet, message), validation Zod (`src/lib/validation/contact.ts`), route `POST /api/contact` envoyant un email à l'adresse admin. Localisée en français et en arabe. Lien dans le pied de page et dans le sitemap.

## Lot 194 — Accessibilité — `error.tsx`, `<time>`, focus traps, rôles dialog (2026-09-26)

`error.tsx` pour la locale avec bouton « Réessayer » accessible (`role="alert"`). Balises `<time dateTime="…">` sur toutes les dates de la fiche annonce et du magazine. Piège de focus dans la lightbox `PhotoGallery`. `role="dialog"` avec `aria-modal` sur les modales d'offre (`MakeOfferButton`) et de carte essai (`RoadTestCard`).

## Lot 195 — Accessibilité — `aria-live`, `<article>`, `<time>`, statut du wizard (2026-09-26)

`role="article"` sur les cartes `GuideCard`, `PressReviewCard`, `RoadTestCard`. `<time>` sur leurs dates. `aria-live="polite"` sur la zone de résultats de la recherche. Annonce du numéro d'étape courant dans le wizard (`StepShell`). `CallbackRequestButton` : le dialogue de confirmation utilise `role="dialog"`.

## Lot 196 — Accessibilité — `aria-current`, `aria-describedby`, `alt` décoratif, `rel="noopener"` (2026-09-26)

`NavLink.tsx` : `aria-current="page"` sur le lien actif. `SiteHeader.tsx` : `aria-label` sur le logo-lien. `ListingEditForm.tsx` et `ContactForm.tsx` : `aria-describedby` reliant les champs à leur aide contextuelle. Images décoratives avec `alt=""` dans `AdminBlogList`. Liens externes : `rel="noopener noreferrer"`.

## Lot 197 — Sécurité — rate limiting sur 5 routes non protégées (2026-09-26)

Cinq routes exposées sans limite de débit en reçoivent une : confirmation de téléphone (`/api/auth/verify-phone/confirm`), demande de rappel (`/api/callback-requests`), flux SSE de messages (`/api/conversations/[id]/stream`), réponse à une offre (`/api/offers/[id]`), blocage utilisateur (`/api/users/[id]/block`). Limites calquées sur les routes similaires existantes.

## Lot 198 — PWA et perf — AVIF, icône maskable 192 px, apple-touch-icon, preconnect S3 (2026-09-26)

`next.config.mjs` : ajout du format `avif` dans `images.formats`. `manifest.ts` : icône maskable 192 px (`purpose: "maskable"`) et `apple-touch-icon` dans le layout. `<link rel="preconnect">` vers l'origine S3 ajouté dans le layout.

## Lot 199 — Tests — validation des offres, confirmation téléphonique, demandes de rappel (2026-09-26)

Trois nouveaux fichiers Vitest : `offer-validation.test.ts` (schéma Zod de l'offre, montants limites, états de transition), `verify-phone-confirm.test.ts` (codes corrects/incorrects/expirés, débit), `callback-request.test.ts` (création, mise à jour, droits d'accès).

## Lot 200 — Tests routes offres/blocage, `lang=fr` marques, `Image` comparateur (2026-09-27)

`offer-route.test.ts` et `user-block.test.ts` : tests d'intégration des routes HTTP. Remplacement des `<img>` par `next/image` dans le comparateur. Attribut `lang="fr"` / `lang="ar"` ajouté sur les pages de marque. Ajout de `npm-check-updates` comme dépendance de dev.

## Lot 201 — Correctifs des tests préexistants (2026-09-27)

Lot de maintenance : `deployment-artifacts.test.ts` mis à jour pour les nouveaux fichiers de déploiement, `search.test.ts` adapté aux nouveaux filtres. `manifest.ts` : correction du champ `lang` manquant. Clés i18n manquantes ajoutées dans `fr.json` et `ar.json`. Correction mineure du schéma de validation blog.

## Lots 202-204 — Sécurité, accessibilité `lang`, ARIA/alt/i18n (2026-09-27)

**Lot 202 — Sécurité** : vérification CSRF sur `/api/listings/compare` ; correction d'une fuite d'information dans `/api/search/suggest` (annonces non publiées masquées).

**Lot 203 — Attribut `lang`** : pages `/voitures`, `/voitures/[brand]`, `/voitures/[brand]/[model]`, `/compte/activite` et `/compte/favoris` reçoivent l'attribut `lang` correct selon la locale. Correction de `MakeOfferButton` (`aria-modal` manquant).

**Lot 204 — ARIA/alt/i18n** : `alt` descriptif sur les images de `/essais/[slug]` et `/voitures/[brand]/[model]`. `aria-label` sur les fils d'Ariane (`Breadcrumbs`). Libellés i18n manquants ajoutés. Correctif `AiAdvisorChat` : bouton d'envoi labelisé.

## Lots 205-209 — SEO, perf, tests routes/libs/sweepers, `error`+`loading` boundaries (2026-09-27)

**Lot 205 — SEO blog/essais/guides** : balises canoniques, `revalidate`, `generateMetadata` enrichis. `structured-data.ts` : `buildReviewJsonLd` corrigé (champ `image` conditionnel). Sitemap : `revalidate = 3600` pour les articles.

**Lot 206 — Tests routes admin** : `admin-user-role.test.ts` (promotion/dégradation de rôle), `listing-access.test.ts` (droits selon le rôle).

**Lot 207 — Tests sweepers** : `listing-expiry-sweep.test.ts`, `listing-expiry-reminder-sweep.test.ts`, `listing-auto-renew-sweep.test.ts`.

**Lot 208 — Tests libs** : `listing-update-price.test.ts`, `pro-access.test.ts`, `pro-collaborators.test.ts`, `pro-follow.test.ts`, `two-factor-routes.test.ts`, `verify-email-request.test.ts`, `verify-phone-request.test.ts`.

**Lot 209 — Frontières `error` et `loading`** : `error.tsx` dans les sections admin, annonce, compte et pro. `loading.tsx` dans les sections compte/alertes, compte/assistant-achat, compte/favoris, compte/offres, compte/profil, compte/securite, compte/activite. Mailer : gestion gracieuse du cas sans SMTP.

## Lots 210-214 — Perf page d'accueil, enrichissement, tests manquants, sweeper throttle, SEO wilaya (2026-09-27)

**Lot 210 — Perf page d'accueil** : requête des annonces « à la une » limitée à 8 avec les champs stricts nécessaires. Suppression du doublon d'agrégats.

**Lot 211 — Enrichissement fiche annonce** : affichage conditionnel de `vtDate`, `assuranceDate`, `negotiable`, `fiscalPower`, `bodyType`. Structured data `Vehicle` enrichie.

**Lot 212 — Tests manquants** : `seller-review-service.test.ts`, `similar-listings.test.ts`, `sms.test.ts`.

**Lot 213 — Sweeper throttle** : `src/lib/sweeper-throttle.ts` — garde-fou pour les sweepers déclenchés à la visite : un même sweeper ne peut s'exécuter plus d'une fois toutes les 30 secondes (clé en mémoire). Test `sweeper-throttle.test.ts`.

**Lot 214 — SEO wilaya** : `generateMetadata`, `BreadcrumbList` JSON-LD et canonical sur `/wilaya/[wilaya]`.

## Lots 215-219 — Sweeper recherche, SEO catalogue, tests alertes, messages noindex, N+1 fix (2026-09-27)

**Lot 215 — Sweeper sur la page de recherche** : `/recherche` déclenche les sweepers via `throttledSweep`.

**Lot 216 — SEO catalogue** : `buildBreadcrumbJsonLd` sur les pages de marque et de modèle.

**Lot 217 — Tests alertes de recherche** : `search-alerts.test.ts`.

**Lot 218 — Messages noindex** : les pages de messagerie reçoivent `noindex, nofollow`.

**Lot 219 — N+1 fix page modèle** : inclusion des photos dans la requête principale de la section « Annonces de ce modèle » sur `/voitures/[brand]/[model]`.

## Lots 220-224 — `generateStaticParams` blog/essais, tests JSON-LD, `revalidate` index (2026-09-27)

**Lot 220 — `generateStaticParams` essais** : `/essais/[slug]` prépare les slugs publiés au build. ISR `revalidate = 3600`.

**Lot 221 — `generateStaticParams` magazine** : idem pour `/mag/[slug]`.

**Lot 222 — `revalidate` sur les index** : `/voitures` et `/wilaya` passent de `force-dynamic` à `revalidate = 3600`.

**Lot 223 — Tests JSON-LD** : `structured-data.test.ts` — 8 fonctions de `src/lib/structured-data.ts` testées unitairement.

**Lot 224 — Tests `generateStaticParams` catalogue** : `catalogue-static-params.test.ts` vérifie l'exclusion des brouillons.

## Migration 225 — Suppression des index GIN `pg_trgm` (2026-09-27)

Migration `20260927120000_drop_trgm_indexes` supprimant les index `GIN` basés sur `pg_trgm`, qui provoquaient l'erreur `58P01` sur Windows (extension absente par défaut). ~~La recherche s'appuie désormais sur les index `@@` natifs de PostgreSQL.~~ *(Correction, audit 2026-10-08 : cette phrase était fausse — aucun index plein-texte n'existait, la recherche par mot lisait toute la table. Rétabli de façon conditionnelle au Lot 265.)*

## Lot 226 — Vrais 404, contraste logo, spec de recherche e2e (2026-09-27)

Les `loading.tsx` sur les pages de détail (fiche annonce, article magazine, vitrine pro, profil vendeur, pages de catalogue) masquaient les vrais 404 : Next.js affichait le squelette puis une erreur silencieuse. Suppression des `loading.tsx` concernés. Correction du contraste du logo en dark mode (`SiteWordMark`). Ajout de `e2e/search.spec.ts` : parcours de recherche de bout en bout.

## Lot 227 — Cache des agrégats catalogue, contraste étape 4 (2026-09-27)

`src/lib/catalogue-stats.ts` : les comptages d'annonces par marque, modèle et wilaya sont mis en cache en base (table `CatalogueStatsCache`, TTL 1 heure). Test `catalogue-stats-cache.test.ts`. Pages magazine, essais et guides passent à `revalidate = 3600`. Correction du contraste de texte sur l'étape 4 du wizard. `playwright.config.ts` : port 5184 ajouté dans `baseURL`.

## Lot 228 — `noindex` de l'espace privé par layout, traduction SUV, bandeau formulaire (2026-09-27)

Layouts `admin/layout.tsx`, `compte/layout.tsx` et `pro/(prive)/layout.tsx` : `robots: { index: false, follow: false }` dans `generateMetadata`. Toutes les pages de ces espaces héritent du `noindex` automatiquement. Traduction manquante de « SUV » en arabe. Bandeau d'information ajouté en haut du wizard de publication pour rappeler les règles de modération.

## Lot 229 — Révocation des sessions à la déconnexion, mot de passe requis pour e-mail et 2FA (2026-09-27)

`src/lib/auth-server/session-revocation.ts` : la déconnexion révoque toutes les sessions actives du compte. Le jeton est invalidé en base ; `getCurrentUser` vérifie la révocation à chaque requête.

Confirmation du mot de passe actuel désormais obligatoire avant de modifier l'adresse e-mail ou d'activer/désactiver la double authentification TOTP. Protège contre la prise de contrôle partielle d'une session non verrouillée.

Tests : `session-revocation.test.ts`, `current-user-revocation.test.ts`, `email-change-emails.test.ts`, `two-factor-service.test.ts`, `two-factor-routes.test.ts`.

## Lot 230 — Volume Docker des pièces d'identité, `global-error.tsx` (2026-09-27)

Les fichiers de pièces d'identité chiffrés n'étaient pas montés dans `docker-compose.example.yml` : un redémarrage du conteneur les effaçait. Ajout du volume `identity-docs:/app/public/identity-docs`. Documentation mise à jour dans `docs/DEPLOIEMENT.md`. `src/app/global-error.tsx` : gestionnaire d'erreur racine de Next.js pour les erreurs en dehors des layouts de locale.

## Lot 231 — `hreflang` FR/AR sur les pages, métadonnées du comparateur, `/vendre` hors sitemap (2026-09-27)

`src/lib/seo-alternates.ts` : helper `buildAlternates(pathname)` générant les balises `<link rel="alternate" hreflang="fr|ar">`. Appliqué sur toutes les pages publiques (annonce, accueil, recherche, catalogue, wilaya, mag, essais, guides, pro, conditions, etc.). Test `seo-alternates.test.ts`. Page comparateur : `generateMetadata` ajouté. Page `/vendre` retirée du sitemap.

## Lot 232 — Plafond de taille à l'import CSV, formules neutralisées à l'export (2026-09-27)

`src/lib/csv.ts` : l'import CSV est limité à 500 lignes et 2 Mo. Côté export, les formules Excel (`=`, `+`, `-`, `@`) sont préfixées par une apostrophe (CSV injection neutralisée). Tests `csv.test.ts`.

## Lot 233 — Sauvegardes Docker, crontab, nginx `client_max_body_size`, `launch:check` sans `.env` (2026-09-28)

`docker-compose.example.yml` : service de sauvegarde dans le compose. `ops/crontab.example` : sauvegarde quotidienne à 03:00 et rotation hebdomadaire. `docs/DEPLOIEMENT.md` : nginx avec `client_max_body_size 10m`. `scripts/launch-check.ts` : peut fonctionner sans fichier `.env` en lisant les variables du processus. Tests `pg-helpers-load-env.test.ts` et `deployment-artifacts.test.ts` mis à jour.

## Lot 234 — Accessibilité wizard, ESLint, focus ring, traduction placeholder (2026-09-28)

`aria-required` sur tous les champs obligatoires du wizard de publication (étapes 2, 3, 4, 5, 6, 7, 8, 11). `StepShell` : `focus-visible:ring` sur les boutons de navigation. Corrections ESLint dans `EditOfferButton`, `RespondOfferButtons`, `PhotoGallery`. Traduction du placeholder « Rechercher… » en arabe dans le header.

## Lot 235 — Helper `formatPrice`/`formatNumber`, `aria-live` messagerie (2026-09-28)

`src/lib/format.ts` : helpers `formatNumber(n, locale)` et `formatPrice(n, locale)` centralisant le formatage des nombres (séparateurs DZ) et des prix (suffixe DA). Appliqués sur toutes les pages affichant des prix ou des kilométrages (annonce, mes-annonces, alertes, favoris, comparateur, wizard, wilaya, voitures, pro, etc.). `ConversationView.tsx` : région `aria-live="polite"` autour des nouveaux messages pour les lecteurs d'écran.

## Lot 236 — Bandeau PWA de mise à jour, cron de balayage des annonces (2026-09-28)

`PwaUpdateBanner.tsx` : détecte l'événement `controllerchange` du service worker (nouveau SW activé) et affiche un bandeau invitant à recharger la page. Route `POST /api/cron/sweep` protégée par `Authorization: Bearer CRON_SECRET` : appelle les trois sweepers en séquence. `scripts/cron-sweep.mjs` appelle la route via `fetch` depuis les variables d'environnement. Script npm `cron:sweep`. Ligne cron dans `ops/crontab.example` (04:00 quotidien). Documentation `.env.example`.

## Lot 237 — `CRON_SECRET` vérifié par `launch:check` (2026-09-28)

`src/lib/launch-checks.ts` : ajout de `checkCronSweep(env)` — avertissement non bloquant si `CRON_SECRET` est absent ou correspond au placeholder. Intégré dans `evaluateLaunchReadiness`. Tests `launch-checks.test.ts` mis à jour.

## Lot 238 — Tests route `/api/cron/sweep` et crontab (2026-10-01)

`tests/cron-sweep-route.test.ts` : 6 tests sur la route POST — secret absent (500), mauvais secret (401), bon secret (200 + `{ ok, sweptAt }`), appels effectifs aux 3 sweepers. `tests/deployment-artifacts.test.ts` mis à jour (compteur `crontab.example` 3 → 4, assertion `cron:sweep`).

## Lot 239 — Tests routes HTTP admin de modération (2026-10-01)

Trois nouveaux fichiers de tests pour les routes de modération admin : `admin-moderate-listing-route.test.ts` (11 tests : 403, 400, 404, transitions approve/reject/suspend, conflit concurrent, journal d'audit), `admin-moderate-owner-review-route.test.ts` (9 tests : statuts `PUBLIE`/`REFUSE`, 409 sur conflit), `admin-resolve-report-route.test.ts` (15 tests : résolution/rejet, suspension automatique de l'annonce, suspension automatique de l'utilisateur protégée si staff, retrait de l'avis propriétaire sur signalement confirmé).

## Lot 240 — Throttle sweepers sur `mes-annonces`, doc `CREATEDB`, guide migration `RoadTest` (2026-10-02)

`/compte/mes-annonces/page.tsx` : les trois sweepers étaient appelés séquentiellement sans `throttledSweep`, contrairement à `/annonce/[id]` et `/recherche`. Corrigé par `Promise.all([throttledSweep(…), …])`. Section « Dépannage » dans `README.md` : `ALTER ROLE souq_auto CREATEDB;` explique pourquoi les 6 tests `backup-chain` échouent sur une installation existante. Commentaire enrichi sur `RoadTest` dans `prisma/schema.prisma` : chemin de migration vers `RoadTestPoint { kind, locale, text }` si le besoin de filtrer ces champs se présente.

## Lot 241 — Centre de notifications in-app (2026-10-04)

Nouveau modèle `UserNotification` (enum `NotificationKind` × 10 événements, champ `data` JSON, `readAt`, TTL 30 jours via sweeper). Migration `20261004100000_lot_241_notifications` appliquée manuellement.

Service `notification-service.ts` : `createNotification` / `getNotifications` / `getUnreadCount` / `markAllRead` / `markRead` (aucune exception propagée — ne bloque jamais l'action principale). Sweeper `sweepOldNotifications` intégré dans le cron nightly (4 sweepers désormais). API : `GET /api/notifications` (liste + badge count), `PATCH /api/notifications/read-all`. Page `/compte/notifications` : fond bleu pâle sur les non-lues, affichage en temps relatif FR/AR, bouton « Tout marquer comme lu ». `SiteHeader` : badge rouge `unreadNotificationsCount` (même pattern que Messages). Layout `/[locale]` : fetch parallèle des deux badges.

Déclencheurs (en parallèle de l'e-mail/push existant) : modération annonce (`LISTING_APPROVED` / `REJECTED` / `SUSPENDED`), nouveau message (`NEW_MESSAGE`), offre reçue (`OFFER_RECEIVED`), réponse à une offre (`OFFER_ACCEPTED` / `DECLINED` / `COUNTERED`), correspondance alerte de recherche (`SEARCH_ALERT_MATCH`), annonce d'un professionnel suivi (`PRO_FOLLOWER_LISTING`). Tests : `notification-service.test.ts` (8 tests), `cron-sweep-route.test.ts` mis à jour (4 sweepers).

## Lot 242 — Nouveau logo losange teal (2026-10-04)

`SiteLogoMark` : carré arrondi remplacé par un losange dégradé (`#0BBFB0` → `#0891B2`), lettre S en Georgia blanc. `SiteWordMark` : « SOUQ » en `slate-800`/`slate-100`, « AUTO » en `cyan-600`/`teal-400`. `SiteHeader` : taille du logo portée de `h-7/text-lg` à `h-11/text-2xl`. `icon.svg` (favicon) mis à jour avec le même losange teal.

## Lot 243 — Historique de connexion (2026-10-04)

Nouveau modèle `LoginEvent` (IP, user-agent, méthode, succès, TTL 90 jours). Migration `20261004120000_lot_243_login_events` appliquée. `login-event-service.ts` : `recordLoginEvent` (jamais d'exception), `getLoginHistory` avec parsing navigateur/OS. `login-event-sweep.ts` : `sweepOldLoginEvents`, 5e sweeper dans le cron. Hooks `after()` dans les trois routes d'authentification : login (succès et échec), `google/callback`, `two-factor/verify`. Page `/compte/securite` : section « Historique de connexion » sous le panneau 2FA. i18n FR/AR (`LoginHistory.*`). 7 nouveaux tests + `cron-sweep-route.test.ts` mis à jour.

## Lot 244 — Export RGPD complet + suppression ThemeProvider orphelin (2026-10-04)

`api/profile/export/route.ts` : ajout des alertes de recherche, offres émises/reçues, notifications in-app et historique de connexion dans l'archive d'export. Toutes les données personnelles sont désormais incluses (RGPD art. 15/20). Suppression de `src/components/ThemeProvider.tsx`, orphelin depuis le Lot 177 (remplacé par `ThemeApplicator`).

## Lot 245 — Rôle SUPPORT (2026-10-04)

Nouvel élément `SUPPORT` dans l'enum `Role` (entre `MODERATEUR` et `ADMIN`). Migration SQL (`ALTER TYPE "Role" ADD VALUE 'SUPPORT'`). `roles.ts` : `isStaff()` étendu à `SUPPORT` ; nouvelles fonctions `isModerator()` (`ADMIN|MODERATEUR`) et `isSupport()`. `staff-two-factor.ts` : `isStaffRole()` étendu à `SUPPORT` (2FA obligatoire). Admin layout : liens utilisateurs, pro, statistiques, audience, paramètres et journal masqués pour `SUPPORT` (accès `isModerator` requis) ; guards sur les routes directes correspondantes. API `admin/users/[id]/role` et `RoleSelect` : option Support. i18n FR/AR : `roleOptionSupport`. Tests : 3 nouveaux cas dans `staff-two-factor.test.ts` (13/13).

Périmètre SUPPORT : annonces, signalements, avis propriétaires, vérification d'identité. Hors périmètre : utilisateurs, comptes pro, statistiques, audience, paramètres, journal, paiements, éditorial.

## Lot 246 — Anti-fraude V3 — score persistant + analyse IA (2026-10-04)

Nouveaux champs `fraudScore`, `fraudCheckedAt`, `aiSuspicion`, `aiCheckedAt` sur `Listing`. Migration `20261004160000_lot_246_fraud_score`. `fraud-signals.ts` : `computeFraudScore()` avec pondération `FRAUD_SIGNAL_WEIGHTS` (5 signaux). `refreshListingFraudScore()` persisté via `after()` à chaque soumission d'annonce. `fraud-ai.ts` : `analyzeListingForFraud()` via Claude API (repli silencieux si clé absente). File de modération admin triée par `fraudScore DESC` ; badge rouge/ambre + note IA sur chaque ligne. 40 tests (31 → 40), `tsc` propre.

## Lot 247 — Analyse photo IA — tags watermark/catalogue par Claude Vision (2026-10-04)

Nouveau champ `ListingPhoto.aiTags` (JSON). Migration `20261004170000_lot_247_photo_ai_tags`. `photo-ai.ts` : `analyzePhoto()` redimensionne à 400 px via `sharp` puis appelle Claude Vision ; parse le JSON retourné (`subject`, `hasWatermark`, `isProfessionalStock`, `note`) avec validation et troncature. `anthropic-client.ts` : ajout de `callAnthropicVision` (multimodal base64). `api/listings/route.ts` : `analyzeListingPhotos()` lancé dans `after()` après chaque soumission. Page admin annonces : badges ⚠ filigrane / ⚠ catalogue si tags IA présents. i18n FR/AR : `photoAiWatermark`, `photoAiProfessionalStock`. 9 tests Vitest (mock `sharp` + mock `callAnthropicVision`) — 9/9 verts.

## Lot 248 — Suggestion de prix IA — fallback Claude quand comparables insuffisants (2026-10-04)

`price-ai.ts` : `estimatePriceWithAi()` interroge Claude (marque, modèle, année, kilométrage, état, carburant) et retourne `{low, high}` en DA. `computeAndStorePriceAiEstimate()` n'appelle l'IA que si les comparables en base sont < 3, évitant les appels inutiles quand le marché est déjà documenté. `price-estimate-action.ts` : fallback IA intégré ; nouveau champ `source: "market" | "ai"` dans `PriceEstimateResponse`. `PriceRangeHint.tsx` : affiche « Estimation IA du prix / Aucune annonce comparable » quand `source === "ai"` ; passe `condition` + `fuelType` à l'action serveur. `api/listings/route.ts` : `computeAndStorePriceAiEstimate()` dans `after()`. Schema + migration `20261004180000` : `priceAiLow`, `priceAiHigh`, `priceAiAt`. Page admin : fourchette IA visible dans la file de modération. i18n FR/AR : `priceEstimateAiTitle`, `priceEstimateAiNote`, `priceAiRange`.

## Lot 249 — Description assistée — amélioration du texte vendeur via Claude (2026-10-04)

`ai-listing.ts` : `improveListingText()` corrige les fautes, améliore la clarté et la structure sans inventer de caractéristiques ; repli silencieux si la clé API est absente. `api/listings/improve/route.ts` : POST authentifié, rate-limit 10/h via `checkRateLimit`, retourne 503 si `ANTHROPIC_API_KEY` est absent. `etape-7/page.tsx` : bouton « Améliorer ce texte » (teal, visible dès que titre ≥ 10 car. et description ≥ 30 car.) ; affiche le résultat dans une carte de prévisualisation avec Accepter / Ignorer — ne modifie jamais le texte sans consentement explicite ; le bouton « Rédiger automatiquement » est conservé en parallèle. i18n FR/AR : 7 clés `improve*` (`improveButton`, `improvePending`, `improvePreviewTitle`, `improveAccept`, `improveDecline`, `improveError`, `improveUnavailable`).

## Lot 250 — Recommandations inter-marques — même segment, autres marques via Claude (2026-10-04)

`similar-ai.ts` : `getAlternativeListings()` demande à Claude 3 à 5 modèles concurrents directs (ex. Renault Clio → Peugeot 208, Hyundai i20…), puis interroge la base pour chaque paire marque/modèle dans une fourchette de prix ±40 % ; résultat mis en cache 1 h par couple `brandId/modelId` via `cachedReference` (les concurrents d'un modèle changent rarement) ; retourne toujours une liste vide si `ANTHROPIC_API_KEY` est absent. `annonce/[id]/page.tsx` : section « Vous pourriez aussi comparer » affichée après les annonces similaires ; `getSimilarListings` et `getAlternativeListings` appelés en parallèle via `Promise.all`. i18n FR/AR : clé `alternativesTitle`.

## Lot 251 — Messagerie vocale — enregistrement et lecture audio dans les conversations (2026-10-04)

`prisma/schema.prisma` : nouveau champ `audioUrl String?` sur `Message` (distinct de `attachmentUrl` pour différencier audio et image à l'affichage). Migration `20261004190000_lot_251_voice_messages`.

`uploads-serve.ts` : ajout du sous-répertoire `voice-messages` dans `UPLOAD_SUBDIRS` et des types MIME audio (`.webm`, `.ogg`, `.mp3`, `.mp4`) dans `CONTENT_TYPES`.

`uploads.ts` : fonction privée `storeFile` (S3 avec repli disque, accepte n'importe quel `contentType`) ; export `saveVoiceMessage` (validation taille ≤ 10 Mo, MIME `audio/webm|ogg|mp4|mpeg`, génération UUID + extension) ; export `VoiceValidationError`.

`messaging.ts` : `checkMessageHasContent` étendu avec `hasVoice?: boolean` — un message vocal seul est valide sans texte ni image.

`api/conversations/[id]/messages/route.ts` : lecture du champ `voice` dans `FormData` ; appel `saveVoiceMessage` ; inclusion de `audioUrl` dans `prisma.message.create` et `select` ; notification email affiche `[Message vocal]` si le contenu texte est vide.

`api/conversations/[id]/messages/[messageId]/route.ts` : `audioUrl: null` dans la mise à jour de suppression ; appel `deleteStoredFile(message.audioUrl)` pour nettoyer le fichier stocké.

Côté client — `ConversationView.tsx` : `audioUrl` ajouté au type `MessageRow` ; gestionnaires SSE et `handleDeleted` effacent `audioUrl` lors d'une suppression. `MessageList.tsx` : lecteur `<audio controls>` affiché sous l'image éventuelle si `audioUrl` est présent. `MessageThread.tsx` : bouton microphone 🎤 ; démarrage/arrêt de l'enregistrement via `MediaRecorder` (WebM/Chrome, OGG/Firefox, MP4/Safari) ; minuterie temps réel (limite 2 min) ; aperçu audio avant envoi avec bouton « Supprimer » ; FormData inclut le champ `voice` ; gestion des erreurs `voice_too_large` et `voice_invalid_type`.

i18n FR/AR : 8 nouvelles clés (`voiceRecord`, `voiceStop`, `voiceDiscard`, `voicePreviewLabel`, `voiceTooLarge`, `voiceInvalidType`, `voicePermissionDenied`, `voiceAttachment`).

## Lot 252 — Messagerie de groupe (2026-10-05)

**Schéma & migration** — `prisma/schema.prisma` : 3 nouveaux modèles. `GroupConversation` (id, name, createdById, timestamps). `GroupMember` (clé composite `[groupId, userId]`, `isAdmin`, `joinedAt`, `lastReadAt` pour le suivi des non-lus sans table de jonction supplémentaire). `GroupMessage` (id, groupId, senderId, content, attachmentUrl, audioUrl, deletedAt, createdAt) — mêmes capacités qu'un message 1-1 (texte, image, vocal). Migration `20261005000000_lot_252_group_messaging`.

**Temps réel** — `src/lib/realtime.ts` : type `GroupEvent` (`message | delete | member_added | member_removed`) ; `subscribeToGroup` / `publishToGroup` sur le canal Redis `group:<id>` (préfixe distinct de `conversation:` pour éviter les collisions) ; `localGroupSubscribers` avec flag `pmessageHandlerRegistered` dédié.

**API (7 routes)**
- `GET /api/groups` — liste les groupes de l'utilisateur avec `hasUnread` (comparaison `lastReadAt` vs `createdAt` du dernier message).
- `POST /api/groups` — crée un groupe, valide les memberIds, plafond 50 membres, rate limit 10/h.
- `GET /api/groups/[id]` — détail + 50 messages les plus récents ; met à jour `lastReadAt` du membre courant.
- `POST /api/groups/[id]/messages` — envoi texte/image/vocal, met à jour `group.updatedAt`, publie l'événement SSE avec `senderName`.
- `DELETE /api/groups/[id]/messages/[messageId]` — tombstone (content vide, urls nullifiées, `deletedAt`), supprime les fichiers stockés, publie l'événement `delete`.
- `POST /api/groups/[id]/members` — ajout d'un membre (admin uniquement), plafond 50, publie `member_added`.
- `DELETE /api/groups/[id]/members/[userId]` — quitter soi-même ou exclure (admin), publie `member_removed`.
- `GET /api/groups/[id]/stream` — SSE via `subscribeToGroup`, heartbeat 25 s.
- `POST /api/users/lookup-by-emails` — résout une liste d'emails en `{id, email}` (utilisé par le formulaire de création) ; renvoie `{ users, notFound }`.

**Composants**
- `GroupMessageList.tsx` : affichage des messages (regroupement par expéditeur, nom au-dessus de chaque groupe de messages distincts), lecteur audio, image, suppression avec confirmation.
- `GroupMessageThread.tsx` : formulaire d'envoi — texte, image (input file), vocal (MediaRecorder, même fallback MIME WebM/OGG/MP4 que la messagerie 1-1, limite 2 min).
- `GroupConversationView.tsx` : état + SSE (EventSource) — combine la liste et le formulaire ; gestion ajout de membre (admin) et quitter le groupe ; déduplication des messages reçus par SSE vs serveur.

**Pages**
- `/compte/groupes` — liste des groupes (point vert si non lu, dernier message affiché).
- `/compte/groupes/nouveau` — formulaire de création : nom + emails des membres (un par ligne) ; résolution email→userId via `/api/users/lookup-by-emails`.
- `/compte/groupes/[id]` — conversation de groupe (composant serveur → props → `GroupConversationView`).

**Navigation** — `SiteHeader.tsx` : lien « Groupes » avec badge rouge (non-lus) après « Messages ». `src/app/[locale]/layout.tsx` : calcul `unreadGroupsCount` (memberships avec au moins un message plus récent que `lastReadAt`) via `Promise.all` parallèle aux compteurs existants.

**i18n FR/AR** — namespace `Groups` (40 clés : navigation, création, membres, messages, vocal, erreurs) ; clé `Nav.groups`.

## Lot 253 — Simulateur de financement islamique (Murābaha) (2026-10-05)

`src/lib/islamic-financing.ts` : constante `ISLAMIC_BANKS` (Al Baraka 6 %, BNA islamique 6,5 %, CPA islamique 6,5 %, BADR islamique 7 %), options de durée (12–60 mois), fonction pure `computeIslamicFinancing` — formule Murābaha : marge = `prix × taux × années`, mensualité = `(prix de vente − apport) ÷ mois`. Aucun intérêt composé.

`src/components/IslamicFinancingSimulator.tsx` : composant client — sélecteur de banque (pills teal), slider apport (0 → 80 % du prix, pas 1 %), boutons durée, résultat en temps réel (mensualité, prix de vente banque→client, marge bénéficiaire totale, montant financé), label « Contrat Murābaha », disclaimer. Thème teal pour le distinguer visuellement du simulateur de crédit classique (vert).

`annonce/[id]/page.tsx` : `IslamicFinancingSimulator` remplace `CreditCalculator` — le simulateur de crédit classique (taux d'intérêt composés) est retiré de la fiche annonce ; `CreditCalculator.tsx` supprimé (composant orphelin). Seul le financement islamique (Murābaha, marge fixe, sans intérêts) est désormais proposé.

i18n FR/AR : namespace `IslamicFinancing` — 13 clés dont `contractType`, `totalMargin`, `salePrice`, `annualMarginRate`, `disclaimer` (terminologie islamique correcte, sans mention d'intérêt).

100 % client-side — aucune migration, aucun appel backend.

## Lot 254 — Notifications push pour les nouveaux messages de groupe (2026-10-05)

L'infrastructure push (service worker, modèle `PushSubscription`, VAPID, `sendPushToUser`, `PushToggle`) était déjà en place depuis le Lot 121. Ce lot la branche sur la messagerie de groupe.

`api/groups/[id]/messages/route.ts` : `after()` envoie, après création du message et publication SSE, une notification push à chaque membre du groupe (sauf l'expéditeur). La locale de chaque destinataire (`User.locale`) est respectée. Tag `group-<id>` : les notifications du même groupe se remplacent dans le centre de notifications au lieu de s'empiler.

`PushToggle.tsx` : prop `compact` (défaut `false`) — en mode compact, le composant se réduit à une icône 🔔 (grise = désactivé, verte = activé) pour s'intégrer dans les en-têtes étroits sans occuper un bloc entier.

`GroupConversationView.tsx` : `<PushToggle compact />` ajouté dans l'en-tête de la conversation, à côté de « Ajouter un membre » et « Quitter ».

i18n FR/AR : 2 clés dans le namespace `Notifications` (`pushGroupMessageTitle`, `pushGroupMessageBody`).

## Ajout du rôle SUPER_ADMIN (2026-10-05)

Nouveau rôle `SUPER_ADMIN` au sommet de la hiérarchie : `SUPER_ADMIN > ADMIN > MODERATEUR > SUPPORT > PROFESSIONNEL > PARTICULIER`.

`prisma/schema.prisma` : valeur `SUPER_ADMIN` ajoutée à l'enum `Role`. Migration `20261005000001_super_admin_role` : `ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN' AFTER 'ADMIN'`.

`roles.ts` : nouvelle fonction `isSuperAdmin()` ; `isAdmin`, `isStaff` et `isModerator` incluent désormais `SUPER_ADMIN` — tous les accès existants s'appliquent automatiquement au SUPER_ADMIN sans modifier les gardes en place.

`api/admin/users/[id]/role/route.ts` : double protection — un ADMIN ordinaire ne peut ni attribuer le rôle `SUPER_ADMIN` à quelqu'un, ni dégrader un utilisateur qui l'a déjà. Seul un SUPER_ADMIN connecté peut faire les deux.

`RoleSelect.tsx` : prop `canAssignSuperAdmin` (défaut `false`) — l'option `SUPER_ADMIN` n'apparaît dans le menu déroulant que si le visiteur est lui-même SUPER_ADMIN.

`admin/utilisateurs/page.tsx` : `canAssignSuperAdmin` calculé et transmis à `RoleSelect` ; `SUPER_ADMIN` ajouté au mapping `ROLE_KEY`.

i18n FR/AR : clé `roleOptionSuperAdmin` (« Super administrateur » / « مدير عام »).

**Activation du premier SUPER_ADMIN** (opération unique en base) :
```sql
UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'votre@email.com';
```

## Audit sécurité & qualité — correctifs (2026-10-07)

Audit complet effectué sur les 116 routes API, les bibliothèques sensibles et les composants critiques. Le projet présente un très bon niveau de sécurité de base (Zod sur toutes les entrées, gardes de rôle centralisés, cookies sécurisés, CSP avec nonce, HSTS, documents d'identité chiffrés, uploads validés sur les octets réels, protection path-traversal). Neuf correctifs appliqués.

**Sécurité (MOYEN)**
- `api/admin/users/[id]/suspend|unsuspend|unlock` : garde `isStaff` → `isModerator` — le rôle `SUPPORT` ne doit pas pouvoir suspendre, désuspendre ou déverrouiller un compte utilisateur (la documentation de `roles.ts` l'indique explicitement).
- `lib/client-ip.ts` : warning `console.error` au démarrage si `NODE_ENV=production` et `TRUSTED_PROXY_HOPS` absent — sans cette variable, `X-Forwarded-For` est pris tel quel (valeur cliente, falsifiable) et tous les rate limits par IP sont contournables.

**Sécurité (FAIBLE)**
- `lib/uploads.ts` — `saveVoiceMessage` : vérification des octets réels via `fileTypeFromBuffer` avant d'accepter le MIME déclaré par le client. Si le type détecté est connu et n'appartient pas à l'ensemble des conteneurs audio/vidéo légitimes (WebM, OGG, MP4, MP3), le fichier est rejeté. Alignement avec la politique déjà appliquée aux images (`savePhoto`, `saveAvatar`, etc.).

**Bugs fonctionnels**
- `api/groups/[id]/members` : le schéma Zod attendait `{ userId }` alors que le frontend envoyait `{ email }` — ajout d'un membre cassé à 100 % (400 systématique). L'API accepte désormais `{ email }` et résout l'adresse en `userId` en base.
- `GroupConversationView` : gestion des codes d'erreur alignée sur l'API réelle (`already_member`, `group_full`).
- Pagination des messages de groupe : `orderBy: { createdAt: "asc" }, take: 50` chargeait les 50 messages les plus *anciens* — corrigé en `desc` + `.reverse()` côté réponse, dans la page serveur et la route API (`/api/groups/[id]`).

**Qualité (PERF)**
- `api/admin/blog` : `prisma.blogArticle.findMany({ select: { slug: true } })` sans limite → ajout de `take: 500` pour éviter un scan complet de la table à l'échelle.

**i18n**
- Clé `alreadyMember` ajoutée en FR et AR (namespace `Groups`).

## Lot 257 — Pagination curseur pour la messagerie directe (2026-10-08)

Même mécanique que le Lot 256, appliquée aux conversations 1-à-1. La page chargeait jusqu'ici la totalité des messages sans limite (`orderBy: asc`, sans `take`) — une conversation longue ralentissait le rendu et transférait inutilement des données.

**Endpoint** `GET /api/conversations/[id]/messages?before=<messageId>` : retourne jusqu'à 50 messages antérieurs au curseur + flag `hasMore`. Accès vérifié via `canAccessConversation` (acheteur, vendeur ou collaborateur pro).

**Page serveur** : `orderBy: desc, take: 50` + `.slice().reverse()` pour conserver l'ordre chronologique affiché, prop `initialHasMore={messages.length >= 50}`.

**`ConversationView`** : bouton « Charger les messages précédents » affiché si `hasMore`. Ancrage du scroll via `document.documentElement.scrollHeight` + `window.scrollBy()` dans un `useLayoutEffect` — différence structurelle avec le Lot 256 : la messagerie directe défile au niveau de la fenêtre (pas dans un conteneur `div` à hauteur fixe), donc l'ajustement cible `window` plutôt qu'un `scrollContainerRef`.

i18n FR/AR : clé `loadMoreMessages` ajoutée dans le namespace `Messages`.

## Lot 256 — Pagination curseur pour la messagerie de groupe (2026-10-07)

La messagerie de groupe affichait les 50 messages les plus récents, sans accès à l'historique antérieur. Ce lot introduit un chargement à la demande des messages plus anciens.

**Endpoint** `GET /api/groups/[id]/messages?before=<messageId>` : retourne jusqu'à 50 messages antérieurs au curseur (la date de création du message référencé), triés du plus ancien au plus récent. Renvoie également un flag `hasMore` (fetch de 51, slice à 50, present = il en reste). L'accès est réservé aux membres du groupe (même vérification que pour l'envoi).

**`GroupConversationView`** : nouveau bouton « Charger les messages précédents » affiché en haut de la liste tant que `hasMore` est vrai. Au clic, les messages sont prépendus et la position visuelle de défilement est préservée — `useLayoutEffect` enregistre le `scrollHeight` avant le re-render et corrige le `scrollTop` synchroniquement après, avant que le navigateur ne repeigne. L'effet `useEffect([messages])` existant (scroll vers le bas) est court-circuité pendant ce chargement via `justLoadedMoreRef`, pour ne pas sauter à la fin lors d'un retour en arrière dans l'historique. Le scroll vers le bas reste actif pour les nouveaux messages SSE et les messages envoyés.

**Page serveur** : prop `initialHasMore={messages.length >= 50}` transmise au composant client.

i18n FR/AR : 1 nouvelle clé dans le namespace `Groups` (`loadMoreMessages`).

## Lot 255 — Graphe interactif de l'historique des prix (2026-10-07)

La liste statique affichée sur la fiche annonce quand le vendeur avait modifié son prix est remplacée par un graphe SVG interactif.

`PriceHistoryChart.tsx` (nouveau composant client) : courbe SVG sans dépendance externe (pas de Chart.js, recharts ou autre lib de graphes). Axe Y avec étiquettes de prix arrondies (`niceYTicks`), axe X avec dates courtes (premier et dernier toujours affichés). Zone de remplissage dégradée sous la courbe (teal). Tooltip au survol : prix + date complète, positionné à gauche ou à droite selon la position dans le graphe pour ne jamais déborder. Badge delta en en-tête : ▼ N% (vert, baisse) ou ▲ N% (rouge, hausse). Légende en pied de graphe : prix initial / prix actuel + montant absolu de la variation.

Dark mode natif (Tailwind `dark:`), RTL (formatage `ar-DZ`), accessible (`role="img"`, `aria-label`). Le graphe ne s'affiche que lorsqu'une annonce possède au moins deux entrées `ListingPriceHistory` — seuil déjà en place dans l'ancienne table.

i18n FR/AR : 4 nouvelles clés dans le namespace `Listing` (`priceHistoryInitial`, `priceHistoryCurrent`, `priceHistoryDrop`, `priceHistoryRise`).

## Lot 258 — Rubrique Équipements (magazine + annonces) (2026-10-08)

**Magazine — nouvelle rubrique Équipements** (`kind: EQUIPEMENT` sur `BlogArticle`) :

Migration `add_equipement_kind` : valeur `EQUIPEMENT` ajoutée à l'enum `ArticleKind`.

Pages publiques `/equipement` (index paginé, cartes, JSON-LD `ItemList`) et `/equipement/[slug]` (article complet, fil d'Ariane, JSON-LD `Article`, métadonnées OG). La page `/mag/[slug]` redirige vers `/equipement/[slug]` si le slug appartient à un article de type `EQUIPEMENT`, et réciproquement pour un slug de type `ARTICLE`.

Administration : `/admin/equipement` (liste avec badge brouillon/publié/programmé), `/admin/equipement/nouveau`, `/admin/equipement/[id]/modifier` — réutilise `BlogArticleForm` et `/api/admin/blog` avec `kind: EQUIPEMENT`. Entrée dans le menu admin. Sitemap mis à jour.

7 articles de départ : coffre de toit, porte-vélos, attelage/remorque, galerie de toit, tapis/housses de siège, déflecteurs/bavettes, booster de batterie.

Navigation : lien « Équipements » dans l'en-tête (`SiteHeader`) et le pied de page (`SiteFooter`). i18n FR/AR : 20 nouvelles clés dans les namespaces `Equipment` et `AdminEquipment`.

**Annonces — nouvelle catégorie `ListingCategory.EQUIPEMENT`** :

Migration `add_equipement_listing_category` : valeur `EQUIPEMENT` ajoutée à l'enum `ListingCategory` ; `fuelType`, `gearbox` et `mileage` rendus nullable pour accueillir les équipements sans motorisation.

Validation Zod (`listing.ts`) : `fuelType`, `gearbox`, `mileage`, `power`, `bodyType` optionnels pour la catégorie `EQUIPEMENT` ; `superRefine` conserve les contraintes pour toutes les autres catégories (véhicules). Marque facultative pour les équipements.

Wizard étape 2 (`Step2Fields`) : texte libre marque/modèle activé automatiquement à la sélection de la catégorie `EQUIPEMENT`, catalogue déroulant masqué. Étape 3 : carburant, boîte de vitesse, kilométrage, puissance et carrosserie masqués pour `EQUIPEMENT`.

`ListingCard`, fiche annonce (`annonce/[id]`), `ListingEditForm` : gestion null-safe des champs mécaniques — aucun affichage si la valeur est `null`. `SearchFilters` : option « Équipements & accessoires » ajoutée au sélecteur de catégorie.

## Fix — brandOther non initialisé pour EQUIPEMENT au chargement du draft (2026-10-08)

`Step2Fields.tsx` : le `useState` initialisant `brandOther`/`modelOther` s'exécute une seule fois au montage, avant que `WizardContext` ait restauré le brouillon depuis `localStorage`. Pour un brouillon `category=EQUIPEMENT` sans `brandFreeText`, le flag restait à `false`, masquant les champs de saisie libre.

Double correction : (1) la condition d'initialisation du `useState` inclut désormais `data.category === "EQUIPEMENT"` ; (2) un `useEffect` sur `data.category` force `setBrandOther(true)` / `setModelOther(true)` dès que la catégorie EQUIPEMENT arrive asynchronement.

## Fix — catégorie AUTRE renommée en « Pièces détachées » (i18n uniquement) (2026-10-08)

`messages/fr.json` : `"categoryAutre": "Pièces détachées"` (était `"Autre"`).
`messages/ar.json` : `"categoryAutre": "قطع غيار"` (était `"أخرى"`).

L'enum `ListingCategory.AUTRE` est inchangé en base et dans le code — modification de la traduction uniquement.

## Lot 259 — Dropdown compte dans le header desktop (2026-10-08)

Les liens utilisateur (mes annonces, messages, groupes, favoris, alertes, notifications, conseiller IA, tableau de bord, admin, déconnexion) sont regroupés dans un menu déroulant « Nom ▼ » sur le desktop. Le header passe de 14+ éléments à 6 (4 liens publics + Vendre + dropdown).

`AccountDropdown.tsx` (nouveau composant client) : bouton avec nom tronqué à 8 rem + chevron, overlay transparent de fermeture au clic extérieur, fermeture sur Escape avec retour du focus. Badges de compteurs non lus (messages, groupes, notifications) conservés. Lien « Back-office » conditionnel au rôle staff. Positionnement `ltr:right-0 rtl:left-0` pour la compatibilité RTL.

`SiteHeader` : `desktopNav` compact transmis au `<nav hidden sm:flex>` ; `mobileNav` (liste plate complète) transmis à `MobileMenuToggle` — les deux états d'affichage restent indépendants.

## Lot 260 — Correctifs tests + seed démo EQUIPEMENT (2026-10-08)

**Tests (4 corrections)** — résultat : 2218/2221 (les 3 échecs restants sont `backup-chain`, environnement PostgreSQL sans `CREATEDB`, pas du code) :

- `vehicle-catalogue.test.ts` : `LISTING_CATEGORIES` inclut désormais `EQUIPEMENT` depuis le Lot 258 — le test attendait `[...CATALOGUE_CATEGORIES, "AUTRE"]`, mis à jour en `[..., "AUTRE", "EQUIPEMENT"]` ; assertion `isCatalogueCategory("EQUIPEMENT") === false` ajoutée.
- `admin-user-role.test.ts` : `vi.mock("@/lib/auth-server/roles")` n'exportait pas `isSuperAdmin` (ajouté au Lot SUPER_ADMIN) — la route `/api/admin/users/[id]/role` appelle désormais `isSuperAdmin` et le mock échouait avec « No isSuperAdmin export is defined ». Ajout de `isSuperAdmin: (role) => role === "SUPER_ADMIN"` dans le mock.
- `uploads-serve.test.ts` : `voice-messages` ajouté à `UPLOAD_SUBDIRS` dans `uploads.ts` (Lot antérieur) sans mise à jour du test `toEqual` — corrigé.
- `deployment-artifacts.test.ts` : `client_max_body_size` Nginx = 10 MB et `MAX_*_BYTES` = 10 MB — égalité correcte (la limite couvre exactement le plus gros envoi), `toBeGreaterThan` → `toBeGreaterThanOrEqual`.

**Seed démo — 5 annonces EQUIPEMENT** (`prisma/seed-demo-listings.ts`) : type `DemoEquipementListing` et boucle de création séparée (pas de résolution catalogue marque/modèle). Chaque annonce utilise un vendeur démo existant, génère un placeholder photo, et est publiée avec `status: PUBLIEE`.

| Produit | Vendeur | Prix | État |
|---|---|---|---|
| Coffre de toit Thule 400 L | Karim — Oran | 65 000 DA | Occasion |
| Porte-vélos attelage 3 vélos Thule | Yasmine — Alger | 28 000 DA | Occasion |
| Remorque benne 750 kg | Riad — Constantine | 95 000 DA | Occasion |
| Booster Noco Boost Plus 1200A | Sofiane — Sétif | 12 000 DA | Neuf |
| Galerie de toit acier 120×80 cm | Nadia — Annaba | 8 500 DA | Occasion |

## Fix — retire le lien Équipements du header et du footer (2026-10-08)

`SiteHeader.tsx` : suppression du `<NavLink href="/equipement">` dans `publicLinks`.
`SiteFooter.tsx` : suppression du `<Link href="/equipement">` dans la colonne gauche du footer.

La rubrique reste accessible directement via `/equipement` et `/equipement/[slug]`.

## Fix — bouton langue toujours visible dans le header (2026-10-08)

`SiteHeader.tsx` : `ThemeToggle` et `LocaleSwitcher` se trouvaient en fin de `navContent`, à l'intérieur du `<nav>` en `overflow-hidden`. Avec de nombreux liens (utilisateur connecté + admin), ils étaient poussés hors de l'écran visible.

Correction : les deux composants sont déplacés dans un conteneur `shrink-0 ltr:ml-auto rtl:mr-auto` placé directement dans la `div` de la barre de navigation, en dehors du `<nav>`. Ils restent ainsi toujours visibles quelle que soit la longueur de la liste de liens, et sont accessibles depuis le menu mobile (`MobileMenuToggle`) qui reprend `navContent`.

## Fix — erreurs TypeScript après mileage nullable (Lot 258) (2026-10-08)

Le Lot 258 a rendu `mileage` nullable (`Int?`) dans le schéma Prisma pour la catégorie EQUIPEMENT, mais de nombreuses définitions de types en aval déclaraient encore `mileage: number`. Correction systématique sur 15 fichiers (`tsc --noEmit` : 0 erreur après fix).

**Types mis à jour (`number | null`)**
- `ComparableRow`, `ListingForBatchEstimate` (`price-estimation.ts`)
- `ListingForFraudSignals`, paramètre de `detectVehicleInconsistency` (`fraud-signals.ts`)
- `ComparableListingFacts` (`ai-compare.ts`)
- `ListingTextForAi` (`fraud-ai.ts`)
- `ShareCardInput.mileage` + `fuelType: string | null` (`share-image.ts`)
- `ListingForExport.mileage`, `fuelType`, `gearbox` (`bulk-import.ts`)
- paramètres `mileage/fuelType` de `computeAndStorePriceAiEstimate` (`price-ai.ts`)
- `VehicleJsonLdInput.mileage/fuelTypeLabel/gearboxLabel` optionnels (`structured-data.ts`)

**Call sites** : `?? undefined` ou `?? null` ajoutés partout où `number | null` était passé vers `number | undefined` ou `number`.

**JSON-LD** : `mileageFromOdometer`, `fuelType`, `vehicleTransmission` omis (spread conditionnel) si absent — cohérent pour les annonces EQUIPEMENT sans kilométrage ni carburant.

**Editorial** : section `"equipment"` ajoutée à `EDITORIAL_SECTIONS`, `TARGET_DAYS`, `KIND_TO_SECTION` et `ADMIN_BASE` de la page `/admin/editorial`.

**Tests** : types locaux `Row`/`Card` dans `price-estimation-equivalence.test.ts` mis à jour, guard `null` ajouté dans l'algo de référence.

## Lot 261 — Page publique `/equipement` (2026-10-08)

Page dédiée aux annonces de catégorie EQUIPEMENT, distincte de `/recherche`.

**Livré**
- `app/[locale]/equipement/page.tsx` : Server Component ; `category: "EQUIPEMENT"` fixé côté serveur (non surchargeable par l'URL) ; pagination 20/page ; réutilise `listingCardInclude`, `ListingCard`, `Pagination`, `SortSelect` et les helpers `buildListingWhere`/`buildListingOrderBy`.
- `components/equipement/EquipementFilters.tsx` : filtres client adaptés à la catégorie (recherche texte, prix min/max, état, wilaya) — sans marque/modèle/carburant/boîte qui n'ont pas de sens pour les équipements.
- Namespace i18n `EquipementSearch` (18 clés) ajouté à `messages/fr.json` et `messages/ar.json`.
- SEO : `generateMetadata` avec titre, description, `alternates` bilingues FR/AR.
- Pas de badge « Bon Prix » (pas de comparables catalogue pour EQUIPEMENT, `priceBadge: null`).
- Vérifié en navigateur : FR et AR (RTL), filtres pré-remplis depuis l'URL, message « Aucune annonce » quand 0 résultat.

**Note** : le lien de navigation vers `/equipement` a été retiré du header et du footer (session précédente) et n'est pas remis ici — la page reste accessible directement ou via `/recherche?categorie=EQUIPEMENT`.

## Fix — réintégrer le lien Équipements dans le header et le footer (2026-10-08)

`SiteHeader.tsx` : ajout de `<NavLink href="/equipement">{tNav("equipment")}</NavLink>` dans `publicLinks`, après le lien Essais — visible en desktop et dans le menu mobile. Clé `Nav.equipment` (déjà présente).

`SiteFooter.tsx` : ajout de `<Link href="/equipement">{t("equipment")}</Link>` dans la première colonne de la grille, après Guides — clé `"equipment"` déjà présente dans le namespace `Footer`.

## Lot 262 — Flux RSS des articles équipements (2026-10-08)

Les rubriques Essais et Guides disposaient d'un flux RSS depuis le Lot 111 ; la rubrique Équipements en était dépourvue.

**Livré**
- `app/[locale]/equipement/feed.xml/route.ts` : GET `force-dynamic` ; retourne un flux RSS 2.0 des 30 derniers articles `kind: EQUIPEMENT` publiés (`publishedNow` — brouillons et articles programmés exclus). Même structure que les flux essais/guides.
- `app/[locale]/equipement/[slug]/page.tsx` : `<link rel="alternate" type="application/rss+xml">` ajouté dans `generateMetadata` (via `alternates.types`) ; lien texte visible en pied d'article (`t("rssLink")`).
- `Equipement.rssLink` ajouté à `messages/fr.json` (`"Flux RSS des articles équipements"`) et `messages/ar.json` (`"خلاصة RSS لمقالات التجهيزات"`).
- Correction : `SiteHeader.tsx` utilisait `tNav("navEquipement")` (clé inexistante dans le namespace `Nav`) — remplacé par `tNav("equipment")` (clé déjà présente). Tests i18n : 12/12.

## Lot 263 — Badge DÉMO incrusté sur les photos démo + vraies photos des équipements (2026-10-08)

Les annonces de démonstration (vendeurs `@example.dz`) n'étaient pas distinguables d'une vraie annonce sur leurs photos, et les 5 annonces équipements démo n'avaient que des placeholders colorés.

**Livré**
- `prisma/demo-photo-store.ts` : `storeDemoPhoto` lit la photo Wikimedia, la redimensionne (≤ 1 600 px) et **composite un badge « DÉMO »** semi-transparent (SVG via `sharp.composite`) avant `storeProcessedImage`. Badge **centré en bas** et non dans un coin : les cartes affichent les photos en 4:3 avec `object-cover`, donc un coin d'une photo 16:9 est rogné alors que le centre ne l'est jamais (première version en bas à droite : badge invisible sur les cartes, corrigé).
- `prisma/seed-demo-listings.ts` : même badge dans le placeholder SVG ; les annonces équipements passent désormais par `storeDemoPhoto` (photo réelle si créditée, placeholder sinon), comme les véhicules.
- `prisma/apply-demo-photos.ts` : option `--force` (régénère toutes les photos, utile après un changement du badge ou du traitement) ; gère les équipements sans relation catalogue. Clé `CREDITS.json` unifiée : `« Marque Modèle »` du catalogue pour les véhicules, `« brandFreeText modelFreeText »` (`« Équipement »` à défaut de marque) pour les équipements — partagée par le seed et le script de mise à niveau.
- 5 photos Wikimedia Commons ajoutées à `prisma/demo-photos/` et créditées dans `CREDITS.json` : coffre de toit Thule (CC0), porte-vélos Thule (CC BY-SA 4.0), remorque (CC BY-SA 4.0), booster Noco GB40 (CC BY 2.0), galerie de toit (CC BY 2.0).

**Vérifié**
- `npx tsx prisma/apply-demo-photos.ts --force` sur la base de dev : 53 photos régénérées, 0 ignorée, 0 sans solution.
- Les 5 annonces équipements ont une photo avec `creditAuthor`/`creditLicense` renseignés (requête Prisma).
- Badge centré et lisible, contrôlé visuellement sur deux photos régénérées (coffre de toit 1 600×1 096, remorque 1 277×718).
- `tsc` sans erreur.

## Fix Lot 263 — photos équipements conformes aux garde-fous (2026-10-08)

Le Lot 263 avait été commité sans relancer la suite complète : `tests/demo-photos.test.ts` échouait (entrées `CREDITS.json` sans `title`/`width`/`height`, remorque et galerie de toit sous 1 600 px de large, dossier `prisma/demo-photos/` à 22 Mo pour 16 Mo autorisés, README sans les équipements).

**Corrigé**
- Les 5 photos d'équipements passent en **version 1 920 px** de Wikimedia Commons, comme les 24 véhicules : coffre de toit, porte-vélos et booster retéléchargés à cette taille ; **remorque et galerie de toit remplacées** par des photos dont l'original dépasse 1 600 px (Land Rover + remorque, Leif Jørgensen, CC BY-SA 4.0 ; UAZ Patriot avec galerie, Retired electrician, CC0).
- `CREDITS.json` complété (`title`, `width`, `height`, `note`), `README.md` : tableau des 5 équipements. Dossier à 15,1 Mo.
- Photos démo régénérées en base (`apply-demo-photos --force`, 53/0/0).

**Vérifié** : `demo-photos.test.ts` 63/63 ; suite complète 2 272 tests verts (depuis Git Bash — sous PowerShell, `backup-chain.test.ts` produit 3 faux échecs dus au `tar` Windows, sans rapport avec le code).

## Lot 264 — Paiement en ligne CIB / Edahabia via Chargily Pay, mode test (2026-10-08)

Jusqu'ici, formules d'annonce (Premium / Premium+) et abonnements professionnels ne se payaient que par **virement bancaire avec rapprochement humain** (Lot 66), faute d'accès SATIM. Chargily Pay est un prestataire algérien agréé qui donne accès aux cartes **CIB** et **Edahabia** sans contrat SATIM direct. Ce lot l'intègre comme second moyen de paiement ; le virement reste le repli. Chaque moyen n'est proposé que s'il est réellement configuré (clé Chargily / coordonnées bancaires) — jamais un bouton qui ne marcherait pas.

**Principe de sécurité** : un paiement n'est **jamais** confirmé sur la seule page de retour du navigateur (l'acheteur peut la forger ou ne jamais l'ouvrir). Seules deux preuves comptent : le **webhook signé** par Chargily, ou la **relecture du statut** chez Chargily avec notre clé secrète.

**Livré**
- `src/lib/chargily.ts` (pur sauf deux appels réseau) : `resolveChargilyConfig` — mode déduit du **préfixe de la clé** (`test_sk_` = bac à sable, `live_sk_` = production), clé de test **refusée en production**, `CHARGILY_API_BASE_URL` pour les tests seulement (ignorée en production) ; `verifyChargilySignature` — HMAC-SHA256 du **corps brut** (pas re-sérialisé), comparaison à temps constant ; `parseChargilyEvent` (zod, type inconnu accepté puis ignoré, forme invalide refusée) ; `createChargilyCheckout` / `retrieveChargilyCheckout` (Bearer clé secrète, timeout 10 s, `ChargilyApiError`).
- `src/lib/payment-fulfillment.ts` : activation de formule / de palier et courriels **extraits des routes de revue admin** (Lots 66/79) et partagés avec le webhook et la relecture — une seule logique d'activation. **Idempotence** : `EN_ATTENTE → CONFIRMEE` par `updateMany` filtré sur le statut ; un webhook rejoué, un webhook + une relecture, ou deux admins : un seul gagne, jamais deux activations ni deux courriels. Les routes admin existantes utilisent désormais ces fonctions (comportement inchangé, `provider` ajouté au journal d'audit).
- `src/lib/chargily-events.ts` : commande retrouvée par `providerCheckoutId` (unique sur chaque table), jamais par une métadonnée recopiée par le prestataire ; **montant et devise vérifiés** avant activation (écart → rien, commande laissée à un humain, trace `[chargily]`) ; `paid` active, `failed`/`canceled`/`expired` annulent, le reste est ignoré.
- Routes : `POST /api/webhooks/chargily` (corps lu en texte avant tout JSON ; 503 non configuré, 401 signature fausse, 400 corps illisible, **200** sinon — y compris checkout inconnu ou déjà tranché, pour que Chargily cesse de renvoyer) ; `POST /api/payments/chargily/refresh` (« Vérifier le paiement » : auteur de la commande seulement, 404 sinon, limite 30/h, même transition que le webhook — indispensable en local où Chargily ne peut pas joindre le serveur) ; `method: "virement" | "chargily"` sur `upgrade-formula` et `subscription/upgrade` (la commande existe avant le checkout, son identifiant sert de référence ; si Chargily ne répond pas, elle est **supprimée** et la route répond 502 — jamais une commande EN_ATTENTE sans checkout qui bloquerait l'annonce).
- Schéma + migration `20261008020000_lot_264_chargily_pay` : enum `PaymentProvider` (VIREMENT | CHARGILY), colonnes `provider`, `providerCheckoutId @unique`, `paidAt` sur `PaymentOrder` et `ProSubscriptionOrder` ; statut **`ANNULEE`** (échec / annulation côté prestataire : ni confirmé ni refusé par un humain, compté à part dans les statistiques, hors taux de confirmation, libère la place « une seule commande EN_ATTENTE »).
- UI : `ListingFormulaUpgrade` et `ProSubscriptionUpgrade` — panneau « Payer en ligne (CIB / Edahabia) » puis « ou par virement bancaire » ; `ChargilyPendingOrder` (statut en attente + bouton « Vérifier le paiement ») ; `PaymentReturnBanner` (`?paiement=ok|echec`, texte explicite : « en cours de confirmation », pas « confirmé ») ; tableau de bord pro : commande en attente affichée (virement ou en ligne) ; `/admin/paiements` : moyen de paiement, identifiant de checkout Chargily, compteur d'annulations. Namespaces `Payment` (nouveau), `MyListings`, `Pro`, `AdminPayments`, `Notifications` (courriels « paiement en ligne confirmé ») en FR et AR.
- `launch:check` : contrôle `chargily` (clé de test en production = **erreur** ; absence = avertissement « virement seulement » ; ok = adresse du webhook à rendre joignable). `.env.example` (`CHARGILY_SECRET_KEY`, `CHARGILY_API_BASE_URL`), `docs/EXPLOITATION.md` § 5 quaterdecies (mise en place, confirmation, limites : pas de remboursement depuis le site, frais à vérifier chez Chargily).

**Vérifié**
- `tsc` propre ; **2 272 tests / 197 fichiers** verts, dont 49 nouveaux : `chargily.test.ts` (config, signature, événements, client avec `fetch` simulé), `chargily-events.test.ts`, `chargily-webhook-route.test.ts`, `upgrade-formula-route.test.ts` (virement conservé, chargily, suppression sur 502, éligibilité), `launch-checks.test.ts`, `payment-orders.test.ts` (ANNULEE). Lint propre sur les fichiers du lot.
- En navigateur, contre un **faux serveur Chargily local** (script hors dépôt ; clé factice et `CHARGILY_API_BASE_URL` dans `.env.local`, ignoré par git) : paiement → webhook signé → annonce Premium (45 j) ; webhook volontairement perdu → « Vérifier le paiement » → Premium ; échec → `ANNULEE`, boutons de nouveau disponibles ; abonnement pro Business en ligne → palier actif ; commande Chargily restée en attente **approuvée depuis `/admin/paiements`** → palier Pro, `reviewedById` renseigné. Sondes : rejeu du webhook → `already_decided`, signature fausse ou absente → 401, montant falsifié → `amount_mismatch` sans activation.

**Vérifié contre le bac à sable officiel** (clé `test_sk_…` du porteur de projet dans `.env.local`, API `pay.chargily.net/test`, page hébergée `pay.chargily.dz/test`) — trois checkouts créés par notre code (adresses de retour, webhook, `locale: fr`, description « formule PREMIUM — annonce … — commande … », relus par l'API avant chaque paiement) :
- **Payer** (Edahabia) → Chargily `paid` ; « Vérifier le paiement » → `CONFIRMEE`, `paidAt` renseigné, `reviewedById` nul, annonce Premium 45 jours.
- **Fail** → Chargily `failed`, retour sur `?paiement=echec` avec le bandeau ; relecture → `ANNULEE` (`chargily:failed`), annonce restée Standard, bouton de nouveau proposé.
- **Expire** → Chargily `expired` ; **Chargily n'utilise pas `failure_url`** dans ce cas et affiche sa propre page « L'opération de paiement a expiré » avec un bouton de retour ; relecture → `ANNULEE` (`chargily:expired`).
- Constats : la page hébergée est protégée par **reCAPTCHA** (les clics finaux « Payer » / « Fail » / « Expire » ont été faits par le porteur de projet, jamais par automatisation) ; le webhook ne peut pas joindre `localhost`, la relecture a confirmé à chaque fois (3 × 200, 180–200 ms) ; Chargily ajoute `checkout_id=` aux URL de retour (ignoré : le retour navigateur ne fait jamais foi) ; frais à 0 en mode test ; le bénéficiaire affiché est le nom du compte Chargily (« souqauto »), à vérifier avant le live.

**Limites**
- Frais réels, montant minimum et délais de versement ne se voient qu'en live : à confirmer sur le tableau de bord Chargily. Le flux abonnement pro n'a été rejoué que contre le faux serveur (même code, même route de relecture).
- La clé de test ayant transité par la conversation, elle est à régénérer dans le tableau de bord Chargily.
- Pas de remboursement depuis le site ; pas de choix forcé CIB/Edahabia (la page hébergée laisse l'acheteur choisir).
- Les 18 libellés arabes sont à faire relire par un locuteur natif.

## Audit complet (2026-10-08)

Rapport consolidé dans `docs/AUDIT-2026-10-08.md` : cinq relectures indépendantes et parallèles (sécurité ; intégrité des données et flux d'argent ; performance ; qualité du code et tests ; production, i18n, accessibilité), chaque constat « élevé » contre-vérifié dans le code. Périmètre : 118 routes API, 99 pages, 160 modules, 132 composants, 47 migrations, 2 272 tests. Commandes exécutées en lecture seule (`tsc`, `eslint`, `migrate status/diff`, `launch-check`, `i18n:check`).

**Verdict** : socle sain (Zod partout, rôles centralisés, SQL paramétré, CSP à nonce, uploads validés, sauvegardes relues, idempotence Chargily), rien d'exploitable à distance sans compte, mais **six défauts à corriger avant mise en ligne** (A1-A6, corrigés au Lot 265 ci-dessous), dix points P1 (commandes Chargily en attente jamais expirées, admin pouvant rejeter une commande payée, `amount_mismatch` sans trace, balayages SMTP dans le chemin des pages, IA sans timeout, N+1 à l'approbation, action serveur d'estimation sans authentification, données personnelles dans les journaux, lint rouge en CI, couche argent et uploads sans tests) et une quarantaine de P2/P3 (performance, i18n/accessibilité, duplication, documentation obsolète). Plan en lots 265-269 dans le rapport.

## Lot 265 — Correctifs critiques de l'audit (A1-A6) (2026-10-08)

**A1 — Confirmation de paiement : republication sans contrôle, activation hors transaction.** `src/lib/payment-fulfillment.ts` : `confirmListingFormulaOrder` / `confirmProSubscriptionOrder` font la bascule `EN_ATTENTE → CONFIRMEE` et l'activation dans **une seule transaction** (une panne entre les deux ne peut plus laisser une commande payée jamais appliquée) ; l'annonce n'est activée que si elle est encore `PUBLIEE` ou `EXPIREE` au moment de la preuve de paiement — sinon la commande **reste `EN_ATTENTE`** annotée `listing_not_upgradable:<statut>` pour un humain (`/admin/paiements`), sans courriel, jamais de republication automatique d'une annonce suspendue, refusée ou vendue. Les routes admin de revue utilisent la même fonction (400 `listing_not_upgradable` ; `paidAt` désormais posé à l'approbation). Les commandes `EN_ATTENTE` sont **annulées** (`ANNULEE`, note `listing_refusee` / `listing_suspendue` / `listing_vendue` / `account_deleted`) à la modération, à `mark-sold`, à l'acceptation d'une offre (dans la transaction) et à la suppression de compte. Défaut hérité du Lot 66 et amplifié par le Lot 264 (transition devenue automatique).

**A2 — Aucune annonce réelle n'avait de date d'expiration.** Ni la création ni l'approbation n'écrivaient `expiresAt` (seuls le renouvellement, l'auto-renouvellement et la confirmation d'un paiement le faisaient ; les 48 annonces de dev en avaient une parce qu'elles viennent du seed). `admin/listings/[id]/moderate` pose `expiresAt = publishedAt + durée de la formule` et `expiryReminderSentAt: null` à la **première publication** (une ré-approbation après modification garde le cycle). Script de rattrapage `npm run db:backfill-expiry` (`scripts/backfill-listing-expiry.ts`) : simulation par défaut, `--apply` pour écrire, `--grace-days N` (7 par défaut) pour qu'une annonce ancienne ne expire pas au balayage suivant sans rappel. À lancer en production après déploiement.

**A3 — SUPER_ADMIN échappait à l'obligation de 2FA.** `isStaffRole` (`src/lib/staff-two-factor.ts`) inclut `SUPER_ADMIN` (rôle ajouté après le Lot 138, jamais reporté) ; `scripts/launch-check.ts` compte tous les rôles d'équipe ; `identity-verification/request` lit les rôles depuis `roles.ts` (`isModerator`) au lieu d'une comparaison manuelle qui l'oubliait aussi.

**A4 — Comparateur en erreur sur un équipement.** `comparateur/page.tsx` : `mileage`/`fuelType`/`gearbox` typés nullables (le type local masquait le `null` à `tsc`), rendu « — », kilométrage formaté avec la locale (`formatNumber`) ; `/api/listings/compare` exclut `category: EQUIPEMENT` ; `ListingCard` n'affiche pas « Ajouter au comparateur » sur un équipement.

**A5 — Twilio et ADMIN_EMAIL hors de `launch:check`.** `src/lib/launch-checks.ts` : `checkSms` (erreur si `TWILIO_*` absentes ou incomplètes, ou expéditeur non E.164 ; avertissement si le SID n'a pas la forme `AC…`) et `checkAdminEmail` (erreur si absente ou invalide). `src/lib/sms.ts` : `sendSms` renvoie `true`/`false` (timeout 10 s, exception réseau capturée, journaux sans code ni numéro complet) ; `POST /api/auth/verify-phone/request` répond **502 `sms_failed`** au lieu de « code envoyé » pour un SMS non parti ; `POST /api/contact` refuse en production sans `ADMIN_EMAIL` (503 `contact_unavailable`) au lieu d'envoyer vers `admin@souqauto.dz`.

**A6 — Recherche par mot sans index.** Migration `20261008030000_restore_trgm_indexes_when_available` : bloc `DO` qui recrée les trois index GIN trigramme (`title`, `brandFreeText`, `modelFreeText`) quand `pg_trgm` est disponible et chargeable, et émet un `NOTICE` sinon — passe sans erreur sous Windows (vérifié), crée les index sur un hébergeur Linux avec `postgresql-contrib`. La phrase fausse du CHANGELOG (« la recherche s'appuie désormais sur les index natifs ») est barrée et corrigée.

**Aussi** : `/api/payments/chargily/refresh` relit le statut réel en base au lieu de le déduire de l'issue (F5).

**Vérifié**
- `tsc` 0 erreur ; **2 295 tests / 198 fichiers** verts : 13 nouveaux (`tests/payment-fulfillment.test.ts` — transition gagnante unique, rejeu, annonce suspendue → pas de republication ni de courriel, course lecture/activation → transaction annulée et commande annotée, approbation admin avec relecteur et note, abonnement pro, annulations bornées) ; tests mis à jour : modération (`expiresAt` à la première publication, cycle conservé à la ré-approbation, annulation des commandes au refus et à la suspension), offres (annulation à l'acceptation), SMS (`false` + journal masqué), demande d'OTP (502), `launch-checks` (Twilio, ADMIN_EMAIL), 2FA (`SUPER_ADMIN`). Lint propre sur les fichiers du lot.
- Navigateur : plus de bouton « Ajouter au comparateur » sur `/equipement`, toujours présent sur les véhicules.
- `db:backfill-expiry` en simulation : 0 annonce concernée en dev.

**Limites** : `launch:check` est désormais plus exigeant (Twilio et `ADMIN_EMAIL` bloquants) — à prévoir dans la configuration de production. Les points P1 de l'audit (commandes Chargily en attente jamais expirées, relecture Chargily avant décision admin, `amount_mismatch` tracé, journal d'audit système) restent à traiter.

## Lot 266 — Commandes Chargily en attente, relecture avant décision admin, journal des paiements (audit B1-B2) (2026-10-08)

Deuxième lot de l'audit du 2026-10-08 : les angles morts « argent » restés après le Lot 265.

**B1 — Commandes Chargily `EN_ATTENTE` jamais expirées.** Si le webhook n'arrivait pas et que le vendeur ne cliquait pas « Vérifier le paiement », la commande bloquait toute nouvelle demande sur l'annonce (y compris par virement), et l'admin ne pouvait que trancher à l'aveugle. `src/lib/chargily-events.ts` : `refreshChargilyOrder` (relecture unifiée : vendeur avec contrôle d'appartenance, admin, balayage — tracée par sa source) et `sweepPendingChargilyOrders`, appelé par `POST /api/cron/sweep` : relit chez Chargily les commandes `EN_ATTENTE` de plus d'une heure (50 max par passe, deux tables) — payé → activation, échoué/expiré → `ANNULEE`, encore en cours → rien ; la passe s'arrête dès que Chargily est injoignable. Nouvelle route `POST /api/admin/payments/chargily/refresh` (ADMIN) et bouton **« Relire chez Chargily »** sous chaque commande Chargily en attente (`AdminChargilyRefresh`).

**B2 — Un admin pouvait refuser une commande réellement payée** (webhook en retard) : l'argent restait encaissé, rien activé. `src/lib/admin-payment-decision.ts` — `checkProviderBeforeDecision` : avant toute décision sur une commande `CHARGILY`, le checkout est relu chez Chargily ; déclaré payé → **refus interdit** (409 `paid_at_provider`) ; non payé → **approbation interdite** (409 `not_paid_at_provider`) ; Chargily injoignable → 502 ; non configuré → 503. Un virement n'interroge personne. `PaymentOrderReviewActions` affiche des messages explicites FR/AR pour ces cas et pour `listing_not_upgradable` (Lot 265).

**B2 — `amount_mismatch` sans trace ni alerte.** La commande est annotée `chargily:amount_mismatch <montant> <devise>` (toujours `EN_ATTENTE`), l'équipe est prévenue (`staff-alerts` : nouveau type `payment`, qui compte les commandes `EN_ATTENTE` annotées des deux tables et renvoie vers `/admin/paiements`), et la note est affichée en ambre dans la page admin — comme `listing_not_upgradable`.

**B2 — Aucun journal pour les décisions système.** Nouvelle table **`PaymentEvent`** (migration `20261008040000_lot_266_payment_events`) : `orderKind`, `orderId`, `source` (`WEBHOOK` / `REFRESH_USER` / `REFRESH_ADMIN` / `SWEEP` / `ADMIN`), `outcome`, `providerEventId`, `providerStatus`, `amount`, `currency`, `actorUserId`. Écrite par `applyChargilyCheckoutState` (toute issue sauf « ignoré » / checkout inconnu, qui n'ont pas de commande) et par les routes de revue admin ; jamais bloquante. Les trois derniers événements sont affichés sous chaque commande en attente (« Historique des décisions »). `AuditLog` exige un admin : les décisions système n'y entraient pas.

**B2 (« à confirmer » en live) — checkout échoué puis finalement payé.** `payment-fulfillment` confirme désormais aussi depuis `ANNULEE` (jamais depuis `CONFIRMEE` ni `REJETEE`) : si Chargily autorise un second essai sur un checkout déclaré échoué, l'argent encaissé active bien la formule. La relecture accepte les commandes `ANNULEE` pour la même raison.

Aussi : `POST /api/payments/chargily/refresh` (vendeur) réécrit sur `refreshChargilyOrder` ; `docs/EXPLOITATION.md` § 5 quaterdecies mis à jour (balayage, relecture admin, historique, contrôle avant décision, notes automatiques).

**Vérifié**
- `tsc` 0 erreur ; **2 313 tests / 199 fichiers** verts : 18 nouveaux (`tests/chargily-refresh-sweep.test.ts` — relecture vendeur/admin, `ANNULEE` relue mais pas `REJETEE`, Chargily injoignable sans toucher la commande, non configuré, expiré → annulée / en cours → inchangée ; balayage ignoré sans configuration, deux tables et âge minimum, arrêt anticipé ; contrôle avant décision : virement, payé-refus, non-payé-approbation, injoignable, non configuré) + événements et alerte dans `chargily-events`, `staff-alerts` (type `payment`), `payment-fulfillment` (`ANNULEE` → confirmée), `cron-sweep`.
- **Bac à sable officiel** : commande créée et laissée impayée → balayage (`minAgeMs: 0`) : 1 relue, Chargily `pending`, laissée en attente ; admin « Approuver » → **409** et message « Chargily Pay n'indique pas ce paiement comme payé » ; « Relire chez Chargily » → « Chargily : pending — commande : EN_ATTENTE » ; « Refuser » avec motif → `REJETEE`, événement `ADMIN / rejected / pending` avec l'acteur.
- `prisma generate` a exigé l'arrêt temporaire du serveur de dev (verrou du moteur sous Windows) — à savoir pour les prochaines migrations.

**Limites** : une relecture qui ne change rien (« ignoré ») n'écrit pas d'événement (pas de bruit) ; le balayage ne traite pas les virements en attente (rapprochement humain par nature) ; les textes arabes (16 libellés) sont à faire relire.

## Lot 267 — Préparation à la production (audit B6-B9, F1-F3, doc cron) (2026-10-08)

Troisième lot de l'audit du 2026-10-08 : ce qui aurait fait mal à la mise en ligne sans toucher à l'argent.

**B6 — Surfaces sans authentification ni limite.** `src/lib/price-estimate-action.ts`, seule action serveur (`"use server"`) du projet, échappait au modèle « session + limite de débit + Zod » des routes API : n'importe quel script pouvait déclencher des requêtes et des appels IA payants. Désormais : session exigée, **30 estimations par heure et par compte**, entrée validée (identifiants entiers positifs, année 1950-2100, kilométrage borné, 60 équipements max) ; un refus répond `null`, comme une estimation indisponible, ce que l'écran gère déjà. `POST /api/users/lookup-by-emails` (49 adresses par appel) limité à **20/h par compte** ; `POST /api/groups/[id]/members` à **30/h** — la réponse 404/409 reste (l'administrateur du groupe doit savoir si l'adresse a un compte), mais ne peut plus servir d'outil d'énumération.

**B7 — Variables de `.env.example` que `launch:check` ignorait.** `STAFF_ALERT_EMAILS` absent → avertissement dédié (`staff-alerts`), même quand `OPS_ALERT_EMAILS` est défini : la file de modération (annonces, avis, identités, signalements, paiements à examiner) ne prévenait personne sans que rien ne le dise. `S3_BUCKET` défini sans `S3_PUBLIC_URL` → **erreur** (`storage.ts` enregistrait chaque photo sous `/<clé>`, donc 404) ; sans `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` → erreur ; sans `S3_ENDPOINT` → avertissement (seul AWS s'en passe). `RESPONSIVENESS_CACHE_TTL_MS` ou `CATALOGUE_STATS_CACHE_TTL_MS` à `0` → avertissement (réservé aux tests). `CHARGILY_API_BASE_URL` présent → avertissement (ignorée en production, mais trahit une configuration copiée depuis un poste de développement).

**B8 — Données personnelles dans les journaux.** Le verrouillage d'un compte (mot de passe faux, second facteur faux) est journalisé par identifiant utilisateur, plus par adresse e-mail — en cohérence avec EXPLOITATION § 3 (SMS déjà masqués au Lot 265).

**B9 — Lint rouge, donc `npm run verify` et la CI rouges.** `Step2Fields.tsx` : la saisie libre marque/modèle est **dérivée** de la catégorie (`brandOther = category === "EQUIPEMENT" || choix`) au lieu d'être recopiée dans l'état par un `useEffect` (règle `react-hooks/set-state-in-effect`) — le brouillon restauré après le premier rendu est couvert sans effet. Avertissements nettoyés : import inutilisé (`equipement/page.tsx`), variable morte (`e2e/pro-features.spec.ts`), `sha256` calculé pour rien (`apply-demo-photos.ts`), `window.location.href` → `router.push` de `@/i18n/navigation` dans `GroupConversationView` (le préfixe de langue est conservé : un arabophone dépendait du cookie `NEXT_LOCALE`). **`eslint .` : 0 problème.**

**F1 — Webhook Chargily non borné.** 413 `payload_too_large` au-delà de 64 Ko, jugé sur `content-length` avant de lire le corps, puis sur le corps lu avant de calculer le HMAC ; 120 appels par minute et par adresse (`chargily-webhook:<ip>`).

**F2 / F3.** `POST /api/cron/sweep` compare `CRON_SECRET` à temps constant (`safeEqual`, comme Google et Chargily) ; les erreurs `ChargilyApiError` ne citent plus les 200 premiers caractères de la réponse (pouvaient contenir des données d'acheteur et finissaient dans les journaux) — code HTTP seulement.

**Documentation et planification.** `docs/EXPLOITATION.md` : § 1 liste désormais tous les contrôles de `launch:check` (SMS, `ADMIN_EMAIL`, Google, CSP, alertes de modération, `CRON_SECRET`, Chargily, 2FA, S3, caches…) ; § 2 et § 3 décrivent le **balayage nocturne** (`cron:sweep`, `CRON_SECRET`, relecture Chargily, 04h00, journal `backups/sweep.log`) qui n'apparaissait nulle part dans la doc. `ops/windows-schedule.ps1` : quatrième tâche `SouqAuto-Balayage` (quotidienne 04h00), absente alors que `crontab.example` la planifiait.

**Vérifié**
- `tsc` 0 erreur ; **`eslint .` 0 problème** (était 1 erreur, 4 avertissements) ; **2 329 tests / 201 fichiers** verts : 10 nouveaux (`tests/price-estimate-action.test.ts` — anonyme refusé sans requête, limite atteinte sans appel IA, entrées invalides, repli IA avec champs validés, repli marché quand l'IA est en panne ; `tests/lookup-by-emails-route.test.ts` — 401, 429 avant toute requête, résolution dédoublonnée en minuscules, validation 1-49), 413 du webhook (`content-length` et corps réel), 6 cas `launch-checks` (alertes de modération, S3 sans URL / sans identifiants / sans endpoint, caches à 0, URL de test Chargily).
- `launch:check` sur la configuration de développement affiche les nouveaux contrôles (SMS et `ADMIN_EMAIL` bloquants, `STAFF_ALERT_EMAILS` en attention, stockage S3 cohérent ✓).
- Navigateur : étape 2 du wizard avec un brouillon Équipement restauré → « Autre marque » et champ libre affichés d'emblée (le cas que l'effet supprimé traitait).

**Limites** : l'énumération par `groups/[id]/members` reste possible à 30 adresses par heure (compromis assumé pour l'ergonomie de l'admin de groupe) ; `windows-schedule.ps1` et `crontab.example` restent des modèles non essayés sur un vrai serveur.

## Lot 268 — Performance (audit B3-B5, C1, C5, C6, C9-C11) (2026-10-09)

Quatrième lot de l'audit du 2026-10-08 : ce qui faisait attendre les visiteurs ou saturait la base sans raison. Audit statique à la base (pas de mesure p95 sous charge) ; les gains sont ceux des allers-retours supprimés, pas des chiffres mesurés.

**B3 — Balayages avec envois SMTP dans le chemin des pages les plus visitées.** `recherche`, `annonce/[id]` et `compte/mes-annonces` attendaient les trois balayages (expiration, rappels d'expiration, renouvellement automatique) — les deux derniers envoient jusqu'à 50 courriels **un par un**, sans timeout SMTP court : le premier visiteur de la fenêtre de 30 s pouvait attendre des dizaines de secondes. Seule l'expiration (un `updateMany`) reste attendue ; rappels et renouvellements partent **après la réponse** (`after()` de Next). Le cron nocturne (Lot 236) reste la garantie qu'ils tournent sans visiteur.

**B4 — Appel Anthropic sans délai maximal dans le rendu de la fiche annonce.** `src/lib/anthropic-client.ts` : `timeoutMs` (`AbortSignal.timeout`, 20 s par défaut, **3 s** pour les alternatives inter-marques de la fiche) ; délai dépassé, erreur réseau ou réponse en erreur → `null`, journalisé. `src/lib/similar-ai.ts` : une indisponibilité de Claude **lève** au lieu de renvoyer `[]` — `cachedReference` ne mémoïse que les succès, donc un échec n'est plus gardé une heure pour tout un modèle ; la fiche se rend sans alternatives et le visiteur suivant retente.

**B5 — Approbation d'une annonce : une requête par alerte de recherche, toutes en parallèle, dans la requête de l'admin.** Les notifications (alertes de recherche puis abonnés du compte pro) s'exécutent **après la réponse** (`after()`), et les alertes sont traitées **par lots de 10** (`SEARCH_ALERT_CONCURRENCY`) au lieu de `Promise.all` sur toutes : plus de saturation du pool Prisma à chaque clic « Approuver ».

**C1 — Fiche annonce : lectures enchaînées.** Guide du modèle, guide général, annonces similaires, alternatives, stock du compte pro, estimation de prix, favori, signalement, offre en cours, avis du vendeur et réactivité étaient `await` l'un après l'autre (une dizaine d'allers-retours bout à bout). Un seul `Promise.all`.

**C5 — SMTP sans borne, et un envoi par favori avant de répondre.** `src/lib/mailer.ts` : `connectionTimeout` 10 s, `greetingTimeout` 10 s, `socketTimeout` 20 s (défauts nodemailer : 2 min, 30 s, 10 min). `listings/[id]/update-price` : les courriels de baisse de prix aux favoris partent après la réponse, **par lots de 20** (une annonce à 500 favoris ouvrait 500 envois simultanés).

**C6 — `getCurrentUser()` lu deux fois par requête** (mise en page + page, parfois `generateMetadata`) : mémoïsé par requête avec `cache()` de React — une lecture `User` (profil, compte pro) et une consultation de la liste de révocation en moins par page authentifiée. Transparent hors d'un rendu (scripts, tests).

**C9 — Limiteur de débit en mémoire sans purge.** Une fenêtre expirée n'était supprimée que si la même clé revenait ; avec des clés par adresse IP, la carte grossissait sans fin. Purge opportuniste toutes les 1 000 insertions (`pruneExpiredRateLimits`).

**C10 — Index manquants** (migration `20261009000000_lot_268_indexes`) : `Listing [status, wilayaId, publishedAt desc]` (page wilaya, recherche par wilaya sans catégorie — `wilayaId` n'était atteignable que derrière `category`), `Listing [status, price]` (tris par prix), `Message [conversationId, createdAt desc]` (pagination curseur du Lot 257, comme `GroupMessage`). `migrate diff` vide pour le schéma ; les index non modélisés (uniques partiels, trigrammes) restent hors schéma comme avant.

**C11 — Sitemap et annuaire recalculés à chaque requête.** `sitemap.ts` : `revalidate = 3600` au lieu de `force-dynamic` (un robot qui le relisait toutes les dix minutes coûtait six requêtes, dont jusqu'à 50 000 identifiants et tout l'annuaire, à chaque passage ; une heure de retard sur le plan du site est sans effet). `getDirectoryEntries` (tous les comptes pro, leurs annonces actives et tous leurs avis) en cache **5 minutes** via `cachedReference`, partagé par `/concessionnaires` et le plan du site.

**Non traités dans ce lot** (plus lourds, côté interface) : C2 pagination de la boîte de réception, C3 photos et indicateurs de « Mes annonces », C4 statistiques admin en agrégats SQL, C7 catalogue i18n limité aux espaces de noms des composants client, C8 communes chargées à la demande, C12 score de confiance en agrégats, C13 comparables de la file de modération en cache.

**Vérifié**
- `tsc` 0 erreur ; `eslint .` 0 problème ; **2 334 tests / 202 fichiers** verts : 5 nouveaux (`tests/anthropic-client.test.ts` — signal d'abandon transmis, abandon en moins de 2 s sur un appel bloqué, `null` sur HTTP 529 et sur erreur réseau, appel vision ; `tests/rate-limit.test.ts` — purge des fenêtres expirées, fenêtres actives conservées) ; tests de modération et de baisse de prix adaptés à `after()` (exécuté immédiatement dans les tests).
- Navigateur : recherche `?q=clio`, fiche annonce (guide, financement, caractéristiques) et `/sitemap.xml` rendus sans erreur serveur.
- Constat utile : la migration conditionnelle du Lot 265 a **créé les trois index trigramme sur la base de développement** — `pg_trgm` se charge finalement sur ce PostgreSQL (l'échec `58P01` du 27 septembre venait d'une autre installation) ; la recherche par mot y est donc indexée.

**Limites** : `after()` exige d'être dans une requête — les tests le remplacent par un appel immédiat ; les gains ne sont pas mesurés (pas d'EXPLAIN ni de test de charge rejoué) ; le cache de l'annuaire retarde de cinq minutes au plus l'apparition d'un badge vérifié ou d'un nouvel avis dans `/concessionnaires`.

## Lot 269 — i18n, accessibilité, qualité (audit D1-D6, E1-E3, E5, B10) (2026-10-09)

Cinquième et dernier lot du plan de l'audit du 2026-10-08.

**D1 — Nombres formatés sans locale.** `toLocaleString()` sans argument dépendait de l'ICU du serveur (composants serveur : même rendu en français et en arabe) ou du navigateur (composants client). Partout `formatNumber(n, locale)` (`src/lib/format.ts`) : `ListingCard` (kilométrage, prix), `AiAdvisorChat`, `RecentlyViewedSection`, `MakeOfferButton`, les panneaux d'upgrade, et le courriel de baisse de prix (locale du destinataire). `fr-DZ` figé même en arabe remplacé dans `MarketStatsWidget` (`getLocale`), `PriceRangeHint` (`useLocale`) et l'étape 9 du wizard (dates de contrôle technique / assurance).

**D2 — Transactionnels en français seul.** Le SMS du code de vérification et le courriel de confirmation de changement d'adresse parlent la langue du compte (`user.locale` ; 3 clés `Notifications` FR/AR : `emailChangeSubject` / `Body` / `Expiry`). Le manifeste PWA, unique par construction, devient bilingue (description et raccourcis « Rechercher · بحث »…). Les courriels de double authentification étaient déjà bilingues (faux positif de l'audit).

**D3 — Champs sans libellé.** `EquipementFilters` : `useId` + `htmlFor`/`id` sur prix min/max, état, wilaya ; `type="search"` et `aria-label` sur la recherche. Un lecteur d'écran annonce désormais « Prix min (DA) » au lieu d'un champ sans nom.

**D4 — Mode sombre : contrastes.** Variantes `dark:` sur les pastilles CT / assurance / négociable et les signaux de confiance de `ListingCard` (texte -700/-800 sur fond -50 tombait sous 2:1), sur les badges de prix (`price-badge-style.ts`), sur les erreurs des composants de paiement et sur `global-error`.

**D5 — RTL.** Classes logiques (`ms-`, `ps-`, `border-s`) ou `ltr:`/`rtl:` dans le header (compteurs), le fil de groupe, le gestionnaire de catalogue, l'éditeur d'annonce ; `PhotoGallery` : fermeture, précédent et suivant placés selon la direction, chevrons retournés (`rtl:rotate-180`).

**D6 — Images et chargement.** `alt` descriptif (titre de l'article, nom commercial) sur les couvertures d'articles, le logo et la bannière pro. Neuf `loading.tsx` (nouveau `PageSkeleton`, variantes article / grille) pour la fiche annonce, équipements, essais, guides (index et article), marques et wilayas.

**E2 — Code mort et clés orphelines.** `src/lib/credit-calculator.ts` (jamais importé : l'écran utilise `islamic-financing.ts`), son test et le namespace `CreditCalculator` (11 clés) supprimés ; `roles.ts : isSupport` supprimé ; **20 clés i18n orphelines** retirées de FR et AR (`Listing.notFound/backHome/viewListing`, `Admin.roleLabel/changeRole/…`, `Footer.brands`…). `src/lib/i18n-audit.ts` : `unusedMessageKeys` (balayage inverse : littéraux, clés calculées, segments cités dans une table de correspondance) + test dans `i18n-messages.test.ts` qui **échoue sur toute future clé orpheline**, avec trois familles d'exceptions justifiées (`MarketStats.badge_*`, `Pro.logo*/banner*`, `BulkImport.error_*`) et le contrôle que chaque exception sert encore.

**E3 — Échecs d'envoi avalés.** `mailer.ts : sendEmailBestEffort(tag, args)` journalise `[EMAIL tag] échec envoi : …` et ne lève jamais ; les quatre envois du parcours des offres (`offers/[id]`) l'utilisent au lieu de `.catch(() => null)`.

**E5 — Documentation.** `docs/ARCHITECTURE.md` : bandeau « document historique » en tête, listant les écarts réels (pas de NestJS/PostGIS/Meilisearch/BullMQ, bcrypt + JWT, FR/AR, paiement virement + Chargily sans `PaymentProvider` ni remboursement). `app/README.md` : notes obsolètes corrigées (limites de débit Redis, stockage S3, webpack, tests qui créent une base, Git Bash pour `npm test`, `prisma generate` serveur arrêté).

**B10 — Uploads sans test.** `tests/uploads.test.ts` (`sharp`, stockage, disque et analyse de qualité simulés, `file-type` réel) : un vrai PNG de 1×1 accepté malgré un nom `../../etc/passwd.exe` et un type `application/octet-stream`, re-encodé et stocké sous un nom UUID ; PDF et SVG-avec-script refusés sur leurs octets (`photo_invalid_type`) sans toucher `sharp` ; 8 Mo / 4 Mo refusés avant lecture ; cadrage avatar 400×400 ; S3 quand configuré, repli disque si S3 échoue ; `storeProcessedImage` écrit exactement les octets donnés.

**E1 — Duplication.** `PaymentUpgradePanel` (un seul panneau « payer en ligne / ou par virement ») ; `ListingFormulaUpgrade` et `ProSubscriptionUpgrade` deviennent des enveloppes de libellés (~200 lignes dupliquées en moins). Les 30 clés i18n doublées restent (chaque enveloppe garde son espace de noms).

**Non traités** (hors de ce lot, notés) : factorisations `requireUser` / `parseJsonBody` / `notifyUser` (31 et 82 répétitions), unification des codes HTTP (`unauthorized` vs `unauthenticated`, 400 vs 409), `apiHandler` commun, et les points de performance côté interface (C2 pagination de la boîte de réception, C3 photos de « Mes annonces », C4 statistiques admin, C7 espaces de noms i18n, C8 communes à la demande).

**Vérifié**
- `tsc` 0 erreur ; `eslint .` 0 problème ; **2 329 tests / 202 fichiers** verts (uploads : 6 nouveaux ; clés orphelines : 1 nouveau ; 3 tests du module mort retirés).
- Navigateur : `/ar/recherche` en mode sombre — cartes en RTL, pastilles lisibles, montants en format `ar-DZ` ; `/fr/equipement` — champs nommés par leur libellé.

**Limites** : les textes arabes ajoutés (SMS, courriel de changement d'adresse, manifeste) sont à faire relire par un locuteur natif ; le balayage des clés orphelines ne voit pas une clé construite par concaténation (`"error_" + code`) — d'où la liste d'exceptions ; les squelettes de chargement sont génériques (pas la forme exacte de chaque page).

## Lot 270 — Pagination de la boîte de réception et de « Mes annonces » (audit C2-C3) (2026-10-09)

Deux points de performance côté interface laissés de côté par le Lot 268.

**Boîte de réception (`/compte/messages`).** La page chargeait **toutes** les conversations du compte (annonce + photo, profils acheteur et vendeur, dernier message), puis un `IN` de tous leurs identifiants pour les non-lus : un concessionnaire à trois mille conversations payait tout cela à chaque ouverture. Désormais `count` + `pageWindow` (`src/lib/pagination.ts`), **30 conversations par page**, `skip`/`take`, `select` restreints (titre et première photo de l'annonce, e-mail et `displayName` des deux profils, contenu / pièce jointe / `deletedAt` du dernier message), `groupBy` des non-lus limité aux conversations de la page, composant `Pagination` (`basePath="/compte/messages"`).

**Mes annonces (`/compte/mes-annonces`).** Même mécanique : **20 annonces par page**, une seule photo par annonce (`take: 1`), indicateurs de qualité des photos chargés en **une** requête `listingPhoto.findMany` pour les annonces de la page seulement (puis `distinctPhotoQualityFlags` par annonce), composant `Pagination` sous la liste ; le filtre `?paiement=` existant est conservé.

**Vérifié**
- `tsc` 0 erreur ; `eslint .` 0 problème ; **2 329 tests / 202 fichiers** verts.
- Navigateur : `/fr/compte/messages` et `/fr/compte/mes-annonces` avec le compte de démonstration (une page), `?page=2` et `?page=abc` ramenés à la première page sans erreur.

**Limites** : pas de tri ni de filtre de la boîte de réception (toujours par date de création) ; un compte sous le seuil ne voit aucun changement.

## Badge « DÉMO » proportionnel à la photo (2026-10-09)

Le badge du Lot 263 (texte de 26 px sur une photo de 1 600 px) devenait illisible sur une carte réduite à 300 px : une annonce de démonstration pouvait être prise pour une vraie. `demoBadgeSvg` (`prisma/demo-photo-store.ts`) calcule désormais le texte à ≈ 6,5 % de la largeur de la photo (104 px sur 1 600 px, soit quatre fois plus grand), cartouche ≈ 460 × 190 px, fond `rgba(0,0,0,0.68)`, toujours centré en bas pour ne jamais être rogné par le cadrage 4:3 des cartes. Les deux placeholders SVG (`seed-demo-listings.ts`, `apply-demo-photos.ts`) réutilisent ce générateur au lieu d'un badge codé en dur.

**Vérifié** : `npx tsx prisma/apply-demo-photos.ts --force` — 53 photos régénérées, 0 ignorée ; `tsc` 0 ; `eslint` 0 ; `tests/demo-photos.test.ts` 63/63 ; navigateur : DÉMO lisible sur chaque carte de `/fr/recherche` (y compris les annonces en avant) et sur les cinq équipements.

**Note** : la régénération supprime les anciens fichiers ; un navigateur qui en gardait le chemin (section « récemment consultés », `localStorage`) voit un 400 sur `/_next/image` jusqu'à l'expiration de cette liste — sans effet sur les autres visiteurs.

## Lot 271 — Factorisations requireUser / parseJsonBody / notifyUser (audit E1) (2026-10-09)

Trois répétitions relevées par l'audit : la garde d'authentification (une centaine de fois), la lecture d'un corps JSON (`request.json().catch` + `safeParse` + 400, plus de 80 fois) et le triplet courriel / push / notification in-app.

**`src/lib/api-route.ts`.** `requireUser()` (401 `unauthenticated`), `requireRole(isAdmin | isStaff | isModerator)` (403 `forbidden`, anonyme compris comme avant), `parseJsonBody(request, schema, { headers?, issues?: "full" | "paths" })` (400 `validation`, JSON illisible compris) et la constante `NO_STORE`, redéfinie jusque-là dans 11 routes. Convention sans wrapper ni exception : la valeur est soit la donnée, soit une `NextResponse` à renvoyer telle quelle (`if (user instanceof NextResponse) return user;`).

**`src/lib/notify-user.ts`.** `notifyUser({ userId, kind, url, body, title?, email?, push? })` — courriel au mieux (`sendEmailBestEffort`, échec journalisé), push et notification in-app en un appel, URL commune aux deux derniers.

**Application.** 82 `requireUser`, 36 `requireRole`, 73 `parseJsonBody` dans 99 routes (réécriture par script pour le motif commun, à la main pour les variantes : `issues` complètes pour connexion, inscription, contact et rappels, chemins pour les avis propriétaires, `requireAdmin` local de `preview-links` supprimé) ; 8 `notifyUser` (offre reçue / acceptée / refusée / contre-offre, nouveau message, alertes de recherche, abonnés d'un pro) ; les routes d'avis vendeur et pro passent à `sendEmailBestEffort`.

**Effet de bord assumé (E4 partiel)** : les 7 routes qui répondaient `"unauthorized"` répondent `"unauthenticated"` comme les 73 autres — aucun client ni test ne lisait cette chaîne.

**Laissé tel quel** : six gardes qui ne sont pas un rôle (`professionalAccount.id === id` pour logo / bannière / compte pro, visiteur facultatif sur `contact`, flux SSE en réponse texte) et deux lectures JSON particulières (`two-factor/setup` accepte un corps vide, `listings/draft` lit `body.data` sans schéma).

**Vérifié**
- `tsc` 0 erreur ; `eslint .` 0 problème ; **2 345 tests / 204 fichiers** verts — 16 nouveaux (`tests/api-route.test.ts` : 401 / 403 / 400, en-têtes, issues ; `tests/notify-user.test.ts` : trois canaux, canaux facultatifs, ordre) ; deux tests d'alertes adaptés (leur mock de `mailer` expose `sendEmailBestEffort`).
- Serveur réel : anonyme → `/api/notifications` 401, `/api/admin/brands` 403, `/api/push/subscribe` 401 avec `cache-control: no-store` ; `/api/contact` et `/api/auth/login` avec JSON cassé → 400 + issues ; connecté → `/api/auth/me` 200, `/api/profile` JSON cassé → 400, même nom → 200.

**Bilan** : 113 fichiers, −386 lignes nettes.

## Lot 272 — Modération à deux vitesses (publication automatique) (2026-10-09)

Premier lot issu de la réflexion sur l'organisation de l'équipe : la file humaine ne reçoit plus que ce qui mérite un regard.

**La règle (`src/lib/auto-publish.ts`).** Une annonce est publiée sans modérateur **seulement si tout est vrai** : réglage activé ; statut `EN_ATTENTE` ; score anti-fraude calculé **et** nul (pas de doublon de texte ou de photo, pas de prix anormal, pas d'incohérence véhicule) ; analyse IA passée **et** sans soupçon (exigée seulement si une clé Anthropic est configurée) ; aucune photo signalée (sombre, surexposée, basse résolution, aplat) ; vendeur avec **au moins N annonces publiées par un humain** (N réglable, 1 par défaut — les annonces auto-publiées ne comptent jamais, pas d'effet boule de neige) ; **zéro incident** (aucune annonce refusée ou suspendue, aucun signalement confirmé contre lui ou ses annonces). `decideAutoPublish` est pure et liste **tous** les motifs d'un refus (journaux serveur `[auto-publish]`) ; `tryAutoPublish` s'exécute dans la même chaîne `after()` que le score et l'IA, à la soumission **et** à la modification, avec un `updateMany` filtré sur `EN_ATTENTE` contre une course avec un modérateur, et ne lève jamais (un échec laisse l'annonce dans la file).

**Effets partagés (`src/lib/listing-publication.ts`).** Extraits de la route admin : `publicationData` (expiration à la première publication, trace `autoPublishedAt` — une ré-approbation humaine l'efface), `buildModerationEmail`, `notifySellerOfModeration` (courriel + in-app via `notifyUser`), `broadcastPublication` (alertes de recherche, abonnés pro). La règle automatique et le modérateur produisent exactement les mêmes effets ; la route `moderate` passe de 150 à 85 lignes.

**Schéma + migration `20261009110000_lot_272_auto_publish`** : `ModerationSettings.autoPublishEnabled` (défaut **false**) et `autoPublishMinApprovedListings` (1 à 20) ; `Listing.autoPublishedAt` ; `AuditLog.adminId` nullable — le journal affiche « **Système** » pour `listing.auto_publish`.

**Back-office.** Bloc « Publication automatique (modération à deux vitesses) » dans `/admin/parametres` (ADMIN seulement, texte d'aide explicite), badge « Publiée automatiquement » dans `/admin/annonces`, FR / AR.

**Écart corrigé au passage.** Une annonce **modifiée** ne recalculait ni son score anti-fraude ni l'analyse IA (l'ancien score restait affiché dans la file) et ne prévenait pas l'équipe.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 369 tests / 206 fichiers** verts — 24 nouveaux (`tests/auto-publish.test.ts` : décision motif par motif, orchestration contre base simulée — course avec un modérateur, erreur de base, comptage « humain uniquement » — ; `tests/listing-publication.test.ts` ; bornes du réglage).
- **Scénario réel** : l'admin active le réglage (PATCH 200) ; un vendeur de démonstration à 7 annonces validées et sans incident dépose une annonce avec une photo neuve → **publiée en 1,5 s** (`autoPublishedAt`, expiration J+30, score 0) ; journal « Système · listing.auto_publish · humanApprovedCount: 7 » ; notification in-app au vendeur ; badge dans `/admin/annonces`. Nettoyé ensuite (annonce, photo, téléphone du vendeur), réglage **redésactivé**.

**Mise en service.** Le réglage est désactivé par défaut : à activer dans `/admin/parametres` par un ADMIN. Recommandation : commencer à « 2 annonces approuvées par un humain », suivre le journal pendant une à deux semaines, puis descendre à 1.

**Limites** : un vendeur refusé une fois reste à vie dans la file humaine (pas de fenêtre de pardon — choix strict, modifiable) ; pas de compteur « publiées automatiquement cette semaine » dans les statistiques ; la règle ne s'applique pas aux imports CSV tant que le pro n'a pas soumis chaque brouillon (comportement existant).

## Lot 273 — Messages de contact : accusé de réception, FAQ, file de traitement, Reply-To (2026-10-09)

Jusqu'ici, le formulaire de contact envoyait un courriel à `ADMIN_EMAIL` et rien d'autre : pas d'accusé de réception, pas de trace, et les réponses des clients aux notifications du site partaient vers l'expéditeur technique « no-reply ». Quatre étapes, du sûr vers le plus utile.

**1. Accusé de réception.** Dès l'envoi, le client reçoit dans sa langue (FR / AR) « Nous avons bien reçu votre message (réf. SA-XXXXXX) » avec le délai annoncé par motif : problème technique 24 h ouvrées, renseignement pro 1 jour ouvré, question générale et autre 2 jours ouvrés, partenariat 3 jours ouvrés. La référence (six caractères sans 0/O/1/I/L, lisible au téléphone) s'affiche aussi à l'écran après l'envoi.

**2. FAQ jointe** aux motifs « question générale » et « problème technique » : cinq réponses rédigées (publier une annonce, annonce « en attente » — avec la publication automatique du Lot 272 —, mot de passe oublié, paiement CIB / Edahabia / virement, modifier ou retirer une annonce), FR et AR, suivies de « si ces réponses ne couvrent pas votre demande, vous n'avez rien à faire : un membre de l'équipe vous répond ». Aucun texte généré.

**3. Tri et file de traitement** (`src/lib/contact-messages.ts`, pur et testé). Routage : pro et partenariat → `ADMIN_EMAIL` (le PDG), le reste → `STAFF_ALERT_EMAILS` (boîte de l'équipe), repli sur `ADMIN_EMAIL`, adresse de développement hors production seulement. Chaque message est enregistré (`ContactMessage`, migration `20261009130000_lot_273_contact_messages`) et apparaît dans **`/admin/contact`**, ouvert à toute l'équipe (`SUPPORT` compris) : référence, statut **Nouveau / Pris en charge / Répondu**, motif, langue, lien « Répondre par courriel » pré-adressé avec `Re: [SA-…]`, note interne, « pris en charge par … », mention si l'accusé n'a pas pu partir ; compteur « Messages de contact nouveaux » sur le tableau de bord ; actions journalisées (`contact.take`, `contact.answered`, `contact.reopen`), avec la même garde de course que la modération. Le courriel transmis à l'équipe porte **`Reply-To` = le client** ; s'il échoue, le message reste dans la file (plus jamais perdu).

**4. `Reply-To` sur tous les courriels sortants** (`resolveReplyTo`) : `MAIL_REPLY_TO` (nouvelle variable, documentée dans `.env.example`), sinon la première adresse de `STAFF_ALERT_EMAILS`, sinon `ADMIN_EMAIL` ; sans rien, pas d'en-tête comme avant. `launch:check` avertit (`mail-reply-to`) quand aucune n'est définie. `sendEmail` accepte un `replyTo` propre à un envoi.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 395 tests / 209 fichiers** verts — 26 nouveaux (`tests/contact-messages.test.ts` : référence, routage, accusé, courriel équipe, transitions ; `tests/contact-form-route.test.ts` : enregistrement, Reply-To client, routage pro, accusé après la réponse, échec SMTP non bloquant, collision de référence, 503 sans destinataire, 400 / 429 ; `tests/admin-contact-status-route.test.ts` ; `resolveReplyTo`). Exception d'audit i18n ajoutée pour `ContactEmails.faqQ1…faqA5` (clés construites).
- Réel : formulaire soumis dans le navigateur → 201 avec la référence affichée ; sur Ethereal, le courriel à l'équipe montre `Reply To: <client>` et l'accusé est parti au client ; `/admin/contact` : Nouveau → Pris en charge (par admin@souqauto.dz) → Répondu ; journal avec les deux actions ; compteur sur le tableau de bord. Message de test supprimé ensuite.

**Mise en service** : renseigner `STAFF_ALERT_EMAILS` (boîte lue par l'équipe) et, si elle diffère, `MAIL_REPLY_TO`.

**Limites** : la réponse au client se fait depuis la boîte de l'équipe (pas d'envoi depuis le back-office) ; pas de réponse générée par IA (étape 5, à décider après un mois de messages réels) ; textes arabes à faire relire par un locuteur natif.

## Lot 274 — Relances commerciales automatiques (2026-10-09)

Deuxième lot issu du document « Équipe de lancement » : au lancement, le commercial, c'est le PDG — l'administratif des relances doit donc tourner seul.

**Virement attendu** (`src/lib/commercial-reminders.ts`, balayage nocturne `/api/cron/sweep`). Une commande par virement — formule d'annonce (`PaymentOrder`) ou palier pro (`ProSubscriptionOrder`) — encore `EN_ATTENTE` **deux jours** après sa création reçoit **une seule** relance dans la langue du client : formule ou palier, titre de l'annonce ou nom du compte, référence, montant, date de la demande, coordonnées bancaires et titulaire (si renseignés dans `/admin/parametres`, sinon la ligne est omise), et « si vous avez déjà effectué le virement, ignorez ce message ». Marquage atomique (`reminderSentAt`) avant l'envoi, 50 par passe, plus anciennes d'abord.

**Abonnement pro qui expire.** Rappel à **15 jours** puis à **3 jours** de l'expiration d'un palier payant : courriel + notification in-app (nouveau type `SUBSCRIPTION_EXPIRING`, « Abonnement bientôt expiré ») avec lien vers le tableau de bord pro ; le texte rappelle qu'à défaut le compte retombe sur Starter sans perdre ses annonces. Un rappel à 15 j manqué ne double pas celui à 3 j (le balayage marque alors les deux) ; un abonnement déjà expiré n'est pas rappelé ; chaque activation (`payment-fulfillment`) remet `reminder15SentAt` / `reminder3SentAt` à zéro pour le cycle suivant.

**Liste de prospection** `/admin/prospection` (`src/lib/prospection.ts`, MODERATEUR et plus), générée à chaque ouverture : **particuliers à 5 annonces et plus** (concessionnaires qui s'ignorent — nom, email, téléphone, wilaya, nombre et date de la dernière annonce), **abonnements qui expirent sous 15 jours**, **comptes pro sans abonnement payant** (Starter ou expiré). Téléphones lus directement sur `User` (seule lecture déchiffrée), réservés à l'équipe. FR / AR.

**Schéma + migration `20261009140000_lot_274_commercial_reminders`** : `PaymentOrder.reminderSentAt`, `ProSubscriptionOrder.reminderSentAt`, `ProSubscription.reminder15SentAt` / `reminder3SentAt`, `NotificationKind.SUBSCRIPTION_EXPIRING`. `docs/EXPLOITATION.md` : description du balayage nocturne complétée.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 407 tests / 211 fichiers** verts — 12 nouveaux (`tests/commercial-reminders.test.ts` : règles J+2 et 15 / 3 j, balayages avec course perdue et RIB absent ; `tests/prospection.test.ts` : classement des comptes pro, assemblage des listes, wilayas en arabe).
- Réel : données temporaires (virement vieux de 3 jours, abonnement à 10 jours de l'expiration) puis `POST /api/cron/sweep` avec un secret temporaire → `transferReminders: 1`, `subscriptionReminders.first: 1`, les deux courriels reçus sur Ethereal, marqueurs écrits, notification in-app créée ; page de prospection : 6 particuliers, 1 abonnement expirant. Données de test et secret supprimés ensuite.

**Incident de développement, corrigé** : une substitution dans le schéma a d'abord effacé `ProSubscription.expiresAt`, et la migration appliquée a supprimé cette colonne de la base de développement. Colonne recréée, migration corrigée (aucun `DROP` dans celle qui est commitée, empreinte mise à jour, `migrate status` propre) ; la seule valeur perdue (abonnement de démonstration) a été recalculée à activation + 30 jours. Sans effet sur la production, qui n'a jamais reçu cette migration.

**Mise en service** : rien à planifier de plus (même balayage nocturne, `CRON_SECRET`) ; renseigner les coordonnées bancaires dans `/admin/parametres` pour que la relance de virement affiche le RIB.

**Limites** : une seule relance de virement (pas de seconde à J+7, ni d'annulation automatique de la commande) ; pas d'export CSV de la liste de prospection ni de suivi « déjà contacté » ; les textes arabes sont à faire relire.

## Lot 275 — Rapport hebdomadaire automatique (2026-10-09)

Troisième lot du document « Équipe de lancement » : les chiffres du point du lundi arrivent seuls, dans la boîte de l'équipe.

**Ce qui part, et quand** (`src/lib/weekly-report.ts`). Chaque **semaine complète** — du lundi 00:00 au lundi 00:00 suivant, heure du serveur — produit un rapport envoyé **une seule fois** (table `WeeklyReport`, une ligne par période) par le balayage nocturne `/api/cron/sweep`, donc à la passe du lundi, à `STAFF_ALERT_EMAILS` + `ADMIN_EMAIL` sans doublon. Sans destinataire configuré, rien n'est envoyé ni enregistré ; une erreur est journalisée et n'interrompt jamais le balayage.

**Contenu**, en français (document interne), deux tableaux :
- **Activité de la semaine**, chaque ligne avec « cette semaine · semaine précédente · évolution » (`+30 %`, `−5 %`, `=`, `nouveau`) : annonces soumises, publiées (dont publiées automatiquement), refusées ; nouveaux comptes, nouveaux comptes pro ; paiements confirmés et montant encaissé ; offres de prix, conversations, messages ; signalements reçus et traités ; messages de contact reçus et répondus ; vues d'annonces, pages vues.
- **État au lundi matin** : annonces en attente et âge de la plus ancienne ; délai médian de validation humaine ; signalements ouverts ; messages de contact à traiter ; abonnements pro payants actifs (dont expirant sous 15 jours) ; virements en attente (nombre, montant). Liens vers le back-office, la prospection et les rapports précédents.

**Back-office** `/admin/rapports` (ADMIN) : historique des rapports envoyés (période, publiées / auto, en attente, paiements, contacts, date, destinataires) et bouton « Envoyer le rapport de la semaine dernière maintenant » (`POST /api/admin/reports/weekly`, envoi forcé, journalisé `weekly_report.send`). La bibliothèque n'utilise pas next-intl : le rapport se produit aussi depuis un script d'exploitation.

**Migration `20261009150000_lot_275_weekly_report`** : création de la table seulement (vérifié : aucun `DROP`). `docs/EXPLOITATION.md` complété ; clés FR / AR de l'écran admin.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 417 tests / 213 fichiers** verts — 10 nouveaux (`tests/weekly-report.test.ts` : semaine complète quel que soit le jour, évolution, courriel avec deltas et état du lundi, destinataires, envoi unique / forcé / sans destinataire / erreur avalée ; `tests/admin-weekly-report-route.test.ts` : 200 / 409 / 403).
- Réel : envoi par script vers deux adresses de test → deux courriels sur Ethereal, rapport « du 28 septembre au 4 octobre 2026 » avec les vrais chiffres de la base de démonstration (13 annonces publiées contre 10, +30 % ; 24 pages vues ; 1 abonnement payant actif) ; ligne visible dans `/admin/rapports` ; bouton d'envoi dans le navigateur → « Aucun destinataire : définissez STAFF_ALERT_EMAILS ou ADMIN_EMAIL » (attendu en local). Ligne de test supprimée.

**Limites** : semaine calée sur l'heure du serveur ; vues issues des compteurs journaliers existants (pas de visiteurs uniques) ; pas de graphique, pas de version arabe (courriel interne).

## Lot 276 — Rôle EDITEUR, rédaction seule (2026-10-09)

Dernier lot du document « Équipe de lancement » : le rédacteur à la pige entre dans le back-office sans recevoir le rôle `ADMIN` (qui lui ouvrait paiements, paramètres et utilisateurs).

**Le rôle** (`prisma/schema.prisma`, migration `20261009160000_lot_276_role_editeur` : une valeur d'énumération, aucun `DROP`). `src/lib/auth-server/roles.ts` : `isEditor` (SUPER_ADMIN, ADMIN, EDITEUR) et `hasBackOfficeAccess` (équipe de modération ou rédacteur). `isStaff`, `isModerator`, `isAdmin` et `isSuperAdmin` ne changent pas : un rédacteur n'est membre d'aucune de ces familles.

**Périmètre.** Les quatorze pages éditoriales (magazine, essais, guides — index, nouveau, modifier —, rythme éditorial, revue de presse) et les sept routes API correspondantes (articles, couverture, liens de relecture, revue de presse) passent de `isAdmin` à `isEditor`. Tout le reste reste fermé au rédacteur : modération, signalements, contact, identité, avis, utilisateurs, paiements, paramètres, journal, rapports, prospection, équipements.

**Back-office.** Le layout `/admin` admet l'équipe **et** les rédacteurs ; la navigation ne montre à un rédacteur que ses cinq sections ; `/admin` le renvoie sur le magazine. Au passage, six pages de modération (annonces, signalements, contact, avis, avis propriétaires, identité) ne s'appuyaient que sur la garde `isStaff` du layout : elles ont maintenant **leur propre garde** — sans elle, un rédacteur aurait pu les ouvrir.

**Attribution et sécurité.** `EDITEUR` dans le menu des rôles de `/admin/utilisateurs` (« Éditeur (rédaction seule) », FR / AR) et dans la route de changement de rôle ; **double authentification exigée** comme pour l'équipe (`isStaffRole` l'inclut : il publie sur le site public).

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 420 tests / 214 fichiers** verts (`tests/roles.test.ts` : accès éditorial, exclusion des familles de modération, entrée dans `/admin` ; cas EDITEUR dans `tests/staff-two-factor.test.ts`).
- Réel, avec un compte de démonstration passé temporairement en `EDITEUR` : dans le navigateur, `/admin`, `/admin/annonces` et `/admin/paiements` renvoient tous sur `/admin/mag`, la navigation se réduit à Mag · Essais · Guides · Rythme éditorial · Revue de presse ; par API, modération, changement de rôle et rapport hebdomadaire → 403, création d'article → 400 (validation : la porte est bien ouverte). Rôle restauré ensuite ; l'option apparaît dans le menu des rôles en tant qu'admin.

**Limites** : pas de relecture obligatoire avant publication par un rédacteur (il peut publier directement — relire sa première parution) ; `/admin/equipement` reste réservé aux ADMIN.

## Lot 277 — Affectation dans la file de modération (2026-10-09)

Prévu « dès le deuxième modérateur » dans le document « Équipe de lancement » : deux personnes ne doivent pas traiter le même élément, et le PDG doit voir qui a fait quoi.

**Prise en charge** (`src/lib/moderation-assignment.ts`). Sur les files des **annonces** (`/admin/annonces`) et des **signalements** (`/admin/signalements`) : bouton « Prendre en charge » sur un élément libre, badge « Pris en charge par vous / par *email* depuis le … », bouton « Libérer » pour la personne elle-même ou un ADMIN. Champs `assignedToId` / `assignedAt` sur `Listing` et `Report` (migration `20261009170000_lot_277_moderation_assignment`, ajouts seulement). La prise est atomique (`updateMany` filtré sur « encore libre ») : deux collègues ne peuvent jamais tenir le même élément. **Toute décision** (approuver, refuser, suspendre, traiter, rejeter) efface l'affectation ; prises et libérations sont journalisées (`listing.assign` / `release`, `report.assign` / `release`). Routes `POST /api/admin/listings/[id]/assign` et `POST /api/admin/reports/[id]/assign` (toute l'équipe), réponses 409 si déjà pris ou course perdue, 403 pour libérer l'élément d'un collègue.

**Activité de l'équipe — 7 derniers jours**, en tête de la file des annonces : par membre, annonces traitées, signalements traités, délai moyen entre dépôt et décision, éléments en cours. Calculé depuis le **journal d'audit** (les décisions réelles), jamais depuis les affectations. Composants `AssignmentControls` et `TeamActivityTable`, FR / AR.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 428 tests / 215 fichiers** verts — 8 nouveaux (`tests/moderation-assignment.test.ts` : prise, refus si déjà pris, libération par soi ou ADMIN seulement, écriture atomique et course perdue, signalements, agrégation par membre avec délai moyen et en-cours, route 200 / 409 / 403).
- Réel, dans le navigateur en admin : annonce de test déposée → « Annonces en attente (1) », tableau d'équipe vide → Prendre en charge → badge « Pris en charge par vous depuis le 9 oct. 2026, 7:40 PM », Libérer, « En cours : 1 » → Approuver → annonce publiée, affectation effacée en base, tableau « admin@souqauto.dz · 1 annonce traitée · 0 h », journal `listing.assign` puis `listing.approve`. Annonce, photo et téléphone de test nettoyés.

**Limites** : pas de filtre « mes éléments » ni de réaffectation directe à un collègue (on libère, l'autre prend) ; délai moyen calculé sur les annonces seulement ; le tableau d'équipe n'apparaît que sur la file des annonces.

## Lot 278 — Double validation des paiements par virement (2026-10-09)

Dernier maillon de sécurité du document « Équipe de lancement » avant l'embauche d'un deuxième administrateur : au-dessus d'un certain montant, un virement ne doit plus pouvoir être confirmé par une seule personne.

**Le seuil** (`PaymentSettings.dualApprovalThresholdDzd`, réglage « Seuil de double validation des virements (DA) » dans `/admin/parametres`, vide = désactivée). Au-dessus, une commande de virement (formule d'annonce ou palier pro — les paiements Chargily en ligne sont exclus) n'est confirmée qu'après l'approbation de **deux administrateurs différents**. Règles pures dans `src/lib/dual-approval.ts`. La première approbation est enregistrée de façon atomique (`firstApprovedById`/`firstApprovedAt`), la commande reste `EN_ATTENTE` (événement `first_approval`, journal `*.first_approve`) ; la **même** personne qui retente reçoit `409 second_approver_required` ; la seconde, par quelqu'un d'autre, confirme comme avant. Le refus, lui, reste à une seule personne.

**Interface** : `PaymentOrderReviewActions` affiche « Valider (1/2) » puis, une fois la première approbation posée, « Confirmer (2/2) » grisé pour le premier validateur ; la page `/admin/paiements` affiche un bandeau si un seul administrateur est actif (la double validation bloquerait alors toute commande au-dessus du seuil). Migration `20261009180000_lot_278_dual_approval` (ajouts seulement).

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 437 tests / 216 fichiers** verts — 9 nouveaux.
- Réel : seuil à 1 000 DA, commande de 2 000 DA → première validation par un administrateur → `409` au second essai de la même personne → confirmation par un second administrateur → `CONFIRMEE`, événements et journal corrects ; données de test nettoyées. Un `400` isolé observé au tout premier clic (première compilation du module de route en dev), non reproduit aux essais suivants.

**Limites** : le seuil est global (pas par formule) ; pas de délai de relance si la seconde validation tarde — à revoir si une équipe de plus de deux administrateurs se met en place.

## Lot 279 — Reliquat de l'audit : codes HTTP, agrégats admin, i18n client, communes à la demande (2026-10-10)

Quatre points de l'audit de code restés ouverts (E4, C4, C7, C8) — la journalisation des erreurs communes (E6, enveloppe `apiHandler`) reste à appliquer aux routes, reportée à un lot ultérieur.

**E4 — codes HTTP.** `requireRole` répondait `403` à un visiteur non connecté, confondant « pas identifié » et « rôle insuffisant » : il répond maintenant `401 unauthenticated` (comme `requireUser`), `403 forbidden` restant réservé au rôle insuffisant. Toutes les réponses `already_collaborator` / `already_professional` / `already_reviewed` / `already_verified` passent de `400` à `409` (c'est une course, pas une erreur de saisie). Table des conventions ajoutée dans `src/lib/http.ts`.

**C4 — agrégats admin.** `/admin/statistiques` ne lit plus la table entière des utilisateurs/annonces mais seulement les 12 dernières semaines, et la note moyenne vient d'un `prisma.review.aggregate` plutôt que de charger tous les avis en mémoire. `/admin/utilisateurs` est désormais paginé (50/page, comme les files de modération). `/admin/paiements` calcule ses compteurs via `prisma.paymentOrder.groupBy` au lieu de charger toutes les commandes.

**C7 — i18n côté client.** `src/i18n/client-namespaces.ts` liste les 49 espaces de noms (sur ~80) réellement lus par `useTranslations()` côté client ; le layout ne transmet plus au navigateur que ces espaces (`pickClientMessages`), pas le catalogue de traduction complet. Un test (`tests/i18n-client-namespaces.test.ts`) recalcule cette liste depuis le code source à chaque exécution : un `useTranslations("X")` ajouté sans mettre à jour la liste casserait X côté client en production, détecté immédiatement.

**C8 — communes à la demande.** Les 1 541 communes ne voyagent plus avec les pages d'accueil/recherche/équipements. `SearchFilters` charge désormais celles de la wilaya choisie via `GET /api/wilayas/[id]/communes` (mise en cache navigateur 1 jour), au lieu de recevoir la liste complète au chargement de la page.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 440 tests / 217 fichiers** verts (7 ajustés de 403 à 401 pour un anonyme).
- Réel, dans le navigateur : `/admin/statistiques` (note moyenne, fenêtre de 12 semaines), `/admin/utilisateurs` (pagination), `/admin/paiements` (compteurs via l'agrégat) ; recherche avec sélection de la wilaya d'Alger → chargement à la demande des communes (Bab El Oued entre autres) sans erreur réseau.
- Un bug introduit pendant ce lot (l'appel `fetch` des communes omettait l'identifiant de la wilaya, `404` silencieux) a été trouvé et corrigé pendant cette vérification, avant commit.

**Limites** : l'enveloppe `apiHandler` (audit E6, ~146 routes) reste à appliquer — écrite dans `src/lib/api-route.ts` mais pas encore branchée sur une seule route.

## Lot 280 — Bandeau de premier lancement (2026-10-10)

Bandeau statique et refermable en tête de toutes les pages, pour le tout premier lancement du site : prévient les visiteurs et renvoie vers `/contact` pour signaler une anomalie. Volontairement **sans défilement animé** (un texte en mouvement est moins lisible et contraire aux recommandations d'accessibilité).

Fermeture mémorisée par navigateur (`localStorage`, même principe que `CompareContext`) : une fois fermé, il ne réapparaît pas sur les pages suivantes du même visiteur. **Se retire de lui-même après 3 mois** (`src/lib/launch-notice.ts`, `isLaunchNoticeActive`, échéance au 10 janvier 2027), vérifié côté serveur dans le layout — passé ce délai, le bandeau n'est plus du tout envoyé au navigateur, pas seulement masqué en JavaScript.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 442 tests / 218 fichiers** verts (4 nouveaux).
- Réel, dans le navigateur : FR, AR (RTL), mode sombre, lien de signalement, fermeture persistante entre les pages.

## Lot 282 — Retouches navigation, logo et page Contact (2026-10-10)

Trois retouches ponctuelles demandées en revoyant le site en direct :
- Retrait du lien « Équipements » de la navigation (en-tête et menu mobile) : reste accessible via le filtre Catégorie de la recherche, pour ne pas dupliquer l'entrée.
- Espace dans le logo « SOUQ AUTO » (auparavant collé) ; les deux mots gardent leurs couleurs distinctes. La police du logo (Bebas Neue) n'ayant pas de véritables minuscules, l'aspect « tout en capitales » reste inhérent à cette police.
- Carte « Email » en haut de la page Contact (`PUBLIC_CONTACT_EMAIL` dans `src/lib/site.ts`), dans l'esprit d'une maquette de référence fournie, adaptée aux thèmes clair et sombre du site.

Au passage, un champ téléphone facultatif avait été ajouté puis entièrement retiré du formulaire de contact sur demande (code, migration et colonne en base) avant tout commit — aucune trace dans l'historique.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 442 tests** verts.
- Réel, dans le navigateur, FR/AR, clair/sombre, desktop et mobile.

## Lot 283 — Vignette automobile estimée (2026-10-10)

Première pierre d'un « coût d'usage » affiché sur la fiche annonce, à côté du prix — en se limitant à une donnée **100 % officielle et déterministe**, par choix : ni consommation ni assurance ne sont affichées, pour ne jamais présenter un chiffre inventé comme fiable à un acheteur qui prend une décision financière réelle (même principe que l'absence de consommation « mesurée » sur les essais auto).

`src/lib/vignette.ts` : barème officiel de la loi de finances 2026 (DGI), par puissance fiscale et âge du véhicule — deux données déjà présentes sur chaque annonce. Électrique et hybride exonérés ; le GPL ne l'est plus depuis cette loi. N'affiche rien si la puissance fiscale n'est pas renseignée, plutôt qu'une estimation bancale. Sources : [demarchesdz.com](https://www.demarchesdz.com/vignette-voiture/), [tsa-algerie.com](https://www.tsa-algerie.com/vignette-auto-2026-en-algerie-la-vente-lancee-ce-qui-change/).

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 450 tests** verts (8 nouveaux).
- Réel, dans le navigateur : calcul exact sur une annonce de test (7 CV, 7 ans → 2 000 DA/an), exonération électrique, disparition propre sans puissance fiscale renseignée, FR et AR.

**Limites** : barème « tourisme » uniquement (le catalogue n'a pas de poids total autorisé en charge pour distinguer les utilitaires) ; âge calculé depuis l'année du véhicule, pas sa date d'immatriculation exacte.

## Lot 284 — Estimation Souq Auto affichée à la demande (2026-10-10)

Sur la fiche annonce, l'encart « Estimation Souq Auto » (prix demandé / estimation du marché / écart) ne s'affiche plus automatiquement : un bouton « Voir l'estimation Souq Auto » le révèle au clic (`src/components/EstimationReveal.tsx`). Les chiffres sont déjà calculés côté serveur — aucun appel réseau supplémentaire au clic, seul l'affichage est différé.

Au passage, un test de non-régression a été ajouté sur la vérification d'identité : elle est réservée aux comptes professionnels et à l'équipe de modération depuis le Lot 168, mais aucun test ne couvrait cette règle au niveau de la route — vérifié avec deux comptes de démonstration réels (particulier refusé, professionnel accepté).

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 454 tests** verts (4 nouveaux).
- Réel, dans le navigateur, FR/AR : bouton visible, estimation masquée avant le clic, bloc complet révélé après.

## Lot 285 — Deux correctifs de menu de navigation (2026-10-10)

Deux bugs signalés en utilisant le site en direct, tous deux liés à l'en-tête.

**Menu mobile.** Un compte avec beaucoup d'entrées (équipe back-office) dépassait la hauteur de l'écran : il fallait faire défiler la **page entière** pour atteindre « Déconnexion », tout en bas de la liste — confondu avec un bouton qui ne répond pas. Le panneau (`MobileMenuToggle.tsx`) défile maintenant lui-même (`max-h-[70vh]` + `overflow-y-auto`), et la page derrière ne bouge plus tant qu'il est ouvert (défilement du corps de page bloqué pendant l'ouverture).

**Menu de compte desktop.** Le menu déroulant du compte (« Administrateur ▼ ») s'ouvrait réellement — flèche inversée, `aria-expanded` correct — mais restait **invisible et impossible à cliquer** : le `<nav>` parent portait un `overflow-hidden` qui découpait net le panneau en position absolue s'ouvrant vers le bas, sous la hauteur de l'en-tête. Un essai limité à l'axe horizontal (`overflow-x-hidden`) n'a pas suffi : le CSS force alors `overflow-y` à `auto` au lieu de `visible` (règle du spec sur l'interaction des deux axes), qui rogne quand même. Retiré entièrement dans `SiteHeader.tsx` — vérifié sans débordement horizontal jusqu'à 640 px, la largeur la plus étroite où ce menu apparaît.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 454 tests** verts.
- Réel, avec de **vrais clics** (pas seulement via le DOM, pour écarter un faux positif) : menu mobile défilant jusqu'à Déconnexion sans bouger la page, menu de compte desktop entièrement visible et cliquable jusqu'à Déconnexion.

## Lot 286 — Icônes PWA/Android corrigées, préparation Play Store (2026-10-10)

En préparant la publication sur le Play Store (pas encore de domaine public ni de compte développeur à ce stade), un vrai bug trouvé en régénérant les icônes : trois jeux de fichiers affichaient des dessins **sans aucun rapport avec le logo du site** (`icon.svg`, le losange dégradé turquoise + « S ») — `public/icons/icon-{192,512,maskable-512}.png` et `src/app/apple-icon.png` montraient deux anneaux vert/orange, et les icônes Android (`android/app/src/main/res/mipmap-*/ic_launcher*.png`) un carré arrondi vert-bleu avec une police différente.

**Découverte au passage** : un projet Android complet (Capacitor) existait déjà dans le dépôt, commité le 25 septembre 2026, jamais documenté ni repris depuis — identifiant `dz.souqauto.app`, visant le domaine `souqauto.dz`.

`scripts/generate-pwa-icons.mjs` et `scripts/generate-android-icons.mjs` corrigés pour tracer le vrai losange + « S » (au lieu de leur propre dessin sans lien avec le logo), puis ré-exécutés. Icône maskable et premier plan adaptatif Android replacés dans leur zone de sécurité respective (80 % / 66 %) ; `tests/pwa-manifest.test.ts` (déjà existant) vérifie la première automatiquement.

Nouveau document [`docs/PLAY_STORE.md`](../docs/PLAY_STORE.md) : état exact du projet Capacitor retrouvé, pourquoi Capacitor plutôt qu'une TWA (une TWA exige un domaine public vérifiable dès le premier test, Capacitor peut être testé sans via l'émulateur Android), ordre des étapes restantes, texte de fiche store rédigé à l'avance.

**Vérifié**
- `tsc` 0 ; `eslint .` 0 ; **2 454 tests** verts.
- Rendu de chaque icône (192/512/maskable/apple/5 densités Android) servi réellement par le serveur de dev.

**Limites** : projet Capacitor jamais compilé ni exécuté (ni Android Studio ni le SDK Android installés sur la machine de développement) ; pas de clé de signature ; pas de compte développeur Google Play.

## Lot 287 — Domaine décidé : souqauto.com (2026-10-10)

Décision du porteur de projet, après comparatif de prix et de délais entre `.dz` (dossier NIC-DZ plus long, demande une représentation légale en Algérie) et des génériques : `souqauto.com` comme domaine principal pour démarrer, `.dz` restant une option pour plus tard. Toutes les références codées en dur à `souqauto.dz` mises à jour vers `souqauto.com` : `capacitor.config.ts`, adresse d'expédition des emails, email de contact public, compte admin de dev, annonces anonymisées à la suppression de compte, documentation (README, ANDROID.md, docs/PLAY_STORE.md).

Au passage, identifiant Android changé de `dz.souqauto.app` à `com.souqauto.app` (décision du porteur de projet, pour suivre le nouveau domaine) — dernier moment possible pour le faire sans conséquence, cet identifiant devient définitif après la première publication sur le Play Store.

**Vérifié** : `tsc` 0 ; `eslint .` 0 ; **2 454 tests** verts (1 ajusté).

**Corrigé au lot suivant** : en préparant l'achat réel, `souqauto.com` s'est révélé déjà enregistré par un tiers — voir Lot 288.

## Lot 288 — Domaine réel acheté : souqautos.com (2026-10-10)

`souqauto.com` (Lot 287) est en réalité déjà enregistré par un tiers (transfert verrouillé, non récupérable) : constaté en préparant l'achat chez OVH. Comparatif de domaines de repli fait en direct (`souqautos.com`, `soukautos.com`, noms de marque alternatifs) — `souqautos.com` retenu : même orthographe que la marque « Souq Auto », juste le « s » du pluriel, disponible au prix normal (7,99 € puis 13,49 €/an, contrairement à plusieurs noms proches revendus par des tiers à des prix prohibitifs, jusqu'à 42 472 € constatés pour l'un d'eux).

Domaine et hébergement (VPS) achetés chez OVH par le porteur de projet. Même mise à jour qu'au Lot 287, mais vers `souqautos.com` cette fois ; identifiant Android changé une seconde fois (`com.souqauto.app` → `com.souqautos.app`), dernier moment possible avant publication.

**Vérifié** : `tsc` 0 ; `eslint .` 0 ; **2 454 tests** verts (1 ajusté).

**Bloqué ensuite** : l'espace client OVH affichait une page blanche pour le porteur de projet (après connexion, toutes les routes de l'interface) — aucune panne en cours côté OVH constatée (vérifié sur `status-ovhcloud.com`), donc un problème local (navigateur, extension, ou politique d'entreprise bloquant les outils de développement, jamais confirmé faute d'accès à la console du navigateur). Adresse IP du VPS pas encore récupérée ; mise en ligne du site en attente de cette information.

## QA Phase 3 — Sécurité auth, robustesse API, contraintes DB (2026-10-11)

Cinq corrections issues de l'audit AL HANDASSA, par ordre de priorité.

**M03 — Refresh tokens**
- Modèle `Session` : `refreshTokenHash` (SHA-256, unique), `expiresAt`, `revokedAt`, `userAgent`, `ip`.
- Jeton opaque 32 octets (base64url), rotation à chaque usage, détection de réutilisation (jeton révoqué présenté → révocation de toutes les sessions du compte).
- Access token 15 min, refresh token 30 jours ; endpoint `POST /api/auth/refresh`.
- Intégré dans login, register, callback Google, vérification 2FA, activation 2FA et logout.
- Migration `20261011073430_add_refresh_session`.

**S05 — Préfixe `__Host-` sur les cookies d'authentification**
- En production, les 3 cookies de session/refresh/2FA utilisent le préfixe `__Host-` (impose `Secure`, `Path=/`, pas de `Domain`) — empêche l'injection de cookies depuis un sous-domaine.
- En développement, noms simples conservés (localhost n'est pas HTTPS).

**M04 — Catches silencieux critiques**
- `console.warn` ajouté sur 9 catches serveur (photo-ai, price-ai, similar-ai, price-estimate, payment-fulfillment) qui avalaient les erreurs sans trace.
- Les catches client/navigateur intentionnellement silencieux (localStorage, JWT, JSON parsing) sont laissés tels quels.

**M01 — 96 routes API wrappées avec `apiHandler`**
- Toutes les routes qui n'avaient pas `apiHandler` sont maintenant wrappées : en cas d'erreur non gérée, réponse JSON `{ error: "internal_error" }` avec statut 500 au lieu d'un crash HTML.
- 3 tests adaptés (`push-route`, `prospects-route`, `user-block`) pour le nouveau comportement.

**D01 — 20 CHECK constraints PostgreSQL**
- Contraintes de validation au niveau de la base : prix > 0, montants de paiement > 0, notes 1–5, année 1970–2100, kilométrage 0–2M, puissance fiscale 1–99, portes 1–7, places 1–9, compteurs ≥ 0.
- Migration `20261011080000_check_constraints`.

**Vérifié** : `tsc` 0 erreur ; **2 465 tests** verts (221 fichiers).

## Lot 294 — Historique des prix du marché (2026-10-12)

**Livré**
- Table `MarketPriceSnapshot` (Prisma) : stocke les relevés hebdomadaires P25/médian/P75 par modèle et année, avec nombre d'annonces comparables.
- Module `src/lib/market-price-snapshot.ts` : `takeMarketSnapshots()` (une requête SQL agrégée, un batch insert), `getMarketPriceTrend()` (lecture pour les graphiques), `sweepOldSnapshots()` (rétention 24 mois).
- Composant `MarketPriceTrend` : graphique SVG avec bande P25–P75 et courbe médiane, tooltips, axes auto-scalés, dark mode.
- Intégration page `/cote-souq-auto` : affiche la tendance de prix sous le résultat d'estimation.
- Intégration page modèle `/voitures/[brand]/[model]` : section « Tendance du marché » sous le graphique mensuel existant.
- Snapshot + purge automatiques dans le cron sweep (`/api/cron/sweep`).
- Clés i18n FR/AR (`Estimate.trend*`, `Catalogue.marketTrend*`).
- 9 tests unitaires (ticks, formatage compact, médiane).

**Vérifié** : `tsc --noEmit` zéro erreur, 2 482/2 482 tests OK.

## Lot 293 — Monitoring d'erreurs interne (2026-10-12)

**Livré**
- Table `ErrorLog` (Prisma) : stocke les erreurs serveur, client et violations CSP avec empreinte SHA-256 (fingerprint) pour regrouper les occurrences identiques.
- Module `src/lib/error-log.ts` : `logError()` (jamais d'exception), `errorFingerprint()`, `sweepOldErrorLogs()` (rétention 30 jours, cap 10 000 lignes).
- Persistance serveur : `server-error-alerts.ts` envoie chaque erreur captée par `apiHandler()`/`instrumentation.ts` vers `logError()`.
- Persistance client : les 12 error boundaries appellent `reportClientError()` → `POST /api/errors/report` (rate-limited 10/min/IP, toujours 204).
- Persistance CSP : la route `/api/security/csp-report` persiste les violations non triviales via `logError({ kind: "csp" })`.
- Page admin `/admin/erreurs` (réservée ADMIN) : liste paginée, filtres par type (serveur/client/CSP), stack trace dépliable, empreinte affichée.
- Lien « Erreurs » dans la navigation admin, clés i18n FR/AR (`Admin.navErrors`, `AdminErrors.*`).
- Purge automatique dans le cron sweep (`/api/cron/sweep`).
- `/admin/erreurs` ajouté aux chemins e2e (`e2e/public-paths.ts`).
- 8 tests unitaires (`errorFingerprint` : stabilité, séparation kind/route, première ligne, null/undefined).

**Vérifié** : `tsc --noEmit` zéro erreur, 8/8 tests passent.

## Lot 292 — Fix tests backup-chain (2026-10-12)

**Livré**
- Fix `findPgTool` dans `scripts/pg-helpers.mjs` : vérifie que l'outil PostgreSQL est réellement exécutable (`--version` retourne 0) avant de le retenir, pas seulement qu'il existe sur le disque.
- Cause racine : sous Windows, une politique de contrôle d'application (WDAC/SmartScreen) bloque `pg_dump.exe` (status `0xC0E90002`) sans que Node signale d'erreur. `existsSync` trouvait le fichier mais l'exécution échouait avec status 1 au lieu de 2 (skip).
- 5 tests `backup-chain.test.ts` passent désormais en skip propre (status 2) au lieu d'échouer.

**Vérifié** : suite vitest complète 2 453 passed, 0 failed, 12 skipped.

## Lot 291 — Audit tests e2e (2026-10-12)

**Vérifié**
- 223 tests Playwright exécutés : **20 passed**, 34 failed, 1 flaky, 168 did not run.
- Les 34 échecs sont tous des crashes du worker Chromium (`code=3221225794` = STATUS_ACCESS_VIOLATION), problème environnemental Windows (mémoire/charge machine), pas des assertions qui échouent.
- **0 échec lié au renommage Souq Autos** (Lot 289) : aucun test ne mentionne l'ancien nom dans ses assertions.
- **0 échec lié au merge proxy.ts** (Lot 109) : les tests de sécurité (headers, CSRF) passent quand le worker ne plante pas.
- Résultat identique aux exécutions précédentes (31 échecs au Lot 109, même cause).

## Lot 290 — Audit build production (2026-10-12)

**Livré**
- Build production (`next build` Turbopack) : 0 erreur TypeScript, 222 pages statiques générées, 0 warning.
- Fix warning Turbopack dans `src/lib/uploads.ts` : le pattern `path.join(process.cwd(), "public", storedPath)` matchait 11 496 fichiers. Remplacé par `uploadsRoot()` qui retourne un chemin fixe vers `public/uploads/`.

**Vérifié** : build propre (0 warning, 0 erreur) ; site fonctionnel en mode dev après le fix.

## Lot 289 — Renommage Souq Auto → Souq Autos (2026-10-12)

**Livré**
- Nom de marque aligné sur le domaine `souqautos.com` : « Souq Auto » devient « Souq Autos » dans tout le projet.
- Wordmark du header et du footer (`SiteWordMark.tsx`).
- Traductions FR (83 occurrences) et AR (4 occurrences) : titres de pages, metadata OG, descriptions, emails, notifications.
- Données structurées JSON-LD (publisher, auteur), images de partage, manifest PWA, service worker (notification push par défaut).
- Seeds Prisma, Capacitor, Playwright, scripts i18n.
- Tests unitaires et e2e mis à jour (218 occurrences au total, 84 fichiers).
- Les slugs d'URL (`/cote-souq-auto`) et le domaine (`souqautos.com`, `contact@souqautos.com`) sont inchangés.

**Vérifié** : `tsc` 0 ; **2 453 tests** verts (5 échecs `backup-chain` pré-existants, liés à `pg_dump`) ; site vérifié dans le navigateur (header, footer, titre, bandeau de lancement).

## Lot 109 — Vérification PostgreSQL (2026-10-11)

**Livré**
- Fusion `middleware.ts` → `proxy.ts` : Next.js 16 refuse la coexistence des deux fichiers. La protection CSRF (M02) et le routage i18n + CSP (Lot 134) sont maintenant dans un seul `proxy.ts`, avec un branchement par chemin (`/api/*` → CSRF, pages → i18n + CSP). Test CSRF mis à jour (11/11 verts).
- Vérification complète de la base `souq_auto` sur PostgreSQL :
  - 59 migrations appliquées, schéma à jour (pas de dérive Prisma hormis les 3 index GIN trigram attendus).
  - Extension `pg_trgm` installée, 3 index GIN trigram opérationnels (recherche texte).
  - 3 index uniques partiels présents (`PaymentOrder_pending_unique`, `ProSubscriptionOrder_pending_unique`, `IdentityVerificationRequest_pending_unique`).
  - 20 CHECK constraints appliqués (Phase 3 D01).
  - Table `Session` (9 colonnes, Phase 3 M03).
  - Ligne `ModerationSettings` existante.
  - 62 tables, 16 index sur `Listing`.
- Seeds : 69 wilayas, 1 541 communes, 62 marques, 410 modèles, 67 générations, 25 équipements, 8 utilisateurs, 53 annonces.
- Collation française : tri des wilayas accentuées correct (Béjaïa avant Biskra).
- Application : page d'accueil, recherche (`q=renault` / `q=RENAULT` insensible à la casse), Cote Souq Auto, API health (`database: ok`, `redis: ok`), recherche avec `priceMax` excessif (200 sans crash).
- Base e2e (`souq_auto_e2e`) : reset complet réussi (59 migrations + seeds + 24 annonces démo + 5 annonces équipements).

**Vérifié** : `tsc` 0 ; **2 465 tests** verts ; e2e en cours de vérification.
