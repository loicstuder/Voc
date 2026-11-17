// Cache hors-ligne. Stratégie "stale-while-revalidate" : l'app s'ouvre instantanément
// depuis le cache, et se met à jour en arrière-plan (nouveau vocabulaire visible au
// lancement suivant).
const CACHE_NAME = "voc-v1";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "engine.js",
  "app.js",
  "data/vocab.js",
  "manifest.json",
  "icon.svg",
  "icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req, { ignoreSearch: true }).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        if (cached) {
          event.waitUntil(network);
          return cached;
        }
        return network;
      })
    )
  );
});
