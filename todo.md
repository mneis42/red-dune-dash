# Full Code Review Backlog (2026-03-15)

## Verifizierungsbasis vor Umsetzung

- `node tests/simulation-core.test.js`: erfolgreich (`All 15 gameplay system tests passed.`)
- `node tests/service-worker.test.js`: aktuell erfolgreich, aber Test-Harness ist asynchron unsauber (siehe P0)
- Syntax-Checks wie in CI (`node --check` auf Root-/`systems`-Dateien): keine offensichtlichen Syntaxfehler festgestellt
- Pipeline-Status im Repo: keine direkte Laufhistorie in diesem Review sichtbar; Bewertung basiert auf Workflow-Definitionen in `.github/workflows/`

## TODOs

### P0 - Service-Worker-Tests sind asynchron nicht verlässlich
- Status
  Erledigt am 2026-03-15.
- Problem
  Die Test-Hilfsfunktion führt `async` Tests nicht korrekt aus, weil Promises nicht `await`-ed werden. Dadurch können Fehler in asynchronen Pfaden unentdeckt bleiben oder als unhandled rejection außerhalb der eigentlichen Testauswertung auftreten.
- Warum wichtig
  Das betrifft direkt die Aussagekraft der SW-Tests. Ein grüner Lauf kann falsch positiv sein.
- Erwartete Korrektur
  Test-Runner in `tests/service-worker.test.js` auf Promise-aware Ausführung umbauen (`await fn()` bzw. zentrale async-Schleife), inklusive korrekter Exit-Code-Setzung bei Rejection.
- Abnahmekriterien
  - Asynchrone und synchrone Tests werden konsistent ausgewertet.
  - Ein absichtlich fehlschlagender async-Test führt reproduzierbar zu `process.exitCode = 1`.
  - Normaler Lauf bleibt grün.
- Verifizierung durchgeführt
  Promise-aware Runner in `tests/service-worker.test.js` umgesetzt und lokal geprüft:
  - `node tests/service-worker.test.js` (beide SW-Smoke-Tests grün)
  - `node tests/simulation-core.test.js` (15/15 grün)
- Rest-Risiko / Follow-up
  Ein dedizierter Meta-Test fuer absichtlich rejectende Async-Tests ist weiterhin optionaler Hardening-Schritt.
- Relevante Stellen
  `tests/service-worker.test.js` Zeilen mit `function test(name, fn)`, `fn();` und async-Testdefinition.

### P1 - CI testet Service Worker nicht
- Status
  Erledigt am 2026-03-15.
- Problem
  Beide Workflows führen nur `tests/simulation-core.test.js` aus, nicht aber `tests/service-worker.test.js`.
- Warum wichtig
  Änderungen am SW können unbemerkt regressieren, obwohl CI grün bleibt.
- Erwartete Korrektur
  In `.github/workflows/ci.yml` und `.github/workflows/deploy-pages.yml` SW-Tests als eigenen Schritt ergänzen.
- Abnahmekriterien
  - CI- und Deploy-Testjob brechen bei SW-Testfehlern ab.
  - Gameplay- und SW-Tests laufen in beiden Workflows.
- Verifizierung durchgeführt
  Workflows erweitert und lokal mit den gleichen Befehlen geprüft:
  - `node tests/simulation-core.test.js` (15/15 grün)
  - `node tests/service-worker.test.js` (SW-Smoke-Tests grün)
- Rest-Risiko / Follow-up
  Optional zusätzlich Matrix für mehrere Node-Versionen erwägen.
- Relevante Stellen
  `.github/workflows/ci.yml` und `.github/workflows/deploy-pages.yml` bei „Run gameplay tests“.

### P1 - Cache-Versionierung im Deploy-Workflow ist inkonsistent zur SW-Implementierung
- Status
  Erledigt am 2026-03-15.
- Problem
  Der Deploy-Step versucht `const CACHE_NAME = "..."` in `dist/service-worker.js` per `sed` zu ersetzen. Die reale SW-Zeile nutzt aber `globalThis.RED_DUNE_ASSET_MANIFEST?.cacheName ?? ...`, und das Manifest setzt weiterhin statisch `cacheName: "red-dune-dash-v3"`.
- Warum wichtig
  Die intendierte versionsbasierte Cache-Rotation greift damit nicht zuverlässig; Update-/Offline-Verhalten wird schwerer vorhersagbar.
- Erwartete Korrektur
  Einheitliche Versionierungsstrategie festlegen und durchziehen:
  - entweder Manifest-`cacheName` im Build stempeln und SW daraus lesen,
  - oder Manifest-Wert entfernen und SW-konstante Version direkt stempeln.
- Abnahmekriterien
  - Build-Artefakte enthalten konsistent denselben versionierten Cache-Namen.
  - Neue Deployments erzeugen nachvollziehbar neue Cache-Namespaces.
  - SW-Updatepfad ist dokumentiert und reproduzierbar testbar.
- Verifizierung durchgeführt
  Deploy-Workflow umgestellt: Build stempelt jetzt den Manifest-Wert in `dist/app-assets.js` statt eines toten SW-Patterns.
  Lokal geprüft:
  - Workflow enthält `Stamp app and cache versions` und ersetzt `cacheName` in `dist/app-assets.js`.
  - `node --check app-assets.js`, `node --check service-worker.js`, `node --check game-endless.js` ohne Fehler.
- Rest-Risiko / Follow-up
  Nach Umstellung sollte ein E2E-Check (online -> update -> offline) dokumentiert werden.
- Relevante Stellen
  `.github/workflows/deploy-pages.yml`, `service-worker.js`, `app-assets.js`.

### P2 - Dokumentationsdrift im Run-Modell (Backlog-Formel)
- Problem
  `docs/run-model.md` beschreibt `openInRun = spawnedInRun - resolvedInRun` und `backlog = 0`. Die Implementierung zählt aber explizit `backlog` und `reactivated` in offene Bugs mit hinein, und Debug kann Backlog direkt vorbefüllen.
- Warum wichtig
  Doku widerspricht aktueller Spielrealität; das erschwert künftige Erweiterungen und Reviewbarkeit.
- Erwartete Korrektur
  Dokumentation auf aktuellen Stand bringen (einschließlich Debug-Auswirkungen auf Bug-Ledger).
- Abnahmekriterien
  - `docs/run-model.md` stimmt mit `getBugLedger()` und Debug-Pfaden überein.
  - Begriffe „openInRun“, „backlog“, „reactivated“ sind konsistent über Doku-Dateien.
- Verifizierung durchgeführt
  `docs/run-model.md` gegen `game-endless.js` verglichen.
- Rest-Risiko / Follow-up
  Optional Cross-Links zwischen `run-model.md`, `bug-lifecycle.md` und `debug-tools.md` schärfen.
- Relevante Stellen
  `docs/run-model.md`, `game-endless.js`.

### P3 - Drittanbieter-Actions sind nur auf Major-Tags gepinnt
- Problem
  Workflows verwenden `@v3/@v4` statt Commit-SHA-Pinning.
- Warum wichtig
  Erhöht Supply-Chain-Risiko bei Upstream-Änderungen.
- Erwartete Korrektur
  Kritische Actions auf verifizierte SHAs pinnen und Update-Prozess dokumentieren.
- Abnahmekriterien
  - Alle externen Actions in CI/Deploy auf SHA gepinnt.
  - Dokumentierter Prozess für regelmäßige Pin-Updates vorhanden.
- Verifizierung durchgeführt
  Workflow-Dateien geprüft (`actions/checkout`, `actions/setup-node`, `actions/upload-pages-artifact`, `actions/deploy-pages`).
- Rest-Risiko / Follow-up
  SHA-Pinning reduziert, aber eliminiert Supply-Chain-Risiken nicht vollständig.
- Relevante Stellen
  `.github/workflows/ci.yml`, `.github/workflows/deploy-pages.yml`.
