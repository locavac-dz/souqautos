import { config } from "zod/v4/core";

// Lot 134 — s'exécute dans le NAVIGATEUR avant que la page devienne interactive (Next.js : instrumentation-client).
//
// La bibliothèque de validation zod (v4) compile ses schémas en fonctions grâce à `new Function(…)`, après avoir SONDÉ
// si c'est permis (`Function("")` dans un try/catch). La politique de sécurité du site (src/proxy.ts) interdit
// volontairement `eval` et `new Function` (pas de 'unsafe-eval' en production) : la sonde échoue proprement — le site
// fonctionne — mais le navigateur signale QUAND MÊME une violation, à chaque page vue. Ces faux rapports noieraient les
// vrais dans les journaux (/api/security/csp-report) et empêcheraient de garder la politique en mode strict sans bruit.
//
// `jitless` ordonne à zod de ne jamais sonder ni compiler : ses schémas s'exécutent en mode interprété, un peu plus lent
// (imperceptible pour les quelques validations faites dans le navigateur). Côté serveur, zod garde sa compilation :
// la politique ne s'y applique pas.
config({ jitless: true });
