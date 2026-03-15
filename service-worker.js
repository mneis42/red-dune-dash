importScripts("./app-assets.js");

const CACHE_NAME = globalThis.RED_DUNE_ASSET_MANIFEST?.cacheName ?? "red-dune-dash-v3";
const APP_ASSETS = globalThis.RED_DUNE_ASSET_MANIFEST?.offlineCacheAssets ?? [
  "./",
  "./index.html",
  "./styles.css",
  "./app-assets.js",
  "./game-endless.js",
  "./version.json",
  "./manifest.webmanifest",
  "./favicon.ico",
];

const NETWORK_FIRST_PATHS = new Set(
  globalThis.RED_DUNE_ASSET_MANIFEST?.networkFirstPaths ?? [
    "/",
    "/index.html",
    "/styles.css",
    "/app-assets.js",
    "/game-endless.js",
    "/version.json",
    "/manifest.webmanifest",
  ]
);

function isCoreAppRequest(requestUrl) {
  const url = new URL(requestUrl);
  return NETWORK_FIRST_PATHS.has(url.pathname);
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
