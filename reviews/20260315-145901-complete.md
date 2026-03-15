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
- **Status:** Erledigt – Version wird im Deploy-Workflow gestempelt, Dev-Builds skippen Update-Checks
- **Problem:**
  - In game-endless.js war APP_VERSION ursprünglich auf den Platzhalter "__APP_VERSION__" gesetzt und wurde in checkForAppUpdate mit version.json.version verglichen.
  - Ohne klaren Stempelmechanismus bzw. Dev-Sonderfall konnte dies zu verwirrenden Update-Hinweisen führen.
- **Umsetzung:**
  - Im Deploy-Workflow .github/workflows/deploy-pages.yml existiert bereits ein Schritt "Stamp service worker cache version", der version.json und APP_VERSION in dist/game-endless.js mittels des aktuellen GITHUB_SHA-Präfixes konsistent setzt; dieser Mechanismus bleibt die Quelle der Wahrheit für Deployments.
  - In game-endless.js wurde checkForAppUpdate so erweitert, dass lokale/Dev-Builds mit unverändertem Platzhalter (APP_VERSION === "__APP_VERSION__") den Versions-Check überspringen und damit keine PWA-Update-Prompts auslösen.
- **Abschlusskriterien:**
  - Deployte Builds erhalten weiterhin konsistente Versionen in version.json und APP_VERSION über den bestehenden Stempel-Schritt.
  - Lokale Dev-Szenarien (direktes Öffnen von index.html im Arbeitsbaum) führen keinen Versions-Check mehr aus und zeigen damit keine irreführenden Update-Hinweise.
- **Verifikation:**
  - Statische Prüfung von .github/workflows/deploy-pages.yml bestätigt, dass version.json und dist/game-endless.js gemeinsam gestempelt werden.
  - Lokale Ausführung von `node tests/simulation-core.test.js` bestätigt, dass die Änderung an checkForAppUpdate keine Gameplay-Tests beeinflusst.
- **Rest-Risiko / Follow-up:**
  - Für eine vollständig dokumentierte Versionierungs-Story kann README.md später (im Rahmen von TODO 6) um einen kurzen Abschnitt erweitert werden, der die Rolle von version.json und des SHA-basierten Stempelns beschreibt.

---

## TODO 5 – Service-Worker-Verhalten mit einfachen Smoke-Tests absichern

- **Priorität:** P3
- **Titel:** Offline-/Caching-Szenarien des Service Workers testen
- **Status:** Erledigt – Basis-Smoketests für Service-Worker-Precache und Fetch-Routing ergänzt
- **Problem:**
  - Der Service Worker in service-worker.js nutzt ein Network-First-Verhalten für Kernpfade und Stale-While-Revalidate für übrige Assets, basierend auf dem zentralen Asset-Manifest aus app-assets.js.
  - Bisher gab es keine automatisierten Tests, die zentrale Install-/Fetch-Szenarien abdecken.
- **Umsetzung:**
  - Eine neue Testdatei tests/service-worker.test.js hinzugefügt, die einen minimalen Service-Worker-ähnlichen Global-Kontext (self, caches, fetch) simuliert und app-assets.js sowie service-worker.js importiert.
  - Ein Test "service worker precaches all app shell assets" prüft, dass der install-Listener alle in RED_DUNE_ASSET_MANIFEST.appShellAssets hinterlegten Pfade in den initialen Cache schreibt.
  - Ein Test "service worker exposes fetch listener for same-origin GET requests" stellt sicher, dass der fetch-Listener nur für gleiche Origin und GET/Navigate-Anfragen ein Routing registriert und andere Methoden/Herkünfte ignoriert.
- **Abschlusskriterien:**
  - Die wichtigsten Precache- und Fetch-Routing-Szenarien sind durch leichte Smoke-Tests abgedeckt.
  - Ein absichtlich eingebauter Fehler beim Precache (z. B. Asset aus appShellAssets entfernen) würde den neuen Test brechen.
- **Verifikation:**
  - Lokale Ausführung von `node tests/service-worker.test.js` erfolgreich.
  - Die bestehende CI (ci.yml) kann bei Bedarf um diesen Test erweitert werden; aktuell bleibt der Fokus in CI auf den Gameplay-Tests, die Service-Worker-Tests sind als ergänzende lokale Sicherheitsschicht verfügbar.
- **Rest-Risiko / Follow-up:**
  - Browser-spezifische PWA-Details und echte Offline-Verhalten sollten weiterhin manuell stichprobenartig geprüft werden; bei wachsender Komplexität kann der Test-Harness um weitere Szenarien (Cache-Rotation, offline-Fetch) erweitert werden.

---

## TODO 6 – Doku und README um Tests, Debug-Tools und PWA-Nutzung ergänzen

- **Priorität:** P3
- **Titel:** Entwickler- und Spieler-Doku vervollständigen
- **Status:** Erledigt – README um Tests, Debug-Mode und PWA-Hinweise ergänzt
- **Problem:**
  - README.md war im Vergleich zu den detaillierten Fach-Dokumenten in docs/ relativ knapp, insbesondere zu Tests, Debug-Tools und PWA-Nutzung.
- **Umsetzung:**
  - README.md um eine erweiterte Projektstruktur ergänzt (Verweise auf systems/, app-assets.js, service-worker.js, tests/).
  - Einen Abschnitt "Tests ausführen" ergänzt, der die Node-Kommandos für Gameplay-/System-Tests (`node tests/simulation-core.test.js`) und Service-Worker-Smoketests (`node tests/service-worker.test.js`) zeigt.
  - Einen Abschnitt "Debug-Mode" ergänzt, der typische Query-Parameter-Beispiele und den Verweis auf docs/debug-tools.md enthält.
  - Einen Abschnitt "PWA- und Offline-Betrieb" ergänzt, der lokale Testempfehlungen (lokaler HTTP-Server), die Rolle von app-assets.js und den GitHub-Pages-Deploy-Workflow für Versionierung und Offline-Assets kurz beschreibt.
- **Abschlusskriterien:**
  - README.md beantwortet jetzt die wichtigsten Einstiegsfragen zu Start, Tests, Debug-Mode und PWA-Verhalten direkt.
- **Verifikation:**
  - Manuelle Sichtung von README.md und Abgleich mit docs/debug-tools.md und docs/asset-manifest.md.
- **Rest-Risiko / Follow-up:**
  - Bei größeren Architekturerweiterungen könnte ergänzend eine CONTRIBUTING.md sinnvoll werden, die Beitragende durch typische Change-Flows führt.

---

## TODO 7 – Kleine Code-/Doku-Politur und Konsistenz

- **Priorität:** P3
- **Titel:** Kleinere JSDoc- und Konsistenzkorrekturen einpflegen
- **Status:** Erledigt – kleinere JSDoc-Korrekturen vorgenommen
- **Problem:**
  - Einige Kommentare waren leicht inkonsistent zur tatsächlichen Signatur (z. B. addPickupOnPlatform in game-endless.js).
- **Umsetzung:**
  - Die JSDoc-Beschreibung von addPickupOnPlatform in game-endless.js korrigiert, sodass Parameterliste und Beschreibung wieder mit der Implementierung übereinstimmen.
- **Abschlusskriterien:**
  - Die betroffenen Kommentare sind konsistent mit der Signatur; offensichtliche Dubletten wurden entfernt.
- **Verifikation:**
  - Manuelle Sichtung der angepassten JSDoc-Blöcke.
- **Rest-Risiko / Follow-up:**
  - Bei weiteren Refactorings sollten Kommentare jeweils mit angepasst werden; ein optionaler späterer Lint-Schritt (z. B. JSDoc-Linter) könnte dies automatisieren.
