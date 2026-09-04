# Souq Auto — journal des lots

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
