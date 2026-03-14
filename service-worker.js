const CACHE_NAME = "red-dune-dash-v2";
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

const NETWORK_FIRST_PATHS = new Set([
  "/",
  "/index.html",
  "/styles.css",
  "/game-endless.js",
  "/manifest.webmanifest"
]);

function isCoreAppRequest(requestUrl) {
  const url = new URL(requestUrl);
  return NETWORK_FIRST_PATHS.has(url.pathname) || NETWORK_FIRST_PATHS.has(`${url.pathname}${url.search}`);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.status === 200 && response.type === "basic") {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw new Error("Network request failed and no cache entry was available.");
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200 && response.type === "basic") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse || networkPromise;
}

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

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (event.request.mode === "navigate" || isCoreAppRequest(event.request.url)) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
