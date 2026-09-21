import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { staticSecurityHeaders } from "./src/lib/security-headers";

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
  // Lot 147 — compilation « autonome » (dossier `.next/standalone` : le serveur et SEULES les dépendances qu'il utilise), pour une
  // image de conteneur légère. Activée à la demande (`BUILD_STANDALONE=1`, ce que fait le Dockerfile) : la compilation ordinaire,
  // le démarrage `next start` et les tests de production ne changent pas. La racine de suivi est fixée ici pour la même raison que
  // celle de Turbopack ci-dessous : sans cela, un dossier parent contenant un package.json déplacerait tout le serveur d'un cran.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const, outputFileTracingRoot: __dirname } : {}),
  // Lot 134 — n'annonce plus « X-Powered-By: Next.js » : inutile aux visiteurs, utile à qui cherche une version vulnérable.
  poweredByHeader: false,
  // Lot 120 — le service worker doit toujours être revérifié : sinon une ancienne version
  // pourrait rester active chez les visiteurs après une mise à jour du site.
  async headers() {
    return [
      // Lot 134 — en-têtes de sécurité fixes, sur TOUTES les réponses (pages, API, fichiers). La politique de sécurité des
      // contenus (CSP), elle, change à chaque requête (nonce) : elle est posée par src/proxy.ts.
      {
        source: "/:path*",
        headers: staticSecurityHeaders(process.env.NODE_ENV === "production"),
      },
      // Lot 135 — les photos envoyées ont toutes un nom aléatoire unique (UUID, src/lib/uploads.ts) et ne sont jamais
      // réécrites : une photo remplacée reçoit un NOUVEAU nom. Le navigateur peut donc les garder un an sans jamais les
      // redemander (sans cette ligne, il les revérifie à chaque page). Ne JAMAIS y mettre un fichier au nom réutilisable.
      {
        source: "/uploads/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
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
  images: {
    // Lot 135 — les versions redimensionnées des photos sont gardées un an par le serveur (par défaut : 60 secondes, donc
    // recalculées sans cesse). Même raison que ci-dessus : les noms de fichiers ne sont jamais réutilisés.
    minimumCacheTTL: 31_536_000,
    ...(s3PublicUrl
      ? {
          remotePatterns: [
            {
              protocol: s3PublicUrl.protocol.replace(":", "") as "http" | "https",
              hostname: s3PublicUrl.hostname,
              port: s3PublicUrl.port || undefined,
            },
          ],
          ...(s3HostIsLocalOrPrivateIp ? { dangerouslyAllowLocalIP: true } : {}),
        }
      : {}),
  },
};

export default withNextIntl(nextConfig);
