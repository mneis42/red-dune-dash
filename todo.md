# Curious Tiger: Red Dune Dash – Review TODO-Backlog

Stand: 2026-03-15

## Baseline: Checks und aktueller Zustand

- Build/Bundle: Kein Build- oder Bundle-Prozess; Spiel wird direkt aus den Quell-Dateien im Browser geladen (index.html, Vanilla-JS, Service Worker).
- Tests: Node-basierte Gameplay-/System-Tests vorhanden und lauffähig.
  - Befehl: `node tests/simulation-core.test.js`
  - Aktueller Status: Alle 9 Tests erfolgreich (Simulation Core, Bug-Lifecycle, Placement-System, Pickup-System, Debug-Tools, Special-Event-System).
- Linting/Formatting: Kein konfigurierter Linter oder Formatter im Repo ersichtlich.
- CI/CD: Keine Workflows für automatisierte Tests oder Builds vorhanden.
- PWA/Offline: Service Worker und Asset-Manifest sind konsistent verdrahtet; Verhalten ist manuell testbar, aber nicht automatisiert abgesichert.

---

## TODO 1 – CI für Gameplay-Systemtests etablieren

- **Priorität:** P1
- **Titel:** Node-Gamplay-Tests automatisiert in CI ausführen
- **Status:** Erledigt – CI-Workflow vorhanden und führt Tests aus
- **Problem:**
  - Die vorhandenen Gameplay-/System-Tests in tests/simulation-core.test.js laufen lokal sauber und sollen auch automatisiert bei Änderungen oder Pull Requests geprüft werden.
- **Umsetzung:**
  - Unter .github/workflows/ existiert bereits ci.yml, das Node 20 einrichtet, JavaScript-Dateien per `node --check` syntaktisch prüft und `node tests/simulation-core.test.js` als Gameplay-Testlauf ausführt.
- **Abschlusskriterien:**
  - CI-Pipeline existiert und läuft auf Pull Requests und manuellem Workflow-Dispatch.
  - Der bestehende Workflow scheitert, wenn tests/simulation-core.test.js fehlerhaft ist.
- **Verifikation:**
  - Lokale Ausführung von `node tests/simulation-core.test.js` erfolgreich.
  - Manuelle Prüfung von .github/workflows/ci.yml bestätigt, dass die Tests im CI ausgeführt werden.
- **Rest-Risiko / Follow-up:**
  - Später könnten zusätzliche Tests (z. B. UI-/Smoke-Tests) in dieselbe Pipeline integriert oder auf weitere Branch-Events (push) erweitert werden.

---

## TODO 2 – Weltgenerator- und Safe-Zone-Invarianten testbar absichern

- **Priorität:** P1
- **Titel:** Tests für Generator-Fairness und Chunk-Rollback ergänzen
- **Problem:**
  - Der Weltgenerator in game-endless.js (generateChunk, generateUntil, ensureStepPlatform, hasReachableApproach, commitChunkFeatureAttempt, restoreChunkFeatureSnapshot) implementiert wichtige Fairness-Regeln und ein Rollback-Modell für optionale Chunk-Features.
  - Diese Logik ist aktuell nicht durch dedizierte Tests abgesichert; nur die darunterliegenden Systeme (Placement, Simulation Core, Special Events, Pickups) sind getestet.
  - Fehler in der Snapshot-/Rollback-Logik könnten zu halbfertigen Plattform-/Hazard-Zuständen, unfairen Layouts oder inkonsistenten Bug-Lifecycle-States führen.
- **Warum das wichtig ist:**
  - Der Generator bestimmt Spielbarkeit und Fairness des Endlos-Runs.
  - Besonders Rollback (createChunkFeatureSnapshot/restoreChunkFeatureSnapshot/commitChunkFeatureAttempt) ist anfällig für stille Fehler.
- **Erwartete Umsetzung:**
  - Einen Node-kompatiblen Test-Einstieg für die Generatorfunktionen schaffen (z. B. separater Modul-Export oder kleines Harness, das level, player und abhängige Systeme initialisiert, ohne Canvas zu benötigen).
  - Tests schreiben, die u. a. folgende Fälle abdecken:
    - ensureStepPlatform fügt nur dann Hilfsplattformen hinzu, wenn nötig und möglich; scheitert ansonsten mit sauberem Rollback.
    - hasReachableApproach erkennt unerreichbare Bonus-/Plate-Plattformen und verwirft sie.
    - commitChunkFeatureAttempt stellt nach einem gescheiterten Feature-Versuch level.platforms, level.hazards, level.pickups, level.bugs und bugLifecycle.state konsistent wieder her.
    - generateChunk respektiert die dokumentierten Invarianten aus docs/generator-rules.md (einmalige Fortschreibung von level.nextChunkX/lastGroundY, optionale Inhalte dürfen fehlschlagen ohne die Welt zu „brechen“).
- **Abschlusskriterien:**
  - Mindestens ein Test-Suite-Bereich deckt Generator-/Rollback-Fälle ab und läuft unter Node ohne Browser.
  - Ein absichtlich eingebauter Fehler in der Snapshot-/Rollback-Logik wird von den neuen Tests zuverlässig erkannt.
- **Bisherige Verifikation:**
  - Nur manuelle Code-Inspektion und dokumentbasierte Prüfung (docs/generator-rules.md, docs/placement-rules.md).
- **Verifikation nach Fix:**
  - Neuer Testlauf (lokal und in CI) inkludiert Generator-Tests und bleibt grün.
  - Manuelles Spielen einzelner Runs zur Stichprobenkontrolle (keine offensichtlich unfairen Chunks, keine halbfertigen Features).
- **Rest-Risiko / Follow-up:**
  - Einige visuelle Layout-Probleme lassen sich nur im echten Canvas-Betrieb entdecken; mittelfristig könnten einfache visuelle Snapshot-/Replay-Tools ergänzt werden.

---

## TODO 3 – Checkpoint- und Hurt-Posen-Regeln explizit testen

- **Priorität:** P2
- **Titel:** Respawn-Fairness-Helfer in Tests abbilden
- **Problem:**
  - Zentrale Fairness-Logik für Checkpoints und Hurt-Posen liegt in game-endless.js:
    - getSafeCheckpointX, getSupportingPlatformAt, getSafePlatformPoseX, moveToSafeInjuredPose, hitsHazardWithPlayerCenter.
  - Diese Funktionen sind stark regelgetrieben (vgl. docs/respawn-fairness.md, docs/placement-rules.md), aber aktuell rein durch manuelles Spielen abgesichert.
  - Edge-Cases (kein tragender Boden unter dem Spieler, enge Plattformen mit Hazards und Bugs, tiefe Kraterbereiche) sind damit anfälliger für Regressionen.
- **Warum das wichtig ist:**
  - Respawn-Fairness ist spielentscheidend: falsche Safe-Zone-Berechnung kann zu Todes-Schleifen oder gefühltem Kontrollverlust führen.
  - Die Logik ist verhältnismäßig gut isolierbar und daher gut testbar.
- **Erwartete Umsetzung:**
  - Die genannten Helfer so kapseln, dass sie aus Node-Tests aufrufbar sind (z. B. mit einem dedizierten Modul oder einem Test-Harness, das level/platforms/hazards/bugs und player minimal simuliert).
  - Tests ergänzen, die u. a. prüfen:
    - getSafeCheckpointX setzt Checkpoints nicht auf Hazard-Spans der Player-Lane und respektiert Spielerbreite.
    - moveToSafeInjuredPose fällt korrekt auf den letzten Checkpoint zurück, wenn keine tragende Plattform vorhanden ist.
    - getSafePlatformPoseX schneidet Hazards und lebende Bugs auf der Lauf-Lane aus und findet eine nahegelegene Safe-Zone.
    - hitsHazardWithPlayerCenter berücksichtigt den zeitabhängigen Hazard-Zyklus (getHazardState) und trifft nur in der aktiven Spitzenphase.
- **Abschlusskriterien:**
  - Mindestens eine Testdatei deckt die wichtigsten Respawn-/Checkpoint-Szenarien ab.
  - Invarianten aus docs/respawn-fairness.md werden explizit in Tests gespiegelt.
- **Bisherige Verifikation:**
  - Nur statische Codeanalyse und Abgleich mit docs/respawn-fairness.md.
- **Verifikation nach Fix:**
  - Alle neuen Tests laufen lokal und in CI grün.
  - Stichprobenhafte manuelle Tests (z. B. Serientreffer durch Hazards/Bugs und Resume-Szenarien) bestätigen das erwartete Verhalten.
- **Rest-Risiko / Follow-up:**
  - Komplexere künftige Events (z. B. "refactoring") könnten zusätzliche Sonderfälle für Respawn erzeugen, die dann ebenfalls testseitig ergänzt werden sollten.

---

## TODO 4 – APP_VERSION-Handling und Versionierung für PWA-Updates klären

- **Priorität:** P2
- **Titel:** Version.json und APP_VERSION konsistent machen
- **Problem:**
  - In game-endless.js wird APP_VERSION auf den Platzhalter "__APP_VERSION__" gesetzt und in checkForAppUpdate mit version.json.version verglichen.
  - Im Repo liegt version.json aktuell mit dem Wert "dev"; ein automatischer Build-/Ersetzungsschritt für APP_VERSION ist im Projekt nicht dokumentiert oder konfiguriert.
  - Ohne klar definierten Build-Schritt kann die Update-Erkennung im installierten PWA-Setup dauerhaft in einem "Update verfügbar"-Zustand landen oder sich inkonsistent verhalten.
- **Warum das wichtig ist:**
  - Nutzer sollen im PWA-Betrieb verlässliche Hinweise auf neue Versionen erhalten, ohne false positives oder Update-Endlosschleifen.
  - Für Deployment-/Pipeline-Szenarien ist eine saubere Versionierung ein wichtiges Kontrollinstrument.
- **Erwartete Umsetzung:**
  - Einen klaren Mechanismus definieren, wie APP_VERSION für Deployments gesetzt wird (z. B. Build-Skript, das den Platzhalter durch die reale Version ersetzt, oder die Version aus version.json in game-endless.js injiziert).
  - Die Rolle von version.json in README oder entsprechender Doku dokumentieren (z. B. semantische Version, Build-Hash oder Branch-Bezeichner).
  - Sicherstellen, dass lokale Dev-Szenarien (direktes Öffnen von index.html) keine verwirrenden Update-Prompts erzeugen (z. B. spezielle Dev-Version oder Feature-Flag für Update-Check im Dev-Modus).
- **Abschlusskriterien:**
  - Klar dokumentierter Build-/Deployment-Prozess, der APP_VERSION und version.json synchron hält.
  - Installierte PWA-Instanz zeigt nur dann ein Update an, wenn tatsächlich eine neuere Revision bereitsteht.
- **Bisherige Verifikation:**
  - Nur statische Betrachtung des Codes in game-endless.js und der aktuellen version.json.
- **Verifikation nach Fix:**
  - Manuelle Tests mit installierter PWA (z. B. zwei Versionen nacheinander bereitstellen und prüfen, dass genau eine Update-Aufforderung erscheint).
  - Optional automatisierte Smoke-Tests im Deployment-Setup, die version.json und ggf. Build-Metadaten prüfen.
- **Rest-Risiko / Follow-up:**
  - Wenn später ein komplexerer Build-Prozess (z. B. Bundler) eingeführt wird, muss die Versionierungslogik entsprechend nachgezogen werden.

---

## TODO 5 – Service-Worker-Verhalten mit einfachen Smoke-Tests absichern

- **Priorität:** P3
- **Titel:** Offline-/Caching-Szenarien des Service Workers testen
- **Problem:**
  - Der Service Worker in service-worker.js nutzt ein Network-First-Verhalten für Kernpfade und Stale-While-Revalidate für übrige Assets, basierend auf dem zentralen Asset-Manifest aus app-assets.js.
  - Es existieren keine automatisierten Tests, die typische Offline-/Update-Szenarien (erste Installation, Asset-Update, Cache-Bereinigung) abdecken.
  - Fehler im Routing (z. B. falsche networkFirstPaths oder fehlende Assets im Offline-Cache) würden derzeit nur manuell auffallen.
- **Warum das wichtig ist:**
  - Das Spiel ist explizit als PWA mit Offline-Fähigkeit gedacht; Regressionen in diesem Bereich verschlechtern die Nutzererfahrung deutlich.
- **Erwartete Umsetzung:**
  - Einfache automatisierte Smoke-Tests aufsetzen, z. B. mit einem Headless-Browser oder Workbox-Testumgebung, die prüfen:
    - Kern-Routen (/, /index.html, /styles.css, /game-endless.js, Systems) werden network-first bedient und sind offline aus dem Cache verfügbar.
    - Alte Caches werden bei Cache-Name-Änderungen korrekt entfernt (Cache-Rotation).
    - Nicht-Core-Assets fallen korrekt in das Stale-While-Revalidate-Verhalten.
  - In der Doku festhalten, wie neue Assets über app-assets.js in den Cache gelangen sollen (ergänzend zu docs/asset-manifest.md).
- **Abschlusskriterien:**
  - Mindestens ein automatisierter Testdurchlauf stellt sicher, dass die primären Offline-Szenarien funktionieren.
  - Manuelle Tests (z. B. Browser offline schalten) bestätigen das erwartete Verhalten nach einem frischen Load.
- **Bisherige Verifikation:**
  - Nur statische Code- und Doku-Analyse (docs/asset-manifest.md, service-worker.js, app-assets.js).
- **Verifikation nach Fix:**
  - Neuer Testjob (lokal/CI) simuliert mindestens einen Offline-Load und bestätigt, dass index.html und Kernskripte aus dem Cache kommen.
- **Rest-Risiko / Follow-up:**
  - Browser-spezifische Besonderheiten oder künftige PWA-Änderungen könnten weitere Anpassungen erfordern; die Tests sollten so einfach wie möglich, aber robust gegen Implementation-Details sein.

---

## TODO 6 – Doku und README um Tests, Debug-Tools und PWA-Nutzung ergänzen

- **Priorität:** P3
- **Titel:** Entwickler- und Spieler-Doku vervollständigen
- **Problem:**
  - Die fachlichen Docs in docs/ sind sehr gut ausgebaut (Architecture, Run Model, Bug Lifecycle, Events, Placement, Generator, Simulation Core, Debug Tools, Asset Manifest), aber README.md ist relativ knapp.
  - Einige wichtige Aspekte sind für neue Beitragende oder Tester nicht auf Anhieb ersichtlich:
    - Wie man die vorhandenen Node-Tests ausführt.
    - Wie die Debug-Tools im Alltag sinnvoll genutzt werden (Kombination aus Query-Parametern und Hotkeys).
    - Welche Besonderheiten beim lokalen PWA-/Service-Worker-Test gelten (z. B. lokaler HTTP-Server nötig, Update-Verhalten).
- **Warum das wichtig ist:**
  - Gute Entwickler-Doku senkt die Einstiegshürde für neue Beiträge und erleichtert Balancing-/Content-Iterationen.
  - Eine kurze Spieler-orientierte PWA-Erklärung erhöht die Chance, dass Features wie Install-CTA und Update-Prompt richtig verstanden werden.
- **Erwartete Umsetzung:**
  - README.md um kurze, praxisnahe Abschnitte ergänzen:
    - "Tests ausführen" (inkl. `node tests/simulation-core.test.js`).
    - "Debug-Mode" mit Verweis auf docs/debug-tools.md und Beispiel-URLs.
    - Kurzer Hinweis auf PWA-/Offline-Betrieb und den empfohlenen Weg für lokale Tests (z. B. lokaler HTTP-Server).
  - Ggf. aus docs/debug-tools.md eine sehr kompakte Entwickler-Checkliste destillieren und im README verlinken.
- **Abschlusskriterien:**
  - README.md beantwortet die häufigsten Einstiegsfragen (Start, Tests, Debug, PWA) ohne tiefe Doc-Recherche.
  - Neue Teammitglieder können anhand von README + Doc-Verweisen typische Aufgaben (Balancing-Test, Bugfix in Simulation Core) eigenständig starten.
- **Bisherige Verifikation:**
  - Manuelle Sichtung von README.md und den Dateien unter docs/.
- **Verifikation nach Fix:**
  - Kurzer Usability-Check: Eine Person ohne Projektkontext kann mit README + Docs in <15 Minuten lokales Spiel, Tests und einen einfachen Debug-Run starten.
- **Rest-Risiko / Follow-up:**
  - Langfristig könnte eine CONTRIBUTING.md oder ein kurzes "How to add a new system"-Dokument zusätzlichen Mehrwert bringen.

---

## TODO 7 – Kleine Code-/Doku-Politur und Konsistenz

- **Priorität:** P3
- **Titel:** Kleinere JSDoc- und Konsistenzkorrekturen einpflegen
- **Problem:**
  - Insgesamt ist der Code sehr gut strukturiert und dokumentiert, es gibt aber einzelne kleine Unebenheiten, z. B.:
    - Einzelne JSDoc-Kommentare mit leichten Inkonsistenzen (z. B. doppelte oder veraltete Parameterbeschreibung bei addPickupOnPlatform in game-endless.js).
    - Kleinere Namens-/Formulierungsunterschiede zwischen Code und Dokumentation, die bei späteren Erweiterungen zu Verwirrung führen können.
- **Warum das wichtig ist:**
  - Saubere, konsistente Doku reduziert kognitive Last bei der Arbeit an komplexen Systemen wie Events, Placement und Respawn-Fairness.
- **Erwartete Umsetzung:**
  - JSDoc-Kommentare und Beschreibungen mit dem aktuellen Funktions-Signaturstand abgleichen und korrigieren.
  - Auffällige kleinere Inkonsistenzen zwischen Code und Docs (beschriebene aber nicht mehr existierende Parameter o. ä.) glätten.
- **Abschlusskriterien:**
  - JSDoc-Generierung (falls verwendet) läuft ohne Warnungen zu offensichtlichen Parametern.
  - Ein kurzer manueller Scan der zentralen System-Dateien zeigt konsistente, aktuelle Kommentare.
- **Bisherige Verifikation:**
  - Manuelle Stichproben in game-endless.js und den Systemdateien unter systems/.
- **Verifikation nach Fix:**
  - Erneute Stichprobenprüfung der geänderten Kommentare.
- **Rest-Risiko / Follow-up:**
  - Bei größeren Refactorings (z. B. Auslagerung eines Rendering-/Input-Systems) muss die Doku konsequent mitgezogen werden.
