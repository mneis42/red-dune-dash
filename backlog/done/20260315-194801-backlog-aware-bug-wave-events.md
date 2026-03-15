planungsmodell: unknown-model
feature_titel: Dynamisches Event-Timing und backlog-bewusste Bugwelle
feature_zusammenfassung: >
  Bugwelle und Großauftrag sollen nach einer kürzeren zufälligen Wartezeit von
  2 bis 5 Minuten starten, die Event-Auswahl soll bei vielen ungelösten Bugs
  stärker zur Bugwelle tendieren, und die Bugwelle soll teilweise positiv werden,
  indem sie nicht immer neue Bugs erzeugt, sondern mit 50% Chance bestehende
  ungelöste Bugs reaktiviert.
aktueller_status: fertig-verifiziert-bereit-zum-archivieren

annahmen_und_offene_fragen:
  - Das gewünschte Zeitfenster von 2 bis 5 Minuten sollte die aktuelle globale Event-Wartezeit für beide bestehenden Event-Typen ersetzen und keine zusätzliche pro-Typ-Logik einführen.
  - "Viele nicht gefixte Bugs" sollte als aktueller offener Bug-Druck des Runs interpretiert werden, also `activeWorld + missed + backlog + reactivated`.
  - Für den positiven Bugwelle-Effekt ist der fachlich sauberste Quellpool eine Menge ungelöster historischer Bugs aus `backlog` und `missed`, nicht bereits aktive Welt-Bugs.
  - Für die Reaktivierung durch die Bugwelle dürfen historische ungelöste Bugs aus `missed`, `backlog` und bereits `reactivated` markierten Einträgen erneut als Quelle dienen, solange sie nicht aktuell als aktive Welt-Bugs existieren.
  - Reaktivierte Bugs sollen ebenfalls als "noch nicht gefixt" in die Gewichtung der Event-Auswahl eingehen, da ein historisch ungelöster Bug fachlich offen bleibt, auch wenn er schon einmal reaktiviert wurde.
  - Reaktivierte Bugs brauchen keine gesonderte Telegraph- oder Visuallogik und sollen sich in der Darstellung wie normale Bugwelle-Bugs verhalten.
  - Die 50%-Reuse-Regel soll sowohl für fallende als auch für laufende Boden-Bugs der Bugwelle gelten.

fit_bewertung:
  urteil: gute_passung_mit_kleiner_praezisierung
  begruendung:
    - Die Idee passt gut zur bestehenden Asymmetrie zwischen Bugwelle als Druck-Event und Großauftrag als Ertrags-Event.
    - Eine Backlog-abhängige Event-Auswahl verbindet den aktuellen Spielerzustand sinnvoll mit den Live-Events, ohne einen neuen Event-Typ einzuführen.
    - Dass die Bugwelle manchmal ungelöste historische Bugs sichtbar macht, passt zur bereits dokumentierten Richtung für Backlog- und Reaktivierungsmechaniken und verhindert, dass das Event nur bestraft.
    - Empfehlenswert ist eine kleine Präzisierung: "bestehende ungelöste Bugs" sollten Lifecycle-Einträge außerhalb der aktiven Welt meinen, sonst könnten sichtbare Bugs dupliziert und Zustände verwirrend werden.

auswirkungsbewertung_gameplay_und_konsistenz:
  staerken:
    - Das kürzere Zeitfenster von 2 bis 5 Minuten macht die Event-Ebene in normalen Runs sichtbarer.
    - Eine Gewichtung nach ungelösten Bugs verstärkt das Feedback an den Spieler: Wer zurückfällt, erlebt eher eine Bugwelle.
    - Der 50%-Reaktivierungsweg macht die Bugwelle zu einem Risiko-Nutzen-Event statt zu einer reinen Negativspirale.
  risiken:
    - Wenn die Bugwelle bei hohem Backlog zu häufig wird, könnte Großauftrag zu selten erscheinen und die Run-Ökonomie abflachen.
    - Wenn reaktivierte Spawns zu großzügig sind, könnte die Bugwelle vom Druck-Event zum optimalen Farm-Event kippen.
    - Wenn reaktivierte Bugs ohne klare Lifecycle-Bedeutung gespawnt werden, könnten HUD-Zähler falsch wirken oder das Backlog scheinbar nicht schrumpfen.
  empfohlene_anpassungen:
    - Statt eines harten Umschalters sollte eine gedeckelte Gewichtungsfunktion genutzt werden, damit Großauftrag immer möglich bleibt.
    - Beim Umwandeln eines Bugwelle-Spawns in eine Reaktivierung sollten ungelöste historische Einträge aus `missed`, `backlog` und `reactivated` genutzt werden können, solange dadurch keine bereits aktiven Welt-Bugs dupliziert werden.
    - Falls kein passender historischer Bug verfügbar ist, sollte sauber auf einen normalen neuen Bug-Spawn zurückgefallen werden.

architektur_und_codebase_auswirkungen:
  wichtigste_integrationspunkte:
    - `systems/special-event-system.js`
    - `game-endless.js`
    - `systems/bug-lifecycle-system.js`
    - `tests/simulation-core.test.js`
    - `docs/event-model.md`
  bewertung:
    - Die Event-Planung hat aktuell eine globale Zufallswartezeit und eine gleichverteilte Typ-Auswahl. Die Delay-Änderung ist einfach, die gewichtete Auswahl braucht aber einen neuen injizierbaren Hook oder einen sauberen Kontextzugriff statt fest eingebauter Backlog-Logik im Scheduler.
    - Die Bugwelle kann derzeit nur neue Welt-Bugs erzeugen. Um historische Reaktivierung sauber zu unterstützen, wird voraussichtlich ein dedizierter Hook wie `spawnBugWaveEntity` oder `spawnBugWaveBug({ preferReactivation })` benötigt.
    - Das Lifecycle-System modelliert bereits `backlog`, `missed` und `reactivated`, daher passt die Idee gut zu den vorhandenen Datenstrukturen.
    - Der aktuelle Helfer `reactivateHistoricalBugs(amount)` ändert nur Lifecycle-Zustände, erzeugt aber keine passenden Welt-Entities. Diese Lücke muss für das Feature explizit geschlossen werden.

verifikationsbasis:
  automatisierte_checks:
    - `npm run check`
    - `npm test`
  aktuelle_relevante_abdeckung:
    - Das deterministische Verhalten des Special-Event-Schedulers ist bereits in `tests/simulation-core.test.js` abgedeckt.
    - Bug-Lifecycle-Zähler und historische Statuswechsel haben bereits Basistests.
  aktuelle_luecken:
    - Es gibt noch keinen automatisierten High-Level-Test direkt gegen `game-endless.js`, der die konkrete Bugwelle-Reaktivierung im kompletten Run simuliert.
    - Es existiert noch kein höherstufiger Gameplay-Smoke-Test für Event-Häufigkeit und Balance in längeren Runs.

priorisierter_implementierungsplan:
  - ausfuehrungsmodell: unknown-model
    prioritaet: P0
    titel: Regeln für ungelöste Bugs und Gewichtung präzisieren
    status: completed
    ziel: Die genauen Spielregeln festziehen, bevor Scheduler- oder Spawn-Code geändert wird.
    geplante_aenderungen:
      - Die exakte Metrik für ungelöste Bugs definieren, die in die Event-Gewichtung eingeht.
      - Festhalten, dass die Bugwelle historische ungelöste Einträge aus `missed`, `backlog` und `reactivated` wiederverwenden darf, solange sie nicht aktuell als Welt-Bug aktiv sind.
      - Festlegen, ob die 50%-Reuse-Regel für fallende Spawns, Boden-Spawns oder beide gilt.
    abhaengigkeiten_oder_voraussetzungen:
      - Keine
    risiken_oder_edge_cases:
      - Unklare Regeln würden später zu irreführenden HUD-Zählern und schwer balancierbarem Verhalten führen.
    erforderliche_verifikation:
      - Planabgleich mit aktuellem Event- und Bug-Lifecycle-Modell.
      - Erledigt: Regeln in `todo.md` präzisiert und vor Implementierung bestätigt.
    abschlusskriterien:
      - Die Feature-Regeln sind präzise genug, um sie in deterministischen Tests zu codieren.
    relevante_dateien:
      - `todo.md`
      - `docs/event-model.md`

  - ausfuehrungsmodell: unknown-model
    prioritaet: P1
    titel: Backlog-abhängige Event-Auswahl im Special-Event-Scheduler ergänzen
    status: completed
    ziel: Die gleichverteilte Zufallsauswahl durch eine deterministische Gewichtung nach offenem Bug-Druck ersetzen, ohne den gemeinsamen Event-Lebenszyklus zu beschädigen.
    geplante_aenderungen:
      - `createSpecialEventSystem` um einen Gewichtungs- oder Auswahl-Hook erweitern statt fest eingebauter Gleichverteilung.
      - Die aktuellen Bug-Zähler des Runs nutzen, um bei vielen offenen Bugs die Wahrscheinlichkeit für Bugwelle zu erhöhen; `reactivated` zählt dabei ebenfalls als ungelöst.
      - Das bestehende Debug-Verhalten für erzwungene Event-Typen unverändert lassen.
    abhaengigkeiten_oder_voraussetzungen:
      - P0-Regelklärung
    risiken_oder_edge_cases:
      - Die Event-Auswahl kann in Tests nicht mehr deterministisch sein, wenn der neue Hook nicht injizierbar bleibt.
      - Eine zu aggressive Gewichtung könnte Großauftrag faktisch verdrängen.
    erforderliche_verifikation:
      - Deterministische Tests für Event-Auswahl bei niedrigem und hohem ungelöstem Bug-Druck ergänzen.
      - `npm run check` und `npm test` ausführen.
      - Erledigt: gewichtete Auswahl über `pickWeightedEventType(...)` und injizierten `pickType(...)` in `tests/simulation-core.test.js` abgesichert; `npm run check` und `npm test` grün.
    abschlusskriterien:
      - Der Scheduler behält seine Phasen und Timings, wählt bei höherem ungelöstem Bug-Druck aber häufiger Bugwelle.
    relevante_dateien:
      - `systems/special-event-system.js`
      - `game-endless.js`
      - `tests/simulation-core.test.js`

  - ausfuehrungsmodell: unknown-model
    prioritaet: P1
    titel: Bugwelle-Reaktivierung mit sauberem Fallback implementieren
    status: completed
    ziel: 50% der Bugwelle-Spawn-Versuche sollen historische ungelöste Bugs wiederverwenden, wenn welche verfügbar sind, sonst wie heute neue Bugs erzeugen.
    geplante_aenderungen:
      - Einen dedizierten Bugwelle-Spawn-Hook ergänzen, der für fallende und laufende Spawns zwischen neuem Spawn und historischer Reaktivierung wählen kann.
      - Einen geeigneten Lifecycle-Eintrag aus `missed`, `backlog` oder `reactivated` auswählen und einen passenden Welt-Bug mit `BUG_STATUS.REACTIVATED` erzeugen.
      - Falls kein geeigneter historischer Eintrag existiert, auf den normalen neuen Spawn zurückfallen.
    abhaengigkeiten_oder_voraussetzungen:
      - P0-Regelklärung
    risiken_oder_edge_cases:
      - Lifecycle-Zähler können auseinanderlaufen, wenn ein Eintrag auf reaktiviert gesetzt wird, ohne dass ein passender Welt-Bug entsteht.
      - Die Wiederverwendung bereits aktiver Bugs würde Duplikate und inkonsistente Wertung erzeugen.
    erforderliche_verifikation:
      - Deterministische Tests für die Fälle "historischer Bug verfügbar" und "kein historischer Bug verfügbar" ergänzen.
      - `npm run check` und `npm test` ausführen.
      - Erledigt: Auswahl reaktivierbarer Lifecycle-Einträge in `tests/simulation-core.test.js` abgesichert; `npm run check` und `npm test` grün.
    abschlusskriterien:
      - Die Bugwelle kann historischen ungelösten Bestand über aktives Spielen abbauen, sowohl bei fallenden als auch bei Boden-Spawns, ohne bestehende Bug-Zähler zu beschädigen.
    relevante_dateien:
      - `systems/special-event-system.js`
      - `systems/bug-lifecycle-system.js`
      - `game-endless.js`
      - `tests/simulation-core.test.js`

  - ausfuehrungsmodell: unknown-model
    prioritaet: P1
    titel: Special-Event-Wartefenster auf 2 bis 5 Minuten reduzieren
    status: completed
    ziel: Bestehende Events in einer engeren und deutlicheren Kadenz auftreten lassen, ohne ihre bestehende Ankündigungs- oder Aktivdauer zu verändern.
    geplante_aenderungen:
      - Die produktive Special-Event-Konfiguration auf eine Zufallswartezeit zwischen 120000 ms und 300000 ms umstellen.
      - Event-spezifische Ankündigungs- und Aktivdauern unverändert lassen.
      - Sicherstellen, dass Debug-Overrides für Delay weiterhin Vorrang haben.
    abhaengigkeiten_oder_voraussetzungen:
      - Keine
    risiken_oder_edge_cases:
      - Häufigere Events können Balancing-Probleme in langen Runs früher sichtbar machen.
    erforderliche_verifikation:
      - Tests ergänzen oder anpassen, die belegen, dass der Scheduler weiter `minDelay` und `maxDelay` respektiert.
      - `npm run check` und `npm test` ausführen.
      - Erledigt: bestehende Scheduler-Tests bleiben grün; Produktionskonfiguration steht nun auf 120000 bis 300000 ms; `npm run check` und `npm test` grün.
    abschlusskriterien:
      - Die Produktionskonfiguration verwendet das neue Zeitfenster von 2 bis 5 Minuten.
    relevante_dateien:
      - `game-endless.js`
      - `tests/simulation-core.test.js`

  - ausfuehrungsmodell: unknown-model
    prioritaet: P2
    titel: Neue Event-Gewichtung und Bugwelle-Backlog-Verhalten dokumentieren
    status: completed
    ziel: Die technische Dokumentation an die neuen Event-Semantiken und Erweiterungspunkte anpassen.
    geplante_aenderungen:
      - Das Event-Modell um die gewichtete Event-Auswahl und das historische Reaktivierungsverhalten der Bugwelle ergänzen.
      - Neue Hooks oder Lifecycle-Erwartungen dokumentieren.
    abhaengigkeiten_oder_voraussetzungen:
      - P1-Arbeiten an Scheduler und Bugwelle abgeschlossen
    risiken_oder_edge_cases:
      - Dokumentation kann driften, wenn sich die finale Balancing-Formel vom Plan unterscheidet.
    erforderliche_verifikation:
      - Manuelle Doku-Prüfung gegen die Implementierung.
      - Erledigt: `docs/event-model.md` an Scheduler-Gewichtung, 2-bis-5-Minuten-Fenster und Bugwelle-Reaktivierung angepasst.
    abschlusskriterien:
      - Künftige Mitwirkende können das neue Verhalten verstehen, ohne den gesamten Game-Loop lesen zu müssen.
    relevante_dateien:
      - `docs/event-model.md`

risiken_und_gegenmassnahmen:
  - risiko: Event-Kadenz und gewichtete Bugwelle-Auswahl könnten für schwächere Runs eine Negativspirale erzeugen.
    gegenmassnahme: Die Bugwelle-Wahrscheinlichkeit deckeln und Großauftrag auf allen Backlog-Stufen erreichbar halten.
  - risiko: Ohne gesonderte Darstellung könnten Reaktivierungen für Spieler nicht direkt von neuen Bugs unterscheidbar sein.
    gegenmassnahme: Das ist laut gewünschter Feature-Regel akzeptiert; wichtig bleibt nur, dass Lifecycle-Zähler und Balancing intern korrekt bleiben.
  - risiko: Lifecycle-Ledger und Welt-Entities könnten auseinanderlaufen.
    gegenmassnahme: Einen einzigen Spawn-Pfad verwenden, der Lifecycle-Mutation und Welt-Entity-Erzeugung immer koppelt, und beide Wege gezielt testen.
  - risiko: Das Balancing könnte stark davon abhängen, wie "offene Bugs" gezählt werden.
    gegenmassnahme: Die Gewichtungsbasis über einen klaren Helper auf Basis des bestehenden Run-Modells zentralisieren.

teststrategie:
  - `tests/simulation-core.test.js` um deterministische Tests für die Event-Auswahl mit injizierten Zufallswerten und explizitem Bug-Druck erweitern.
  - Deterministische Tests für Bugwelle-Spawns ergänzen, die historische Bugs sowohl für fallende als auch für Boden-Spawns wiederverwenden, inklusive Fallback wenn keine ungelösten historischen Einträge existieren.
  - Die vollständige Regression weiter über `npm run check` und `npm test` absichern.
  - Nach der Implementierung einen kurzen manuellen Gameplay-Check mit niedrigem und hohem Debug-Backlog durchführen.

dokumentations_nachverfolgung:
  - `docs/event-model.md` aktualisieren, falls der Scheduler neue Hooks für gewichtete Auswahl erhält.
  - Optional `docs/debug-tools.md` ergänzen, falls neue Debug-Szenarien für backlog-lastige Bugwellen hinzukommen.
  - Nur wenn sich Debug- oder Test-Workflows ändern, eine kurze README-Anpassung erwägen.

finale_verifikation:
  - `npm run check` erfolgreich
  - `npm test` erfolgreich
  - `docs/event-model.md` gegen die implementierte Event-Auswahl und Bugwelle-Reaktivierung abgeglichen
  - Kein separater manueller Gameplay-Smoke-Test ausgefuehrt
