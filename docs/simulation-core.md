# Simulation Core

Dieses Dokument beschreibt den aktuellen testbaren Simulationskern von `Red Dune Dash`.

## Ziel

Kernregeln des Spiels sollen ohne Browser, Canvas und globale Seiteneffekte pruefbar sein. Dafuer gibt es jetzt einen eigenen browserfreien Simulationskern in `systems/simulation-core.js`.

## Aktueller Umfang

Der Simulationskern kapselt heute vor allem Regeln aus dem Run- und Balance-Modell:

- Euro-pro-Stunde-Berechnung
- Bug- und Income-Balance-Multiplikatoren
- kombinierter Run-Balance-Faktor
- Fortschrittsziel aus Distanz und Balance
- monotones Locken von Fortschrittspunkten
- Score-Breakdown
- Spawn-Multiplikator fuer Einkommensquellen
- deterministische Spawn-Entscheidung mit injizierbarem Zufallswert
- deterministische Zufallshelfer fuer Tests

## Warum das wichtig ist

Diese Regeln sind fachlich zentral, aber sollten nicht vom Browser abhangen. Genau hier entstehen spaeter leicht Regressionen durch Balancing-Aenderungen, neue Event-Effekte oder neue Ressourcen.

## Zufall und Zeit

Der Kern arbeitet nicht mit hart verdrahtetem `Math.random()` oder echter Zeit:

- Zeit wird als expliziter Input uebergeben, zum Beispiel `worldTimeMs`
- Spawn-Entscheidungen akzeptieren einen injizierbaren `randomValue`
- fuer Tests gibt es deterministische Helfer wie `createSeededRandom()` und `createSequenceRandom()`

Das Event-System nutzt diese Idee ebenfalls: zusaetzliche Spawn-Entscheidungen koennen jetzt ueber `randomChance` injiziert werden.

## Tests

Der aktuelle Testeinstieg liegt in:

- `tests/simulation-core.test.js`

Ausfuehren:

```powershell
node tests/simulation-core.test.js
```

Der Test deckt derzeit ab:

- Score- und Fortschrittsregeln
- deterministische Zufallshelfer
- Einkommens-Spawn-Regeln
- Bug-Lifecycle-System
- Placement-System
- deterministisch getriebenen Event-Ablauf

## Erweiterungspunkte

Die naechsten guten Kandidaten fuer weitere pure Kernlogik sind:

- generatornahe Entscheidungsregeln
- Pickup-Effekte
- Refactoring-/Backlog-Effekte
- weitere Event-Reward- und Failure-Regeln

## Invarianten

- Kernregeln sollen bevorzugt als pure Funktionen modelliert werden
- Zufall und Zeit sollen fuer Tests kontrollierbar bleiben
- neue Balancing-Regeln sollten zuerst im Simulationskern pruefbar gemacht werden, bevor sie nur im Browser leben
