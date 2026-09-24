# Souq Auto — Build Android (Play Store)

## Prérequis

| Outil | Version minimale | Lien |
|---|---|---|
| Android Studio | Hedgehog (2023.1) ou plus récent | https://developer.android.com/studio |
| JDK | 17 | inclus avec Android Studio |
| SDK Android | API 36 (Android 16) | via SDK Manager dans Android Studio |

## 1. Avant le premier build — mettre l'URL de production

Dans [`capacitor.config.ts`](./capacitor.config.ts), remplacer la valeur de `server.url` :

```ts
server: {
  url: "https://souqauto.dz",   // ← votre URL de production
  ...
}
```

Puis synchroniser :

```bash
npm run android:sync
```

## 2. Ouvrir le projet dans Android Studio

```bash
npm run android:open
```

Android Studio s'ouvre sur le dossier `android/`. Laisser Gradle finir la synchronisation.

## 3. Builder un APK de test (debug)

Dans Android Studio : **Build → Build Bundle(s) / APK(s) → Build APK(s)**

Le fichier est généré dans :
```
android/app/build/outputs/apk/debug/app-debug.apk
```

Transférer sur le téléphone (USB ou e-mail) et installer.

## 4. Builder le AAB pour le Play Store (release)

### 4-a. Créer la keystore (une seule fois)

Dans Android Studio : **Build → Generate Signed Bundle / APK**
- Choisir **Android App Bundle**
- Créer une nouvelle keystore (ou utiliser une existante)
- **IMPORTANT** : conserver le fichier `.jks` et le mot de passe en lieu sûr — sans eux, impossible de mettre à jour l'app sur le Play Store

### 4-b. Signer et exporter le AAB

Suivre l'assistant Android Studio. Le fichier `.aab` sera dans :
```
android/app/release/app-release.aab
```

## 5. Publier sur le Google Play Store

1. Créer un compte développeur sur https://play.google.com/console (25 $ une fois)
2. Créer une nouvelle application : **Souq Auto** / `dz.souqauto.app`
3. Remplir la fiche (description, captures d'écran, icône 512×512 px)
4. Uploader le `.aab` dans **Production → Créer une nouvelle version**
5. Soumettre à la review Google (1 à 7 jours pour la première version)

## Mise à jour de l'app

Comme l'app charge le site en production via `server.url`, **les mises à jour du site web ne nécessitent pas de republier sur le Play Store** — elles sont visibles immédiatement.

Republier sur le Play Store uniquement si :
- `capacitor.config.ts` change (nouvelle URL, nouveaux plugins natifs)
- Des permissions Android changent
- `versionCode` / `versionName` dans `app/build.gradle` sont incrémentés

## Connexion Google OAuth

La `MainActivity.java` retire le marqueur `; wv` du User-Agent pour éviter le blocage de Google Sign-In dans les WebViews. Tester le flux de connexion Google sur un appareil réel avant de soumettre.

## Développement local (émulateur Android)

Pour tester l'app avec le serveur Next.js local :

1. Dans `capacitor.config.ts`, changer temporairement l'URL :
   ```ts
   url: "http://10.0.2.2:3000",  // localhost vu depuis l'émulateur
   cleartext: true,               // HTTP autorisé en dev uniquement
   ```
2. Ajouter dans `AndroidManifest.xml` :
   ```xml
   <application android:usesCleartextTraffic="true" ...>
   ```
3. `npm run android:sync`
4. Lancer le serveur Next.js : `npm run dev`
5. Lancer l'émulateur depuis Android Studio

**Ne jamais commiter ces changements en production.**
