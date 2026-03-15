# Architecture

Dieses Dokument beschreibt den aktuellen Systemschnitt von `Red Dune Dash`.

## Ziel

`game-endless.js` ist nicht mehr die einzige Heimat aller Spielregeln. Zentrale Fachsysteme liegen jetzt in eigenen Dateien und werden vom Hauptfile nur noch verdrahtet und genutzt.

Das reduziert Kopplung fuer kuenftige Features wie:

- neue Pickup-Typen
- neue Event-Arten
- Backlog-Mechaniken
- weitere Spawn- und Fairness-Regeln

## Aktuelle Systeme

### `systems/game-state.js`

Zustaendig fuer die Grundstruktur der Run-State-Objekte:

- `level`
- `player`
- `runState`

Nutzen:

- Startzustand und Reset-Struktur liegen nicht mehr als anonyme Literale im Hauptfile
- State-Grenzen sind expliziter

### `systems/bug-lifecycle-system.js`

Zustaendig fuer den fachlichen Bug-Lebenszyklus:

- Statuswerte
- Lifecycle-Ledger
- Reset
- Registrierung
- Statuswechsel
- aggregierte Counts

Nutzen:

- Bug-Historie ist ein eigenes System
- HUD, Cleanup und kuenftige Backlog-Effekte greifen auf dieselbe Quelle zu

### `systems/placement-system.js`

Zustaendig fuer Safe-Zones und Platzierungsregeln:

- Plattform-Placement-Range
- Blocker-Intervalle
- Hazard-/Bug-Lane-Pruefungen
- Safe-Zones
- Auswahl der naechsten sicheren X-Position

Nutzen:

- Platzierungslogik fuer Gems, Checkpoints und Hurt-Posen lebt nicht mehr als verteilte Mathematik im Hauptfile

### `systems/simulation-core.js`

Zustaendig fuer browserfreie Kernregeln und deterministische Balancing-Logik:

- Score- und Fortschrittsregeln
- Balance-Multiplikatoren
- Einkommens-Spawn-Regeln
- deterministische Zufallshelfer

Nutzen:

- zentrale Regeln sind ohne Canvas und DOM pruefbar
- Balancing-Aenderungen koennen ueber Node-Tests abgesichert werden

### `systems/special-event-system.js`

Zustaendig fuer Event-Lebenszyklus und Event-Definitionen:

- Phasenmodell
- Scheduler
- Event-Definitionen
- Runtime-State
- Statusmeldungen
- Event-Effekte fuer Chunk-Regeln und Spawn-Multiplikatoren

Nutzen:

- Events sind als eigenes Fachsystem modelliert
- `game-endless.js` konsumiert eine Event-API statt Event-Regeln selbst zu definieren

## Rolle von `game-endless.js`

`game-endless.js` bleibt aktuell die Orchestrierungsdatei fuer:

- Browser- und Canvas-Setup
- Eingabe
- Welt-Simulation
- Generator-Ablauf
- Rendering
- HUD-Zeichnung
- PWA-UI-Verhalten

Wichtig ist aber:

- zentrale Fachlogik liegt nicht mehr nur dort
- neue Features koennen gezielt in benennbaren Systemen landen

## Systemgrenzen fuer kommende Arbeiten

Die naechsten groesseren Kandidaten fuer weitere Schnitte sind:

- Pickup-/Item-System
- Rendering-/HUD-System
- Input-System
- PWA-/Install-/Update-System

## Invarianten

- Fachliche Regeln sollen bevorzugt in benennbaren Systemdateien landen
- `game-endless.js` soll Orchestrierung eher zusammenfuehren als Regeldefinitionen zu duplizieren
- neue Spielmechaniken sollen zuerst einem bestehenden System zugeordnet oder als neues System eingefuehrt werden
