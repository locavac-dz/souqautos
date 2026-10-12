/* Souq Autos — service worker (Lot 120)
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
  } catch {
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

/**
 * Lot 121 — notifications. Le contenu vient du serveur, mais il est validé ici quand même : un
 * message mal formé ne doit jamais produire une notification vide ni ouvrir une autre adresse.
 * @param {string} text corps JSON du message reçu
 * @returns {{ title: string, body: string, url: string, tag: string, lang: "fr" | "ar" }}
 */
function parsePushPayload(text) {
  let data = {};
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") data = parsed;
  } catch {
    /* message non JSON : notification par défaut */
  }
  const str = function (value, max) {
    return typeof value === "string" ? value.slice(0, max) : "";
  };
  return {
    title: str(data.title, 120) || "Souq Autos",
    body: str(data.body, 200),
    url: typeof data.url === "string" ? data.url : "/",
    tag: str(data.tag, 80) || "souq-auto",
    lang: data.lang === "ar" ? "ar" : "fr",
  };
}

/**
 * Adresse à ouvrir au clic : toujours une page DU SITE (chemin + paramètres), jamais une autre
 * origine ni un schéma comme `javascript:`.
 * @param {unknown} url
 * @param {string} origin
 * @returns {string}
 */
function safeTargetUrl(url, origin) {
  if (typeof url !== "string") return "/";
  try {
    const target = new URL(url, origin);
    return target.origin === origin ? target.pathname + target.search + target.hash : "/";
  } catch {
    return "/";
  }
}

if (typeof self !== "undefined" && typeof self.addEventListener === "function") {
  self.addEventListener("push", function (event) {
    const payload = parsePushPayload(event.data ? event.data.text() : "");
    event.waitUntil(
      self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icons/icon-192.png",
        tag: payload.tag,
        lang: payload.lang,
        dir: payload.lang === "ar" ? "rtl" : "ltr",
        data: { url: safeTargetUrl(payload.url, self.location.origin) },
      })
    );
  });

  self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    const origin = self.location.origin;
    const target = safeTargetUrl(event.notification.data && event.notification.data.url, origin);
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windows) {
        // Un onglet du site est déjà ouvert : on l'utilise plutôt que d'en empiler un autre.
        for (let i = 0; i < windows.length; i++) {
          const client = windows[i];
          if (new URL(client.url).origin === origin && "focus" in client) {
            return client.focus().then(function (focused) {
              return focused && "navigate" in focused ? focused.navigate(target) : self.clients.openWindow(target);
            });
          }
        }
        return self.clients.openWindow(target);
      })
    );
  });

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
  module.exports = { classifyRequest, parsePushPayload, safeTargetUrl, STATIC_CACHE, OFFLINE_URL, PRECACHE, VERSION };
}
