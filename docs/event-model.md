# Event Model

This document describes the current special-event system in `Red Dune Dash` and planned extension points for future event types such as `refactoring`.

## Goal

Events should no longer exist as scattered special cases across scheduler, generator, HUD, and spawn code. Instead, each event type should have a shared definition with explicit responsibilities.

This defines:

- when an event is announced
- how long warning and active phases last
- which runtime state the event needs across phases
- which gameplay effects are active
- which UI messages are shown
- how the event ends cleanly

## Current Structure

The runtime model currently has two layers:

### Global Event State

`specialEventState` stores only the shared lifecycle state:

- `type`
- `phase`
- `timer`
- `runtime`

Meaning:

- `type`: current event type or `null`
- `phase`: `idle`, `announce`, or `active`
- `timer`: remaining time in current phase
- `runtime`: phase-specific mutable state for the active event

### Event Definitions

`SPECIAL_EVENT_DEFINITIONS` describes per-event behavioral differences.

Each definition currently uses shared hook categories:

- `title`
- `announcementTitle`
- `announcementPrompt`
- `activeStatusMessage`
- `completionStatusMessage`
- `createRuntime(phase)`
- `updateActive(delta, state)`

Optionally, a definition may provide specialized rule sections, for example:

- `chunkGeneration`
- `rocketSpawnMultiplier`
- `rocketSpawnPhases`
- scheduler hook for weighted event selection
- future success/failure hooks or reward profiles

## Current Event Types

### `bug-wave`

Bug wave is a pressure event:

- accelerates rockets in warning and active phases
- spawns falling and running bugs during active phase
- uses dedicated runtime spawn timers
- can, with 50% chance per spawn, reactivate a historically unresolved bug instead of creating a fully new one
- may reuse lifecycle entries from `missed`, `backlog`, and `reactivated`
- does not show reactivated bugs separately in UI, but preserves lifecycle identity internally

### `big-order`

Big order is an income event:

- increases chunk decoration for coin and bug content
- spawns additional visible coin sources during active phase
- may relax conservative placement density for additional EUR spawns so event impact is visible
- allows a larger 1-EUR variant with 30% chance for additional visible EUR spawns
- collecting a 1-EUR bonus may, with 50% chance, create a telegraphed bug on the same platform
- carries dedicated spawn timers in runtime state

## Shared Lifecycle

Scheduler lifecycle is shared for all events:

1. `idle`
2. random wait timer runs down
3. `announce`
4. event-specific warning message is shown
5. `active`
6. event-specific `updateActive` logic runs
7. completion message
8. return to `idle`

Additional rules for current live events:

- production wait time between events is currently between 2 and 5 minutes
- type selection is no longer strictly uniform
- when many open bugs exist (`active-world`, `missed`, `backlog`, `reactivated`), `bug-wave` receives higher selection weight than `big-order`
- debug overrides for delay or event type still take priority

Important behavior:

- phase transitions always reinitialize `runtime`
- UI consumes one shared event view model
- generator and spawn systems query shared event helpers instead of type-specific special-case branches

## Extension Points For Future Events

A future `refactoring` event should fit the same structure, for example with:

- dedicated `title` and `announcementTitle`
- dedicated `activeDuration`
- dedicated `runtime` for heavier platform or timing phases
- bug-lifecycle effect hooks
- reward profile that favors progression over direct currency

New event effects should prefer shared integration points:

- chunk generation
- spawn multipliers
- bug lifecycle actions
- score and progression modifiers
- HUD and status text output

Avoid reintroducing event logic through scattered `if (eventType === ...)` branches in core orchestration.

## Invariants

While this model applies, these statements should remain true:

- phase transitions always go through shared helpers
- event-specific runtime state lives only in `specialEventState.runtime`
- UI, generator, and spawn systems read event effects through shared access points
- new events must not extend behavior by copying full lifecycle blocks
- event types may differ in rules, but should share one lifecycle contract
