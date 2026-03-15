# Generator Rules

Dieses Dokument beschreibt die aktuellen Regeln und Invarianten des Weltgenerators von `Red Dune Dash`.

## Ziel

Der Generator soll drei Dinge gleichzeitig leisten:

- die Welt endlos und ohne sichtbare Luecken vorausbauen
- optionale Inhalte wie Plattformen, Pickups, Bugs und Hazards hinzufuegen
- dabei keine unfairen oder unspielbaren Layouts erzeugen

Wichtig ist ausserdem, dass fehlgeschlagene optionale Inhalte den Weltfortschritt nie blockieren duerfen.

## Grundablauf

Die Generierung laeuft aktuell in drei Ebenen:

### `initLevel()`

Seedet den Startbereich des Runs mit:

- einer festen Anfangssequenz aus Ground-Plattformen
- einem ersten Pickup
- einem ersten Bug
- bereits vorgezogen generierten weiteren Chunks

### `generateUntil(targetX)`

Ruft `generateChunk()` so lange auf, bis die Welt weit genug vor dem Kamera-/Spielerbereich reicht.

### `generateChunk()`

Erzeugt genau einen neuen Basis-Chunk:

1. Luecke zum letzten Chunk bestimmen
2. neue Ground-Plattform erzeugen
3. optionale Ground-Dekoration pruefen
4. optionale Plate- oder Bonus-Plattformen pruefen
5. am Ende `level.nextChunkX` und `level.lastGroundY` fortschreiben

## Transaktionale optionale Inhalte

Optionale Chunk-Bestandteile wie hohe Zusatzplattformen duerfen fehlschlagen.

Damit dabei kein halbfertiger Zustand stehenbleibt, arbeitet der Generator mit einem kleinen Rollback-Modell:

- `createChunkFeatureSnapshot()`
- `commitChunkFeatureAttempt(...)`
- `restoreChunkFeatureSnapshot(...)`

Zurueckgerollt werden dabei unter anderem:

- hinzugefuegte Plattformen
- temporaer veraenderte Hazards
- neu hinzugekommene Pickups
- neu hinzugekommene Bugs
- neue Bug-Lifecycle-Ids

Das bedeutet:

- ein fehlgeschlagener Bonus-Aufbau darf den Chunk "einfach schlichter" machen
- der Chunk bleibt trotzdem gueltig
- die Weltfortschreibung passiert weiterhin genau einmal

## Aktuelle Fairness-Regeln

### Ground-Chunks

- Ground-Y variiert nur in einem begrenzten Bereich zwischen `world.floorYMin` und `world.floorYMax`
- Chunk-Breite und Lueckenbreite bleiben in kontrollierten Zufallsintervallen
- Ground-Hazards erscheinen nur auf ausreichend breiten Segmenten und mit seitlichem Sicherheitsabstand

### Erhoehte Plattformen

Optionale Plate- und Bonus-Plattformen muessen mehrere Pruefungen bestehen:

- keine Plattform-Ueberlappung
- genug Unterlauf-Freiraum
- bei zu grosser Hoehe ggf. Hilfsplattform ueber `ensureStepPlatform(...)`
- mindestens ein plausibler Zugang ueber `hasReachableApproach(...)`

Wenn eine zu hohe Plattform ohne Hilfsstufe unspielbar waere, wird sie nicht behalten.

### Hazard-Korrekturen

In einzelnen Faellen entfernt der Generator Hazards wieder unter einem kritischen Bereich, wenn sonst ein noetiger Zugang unspielbar waere.

Das ist bewusst kein allgemeiner "Cheat", sondern eine Fairness-Korrektur fuer Konflikte zwischen:

- hoher Plattform
- noetiger Laufspur
- bereits gesetztem Ground-Hazard

### Pickups und Bugs

Die eigentliche Platzierung von Pickups und Bugs auf Plattformen nutzt gemeinsame Helfer:

- Pickup-Typen ueber das Pickup-System
- Safe-Zones ueber das Placement-System

Dadurch entscheidet der Generator nicht selbst im Detail, wo ein Pickup exakt stehen darf.

## Event- und Debug-Einfluss

Der Generator liest seine dekorativen Wahrscheinlichkeiten nicht mehr nur aus hart codierten Werten, sondern ueber:

- `specialEventSystem.getChunkGenerationRules()`
- Debug-Multiplikatoren fuer pickup- und bugbezogene Spawn-Chancen

Wichtig:

- Events und Debug duerfen Dichte und Risiko aendern
- sie sollen aber nicht die grundlegenden Traversal-Regeln des Chunks aufheben

## Erweiterungspunkte

Kuenftige Features wie `refactoring`, neue Plattformtypen oder neue Pickup-Familien sollten bevorzugt so andocken:

- neue Chunk-Regelwerte ueber Event-Definitionen
- neue Spawn-Entscheidungen ueber Pickup- und Placement-System
- neue Traversal-Pruefungen ueber benennbare Helfer statt Direktlogik in `generateChunk()`

Nicht gewuenscht ist, neue Feature-Typen direkt als weitere verstreute `if`-Bloecke in denselben Ablauf zu schichten.

## Invarianten

- jeder Chunk schreibt `level.nextChunkX` und `level.lastGroundY` genau einmal fort
- optionale Inhalte duerfen fehlschlagen, ohne die Weltfortschreibung zu blockieren
- fehlgeschlagene optionale Inhalte hinterlassen keine halbfertigen Weltobjekte
- Traversal-Fairness ist wichtiger als maximale Dekorationsdichte
- Platzierungsdetails fuer Pickups und sichere Posen sollen in gemeinsamen Systemen bleiben, nicht im Generator dupliziert werden
