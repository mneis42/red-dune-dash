planning_model: unknown-model
feature_title: Big-Order Euro Bonus Pickups With Bug Risk
feature_summary: >
  Waehren des Special Events "Grossauftrag" sollen zusaetzliche Euro-Pickups
  gelegentlich als deutlich groessere Bonus-Variante erscheinen. Diese bringen
  1,00 EUR statt 10 ct und koennen beim Einsammeln mit 50% Wahrscheinlichkeit
  direkt an derselben Stelle einen Bug erzeugen. Zusaetzliche Grossauftrag-
  Euro-Spawns duerfen bestehende Dichte-/Abstandsbremsen fuer normale
  Euro-Symbole gezielt ignorieren, damit der Event-Effekt sichtbar wird.
current_status: implemented-awaiting-archive

assumptions_and_unresolved_questions:
  assumptions:
    - Die neue Bonus-Variante gilt nur fuer Grossauftrag-spezifische Currency-Spawns und nicht fuer normale Income-Pickups ausserhalb des Events.
    - "Ca. doppelt so gross" bedeutet primaer eine groessere visuelle Render-/Collisions-Radius-Variante, ohne neue Asset-Datei.
    - Der nach dem Einsammeln entstehende Bug soll dieselbe Telegraph-/SpawnTimer-Logik wie sichtbare Bugwellen-Bugs nutzen und dadurch zunaechst noch nicht gefaehrlich sein.
    - Der Spawn darf auch nahe oder auf der Spielerposition angekuendigt werden, solange die bestehende Telegraph-Phase die gleiche faire Reaktionszeit wie in der Bugwelle gibt.
    - Hazard-Sicherheitsregeln fuer Pickup-Platzierung bleiben bestehen; ignoriert werden duerfen nur Dichte-/Spawnbremsen fuer zusaetzliche Grossauftrag-Euro-Sichtbarkeit.
  unresolved_questions:
    - Soll die 30%-Chance nur fuer die waehrend der Aktivphase sichtbaren Grossauftrag-Extra-Spawns gelten oder auch fuer chunk-generierte Grossauftrag-Moneten? Empfehlung: zunaechst nur fuer sichtbare Grossauftrag-Extra-Spawns, waehrend Chunk-Dichte separat gelockert werden kann.
    - Soll der Status-/HUD-Text fuer die 1-EUR-Variante explizit anders sein? Empfehlung: ja, klare Rueckmeldung wie "1 EUR geborgen".

fit_assessment:
  verdict: adjusted-fit-good
  assessment: >
    Die Idee passt gut zum bestehenden Charakter des Grossauftrags als
    Ertrags-Event mit hoeherem Risiko. Der vorgeschlagene Gegenzug "mehr Wert,
    aber moeglicher Bug-Spawn" staerkt die Event-Identitaet und bleibt konsistent
    mit dem vorhandenen Muster "mehr Moneten und mehr Bugs unterwegs". Fuer gute
    Spielkonsistenz sollte die Mechanik aber auf Grossauftrag-spezifische Spawns
    begrenzt bleiben, damit Standard-Pickups berechenbar bleiben.
  recommended_adjustments:
    - Die Bonus-Variante ueber Pickup-Metadaten statt ueber einen komplett neuen Sonderfall im Hauptloop modellieren.
    - Bug-Spawn nur ueber vorhandene sichere Plattform-/Visible-Spawn-Helfer ausloesen, damit keine unfairen Soforttreffer entstehen.

impact_assessment_gameplay_and_ux:
  positives:
    - Staerkere Varianz im Grossauftrag ohne neues globales System.
    - Hoher Reward mit klarer Risikoentscheidung beim Einsammeln.
    - Die Mechanik verstaerkt das Event-Narrativ und macht sichtbare Grossauftrag-Spawns spannender.
    - Gelockerte Dichtebremsen machen den Event-Effekt fuer Spieler endlich klar wahrnehmbar.
  risks:
    - Wenn der Bonus-Euro-Bug nicht dieselbe Telegraph-Phase wie Bugwellen-Bugs nutzt, wirkt der 50%-Spawn unfair.
    - Wenn dieselbe Currency-Definition stillschweigend fuer 10 ct und 1 EUR verwendet wird, werden Status-Text und Balancing schwerer nachvollziehbar.
    - Ein rein visueller Groessenboost ohne angepasste Pickup-Radius-/Renderdaten koennte sich unklar anfuehlen.
    - Zu aggressiv gelockerte Dichte kann zu ueberlagerten oder schwer lesbaren Pickup-Clustern fuehren.
  balancing_notes:
    - 30% auf 1 EUR ist ein grosser Einkommenssprung gegenueber 10 ct und sollte gezielt auf Event-Spawns begrenzt bleiben.
    - Der 50%-Bug-Spawn ist ein sinnvoller Ausgleich, sollte aber nicht zu unmittelbaren Kollisionen oder unlesbaren Spawn-Ketten fuehren.
    - Grossauftrag sollte bei sichtbaren Extra-Spawns bewusst dichter wirken als das Basisspiel; lesbare Ueberlappung ist dabei besser als ein kaum bemerkbarer Event-Bonus.

architecture_and_codebase_impact:
  affected_systems:
    - systems/pickup-system.js
    - systems/special-event-system.js
    - game-endless.js
    - tests/simulation-core.test.js
    - docs/event-model.md
  assessment: >
    Die sauberste Anbindung ist, die bestehende Currency-Definition um optionale
    Pickup-Metadaten fuer Wert, Render-Scale und Spawn-Nebenwirkung zu erweitern.
    Der Grossauftrag bleibt weiter fuer das "Wann" des Spawns zustaendig; die
    Pickup-Definition bzw. deren Effektpfad uebernimmt das "Was passiert beim
    Einsammeln". Fuer die zusaetzliche Sichtbarkeit braucht es ausserdem einen
    gezielten Bypass fuer normale Grossauftrag-Dichtebremsen, ohne allgemeine
    Hazard-/Fairnessregeln fuer Pickup-Platzierung aufzugeben.
  integration_points:
    - `spawnBigOrderGem()` in `game-endless.js` muss Grossauftrag-spezifische Pickup-Metadaten setzen.
    - `addPickupOnPlatform()` bzw. der darunterliegende Platzierungspfad in `game-endless.js` braucht optional einen Grossauftrag-Bypass fuer normale Income-/Dichtebremsen.
    - `applyPickupEffect()` in `game-endless.js` braucht einen Hook fuer optionalen Bug-Spawn aus Pickup-Metadaten.
    - Der Bug-Spawn-Hook sollte auf bestehende `createBug(..., { telegraph: true })`-Pfade bzw. deren Helfer aufsetzen.
    - `createPickupDefinitions()` in `systems/pickup-system.js` muss Currency-Overrides fuer Wert, Render und Status-Text respektieren.
    - Tests sollten sowohl Definition/Metadaten als auch deterministische Grossauftrag-Spawn-Entscheidungen absichern.

verification_baseline_before_implementation:
  current_automated_checks:
    - `node tests/simulation-core.test.js`
  current_relevant_coverage:
    - Pickup-System hat bereits Node-Tests fuer Metadaten-Erhalt und Currency-Effekte.
    - Special-Event-System hat deterministische Tests fuer Grossauftrag-Spawn-Timer.
  missing_coverage_for_feature:
    - Kein Test fuer variantenspezifische Currency-Werte oder Render-Overrides.
    - Kein Test fuer Grossauftrag-Bonus-Euro-Chance.
    - Kein Test fuer bug-aus-pickup Nebenwirkung mit fairer Spawn-Delegation.

implementation_verification:
  completed_checks:
    - `node tests/simulation-core.test.js` erfolgreich nach Implementierung aller Codeaenderungen.
  manual_checks_not_run:
    - Kein manueller Browser-Gameplay-Check in dieser Session ausgefuehrt.

prioritized_implementation_plan:
  - execution_model: unknown-model
    priority: P1
    title: Extend typed currency pickups with value and variant metadata
    status: completed
    objective: >
      Currency-Pickups sollen ihren Wert, Status-Text und ihre Render-/Radius-
      Variante ueber Pickup-Metadaten uebersteuern koennen, ohne einen neuen
      globalen Pickup-Typ einzufuehren.
    planned_changes:
      - `systems/pickup-system.js` so erweitern, dass Currency-Effekte optional `currencyCents`, `statusMessage`, `renderScale` oder aequivalente Variant-Metadaten aus dem Pickup lesen.
      - Render-Modell so anpassen, dass groessere Grossauftrag-Euro-Symbole sichtbar etwa doppelt so gross dargestellt werden koennen.
      - Sicherstellen, dass existierende normale Currency-Pickups unveraendert bei 10 ct bleiben.
    dependencies_or_prerequisites:
      - Bestehende Pickup-Metadaten in `createPickup()` muessen erhalten bleiben.
    risks_or_edge_cases:
      - Render-Overrides duerfen andere Pickup-Typen nicht unbeabsichtigt beeinflussen.
      - Groesserer Radius darf Sammelreichweite nicht unverhaeltnismaessig aufblaehen.
    verification_required:
      - Node-Test fuer Currency-Pickup mit Metadaten-Override auf 100 ct.
      - Node-Test fuer Metadaten-Erhalt inkl. Variant-Flags/Scale.
    completion_criteria:
      - Normale Currency funktioniert unveraendert.
      - Bonus-Euro-Variante kann ueber Metadaten dargestellt und ausgewertet werden.
    execution_notes:
      - `systems/pickup-system.js` liest nun optional `currencyCents`, `statusMessage`, `renderScale` und `spawnBugOnCollect` direkt aus Pickup-Metadaten.
      - Currency-Pickups skalieren ihren Radius ueber `renderScale`, und `getRenderModel()` gibt die Render-Skalierung fuer die Anzeige zurueck.
      - Neue Tests decken Radius-/Render-Metadaten sowie 100-ct-Currency-Overrides ab.
    verification_performed:
      - `node tests/simulation-core.test.js`
    relevant_files:
      - systems/pickup-system.js
      - tests/simulation-core.test.js

  - execution_model: unknown-model
    priority: P1
    title: Add Grossauftrag bonus-euro spawn selection and denser visible euro spawns
    status: completed
    objective: >
      Sichtbare Grossauftrag-Extra-Spawns sollen mit 30% Chance die groessere
      1-EUR-Variante erzeugen und insgesamt dichter erscheinen duerfen als
      normale Euro-Spawns.
    planned_changes:
      - `spawnBigOrderGem()` in `game-endless.js` um eine 30%-Entscheidung fuer die Bonus-Variante erweitern.
      - Bonus-Spawns mit klaren Pickup-Metadaten markieren, damit Einsammeln und Rendering dieselbe Wahrheit verwenden.
      - Fuer sichtbare Grossauftrag-Extra-Spawns vorhandene Income-/Dichtebremsen gezielt umgehen, wenn sie den Event-Effekt praktisch unsichtbar machen.
      - Falls mehrere Grossauftrag-Euro-Spawns dieselbe Plattform nutzen, eine lesbare Platzierungsstrategie waehlen statt alle auf denselben Standardpunkt zu stapeln.
      - Falls sinnvoll, Grossauftrag-Konstanten zentral in der Event-/Balancing-Konfiguration dokumentieren statt Magic Numbers zu streuen.
    dependencies_or_prerequisites:
      - TODO "Extend typed currency pickups with value and variant metadata"
    risks_or_edge_cases:
      - Die 30%-Chance darf Debug-/Test-Determinismus nicht erschweren; Random-Injektion oder kapselbare Helfer bevorzugen.
      - Es muss klar bleiben, dass Standard-Platform-Pickups nicht betroffen sind.
      - Gelockerte Dichte darf Hazard-Safe-Zones nicht verletzen.
      - Mehrere sichtbare Euro-Spawns duerfen nicht so stark ueberlappen, dass der Spieler den Effekt nur als einzelnes Symbol wahrnimmt.
    verification_required:
      - Deterministischer Test fuer Spawn-Entscheidung normal vs. Bonus-Euro.
      - Test dafuer, dass sichtbare Grossauftrag-Extra-Spawns nicht an `shouldSpawnIncomeSource()` scheitern.
      - Test oder gezielte manuelle Pruefung fuer lesbar dichtere Platzierung auf derselben Plattform.
      - Kurzer manueller Sichtcheck auf groessere Darstellung im Grossauftrag.
    completion_criteria:
      - Nur Grossauftrag-Extra-Spawns koennen als Bonus-Euro erscheinen.
      - Grossauftrag-Extra-Euro-Spawns sind sichtbar dichter/haeufiger als im Basisspiel.
      - Die Spawn-Wahrscheinlichkeit ist im Code lesbar und testbar verankert.
    execution_notes:
      - `systems/special-event-system.js` enthaelt jetzt `pickBigOrderCurrencyVariant(...)` fuer die deterministische Auswahl normaler vs. grosser Bonus-Euro-Spawns.
      - `spawnBigOrderGem()` in `game-endless.js` markiert sichtbare Grossauftrag-Extra-Spawns jetzt mit Variant-Metadaten, 30%-Bonus-Euro-Chance und 1-EUR-Wert.
      - `addGemOnPlatform()` randomisiert waehrend aktivem Grossauftrag Currency-X-Positionen auf Safe-Zones, damit mehrfach gespawnte Euro-Symbole auf derselben Plattform sichtbarer verteilt erscheinen.
    verification_performed:
      - `node tests/simulation-core.test.js`
    relevant_files:
      - game-endless.js
      - tests/simulation-core.test.js
      - docs/event-model.md

  - execution_model: unknown-model
    priority: P1
    title: Spawn a telegraphed bug from collected bonus-euro pickups
    status: completed
    objective: >
      Beim Einsammeln eines Bonus-Euro-Pickups soll mit 50% Wahrscheinlichkeit
      ein Bug an derselben Stelle bzw. auf derselben Plattform erscheinen und
      zunaechst per Telegraph-/SpawnTimer-Phase sichtbar angekuendigt werden,
      statt sofort gefaehrlich zu sein.
    planned_changes:
      - `applyPickupEffect()` in `game-endless.js` um einen optionalen Pickup-Hook fuer "spawn bug on collect" erweitern.
      - Einen bestehenden Visible-/Platform-Bug-Spawn-Helfer wiederverwenden oder leicht erweitern, damit an Position/Plattform des eingesammelten Pickups mit `telegraph: true` gespawnt werden kann.
      - Das Verhalten bewusst an der Bugwelle ausrichten: Spawn darf angekuendigt auch dort stattfinden, wo der Spieler gerade steht, solange die Aktivierung verzoegert bleibt.
      - Nur Bonus-Euro-Pickups mit dieser Nebenwirkung markieren; normale Currency bleibt folgenlos.
    dependencies_or_prerequisites:
      - TODO "Extend typed currency pickups with value and variant metadata"
    risks_or_edge_cases:
      - Der Spawn darf nicht versehentlich ohne Telegraph aktiv werden.
      - Wenn unter dem Pickup keine tragfaehige Plattform mehr existiert, muss der Spawn sauber ausfallen oder auf einen passenden bestehenden Plattformpfad umgelenkt werden.
      - Lifecycle-Status des neuen Bugs muss korrekt als neuer Welt-Bug registriert werden.
    verification_required:
      - Test fuer 50%-Chance bzw. deterministischen Hook.
      - Test dafuer, dass der Spawn-Hook nur fuer markierte Bonus-Euro-Pickups feuert.
      - Test dafuer, dass der erzeugte Bug mit Telegraph-/SpawnTimer-Zustand erzeugt wird.
      - Manueller Gameplay-Check, dass nach Einsammeln erst eine sichtbare Reaktionszeit besteht.
    completion_criteria:
      - Bonus-Euro erzeugt bei Erfolg einen angekuendigten Bug-Spawn wie in der Bugwelle.
      - Der Spawn ist waehrend der Telegraph-Phase noch nicht gefaehrlich.
      - Fehlende passende Spawnbedingungen verursachen keinen defekten Weltzustand.
    execution_notes:
      - `applyPickupEffect()` in `game-endless.js` reagiert jetzt auf Currency-Metadaten `spawnBugOnCollect`.
      - Bonus-Euro-Pickups koennen einen telegraphierten Plattform-Bug mit `createBug(..., { telegraph: true })` an der Pickup-Position entstehen lassen.
      - Fehlende tragfaehige Plattformen lassen den Bonus-Bugspawn sauber ausfallen.
    verification_performed:
      - `node tests/simulation-core.test.js`
    relevant_files:
      - game-endless.js
      - tests/simulation-core.test.js

  - execution_model: unknown-model
    priority: P2
    title: Document the Grossauftrag bonus-risk mechanic
    status: completed
    objective: >
      Event-Doku soll die neue 1-EUR-Variante samt Bug-Risiko korrekt
      beschreiben, damit Balancing und kuenftige Erweiterungen nachvollziehbar bleiben.
    planned_changes:
      - `docs/event-model.md` um die neue Grossauftrag-Variante ergaenzen.
      - Bei Bedarf kurze Erwaehnung in README nur dann, wenn sichtbares Feature-Verhalten fuer Spieler dort dokumentiert werden soll.
    dependencies_or_prerequisites:
      - Kernimplementierung abgeschlossen
    risks_or_edge_cases:
      - Doku driftet leicht, wenn genaue Prozentwerte im Code spaeter geaendert werden.
    verification_required:
      - Manuelle Sichtung auf Uebereinstimmung zwischen Doku und implementiertem Verhalten.
    completion_criteria:
      - Grossauftrag-Abschnitt beschreibt Bonus-Euro und Bug-Risiko zutreffend.
    execution_notes:
      - `docs/event-model.md` beschreibt jetzt die dichteren Euro-Spawns, die 30%-1-EUR-Variante und den 50%-Telegraph-Bug.
    verification_performed:
      - Manuelle Sichtung der aktualisierten Doku im Diff.
    relevant_files:
      - docs/event-model.md
      - README.md

risks_and_mitigations:
  - risk: Bonus-Euro-Bugs fuehlen sich unfair an, wenn sie sofort aktiv statt nur angekuendigt erscheinen.
    mitigation: Dieselbe Telegraph-/SpawnTimer-Logik wie bei Bugwellen-Bugs verpflichtend wiederverwenden und gezielt testen.
  - risk: Currency-Pickups werden als Sonderfall unlesbar, wenn Wert, Groesse und Nebeneffekte verstreut im Hauptspiel verdrahtet werden.
    mitigation: Pickup-Metadaten als gemeinsame Wahrheit verwenden und Event-Code nur fuer Spawn-Auswahl verantwortlich lassen.
  - risk: Grossauftrag fuehlt sich trotz Feature weiterhin schwach an, wenn normale Dichtebremsen die zusaetzlichen Euro-Spawns abwuergen.
    mitigation: Fuer sichtbare Grossauftrag-Extra-Spawns Income-/Dichtebremsen bewusst lockern und die resultierende Lesbarkeit manuell gegenpruefen.
  - risk: Tests bleiben flakey, wenn neue Wahrscheinlichkeiten nur ueber `Math.random()` laufen.
    mitigation: Entscheidungspfade in testbare Helfer kapseln oder vorhandene deterministische Zufallshooks verwenden.

test_strategy:
  automated:
    - `node tests/simulation-core.test.js`
    - Neue Node-Tests fuer Currency-Metadaten-Overrides, Grossauftrag-Bonuswahl und Bonus-Euro-Nebenwirkung.
  manual:
    - Grossauftrag ueber Debug `?debug=1&debugEvent=big-order` forcieren.
    - Sichtpruefung: groessere Euro-Symbole erscheinen nur im Grossauftrag.
    - Sichtpruefung: zusaetzliche Grossauftrag-Euro-Spawns wirken klar dichter als im Basisspiel und nicht durch normale Spawnbremsen ausgeduennt.
    - Gameplay-Pruefung: eingesammelter Bonus-Euro bringt 1 EUR und erzeugt nur gelegentlich einen telegraphierten Bug-Spawn mit sichtbarer Reaktionszeit.

documentation_follow_ups:
  - `docs/event-model.md` aktualisieren.
  - Optional Debug-Doku nur dann erweitern, wenn ein neuer Debug-Schalter fuer Bonus-Euro-Tests eingefuehrt wird.

blockers: []
