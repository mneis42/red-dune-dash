# Run Model

Dieses Dokument definiert das aktuelle Score-, Ressourcen- und Fortschrittsmodell von `Red Dune Dash`.

## Ziel

Das Modell trennt bewusst zwischen:

- Spielfigur-Zustand
- Ressourcen des aktuellen Runs
- Fortschritt des aktuellen Runs
- Bug-Zustand des aktuellen Runs
- Score als Auswertung mehrerer Systeme

Diese Trennung ist wichtig, damit kuenftige Features wie neue Gem-Arten, Bug-Backlog, Reaktivierungen alter Bugs oder Event-Typen wie `refactoring` nicht als Sonderfaelle direkt im Player-State landen.

## Aktuelle Zustandsbereiche

### Player

`player` beschreibt nur den unmittelbaren Laufzustand der Figur:

- Position
- Bewegung
- Bodenkontakt
- Blickrichtung
- Leben
- Hurt-/Respawn-Zustaende
- Sichtbarkeit

Nicht mehr Teil von `player` sind:

- Moneten
- Aktionspunkte
- Fortschrittspunkte
- maximale erreichte Distanz

### Run State

`runState` beschreibt den wirtschaftlichen und progressionsbezogenen Zustand des aktuellen Runs:

- `currencyCents`
- `actionScore`
- `progressScore`
- `farthestX`

Bedeutung:

- `currencyCents`: direkte Geld-Ressource des Runs
- `actionScore`: Punkte aus konkreten Aktionen wie Gem-Sammeln, Bug-Besiegen oder Raketen
- `progressScore`: gespeicherte Fortschrittspunkte aus Distanz und Balance
- `farthestX`: maximale im Run erreichte X-Position

## Score-Modell

Der Gesamtscore ist:

`totalScore = actionScore + progressScore`

### Aktionspunkte

Aktionspunkte werden direkt durch einzelne Aktionen vergeben:

- Gem einsammeln
- Bug besiegen
- Rakete einsammeln

Diese Punkte sind additiv und dauerhaft.

### Fortschrittspunkte

Fortschrittspunkte basieren auf:

- maximal erreichter Distanz im Run
- aktuellem Balance-Faktor

Wichtige Regel:

- Fortschrittspunkte sind monoton

Das bedeutet:

- spaetere Balance-Schwankungen duerfen bereits verdiente Fortschrittspunkte nicht wieder verringern
- die Anzeige fuer Fortschritt soll sich fuer den Spieler wie echter Fortschritt anfuehlen

Technisch wird deshalb nicht einfach jedes Frame ein dynamischer Distanzwert neu angezeigt, sondern ein `progressScore` gespeichert und nur nach oben synchronisiert.

## Ressourcenmodell

### Moneten

Moneten sind aktuell die direkte Einkommens-Ressource des Runs.

Heute wirken sie auf:

- HUD-Anzeige
- Euro-pro-Stunde-Wert
- Balance-Faktor

Wichtig fuer spaeter:

- Moneten sind nicht synonym zu "alle Gems"
- kuenftige Pickup-Typen duerfen andere Wirkungen haben, ohne diese Ressource umzudeuten

Beispiele fuer spaetere getrennte Ressourcen:

- `currency`
- `backlog-revival`
- `score-boost`
- `event-trigger`

### Leben

Leben bleiben bewusst beim `player`, weil sie in erster Linie eine unmittelbare Ueberlebensressource der Spielfigur sind, keine wirtschaftliche Run-Waehrung.

## Bug-Modell

Der aktuelle Run fuehrt ein Bug-Ledger mit folgenden Bedeutungen:

- `spawnedInRun`
- `resolvedInRun`
- `openInRun`
- `backlog`

Derzeit gilt:

- `openInRun = spawnedInRun - resolvedInRun`
- `backlog = 0`

Wichtige semantische Entscheidung:

- "Offene Bugs" im aktuellen HUD meinen derzeit offene Bugs dieses Runs
- sie meinen noch nicht einen historischen, spielsystemischen Backlog ueber verpasste alte Bugs

Das ist eine bewusste Zwischenstufe. Ein echter Backlog wird spaeter als eigenes Fachsystem ergaenzt und nicht aus Welt-Entities rekonstruiert.

## Balance-Faktor

Der Balance-Faktor entsteht aktuell aus zwei Seiten:

- Bug-Druck
- Einkommens-Momentum

Die Balance beeinflusst heute:

- Fortschrittspunkte
- Spawn-Chancen fuer Einkommensquellen

Wichtig:

- Balance ist ein Modifikator
- Balance ist keine eigene Ressource
- Balance darf Fortschritt schwerer oder lukrativer machen, soll aber bereits verdiente Fortschrittspunkte nicht rueckwirkend vernichten

## Erweiterungspunkte

### Backlog-Gems

Ein Pickup, das alte Bugs zurueckholt, soll spaeter nicht einfach offene Welt-Bugs respawnen lassen. Stattdessen soll es mit einem echten Backlog-System arbeiten, das zustaendliche Bugs verwaltet.

### Refactoring-Events

Ein `refactoring`-Event ist fachlich kein normales Spawn-Event, sondern eher ein Modus mit:

- hohem Risiko
- wenig oder keinem direkten Einkommen
- staerkerem Einfluss auf Bug-Zustaende
- moeglichem Bonus auf Fortschrittspunkte oder Bug-Aufraeumung

### Weitere Ressourcen

Neue Pickup-Typen sollten ueber das Ressourcenmodell anbindbar sein, ohne den Player-State oder die Geld-Ressource zu ueberladen.

## Invarianten

Solange dieses Modell gilt, sollten folgende Aussagen immer wahr bleiben:

- `player` enthaelt keine wirtschaftlichen oder scorebezogenen Run-Werte
- `progressScore` sinkt nie
- `totalScore` sinkt nie
- "Offene Bugs" im HUD meinen den aktuellen Run, nicht den spaeteren Backlog
- Backlog bleibt ein eigenes System und wird nicht aus besiegten oder entfernten Welt-Entities abgeleitet
