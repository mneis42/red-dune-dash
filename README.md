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

## Lokal starten

Einfach `index.html` im Browser öffnen.

Alternativ mit einem kleinen lokalen Server, zum Beispiel:

```powershell
python -m http.server 8000
```

Dann `http://localhost:8000` im Browser öffnen.

## Steuerung

- `A` / `D` oder Pfeiltasten links/rechts: Laufen
- `W`, `Leertaste` oder Pfeil hoch: Springen
- `R`: Neustart

## Tech-Stack

HTML, CSS und Vanilla JavaScript mit Rendering über das `canvas`-Element.
