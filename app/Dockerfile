# syntax=docker/dockerfile:1

# Souq Auto — image de production (Lot 147).
#
# ⚠ CETTE IMAGE N'A PAS ÉTÉ CONSTRUITE PAR SON AUTEUR : Docker n'est pas installé sur la machine de développement. Ce qui a été vérifié EN
# VRAI, sans Docker : la compilation sans base ni secrets (seule NEXT_PUBLIC_SITE_URL est fournie), la compilation autonome, son exécution
# dans un dossier reconstitué comme ce dossier l'est ici, et la cohérence de ces fichiers entre eux et avec le projet
# (tests/deployment-artifacts.test.ts). Ce qui ne l'est PAS : la construction de l'image elle-même. La CI (.github/workflows/ci.yml, tâche
# « docker ») la construit à chaque envoi. Voir docs/DEPLOIEMENT.md, section « Ce qui est vérifié, et ce qui ne l'est pas ».
#
# Construire (depuis le dossier app/) :
#   docker build --build-arg NEXT_PUBLIC_SITE_URL=https://VOTRE-DOMAINE -t souq-auto .
#
# NEXT_PUBLIC_SITE_URL est INTÉGRÉE à la compilation (adresses canoniques, plan du site, partages, courriels) : changer de domaine oblige à
# RECONSTRUIRE l'image. Tous les autres réglages se lisent au démarrage (variables d'environnement), aucun secret n'entre dans l'image.

ARG NODE_VERSION=24

# ---------------------------------------------------------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
# openssl : requis par le moteur de Prisma. Debian et non Alpine : Prisma et sharp y disposent de leurs binaires précompilés (glibc).
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------------------------------------------------------------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------------------------------------------------------------
FROM deps AS build
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
COPY . .
RUN npx prisma generate
# Compilation « autonome » (next.config.ts) : le serveur et SEULES les dépendances qu'il utilise. Aucune base ni aucun secret n'est requis.
RUN BUILD_STANDALONE=1 npm run build

# ---------------------------------------------------------------------------------------------------------------------------------
# Applique les migrations de la base (`prisma migrate deploy`), puis s'arrête. Lancée AVANT l'application (docker-compose.example.yml).
FROM deps AS migrate
COPY prisma ./prisma
COPY package.json ./
CMD ["npx", "prisma", "migrate", "deploy"]

# ---------------------------------------------------------------------------------------------------------------------------------
# Outils d'exploitation : contrôle de mise en ligne, création de l'administrateur, sauvegardes. Non lancée en permanence.
FROM build AS tools
# Le client PostgreSQL 17 : les sauvegardes (pg_dump) doivent être de la version du serveur, ou plus récente. Debian 12 n'a que la 15.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl gnupg \
 && install -d /usr/share/keyrings \
 && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /usr/share/keyrings/pgdg.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/pgdg.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends postgresql-client-17 \
 && rm -rf /var/lib/apt/lists/*
CMD ["npm", "run", "launch:check"]

# ---------------------------------------------------------------------------------------------------------------------------------
# L'application. Dernière étape : c'est la cible par défaut de `docker build`.
FROM base AS runner
ENV NODE_ENV=production \
    PORT=5184 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 souq \
 && useradd --system --uid 1001 --gid souq --home-dir /app souq

COPY --from=build --chown=souq:souq /app/.next/standalone ./
COPY --from=build --chown=souq:souq /app/.next/static ./.next/static
# `public/` SANS les photos (.dockerignore) : elles vivent dans un VOLUME, jamais dans l'image. Sans volume, elles disparaîtraient à chaque
# remplacement du conteneur. Le dossier appartient à l'utilisateur de l'application, qui y écrit chaque photo envoyée.
COPY --from=build --chown=souq:souq /app/public ./public
RUN mkdir -p public/uploads && chown -R souq:souq public/uploads
VOLUME ["/app/public/uploads"]

USER souq
EXPOSE 5184

# `/api/health` : 200 = l'application répond et la base est joignable ; 503 = base injoignable (docs/EXPLOITATION.md, section 3).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
