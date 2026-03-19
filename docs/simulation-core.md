# Simulation Core

This document describes the current testable simulation core of `Red Dune Dash`.

## Goal

Core gameplay rules should be testable without browser APIs, canvas rendering, or global page side effects. For that purpose, a browser-free simulation core exists in `systems/simulation-core.js`.

## Current Scope

The simulation core currently encapsulates key run and balance rules:

- EUR-per-hour calculation
- bug and income balance multipliers
- combined run balance factor
- distance and balance based progress target
- monotonic progress locking
- score breakdown
- income spawn multiplier
- deterministic spawn decisions with injectable randomness
- deterministic random helpers for tests

## Why This Matters

These rules are central to gameplay correctness and are common regression points after balancing changes, new event effects, or new resource types.

## Randomness And Time

The core does not depend on hard-coded `Math.random()` calls or real-time clocks:

- time is provided as explicit input, such as `worldTimeMs`
- spawn decisions accept an injectable `randomValue`
- tests can use deterministic helpers like `createSeededRandom()` and `createSequenceRandom()`

The event system follows the same idea: additional spawn decisions can inject `randomChance`.

## Tests

Current test entry point:

- `tests/simulation-core.test.js`

Run it with:

```powershell
node tests/simulation-core.test.js
```

Current coverage includes:

- score and progress rules
- deterministic random helpers
- income spawn rules
- bug lifecycle logic
- placement logic
- deterministically driven event flow

## Extension Points

Good next candidates for additional pure-core logic:

- generator-adjacent decision rules
- pickup effects
- refactoring and backlog effects
- additional event reward and failure rules

## Invariants

- core rules should prefer pure-function modeling
- randomness and time inputs should remain controllable in tests
- new balancing rules should be testable in the simulation core before browser-only rollout
