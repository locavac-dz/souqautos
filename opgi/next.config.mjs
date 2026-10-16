import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Les en-têtes de sécurité (CSP, HSTS, anti-clickjacking…) sont posés par le
// proxy unique `src/proxy.ts` via `src/lib/http/security-headers.ts` : source
// unique, configurable par variables d'environnement et testée par Vitest.
/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withNextIntl(nextConfig);
