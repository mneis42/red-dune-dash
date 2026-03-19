# Asset Manifest

Dieses Dokument beschreibt die gemeinsame Asset-Quelle fuer App, Spiel und Service Worker in `Red Dune Dash`.

## Ziel

Die PWA- und Offline-Assets sollen nicht mehr an mehreren Stellen getrennt gepflegt werden. Stattdessen gibt es eine zentrale Manifest-Datei, aus der sowohl das Spiel als auch der Service Worker lesen.

Dadurch werden zwei Probleme geloest:

- neue Sprite- oder UI-Assets werden nicht mehr leicht im Offline-Cache vergessen
- App und Service Worker driften nicht mehr auseinander

## Zentrale Quelle

`app-assets.js` ist die gemeinsame Quelle fuer:

- `spriteSources` des Spiels
- App-Shell-Assets
- PWA-Icon-Assets
- die vollstaendige Offline-Cache-Liste
- die `network-first`-Pfade des Service Workers

## Aktuelle Nutzung

### `game-endless.js`

Das Spiel liest seine `spriteSources` aus dem zentralen Manifest. Damit fuehrt ein neues Sprite nicht mehr automatisch zu zwei manuellen Aenderungen.

### `service-worker.js`

Der Service Worker importiert `app-assets.js` und nutzt dieselbe Asset-Liste fuer:

- Cache-Name
- Precache-Liste
- `network-first`-Routing fuer Kern-Dateien

### `index.html`

`app-assets.js` wird vor `game-endless.js` geladen, damit die Sprite-Quellen beim Spielstart bereits verfuegbar sind.

## Design-Regeln fuer neue Assets

Wenn ein neues Asset offline relevant ist, sollte es ueber das zentrale Manifest sichtbar werden:

- neue Spiel-Sprites ueber `spriteSources`
- neue Shell-Dateien oder feste UI-Ressourcen ueber `appShellAssets`
- neue PWA-Icons ueber `pwaIconAssets`

Nicht gewuenscht ist, dieselbe Datei direkt an mehreren Stellen getrennt nachzutragen.

## Invarianten

- Service Worker und Spiel nutzen dieselbe Sprite-Quelle
- alle zentral registrierten Assets landen in der Offline-Cache-Liste
- Kern-Dateien der App sind im Service Worker explizit als `network-first` modelliert

## Path-Handling Contract

`networkFirstPaths` stays rooted (for example `/version.json`), while the service worker normalizes incoming same-origin request paths against its active registration scope.

This keeps a single manifest contract valid for both local root hosting (`/`) and GitHub Pages project subpaths (for example `/red-dune-dash/`) without duplicating every path variant.
