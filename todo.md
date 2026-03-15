# Red Dune Dash TODO

Diese Datei priorisiert die wichtigsten technischen und spielerischen Baustellen aus der Code-Review. Sie ist bewusst so formuliert, dass die Punkte auch spaeter noch verstaendlich bleiben, selbst wenn sich das Spiel bis dahin deutlich weiterentwickelt hat.

## Prioritaeten

- `P0`: Muss zuerst erledigt werden. Hier drohen echte Laufzeitfehler, Softlocks, stark inkonsistentes Verhalten oder technische Schulden, die jede weitere Erweiterung erschweren.
- `P1`: Sollte direkt nach den P0-Punkten folgen. Diese Themen bremsen Balancing, Erweiterbarkeit und Wartbarkeit schon heute deutlich.
- `P2`: Wichtige strukturelle Verbesserungen fuer Wachstum. Diese Punkte werden spaetestens dann dringend, wenn neue Gem-Arten, neue Event-Typen und komplexere Spiellogik dazukommen.
- `P3`: Qualitaets- und Komfortthemen. Nicht unwichtig, aber erst sinnvoll, wenn die Kernsysteme stabil sind.

## Leitbild fuer die naechsten Ausbaustufen

Das Spiel entwickelt sich bereits von einem einfachen Endless Runner zu einem System mit mehreren, ineinandergreifenden Regeln:

- verschiedene Ressourcen statt nur einer Gem-Art
- Gegner nicht nur als unmittelbare Gefahr, sondern auch als laengerfristiger Zustand wie Backlog oder technische Schulden
- Events mit bewusst unterschiedlichen Risiko-/Ertragsprofilen
- spaeter vermutlich mehr Meta-Regeln wie Multiplikatoren, Statuswechsel, Spezialinteraktionen und Gegenstaende

Damit kuenftige Features wie "Backlog-Gems holen alte Bugs zurueck" oder "Refactoring-Events loesen viele alte Bugs, geben aber keine Moneten" nicht in einer immer groesseren Sonderfall-Sammlung enden, sollten wir die naechsten Arbeiten konsequent in Richtung klarer Systeme denken:

- trennbare Simulationslogik statt grosser globaler Datei
- saubere Statusmodelle fuer Bugs, Events, Pickups und Score
- deterministische Regeln, die man testen und balancen kann
- Inhalte datengetrieben definieren, statt alles ueber `if`-Bloecke im Render-/Update-Code zu verzahnen

## TODOs

Statusuebersicht. Die Detailbeschreibungen zu jedem Punkt folgen direkt darunter.

- [x] P0 - Weltgenerator stabilisieren und fruehe `return`-Pfadfehler beseitigen
- [x] P0 - Weltbereinigung korrigieren, damit eingesammelte oder tote Entities wirklich verschwinden
- [ ] P0 - Mobile Resume-Pfad fuer Hintergrund-/App-Wechsel loesen
- [ ] P0 - Alle gameplay-relevanten Timer und Counter auf echte Zeitbasis umstellen
- [ ] P1 - Score-, Ressourcen- und Fortschrittsmodell fachlich sauber definieren
- [ ] P1 - Bug-Lebenszyklus als eigenes Fachsystem modellieren
- [ ] P1 - Event-System von hart codierten Sonderfaellen zu einer erweiterbaren Struktur umbauen
- [ ] P1 - Dead Code und unklare Regelpfade bei Platzierung und Kollision aufraeumen
- [ ] P1 - Offline-/PWA-Assets an die tatsaechlich verwendeten Inhalte angleichen
- [ ] P2 - Den Monolithen in klar getrennte Spielsysteme zerlegen
- [ ] P2 - Testbare Simulationskern-Logik einziehen
- [ ] P2 - Item-/Pickup-System verallgemeinern statt nur "Gem = Geld" zu kennen
- [ ] P3 - Debug-, Balancing- und Content-Werkzeuge ausbauen
- [ ] P3 - Architektur- und Regelentscheidungen kurz dokumentieren

### P0 - Weltgenerator stabilisieren und fruehe `return`-Pfadfehler beseitigen

**Problem**

Der prozedurale Generator kann einen Chunk teilweise aufbauen und dann vorzeitig aus `generateChunk()` aussteigen, bevor `level.nextChunkX` und `level.lastGroundY` aktualisiert werden. Dadurch kann derselbe Bereich mehrfach erzeugt werden. Im schlechtesten Fall fuehrt das zu sehr langen Generator-Schleifen, doppeltem Content auf derselben Strecke oder schwer nachvollziehbaren Layout-Fehlern.

**Warum das zuerst wichtig ist**

Solange der Generator selbst nicht robust ist, ist jede neue Plattform-Art, jeder neue Pickup und jedes neue Event riskant. Das Problem sitzt im Fundament des Runs.

**Was getan werden soll**

- `generateChunk()` so umbauen, dass ein Chunk immer in einem konsistenten Zustand endet.
- Optionale Inhalte wie Plattformen, Bonus-Plattformen, Hazards, Gems und Bugs zuerst als Kandidaten berechnen und erst danach committen.
- Sicherstellen, dass `level.nextChunkX` und `level.lastGroundY` immer genau einmal pro Chunk fortgeschrieben werden.
- Falls optionale Elemente unplatzierbar sind, soll der Chunk trotzdem gueltig bleiben und lediglich "weniger dekoriert" sein, statt halb gebaut abzubrechen.
- Idealerweise den Chunk-Generator in einen kleinen, testbaren Ablauf aufteilen:
  - Basis-Chunk erzeugen
  - optionale Elemente platzieren
  - Validierung ausfuehren
  - Ergebnis committen

**Spaeter wichtig fuer Erweiterungen**

Neue Event-Typen wie `refactoring`, `incident`, `release-freeze` oder neue Content-Arten wie Spezial-Gems werden sehr wahrscheinlich direkt in den Generator eingreifen. Wenn der Generator jetzt nicht sauber gekapselt wird, steigt die Zahl der Sonderfaelle exponentiell.

**Erledigt wenn**

- kein frueher `return` mehr einen halbfertigen Chunk hinterlaesst
- `generateUntil()` kann nicht mehr durch denselben Chunk-Anker blockiert werden
- optionale Inhalte koennen fehlschlagen, ohne die Weltfortschreibung kaputtzumachen

### P0 - Weltbereinigung korrigieren, damit eingesammelte oder tote Entities wirklich verschwinden

**Problem**

Aktuell bleiben eingesammelte Gems und besiegte Bugs in den Arrays erhalten. Das fuehrt in langen Runs zu unnoetigem Speicherverbrauch und zu immer mehr Iterationen ueber inaktive Objekte.

**Warum das zuerst wichtig ist**

Ein Endless Game darf intern nicht endlos Ballast ansammeln. Dieser Fehler ist aktuell noch klein, wird aber mit mehr Event-Spawns, mehr Pickup-Arten und mehr Gegnertypen schnell teuer.

**Was getan werden soll**

- `cleanupWorld()` so aendern, dass gesammelte Gems, inaktive Raketen und tote oder irrelevante Bugs wirklich entfernt werden.
- Vorher klar definieren, welche Entity-Zustaende ueberhaupt persistieren muessen.
- Falls kuenftige Features alte Bugs spaeter wieder aktivieren sollen, dann darf das nicht ueber tote Welt-Entities geschehen, sondern ueber ein separates System fuer "Backlog-/Historienzustand".

**Spaeter wichtig fuer Erweiterungen**

Der Wunsch, alte Bugs spaeter wieder zurueckholen zu koennen, ist ein starkes Signal: "ein besiegter Gegner auf dem Spielfeld" und "ein historischer Bug-Zustand im Spielsystem" sind zwei verschiedene Dinge. Diese beiden Ebenen muessen getrennt werden.

**Erledigt wenn**

- tote Bugs nicht mehr im aktiven Weltarray bleiben
- eingesammelte Gems nicht mehr mitgerendert oder mititeriert werden
- kuenftige historische Bug-Zustaende nicht vom Render-/Cleanup-Lebenszyklus abhaengen

### P0 - Mobile Resume-Pfad fuer Hintergrund-/App-Wechsel loesen

**Problem**

Wenn das Spiel auf Mobile oder im Hintergrund pausiert wird, gibt es keinen sauberen Touch-Pfad zum Fortsetzen. Der Zustand `paused` mit Grund `background` laesst sich effektiv nur ueber Tastaturlogik wieder aufnehmen.

**Warum das zuerst wichtig ist**

Das ist ein echter UX-Fehler und auf Touch-Geraeten ein Softlock. Je mehr PWA-/Mobile-Nutzung das Spiel bekommt, desto stoerender wird das.

**Was getan werden soll**

- fuer `paused` einen klaren mobilen Resume-Flow definieren
- Touch-Eingabe im Pause-Zustand explizit behandeln
- unterscheiden zwischen:
  - manuelle Pause
  - Portrait-Zwangspause
  - Background-/Visibility-Pause
- festlegen, welche Pausearten automatisch fortgesetzt werden duerfen und welche eine bewusste Nutzeraktion brauchen
- den Overlay-Text, die Eingabebehandlung und die Resume-Logik aufeinander abstimmen

**Spaeter wichtig fuer Erweiterungen**

Sobald Events komplexer werden oder spaeter Runs laenger dauern, darf ein App-Wechsel nicht das Vertrauen in den Run zerstoeren. Gerade schwierige Event-Phasen wie ein spaeteres Refactoring-Event brauchen einen fairen Resume-Mechanismus.

**Erledigt wenn**

- ein Mobile-User den Run nach Hintergrundwechsel sicher fortsetzen kann
- jede Pauseart einen klaren und getesteten Resume-Weg hat
- Overlay und Eingabelogik dieselbe Pause-Semantik verwenden

### P0 - Alle gameplay-relevanten Timer und Counter auf echte Zeitbasis umstellen

**Problem**

Ein Teil des Spiels arbeitet in Millisekunden, andere wichtige Systeme laufen in "Frames". Dazu gehoeren insbesondere Invincibility und Raketen-Spawn. Auf Geraeten mit anderer Bildrate aendert sich damit direkt der Schwierigkeitsgrad.

**Warum das zuerst wichtig ist**

Balancing ist praktisch unmoeglich, solange dieselbe Regel auf 60 Hz, 120 Hz oder unter Last unterschiedlich wirkt.

**Was getan werden soll**

- alle Gameplay-Timer auf Millisekunden umstellen
- klar trennen zwischen:
  - Simulationszeit
  - Animationszeit
  - UI-/Overlayzeit
- fuer Invincibility, Spawn-Delays, Event-Phasen, Countdown-Logik und Bewegungsfenster dieselbe Zeitsprache verwenden
- dokumentieren, welche Systeme absichtlich zeitbasiert und welche absichtlich wegstreckenbasiert sind

**Spaeter wichtig fuer Erweiterungen**

Komplexe Events wie `refactoring` oder "alte Bugs werden reaktiviert" brauchen faire, reproduzierbare Zeitfenster. Sonst fuehlt sich ein Feature je nach Geraet anders an und ist kaum zu balancen.

**Erledigt wenn**

- Raketen, Respawn, Invincibility und Event-Phasen bildratenunabhaengig laufen
- Balancing-Aussagen wie "3 Sekunden", "alle 1.2 Sekunden" oder "10 Sekunden Warnzeit" technisch wirklich stimmen

### P1 - Score-, Ressourcen- und Fortschrittsmodell fachlich sauber definieren

**Problem**

Das aktuelle Scoring vermischt direkte Belohnungen, Distanzbonus, offene Bugs und Euro-pro-Stunde in einer Form, die spielerisch nicht immer intuitiv ist. Distanzpunkte sind nicht klar als monotone Progression modelliert, sondern haengen vom momentanen Balance-Faktor ab.

**Warum das wichtig ist**

Wenn kuenftig mehr Ressourcen und Effekte dazukommen, wird unklar, was eigentlich belohnt oder bestraft werden soll. Ohne klares Modell wird das Spiel schnell unfair oder schwer lesbar.

**Was getan werden soll**

- ein explizites Dokument oder Modul fuer die wirtschaftlichen und spielerischen Regeln einfuehren:
  - Was ist Fortschritt?
  - Was ist unmittelbare Belohnung?
  - Was ist Risiko?
  - Was ist Meta-Schaden?
- klarmachen, ob Distanzpunkte immer nur steigen duerfen
- klarmachen, ob "offene Bugs" nur aktuelle Gegner sind oder ein echter Backlog-Zustand
- definieren, wie Moneten, Score, Backlog, Lebenspunkte und Spezialeffekte zusammenhaengen
- den Unterschied modellieren zwischen:
  - aktiven Bugs im aktuellen Spielfeld
  - verpassten Bugs
  - geloesten Bugs
  - Bugs, die spaeter wieder aktiviert werden koennen

**Wichtig fuer die geplanten Erweiterungen**

Die von dir genannten Ideen machen diesen Punkt zentral:

- Ein neuer Gem-Typ, der alte Bugs wieder aus dem Backlog holt, braucht einen echten Backlog-Zustand.
- Ein `refactoring`-Event, das viele alte Bugs auf einmal loest, aber keine Moneten bringt, braucht eine andere Belohnungslogik als normale Einkommen-Collectibles.
- Spaeter koennte ein Event z. B. Distanzpunkte boosten, aber gleichzeitig aktuelle Einnahmen senken oder die Spawnrate neuer Bugs erhoehen. Das geht nur mit einem klaren Regelmodell.

**Erledigt wenn**

- es ein klares, schriftlich festgehaltenes Ressourcen- und Score-Modell gibt
- Score-Verhalten in Grenzfaellen bewusst entschieden ist
- kuenftige Ressourcen und Event-Belohnungen nicht mehr ad hoc ins bestehende System geschraubt werden muessen

### P1 - Bug-Lebenszyklus als eigenes Fachsystem modellieren

**Problem**

Der Begriff "Bug" wird aktuell fuer mehrere Dinge zugleich benutzt: als Gegner im Level, als HUD-Kennzahl und indirekt als Belastungsfaktor fuer die Wirtschaft. Diese Bedeutungen sollten getrennt werden.

**Warum das wichtig ist**

Sobald Bugs mehr koennen als nur rumlaufen und Schaden machen, reicht ein simples `alive`/`dead` nicht mehr aus.

**Was getan werden soll**

- ein explizites Zustandsmodell fuer Bugs definieren, zum Beispiel:
  - `active-world`
  - `missed`
  - `backlog`
  - `resolved`
  - `reactivated`
- festlegen, welche Aktionen Zustandswechsel ausloesen
- entscheiden, welche Regeln auf welchen Zustand wirken:
  - Spawnlogik
  - HUD-Anzeige
  - Score
  - Wirtschaft
  - Event-Effekte
- pruefen, ob `runBugStats` durch ein echtes Subsystem ersetzt werden sollte

**Wichtig fuer die geplanten Erweiterungen**

Das Backlog-Beispiel verlangt genau dieses Modell. "Alte Bugs wieder holen" ist kein Render-Thema, sondern ein Zustandswechsel im Spielsystem.

**Erledigt wenn**

- Bugs nicht mehr nur ueber Welt-Entities und zwei Counter beschrieben werden
- verpasste und spaeter reaktivierbare Bugs technisch sauber darstellbar sind
- kuenftige Event-Effekte massenhaft auf Bug-Zustaende arbeiten koennen

### P1 - Event-System von hart codierten Sonderfaellen zu einer erweiterbaren Struktur umbauen

**Problem**

Die aktuellen Special Events sind noch relativ direkt im Hauptcode verdrahtet. Das ist fuer zwei Events handhabbar, skaliert aber schlecht.

**Warum das wichtig ist**

Mit jedem neuen Event drohen mehr `if (eventType === ...)`-Verzweigungen in Spawn-, Update-, UI- und Score-Code.

**Was getan werden soll**

- Events als datengetriebene Definitionen oder klar getrennte Handler modellieren
- pro Event klar trennen:
  - Trigger/Vorwarnung
  - Dauer
  - aktive Gameplay-Effekte
  - Belohnung
  - Failure-/Success-Folgen
  - UI-Texte
- eine gemeinsame Event-Schnittstelle schaffen, damit kuenftige Events nicht mehr den Hauptloop aufbrechen

**Wichtig fuer die geplanten Erweiterungen**

Ein spaeteres `refactoring`-Event koennte zum Beispiel:

- viele alte Bugs auf einmal loeschen
- waehrenddessen neue Monetenquellen unterdruecken
- die Plattformen schwieriger machen
- bei Erfolg einen Progressionsbonus geben

Genau solche asymmetrischen Regeln brauchen ein Event-System mit klaren Haken statt Copy-Paste-Logik.

**Erledigt wenn**

- neue Events ohne tiefes Eingreifen in mehrere Kernfunktionen hinzugefuegt werden koennen
- Vorwarnung, Aktivphase und Belohnung pro Event klar modelliert sind
- Score-/Bug-/Spawn-Effekte pro Event nicht mehr im Monolith verteilt sind

### P1 - Dead Code und unklare Regelpfade bei Platzierung und Kollision aufraeumen

**Problem**

Einige Funktionen enthalten Logik, die entweder nie erreicht wird oder inhaltlich nicht mehr eindeutig ist, etwa bei sicheren Gem-Positionen oder sicherem Respawn.

**Warum das wichtig ist**

Je mehr Spezialfaelle dazukommen, desto teurer werden unklare Altpfade. Solche Stellen sind spaeter typische Bug-Nester.

**Was getan werden soll**

- `getSafeGemX()` pruefen und den derzeit toten Safe-Zone-Pfad aufloesen
- fuer Spawn-, Hazard- und Respawn-Sicherheit klar definieren, welche Garantien das Spiel geben will
- an problematischen Stellen lieber kleine, eindeutig benannte Regeln einfuehren als implizite Mathe direkt in grossen Funktionen zu verstecken

**Spaeter wichtig fuer Erweiterungen**

Neue Item-Arten werden schnell unterschiedliche Platzierungsregeln haben. Dann ist es wertvoll, wenn es ein klares Regelset fuer "sicher platzierbar", "sichtbar", "erreichbar" und "fair telegraphiert" gibt.

**Erledigt wenn**

- tote oder irrefuehrende Pfade entfernt sind
- Platzierungsregeln ausdruecklich und nachvollziehbar dokumentiert sind
- neue Pickup-Typen eigene Regeln nutzen koennen, ohne Copy-Paste derselben Mathematik

### P1 - Offline-/PWA-Assets an die tatsaechlich verwendeten Inhalte angleichen

**Problem**

Nicht alle im Spiel genutzten Assets werden vom Service Worker gecacht. Dadurch ist die installierte oder offline genutzte Version nicht vollstaendig.

**Warum das wichtig ist**

Gerade fuer ein kleines Spiel ist "installierbar und offline stabil" ein grosser Qualitaetsfaktor. Zudem wird dieser Bereich schnell vergessen, wenn spaeter mehr Assets dazukommen.

**Was getan werden soll**

- Assetliste mit den tatsaechlich referenzierten Dateien abgleichen
- sicherstellen, dass neue Sprites oder kuenftige UI-Assets nicht manuell vergessen werden
- optional ueberlegen, ob es einen kleinen Build-Schritt oder eine zentrale Asset-Definition geben soll

**Spaeter wichtig fuer Erweiterungen**

Mehr Gem-Arten, Event-Illustrationen oder Spezialeffekte werden den Asset-Bestand vergroessern. Dann lohnt sich eine systematische Quelle fuer Asset-Registrierung.

**Erledigt wenn**

- alle produktiv verwendeten Assets offline verfuegbar sind
- neue Assets nicht mehr an zwei oder drei Stellen manuell nachgetragen werden muessen

### P2 - Den Monolithen in klar getrennte Spielsysteme zerlegen

**Problem**

`game-endless.js` enthaelt Eingabe, Weltgenerator, Physik, Balancing, HUD, PWA-Logik, Rendering und Event-Steuerung in einer grossen Datei mit globalem Zustand.

**Warum das wichtig ist**

Der aktuelle Code ist noch lesbar, aber das Wachstum ist schon sichtbar. Weitere Features werden ohne Struktur sehr schnell ueberproportional teuer.

**Was getan werden soll**

- in fachlich sinnvolle Module trennen, zum Beispiel:
  - `state`
  - `simulation`
  - `generator`
  - `events`
  - `bugs`
  - `score`
  - `input`
  - `rendering`
  - `pwa`
- globale Variablen schrittweise in klar benannte State-Objekte oder Subsysteme ueberfuehren
- Render-Code so umbauen, dass er moeglichst wenig Logik besitzt und keinen Input-State fuer spaetere Events "zurueckschreibt"

**Wichtig fuer die geplanten Erweiterungen**

Neue Gem-Arten und Events werden sonst fast sicher gleichzeitig Generator, HUD, Score und Gegnerlogik anfassen. Ohne Modulschnittstellen wird jede Aenderung an mehreren Stellen fehleranfaellig.

**Erledigt wenn**

- neue Spielmechaniken in klar benennbaren Systemen landen
- zentrale Regeln nicht mehr quer ueber die Datei verteilt sind
- Rendering und Simulation besser getrennt sind

### P2 - Testbare Simulationskern-Logik einziehen

**Problem**

Es gibt aktuell keine Tests und kaum Teile der Spiellogik sind ohne Browser, Canvas und globale Seiteneffekte sauber pruefbar.

**Warum das wichtig ist**

Mit jedem weiteren Balancing-Feature steigt das Risiko unbemerkter Regressionen. Besonders Generator, Score und Event-Effekte sollten automatisiert abgesichert werden.

**Was getan werden soll**

- fuer reine Logikfunktionen einen testbaren Kern schaffen
- `Math.random()` und Zeit nicht direkt ueberall benutzen, sondern injizierbar machen
- mindestens fuer folgende Bereiche gezielte Tests vorsehen:
  - Chunk-Generierung
  - Bug-Zustandswechsel
  - Score- und Fortschrittsregeln
  - Event-Aktivierung und Ablauf
  - sichere Respawn- und Platzierungsregeln

**Wichtig fuer die geplanten Erweiterungen**

Wenn spaeter ein Refactoring-Event gleichzeitig zehn alte Bugs loesen soll, moechte man diese Regel testen koennen, ohne einen echten Run im Browser manuell nachzustellen.

**Erledigt wenn**

- zentrale Regeln in isolierten Tests pruefbar sind
- Zufall und Zeit fuer Tests kontrollierbar sind
- grosse Gameplay-Aenderungen nicht mehr nur per Hand getestet werden muessen

### P2 - Item-/Pickup-System verallgemeinern statt nur "Gem = Geld" zu kennen

**Problem**

Aktuell ist ein Pickup inhaltlich fast fest mit "Euro sammeln" verbunden. Das passt fuer den aktuellen Stand, skaliert aber schlecht.

**Warum das wichtig ist**

Deine Beispiele zeigen bereits, dass kuenftige Pickups unterschiedliche Wirkungen haben sollen. Das ist kein kosmetischer Zusatz, sondern ein Systemwechsel.

**Was getan werden soll**

- Pickups als Typen mit klaren Effekten modellieren, zum Beispiel:
  - `currency`
  - `backlog-revival`
  - `score-boost`
  - `temporary-shield`
  - `event-trigger`
- fuer jeden Pickup-Typ definieren:
  - Spawnregeln
  - Sichtbarkeit/Telegraphing
  - Sammel-Effekt
  - HUD-Feedback
  - Score-Auswirkung
- den Effekt nicht direkt beim Render-Objekt verdrahten, sondern ueber eine Spielregel-Ebene anwenden

**Wichtig fuer die geplanten Erweiterungen**

Ein Gem, das alte Bugs aus dem Backlog zurueckholt, ist spielerisch etwas voellig anderes als Geld. Das System sollte deshalb nicht nur "anderes Icon, gleiche Klasse" sein.

**Erledigt wenn**

- neue Pickup-Arten ohne Kopieren der Geld-Gem-Logik gebaut werden koennen
- Pickup-Effekte als fachliche Regeln und nicht als Sonderfaelle im Kollisionscode leben

### P3 - Debug-, Balancing- und Content-Werkzeuge ausbauen

**Problem**

Es gibt bereits erste Debug-Hooks fuer Special Events, aber noch keine echte Arbeitsgrundlage fuer spaeteres Content- und Balancing-Tuning.

**Warum das sinnvoll ist**

Je mehr Systeme dazukommen, desto mehr Zeit spart ein kleiner Debug-Werkzeugkasten.

**Was getan werden soll**

- leicht aktivierbare Debug-Konfiguration fuer:
  - Event-Typ erzwingen
  - Spawnraten anheben/senken
  - bestimmte Pickup-Typen erzwingen
  - Bug-Backlog vorbefuellen
  - Score- und Ressourcenwerte simulieren
- sichtbare Debug-Anzeige fuer State-Werte in einer Entwicklungsansicht

**Wichtig fuer die geplanten Erweiterungen**

Gerade komplexe Events wie spaetere Refactoring-Phasen lassen sich sonst nur sehr langsam manuell erreichen und testen.

**Erledigt wenn**

- komplexe Spielsituationen gezielt reproduzierbar sind
- Balancing nicht mehr nur ueber langes manuelles Spielen moeglich ist

### P3 - Architektur- und Regelentscheidungen kurz dokumentieren

**Problem**

Viele gute Intentionen sind im Code bereits erkennbar, aber nicht als belastbare Architektur- oder Gameplay-Entscheidung festgehalten.

**Warum das sinnvoll ist**

Mit wachsendem Umfang wird es immer wichtiger zu wissen, warum ein System so gebaut wurde und welche Invarianten gelten sollen.

**Was getan werden soll**

- kurze technische Notizen oder `docs/`-Dateien fuer Kernsysteme anlegen
- insbesondere dokumentieren:
  - Bug-Lebenszyklus
  - Score- und Ressourcenmodell
  - Event-Lebenszyklus
  - Generator-Regeln
  - Respawn-/Fairness-Garantien

**Erledigt wenn**

- kuenftige Aenderungen nicht mehr nur aus impliziten Annahmen im Code erfolgen
- neue Features an bestehenden Regeln ausgerichtet statt "hineingebaut" werden

## Empfohlene Reihenfolge

1. P0 Weltgenerator stabilisieren
2. P0 Cleanup und aktive Welt-Entities korrigieren
3. P0 Mobile Resume und Pause-Semantik reparieren
4. P0 Timer auf Zeitbasis vereinheitlichen
5. P1 Score-/Ressourcenmodell definieren
6. P1 Bug-Lebenszyklus als eigenes System modellieren
7. P1 Event-System verallgemeinern
8. P1 Platzierungs- und Regelpfade aufraeumen
9. P1 PWA-/Asset-Management korrigieren
10. P2 Monolith in Systeme schneiden
11. P2 testbaren Simulationskern einfuehren
12. P2 Pickup-System fuer mehrere Gem-Arten und Effekte vorbereiten
13. P3 Debug- und Dokumentationskomfort ausbauen

## Wichtige Leitplanken fuer kuenftige Features

Bei allen kommenden Erweiterungen sollte geprueft werden, ob ein neues Feature wirklich nur "mehr Content" ist oder eigentlich ein neues Fachsystem benoetigt. Ein paar konkrete Hinweise:

- "alte Bugs aus dem Backlog holen" ist kein normaler Pickup-Effekt, sondern ein Eingriff in den Bug-Lebenszyklus
- "Refactoring" ist kein weiteres Spawn-Event wie die bisherigen Events, sondern eher ein spielsystemischer Modus mit eigenen Erfolgs- und Belohnungsregeln
- neue Gems sollten nicht nur neue Icons mit anderer Punktzahl sein, sondern als konfigurierbare Pickup-Typen gedacht werden
- Fortschritt, Geld, Risiko und Schulden sollten vier getrennte Begriffe bleiben, auch wenn sie sich gegenseitig beeinflussen
