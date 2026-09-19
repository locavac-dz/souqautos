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
