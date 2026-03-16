# Developer TODOs (Deutsch)

Stand: 2026-03-16
Bezug: Umsetzung der priorisierten Idee "Single advisory rule source" aus workflow-ideas.md.

## Was bereits umgesetzt ist

- Zentrale Advisory-Regelquelle inkl. Governance (advisory only)
- Deterministischer Matcher mit Merge + Dedupe
- Fallback-Regel fuer nicht gematchte Dateien
- Lokale CLI fuer Advisory-Ausgabe (Text und JSON)
- Tests fuer Validierung, Merge und Fallback
- Doku-Updates in README, CONTRIBUTING und docs/
- Nicht-blockierender CI-Hinweisstep angelegt

## Offene Developer-TODOs fuer spaeter

- [ ] CI auf echtem PR-Lauf pruefen
  - Ziel: Sicherstellen, dass der Advisory-Step in Pull Requests stabil laeuft.
  - Hinweis: Aktuell wird der Diff aus HEAD~1..HEAD gebildet; fuer PRs kann ein Merge-Base-Ansatz praeziser sein.

- [ ] CI-Ausgabe als Job Summary aufbereiten
  - Ziel: Advisory-Ergebnis in GitHub Actions gut lesbar machen (kurze Zusammenfassung statt nur Konsolenlog).

- [ ] Diff-Strategie fuer CI robust machen
  - Ziel: Basissha und Headsha aus PR-Kontext nutzen, um geaenderte Dateien verlässlich zu ermitteln.

- [ ] Regelabdeckung nach ersten PRs nachschaerfen
  - Ziel: False Positives reduzieren und fehlende Dateipfade nachziehen.
  - Trigger: Nach 5 bis 10 PRs mit Advisory-Step.

- [ ] Optional: Dead-Pattern-Check ergaenzen
  - Ziel: Erkennen, welche Match-Patterns in der Praxis nie greifen.
  - Hinweis: Unmatched-Helper ist bereits vorhanden, Dead-Pattern-Auswertung noch nicht.

## Abgleich mit workflow-ideas.md

Fokus war bewusst Idee 1 mit hoechster Prioritaet.

- Idee 1 (Single advisory rule source): weitgehend umgesetzt
- Teil von Idee 10 (CI nutzt Advisory-Quelle): begonnen (nicht-blockierender Step vorhanden)
- Idee 2+ und weitere spaetere Ideen: absichtlich nicht in diesem Schritt umgesetzt

## Wann diese Datei als erledigt gilt

- Wenn der Advisory-CI-Step mindestens einmal in einer echten PR erfolgreich beobachtet wurde
- und die Diff-Strategie fuer PR-Kontext sauber bestaetigt oder angepasst ist
- und die Rule-Abdeckung anhand erster PR-Erfahrungen nachgeschaerft wurde
