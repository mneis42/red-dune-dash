const CACHE_NAME = "red-dune-dash-v1";
const APP_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./game-endless.js",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./icons/icon-128x128.png",
  "./icons/icon-144x144.png",
  "./icons/icon-152x152.png",
  "./icons/icon-192x192.png",
  "./icons/icon-256x256.png",
  "./icons/icon-384x384.png",
  "./icons/icon-512x512.png",
  "./assets/run1.png",
  "./assets/run2.png",
  "./assets/run3.png",
  "./assets/run4.png",
  "./assets/run5.png",
  "./assets/run6.png",
  "./assets/jump-up.png",
  "./assets/jump-down.png",
  "./assets/bug.png",
  "./assets/game-over.png",
  "./assets/rocket-from-left.png",
  "./assets/rocket-from-right.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      });
    })
  );
});
