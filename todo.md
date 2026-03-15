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
- **Status:** Erledigt – Generator-Helfer extrahiert und durch Node-Tests abgesichert
- **Problem:**
  - Der Weltgenerator in game-endless.js (generateChunk, generateUntil, ensureStepPlatform, hasReachableApproach, commitChunkFeatureAttempt, restoreChunkFeatureSnapshot) implementiert wichtige Fairness-Regeln und ein Rollback-Modell für optionale Chunk-Features.
  - Diese Logik war zunächst nicht durch dedizierte Tests abgesichert; nur die darunterliegenden Systeme (Placement, Simulation Core, Special Events, Pickups) waren getestet.
- **Umsetzung:**
  - Ein neues, browserfreies Hilfsmodul systems/generator-helpers.js eingeführt, das zentrale Generator-Helfer (removeHazardsUnderSpan, createChunkFeatureSnapshot, restoreChunkFeatureSnapshot, commitChunkFeatureAttempt, ensureStepPlatform, hasReachableApproach, platformCollides, isTooCloseToGround) kapselt.
  - game-endless.js so angepasst, dass die bisherigen lokalen Helferfunktionen diese gemeinsame Implementierung verwenden, statt eigene Logik zu duplizieren.
  - Die neue Hilfs-Implementierung in index.html und app-assets.js eingebunden, sodass sie sowohl im Spiel als auch im Service Worker/App-Shell-Manifest konsistent verfügbar ist.
  - In tests/simulation-core.test.js neue Tests ergänzt, die u. a. folgende Fälle abdecken:
    - commitChunkFeatureAttempt rollt Änderungen an level.platforms, level.hazards, level.pickups, level.bugs und bugLifecycle.state bei fehlgeschlagenen Features sauber zurück.
    - Erfolgreiche Feature-Versuche werden committed und behalten ihre Änderungen.
    - ensureStepPlatform fügt bei zu hohen Plattformen eine Hilfsplattform ein, dekoriert sie mit Pickups/Bugs über injizierte Callbacks und erlaubt einen plausiblen Zugang (hasReachableApproach).
    - platformCollides, removeHazardsUnderSpan und isTooCloseToGround verhalten sich konsistent mit den beschriebenen Fairness-Regeln (docs/generator-rules.md).
- **Abschlusskriterien:**
  - Generator-Helfer sind in einem separaten Modul gekapselt und werden in game-endless.js ausschließlich über generatorHelpers genutzt.
  - tests/simulation-core.test.js enthält mehrere Szenarien für Rollback, Hilfsplattformen und Hazard-/Clearance-Helfer.
  - Ein absichtlich eingebauter Fehler in createChunkFeatureSnapshot/restoreChunkFeatureSnapshot/commitChunkFeatureAttempt oder den Clearance-Helfern würde die neuen Tests brechen.
- **Verifikation:**
  - Lokaler Testlauf `node tests/simulation-core.test.js` mit nun 13 Tests erfolgreich (inklusive der neuen Generator-Tests).
  - CI-Workflow .github/workflows/ci.yml führt denselben Testlauf aus und würde bei Regressionsfehlern im Generator fehlschlagen.
- **Rest-Risiko / Follow-up:**
  - generateChunk/generateUntil selbst sind weiterhin nur indirekt abgesichert; für künftige Arbeiten könnten zusätzliche, höherstufige Generator-Szenarien (z. B. Sequenzen von Chunks mit verschiedenen Events/Debug-Konfigurationen) in eigenen Tests modelliert werden.

---

## TODO 3 – Checkpoint- und Hurt-Posen-Regeln explizit testen

- **Priorität:** P2
- **Titel:** Respawn-Fairness-Helfer in Tests abbilden
- **Status:** Erledigt – Respawn-Helfer extrahiert und durch Node-Tests abgedeckt
- **Problem:**
  - Zentrale Fairness-Logik für Checkpoints und Hurt-Posen lag bislang direkt in game-endless.js:
    - getSafeCheckpointX, getSupportingPlatformAt, getSafePlatformPoseX, moveToSafeInjuredPose, hitsHazardWithPlayerCenter.
  - Diese Funktionen waren nur durch manuelles Spielen abgesichert, obwohl sie stark regelgetrieben und gut testbar sind (vgl. docs/respawn-fairness.md, docs/placement-rules.md).
- **Umsetzung:**
  - Ein neues, browserfreies Modul systems/respawn-helpers.js eingeführt, das die genannten Helfer als createRespawnHelpers({ level, player, placementSystem, placementSafetyConfig, getHazardState }) kapselt.
  - game-endless.js so angepasst, dass hitsHazardWithPlayerCenter, getSafeCheckpointX, getSupportingPlatformAt, getSafePlatformPoseX und moveToSafeInjuredPose ausschliesslich ueber respawnHelpers laufen.
  - respawn-helpers.js in index.html und app-assets.js eingebunden, damit es Teil der App-Shell und offline verfügbar ist.
  - In tests/simulation-core.test.js zwei neue Tests ergänzt:
    - "respawn helpers choose safe checkpoint positions away from hazards" prüft, dass Checkpoints innerhalb der Plattform und nicht direkt im unmittelbaren Hazard-Umfeld landen.
    - "respawn helpers snap hurt poses to supporting platforms or checkpoint" prüft, dass verletzte Posen auf tragende Plattformen geschnappt werden und bei fehlendem Untergrund sauber auf den Checkpoint zurückfallen.
- **Abschlusskriterien:**
  - Die wichtigsten Respawn-/Checkpoint-Szenarien sind in Node-Tests modelliert und lauffähig.
  - Ein absichtlich eingebauter Fehler in den Respawn-Helfern (z. B. ignorierte Bugs/Hazards oder fehlender Checkpoint-Fallback) würde die neuen Tests brechen.
- **Verifikation:**
  - Lokaler Testlauf `node tests/simulation-core.test.js` (insgesamt 15 Tests) erfolgreich, inkl. der neuen Respawn-Helfer-Tests.
  - CI-Workflow .github/workflows/ci.yml führt denselben Testlauf aus und würde bei Regressionen im Respawn-Verhalten fehlschlagen.
- **Rest-Risiko / Follow-up:**
  - Komplexere künftige Events (z. B. "refactoring") könnten zusätzliche Sonderfälle für Respawn erzeugen; diese sollten bei Bedarf in weiteren Tests in Anlehnung an docs/respawn-fairness.md ergänzt werden.

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
