# Souq Auto — publication Play Store (Lot 286)

Complète `docs/DEPLOIEMENT.md` (mise en ligne du site web) et `app/README.md` (démarrage). Suivi de la publication de l'application Android, distincte de la mise en ligne du site.

## Ce qui est prêt, et ce qui ne l'est pas

| Prêt ✓ | Bloqué ⚠ |
|---|---|
| Domaine choisi : `souqauto.com` (le `.dz` demandait une représentation légale en Algérie plus longue à mettre en place — gardé en option pour plus tard, les deux peuvent coexister) | Le domaine n'est pas encore acheté ni le site en ligne dessus — `capacitor.config.ts` vise déjà `https://souqauto.com` par anticipation |
| Projet Android (Capacitor), `android/`, identifiant `com.souqauto.app` (changé depuis `dz.souqauto.app` pour suivre le domaine — décision prise avant toute publication, donc sans conséquence), nom « Souq Auto » | Pas de compte développeur Google Play (25 $, à créer par le porteur de projet) |
| Icônes (lanceur, icône adaptative, PWA) régénérées depuis le vrai logo (Lot 286) | |
| `targetSdkVersion`/`compileSdkVersion` 36 — à jour | Pas de clé de signature (`signingConfigs`) : aucune section dans `android/app/build.gradle` |
| Texte de fiche store rédigé ci-dessous | Jamais compilé ni exécuté : ni Android Studio ni le SDK Android ne sont installés sur la machine de développement actuelle |
| | Captures d'écran, politique de confidentialité publique (exigée par Google) |

Le dossier `android/` a été commité le 25 septembre 2026 (avant le présent lot), puis laissé de côté sans suite ni documentation — retrouvé en préparant les icônes du Lot 286.

## Pourquoi Capacitor plutôt qu'une TWA

Deux approches existaient pour publier la PWA sur le Play Store : une TWA (Trusted Web Activity — ouvre le site dans un onglet Chrome sans coquille native) ou Capacitor (embarque le site dans une vraie app). Le projet Capacitor étant déjà préparé, c'est celui-ci qui est poursuivi.

Différence pratique à retenir : une TWA **exige** un domaine public vérifiable dès le premier test (vérification Digital Asset Links). Capacitor, lui, peut être testé **sans domaine public** : en développement, `capacitor.config.ts` peut pointer vers `http://10.0.2.2:<port>` (adresse spéciale de l'émulateur Android vers la machine hôte) au lieu de `https://souqauto.com`. Le domaine réel ne redevient obligatoire qu'au moment de la version publiée sur le store.

## Étapes restantes, dans l'ordre

1. **Achat du domaine `souqauto.com`** (comparatif fait : 101domain pour un futur `.dz` en option, OVH ou Cloudflare pour le `.com`) **puis mise en ligne du site** (`docs/DEPLOIEMENT.md`) — `capacitor.config.ts` (`server.url`) est déjà réglé sur cette valeur.
2. **Compte développeur Google Play** (25 $, création par le porteur de projet, indépendant du domaine).
3. **Build local** : sur un poste avec Android Studio installé — `npm run android:sync` (copie les fichiers web dans le projet Android) puis ouverture via `npm run android:open`.
4. **Clé de signature** : générée une fois dans Android Studio (Build → Generate Signed Bundle), jamais committée (à ajouter aux exceptions de `.gitignore` le moment venu) — Google Play App Signing peut ensuite gérer la clé finale, l'app n'a besoin que d'une clé de téléversement.
5. **Test réel sur émulateur ou téléphone** (cf. `server.url` en 10.0.2.2 ci-dessus) avant tout envoi au store.
6. **Fiche store** : captures d'écran (au moins 2, téléphone), icône (déjà prête, `public/icons/icon-512.png`), texte ci-dessous, politique de confidentialité publique (à rédiger — Google l'exige même pour une app sans publicité).
7. **Premier envoi** : piste de test interne Google Play avant la diffusion publique.

## Texte de fiche (à ajuster librement)

**Nom de l'app** : Souq Auto

**Description courte** (80 caractères max) :
```
Achetez, vendez et estimez un véhicule en Algérie — recherche, cote, essais
```

**Description complète** :
```
Souq Auto est le moteur de recherche automobile pensé pour l'Algérie : trouvez votre prochain véhicule, vendez le vôtre, et estimez sa valeur en quelques instants.

RECHERCHER ET COMPARER
Filtrez par marque, modèle, wilaya, prix, année et kilométrage. Comparez plusieurs annonces côte à côte avant de vous décider.

ESTIMER UN VÉHICULE
La Cote Souq Auto donne une fourchette de prix indicative à partir des annonces réellement publiées — jamais un chiffre inventé.

VENDRE EN TOUTE CONFIANCE
Publiez une annonce en quelques minutes. Les annonces sans signal d'un vendeur déjà approuvé sont publiées automatiquement ; les autres passent devant notre équipe de modération.

PROFESSIONNELS
Concessionnaires et garages disposent d'une vitrine dédiée, avec import de stock et formules de mise en avant.

AVANT D'ACHETER
Essais auto rédigés par notre équipe, guides d'achat par modèle, avis vérifiés sur les vendeurs.

Toutes les estimations de coûts affichées (comme la vignette automobile) sont calculées à partir de barèmes officiels — jamais approximées.
```

**Catégorie** : Auto et véhicules

**Coordonnées pour la fiche** : email de contact public (`contact@souqauto.com`, déjà affiché sur le site — à vérifier qu'il est bien fonctionnel avant publication, voir `docs/DEPLOIEMENT.md`).

## Limites connues du projet Capacitor actuel

- Jamais compilé : des erreurs de build sont possibles à la première tentative (versions de plugins, Gradle…), normal pour un projet laissé de côté plusieurs semaines.
- Pas de notifications push natives configurées côté Android (le site a des notifications push web, Lot non vérifié pour Capacitor spécifiquement).
- `allowNavigation: ["*.souqauto.com"]` dans `capacitor.config.ts` : à élargir si des services tiers (paiement Chargily, OAuth Google) redirigent vers d'autres domaines pendant le parcours dans l'app.
