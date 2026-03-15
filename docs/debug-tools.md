# Debug Tools

Dieses Dokument beschreibt die aktuellen Debug- und Balancing-Werkzeuge von `Red Dune Dash`.

## Ziel

Komplexe Spielsituationen sollen gezielt reproduzierbar sein, ohne dass man jedes Mal einen langen Run bis zur passenden Event- oder Ressourcenlage spielen muss.

## Aktivierung

Die Debug-Konfiguration wird ueber Query-Parameter aktiviert.

Beispiel:

```text
?debug=1&debugEvent=big-order&debugPickup=score-boost&debugBacklog=5
```

Sobald mindestens ein Debug-Override gesetzt ist, wird der Debug-Modus automatisch aktiv.

## Verfuegbare Query-Parameter

- `debug=1`
  Schaltet den Debug-Modus explizit ein.
- `debugPanel=0|1`
  Blendet das Debug-Panel standardmaessig aus oder ein.
- `debugEvent=<type>`
  Erzwingt einen bestimmten Special-Event-Typ fuer manuelle Event-Starts, z. B. `big-order`.
- `debugEventDelayMs=<number>`
  Erzwingt die Event-Wartezeit in Millisekunden.
- `debugPickup=<type>`
  Erzwingt fuer automatische Waehrungs-Pickups nach Moeglichkeit einen bestimmten Pickup-Typ.
- `debugPickupSpawnMultiplier=<number>`
  Skaliert pickup-bezogene Spawn-Chancen.
- `debugIncomeSpawnMultiplier=<number>`
  Skaliert die Spawn-Wahrscheinlichkeit von Einkommen-/Monetenquellen.
- `debugBugSpawnMultiplier=<number>`
  Skaliert bug-bezogene Spawn-Chancen und direkte Event-Spawn-Versuche.
- `debugRocketSpawnMultiplier=<number>`
  Skaliert die Raketen-Spawnrate.
- `debugBacklog=<number>`
  Prefill fuer Backlog-Records beim Start eines neuen Runs.
- `debugCurrencyCents=<number>`
  Startwert fuer Moneten.
- `debugActionScore=<number>`
  Startwert fuer Aktionspunkte.
- `debugProgressScore=<number>`
  Startwert fuer Fortschrittspunkte.
- `debugLives=<number>`
  Startwert fuer Leben.

## In-Game Hotkeys

- `F3`
  Debug-Panel ein- oder ausblenden.
- `F6`
  Den aktuellen Special Event Debug-Schritt ausfuehren:
  `idle -> announce -> active -> complete`.
- `F7`
  Den konfigurierten Debug-Pickup in die aktuelle Szene spawnen.
- `F8`
  Einen weiteren Backlog-Record anlegen.

## Sichtbares Debug-Panel

Wenn Debug aktiv ist, zeigt das Panel unter anderem:

- Event-Konfiguration und aktuelle Event-Phase
- Spawn-Multiplikatoren
- erzwungenen Pickup-Typ
- Startwerte fuer Ressourcen und Backlog
- aktuelle Weltgroessen wie Pickups, Bugs und Raketen
- aktuelle Run-Werte wie Moneten, offene Bugs, Score und Balance

## Highscore-Regel

Debug-Runs speichern keinen Highscore in `localStorage`.

Das verhindert, dass Balancing- oder Content-Tests den normalen Spielfortschritt verfaelschen.
