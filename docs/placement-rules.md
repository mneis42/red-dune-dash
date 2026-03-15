# Placement Rules

Dieses Dokument beschreibt die aktuellen Fairness- und Sicherheitsregeln fuer Platzierung, Kollision und sichere Spielerpositionen in `Red Dune Dash`.

## Ziel

Mehrere Systeme brauchen dieselbe Grundidee:

- Pickups sollen sichtbar und fair erreichbar platziert werden.
- Checkpoints sollen keine Todes-Schleifen erzeugen.
- Hurt- und Respawn-Posen sollen nicht direkt in Hazards oder lebende Bugs gesetzt werden.

Statt diese Mathematik mehrfach leicht unterschiedlich im Code zu verteilen, arbeitet das Spiel jetzt mit gemeinsamen horizontalen Safe-Zones auf Plattformen.

## Grundmodell

Jede Platzierungsregel arbeitet in drei Schritten:

1. nutzbare Plattform-Range bestimmen
2. Blocker-Intervalle davon abziehen
3. die naechste gueltige Zielposition innerhalb der uebrigen Safe-Zones waehlen

Wichtige Begriffe:

- `Placement Range`: horizontaler Bereich auf einer Plattform nach Edge-Padding
- `Blocked Interval`: Bereich, der wegen Hazard, Bug oder anderer Fairness-Regel gesperrt ist
- `Safe Zone`: verbleibender gueltiger Bereich nach Abzug aller Blocker

## Aktuelle Garantien

### Collectibles auf Plattformen

Gems werden als punktfoermige Platzierungen behandelt:

- sie bekommen seitliches Edge-Padding zur Plattformkante
- eingelassene Hazards auf derselben Plattform-Lane schneiden Safe-Zones aus
- wenn keine ausreichend breite Safe-Zone mehr bleibt, wird kein Gem platziert

Wichtige Folge:

- ein Hazard auf der Plattform macht die Platzierung nicht automatisch unmoeglich
- nur die tatsaechlich blockierten Teilbereiche werden ausgeschnitten

### Checkpoints auf Ground-Plattformen

Checkpoints werden als sichere Spielerpositionen behandelt:

- die Spielerbreite wird in die Safe-Zone-Berechnung einbezogen
- Floor-Hazards auf derselben Lauf-Lane sperren die entsprechenden Intervalle
- die bevorzugte Position bleibt die aktuelle Spielernaehe, aber nur innerhalb gueltiger Safe-Zones

Ziel:

- kein Respawn direkt auf oder zu nah an Hazards
- moeglichst wenig "Springen" des Checkpoints zu unnatuerlichen Stellen

### Hurt- und Respawn-Posen

Sichere Hurt-Posen bauen auf denselben Plattform-Safe-Zones auf wie Checkpoints, aber mit mehr Blockern:

- Floor-Hazards auf derselben Lauf-Lane
- lebende Bugs auf derselben Lauf-Lane

Damit gilt:

- ein Treffer friert die Figur moeglichst nahe am Impact-Punkt ein
- gleichzeitig wird verhindert, dass die Pose direkt in einem Folge-Treffer liegt

## Lane-Regeln

Nicht jeder Hazard oder Bug auf dem Bildschirm blockiert jede Platzierung. Es gibt bewusst getrennte Lane-Pruefungen:

- Pickup-Lane: eingelassene Hazards direkt auf derselben Plattformoberkante
- Player-Lane: Hazards auf der Laufebene einer Plattform
- Bug-Lane: lebende Bugs auf derselben Laufebene einer Plattform

Diese Trennung ist wichtig, damit kuenftige Pickup-Typen eigene Regeln bekommen koennen, ohne dieselbe Kollisionsmathematik zu kopieren.

## Generator-Fairness

Der Weltgenerator nutzt weiterhin zusaetzliche Fairness-Pruefungen fuer Plattformen:

- keine Plattform-Ueberlappung
- genug Unterlauf-Freiraum
- mindestens ein plausibler Zugang
- optionale Inhalte duerfen fehlschlagen, ohne den Chunk ungueltig zu machen

Diese Regeln ergaenzen die Safe-Zones, ersetzen sie aber nicht.

## Erweiterungspunkte

Neue Pickup-Typen sollten auf demselben Modell aufbauen:

- eigener Edge-Padding-Bedarf
- eigene Mindestbreite fuer Safe-Zones
- eigene Blocker-Typen
- eigene Lane-Semantik

Beispiele:

- ein seltenes Event-Item koennte groessere Safe-Zones verlangen
- ein Backlog-Gem koennte auf Plattformen mit aktivem Bug absichtlich nicht spawnbar sein
- ein Shield-Pickup koennte naeher an Hazards erlaubt sein als ein Geld-Gem

## Invarianten

- Platzierung arbeitet ueber ausdrueckliche Safe-Zones statt ueber verstreute Sonderfaelle
- Hazards blockieren nur die Lanes, fuer die sie fachlich relevant sind
- Checkpoints und Hurt-Posen behandeln die Spielerbreite als Teil der Sicherheitsregel
- wenn keine sichere Zone existiert, wird die Platzierung ausgelassen statt implizit erzwungen
