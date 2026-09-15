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

const nextConfig: NextConfig = {
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
        },
      }
    : {}),
};

export default withNextIntl(nextConfig);
