import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Un package.json préexistant dans le dossier utilisateur (hors de ce projet)
  // fait remonter Turbopack plus haut que nécessaire : on fixe la racine ici.
  turbopack: {
    root: __dirname,
  },
};

export default withNextIntl(nextConfig);
