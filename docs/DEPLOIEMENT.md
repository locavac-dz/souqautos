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

**La CI** (`.github/workflows/ci.yml`, tâche `docker`) construit l'image à chaque envoi vers `main` ou `master`. La première exécution réelle est à surveiller.

---

## Prérequis

- Un serveur PostgreSQL 15 ou supérieur (17 recommandé — même version que le client `pg_dump` dans l'image).
- Une base avec une collation FR/Unicode (ex. `fr_FR.UTF-8`), **pas** la collation `C` (les wilayas accentuées seraient mal triées).
- Un serveur web en façade (Nginx, Caddy…) qui gère le TLS et transmet les requêtes au conteneur.
- Docker 24 ou supérieur.

---

## Première mise en ligne

### 1. Construire l'image

`NEXT_PUBLIC_SITE_URL` est **intégrée à la compilation** (URLs canoniques, partages, sitemap, emails). Changer de domaine impose de reconstruire l'image.

```bash
cd app/
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://VOTRE-DOMAINE -t souq-auto:latest .
```

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

Variables recommandées : `VAPID_*` (notifications push), `REDIS_URL` (rate limiting multi-instance), `S3_*` (stockage photos hors conteneur), `STAFF_ALERT_EMAILS` (alertes exploitation).

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
docker compose run --rm tools npm run launch:check -- --env /chemin/de/votre.env
```

Chaque point bloquant (✗) est expliqué avec sa correction. Le contrôle doit répondre « Prêt » avant de démarrer.

### 6. Démarrer

```bash
docker compose up -d app
```

---

## Mises à jour

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://VOTRE-DOMAINE -t souq-auto:latest app/
docker compose run --rm migrate           # appliquer les nouvelles migrations (si aucune : sans effet)
docker compose up -d app                  # remplacer l'image
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

    location / {
        proxy_pass http://127.0.0.1:5184;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Définir `TRUSTED_PROXY_HOPS="1"` (un seul serveur intermédiaire). Sans cette variable, les limites de débit par IP se contournent.

---

## Sauvegardes

Depuis le conteneur `tools` :

```bash
docker compose run --rm tools npm run db:backup -- --with-uploads --out /sauvegardes
```

Les photos sont dans le volume `uploads` (`/app/public/uploads` dans le conteneur) et les pièces d'identité chiffrées dans le volume `private-uploads` (`/app/private-uploads`). `--with-uploads` archive ces deux volumes. Copier ces archives **hors du serveur** (autre machine, autre site) : une sauvegarde sur le même disque disparaît avec lui.

Voir `docs/EXPLOITATION.md`, section 2 pour la planification et les tests de restauration.

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
