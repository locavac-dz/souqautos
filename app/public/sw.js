/* Souq Auto — service worker (Lot 120)
 *
 * Volontairement MINIMAL et prudent :
 *  - il ne met JAMAIS en cache une page HTML ni une réponse d'API : elles sont personnalisées
 *    (compte, messages, favoris) et resteraient lisibles par la personne suivante sur un
 *    téléphone ou un poste partagé, ou périmées ;
 *  - il ne met en cache que des fichiers statiques immuables (`/_next/static/`, `/icons/`) ;
 *  - hors connexion, une navigation affiche une page fixe (`/offline.html`), rien d'autre.
 *
 * Enregistré seulement en production (voir src/components/PwaRegister.tsx). La décision « que
 * faire de cette requête » est isolée dans `classifyRequest`, testée par tests/pwa-sw.test.ts.
 */

const VERSION = "v1";
const STATIC_CACHE = "souq-static-" + VERSION;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];

/**
 * @param {{ method: string, mode: string, url: string, headers: { get(name: string): string | null } }} request
 * @param {string} origin origine du site (self.location.origin)
 * @returns {"ignore" | "navigate" | "static"}
 */
function classifyRequest(request, origin) {
  if (request.method !== "GET") return "ignore";

  let url;
  try {
    url = new URL(request.url);
  } catch (e) {
    return "ignore";
  }
  if (url.origin !== origin) return "ignore";

  // Jamais l'API, ni les échanges internes de Next entre pages (données RSC, préchargements) :
  // le navigateur et le serveur les gèrent, et ils sont personnalisés.
  if (url.pathname.startsWith("/api/")) return "ignore";
  if (
    request.headers.get("rsc") ||
    request.headers.get("next-router-prefetch") ||
    request.headers.get("next-router-state-tree") ||
    request.headers.get("next-url")
  ) {
    return "ignore";
  }

  if (request.mode === "navigate") return "navigate";
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) return "static";
  return "ignore";
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("install", function (event) {
    event.waitUntil(
      caches
        .open(STATIC_CACHE)
        .then(function (cache) {
          return cache.addAll(PRECACHE);
        })
        .then(function () {
          return self.skipWaiting();
        })
    );
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (names) {
          return Promise.all(
            names
              .filter(function (name) {
                return name.indexOf("souq-") === 0 && name !== STATIC_CACHE;
              })
              .map(function (name) {
                return caches.delete(name);
              })
          );
        })
        .then(function () {
          return self.clients.claim();
        })
    );
  });

  self.addEventListener("fetch", function (event) {
    const kind = classifyRequest(event.request, self.location.origin);
    if (kind === "ignore") return; // le navigateur traite la requête normalement

    if (kind === "navigate") {
      // Réseau d'abord : la page est toujours celle du serveur. Seule une panne réseau
      // (hors connexion) bascule sur la page fixe ; une erreur 4xx/5xx du serveur s'affiche telle quelle.
      event.respondWith(
        fetch(event.request).catch(function () {
          return caches.match(OFFLINE_URL).then(function (page) {
            return page || Response.error();
          });
        })
      );
      return;
    }

    // Fichiers statiques immuables : cache d'abord (leurs noms changent avec leur contenu).
    event.respondWith(
      caches.open(STATIC_CACHE).then(function (cache) {
        return cache.match(event.request).then(function (hit) {
          if (hit) return hit;
          return fetch(event.request).then(function (response) {
            if (response.ok && response.type === "basic") cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  });
}

// Utilisé par les tests (Node) ; sans effet dans le navigateur.
if (typeof module !== "undefined" && module.exports) {
  module.exports = { classifyRequest, STATIC_CACHE, OFFLINE_URL, PRECACHE, VERSION };
}
