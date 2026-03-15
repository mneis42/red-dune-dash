planning_model: unknown-model
bug_title: Big Order Spawns Too Many Bugs After Bonus-Euro Change
bug_summary: >
  Seit der Einfuehrung grosser Bonus-Euro-Symbole mit optionalem Bug-Spawn
  fuehlt sich der Grossauftrag zu buglastig an. Die aeltere Regel, dass waehrend
  des Grossauftrags zusaetzlich mehr Bugs gespawnt werden, ist dadurch
  ueberfluessig geworden und soll entfernt werden.
current_status: implemented-awaiting-archive

reproduction_status:
  status: plausible-and-code-confirmed
  notes:
    - Der Spielerbericht ist mit der aktuellen Balancing-Konfiguration plausibel.
    - Im Code erzeugt `big-order` weiterhin zusaetzliche Bugs ueber Chunk-Regeln und sichtbare Event-Spawns.

reproduction_steps:
  - Starte einen Debug-Run mit `?debug=1&debugEvent=big-order`.
  - Spiele einige Sekunden in der aktiven Grossauftrag-Phase.
  - Sammle bei Bedarf Bonus-Euro-Symbole ein.
  - Beobachte, dass neben dem neuen Bonus-Euro-Risiko weiterhin die alte Event-Regel zusaetzliche Bugs erzeugt.

expected_behavior:
  - Grossauftrag soll sich weiterhin als Ertrags-Event anfuehlen.
  - Das zusaetzliche Risiko soll jetzt primaer durch Bonus-Euro-Pickups mit moeglichem telegraphierten Bug-Spawn entstehen.
  - Die alte pauschale Regel "im Grossauftrag spawnen auch mehr Bugs" soll entfallen.

actual_behavior:
  - Grossauftrag erhoeht weiterhin Bug-Dichte ueber mehrere Event-Pfade.
  - Dadurch kumulieren alter Event-Druck und neues Bonus-Euro-Risiko.
  - Das Event kippt spielerisch zu stark Richtung Bug-Druck statt klar erhoehter Einnahmen.

severity_and_player_impact:
  severity: P1
  impact: >
    Stark spuerbare Balancing-Inkonsistenz in einem zentralen Live-Event. Kein
    Crash oder State-Corruption, aber klar falsches Spielgefuehl und reduzierte
    Lesbarkeit des Grossauftrags als Income-Event.

assumptions_and_unresolved_questions:
  assumptions:
    - Mit "alte Regel" ist gemeint, dass Grossauftrag keine zusaetzlichen Event-Bugs mehr erzeugen soll.
    - Das neue Risiko ueber Bonus-Euro-Einsammeln bleibt erhalten.
    - Normale, globale Bug-Spawn-Mechaniken ausserhalb des Grossauftrags bleiben unveraendert.
  unresolved_questions:
    - Sollen auch die chunk-basierten Grossauftrag-Bug-Chancen (`groundBugChance`, `plateBugChance`, `bonusBugChance`) komplett auf das Baseline-Niveau zurueck oder nur die sichtbaren Event-Bugspawns entfallen? Empfehlung: beide Grossauftrag-spezifischen Zusatz-Bugpfade entfernen.

gameplay_consistency_assessment:
  verdict: bug-confirmed
  assessment: >
    Die aktuelle Kombination widerspricht der klaren Rollenverteilung der Events.
    Bugwelle ist das Druck-Event. Grossauftrag soll das Income-Event sein.
    Seit Bonus-Euro plus optionalem Bugspawn existiert bereits ein passender
    Risikohebel innerhalb des Income-Events, sodass die alte pauschale
    Zusatz-Bugregel nicht mehr noetig ist.

root_cause_hypothesis:
  confirmed_causes:
    - `specialEventConfig.bigOrder` enthaelt weiterhin erhoehte Bug-Chancen fuer Chunk-Generierung.
    - `systems/special-event-system.js` laesst `big-order` waehrend der Aktivphase weiter sichtbare Bugs ueber `spawnBigOrderBug()` erzeugen.
    - Die Status-/Eventbeschreibung nennt Grossauftrag weiterhin explizit als Event mit mehr Moneten und mehr Bugs.

architecture_and_codebase_impact:
  affected_systems:
    - game-endless.js
    - systems/special-event-system.js
    - tests/simulation-core.test.js
    - docs/event-model.md
  assessment: >
    Der sauberste Fix ist nicht ein neuer Sonderfall, sondern das Ruecknehmen der
    nun ueberholten Grossauftrag-Bugverstaerkung in Konfiguration, Event-Update,
    Tests und Doku. Das haelt Event-Rollen klar und reduziert Balancing-Doppelung.

verification_baseline_before_implementation:
  current_automated_checks:
    - `node tests/simulation-core.test.js`
  current_relevant_coverage:
    - Special-Event-Tests pruefen derzeit noch sichtbare Grossauftrag-Bugspawns.
  missing_coverage_for_bug:
    - Kein Regressionstest, dass Grossauftrag keine zusaetzlichen Event-Bugs mehr erzeugt.

implementation_verification:
  completed_checks:
    - `node tests/simulation-core.test.js` erfolgreich nach dem Balancing-Fix.
  manual_checks_not_run:
    - Kein manueller Browser-Check in dieser Session.

prioritized_fix_plan:
  - execution_model: unknown-model
    priority: P1
    title: Remove big-order-specific extra bug spawning
    status: completed
    objective: >
      Alle Grossauftrag-spezifischen Zusatz-Bugpfade entfernen, damit das Event
      nicht mehr parallel zum Bonus-Euro-Risiko noch alten Bugdruck aufbaut.
    planned_changes:
      - In `systems/special-event-system.js` die sichtbaren Grossauftrag-Bugspawns aus `updateActive()` entfernen.
      - In `game-endless.js` die Grossauftrag-Bugkonfiguration auf neutrales Verhalten zurueckziehen.
      - Nicht mehr benoetigte Hooks oder Konfigurationswerte nur dann entfernen, wenn das ohne Streuverlust moeglich ist.
    dependencies_or_prerequisites:
      - Keine
    bug_risk_edge_cases_or_regression_concerns:
      - Der Fix darf Bugwelle oder globale Basisspawns nicht beeinflussen.
      - Grossauftrag muss weiterhin genug sichtbare Aktivitaet ueber zusaetzliche Euro-Spawns behalten.
    verification_required:
      - `node tests/simulation-core.test.js`
      - Regressionstest, dass Grossauftrag weiterhin Gems, aber keine zusaetzlichen Event-Bugs spawnt.
    completion_criteria:
      - Grossauftrag erzeugt keine zusaetzlichen bugspezifischen Event-Spawns mehr.
      - Bonus-Euro-Bugrisiko bleibt erhalten.
    execution_notes:
      - `systems/special-event-system.js` spawnt im Grossauftrag jetzt nur noch sichtbare Euro-Symbole.
      - Die Grossauftrag-Statusmeldung wurde von "Mehr Moneten und mehr Bugs unterwegs" auf "Mehr Moneten unterwegs" angepasst.
      - In `game-endless.js` wurden die grossauftragsspezifischen Bug-Konfigurationswerte fuer Chunk- und sichtbare Event-Bugs entfernt.
      - Das Bonus-Euro-Risiko beim Einsammeln blieb unveraendert erhalten.
    verification_performed:
      - `node tests/simulation-core.test.js`
    relevant_files:
      - systems/special-event-system.js
      - game-endless.js
      - tests/simulation-core.test.js

  - execution_model: unknown-model
    priority: P2
    title: Align status text and documentation with the new event role
    status: completed
    objective: >
      Die Event-Texte und Doku sollen wieder klar sagen, dass Grossauftrag vor
      allem mehr Einnahmen bringt und sein Risiko aus Bonus-Euro-Spawns kommt.
    planned_changes:
      - Statusmeldung fuer aktiven Grossauftrag anpassen.
      - `docs/event-model.md` auf den neuen Balancing-Stand bringen.
    dependencies_or_prerequisites:
      - Kernfix abgeschlossen
    bug_risk_edge_cases_or_regression_concerns:
      - Doku und Laufzeittext duerfen nicht auseinanderlaufen.
    verification_required:
      - Manuelle Sichtung der geaenderten Texte.
    completion_criteria:
      - Keine irrefuehrende Aussage "mehr Bugs unterwegs" mehr im Grossauftrag.
    execution_notes:
      - Tests und Event-Doku sprechen jetzt nur noch von zusaetzlichen sichtbaren Euro-Spawns.
      - `docs/event-model.md` beschreibt den Grossauftrag wieder als Income-Event mit Risiko ueber Bonus-Euro statt ueber pauschale Zusatz-Bugs.
    verification_performed:
      - `node tests/simulation-core.test.js`
      - Manuelle Sichtung der geaenderten Texte im Diff.
    relevant_files:
      - systems/special-event-system.js
      - docs/event-model.md

risks_and_mitigations:
  - risk: Nur einen von mehreren Grossauftrag-Bugpfaden zu entfernen und dadurch Restdruck zu uebersehen.
    mitigation: Sichtbare Event-Bugs und chunk-spezifische Grossauftrag-Bugwerte gemeinsam pruefen und gezielt reduzieren.
  - risk: Das Event wirkt danach leer.
    mitigation: Die bereits erhoehte Euro-Dichte und Bonus-Euro-Variante als klares Hauptelement beibehalten.

regression_test_strategy:
  automated:
    - `node tests/simulation-core.test.js`
    - Special-Event-Regressionstest fuer "Grossauftrag spawnt Gems, aber keine Event-Bugs"
  manual:
    - Debug-Run mit `?debug=1&debugEvent=big-order`
    - Sichtcheck, dass Grossauftrag weiterhin deutlich mehr Euro-Symbole, aber nicht mehr die alte Bugflut erzeugt

documentation_follow_ups:
  - `docs/event-model.md` aktualisieren.

blockers:
  - Kein technischer Blocker.
