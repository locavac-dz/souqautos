import { fileURLToPath } from "url";
import { dirname } from "path";
import createNextIntlPlugin from "next-intl/plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const s3PublicUrl = process.env.S3_PUBLIC_URL ? new URL(process.env.S3_PUBLIC_URL) : null;

const s3HostIsLocalOrPrivateIp = s3PublicUrl
  ? /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|::1$|localhost$)/.test(s3PublicUrl.hostname)
  : false;

// En-têtes fixes copiés depuis src/lib/security-headers.ts — next.config.mjs doit être du JS pur
// (pas de SWC pour le transpiler), donc cette fonction est dupliquée ici intentionnellement.
function staticSecurityHeaders(production) {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
    { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ];
  if (production) headers.push({ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" });
  return headers;
}

const nextConfig = {
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone", outputFileTracingRoot: __dirname } : {}),
  // Serveur de développement des tests de bout en bout (playwright.config.ts) : pas de redémarrage automatique.
  // Next.js (dev) redémarre le serveur quand le tas dépasse 80 % de sa limite ; V8 remplit volontiers un tas de
  // 4,3 Go sans que les données soient vivantes (mesuré en CI : mémoire du serveur de test 4 → 8 Go sur ~20 min, un
  // redémarrage par run, requêtes en cours coupées). Le tas reste borné par V8, qui collecte plus fort près de sa limite.
  // `undefined` hors tests : le comportement par défaut de Next.js est conservé pour le développement ordinaire.
  ...(process.env.E2E_NO_MEMORY_RESTART === "1" ? { experimental: { devMemoryThresholdRestart: false } } : {}),
  // Packages that use Node.js built-ins (stream, net, tls…) must not be bundled by webpack.
  // Turbopack resolves these natively; webpack needs them listed both here (for RSC/route handlers)
  // and in the webpack() hook below (for instrumentation.ts which is bundled separately).
  serverExternalPackages: ["ioredis", "nodemailer", "sharp", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"],
  webpack(config, { isServer }) {
    if (isServer) {
      config.externals.push("ioredis", "nodemailer", "sharp", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner");
    }
    return config;
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders(process.env.NODE_ENV === "production"),
      },
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
  turbopack: {
    root: __dirname,
  },
  images: {
    minimumCacheTTL: 31_536_000,
    formats: ["image/avif", "image/webp"],
    ...(s3PublicUrl
      ? {
          remotePatterns: [
            {
              protocol: s3PublicUrl.protocol.replace(":", ""),
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
