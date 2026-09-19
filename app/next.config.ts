import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Autorise next/image à charger les photos stockées sur S3 (cf.
// src/lib/uploads.ts, src/lib/storage.ts) quand S3_PUBLIC_URL est
// configurée — sans elle, aucune URL externe n'est jamais utilisée
// (repli disque local), donc rien à autoriser ici. Protocole/port lus
// dynamiquement (jamais "https" en dur) pour accepter aussi bien un
// MinIO local en http (ex. vérification en conditions réelles) qu'un
// fournisseur en production.
const s3PublicUrl = process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL) : null;

// next/image refuse par défaut de proxyer une image dont l'hôte résout vers
// une IP privée (protection SSRF). Un MinIO/S3-compatible auto-hébergé sur le
// même réseau privé que le serveur applicatif (cas de vérification locale, ou
// déploiement volontairement interne en production) est un usage légitime :
// on ne désactive cette protection que pour l'hôte S3 explicitement
// allowlisté ci-dessus via remotePatterns, jamais globalement pour d'autres
// hôtes — donc sans risque ajouté même si S3_PUBLIC_URL pointe vers une IP
// publique classique, où ce drapeau n'a de toute façon aucun effet.
const s3HostIsLocalOrPrivateIp = s3PublicUrl
  ? /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$|localhost$)/.test(s3PublicUrl.hostname)
  : false;

const nextConfig: NextConfig = {
  // Lot 120 — le service worker doit toujours être revérifié : sinon une ancienne version
  // pourrait rester active chez les visiteurs après une mise à jour du site.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  // Un package.json préexistant dans le dossier utilisateur (hors de ce projet)
  // fait remonter Turbopack plus haut que nécessaire : on fixe la racine ici.
  turbopack: {
    root: __dirname,
  },
  ...(s3PublicUrl
    ? {
        images: {
          remotePatterns: [
            {
              protocol: s3PublicUrl.protocol.replace(":", "") as "http" | "https",
              hostname: s3PublicUrl.hostname,
              port: s3PublicUrl.port || undefined,
            },
          ],
          ...(s3HostIsLocalOrPrivateIp ? { dangerouslyAllowLocalIP: true } : {}),
        },
      }
    : {}),
};

export default withNextIntl(nextConfig);
