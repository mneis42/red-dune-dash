# Bug Lifecycle

Dieses Dokument definiert den aktuellen Bug-Lebenszyklus im Spiel und die Uebergangspunkte fuer spaetere Backlog- und Reaktivierungsmechaniken.

## Ziel

Bugs sollen nicht nur als Welt-Entities oder als zwei lose Counter existieren. Stattdessen gibt es ein eigenes Lebenszyklusmodell, das fachlich zwischen verschiedenen Zustanden unterscheiden kann.

Das ist wichtig fuer:

- HUD-Semantik
- Score- und Balance-Regeln
- spaetere Backlog-Mechaniken
- kuenftige Event-Effekte wie `refactoring`

## Aktuelle Statuswerte

- `active-world`
- `missed`
- `backlog`
- `resolved`
- `reactivated`

## Bedeutung der Statuswerte

### `active-world`

Der Bug existiert aktuell als aktive Welt-Entity und kann:

- den Spieler treffen
- besiegt werden
- spaeter aus der Welt fallen oder hinter dem Kamera-Cutoff verschwinden

### `missed`

Der Bug wurde im Run erzeugt, aber nicht geloest und ist nicht mehr als aktive Welt-Entity vorhanden.

Heute entsteht dieser Status vor allem dann, wenn ein lebender Bug den aktiven Weltbereich verlaesst und durch Cleanup entfernt wird.

### `backlog`

Reservierter Zukunftsstatus fuer Bugs, die explizit in einen spielsystemischen Backlog ueberfuehrt wurden.

Aktuell ist dieser Status technisch vorbereitet, aber noch nicht Teil des laufenden Gameplays.

### `resolved`

Der Bug wurde im Run erfolgreich geloest, typischerweise durch Besiegen.

### `reactivated`

Reservierter Zukunftsstatus fuer Bugs, die aus dem Backlog oder aus einer anderen Historie wieder aktiv gemacht wurden.

Aktuell ist dieser Status technisch vorbereitet, aber noch nicht Teil des laufenden Gameplays.

## Aktuelle Uebergaenge

Heute sind folgende Uebergaenge aktiv:

- Spawn -> `active-world`
- `active-world` -> `resolved`
- `active-world` -> `missed`

Heute noch nicht aktiv, aber vorgesehen:

- `missed` -> `backlog`
- `backlog` -> `reactivated`
- `reactivated` -> `resolved`

## Aktuelles Ledger

Das Spiel berechnet aus dem Lebenszyklus ein Bug-Ledger mit:

- `spawnedInRun`
- `resolvedInRun`
- `openInRun`
- `activeInWorld`
- `missedInRun`
- `backlog`
- `reactivatedInRun`

Wichtig:

- `openInRun` meint alle im Run noch ungelosten Bugs
- `openInRun` ist nicht nur "aktuell sichtbare Gegner"
- `openInRun` ist auch nicht automatisch dasselbe wie ein spaeterer Backlog

## Design-Regeln fuer kuenftige Features

### Backlog-Gems

Ein spaeteres Gem, das alte Bugs zurueckholt, sollte nicht direkt tote oder entfernte Welt-Entities wiederbeleben. Stattdessen sollte es auf Bug-Records mit Status `backlog` oder `missed` arbeiten.

### Refactoring-Events

Ein `refactoring`-Event sollte bevorzugt auf Bug-Status arbeiten und nicht auf die aktuell sichtbare Welt beschraenkt sein. Damit kann ein solches Event spaeter glaubwuerdig mehrere alte Bugs auf einmal bereinigen.

### HUD-Semantik

Solange kein echtes Backlog-Gameplay aktiv ist, meint "Offene Bugs" im HUD weiterhin offene Bugs des aktuellen Runs. Wenn spaeter ein eigener Backlog sichtbar wird, sollte er bewusst getrennt angezeigt werden.

## Invarianten

- Jeder Welt-Bug bekommt einen stabilen Lifecycle-Eintrag.
- Welt-Entities sind nicht die Quelle der Wahrheit fuer die Bug-Historie.
- Cleanup darf Welt-Bugs entfernen, ohne den fachlichen Bug-Zustand zu verlieren.
- `resolved` und `missed` bleiben im Ledger erhalten, auch wenn keine Entity mehr existiert.
