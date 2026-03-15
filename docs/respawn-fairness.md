# Respawn Fairness

Dieses Dokument beschreibt die aktuellen Respawn-, Schadens- und Resume-Garantien von `Red Dune Dash`.

## Ziel

Ein Treffer soll spuerbar sein, aber moeglichst nicht in unfaire Todesketten oder Kontrollverlust muenden.

Das Spiel arbeitet deshalb mit mehreren Schutzebenen:

- sichere Checkpoints
- sichere Hurt-Posen
- kurze Unverwundbarkeit
- Countdown vor dem eigentlichen Respawn
- definierte Resume-Regeln nach Pausen oder App-Wechseln

## Checkpoint-Modell

Checkpoints sind keine frei gesetzten Marker, sondern abgeleitete sichere Spielerpositionen.

Aktuelle Regeln:

- Checkpoints werden nur auf `ground`-Plattformen aktualisiert
- der Spieler muss dafuer klar vor dem bisherigen Checkpoint liegen
- die Zielposition wird ueber `getSafeCheckpointX(...)` bestimmt
- Hazards auf derselben Lauf-Lane blockieren den Checkpoint-Bereich

Ziel:

- kein Respawn direkt auf einem Hazard
- kein hektisches Springen des Checkpoints bei kleinen Bewegungen

## Hurt-Posen statt Sofort-Respawn

Nicht jeder Schaden setzt den Spieler sofort zum Checkpoint zurueck.

Bei sichtbaren Trefferzustanden arbeitet das Spiel mit:

- `hurtTimer`
- `pendingRespawn`
- `forceInjuredPose`
- `respawnVisual`

Das ermoeglicht:

- ein klares Treffer-Feedback
- kurze Lesbarkeit des Fehlers
- danach einen kontrollierten Respawn statt eines harten Teleports im selben Moment

## Sichere Hurt-Position

Wenn der Treffer eine sichtbare Hurt-Pose verwenden soll, wird die Position nicht blind uebernommen.

Stattdessen gilt:

- `moveToSafeInjuredPose(...)` sucht zuerst tragenden Boden
- `getSafePlatformPoseX(...)` schneidet Hazards und lebende Bugs aus
- wenn keine sinnvolle Plattform gefunden wird, faellt das System auf den letzten Checkpoint zurueck

Wichtig:

- das Spiel versucht die Pose moeglichst nahe am Impact-Punkt zu halten
- Sicherheit ist dabei wichtiger als exakte optische Originalposition

## Schadensarten

### Sturz in den Krater

- kostet ein Leben
- nutzt die Aufmerksamkeitstafel statt einer eingefrorenen Bodenpose
- fuehrt nach dem Countdown zum Checkpoint zurueck

### Hazard-Treffer

- kostet ein Leben
- nutzt eine sichere Hurt-Pose
- vermeidet direkte Folge-Treffer auf derselben Laufspur

### Bug-Treffer

- kostet ein Leben
- nutzt ebenfalls eine sichere Hurt-Pose
- fallende Bugs und laufende Bugs teilen dieselbe Grundidee, auch wenn das Feedback leicht anders ist

### Bug-Stomp

- ist explizit kein Schaden
- loest den Bug
- gibt einen Bounce nach oben und Score

## Unverwundbarkeit und Respawn-Timing

Nach Schaden bekommt der Spieler temporaere Unverwundbarkeit:

- laenger bei sichtbarem Hurt-State
- kuerzer bei direktem Reset ohne volle Hurt-Phase

Zusaetzlich gilt:

- waehrend `hurtTimer > 0` pausiert die eigentliche aktive Bewegungssimulation
- der eigentliche Respawn auf den Checkpoint passiert erst nach Ablauf des Countdowns

Das verhindert, dass Spieler in derselben Sekunde mehrfach getroffen werden oder waehrend des Feedbacks schon wieder aktiv laufen muessen.

## Pause- und Resume-Fairness

Das Spiel unterscheidet bewusst mehrere Pausegruende:

- `manual`
- `portrait`
- `background`

Aktuelle Regeln:

- manuelle Pause darf direkt fortgesetzt werden
- Background-Resume bekommt einen Sicherheits-Countdown
- nach Rueckkehr aus Portrait in Landscape wird ebenfalls mit Countdown fortgesetzt
- waehrend Resume-Countdown oder Hurt-Countdown ist die aktive Simulation blockiert

Ziel:

- App-Wechsel oder Drehung sollen nicht zu unfairen Soforttreffern fuehren
- der Spieler bekommt nach dem Resume ein kleines Reaktionsfenster

## Erweiterungspunkte

Kuenftige Features wie `refactoring`, neue Backlog-Gefahren oder komplexere Boss-/Event-Phasen sollten dieselben Grundprinzipien respektieren:

- Trefferfeedback darf lesbar sein
- Respawns sollen aus sicheren Positionen kommen
- Resume-Situationen brauchen ein bewusstes Reaktionsfenster
- neue Fairness-Regeln sollten bevorzugt an Placement- oder Respawn-Helfer andocken statt direkt in allen Schadenszweigen dupliziert zu werden

## Invarianten

- Checkpoints bewegen sich nur vorwaerts auf sichere Ground-Positionen
- sichtbare Hurt-Posen landen nicht absichtlich in Hazards oder lebenden Bugs, wenn eine sichere Alternative existiert
- Countdown-Phasen blockieren aktive Bewegung und geben dem Spieler Reaktionszeit
- Background- und Portrait-Resume muessen spielerisch fairer behandelt werden als eine bewusste manuelle Pause
- Schadensfeedback und sichere Platzierung sind getrennte Anliegen: Optik darf variieren, Sicherheitslogik soll konsistent bleiben
