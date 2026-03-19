# Run Model

This document defines the current score, resource, and progression model of `Red Dune Dash`.

## Goal

The model intentionally separates:

- player state
- current-run resources
- current-run progression
- current-run bug state
- score as a synthesis of multiple systems

This separation is important so future features such as new gem families, bug backlog mechanics, bug reactivation, or event types like `refactoring` do not become special cases in player state.

## Current State Areas

### Player

`player` represents immediate character-run state only:

- position
- movement
- ground contact
- facing direction
- lives
- hurt and respawn state
- visibility

No longer part of `player`:

- coin currency
- action score
- progress score
- farthest reached distance

### Run State

`runState` represents economy and progression of the current run:

- `currencyCents`
- `actionScore`
- `progressScore`
- `farthestX`

Meaning:

- `currencyCents`: direct run currency
- `actionScore`: points from concrete actions like collecting gems, defeating bugs, or collecting rockets
- `progressScore`: stored progression points from distance and balance
- `farthestX`: maximum X position reached in the current run

## Score Model

Total score:

`totalScore = actionScore + progressScore`

### Action Score

Action score is granted directly by discrete actions:

- collect gem
- defeat bug
- collect rocket

These points are additive and persistent within the run.

### Progress Score

Progress score depends on:

- farthest distance reached in the run
- current balance factor

Key rule:

- progress score is monotonic

Meaning:

- later balance fluctuations must not reduce already earned progress points
- progression display should feel like true progression to players

Implementation consequence: the game stores `progressScore` and only syncs upward, instead of re-rendering a fully dynamic per-frame distance score.

## Resource Model

### Coin Currency

Coin currency is currently the direct economy resource for the run.

It currently influences:

- HUD display
- EUR-per-hour metric
- balance factor

Future-facing semantics:

- coin currency is not synonymous with "all gems"
- future pickup types may have other effects without redefining this resource

Examples of future separate resource channels:

- `currency`
- `backlog-revival`
- `score-boost`
- `event-trigger`

### Lives

Lives intentionally remain in `player` because they are immediate survival state, not economic run currency.

## Bug Model

Detailed bug status semantics are documented in [bug-lifecycle.md](./bug-lifecycle.md).
Lifecycle hooks for special events are documented in [event-model.md](./event-model.md).

Current run bug-ledger meanings:

- `spawnedInRun`
- `resolvedInRun`
- `openInRun`
- `activeInWorld`
- `missedInRun`
- `backlog`
- `reactivatedInRun`

Current behavior:

- `openInRun = activeInWorld + missedInRun + backlog + reactivatedInRun`
- `backlog` is normally `0` in regular gameplay, but can be prefilled or incremented in debug mode
- `reactivatedInRun` is usually `0`, but can increase via prepared debug or pickup paths

Important semantic decision:

- current HUD "Open Bugs" means unresolved bugs in the current run
- it does not yet represent a historical backlog across older runs

This is an intentional intermediate stage. A true backlog should later exist as a dedicated system, not reconstructed from world entities.

## Balance Factor

The balance factor currently combines:

- bug pressure
- income momentum

Balance currently affects:

- progress score
- spawn chances for income sources

Important semantics:

- balance is a modifier
- balance is not a standalone resource
- balance may make progression harder or more lucrative, but must not retroactively destroy already earned progress points

## Extension Points

### Backlog Gems

A pickup that revives old bugs should not respawn open world bugs directly. It should use a dedicated backlog system that tracks eligible bugs.

### Refactoring Events

A `refactoring` event is not a standard spawn event. It is closer to a high-risk mode with:

- higher risk
- low or zero direct income
- stronger impact on bug state
- potential bonus tied to progress points or bug cleanup

### Additional Resources

New pickup types should attach through the resource model without overloading player state or coin currency semantics.

## Invariants

While this model applies, these statements should remain true:

- `player` contains no economic or score-related run values
- `progressScore` never decreases
- `totalScore` never decreases
- HUD "Open Bugs" refers to the current run, not a future backlog
- backlog remains a dedicated system and is not derived from defeated or removed world entities
