// Lot 121 — génère la paire de clés VAPID du site (notifications push).
//
//   npm run push:keys                 → écrit les trois variables dans .env (sans afficher la clé privée)
//   npm run push:keys -- --print      → affiche les trois lignes, à copier dans la configuration du serveur
//   npm run push:keys -- --force      → remplace une paire déjà présente dans .env
//   npm run push:keys -- --subject "mailto:contact@votre-domaine.dz"
//
// ATTENTION : changer la paire invalide tous les abonnements existants (les appareils devront
// réactiver les notifications). N'écrase donc jamais une paire déjà en place sans --force.
// En production, ne pas exécuter ce script sur le serveur : générer une fois la paire, la placer
// dans le gestionnaire de secrets, et ne plus y toucher.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import webpush from "web-push";

const args = process.argv.slice(2);
const print = args.includes("--print");
const force = args.includes("--force");
const subjectFlag = args.indexOf("--subject");
const subject = subjectFlag >= 0 ? args[subjectFlag + 1] : "mailto:contact@souqauto.dz";

if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/\S+)$/.test(subject ?? "")) {
  console.error('--subject doit être une adresse « mailto:nom@domaine » ou une adresse https://.');
  process.exit(2);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

if (print) {
  console.log(`VAPID_PUBLIC_KEY="${publicKey}"`);
  console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
  console.log(`VAPID_SUBJECT="${subject}"`);
  process.exit(0);
}

const envPath = path.resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  console.error(`Fichier introuvable : ${envPath}. Créez-le à partir de .env.example, ou utilisez --print.`);
  process.exit(2);
}

const current = readFileSync(envPath, "utf8");
const hasKeys = /^\s*VAPID_(PUBLIC|PRIVATE)_KEY\s*=\s*\S/m.test(current);
if (hasKeys && !force) {
  console.error("Une paire de clés VAPID existe déjà dans .env : elle n'est pas remplacée (les abonnements existants cesseraient de fonctionner).");
  console.error("Ajoutez --force pour la remplacer quand même.");
  process.exit(1);
}

const kept = current
  .split(/\r?\n/)
  .filter((line) => !/^\s*VAPID_(PUBLIC_KEY|PRIVATE_KEY|SUBJECT)\s*=/.test(line))
  .join("\n")
  .replace(/\n+$/, "");
const block = ["", "", "# Notifications push (Lot 121) — généré par npm run push:keys", `VAPID_PUBLIC_KEY="${publicKey}"`, `VAPID_PRIVATE_KEY="${privateKey}"`, `VAPID_SUBJECT="${subject}"`, ""].join("\n");
writeFileSync(envPath, kept + block);

console.log(`Clés VAPID écrites dans ${envPath} (clé privée non affichée).`);
console.log(`Sujet : ${subject}`);
console.log("Redémarrez le serveur pour les prendre en compte.");
