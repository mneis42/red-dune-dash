# Curious Tiger: Red Dune Dash

Kleines browserbasiertes Jump-and-Run auf dem Mars mit einem Tiger als Spielfigur. Das Spiel läuft komplett ohne Frameworks direkt im Browser und setzt auf HTML, CSS und Vanilla JavaScript.

## Features

- Endlos-Runner mit zufällig generierten Abschnitten
- Gegner, Gefahren, Extraleben und Punkte-System
- Highscore-Speicherung im Browser via `localStorage`
- Tastatur- und Touch-Steuerung für Desktop und Mobile

## Projektstruktur

- `index.html` - Einstiegspunkt und HUD
- `styles.css` - Layout, Effekte und responsive UI
- `game-endless.js` - aktuelle Spiel-Logik des Endless-Runs
- `assets/` - Sprites und Grafiken
- `systems/` - Kernsysteme für Simulation, Placement, Pickups, Events, Debug-Tools, Generator- und Respawn-Helfer
- `app-assets.js` - zentrales Asset-Manifest für Spiel und Service Worker
- `service-worker.js` - PWA-/Offline-Unterstützung
- `tests/` - Node-basierte Gameplay-, System- und Service-Worker-Tests

## Lokal starten

Einfach `index.html` im Browser öffnen.

Empfohlen wird ein kleiner lokaler Server, zum Beispiel:

```powershell
python -m http.server 8000
```

Dann `http://localhost:8000` im Browser öffnen.

### Tests ausführen

Gameplay- und System-Tests laufen direkt unter Node:

```powershell
node tests/simulation-core.test.js
```

Einfache Smoke-Tests für den Service Worker:

```powershell
node tests/service-worker.test.js
```

Die CI-Workflows in `.github/workflows/` führen mindestens die Gameplay-Tests automatisch aus.

### Debug-Mode

Der Debug-Modus wird über Query-Parameter aktiviert und erlaubt gezielte Balancing- und Event-Tests.

Beispiele:

- Debug aktivieren und ein bestimmtes Event erzwingen:

	```text
	?debug=1&debugEvent=big-order
	```

- Bestimmten Pickup-Typ und Backlog vorbefüllen:

	```text
	?debug=1&debugPickup=score-boost&debugBacklog=5
	```

Verfügbare Parameter und Hotkeys sind in `docs/debug-tools.md` dokumentiert.

### PWA- und Offline-Betrieb

Red Dune Dash unterstützt „Add to Home Screen“ und Offline-Spiel über einen Service Worker.

- Für lokale Tests sollte das Spiel über einen HTTP-Server laufen (siehe oben), nicht direkt per `file://`.
- Der Service Worker nutzt `app-assets.js` als zentrale Quelle für Offline-Assets und `network-first`-Routen.
- Versions-Updates werden über `version.json` und eine gestempelte `APP_VERSION` erkannt; produktive Deployments werden im GitHub-Pages-Workflow automatisch mit einer Versions-ID versehen.

## Steuerung

- `A` / `D` oder Pfeiltasten links/rechts: Laufen
- `W`, `Leertaste` oder Pfeil hoch: Springen
- `R`: Neustart

## Tech-Stack

HTML, CSS und Vanilla JavaScript mit Rendering über das `canvas`-Element.
