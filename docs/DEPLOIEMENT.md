# Souq Auto — guide de déploiement (Lot 147)

Complète `docs/EXPLOITATION.md` (exploitation courante) et `app/README.md` (démarrage). À lire avant la première mise en ligne.

## Ce qui a été vérifié, et ce qui ne l'est pas

Le déploiement Docker a été préparé sur une machine **sans Docker installé**. Voici ce qui a été vérifié en vrai :

| Vérifié ✓ | Non vérifié ⚠ |
|---|---|
| Compilation `next build` sans base ni secrets (seule `NEXT_PUBLIC_SITE_URL` est fournie) | Construction réelle de l'image (`docker build`) |
| Sortie autonome (`BUILD_STANDALONE=1`) produit un serveur `.next/standalone/` | Exécution du conteneur en production |
| Le serveur autonome démarre et répond à `/api/health` | L'étape `migrate` (`prisma migrate deploy`) dans le conteneur |
| Cohérence des fichiers (`tests/deployment-artifacts.test.ts`) | L'étape `tools` (backups, launch:check depuis le conteneur) |
| `.dockerignore` ne casse pas `tsc` (vérification reconstituée) | Le volume uploads monté entre le conteneur et l'hôte |
| Scripts d'exploitation sans fichier `.env` (configuration par variables d'environnement) | Construction des images `migrate` et `tools` (`docker compose build`) et tâches planifiées (`ops/crontab.example`) |

**La CI** (`.github/workflows/ci.yml`, tâche `docker`) construit l'image à chaque envoi vers `main` ou `master`. La première exécution réelle est à surveiller.

---

## Prérequis

- Un serveur PostgreSQL 15 ou supérieur (17 recommandé — même version que le client `pg_dump` dans l'image).
- Une base avec une collation FR/Unicode (ex. `fr_FR.UTF-8`), **pas** la collation `C` (les wilayas accentuées seraient mal triées).
- Un serveur web en façade (Nginx, Caddy…) qui gère le TLS et transmet les requêtes au conteneur.
- Docker 24 ou supérieur.

---

## Première mise en ligne

### 1. Construire les images

Trois images, une par étape du `Dockerfile` : l'application (`runner`), les migrations (`migrate`) et les outils d'exploitation (`tools` : `pg_dump`, scripts de sauvegarde, `launch:check`). `docker compose build` les construit toutes à partir de `docker-compose.yml` (copié de `docker-compose.example.yml`).

`NEXT_PUBLIC_SITE_URL` est **intégrée à la compilation** (URLs canoniques, partages, sitemap, emails) : elle doit figurer dans le `.env` à côté du `docker-compose.yml` **avant** de construire. Changer de domaine impose de reconstruire.

```bash
cd app/
docker compose build
```

> Un simple `docker build` sans `--target` ne produit **que** l'image de l'application : les services `migrate` et `tools` ne fonctionneraient pas (Lot 233).

### 2. Configurer les variables d'environnement

Partir de `app/.env.example` (section « Mise en production »). Variables **obligatoires** :

| Variable | Description |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL de production |
| `JWT_SECRET` | Secret des sessions (`openssl rand -base64 48`) |
| `ENCRYPTION_KEY` | Clé AES-256 pour les données sensibles (`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`) |
| `NEXT_PUBLIC_SITE_URL` | Domaine public en https (intégré au build) |
| `SMTP_HOST` + `SMTP_*` | Envoi d'emails (vérification d'adresse, modération) |
| `TRUSTED_PROXY_HOPS` | Nombre de serveurs intermédiaires devant l'application (1 pour Nginx seul) |
| `ADMIN_EMAIL` + `ADMIN_PASSWORD` | Compte administrateur initial |

Variables recommandées : `OPS_ALERT_EMAILS` (alertes techniques : sauvegarde en panne, site injoignable, erreurs 500 — **sans elle, personne n'est prévenu**), `STAFF_ALERT_EMAILS` (file de modération ; reçoit aussi les alertes techniques si `OPS_ALERT_EMAILS` est vide), `VAPID_*` (notifications push), `REDIS_URL` (rate limiting multi-instance), `S3_*` (stockage photos hors conteneur). Les alertes partent par courriel : elles exigent aussi les variables `SMTP_*`.

### 3. Appliquer les migrations

```bash
docker compose run --rm migrate
```

### 4. Créer les données de référence et le compte administrateur

```bash
docker compose run --rm tools npm run db:seed
```

**Ne jamais** lancer `npm run db:seed:demo` en production (données de démonstration).

### 5. Contrôle avant démarrage

```bash
docker compose run --rm tools npm run launch:check
```

Dans le conteneur, la configuration est lue dans les variables d'environnement transmises par `docker-compose.yml` (pas de fichier `.env` dans l'image).

Chaque point bloquant (✗) est expliqué avec sa correction. Le contrôle doit répondre « Prêt » avant de démarrer.

### 6. Démarrer

```bash
docker compose up -d app
```

---

## Mises à jour

```bash
cd app/
docker compose build                      # les trois images
docker compose run --rm migrate           # appliquer les nouvelles migrations (si aucune : sans effet)
docker compose up -d app                  # remplacer l'application
```

---

## Serveur web et TLS

L'image écoute sur le port `5184`. Ne jamais l'exposer directement : un serveur web (Nginx, Caddy…) doit accepter les connexions HTTPS et les transmettre en HTTP à ce port.

**Caddy** (le plus simple — TLS automatique Let's Encrypt) :

```
VOTRE-DOMAINE {
    reverse_proxy localhost:5184
}
```

**Nginx** (extrait) :

```nginx
server {
    listen 443 ssl;
    server_name VOTRE-DOMAINE;
    # ssl_certificate / ssl_certificate_key ...

    # Taille maximale d'un envoi. Nginx refuse par défaut tout ce qui dépasse 1 Mo (erreur 413) : sans ce réglage, la
    # plupart des photos seraient refusées. 10 Mo couvrent tous les envois à un seul fichier (photo de profil 4 Mo,
    # pièce d'identité, bannière ou couverture 8 Mo, pièce jointe 5 Mo, import CSV 4 Mo).
    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:5184;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Publication et modification d'une annonce : jusqu'à 10 photos de 8 Mo dans un même envoi
    # (MAX_PHOTOS de src/app/api/listings/, MAX_PHOTO_BYTES de src/lib/uploads.ts) — 80 Mo, plus le formulaire.
    location /api/listings {
        client_max_body_size 90m;
        client_body_timeout 120s;      # connexion mobile lente : ne pas couper un envoi en cours
        proxy_read_timeout 120s;       # le serveur recadre et compresse chaque photo avant de répondre
        proxy_pass http://127.0.0.1:5184;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Définir `TRUSTED_PROXY_HOPS="1"` (un seul serveur intermédiaire). Sans cette variable, les limites de débit par IP se contournent. Pour la même raison, `docker-compose.example.yml` ne publie le port 5184 que sur `127.0.0.1` : joignable en direct, l'application recevrait des en-têtes `X-Forwarded-For` choisis par le visiteur.

Caddy n'impose pas de taille maximale par défaut : rien à régler.

Si ces limites changent dans le code (nombre ou taille des photos), ajuster `client_max_body_size` en conséquence.

---

## Sauvegardes

Depuis le conteneur `tools` :

```bash
mkdir -p backups && chmod 700 backups          # une fois
docker compose run --rm tools npm run db:backup -- --with-uploads
```

La sauvegarde de la base, l'archive des photos (volume `uploads`) et celle des pièces d'identité chiffrées (volume `private-uploads`) sont écrites dans `app/backups/` **sur l'hôte** : le service `tools` monte ce dossier, et les deux volumes en lecture seule. Le journal `backups/status.json`, que lit le veilleur, y est aussi. Copier ce dossier **hors du serveur** (autre machine, autre site) : une sauvegarde sur le même disque disparaît avec lui.

**Planification** : sauvegarde chaque nuit, veilleur chaque heure, test de restauration chaque semaine. Lignes prêtes à coller dans `app/ops/crontab.example`, variante A (Docker). Le veilleur prévient par courriel : définir `OPS_ALERT_EMAILS` **et** les `SMTP_*` dans la configuration, décommentés dans la section `environment` de `docker-compose.yml`. Sans eux, une sauvegarde en panne ne prévient personne. Essayer chaque ligne une fois à la main avant de s'y fier.

Voir `docs/EXPLOITATION.md`, section 2 pour les tests de restauration et la restauration réelle.

---

## Variables d'exploitation supplémentaires

Ces variables se lisent **au démarrage** (pas intégrées au build) et peuvent être changées sans reconstruire l'image.

| Variable | Défaut | Usage |
|---|---|---|
| `CSP_REPORT_ONLY` | absent | `"1"` = CSP en observation seule après un déploiement, à retirer une fois les journaux validés |
| `SMTP_SECURE` | auto | `"true"` = TLS implicite, `"false"` = STARTTLS (utile sur ports non standard) |
| `SLOW_QUERY_MS` | absent | Journalise les requêtes SQL lentes de plus de N ms (ex. `"200"` en production) |
| `RESPONSIVENESS_CACHE_TTL_MS` | `300000` | Durée du cache des badges de réactivité vendeur (5 min) — ne pas mettre à 0 |
| `REQUIRE_STAFF_2FA` | auto | `"1"` = 2FA toujours exigée pour l'équipe, `"0"` = jamais (dépannage seulement) |

---

## Surveillance

- `GET /api/health` → 200 = base joignable, 503 = base injoignable.
- `npm run ops:check` (depuis `tools`) : état de la sauvegarde, de la restauration, de l'espace disque, du site.
- Journal des erreurs 500 : les adresses de `OPS_ALERT_EMAILS` reçoivent une alerte par email (max. 6/h).
- Journal des requêtes SQL lentes : activer `SLOW_QUERY_MS="200"` et surveiller les lignes `[sql-lent]`.
