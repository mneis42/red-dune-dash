# Event Model

Dieses Dokument beschreibt das aktuelle Special-Event-System von `Red Dune Dash` und die vorgesehenen Erweiterungspunkte fuer spaetere Event-Typen wie `refactoring`.

## Ziel

Events sollen nicht mehr als verstreute Sonderfaelle in Scheduler, Generator, HUD und Spawn-Code leben. Stattdessen bekommt jeder Event-Typ eine gemeinsame Definition mit klaren Verantwortlichkeiten.

Damit wird festgelegt:

- wann ein Event angekuendigt wird
- wie lange Vorwarnung und Aktivphase dauern
- welchen Runtime-State das Event waehrend seiner Phasen braucht
- welche Gameplay-Effekte aktiv sind
- welche UI-Texte gezeigt werden
- wie ein Event sauber abgeschlossen wird

## Aktuelle Struktur

Das Laufzeitmodell besteht aus zwei Ebenen:

### Globaler Event-State

`specialEventState` haelt nur noch den gemeinsamen Ablaufzustand:

- `type`
- `phase`
- `timer`
- `runtime`

Bedeutung:

- `type`: aktueller Event-Typ oder `null`
- `phase`: `idle`, `announce` oder `active`
- `timer`: Restzeit der aktuellen Phase
- `runtime`: phaenspezifischer, mutierbarer Zustand des aktuellen Events

### Event-Definitionen

`SPECIAL_EVENT_DEFINITIONS` beschreibt pro Event-Typ die fachlichen Unterschiede.

Aktuell nutzt jede Definition dieselben Hook-Arten:

- `title`
- `announcementTitle`
- `announcementPrompt`
- `activeStatusMessage`
- `completionStatusMessage`
- `createRuntime(phase)`
- `updateActive(delta, state)`

Optional kann eine Definition ausserdem spezielle Regelbereiche liefern, zum Beispiel:

- `chunkGeneration`
- `rocketSpawnMultiplier`
- `rocketSpawnPhases`
- ein Scheduler-Hook fuer gewichtete Event-Auswahl
- spaeter auch Erfolgs-/Fehlschlag-Hooks oder Reward-Profile

## Aktuelle Event-Typen

### `bug-wave`

Die Bugwelle ist ein Druck-Event:

- beschleunigt Raketen bereits in Vorwarnung und Aktivphase
- spawnet waehrend der Aktivphase fallende und laufende Bugs
- nutzt dafuer einen eigenen Runtime-State fuer Spawn-Timer
- kann pro Spawn mit 50% Chance einen historischen ungelosten Bug statt eines komplett neuen Bugs einsetzen
- darf dafuer Lifecycle-Eintraege aus `missed`, `backlog` und `reactivated` wiederverwenden
- zeigt reaktivierte Bugs nicht gesondert an, behaelt intern aber deren Lifecycle-Identitaet bei

### `big-order`

Der Großauftrag ist ein Ertrags-Event:

- vergroessert die Chunk-Dekoration fuer Moneten und Bugs
- spawnet zusaetzliche sichtbare Moneten und Bugs waehrend der Aktivphase
- bringt seine eigenen Spawn-Timer im Runtime-State mit

## Gemeinsamer Ablauf

Der Scheduler arbeitet fuer alle Events gleich:

1. `idle`
2. zufaellige Wartezeit laeuft herunter
3. `announce`
4. Event-spezifische Vorwarnung wird angezeigt
5. `active`
6. Event-spezifische `updateActive`-Logik laeuft
7. Abschlussmeldung
8. zurueck nach `idle`

Fuer die aktuellen Live-Events gilt zusaetzlich:

- die Wartezeit zwischen zwei Events liegt produktiv zwischen 2 und 5 Minuten
- die Typ-Auswahl ist nicht mehr rein gleichverteilt
- bei vielen offenen Bugs (`active-world`, `missed`, `backlog`, `reactivated`) bekommt `bug-wave` ein hoeheres Gewicht als `big-order`
- Debug-Overrides fuer Delay oder Event-Typ haben weiterhin Vorrang

Wichtig:

- Phasenwechsel initialisieren `runtime` immer neu
- UI liest nur noch ein gemeinsames Event-View-Model
- Generator und Spawn-System fragen gemeinsame Event-Helfer statt einzelner Typ-Sonderfaelle ab

## Erweiterungspunkte fuer spaetere Events

Ein kuenftiges `refactoring`-Event sollte moeglichst in derselben Struktur beschrieben werden, zum Beispiel mit:

- eigenem `title` und `announcementTitle`
- eigener `activeDuration`
- eigenem `runtime` fuer schwere Plattform- oder Timing-Phasen
- Hooks fuer Bug-Lifecycle-Effekte
- Reward-Profil, das eher Fortschritt als Moneten belohnt

Fuer solche Events sollten neue Effekte bevorzugt an gemeinsame Schnittstellen andocken:

- Chunk-Generierung
- Spawn-Multiplikatoren
- Bug-Lifecycle-Aktionen
- Score-/Fortschrittsmodifikatoren
- HUD-/Statustexte

Nicht gewuenscht ist, neue Events wieder ueber mehrere neue `if (eventType === ...)`-Verzweigungen im Hauptcode zu verteilen.

## Invarianten

Solange dieses Modell gilt, sollten folgende Aussagen wahr bleiben:

- Phasenwechsel laufen immer ueber gemeinsame Helfer
- Event-spezifischer Runtime-State lebt nur in `specialEventState.runtime`
- UI, Generator und Spawn-System lesen Event-Effekte ueber gemeinsame Zugriffspunkte
- neue Events duerfen bestehende Events nicht durch Copy-Paste ganzer Ablaufbloecke erweitern
- Event-Typen duerfen unterschiedliche Regeln haben, aber denselben Lebenszyklus teilen
