# Asset Manifest

This document describes the shared asset source for app shell, gameplay runtime, and service worker behavior in `Red Dune Dash`.

## Goal

PWA and offline assets should no longer be maintained in multiple disconnected places. Instead, a single manifest file is used by both the game and the service worker.

This removes two recurring failure modes:

- new sprite or UI assets being forgotten in offline caching
- drift between app runtime asset usage and service-worker cache definitions

## Single Source Of Truth

`app-assets.js` is the shared source for:

- game `spriteSources`
- app-shell assets
- PWA icon assets
- the full offline precache list
- service-worker `network-first` routes

## Current Usage

### `game-endless.js`

The game reads `spriteSources` from the central manifest. A new sprite no longer requires parallel manual edits in multiple files.

### `service-worker.js`

The service worker imports `app-assets.js` and uses the same asset lists for:

- cache naming
- precache entries
- `network-first` routing for core files

### `index.html`

`app-assets.js` is loaded before `game-endless.js` so sprite definitions are available at game startup.

## Design Rules For New Assets

If a new asset is relevant for offline behavior, it should be registered through the central manifest:

- new gameplay sprites via `spriteSources`
- shell files or fixed UI resources via `appShellAssets`
- new PWA icons via `pwaIconAssets`

Avoid registering the same file independently in multiple locations.

## Invariants

- service worker and game consume the same sprite source
- centrally registered assets are represented in the offline cache list
- app core files remain explicitly modeled as `network-first` in the service worker

## Path-Handling Contract

`networkFirstPaths` stays rooted (for example `/version.json`), while the service worker normalizes incoming same-origin request paths against its active registration scope.

This keeps a single manifest contract valid for both local root hosting (`/`) and GitHub Pages project subpaths (for example `/red-dune-dash/`) without duplicating every path variant.
