# Red Dune Dash – Full Code Review Backlog
Date: 2026-03-15

## Baseline Status

- `node tests/simulation-core.test.js` → **15/15 tests passed**
- `node tests/service-worker.test.js` → **2/2 tests passed**
- `node --check` on all JS files → **all clean** (no syntax errors)
- CI workflow: `ci.yml` runs tests on pull_request and workflow_dispatch
- Deploy workflow: `deploy-pages.yml` stamps version, runs tests, then deploys
- No open linting or type-check tools configured (no ESLint, no TypeScript)

---

## TODO – P1

### TODO-1: Add test for `hitsHazardWithPlayerCenter` – the primary hazard damage gate

**Priority:** P1
**File:** `systems/respawn-helpers.js`, `tests/simulation-core.test.js`

**Problem:**
`hitsHazardWithPlayerCenter` is the only function that decides whether a spike hazard
triggers a life loss. It checks vertical overlap and a 30-px center band on the player
against the hazard span. Despite being the most gameplay-critical collision gate in the
engine, it has zero test coverage. The existing respawn-helper tests cover
`getSafeCheckpointX` and `moveToSafeInjuredPose` but skip this function entirely.

The related `getHazardState` logic (hazard cycle: exposed → sinking → hidden → rising)
is also never exercised by any automated test. Both the cycle computation and the center-
band hit test are trivially testable via the injected `getHazardState` hook already on
`createRespawnHelpers`.

**Why it matters:**
A regression in the hit detection or hazard active-threshold would silently let players
walk through hazards or get killed by invisible ones. No test would catch it before ship.

**Concrete expectation:**
Add a dedicated test case in `tests/simulation-core.test.js`:
- Test that `hitsHazardWithPlayerCenter` returns `true` when player center band overlaps
  an active hazard vertically and horizontally.
- Test that it returns `false` when the hazard is inactive (active=false).
- Test that it returns `false` when the player is to the side of the hazard beyond the
  center band radius.
- Test at least one boundary: player just far enough right that center band misses hazard.

**Completion criteria:**
- New test case passes consistently.
- The test exercises the hit/miss/inactive paths without mocking internals beyond the
  `getHazardState` hook.

**Verification performed:** Confirmed no existing test calls `hitsHazardWithPlayerCenter`.
Confirmed the function is pure enough (uses only passed `hazard`, `player` ref, and the
injected `getHazardState`) to be tested without a browser.

**Remaining risk:** `getHazardState` itself (the cycle calculation) lives in
`game-endless.js` and depends on `worldTimeMs`. The tested version uses a stub. The real
cycle logic is still not unit-tested (see TODO-4 for possible follow-up).

---

## TODO – P2

### TODO-2: Normalize physics by delta time to prevent speed differences on high-refresh displays

**Priority:** P2
**File:** `game-endless.js` – `handleMovement`

**Problem:**
The movement simulation applies physics constants once per animation frame with no
delta-time normalization:

```javascript
player.vy += world.gravity;      // applied as-is per frame
player.x  += player.vx;
player.y  += player.vy;
bug.vy = Math.min(4.75, bug.vy + world.gravity * 0.21);
bug.y  += bug.vy;
bug.x  += bug.vx;
```

At 60 Hz the game runs as tuned. At 120 Hz `handleMovement` fires twice as often,
making gravity twice as strong, horizontal friction 1.82× stronger (0.82^2 per 60-Hz
step), jump height roughly half (~9 units instead of ~18), and bug patrol speed double.
Many modern mobile devices (iPhone Pro, Pixel, Galaxy S series) default to 90–120 Hz.

The timer-based systems (events, HUD effects, spawn telegraphs, invincibility, hurt
timers) already use delta-time correctly via millisecond budgets. Only raw physics
values are affected.

**Why it matters:**
The game is intended as a mobile-first PWA. The majority of its target audience is on
high-refresh phones. A player on a 120 Hz device experiences a fundamentally different
(faster, harder, shorter jumps) game than a player on 60 Hz. This also affects the
balance multipliers, since bugs move faster and collect faster relative to worldTimeMs.

**Concrete expectation:**
Introduce a per-frame time scale factor:

```javascript
const physicsScale = Math.min(delta / FRAME_DURATION_MS, 2);
```

Apply `physicsScale` to:
- `player.vy += world.gravity * physicsScale`
- `player.x  += player.vx  * physicsScale`
- `player.y  += player.vy  * physicsScale`
- Friction: `player.vx *= Math.pow(0.82, physicsScale)`
- Falling bug gravity and movement
- Walking bug patrol movement

The cap of 2 (matching the existing 100ms delta guard) prevents runaway physics during
tab-resume catch-up frames.

**Completion criteria:**
- On a simulated 120 Hz clock (delta = 8.33ms) the jump arc and fall speed are
  equivalent to the reference 60 Hz behaviour.
- All 15 gameplay tests still pass (tests do not call handleMovement directly).
- Manual smoke-test: jump height feels consistent when deliberately throttled to
  different frame rates.

**Verification performed:** Confirmed `FRAME_DURATION_MS = 1000 / 60` is defined and used
for timer conversions. Confirmed `handleMovement` does not use `delta` for any physics
step. Confirmed no existing test exercises handleMovement directly.

**Remaining risk:** The physics scale application needs careful order (scale vx before
capping it, etc.). Regression testing covers the logic but not the feel.

---

### TODO-3: Fix background stars and sand ridges disappearing on long runs

**Priority:** P2
**File:** `game-endless.js` – `drawBackground`

**Problem:**
Stars and sand-dune ridges are drawn at fixed positions inside the parallax-translated
context (parallax factor 0.18). Neither is dynamically repositioned when it scrolls off
screen:

```javascript
// Stars – 40 sprites at x = 120 + i*130, max x = 5190
for (let i = 0; i < 40; i += 1) { ... }

// Ridges – 14 shapes at x = i*300, max x = 3900
for (let i = 0; i < 14; i += 1) { ... }
```

The visible parallax window at camera position `cameraX` is
`[cameraX * 0.18, cameraX * 0.18 + 960]`. Once `cameraX * 0.18 > 5190`, none of
the 40 stars fall in that window. With a maxSpeed of 6.2 px/frame at 60 Hz, the
player can reach cameraX ≈ 23 500 in roughly 65 seconds of full-speed running.
The ridges disappear even sooner (max x = 3900 → cameraX ≈ 21 700).

The cloud system correctly handles this by tracking each cloud's parallax-space
position and resetting clouds to the right edge when they leave the viewport. Stars
and ridges have no equivalent.

**Why it matters:**
After one to three minutes of play the background becomes a plain gradient with no
visual interest. This is a visible regression in any competitive or long-session run.

**Concrete expectation:**
Replace the static loop-index position calculations for stars and ridges with
a tile-wrapping approach:

```javascript
// Tile-wrap a value V into the parallax viewport window.
// parallaxLeft = cameraX * CLOUD_PARALLAX
// period = total span of the star/ridge pattern
const offset = ((starX - parallaxLeft) % period + period) % period;
const canvasX = parallaxLeft + offset;
```

Alternatively, adopt the same "reset when off left edge" pattern used by clouds,
pre-computing a fixed set of star and ridge objects (position, radius/shape seed) and
repositioning them to the right edge when they scroll off the left.

For ridges, a simple approach: compute the ridge start from `parallaxLeft` modulo the
ridge-repeat width, so ridges tile continuously without ever running out.

**Completion criteria:**
- Stars are visible at all camera positions up to at least cameraX = 200 000.
- Ridges tile seamlessly and are never absent from the viewport.
- The visual appearance is indistinguishable from the current look in the first 60 sec.
- All 15 gameplay tests still pass.

**Verification performed:** Traced the star and ridge loops to confirm no
viewport-relative position calculation. Confirmed clouds use dynamic repositioning in
handleMovement and that the same pattern does not exist for stars/ridges.

**Remaining risk:** Tile-wrapping requires care to avoid visible seams or star-bunching
at the wrap point. Using the same cloud-pattern (per-object state + reset on exit) is
safer but heavier; a modulo tile is lighter but less flexible.

---

## TODO – P3

### TODO-4: Remove the empty `drawRotateOverlay` dead-code function

**Priority:** P3
**File:** `game-endless.js`

**Problem:**
`drawRotateOverlay` is a no-op with an explicit "handled via DOM/CSS" comment:

```javascript
function drawRotateOverlay() {
  // Portrait mode is now handled via DOM/CSS with a fullscreen image.
}
```

It is called from `render()` on every portrait-mode frame. The function does nothing,
its call is effectively also dead, and the comment embedded in it is redundant with the
`body.portrait-mode .rotate-screen` CSS rule and the `.rotate-screen` image in
`index.html`.

**Why it matters:**
Dead code misleads future readers into thinking portrait rendering has a canvas path
that requires maintenance.

**Concrete expectation:**
Remove both the `drawRotateOverlay` function definition and its call site in `render()`.
The `if (isPortraitMobileView()) { drawRotateOverlay(); return; }` block in `render()`
should become just `if (isPortraitMobileView()) { return; }`.

**Completion criteria:**
- Function removed.
- `render()` early-return for portrait mode retained but call-free.
- All tests still pass; syntax clean.

**Verification performed:** Confirmed `drawRotateOverlay` has no non-trivial body and is
called only once.

**Remaining risk:** None.

---

### TODO-5: Deduplicate the local `clamp` definition in `game-endless.js`

**Priority:** P3
**File:** `game-endless.js`, `systems/debug-tools.js`

**Problem:**
`clamp` is defined three times across the codebase:
1. As a local function in `game-endless.js`
2. As a local function in `systems/debug-tools.js`
3. Exported from `systems/simulation-core.js` as `simulationCore.clamp`

`game-endless.js` already holds a reference to `simulationCore` (for scoring and spawn
calculations). There is no reason for a separate local definition.

`debug-tools.js` is a standalone module and its own small private `clamp` is acceptable
since it has no dependency on `simulation-core`. No change needed there.

**Concrete expectation:**
Remove the local `clamp` function definition in `game-endless.js` and replace all its
call sites with `simulationCore.clamp(...)`, or introduce a local alias at the top:

```javascript
const clamp = simulationCore.clamp;
```

**Completion criteria:**
- Only one `clamp` definition in `game-endless.js` (the alias).
- No change in behavior. All tests pass; syntax clean.

**Verification performed:** Confirmed `simulationCore.clamp` and the local `clamp` are
identical implementations (`Math.max(min, Math.min(max, value))`). Confirmed
`simulationCore` is available at module scope before first use of `clamp`.

**Remaining risk:** None.

---

### TODO-6: Add a comment to `version.json` explaining the `"dev"` placeholder

**Priority:** P3
**File:** `version.json`, `README.md`

**Problem:**
`version.json` contains:
```json
{ "version": "dev" }
```

No comment (JSON does not support inline comments) and no note in proximity explain that
`"dev"` is a deployment placeholder stamped by the CI `deploy-pages.yml` workflow with
`${GITHUB_SHA::12}`. A future maintainer editing this file might not understand why the
version is `"dev"` or accidentally stamp a real value.

**Concrete expectation:**
Add a brief explanation to `README.md` (in the "PWA- und Offline-Betrieb" section) and/
or to the deploy workflow inline, noting:
- `version.json` intentionally contains the value `"dev"` in source control.
- The deploy pipeline stamps it with the commit SHA before uploading to Pages.
- Local development never shows update prompts because `APP_VERSION === "__APP_VERSION__"`
  triggers an early return in `checkForAppUpdate`.

**Completion criteria:**
- README contains a short note that `version.json` is a CI-stamped artifact.
- No functional change.

**Verification performed:** Confirmed the deploy script stamps both `version.json` and
`game-endless.js`. Confirmed `checkForAppUpdate` guards against `__APP_VERSION__`.

**Remaining risk:** None.

---

### TODO-7: Add `maskable` purpose to the 192×192 PWA icon

**Priority:** P3
**File:** `manifest.webmanifest`

**Problem:**
Only the 512×512 icon has `"purpose": "maskable"`. Android adaptive-icon launchers
prefer a 192×192 maskable icon for home screen shortcuts. Without it, some launchers
fall back to a white or system-default background behind the icon, which can look
inconsistent compared to the designed aesthetic.

Current manifest entry:
```json
{ "src": "icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" }
```

**Concrete expectation:**
Add a second entry for the 192×192 icon with `"purpose": "maskable"`, or change the
existing entry to `"purpose": "any maskable"` (the space-separated dual purpose form):

```json
{ "src": "icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" }
```

**Completion criteria:**
- manifest.webmanifest passes PWA validation with a maskable icon for 192×192.
- Service-worker test still passes (it checks app shell but not manifest content).

**Verification performed:** Confirmed current manifest has only one 192×192 entry with
`"purpose": "any"`. Confirmed 512×512 is already maskable.

**Remaining risk:** The underlying `icon-192x192.png` must be safe-zone-compliant
(artwork contained within the central 80% of the image) for maskable to render
correctly. This needs a visual check when the icon file is available.

---

### TODO-8: Simplify `isCoreAppRequest` – remove the dead query-string branch

**Priority:** P3
**File:** `service-worker.js`

**Problem:**
`isCoreAppRequest` has two conditions:

```javascript
return NETWORK_FIRST_PATHS.has(url.pathname) ||
       NETWORK_FIRST_PATHS.has(`${url.pathname}${url.search}`);
```

`NETWORK_FIRST_PATHS` contains only plain paths (`/`, `/index.html`, `/styles.css`, …),
none of which include a query string. The second condition therefore never evaluates to
`true` and is dead code.

**Concrete expectation:**
Remove the second condition:

```javascript
return NETWORK_FIRST_PATHS.has(url.pathname);
```

**Completion criteria:**
- Removed second condition.
- Service-worker test still passes.
- Behavior is identical for all currently handled paths.

**Verification performed:** Confirmed that every entry in `networkFirstPaths` in
`app-assets.js` is a pure pathname with no query string. Confirmed no test exercises
the query-string branch.

**Remaining risk:** If a future networkFirst path intentionally includes a query
string, this check would need restoring. Low probability for a static PWA.
