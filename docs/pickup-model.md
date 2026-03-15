# Pickup Model

Dieses Dokument beschreibt das aktuelle Pickup-System von `Red Dune Dash`.

## Ziel

Pickups sollen nicht mehr nur "sichtbare Gems mit Geld-Effekt" sein. Stattdessen bekommt jeder Pickup-Typ eine eigene fachliche Definition mit:

- Spawnregeln
- Telegraphing
- Render-Metadaten
- Gameplay-Effekt
- HUD-Ziel fuer Fly-to-Feedback

## Aktuelle Struktur

Die Pickup-Logik liegt in `systems/pickup-system.js`.

Das System stellt zwei Ebenen bereit:

- `createPickupDefinitions(config)` fuer die inhaltlichen Typdefinitionen eines Runs
- `createPickupSystem(definitions)` fuer die Runtime-Helfer zum Erzeugen, Platzieren, Rendern und Anwenden

## Aktuelle Pickup-Typen

### `currency`

- darf auf Plattformen spawnen
- nutzt sichere Pickup-Zonen
- bringt Moneten und Aktionspunkte
- sendet HUD-Feedback an Moneten und Score

### `extra-life`

- wird aktuell ueber Raketen eingesammelt
- erhoeht `player.lives`
- bringt zusaetzliche Aktionspunkte
- ist als eigener Pickup-Effekt modelliert statt als Sonderfall im Kollisionscode

### Vorbereitete Erweiterungspunkte

Diese Typen sind bereits als Definitionsplaetze vorbereitet, auch wenn ihre Spawnlogik aktuell noch deaktiviert ist:

- `backlog-revival`
- `score-boost`
- `temporary-shield`
- `event-trigger`

## Wichtige Trennung

Ein Pickup-Entity ist absichtlich nur ein leichtes Runtime-Objekt. Der fachliche Effekt steckt in seiner Typdefinition und nicht im Weltobjekt selbst.

Das bedeutet:

- Kollisionen sammeln nur "Pickup X vom Typ Y" ein
- der eigentliche Effekt wird ueber `pickupSystem.applyEffect(...)` ausgefuehrt
- neue Pickup-Typen brauchen keinen neuen Sonderfall direkt in der Kollisionsschleife

## Anschluss fuer spaetere Features

### Backlog-Pickups

Ein spaeteres Pickup, das alte Bugs zurueckholt, sollte den Bug-Lebenszyklus ansprechen und nicht einfach alte Welt-Entities wieder sichtbar machen.

### Refactoring- oder Event-Pickups

Ein Event-ausloesendes Pickup sollte nicht Rendering oder Generator direkt manipulieren, sondern ueber klar benannte Hooks ins Event-System wirken.

## Invarianten

- `level.pickups` enthaelt nur aktive Runtime-Entities im aktuellen Run
- Pickup-Typen definieren ihren Effekt selbst
- Spawnregeln und Effekte duerfen sich zwischen Pickup-Typen unterscheiden
- neue Pickup-Arten sollen ohne Kopie der bisherigen `currency`-Logik hinzufuegbar sein
