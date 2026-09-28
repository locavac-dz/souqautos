#!/usr/bin/env node
// Appelle POST /api/cron/sweep sur l'instance locale (NEXT_PUBLIC_SITE_URL).
// Utilisé par ops/crontab.example : npm run cron:sweep
// Nécessite NEXT_PUBLIC_SITE_URL et CRON_SECRET dans l'environnement.

import { loadEnv } from "./pg-helpers.mjs";

loadEnv();

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const secret = process.env.CRON_SECRET;

if (!siteUrl) {
  console.error("[cron:sweep] NEXT_PUBLIC_SITE_URL manquant");
  process.exit(1);
}
if (!secret) {
  console.error("[cron:sweep] CRON_SECRET manquant");
  process.exit(1);
}

const url = `${siteUrl}/api/cron/sweep`;
const res = await fetch(url, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});

if (!res.ok) {
  const body = await res.text().catch(() => "");
  console.error(`[cron:sweep] HTTP ${res.status} — ${body}`);
  process.exit(1);
}

const data = await res.json();
console.log(`[cron:sweep] OK — sweptAt: ${data.sweptAt}`);
