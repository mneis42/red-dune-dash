(function registerAssetManifest(globalScope) {
  const spriteSources = {
    run: [
      "assets/run1.png",
      "assets/run2.png",
      "assets/run3.png",
      "assets/run4.png",
      "assets/run5.png",
      "assets/run6.png",
    ],
    standing: "assets/standing.png",
    injured: "assets/injured.png",
    attentionPlease: "assets/attention-please.png",
    rotate: "assets/rotate.jpg",
    jumpUp: "assets/jump-up.png",
    jumpDown: "assets/jump-down.png",
    bug: "assets/bug.png",
    gameOver: "assets/game-over.png",
    rocketFromLeft: "assets/rocket-from-left.png",
    rocketFromRight: "assets/rocket-from-right.png",
  };
  const appShellAssets = [
    "./",
    "./index.html",
    "./styles.css",
    "./app-assets.js",
    "./systems/game-state.js",
    "./systems/bug-lifecycle-system.js",
    "./systems/placement-system.js",
    "./systems/pickup-system.js",
    "./systems/simulation-core.js",
    "./systems/special-event-system.js",
    "./game-endless.js",
    "./version.json",
    "./manifest.webmanifest",
    "./favicon.ico",
  ];
  const pwaIconAssets = [
    "./icons/icon-48x48.png",
    "./icons/icon-72x72.png",
    "./icons/icon-96x96.png",
    "./icons/icon-128x128.png",
    "./icons/icon-144x144.png",
    "./icons/icon-152x152.png",
    "./icons/icon-192x192.png",
    "./icons/icon-256x256.png",
    "./icons/icon-384x384.png",
    "./icons/icon-512x512.png",
  ];
  const gameAssetPaths = Object.values(spriteSources).flat().map((path) => `./${path}`);
  const offlineCacheAssets = [...new Set([...appShellAssets, ...pwaIconAssets, ...gameAssetPaths])];
  const networkFirstPaths = [
    "/",
    "/index.html",
    "/styles.css",
    "/app-assets.js",
    "/systems/game-state.js",
    "/systems/bug-lifecycle-system.js",
    "/systems/placement-system.js",
    "/systems/pickup-system.js",
    "/systems/simulation-core.js",
    "/systems/special-event-system.js",
    "/game-endless.js",
    "/version.json",
    "/manifest.webmanifest",
  ];

  globalScope.RED_DUNE_ASSET_MANIFEST = Object.freeze({
    cacheName: "red-dune-dash-v3",
    spriteSources: Object.freeze({
      ...spriteSources,
      run: Object.freeze([...spriteSources.run]),
    }),
    appShellAssets: Object.freeze([...appShellAssets]),
    pwaIconAssets: Object.freeze([...pwaIconAssets]),
    offlineCacheAssets: Object.freeze([...offlineCacheAssets]),
    networkFirstPaths: Object.freeze([...networkFirstPaths]),
  });
})(typeof self !== "undefined" ? self : globalThis);
