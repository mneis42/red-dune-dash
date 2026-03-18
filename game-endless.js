const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
const APP_VERSION = "__APP_VERSION__";
// Runtime-only UI state for touch input, HUD effects and short-lived overlays.
const activeTouchControls = new Map();
const activeDirectionalInputs = new Map();
const hudEffects = [];
let jumpButtonGlow = 0;
let activeHudInfo = null;
let statusMessage = "Bereit für den Start";
let orientationLocked = false;
let resumeCountdownTimer = 0;
let wasPortraitMode = false;
let deferredInstallPrompt = null;
let showInstallHelp = false;
let installButtonRect = null;
let updateButtonRect = null;
let directionalInputSequence = 0;
let updateReady = false;
let isRefreshingForUpdate = false;
let debugPanelVisible = false;
const CLOUD_PARALLAX = 0.18;
const CLOUD_RESPAWN_MIN_GAP = 140;
const CLOUD_RESPAWN_MAX_GAP = 260;
const GEM_VALUE_CENTS = 10;
const FRAME_DURATION_MS = 1000 / 60;
const JUMP_BUTTON_GLOW_DURATION_MS = Math.round(8 * FRAME_DURATION_MS);
// Maximum number of consecutive jumps the tiger can perform before landing.
// Set to 2 to allow exactly one double-jump per airborne sequence.
const MAX_JUMPS = 2;
const INVINCIBILITY_BLINK_INTERVAL_MS = Math.round(5 * FRAME_DURATION_MS);
const scoreConfig = {
  gemPickup: 30,
  bugDefeat: 120,
  rocketPickup: 200,
  distanceDivisor: 12,
};
const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    checkForAppUpdate();

    // Register once and proactively re-check for updates when the app comes back into focus.
    navigator.serviceWorker.register("./service-worker.js").then((registration) => {
      registration.update().catch(() => {
        // Ignore update check failures.
      });

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update().catch(() => {
            // Ignore update check failures.
          });
          checkForAppUpdate();
        }
      });
    }).catch(() => {
      // Ignore registration failures in unsupported/local preview environments.
    });
  });
} else {
  window.addEventListener("load", () => {
    checkForAppUpdate();
  });
}

/**
 * Syncs DOM classes that switch between the normal game view and the portrait helper screen.
 */
function syncCanvasOnlyMode() {
  const portraitMode = isPortraitMobileView();
  document.body.classList.add("canvas-only");
  document.body.classList.toggle("portrait-mode", portraitMode);
  if (portraitMode && gameState === "playing") {
    pauseGame("portrait");
  }
  // Give players a short reaction window after rotating back into landscape mid-run.
  if (wasPortraitMode && !portraitMode && gameState === "paused" && pauseReason === "portrait") {
    resumeGame(true);
  }
  wasPortraitMode = portraitMode;
}

/**
 * Returns whether the mobile install CTA should be shown.
 *
 * @returns {boolean} True when the app runs on touch devices outside standalone mode.
 */
function shouldShowInstallPrompt() {
  return isTouchDevice && !isStandalone;
}

/**
 * Returns whether the in-app update prompt should be shown for the installed mobile PWA.
 *
 * @returns {boolean} True when a refreshed app version is ready to be loaded.
 */
function shouldShowUpdatePrompt() {
  return isTouchDevice && isStandalone && updateReady;
}

/**
 * Loads the latest deployed app version descriptor and marks an update when it differs from the running build.
 *
 * @returns {Promise<void>} Resolves when the version check finishes.
 */
async function checkForAppUpdate() {
  if (APP_VERSION === "__APP_VERSION__") {
    return;
  }

  try {
    const response = await fetch("./version.json", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const payload = await response.json();
    const version = typeof payload?.version === "string" ? payload.version.trim() : "";
    if (!version) {
      return;
    }

    if (version !== APP_VERSION) {
      updateReady = true;
    }
  } catch {
    // Ignore version check failures when offline or during local previews.
  }
}

/**
 * Reloads the app so the newest service-worker-controlled assets become visible immediately.
 */
function refreshForUpdate() {
  if (isRefreshingForUpdate) {
    return;
  }

  isRefreshingForUpdate = true;
  updateReady = false;
  resetDirectionalInputState();
  window.location.reload();
}

/**
 * Detects iOS Safari-like environments that need manual "Add to Home Screen" instructions.
 *
 * @returns {boolean} True when the current device matches the iOS fallback path.
 */
function isIosInstallFallback() {
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  showInstallHelp = false;
  installButtonRect = null;
});

const mobileHud = {
  // HUD coordinates are authored against the fixed 960x540 canvas space.
  topBar: { x: 0, y: 0, w: 960, h: 44 },
  leftPad: { cx: 94, cy: 462, r: 58 },
  rightPad: { cx: 232, cy: 462, r: 58 },
  jumpPad: { cx: 850, cy: 450, r: 72 },
};

const STORAGE_KEY = "marsTigerHighscore";
const spriteSources = globalThis.RED_DUNE_ASSET_MANIFEST?.spriteSources ?? {
  run: ["assets/run1.png", "assets/run2.png", "assets/run3.png", "assets/run4.png", "assets/run5.png", "assets/run6.png"],
  standing: "assets/standing.png",
  injured: "assets/injured.png",
  attentionPlease: "assets/attention-please.png",
  rotate: "assets/rotate.jpg",
  jumpUp: "assets/jump-up.png",
  jumpDown: "assets/jump-down.png",
  bug: "assets/bug.png",
  gameOver: "assets/game-over.png",
  rocketFromLeft: "assets/rocket-from-left.png",
  rocketFromRight: "assets/rocket-from-right.png",
};

const sprites = {
  run: spriteSources.run.map((src) => {
    const image = new Image();
    image.src = src;
    return image;
  }),
  standing: new Image(),
  injured: new Image(),
  attentionPlease: new Image(),
  rotate: new Image(),
  jumpUp: new Image(),
  jumpDown: new Image(),
  bug: new Image(),
  gameOver: new Image(),
  rocketFromLeft: new Image(),
  rocketFromRight: new Image(),
};

sprites.standing.src = spriteSources.standing;
sprites.injured.src = spriteSources.injured;
sprites.attentionPlease.src = spriteSources.attentionPlease;
sprites.rotate.src = spriteSources.rotate;
sprites.jumpUp.src = spriteSources.jumpUp;
sprites.jumpDown.src = spriteSources.jumpDown;
sprites.bug.src = spriteSources.bug;
sprites.gameOver.src = spriteSources.gameOver;
sprites.rocketFromLeft.src = spriteSources.rocketFromLeft;
sprites.rocketFromRight.src = spriteSources.rocketFromRight;

const world = {
  gravity: 0.68,
  floorYMin: 414,
  floorYMax: 474,
};

const hazardCycleConfig = {
  exposedDuration: 2200,
  sinkingDuration: 700,
  hiddenDuration: 1400,
  risingDuration: 650,
  activeExposureThreshold: 0.55,
};
const specialEventConfig = {
  minDelay: 120_000,
  maxDelay: 300_000,
  announceDuration: 10_000,
  activeDuration: 30_000,
  bugWaveRocketSpawnMultiplier: 2,
  bugWaveMaxFalling: 7,
  bugWaveGroundSpawnIntervalMin: 1_000,
  bugWaveGroundSpawnIntervalMax: 5_000,
  spawnTelegraphDuration: 1_000,
  bigOrder: {
    groundGemChance: 1,
    plateGemChance: 1,
    plateExtraGemChance: 0.9,
    bonusPlatformChance: 0.44,
    bonusExtraGemChance: 1,
    visibleExtraGemChance: 0.75,
    visibleGemSpawnIntervalMin: 450,
    visibleGemSpawnIntervalMax: 900,
    baseCurrencyCents: GEM_VALUE_CENTS,
    bonusEuroChance: 0.3,
    bonusCurrencyCents: 100,
    bonusRenderScale: 2,
    bonusBugSpawnChance: 0.5,
  },
};

const placementSystem = globalThis.RedDunePlacement.createPlacementSystem();
const placementSafetyConfig = placementSystem.config;
const simulationCore = globalThis.RedDuneSimulationCore;
const debugTools = globalThis.RedDuneDebugTools;
const debugConfig = debugTools.createDebugConfig(window.location.search);
const debugSpecialEventDelayMs = debugConfig.specialEvent.delayMs;
const debugSpecialEventType = debugConfig.specialEvent.forceType;
const { PICKUP_TYPE } = globalThis.RedDunePickups;
const pickupDefinitions = globalThis.RedDunePickups.createPickupDefinitions({
  gemValueCents: GEM_VALUE_CENTS,
  scoreConfig,
  spawnTelegraphDuration: specialEventConfig.spawnTelegraphDuration,
});
const pickupSystem = globalThis.RedDunePickups.createPickupSystem(pickupDefinitions);
debugPanelVisible = debugConfig.showPanel;

const keys = {
  left: false,
  right: false,
};

const level = globalThis.RedDuneGameState.createLevelState();
const player = globalThis.RedDuneGameState.createPlayerState(level.spawn);
const runState = globalThis.RedDuneGameState.createRunState(level.spawn.x);
const { BUG_STATUS } = globalThis.RedDuneBugLifecycle;
const bugLifecycleSystem = globalThis.RedDuneBugLifecycle.createBugLifecycleSystem();
const bugLifecycle = bugLifecycleSystem.state;

const respawnHelpers = globalThis.RedDuneRespawnHelpers.createRespawnHelpers({
  level,
  player,
  placementSystem,
  placementSafetyConfig,
  getHazardState,
});

let highScore = loadHighScore();
let cameraX = 0;
let gameState = "ready";
let pauseReason = null;
let lastTime = 0;
let worldTimeMs = 0;
let runFrameIndex = 0;
let runFrameTimer = 0;
let rocketSpawnTimer = 0;

/**
 * Loads the locally stored high score.
 *
 * @returns {number} The persisted high score or 0 when nothing valid was stored.
 */
function loadHighScore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
  } catch {
    return 0;
  }
}

/**
 * Persists a new high score if it exceeds the existing one.
 *
 * @param {number} score - Candidate score to store.
 */
function saveHighScore(score) {
  if (debugConfig.enabled) {
    return;
  }

  highScore = Math.max(highScore, score);
  try {
    window.localStorage.setItem(STORAGE_KEY, String(highScore));
  } catch {
    // Ignore localStorage failures.
  }
}

/**
 * Returns a random floating-point number within an inclusive min/exclusive max range.
 *
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @returns {number} Random number between min and max.
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Returns a random integer within an inclusive range.
 *
 * @param {number} min - Lower bound.
 * @param {number} max - Upper bound.
 * @returns {number} Random integer between min and max.
 */
function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

/**
 * Converts a legacy frame-based duration into milliseconds using the historical 60 FPS baseline.
 *
 * @param {number} frames - Duration measured in 60 FPS frames.
 * @returns {number} Equivalent duration in milliseconds.
 */
function framesToMs(frames) {
  return Math.round(frames * FRAME_DURATION_MS);
}

const clamp = simulationCore.clamp;

/**
 * Linearly interpolates between two values.
 *
 * @param {number} start - Start value.
 * @param {number} end - End value.
 * @param {number} alpha - Blend factor from 0 to 1.
 * @returns {number} Interpolated value.
 */
function lerp(start, end, alpha) {
  return start + (end - start) * alpha;
}

const generatorHelpers = globalThis.RedDuneGeneratorHelpers.createGeneratorHelpers({
  level,
  bugLifecycleSystem,
  player,
  randomInt,
  randomBetween,
  clamp,
  createPlatform,
  addGemOnPlatform,
  addBugOnPlatform,
});

/**
 * Returns whether the current run is allowed to persist competitive progress.
 *
 * @returns {boolean} True when high scores may be saved.
 */
function canPersistHighScore() {
  return !debugConfig.enabled;
}

const { SPECIAL_EVENT_PHASE, pickBigOrderCurrencyVariant } = globalThis.RedDuneSpecialEvents;

function pickWeightedSpecialEventType(eventTypes) {
  const openBugCount = getOutstandingBugTotal();
  return globalThis.RedDuneSpecialEvents.pickWeightedEventType(
    eventTypes,
    (type) => {
      if (type === "bug-wave") {
        return 1 + Math.min(3, openBugCount * 0.25);
      }

      return 1;
    },
    Math.random()
  );
}

const specialEventDefinitions = globalThis.RedDuneSpecialEvents.createSpecialEventDefinitions(
  specialEventConfig,
  {
    randomInt,
    randomChance: () => Math.random(),
    lerp,
    clamp,
    getFallingBugCount,
    spawnBugWaveBug,
    spawnBugWaveGroundBug,
    spawnBigOrderGem,
  }
);
const specialEventSystem = globalThis.RedDuneSpecialEvents.createSpecialEventSystem({
  config: specialEventConfig,
  definitions: specialEventDefinitions,
  randomInt,
  debugDelayMs: debugSpecialEventDelayMs,
  debugType: debugSpecialEventType,
  pickType({ eventTypes }) {
    return pickWeightedSpecialEventType(eventTypes);
  },
  onStatusMessage: (message) => {
    statusMessage = message;
  },
});
const specialEventState = specialEventSystem.state;

/**
 * Returns the localized display title for a special event.
 *
 * @param {string|null} type - Event type id.
 * @param {boolean} [forAnnouncement=false] - Whether the title is used for the warning phase.
 * @returns {string} Event title.
 */
function getSpecialEventTitle(type, forAnnouncement = false) {
  return specialEventSystem.getTitle(type, forAnnouncement);
}

/**
 * Returns the UI snapshot for the current special event.
 *
 * @returns {{type:string, phase:string, timer:number, title:string, announcementTitle:string, announcementPrompt:string}|null} Event UI model or null when idle.
 */
function getCurrentSpecialEventInfo() {
  return specialEventSystem.getInfo();
}

/**
 * Returns the chunk-generation overrides contributed by the currently active event.
 *
 * @returns {{groundGemChance:number,groundBugChance:number,plateGemChance:number,plateExtraGemChance:number,plateBugChance:number,bonusPlatformChance:number,bonusExtraGemChance:number,bonusBugChance:number}} Effective chunk-generation rules.
 */
function getChunkGenerationRules() {
  return specialEventSystem.getChunkGenerationRules();
}

/**
 * Returns the rocket-spawn multiplier contributed by the current event and phase.
 *
 * @returns {number} Multiplier where 1 means no event-specific change.
 */
function getSpecialEventRocketSpawnMultiplier() {
  return specialEventSystem.getRocketSpawnMultiplier();
}

/**
 * Returns whether a special event is currently active.
 *
 * @param {string} type - Event type id to compare.
 * @returns {boolean} True when the requested event is currently active.
 */
function isSpecialEventActive(type) {
  return specialEventSystem.isActive(type);
}

/**
 * Schedules the next special event after a random cool-down window.
 */
function scheduleNextSpecialEvent() {
  specialEventSystem.scheduleNext();
}

/**
 * Resets the special-event scheduler to a fresh run.
 */
function resetSpecialEventState() {
  specialEventSystem.reset();
}

/**
 * Starts the announcement phase of a new special event.
 */
function startSpecialEventAnnouncement() {
  specialEventSystem.startAnnouncement();
}

/**
 * Activates the currently announced special event.
 */
function activateSpecialEvent() {
  specialEventSystem.activate();
}

/**
 * Completes the currently active special event and schedules the next cooldown.
 */
function completeSpecialEvent() {
  specialEventSystem.complete();
}

/**
 * Returns whether debug tooling is enabled for this browser session.
 *
 * @returns {boolean} True when debug overrides or the debug panel are active.
 */
function isDebugModeEnabled() {
  return debugConfig.enabled;
}

/**
 * Formats a multiplier for the in-canvas debug panel.
 *
 * @param {number} value - Raw multiplier value.
 * @returns {string} Human-readable multiplier string.
 */
function formatDebugMultiplier(value) {
  return `x${value.toFixed(2)}`;
}

/**
 * Resolves a valid debug pickup type if one was requested via the query string.
 *
 * @returns {string|null} Forced pickup type or null when no valid override is active.
 */
function getConfiguredDebugPickupType() {
  const forcedType = debugConfig.pickups.forcedType;
  return getPickupDefinition(forcedType) ? forcedType : null;
}

/**
 * Returns the platform pickup type to use for automatic currency spawns while honoring debug overrides.
 *
 * @param {string} defaultType - Normal pickup type that would have been spawned.
 * @param {{x:number, y:number, w:number, h:number}} platform - Target platform.
 * @returns {string} Effective pickup type for this spawn attempt.
 */
function resolvePlatformPickupType(defaultType, platform) {
  const forcedType = getConfiguredDebugPickupType();
  if (!forcedType) {
    return defaultType;
  }

  return pickupSystem.canSpawnOnPlatform(forcedType, platform) ? forcedType : defaultType;
}

/**
 * Scales a spawn chance by the active debug multiplier.
 *
 * @param {number} baseChance - Baseline probability.
 * @param {number} multiplier - Requested debug multiplier.
 * @returns {number} Adjusted probability in the 0..1 range.
 */
function getDebugAdjustedChance(baseChance, multiplier) {
  return debugTools.scaleChance(baseChance, multiplier);
}

/**
 * Rolls whether a pickup-related spawn should happen after debug adjustments.
 *
 * @param {number} baseChance - Baseline probability.
 * @returns {boolean} True when the spawn should happen.
 */
function shouldRollPickupSpawn(baseChance) {
  return Math.random() < getDebugAdjustedChance(baseChance, debugConfig.pickups.spawnMultiplier);
}

/**
 * Rolls whether a bug-related spawn should happen after debug adjustments.
 *
 * @param {number} baseChance - Baseline probability.
 * @returns {boolean} True when the spawn should happen.
 */
function shouldRollBugSpawn(baseChance) {
  return Math.random() < getDebugAdjustedChance(baseChance, debugConfig.spawns.bugMultiplier);
}

/**
 * Scales a delay by the active rocket debug multiplier.
 *
 * @param {number} delayMs - Baseline delay.
 * @param {number} [multiplier=1] - Additional multiplier contributed by gameplay systems.
 * @param {number} [minDelay=0] - Minimum resulting delay.
 * @returns {number} Adjusted delay in milliseconds.
 */
function getDebugAdjustedDelay(delayMs, multiplier = 1, minDelay = 0) {
  return debugTools.scaleDelay(delayMs, multiplier * debugConfig.spawns.rocketMultiplier, minDelay);
}

/**
 * Preloads backlog records into the lifecycle ledger for debugging balancing scenarios.
 *
 * @param {number} [count=debugConfig.initialRun.backlog] - Number of backlog records to create.
 */
function seedDebugBacklog(count = debugConfig.initialRun.backlog) {
  for (let i = 0; i < count; i += 1) {
    registerBugLifecycle(BUG_STATUS.BACKLOG);
  }
}

/**
 * Applies debug resource, score and backlog bootstrap values to a fresh run.
 */
function applyDebugRunBootstrap() {
  player.lives = debugConfig.initialRun.lives;
  runState.currencyCents = debugConfig.initialRun.currencyCents;
  runState.actionScore = debugConfig.initialRun.actionScore;
  runState.progressScore = debugConfig.initialRun.progressScore;
  seedDebugBacklog();
}

/**
 * Adds one extra backlog record during a debug run.
 */
function addDebugBacklogRecord() {
  registerBugLifecycle(BUG_STATUS.BACKLOG);
  statusMessage = "Debug-Backlog +1";
}

/**
 * Reactivates a small number of historical bug records for debug and future backlog pickups.
 *
 * @param {number} [amount=1] - Maximum number of records to reactivate.
 * @returns {number} Number of lifecycle records changed to reactivated.
 */
function reactivateHistoricalBugs(amount = 1) {
  let reactivatedCount = 0;

  for (let i = 0; i < amount; i += 1) {
    const record = bugLifecycleSystem.pickReactivatableRecord({
      activeBugIds: getActiveWorldBugIds(),
      randomInt,
    });
    if (!record) {
      break;
    }

    setBugLifecycleStatus(record.id, BUG_STATUS.REACTIVATED);
    reactivatedCount += 1;
  }

  return reactivatedCount;
}

/**
 * Triggers the next debug special-event step and optionally requires a specific configured type.
 *
 * @param {string|null} [requestedType=null] - Requested event type from a pickup or debug action.
 * @returns {boolean} True when the trigger was accepted.
 */
function triggerDebugEvent(requestedType = null) {
  if (requestedType && !specialEventSystem.getDefinition(requestedType)) {
    statusMessage = `Unbekannter Debug-Event: ${requestedType}`;
    return false;
  }

  if (
    requestedType &&
    specialEventState.phase === SPECIAL_EVENT_PHASE.IDLE &&
    debugConfig.specialEvent.forceType !== requestedType
  ) {
    statusMessage = `Setze ?debugEvent=${requestedType} fuer diesen Trigger`;
    return false;
  }

  stepDebugSpecialEvent();
  return true;
}

/**
 * Advances the special-event state machine manually for debugging.
 */
function stepDebugSpecialEvent() {
  if (specialEventState.phase === SPECIAL_EVENT_PHASE.IDLE) {
    startSpecialEventAnnouncement();
    return;
  }
  if (specialEventState.phase === SPECIAL_EVENT_PHASE.ANNOUNCE) {
    activateSpecialEvent();
    return;
  }

  completeSpecialEvent();
}

/**
 * Returns the number of currently falling bugs.
 *
 * @returns {number} Active falling bug count.
 */
function getFallingBugCount() {
  return level.bugs.filter((bug) => bug.alive && bug.falling).length;
}

function getActiveWorldBugIds() {
  return new Set(
    level.bugs
      .filter((bug) => bug.alive && Number.isFinite(bug.bugId))
      .map((bug) => bug.bugId)
  );
}

function getBugWaveSpawnLifecycleOptions() {
  if (Math.random() >= 0.5) {
    return {};
  }

  const record = bugLifecycleSystem.pickReactivatableRecord({
    activeBugIds: getActiveWorldBugIds(),
    randomInt,
  });
  if (!record) {
    return {};
  }

  setBugLifecycleStatus(record.id, BUG_STATUS.REACTIVATED);
  return {
    bugId: record.id,
    lifecycleStatus: BUG_STATUS.REACTIVATED,
  };
}

/**
 * Chooses a platform ahead of the camera that can receive a falling bug.
 *
 * @returns {{x:number, y:number, w:number, h:number, kind:string}|null} Target platform or null when none is suitable.
 */
function getBugWaveSpawnPlatform() {
  const candidates = level.platforms.filter((platform) => {
    if (platform.w < 128) {
      return false;
    }
    if (platform.x + platform.w < cameraX + 120) {
      return false;
    }
    return platform.x < cameraX + canvas.width + 320;
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates[randomInt(0, candidates.length - 1)];
}

/**
 * Spawns one falling bug for the bug-wave special event when capacity allows it.
 */
function spawnBugWaveBug() {
  const spawnAttempts = debugTools.getSpawnIterations(debugConfig.spawns.bugMultiplier);
  for (let attempt = 0; attempt < spawnAttempts; attempt += 1) {
    if (getFallingBugCount() >= specialEventConfig.bugWaveMaxFalling) {
      return;
    }

    const platform = getBugWaveSpawnPlatform();
    if (!platform) {
      return;
    }

    level.bugs.push(createFallingBug(platform, getBugWaveSpawnLifecycleOptions()));
  }
}

/**
 * Chooses a currently visible platform for extra Großauftrag gem spawns.
 *
 * @returns {{x:number, y:number, w:number, h:number, kind:string}|null} Visible target platform or null when none fits.
 */
function getVisibleBigOrderPlatform() {
  const candidates = level.platforms.filter((platform) => {
    if (platform.w < 90) {
      return false;
    }
    if (platform.x + platform.w < cameraX - 20) {
      return false;
    }
    return platform.x <= cameraX + canvas.width + 20;
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates[randomInt(0, candidates.length - 1)];
}

/**
 * Chooses a currently visible platform that can host a walking bug.
 *
 * @returns {{x:number, y:number, w:number, h:number, kind:string}|null} Visible bug platform or null when none fits.
 */
function getVisibleBugSpawnPlatform() {
  const candidates = level.platforms.filter((platform) => {
    if (platform.w < 120) {
      return false;
    }
    if (platform.x + platform.w < cameraX - 20) {
      return false;
    }
    return platform.x <= cameraX + canvas.width + 20;
  });

  if (candidates.length === 0) {
    return null;
  }

  return candidates[randomInt(0, candidates.length - 1)];
}

/**
 * Picks a visible platform that can host a debug-spawned pickup.
 *
 * @param {string} type - Pickup type id.
 * @returns {{x:number, y:number, w:number, h:number, kind:string}|null} Best matching platform or null when none fits.
 */
function getVisibleDebugPickupPlatform(type) {
  const candidates = level.platforms.filter((platform) => {
    if (!pickupSystem.canSpawnOnPlatform(type, platform)) {
      return false;
    }
    if (platform.x + platform.w < cameraX - 20) {
      return false;
    }
    return platform.x <= cameraX + canvas.width + 20;
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const leftDistance = Math.abs(left.x + left.w / 2 - (player.x + player.w / 2));
    const rightDistance = Math.abs(right.x + right.w / 2 - (player.x + player.w / 2));
    return leftDistance - rightDistance;
  });
  return candidates[0];
}

/**
 * Returns the current rocket spawn interval, with bug-wave countdowns and active bug-waves doubling the rate.
 *
 * @returns {number} Milliseconds until the next rocket spawn.
 */
function getNextRocketSpawnDelay() {
  const baseDelay = framesToMs(randomInt(850, 1450));
  return getDebugAdjustedDelay(baseDelay, getSpecialEventRocketSpawnMultiplier(), framesToMs(425));
}

/**
 * Spawns extra visible gems during the Großauftrag event, including on already-traversed screen space.
 */
function spawnBigOrderGem() {
  const spawnAttempts = debugTools.getSpawnIterations(debugConfig.pickups.spawnMultiplier);
  for (let attempt = 0; attempt < spawnAttempts; attempt += 1) {
    const platform = getVisibleBigOrderPlatform();
    if (!platform) {
      return;
    }

    const variant = pickBigOrderCurrencyVariant(specialEventConfig.bigOrder, Math.random());
    addPickupOnPlatform(platform, PICKUP_TYPE.CURRENCY, {
      telegraph: true,
      bypassSpawnGate: true,
      randomizeX: true,
      sourceEvent: "big-order",
      pickupVariant: variant.variant,
      currencyCents: variant.currencyCents,
      renderScale: variant.renderScale,
      spawnBugOnCollect: variant.spawnBugOnCollect,
    });
  }
}

/**
 * Spawns an extra visible walking bug on a currently visible platform.
 *
 * @param {{telegraph?: boolean, markerX?: number, markerY?: number, bugId?: number, lifecycleStatus?:"active-world"|"missed"|"backlog"|"resolved"|"reactivated"}} [options={}] - Optional lifecycle override for reactivated bugs.
 */
function spawnVisiblePlatformBug(options = {}) {
  const spawnAttempts = debugTools.getSpawnIterations(debugConfig.spawns.bugMultiplier);
  for (let attempt = 0; attempt < spawnAttempts; attempt += 1) {
    const platform = getVisibleBugSpawnPlatform();
    if (!platform) {
      return;
    }

    const patrolMargin = 18;
    const minX = platform.x + patrolMargin;
    const maxX = platform.x + platform.w - 46 - patrolMargin;
    if (maxX <= minX) {
      return;
    }

    const bugX = randomBetween(minX, maxX);
    const speed = (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.8, 1.5);
    level.bugs.push(
      createBug(bugX, platform.y - 38, platform.x + patrolMargin, platform.x + platform.w - patrolMargin, speed, {
        telegraph: true,
        ...options,
      })
    );
  }
}

/**
 * Finds the most plausible supporting platform for a platform pickup.
 *
 * @param {{x:number, y:number, r:number}} pickup - Collected pickup.
 * @returns {{x:number, y:number, w:number, h:number, kind:string}|null} Supporting platform or null when none fits.
 */
function getPickupSupportPlatform(pickup) {
  const expectedPlatformY = pickup.y + 32;
  const candidates = level.platforms.filter((platform) => {
    if (pickup.x + pickup.r < platform.x || pickup.x - pickup.r > platform.x + platform.w) {
      return false;
    }

    return Math.abs(platform.y - expectedPlatformY) <= 36;
  });

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => Math.abs(left.y - expectedPlatformY) - Math.abs(right.y - expectedPlatformY));
  return candidates[0];
}

/**
 * Spawns a telegraphed walking bug from the position of a collected pickup.
 *
 * @param {{x:number, y:number, r:number}} pickup - Collected pickup.
 * @returns {boolean} True when the bug spawn was added.
 */
function spawnTelegraphedBugFromPickup(pickup) {
  const platform = getPickupSupportPlatform(pickup);
  if (!platform) {
    return false;
  }

  const patrolMargin = 18;
  const minX = platform.x + patrolMargin;
  const maxX = platform.x + platform.w - 46 - patrolMargin;
  if (maxX <= minX) {
    return false;
  }

  const bugX = clamp(pickup.x - 23, minX, maxX);
  const speed = (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.8, 1.5);
  level.bugs.push(
    createBug(bugX, platform.y - 38, minX, maxX, speed, {
      telegraph: true,
      markerX: pickup.x,
      markerY: pickup.y,
    })
  );
  return true;
}

/**
 * Spawns an extra visible walking bug during the bug-wave event.
 */
function spawnBugWaveGroundBug() {
  spawnVisiblePlatformBug(getBugWaveSpawnLifecycleOptions());
}

/**
 * Advances active special events and their cooldown scheduling.
 *
 * @param {number} delta - Frame delta in milliseconds.
 */
function updateSpecialEvents(delta) {
  specialEventSystem.update(delta);
}

/**
 * Checks whether the current device should be treated as a mobile portrait layout.
 *
 * @returns {boolean} True when a touch device is currently taller than wide.
 */
function isPortraitMobileView() {
  return isTouchDevice && window.innerHeight > window.innerWidth;
}

/**
 * Attempts to enter fullscreen and lock screen orientation to landscape on supported devices.
 *
 * @returns {Promise<void>} Resolves once lock attempts have finished.
 */
async function requestLandscapeLock() {
  if (!isTouchDevice || orientationLocked) {
    return;
  }

  try {
    if (!document.fullscreenElement && canvas.requestFullscreen) {
      await canvas.requestFullscreen();
    }
  } catch {
    // Ignore fullscreen failures on browsers that require stricter gestures.
  }

  try {
    if (screen.orientation?.lock) {
      await screen.orientation.lock("landscape");
      orientationLocked = true;
    }
  } catch {
    // Ignore unsupported orientation lock errors.
  }
}

window.addEventListener("resize", syncCanvasOnlyMode);
window.addEventListener("orientationchange", syncCanvasOnlyMode);

/**
 * Returns the current euro pickup rate normalized to one hour.
 *
 * @returns {number} Current euros per hour rounded to a whole number.
 */
function getEuroRatePerHourValue() {
  return simulationCore.calculateEuroRatePerHour(runState.currencyCents, worldTimeMs);
}

/**
 * Returns the quality multiplier for the current bug load.
 *
 * @returns {number} Bug-side score multiplier.
 */
function getBugBalanceMultiplier() {
  return simulationCore.calculateBugBalanceMultiplier(getOutstandingBugTotal());
}

/**
 * Returns the quality multiplier for current business momentum.
 *
 * @returns {number} Income-side score multiplier.
 */
function getIncomeBalanceMultiplier() {
  return simulationCore.calculateIncomeBalanceMultiplier(getEuroRatePerHourValue());
}

/**
 * Returns the current run balance multiplier from bug pressure and income momentum.
 *
 * @returns {number} Current balance multiplier.
 */
function getRunBalanceMultiplier() {
  return simulationCore.calculateRunBalanceMultiplier({
    outstandingBugs: getOutstandingBugTotal(),
    euroRatePerHour: getEuroRatePerHourValue(),
  });
}

/**
 * Computes the current progress-score target from distance and the live run balance.
 *
 * @returns {number} Current progress-score target.
 */
function getProgressScoreTarget() {
  return simulationCore.calculateProgressScoreTarget({
    farthestX: runState.farthestX,
    spawnX: level.spawn.x,
    distanceDivisor: scoreConfig.distanceDivisor,
    runBalanceMultiplier: getRunBalanceMultiplier(),
  });
}

/**
 * Locks in monotonic progress score so forward movement never removes already-earned progress points.
 *
 * @returns {number} Current stored progress score.
 */
function syncProgressScore() {
  runState.progressScore = simulationCore.lockProgressScore(
    runState.progressScore,
    getProgressScoreTarget()
  );
  return runState.progressScore;
}

/**
 * Returns the stored progress score for the current run.
 *
 * @returns {number} Current progress score.
 */
function getProgressScore() {
  return runState.progressScore;
}

/**
 * Returns the current score breakdown for the run.
 *
 * @returns {{action:number, progress:number, total:number}} Score breakdown.
 */
function getScoreBreakdown() {
  return simulationCore.calculateScoreBreakdown(runState.actionScore, getProgressScore());
}

/**
 * Computes the displayed total score including the locked-in progress bonus.
 *
 * @returns {number} Current total score.
 */
function getTotalScore() {
  return getScoreBreakdown().total;
}

/**
 * Updates the persisted high score when the current run beats it.
 */
function syncHighScore() {
  if (!canPersistHighScore()) {
    return;
  }

  const total = getTotalScore();
  if (total > highScore) {
    saveHighScore(total);
  }
}

/**
 * Pauses the current run and remembers why it was interrupted.
 *
 * @param {"manual"|"portrait"|"background"} reason - Cause for the pause.
 */
function pauseGame(reason) {
  if (gameState !== "playing") {
    return;
  }

  resetDirectionalInputState();
  activeHudInfo = null;
  gameState = "paused";
  pauseReason = reason;
  statusMessage = reason === "manual" ? "Pausiert" : "Lauf pausiert";
}

/**
 * Resumes a paused run, optionally with the existing safety countdown.
 *
 * @param {boolean} [withCountdown=false] - Whether to add the short resume countdown.
 */
function resumeGame(withCountdown = false) {
  if (gameState !== "paused") {
    return;
  }
  if (isPortraitMobileView() || document.visibilityState === "hidden") {
    return;
  }

  resetDirectionalInputState();
  activeHudInfo = null;
  gameState = "playing";
  pauseReason = null;
  resumeCountdownTimer = withCountdown ? 3000 : 0;
  statusMessage = withCountdown ? "Zurück im Lauf" : "Pause beendet";
}

/**
 * Returns whether the current pause state can be resumed interactively by the player.
 *
 * @returns {boolean} True when a manual or background pause may be resumed.
 */
function canResumePausedRun() {
  return gameState === "paused" && (pauseReason === "manual" || pauseReason === "background");
}

/**
 * Returns whether resuming from the given pause reason should use the safety countdown.
 *
 * @param {"manual"|"portrait"|"background"|null} [reason=pauseReason] - Pause reason to inspect.
 * @returns {boolean} True when a resume countdown should be shown.
 */
function shouldUseResumeCountdown(reason = pauseReason) {
  return reason === "background";
}

/**
 * Returns the localized pause overlay prompt for the current input mode.
 *
 * @returns {string} Resume prompt shown in the paused overlay.
 */
function getPauseResumePrompt() {
  return isTouchDevice ? "Tippe zum Fortsetzen" : "Druecke P zum Fortsetzen";
}

/**
 * Toggles the manual desktop pause state.
 */
function toggleManualPause() {
  if (gameState === "playing") {
    pauseGame("manual");
    return;
  }

  if (canResumePausedRun()) {
    resumeGame(shouldUseResumeCountdown());
  }
}

/**
 * Rebuilds the current left/right movement flags from all active directional inputs.
 */
function updateTouchInputState() {
  let newestInput = null;

  activeDirectionalInputs.forEach((entry) => {
    if (!newestInput || entry.sequence > newestInput.sequence) {
      newestInput = entry;
    }
  });

  keys.left = newestInput?.direction === "left";
  keys.right = newestInput?.direction === "right";
}

/**
 * Registers or refreshes an active directional input. The most recent active direction wins.
 *
 * @param {string|number} token - Stable id for the active input source.
 * @param {"left"|"right"} direction - Direction associated with the source.
 */
function setDirectionalInput(token, direction) {
  activeDirectionalInputs.set(token, {
    direction,
    sequence: ++directionalInputSequence,
  });
  updateTouchInputState();
}

/**
 * Removes a directional input source and reapplies the latest remaining active direction.
 *
 * @param {string|number} token - Stable id for the active input source.
 */
function clearDirectionalInput(token) {
  if (!activeDirectionalInputs.has(token)) {
    return;
  }

  activeDirectionalInputs.delete(token);
  updateTouchInputState();
}

/**
 * Clears any latched left/right input so countdown phases always resume from a neutral state.
 */
function resetDirectionalInputState() {
  activeTouchControls.clear();
  activeDirectionalInputs.clear();
  updateTouchInputState();
}

/**
 * Converts a pointer event from DOM coordinates into canvas space.
 *
 * @param {PointerEvent} event - Pointer event from the canvas.
 * @returns {{x:number, y:number}|null} Canvas-space point or null when sizing is unavailable.
 */
function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

/**
 * Checks whether a point lies inside a rectangle.
 *
 * @param {{x:number, y:number}} point - Point to test.
 * @param {{x:number, y:number, w:number, h:number}} rect - Rectangle bounds.
 * @returns {boolean} True when the point is inside the rectangle.
 */
function pointInRect(point, rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

/**
 * Checks whether a point lies inside a circle.
 *
 * @param {{x:number, y:number}} point - Point to test.
 * @param {{cx:number, cy:number, r:number}} circle - Circle bounds.
 * @returns {boolean} True when the point is inside the circle.
 */
function pointInCircle(point, circle) {
  const dx = point.x - circle.cx;
  const dy = point.y - circle.cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

/**
 * Resolves a touch point to the corresponding in-canvas control action.
 *
 * @param {{x:number, y:number}|null} point - Canvas-space touch position.
 * @returns {"left"|"right"|"jump"|"tap"|null} Detected control action.
 */
function getTouchAction(point) {
  if (!point) {
    return null;
  }

  // Touch controls are rendered inside the canvas, so hit-testing uses canvas coordinates too.
  if (pointInCircle(point, mobileHud.leftPad)) {
    return "left";
  }
  if (pointInCircle(point, mobileHud.rightPad)) {
    return "right";
  }
  if (pointInCircle(point, mobileHud.jumpPad)) {
    return "jump";
  }
  return "tap";
}

/**
 * Creates a platform descriptor.
 *
 * @param {number} x - World x-position.
 * @param {number} y - World y-position.
 * @param {number} w - Platform width.
 * @param {number} h - Platform height.
 * @param {string} kind - Platform type such as "ground" or "plate".
 * @returns {{x:number, y:number, w:number, h:number, kind:string}} Platform object.
 */
function createPlatform(x, y, w, h, kind) {
  return { x, y, w, h, kind };
}

/**
 * Resets the bug lifecycle ledger for a fresh run.
 */
function resetBugLifecycle() {
  bugLifecycleSystem.reset();
}

/**
 * Registers a new bug in the lifecycle ledger.
 *
 * @param {"active-world"|"missed"|"backlog"|"resolved"|"reactivated"} [status=BUG_STATUS.ACTIVE_WORLD] - Initial lifecycle status.
 * @returns {number} Stable lifecycle id for the bug.
 */
function registerBugLifecycle(status = BUG_STATUS.ACTIVE_WORLD) {
  return bugLifecycleSystem.register(status);
}

/**
 * Updates the lifecycle status for a known bug.
 *
 * @param {number|undefined} bugId - Lifecycle id of the bug.
 * @param {"active-world"|"missed"|"backlog"|"resolved"|"reactivated"} status - Next lifecycle status.
 */
function setBugLifecycleStatus(bugId, status) {
  bugLifecycleSystem.setStatus(bugId, status);
}

/**
 * Marks an active world bug as resolved.
 *
 * @param {{bugId?: number}} bug - Bug world entity.
 */
function markBugResolved(bug) {
  bugLifecycleSystem.markResolved(bug?.bugId);
}

/**
 * Marks an unresolved world bug as missed after it leaves the active world.
 *
 * @param {{bugId?: number}} bug - Bug world entity.
 */
function markBugMissed(bug) {
  bugLifecycleSystem.markMissed(bug?.bugId);
}

/**
 * Counts bugs by lifecycle state for HUD, balance and future bug-systems.
 *
 * @returns {{activeWorld:number, missed:number, backlog:number, resolved:number, reactivated:number, totalKnown:number}} Lifecycle counters.
 */
function getBugLifecycleCounts() {
  return bugLifecycleSystem.getCounts();
}

/**
 * Creates an enemy patrol descriptor.
 *
 * @param {number} x - Initial x-position.
 * @param {number} y - Initial y-position.
 * @param {number} minX - Patrol minimum x-position.
 * @param {number} maxX - Patrol maximum x-position.
 * @param {number} speed - Initial horizontal speed.
 * @param {{telegraph?: boolean, markerX?: number, markerY?: number, bugId?: number, lifecycleStatus?:"active-world"|"missed"|"backlog"|"resolved"|"reactivated"}} [options={}] - Optional spawn preview settings.
 * @returns {{x:number, y:number, w:number, h:number, minX:number, maxX:number, vx:number, vy:number, alive:boolean, falling:boolean, targetPlatformMinX:number, targetPlatformMaxX:number, targetGroundY:number}} Bug object.
 */
function createBug(x, y, minX, maxX, speed, options = {}) {
  const {
    telegraph = false,
    markerX = x + 23,
    markerY = y + 19,
    bugId = null,
    lifecycleStatus = BUG_STATUS.ACTIVE_WORLD,
  } = options;
  return {
    bugId: Number.isFinite(bugId) ? bugId : registerBugLifecycle(lifecycleStatus),
    x,
    y,
    w: 46,
    h: 38,
    minX,
    maxX,
    vx: speed,
    vy: 0,
    alive: true,
    falling: false,
    targetPlatformMinX: minX,
    targetPlatformMaxX: maxX,
    targetGroundY: y,
    spawnTimer: telegraph ? specialEventConfig.spawnTelegraphDuration : 0,
    spawnDuration: specialEventConfig.spawnTelegraphDuration,
    spawnMarkerX: markerX,
    spawnMarkerY: markerY,
  };
}

/**
 * Creates a bug that drops from the sky and starts patrolling after landing.
 *
 * @param {{x:number, y:number, w:number}} platform - Platform that should receive the falling bug.
 * @param {{telegraph?: boolean, markerX?: number, markerY?: number, bugId?: number, lifecycleStatus?:"active-world"|"missed"|"backlog"|"resolved"|"reactivated"}} [options={}] - Optional lifecycle override for reactivated bugs.
 * @returns {{x:number, y:number, w:number, h:number, minX:number, maxX:number, vx:number, vy:number, alive:boolean, falling:boolean, targetPlatformMinX:number, targetPlatformMaxX:number, targetGroundY:number}} Bug object.
 */
function createFallingBug(platform, options = {}) {
  const patrolMargin = 18;
  const minX = platform.x + patrolMargin;
  const maxX = platform.x + platform.w - patrolMargin;
  const spawnX = clamp(randomBetween(minX, maxX - 46), minX, maxX - 46);
  const spawnY = randomBetween(-58, -22);
  const bug = createBug(spawnX, spawnY, minX, maxX, 0, options);

  bug.falling = true;
  bug.vy = randomBetween(0.6, 1.2);
  bug.targetPlatformMinX = minX;
  bug.targetPlatformMaxX = maxX;
  bug.targetGroundY = platform.y - bug.h;
  return bug;
}

/**
 * Spawns a bonus rocket entering from one side of the screen.
 *
 * @param {boolean} fromLeft - Whether the rocket should fly in from the left.
 * @returns {{x:number, y:number, w:number, h:number, vx:number, fromLeft:boolean, active:boolean}} Rocket object.
 */
function createRocket(fromLeft) {
  const w = 110;
  const h = 44;
  const y = randomInt(70, 170);
  const x = fromLeft ? cameraX - w - 80 : cameraX + canvas.width + 80;
  const vx = fromLeft ? randomBetween(6, 12) : -randomBetween(6, 12);
  return { x, y, w, h, vx, fromLeft, active: true };
}

/**
 * Creates a drifting background cloud descriptor.
 *
 * @param {number} x - Initial x-position.
 * @returns {{x:number, y:number, w:number, h:number, vx:number, puff:number}} Cloud object.
 */
function createCloud(x) {
  return {
    x,
    y: randomInt(50, 190),
    w: randomInt(90, 170),
    h: randomInt(28, 52),
    vx: -randomBetween(0.12, 0.32),
    puff: randomBetween(0.85, 1.2),
  };
}

/**
 * Reuses an existing cloud with fresh randomized visuals at a specific parallax-layer x-position.
 *
 * @param {{x:number, y:number, w:number, h:number, vx:number, puff:number}} cloud - Cloud to randomize.
 * @param {number} x - New x-position in the background parallax layer.
 */
function resetCloud(cloud, x) {
  cloud.x = x;
  cloud.y = randomInt(50, 190);
  cloud.w = randomInt(90, 170);
  cloud.h = randomInt(28, 52);
  cloud.vx = -randomBetween(0.12, 0.32);
  cloud.puff = randomBetween(0.85, 1.2);
}

/**
 * Creates a HUD fly-to effect descriptor.
 *
 * @param {number} x - World x-position where the effect starts.
 * @param {number} y - World y-position where the effect starts.
 * @param {string} emoji - Glyph to render.
 * @param {string|null} [color=null] - Optional solid color override for non-emoji glyphs.
 * @returns {{x:number, y:number, emoji:string, color:string|null}} Effect object.
 */
function createHitEffect(x, y, emoji, color = null) {
  return { x, y, emoji, color };
}

/**
 * Applies one pickup effect through the typed pickup system.
 *
 * @param {string} type - Pickup type id.
 * @param {object} pickup - Pickup-shaped source entity.
 * @returns {boolean} True when the effect was applied.
 */
function applyPickupEffect(type, pickup) {
  return pickupSystem.applyEffect(type, {
    pickup,
    player,
    runState,
    scoreConfig,
    createHitEffect,
    spawnHudEmoji,
    setStatusMessage(message) {
      statusMessage = message;
    },
    onBacklogRevival({ amount }) {
      const reactivatedCount = reactivateHistoricalBugs(amount);
      if (reactivatedCount > 0) {
        const bugEffect = createHitEffect(pickup.x, pickup.y - 10, "🐞");
        spawnHudEmoji(bugEffect.x, bugEffect.y, bugEffect.emoji, "bugsOpen");
      }
    },
    onCurrencyCollected({ spawnBugOnCollect }) {
      const spawnChance = Number(spawnBugOnCollect?.chance);
      if (!Number.isFinite(spawnChance) || Math.random() >= spawnChance) {
        return;
      }

      spawnTelegraphedBugFromPickup(pickup);
    },
    triggerEvent(typeId) {
      triggerDebugEvent(typeId ?? null);
    },
  });
}

/**
 * Collects a platform pickup and applies its typed gameplay effect.
 *
 * @param {{type:string, collected:boolean}} pickup - Pickup entity.
 */
function collectPickup(pickup) {
  if (pickup.collected) {
    return;
  }

  pickup.collected = true;
  applyPickupEffect(pickup.type, pickup);
}

/**
 * Returns the current HUD section definitions, including values, hit areas and tooltip content.
 *
 * @returns {Array<object>} HUD stat descriptors for rendering and interaction.
 */
function formatRunDuration(timeMs) {
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Formats cent-based currency as a euro string.
 *
 * @param {number} cents - Monetary amount in cents.
 * @returns {string} Formatted euro amount.
 */
function formatEuroAmount(cents) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

/**
 * Returns the current bug ledger for the run.
 *
 * `openInRun` tracks unresolved bugs from this run. Backlog exists as an explicit future extension point
 * but is not gameplay-active yet.
 *
 * @returns {{spawnedInRun:number, resolvedInRun:number, openInRun:number, activeInWorld:number, missedInRun:number, backlog:number, reactivatedInRun:number}} Bug ledger snapshot.
 */
function getBugLedger() {
  const counts = getBugLifecycleCounts();
  const openInRun = counts.activeWorld + counts.missed + counts.backlog + counts.reactivated;
  return {
    spawnedInRun: counts.totalKnown,
    resolvedInRun: counts.resolved,
    openInRun,
    activeInWorld: counts.activeWorld,
    missedInRun: counts.missed,
    backlog: counts.backlog,
    reactivatedInRun: counts.reactivated,
  };
}

/**
 * Returns the amount of unresolved bugs in the current run.
 *
 * @returns {number} Count of bugs still left unbeaten in this run.
 */
function getOutstandingBugTotal() {
  return getBugLedger().openInRun;
}

/**
 * Returns the amount of outstanding bugs as a HUD-friendly string.
 *
 * @returns {string} Count of bugs still left unbeaten.
 */
function getOutstandingBugCount() {
  return String(getOutstandingBugTotal());
}

/**
 * Returns the spawn multiplier for money-making sources based on outstanding bugs.
 *
 * @returns {number} Chance multiplier in the range 0.18..1.
 */
function getIncomeSourceSpawnMultiplier() {
  return simulationCore.calculateIncomeSourceSpawnMultiplier(getOutstandingBugTotal());
}

/**
 * Returns whether a money-making source should appear.
 *
 * @param {number} [baseChance=1] - Baseline spawn chance before bug pressure is applied.
 * @returns {boolean} True when the source should spawn.
 */
function shouldSpawnIncomeSource(baseChance = 1) {
  return simulationCore.shouldSpawnIncomeSource({
    baseChance: getDebugAdjustedChance(baseChance, debugConfig.spawns.incomeMultiplier),
    outstandingBugs: getOutstandingBugTotal(),
    randomValue: Math.random(),
  });
}

/**
 * Formats the current euro-per-hour value for the HUD.
 *
 * @returns {string} Current euros per hour rounded to a whole number.
 */
function formatEuroRatePerHour() {
  return String(getEuroRatePerHourValue());
}

/**
 * Returns the current run model used by HUD, scoring and future resource-oriented systems.
 *
 * @returns {{resources:{currencyCents:number,lives:number,euroRatePerHour:number},bugs:{spawnedInRun:number,resolvedInRun:number,openInRun:number,activeInWorld:number,missedInRun:number,backlog:number,reactivatedInRun:number},score:{action:number,progress:number,total:number},balanceMultiplier:number}} Run snapshot.
 */
function getRunModel() {
  return {
    resources: {
      currencyCents: runState.currencyCents,
      lives: player.lives,
      euroRatePerHour: getEuroRatePerHourValue(),
    },
    bugs: getBugLedger(),
    score: getScoreBreakdown(),
    balanceMultiplier: getRunBalanceMultiplier(),
  };
}

/**
 * Returns the current HUD section definitions, including values, hit areas and tooltip content.
 *
 * @returns {Array<object>} HUD stat descriptors for rendering and interaction.
 */
function getHudStats() {
  // Keep HUD layout, values and tooltip metadata in one place.
  const runModel = getRunModel();
  return [
    {
      key: "bugsOpen",
      emoji: "🐞",
      label: "Offene Bugs",
      value: String(runModel.bugs.openInRun),
      accent: "#ffc48c",
      sectionX: 24,
      valueX: 64,
      hitArea: { x: 0, y: 0, w: 192, h: 44 },
      target: { x: 52, y: 42 },
      tooltip: [
        "Zeigt offene Bugs im aktuellen Run.",
        `Im Run gespawnt: ${runModel.bugs.spawnedInRun}`,
        `Aktiv in der Welt: ${runModel.bugs.activeInWorld}`,
        `Verpasst: ${runModel.bugs.missedInRun}`,
        `Im Run geloest: ${runModel.bugs.resolvedInRun}`,
        `Backlog: ${runModel.bugs.backlog}`,
        "Je mehr offene Bugs, desto seltener kommen Einnahmequellen um Moneten zu verdienen.",
      ],
    },
    {
      key: "gems",
      emoji: "€",
      label: "Moneten",
      value: formatEuroAmount(runModel.resources.currencyCents),
      accent: "#ffe37a",
      sectionX: 216,
      valueX: 256,
      hitArea: { x: 192, y: 0, w: 192, h: 44 },
      target: { x: 244, y: 42 },
      tooltip: [
        "Jedes Euro-Symbol bringt 10 ct.",
        "Moneten sind die direkte Einkommens-Ressource dieses Runs.",
        "Weitere Ressourcenarten koennen spaeter hinzukommen, ohne diese Anzeige umzudeuten.",
      ],
    },
    {
      key: "euroRate",
      emoji: "€/h",
      label: "Euro pro Stunde",
      value: String(runModel.resources.euroRatePerHour),
      accent: "#ffe8a3",
      sectionX: 408,
      valueX: 456,
      hitArea: { x: 384, y: 0, w: 192, h: 44 },
      target: { x: 436, y: 42 },
      tooltip: [
        "Zeigt dein aktuelles Sammeltempo hochgerechnet auf eine Stunde.",
        "Basiert nur auf Moneten und der bisherigen Laufzeit dieses Runs.",
        `Spieldauer: ${formatRunDuration(worldTimeMs)}`,
        `Balance-Faktor: x${runModel.balanceMultiplier.toFixed(2).replace(".", ",")}`,
      ],
    },
    {
      key: "lives",
      emoji: "🚀",
      label: "Leben",
      value: String(runModel.resources.lives),
      accent: "#ffd27d",
      sectionX: 600,
      valueX: 641,
      hitArea: { x: 576, y: 0, w: 192, h: 44 },
      target: { x: 628, y: 42 },
      tooltip: ["Treffer und Stürze kosten ein Leben.", "Raketen schenken dir ein Extraleben."],
    },
    {
      key: "score",
      emoji: "⭐",
      label: "Punkte",
      value: String(runModel.score.total),
      accent: "#fff1b8",
      sectionX: 792,
      valueX: 832,
      hitArea: { x: 768, y: 0, w: 192, h: 44 },
      target: { x: 820, y: 42 },
      tooltip: [
        `Euro-Symbol: ${scoreConfig.gemPickup}`,
        `Bug fixen: ${scoreConfig.bugDefeat}`,
        `Rakete einsammeln: ${scoreConfig.rocketPickup}`,
        `Aktionspunkte: ${runModel.score.action}`,
        `Fortschrittspunkte: ${runModel.score.progress}`,
        "Fortschrittspunkte sind monoton und gehen durch spaetere Balance-Schwankungen nicht verloren.",
        "Balance lebt von Einnahmen und wenigen offenen Bugs.",
        canPersistHighScore() ? `Highscore: ${highScore}` : "Debug-Run speichert keinen Highscore.",
      ],
    },
  ];
}

/**
 * Looks up a HUD stat descriptor by key.
 *
 * @param {string} key - HUD stat key.
 * @returns {object|null} Matching stat descriptor or null.
 */
function getHudStatByKey(key) {
  return getHudStats().find((stat) => stat.key === key) ?? null;
}

/**
 * Resolves which HUD section was clicked or tapped.
 *
 * @param {{x:number, y:number}} point - Canvas-space pointer position.
 * @returns {object|null} Matching HUD section or null.
 */
function getHudInfoHit(point) {
  return getHudStats().find((stat) => pointInRect(point, stat.hitArea)) ?? null;
}

/**
 * Starts a fly-to-HUD animation from world space toward a HUD stat target.
 *
 * @param {number} worldX - World-space x-position.
 * @param {number} worldY - World-space y-position.
 * @param {string} emoji - Glyph to animate.
 * @param {string} statKey - Target HUD stat key.
 */
function spawnHudEmoji(worldX, worldY, emoji, statKey) {
  const targetStat = getHudStatByKey(statKey);
  if (!targetStat) {
    return;
  }

  // Convert a world pickup/hit position into a lightweight fly-to-HUD animation.
  hudEffects.push({
    emoji,
    color: targetStat.key === "gems" ? "#ffe37a" : null,
    t: 0,
    duration: 900,
    startX: worldX - cameraX,
    startY: worldY,
    targetX: targetStat.target.x,
    targetY: targetStat.target.y,
  });
}

/**
 * Advances and removes transient HUD animation effects.
 *
 * @param {number} delta - Frame delta in milliseconds.
 */
function updateHudEffects(delta) {
  for (let i = hudEffects.length - 1; i >= 0; i -= 1) {
    hudEffects[i].t += delta;
    if (hudEffects[i].t >= hudEffects[i].duration) {
      hudEffects.splice(i, 1);
    }
  }
}

/**
 * Draws fly-to-HUD effects above the world.
 */
function drawHudEffects() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  hudEffects.forEach((effect) => {
    const progress = clamp(effect.t / effect.duration, 0, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    const arcLift = Math.sin(progress * Math.PI) * 22;
    const x = effect.startX + (effect.targetX - effect.startX) * eased;
    const y = effect.startY + (effect.targetY - effect.startY) * eased - arcLift;
    const scale = 1 - progress * 0.18;
    const alpha = 1 - progress * 0.88;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = effect.color ?? "#fff6ea";
    ctx.strokeStyle = effect.color ? "#9a6a00" : "transparent";
    ctx.lineWidth = effect.color ? 2 : 0;
    ctx.font = effect.color
      ? `${Math.round(28 * scale)}px Trebuchet MS`
      : `${Math.round(28 * scale)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    if (effect.color) {
      ctx.strokeText(effect.emoji, x, y);
    }
    ctx.fillText(effect.emoji, x, y);
  });

  ctx.restore();
}

/**
 * Wraps a text string into multiple lines that fit within a maximum width.
 *
 * @param {string} text - Text to wrap.
 * @param {number} maxWidth - Maximum line width in canvas pixels.
 * @returns {string[]} Wrapped lines.
 */
function wrapTextLines(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !currentLine) {
      currentLine = candidate;
      return;
    }
    lines.push(currentLine);
    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Removes floor hazards that overlap a horizontal span.
 *
 * @param {number} startX - Start of the span.
 * @param {number} endX - End of the span.
 */
function removeHazardsUnderSpan(startX, endX) {
  generatorHelpers.removeHazardsUnderSpan(startX, endX);
}

/**
 * Captures the mutable generation state that optional chunk features may change.
 *
 * @returns {{platformCount:number, hazards:Array<object>, pickupCount:number, bugCount:number, bugLifecycleNextId:number}} Snapshot.
 */
function createChunkFeatureSnapshot() {
  return generatorHelpers.createChunkFeatureSnapshot();
}

/**
 * Restores the mutable generation state after a failed optional chunk feature attempt.
 *
 * @param {{platformCount:number, hazards:Array<object>, pickupCount:number, bugCount:number, bugLifecycleNextId:number}} snapshot - State to restore.
 */
function restoreChunkFeatureSnapshot(snapshot) {
  generatorHelpers.restoreChunkFeatureSnapshot(snapshot);
}

/**
 * Runs an optional chunk feature and rolls back all intermediate generation side effects when it fails.
 *
 * @param {() => boolean} attemptFeature - Returns true when the optional feature should be kept.
 * @returns {boolean} True when the feature was committed.
 */
function commitChunkFeatureAttempt(attemptFeature) {
  return generatorHelpers.commitChunkFeatureAttempt(attemptFeature);
}

/**
 * Adds an intermediate helper platform when a generated platform would otherwise be too high.
 *
 * @param {{x:number, y:number, w:number, h:number, kind:string}} targetPlatform - Platform that needs support.
 * @param {number} groundY - Ground y-position of the current chunk.
 * @returns {boolean} True when a reachable setup exists after processing.
 */
function ensureStepPlatform(targetPlatform, groundY) {
  return generatorHelpers.ensureStepPlatform(targetPlatform, groundY);
}

/**
 * Checks whether a platform has at least one plausible approach from nearby support geometry.
 *
 * @param {{x:number, y:number, w:number, h:number, kind:string}} targetPlatform - Platform to validate.
 * @param {{x:number, y:number, w:number, h:number, kind:string}} ground - Ground platform in the same chunk.
 * @returns {boolean} True when the platform can be approached.
 */
function hasReachableApproach(targetPlatform, ground) {
  return generatorHelpers.hasReachableApproach(targetPlatform, ground);
}

/**
 * Checks whether a generated platform overlaps existing platforms with optional padding.
 *
 * @param {{x:number, y:number, w:number, h:number}} candidate - Platform candidate.
 * @param {number} [padding=18] - Extra spacing around both platforms.
 * @returns {boolean} True when a collision is detected.
 */
function platformCollides(candidate, padding = 18) {
  return generatorHelpers.platformCollides(candidate, padding);
}

/**
 * Checks whether an elevated platform leaves enough clearance to move underneath it.
 *
 * @param {{y:number, h:number}} platform - Platform to inspect.
 * @param {number} groundY - Ground y-position.
 * @returns {boolean} True when the underpass would be too tight for the player.
 */
function isTooCloseToGround(platform, groundY) {
  return generatorHelpers.isTooCloseToGround(platform, groundY);
}

/**
 * Resets all procedural world state and seeds the opening section of the run.
 */
function initLevel() {
  level.platforms = [];
  level.hazards = [];
  level.pickups = [];
  level.bugs = [];
  level.rockets = [];
  level.clouds = [];
  level.nextChunkX = 0;
  level.lastGroundY = 452;

  for (let i = 0; i < 6; i += 1) {
    level.clouds.push(createCloud(i * 240 + randomInt(0, 80)));
  }

  level.platforms.push(createPlatform(0, 470, 360, 70, "ground"));
  level.platforms.push(createPlatform(360, 456, 260, 84, "ground"));
  level.platforms.push(createPlatform(660, 440, 260, 100, "ground"));
  level.pickups.push(createPickup(PICKUP_TYPE.CURRENCY, 780, 394));
  level.bugs.push(createBug(450, 418, 390, 560, 1.15));

  level.nextChunkX = 960;
  level.lastGroundY = 440;
  generateUntil(2600);
}

/**
 * Randomly adds a spike hazard onto a ground segment when there is enough room.
 *
 * @param {{x:number, y:number, w:number, h:number}} segment - Ground platform segment.
 */
function addGroundHazard(segment) {
  if (segment.w < 220 || Math.random() > 0.28) {
    return;
  }

  const safeMargin = 36;
  const width = randomInt(36, 74);
  const height = randomInt(22, 28);
  const hazardX = randomInt(segment.x + safeMargin, segment.x + segment.w - width - safeMargin);
  level.hazards.push({
    x: hazardX,
    y: segment.y - height + 4,
    w: width,
    h: height,
    cycleOffset: randomInt(0, 6000),
  });
}

/**
 * Returns the current visible and dangerous portion of a spike hazard.
 *
 * @param {{x:number, y:number, w:number, h:number, cycleOffset?:number}} hazard - Hazard to evaluate.
 * @param {number} [timeMs=worldTimeMs] - Elapsed game time in milliseconds.
 * @returns {{exposure:number, active:boolean, top:number, height:number, baseY:number}} Animated hazard state.
 */
function getHazardState(hazard, timeMs = worldTimeMs) {
  const totalDuration =
    hazardCycleConfig.exposedDuration +
    hazardCycleConfig.sinkingDuration +
    hazardCycleConfig.hiddenDuration +
    hazardCycleConfig.risingDuration;
  const phaseTime = ((timeMs + (hazard.cycleOffset ?? 0)) % totalDuration + totalDuration) % totalDuration;

  let exposure;
  if (phaseTime < hazardCycleConfig.exposedDuration) {
    exposure = 1;
  } else if (phaseTime < hazardCycleConfig.exposedDuration + hazardCycleConfig.sinkingDuration) {
    const sinkProgress =
      (phaseTime - hazardCycleConfig.exposedDuration) / Math.max(1, hazardCycleConfig.sinkingDuration);
    exposure = 1 - sinkProgress;
  } else if (
    phaseTime <
    hazardCycleConfig.exposedDuration + hazardCycleConfig.sinkingDuration + hazardCycleConfig.hiddenDuration
  ) {
    exposure = 0;
  } else {
    const riseStart =
      hazardCycleConfig.exposedDuration + hazardCycleConfig.sinkingDuration + hazardCycleConfig.hiddenDuration;
    const riseProgress = (phaseTime - riseStart) / Math.max(1, hazardCycleConfig.risingDuration);
    exposure = riseProgress;
  }

  const clampedExposure = clamp(exposure, 0, 1);
  const height = hazard.h * clampedExposure;
  const baseY = hazard.y + hazard.h;
  return {
    exposure: clampedExposure,
    active: clampedExposure >= hazardCycleConfig.activeExposureThreshold,
    top: baseY - height,
    height,
    baseY,
  };
}

/**
 * Returns whether two horizontal spans overlap.
 *
 * @param {number} startA - Start x-position of the first span.
 * @param {number} endA - End x-position of the first span.
 * @param {number} startB - Start x-position of the second span.
 * @param {number} endB - End x-position of the second span.
 * @returns {boolean} True when both spans overlap.
 */
function spansOverlap(startA, endA, startB, endB) {
  return placementSystem.spansOverlap(startA, endA, startB, endB);
}

/**
 * Returns the horizontal placement range available on a platform after reserving edge padding.
 *
 * The returned range uses the moving object's left edge when `occupantWidth > 0`, and a point range
 * when `occupantWidth` is zero.
 *
 * @param {{x:number, w:number}} platform - Platform to inspect.
 * @param {number} [occupantWidth=0] - Width of the occupying object.
 * @param {number} [edgePadding=placementSafetyConfig.platformEdgePadding] - Reserved padding near platform edges.
 * @returns {{start:number, end:number}|null} Available horizontal range or null when the platform is too small.
 */
function getPlatformPlacementRange(
  platform,
  occupantWidth = 0,
  edgePadding = placementSafetyConfig.platformEdgePadding,
) {
  return placementSystem.getPlatformPlacementRange(platform, occupantWidth, edgePadding);
}

/**
 * Cuts one blocked interval out of a list of safe horizontal zones.
 *
 * @param {Array<{start:number,end:number}>} zones - Current safe zones.
 * @param {{start:number,end:number}} blockedInterval - Interval that should become unavailable.
 * @returns {Array<{start:number,end:number}>} Remaining safe zones.
 */
function subtractBlockedInterval(zones, blockedInterval) {
  return placementSystem.subtractBlockedInterval(zones, blockedInterval);
}

/**
 * Builds a blocked placement interval for an obstacle on a platform.
 *
 * @param {number} blockerX - Obstacle x-position.
 * @param {number} blockerWidth - Obstacle width.
 * @param {number} [occupantWidth=0] - Width of the moving/placed object.
 * @param {number} [padding=0] - Extra safety padding around the blocker.
 * @returns {{start:number,end:number}} Blocked interval in placement-space coordinates.
 */
function createBlockedPlacementInterval(blockerX, blockerWidth, occupantWidth = 0, padding = 0) {
  return placementSystem.createBlockedPlacementInterval(blockerX, blockerWidth, occupantWidth, padding);
}

/**
 * Returns whether a hazard is embedded into the same top lane as a platform pickup.
 *
 * @param {{x:number, y:number, w:number, h:number}} hazard - Hazard descriptor.
 * @param {{x:number, y:number, w:number, h:number}} platform - Platform to inspect.
 * @returns {boolean} True when the hazard blocks pickup placement on that platform lane.
 */
function isHazardOnPickupLane(hazard, platform) {
  return placementSystem.isHazardOnPickupLane(hazard, platform);
}

/**
 * Returns whether a floor hazard occupies the same running lane as a platform-safe player pose.
 *
 * @param {{x:number, y:number, w:number, h:number}} hazard - Hazard descriptor.
 * @param {{x:number, y:number, w:number, h:number}} platform - Platform to inspect.
 * @returns {boolean} True when the hazard should block checkpoint or hurt-pose placement.
 */
function isHazardOnPlayerLane(hazard, platform) {
  return placementSystem.isHazardOnPlayerLane(hazard, platform);
}

/**
 * Returns whether a living bug occupies the same running lane as a platform-safe player pose.
 *
 * @param {{x:number, y:number, w:number, h:number, alive:boolean}} bug - Bug descriptor.
 * @param {{x:number, y:number, w:number, h:number}} platform - Platform to inspect.
 * @returns {boolean} True when the bug should block safe player placement.
 */
function isBugOnPlayerLane(bug, platform) {
  return placementSystem.isBugOnPlayerLane(bug, platform);
}

/**
 * Returns safe horizontal placement zones on a platform after subtracting known blockers.
 *
 * @param {{x:number, y:number, w:number, h:number}} platform - Platform to inspect.
 * @param {object} [options={}] - Placement rule options.
 * @param {number} [options.occupantWidth=0] - Width of the moving or placed object.
 * @param {number} [options.edgePadding=placementSafetyConfig.platformEdgePadding] - Reserved padding near edges.
 * @param {number} [options.minimumZoneWidth=0] - Minimum width a safe zone must keep.
 * @param {Array<{start:number,end:number}>} [options.blockedIntervals=[]] - Precomputed blocked intervals.
 * @returns {Array<{start:number,end:number}>} Safe zones ordered from left to right.
 */
function getPlatformSafeZones(platform, options = {}) {
  return placementSystem.getPlatformSafeZones(platform, options);
}

/**
 * Picks the nearest valid x-position inside a list of safe zones.
 *
 * @param {Array<{start:number,end:number}>} safeZones - Candidate safe zones.
 * @param {number} preferredX - Preferred x-position within placement-space coordinates.
 * @returns {number|null} Best matching safe x-position or null when no safe zone exists.
 */
function pickNearestSafeZoneX(safeZones, preferredX) {
  return placementSystem.pickNearestSafeZoneX(safeZones, preferredX);
}

/**
 * Looks up a pickup definition by type.
 *
 * @param {string} type - Pickup type id.
 * @returns {object|null} Pickup definition or null when unknown.
 */
function getPickupDefinition(type) {
  return pickupSystem.getDefinition(type);
}

/**
 * Creates one collectible pickup entity.
 *
 * @param {string} type - Pickup type id.
 * @param {number} x - World x-position.
 * @param {number} y - World y-position.
 * @param {boolean|object} [options=false] - Telegraph flag or extended pickup creation options.
 * @returns {{type:string, x:number, y:number, r:number, collected:boolean, spawnTimer:number, spawnDuration:number}|null} Pickup entity or null when the type is unknown.
 */
function createPickup(type, x, y, options = false) {
  const normalizedOptions =
    typeof options === "boolean"
      ? { telegraph: options }
      : { ...(options ?? {}) };

  return pickupSystem.createPickup(type, x, y, {
    spawnDuration: specialEventConfig.spawnTelegraphDuration,
    ...normalizedOptions,
  });
}

/**
 * Finds a safe x-position for a collectible pickup on a platform.
 *
 * @param {string} type - Pickup type id.
 * @param {{x:number, y:number, w:number, h:number}} platform - Platform to decorate.
 * @returns {number|null} Safe x-position or null when none exists.
 */
function getSafePickupX(type, platform, options = {}) {
  const definition = getPickupDefinition(type);
  if (!definition) {
    return null;
  }
  const {
    preferredX = platform.x + platform.w / 2,
    randomize = false,
  } = options;

  const blockedIntervals = level.hazards
    .filter((hazard) => isHazardOnPickupLane(hazard, platform))
    .map((hazard) =>
      createBlockedPlacementInterval(hazard.x, hazard.w, 0, placementSafetyConfig.collectibleHazardPadding)
    );
  const safeZones = getPlatformSafeZones(platform, {
    minimumZoneWidth: definition.minimumSafeZoneWidth ?? placementSafetyConfig.gemMinimumZoneWidth,
    blockedIntervals,
  });
  if (safeZones.length === 0) {
    return null;
  }

  if (randomize) {
    const zone = safeZones[randomInt(0, safeZones.length - 1)];
    return randomBetween(zone.start, zone.end);
  }

  // Pickups prefer visually central positions, but still honor carved-out hazard safe zones.
  return pickNearestSafeZoneX(safeZones, preferredX);
}

/**
 * Places a typed pickup on a platform when a safe location exists.
 *
 * @param {{x:number, y:number, w:number, h:number}} platform - Platform to decorate.
 * @param {string} [type=PICKUP_TYPE.CURRENCY] - Pickup type id.
 * @param {boolean} [telegraph=false] - Whether the item should fade and scale in before becoming active.
 */
function addPickupOnPlatform(platform, type = PICKUP_TYPE.CURRENCY, options = false) {
  const normalizedOptions =
    typeof options === "boolean"
      ? { telegraph: options }
      : { ...(options ?? {}) };
  const {
    telegraph = false,
    bypassSpawnGate = false,
    randomizeX = false,
    preferredX = platform.x + platform.w / 2,
    ...pickupMetadata
  } = normalizedOptions;

  if (!pickupSystem.canSpawnOnPlatform(type, platform)) {
    return false;
  }

  if (!bypassSpawnGate && !pickupSystem.shouldSpawnOnPlatform(type, { shouldSpawnIncomeSource })) {
    return false;
  }

  const pickupX = getSafePickupX(type, platform, {
    preferredX,
    randomize: randomizeX,
  });
  if (pickupX === null) {
    return false;
  }

  const pickup = createPickup(type, pickupX, platform.y - 32, {
    telegraph,
    ...pickupMetadata,
  });
  if (!pickup) {
    return false;
  }

  level.pickups.push(pickup);
  return true;
}

/**
 * Places a currency pickup on a platform.
 *
 * @param {{x:number, y:number, w:number, h:number}} platform - Platform to decorate.
 * @param {boolean} [telegraph=false] - Whether the pickup should fade and scale in before becoming active.
 */
function addGemOnPlatform(platform, options = false) {
  const normalizedOptions =
    typeof options === "boolean"
      ? { telegraph: options }
      : { ...(options ?? {}) };
  const pickupType = resolvePlatformPickupType(PICKUP_TYPE.CURRENCY, platform);
  addPickupOnPlatform(platform, pickupType, {
    randomizeX: specialEventSystem.isActive("big-order"),
    ...normalizedOptions,
  });
}

/**
 * Spawns the configured debug pickup either on a visible platform or directly in front of the tiger.
 *
 * @returns {boolean} True when a pickup was spawned.
 */
function spawnDebugPickup() {
  const pickupType = getConfiguredDebugPickupType() ?? PICKUP_TYPE.CURRENCY;
  const definition = getPickupDefinition(pickupType);
  if (!definition) {
    statusMessage = `Debug-Pickup unbekannt: ${pickupType}`;
    return false;
  }

  if (definition.platformSpawnable !== false) {
    const platform = getVisibleDebugPickupPlatform(pickupType);
    const pickupX = platform ? getSafePickupX(pickupType, platform) : null;
    if (platform && pickupX !== null) {
      const pickup = createPickup(pickupType, pickupX, platform.y - 32, {
        telegraph: true,
        triggerEventType: debugConfig.specialEvent.forceType,
      });
      if (pickup) {
        level.pickups.push(pickup);
        statusMessage = `Debug-Pickup gespawnt: ${definition.label}`;
        return true;
      }
    }
  }

  const pickup = createPickup(
    pickupType,
    Math.max(player.x + player.w / 2 + 96, cameraX + 140),
    Math.max(116, player.y - 72),
    {
      telegraph: true,
      triggerEventType: debugConfig.specialEvent.forceType,
    }
  );
  if (!pickup) {
    statusMessage = `Debug-Pickup fehlgeschlagen: ${pickupType}`;
    return false;
  }

  level.pickups.push(pickup);
  statusMessage = `Debug-Pickup gespawnt: ${definition.label}`;
  return true;
}

/**
 * Advances pending spawn telegraphs for pickups and bugs.
 *
 * @param {number} delta - Frame delta in milliseconds.
 */
function updateSpawnTelegraphs(delta) {
  pickupSystem.updateSpawnTimers(level.pickups, delta);

  level.bugs.forEach((bug) => {
    if (bug.spawnTimer > 0) {
      bug.spawnTimer = Math.max(0, bug.spawnTimer - delta);
    }
  });
}

/**
 * Places a bug patrol on a platform when the platform is large enough.
 *
 * @param {{x:number, y:number, w:number, h:number}} platform - Platform to decorate.
 * @param {boolean} [telegraph=false] - Whether the bug should fade and scale in before becoming active.
 */
function addBugOnPlatform(platform, telegraph = false) {
  if (platform.w < 120) {
    return;
  }

  const patrolMargin = 18;
  const bugX = clamp(platform.x + platform.w * 0.5 - 23, platform.x + patrolMargin, platform.x + platform.w - 46 - patrolMargin);
  const speed = (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.8, 1.5);
  level.bugs.push(
    createBug(bugX, platform.y - 38, platform.x + patrolMargin, platform.x + platform.w - patrolMargin, speed, {
      telegraph,
    })
  );
}

/**
 * Generates one endless-run chunk ahead of the player, including optional hazards and bonuses.
 */
function generateChunk() {
  // Endless terrain is generated one chunk ahead of the camera at a time.
  const chunkRules = getChunkGenerationRules();
  const gapWidth = randomInt(78, 122);
  const x = level.nextChunkX + gapWidth;
  const width = randomInt(180, 340);
  const groundY = clamp(level.lastGroundY + randomInt(-18, 18), world.floorYMin, world.floorYMax);
  const ground = createPlatform(x, groundY, width, canvas.height - groundY, "ground");
  level.platforms.push(ground);

  let groundHasHazard = false;
  if (Math.random() < 0.48) {
    addGroundHazard(ground);
    groundHasHazard = true;
  }
  if (shouldRollPickupSpawn(chunkRules.groundGemChance)) {
    addGemOnPlatform(ground);
  }
  if (shouldRollBugSpawn(chunkRules.groundBugChance)) {
    addBugOnPlatform(ground);
  }

  if (Math.random() < 0.58) {
    commitChunkFeatureAttempt(() => {
      const plateWidth = randomInt(96, 170);
      const plateX = x + randomInt(10, Math.max(12, width - plateWidth - 12));
      const plateY = groundY - randomInt(82, 156);
      const plate = createPlatform(plateX, plateY, plateWidth, 18, "plate");
      let chunkGroundHasHazard = groundHasHazard;

      if (platformCollides(plate, 10) || isTooCloseToGround(plate, groundY)) {
        return false;
      }

      const tooHighFromGround = groundY - plateY > 124;
      let shouldPlacePlate = true;
      if (tooHighFromGround) {
        const hasStep = ensureStepPlatform(plate, groundY);
        if (!hasStep && chunkGroundHasHazard) {
          removeHazardsUnderSpan(plate.x - 18, plate.x + plate.w + 18);
          chunkGroundHasHazard = false;
        }
        shouldPlacePlate = hasStep;
      } else if (chunkGroundHasHazard) {
        const overlapsHazardLane = level.hazards.some(
          (hazard) => hazard.x < plate.x + plate.w && hazard.x + hazard.w > plate.x
        );
        if (overlapsHazardLane && plateY < groundY - 90) {
          removeHazardsUnderSpan(plate.x - 18, plate.x + plate.w + 18);
          chunkGroundHasHazard = false;
        }
      }
      if (shouldPlacePlate && !hasReachableApproach(plate, ground)) {
        shouldPlacePlate = false;
      }
      if (!shouldPlacePlate) {
        return false;
      }

      level.platforms.push(plate);

      if (shouldRollPickupSpawn(chunkRules.plateGemChance)) {
        addGemOnPlatform(plate);
        if (shouldRollPickupSpawn(chunkRules.plateExtraGemChance)) {
          addGemOnPlatform(plate);
        }
      }
      if (shouldRollBugSpawn(chunkRules.plateBugChance)) {
        addBugOnPlatform(plate);
      }

      return true;
    });
  }

  if (Math.random() < chunkRules.bonusPlatformChance) {
    commitChunkFeatureAttempt(() => {
      const bonusWidth = randomInt(82, 130);
      const bonusX = x + width + randomInt(26, 80);
      const bonusY = clamp(groundY - randomInt(96, 152), 240, 390);
      const bonus = createPlatform(bonusX, bonusY, bonusWidth, 18, "plate");

      if (platformCollides(bonus, 10) || isTooCloseToGround(bonus, groundY)) {
        return false;
      }

      const tooHighFromGround = groundY - bonusY > 124;
      let shouldPlaceBonus = true;
      if (tooHighFromGround) {
        const hasStep = ensureStepPlatform(bonus, groundY);
        if (!hasStep) {
          removeHazardsUnderSpan(bonus.x - 18, bonus.x + bonus.w + 18);
          shouldPlaceBonus = false;
        }
      }
      if (shouldPlaceBonus && !hasReachableApproach(bonus, ground)) {
        shouldPlaceBonus = false;
      }
      if (!shouldPlaceBonus) {
        return false;
      }

      level.platforms.push(bonus);
      addGemOnPlatform(bonus);
      if (shouldRollPickupSpawn(chunkRules.bonusExtraGemChance)) {
        addGemOnPlatform(bonus);
      }
      if (shouldRollBugSpawn(chunkRules.bonusBugChance)) {
        addBugOnPlatform(bonus);
      }

      return true;
    });
  }

  level.nextChunkX = x + width;
  level.lastGroundY = groundY;
}

/**
 * Generates chunks until the world extends beyond a target x-position.
 *
 * @param {number} targetX - World x-position that must be covered.
 */
function generateUntil(targetX) {
  while (level.nextChunkX < targetX) {
    generateChunk();
  }
}

/**
 * Removes far-behind world entities that can no longer affect the current run.
 */
function cleanupWorld() {
  const cutoffX = cameraX - 900;
  level.platforms = level.platforms.filter((platform) => platform.x + platform.w > cutoffX);
  level.hazards = level.hazards.filter((hazard) => hazard.x + hazard.w > cutoffX);
  // Collected pickups and defeated bugs should leave the active world immediately; historical run state lives elsewhere.
  level.pickups = level.pickups.filter((pickup) => !pickup.collected && pickup.x + pickup.r > cutoffX);
  level.bugs.forEach((bug) => {
    if (bug.alive && bug.x + bug.w <= cutoffX) {
      markBugMissed(bug);
    }
  });
  level.bugs = level.bugs.filter((bug) => bug.alive && bug.x + bug.w > cutoffX);
  level.rockets = level.rockets.filter(
    (rocket) => rocket.active && rocket.x + rocket.w > cutoffX && rocket.x < cameraX + canvas.width + 900
  );
}

/**
 * Resets the player either to the latest checkpoint or to a brand-new run.
 *
 * @param {boolean} [fullReset=false] - Whether to fully restart the world and score state.
 */
function resetPlayer(fullReset = false) {
  resetDirectionalInputState();

  if (fullReset) {
    resetSpecialEventState();
    resetBugLifecycle();
    initLevel();
    player.lives = 3;
    runState.currencyCents = 0;
    runState.actionScore = 0;
    runState.progressScore = 0;
    runState.farthestX = level.spawn.x;
    applyDebugRunBootstrap();
    player.checkpointX = level.spawn.x;
    player.checkpointY = level.spawn.y;
    gameState = "playing";
    pauseReason = null;
    activeHudInfo = null;
    cameraX = 0;
    worldTimeMs = 0;
    rocketSpawnTimer = getDebugAdjustedDelay(framesToMs(700 + randomInt(0, 320)), 1, framesToMs(350));
    resumeCountdownTimer = 0;
    statusMessage = isDebugModeEnabled() ? "Debug-Run gestartet" : "Endloslauf gestartet";
  }

  // A full reset rebuilds the world; a partial reset only restores the latest safe checkpoint.
  player.x = player.checkpointX;
  player.y = player.checkpointY;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.direction = 1;
  player.invincible = 0;
  player.hurtTimer = 0;
  player.pendingRespawn = false;
  player.forceInjuredPose = false;
  player.respawnVisual = "injured";
  player.visible = true;
}

/**
 * Performs an axis-aligned rectangle overlap test.
 *
 * @param {{x:number, y:number, w:number, h:number}} a - First rectangle.
 * @param {{x:number, y:number, w:number, h:number}} b - Second rectangle.
 * @returns {boolean} True when the rectangles overlap.
 */
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * Checks collision between a circle and an axis-aligned rectangle.
 *
 * @param {{x:number, y:number, r:number}} circle - Circle descriptor.
 * @param {{x:number, y:number, w:number, h:number}} rect - Rectangle descriptor.
 * @returns {boolean} True when the circle intersects the rectangle.
 */
function circleRectCollision(circle, rect) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.r * circle.r;
}

/**
 * Checks whether the tiger's center band intersects a spike hazard.
 *
 * @param {{x:number, y:number, w:number, h:number}} hazard - Hazard rectangle.
 * @returns {boolean} True when the player's center band touches the hazard span.
 */
function hitsHazardWithPlayerCenter(hazard) {
  return respawnHelpers.hitsHazardWithPlayerCenter(hazard);
}

/**
 * Computes a safe checkpoint x-position on a ground platform.
 *
 * @param {{x:number, y:number, w:number, h:number}} platform - Ground platform used as checkpoint source.
 * @returns {number} Safe checkpoint x-position.
 */
function getSafeCheckpointX(platform) {
  return respawnHelpers.getSafeCheckpointX(platform);
}

/**
 * Finds the closest supporting platform under the player at a given x-position.
 *
 * @param {number} playerX - Candidate player x-position.
 * @param {number} preferredY - Preferred player y-position.
 * @returns {{x:number, y:number, w:number, h:number, kind:string}|null} Supporting platform or null when unsupported.
 */
function getSupportingPlatformAt(playerX, preferredY) {
  return respawnHelpers.getSupportingPlatformAt(playerX, preferredY);
}

/**
 * Computes a safe hurt-pose x-position on a platform while avoiding hazards and living bugs.
 *
 * @param {{x:number, y:number, w:number, h:number}} platform - Supporting platform.
 * @param {number} preferredX - Preferred player x-position.
 * @returns {number} Safe player x-position on the platform.
 */
function getSafePlatformPoseX(platform, preferredX) {
  return respawnHelpers.getSafePlatformPoseX(platform, preferredX);
}

/**
 * Moves a hurt pose onto stable ground while preserving the intended impact location as much as possible.
 *
 * @param {number} preferredX - Preferred hurt x-position.
 * @param {number} preferredY - Preferred hurt y-position.
 * @returns {{x:number, y:number}} Safe pose position.
 */
function moveToSafeInjuredPose(preferredX, preferredY) {
  return respawnHelpers.moveToSafeInjuredPose(preferredX, preferredY);
}

/**
 * Advances the active checkpoint when the player reaches a suitable ground segment.
 *
 * @param {{x:number, y:number, w:number, h:number, kind:string}} platform - Ground platform currently supporting the player.
 */
function updateCheckpoint(platform) {
  if (platform.kind !== "ground") {
    return;
  }

  // Only move the checkpoint once the player has clearly progressed across the current chunk.
  if (player.x > player.checkpointX + 80) {
    player.checkpointX = getSafeCheckpointX(platform);
    player.checkpointY = platform.y - player.h;
  }
}

/**
 * Advances the simulation for player movement, collisions, pickups, enemies and camera tracking.
 *
 * @param {number} delta - Frame delta in milliseconds.
 */
function handleMovement(delta) {
  if (gameState !== "playing" || isPortraitMobileView() || player.hurtTimer > 0 || resumeCountdownTimer > 0) {
    return;
  }

  // Keep enough world generated ahead of the player so the endless run never exposes seams.
  generateUntil(cameraX + canvas.width * 3);

  level.clouds.forEach((cloud) => {
    if (cloud.vx > 0) {
      cloud.vx = -cloud.vx;
    }
    cloud.x += cloud.vx;
  });
  const cloudViewportLeft = cameraX * CLOUD_PARALLAX;
  const cloudViewportRight = cloudViewportLeft + canvas.width;
  const minRespawnX = cloudViewportRight - canvas.width * 0.35;
  let rightmostCloudEdge = level.clouds.reduce(
    (maxEdge, cloud) => Math.max(maxEdge, cloud.x + cloud.w),
    minRespawnX,
  );
  [...level.clouds]
    .sort((a, b) => a.x - b.x)
    .forEach((cloud) => {
      if (cloud.x + cloud.w < cloudViewportLeft - 40) {
        const spawnX = Math.max(
          minRespawnX,
          rightmostCloudEdge + randomInt(CLOUD_RESPAWN_MIN_GAP, CLOUD_RESPAWN_MAX_GAP),
        );
        resetCloud(cloud, spawnX);
        rightmostCloudEdge = cloud.x + cloud.w;
      }
    });

  rocketSpawnTimer = Math.max(0, rocketSpawnTimer - delta);
  if (rocketSpawnTimer <= 0) {
    level.rockets.push(createRocket(Math.random() > 0.5));
    rocketSpawnTimer = getNextRocketSpawnDelay();
  }

  // Normalise all frame-rate-dependent physics to the 60 Hz reference so that
  // the game plays identically on 90 Hz / 120 Hz / 144 Hz displays.
  const physicsScale = Math.min(delta / FRAME_DURATION_MS, 2);

  if (keys.left) {
    player.vx -= player.speed * physicsScale;
    player.direction = -1;
  }
  if (keys.right) {
    player.vx += player.speed * physicsScale;
    player.direction = 1;
  }
  if (!keys.left && !keys.right) {
    player.vx *= Math.pow(0.82, physicsScale);
  }

  player.vx = Math.max(-player.maxSpeed, Math.min(player.maxSpeed, player.vx));
  player.vy += world.gravity * physicsScale;

  const previousY = player.y;
  player.x += player.vx * physicsScale;
  player.y += player.vy * physicsScale;
  player.grounded = false;

  level.platforms.forEach((platform) => {
    if (!overlaps(player, platform)) {
      return;
    }

    const cameFromAbove = previousY + player.h <= platform.y + 8 && player.vy >= 0;
    if (cameFromAbove) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
      // Reset the jump counter when the tiger lands so the next airborne
      // sequence starts fresh and double-jump is available again.
      player.jumpsUsed = 0;
      updateCheckpoint(platform);
      return;
    }

    const cameFromBelow = previousY >= platform.y + platform.h - 8 && player.vy < 0;
    if (cameFromBelow) {
      player.y = platform.y + platform.h;
      player.vy = Math.max(1.5, Math.abs(player.vy) * 0.2);
      return;
    }

    if (player.x + player.w / 2 < platform.x + platform.w / 2) {
      player.x = platform.x - player.w;
    } else {
      player.x = platform.x + platform.w;
    }
    player.vx *= -0.2;
  });

  player.x = Math.max(0, player.x);
  runState.farthestX = Math.max(runState.farthestX, player.x);
  syncProgressScore();

  if (player.y > canvas.height + 180) {
    loseLife("Der Tiger ist in einen Krater gestürzt", {
      showInjured: true,
      holdPosition: false,
      respawnVisual: "attention",
    });
  }

  player.invincible = Math.max(0, player.invincible - delta);

  level.hazards.forEach((hazard) => {
    if (player.invincible > 0) {
      return;
    }
    if (hitsHazardWithPlayerCenter(hazard)) {
      const safePose = moveToSafeInjuredPose(player.x, hazard.y + hazard.h - player.h + 10);
      loseLife("Autsch, scharfe Lavasteine", {
        showInjured: true,
        holdPosition: true,
        hitX: safePose.x,
        hitY: safePose.y,
      });
    }
  });

  level.pickups.forEach((pickup) => {
    if (pickup.collected || pickup.spawnTimer > 0) {
      return;
    }
    if (circleRectCollision(pickup, player)) {
      collectPickup(pickup);
    }
  });

  let stompedAnyBug = false;

  level.bugs.forEach((bug) => {
    if (!bug.alive || bug.spawnTimer > 0) {
      return;
    }

    if (bug.falling) {
      bug.vy = Math.min(4.75, bug.vy + world.gravity * 0.21 * physicsScale);
      bug.y += bug.vy * physicsScale;

      if (bug.y >= bug.targetGroundY) {
        bug.y = bug.targetGroundY;
        bug.falling = false;
        bug.vy = 0;
        bug.minX = bug.targetPlatformMinX;
        bug.maxX = bug.targetPlatformMaxX;
        bug.vx = (Math.random() > 0.5 ? 1 : -1) * randomBetween(0.9, 1.6);
      }
    } else {
      bug.x += bug.vx * physicsScale;
      if (bug.x <= bug.minX || bug.x + bug.w >= bug.maxX) {
        bug.vx *= -1;
        bug.x = clamp(bug.x, bug.minX, bug.maxX - bug.w);
      }
    }

    if (!overlaps(player, bug)) {
      return;
    }

    if (bug.falling) {
      if (player.invincible <= 0) {
        const safePose = moveToSafeInjuredPose(player.x, player.y);
        loseLife("Ein fallender Bug hat den Tiger erwischt", {
          showInjured: true,
          holdPosition: true,
          hitX: safePose.x,
          hitY: safePose.y,
        });
      }
      return;
    }

    const stomped = player.vy > 1 && previousY + player.h <= bug.y + 14;
    if (stomped) {
      bug.alive = false;
      markBugResolved(bug);
      const scoreEffect = createHitEffect(bug.x + bug.w / 2, bug.y + 6, "⭐");
      spawnHudEmoji(scoreEffect.x, scoreEffect.y, scoreEffect.emoji, "score");
      runState.actionScore += scoreConfig.bugDefeat;
      stompedAnyBug = true;
      return;
    }

    if (stompedAnyBug) {
      return;
    }

    if (player.invincible <= 0) {
      const safePose = moveToSafeInjuredPose(player.x, player.y);
      loseLife("Ein Bug hat den Tiger erwischt", {
        showInjured: true,
        holdPosition: true,
        hitX: safePose.x,
        hitY: safePose.y,
      });
    }
  });

  if (stompedAnyBug) {
    player.vy = -8.5;
    statusMessage = "Bug besiegt. Punkte eingesackt";
  }

  level.rockets.forEach((rocket) => {
    if (!rocket.active) {
      return;
    }

    rocket.x += rocket.vx * physicsScale;
    if (overlaps(player, rocket)) {
      rocket.active = false;
      applyPickupEffect(PICKUP_TYPE.EXTRA_LIFE, rocket);
    }
  });
  level.rockets = level.rockets.filter((rocket) => rocket.active);

  cameraX = Math.max(0, player.x - canvas.width * 0.35);
  cleanupWorld();
  syncHighScore();
}

/**
 * Advances the running animation when the tiger is moving on the ground.
 *
 * @param {number} delta - Frame delta in milliseconds.
 */
function updateAnimation(delta) {
  const movingOnGround = player.grounded && Math.abs(player.vx) > 0.35;

  if (!movingOnGround) {
    runFrameIndex = 0;
    runFrameTimer = 0;
    return;
  }

  runFrameTimer += delta;
  if (runFrameTimer >= 90) {
    runFrameTimer = 0;
    runFrameIndex = (runFrameIndex + 1) % sprites.run.length;
  }
}

/**
 * Applies damage, transitions into hurt/game-over states and schedules respawn behavior.
 *
 * @param {string} message - Status message describing the damage source.
 * @param {object} [options={}] - Additional damage options.
 * @param {boolean} [options.showInjured=false] - Whether to enter the injured state.
 * @param {boolean} [options.holdPosition=false] - Whether to keep the current pose at the impact point.
 * @param {number} [options.hitX=player.x] - Impact x-position for hurt poses.
 * @param {number} [options.hitY=player.y] - Impact y-position for hurt poses.
 * @param {"injured"|"attention"} [options.respawnVisual="injured"] - Respawn visual style to show during countdown.
 */
function loseLife(message, options = {}) {
  const {
    showInjured = false,
    holdPosition = false,
    hitX = player.x,
    hitY = player.y,
    respawnVisual = "injured",
  } = options;
  const injuredPose =
    showInjured && respawnVisual === "injured"
      ? moveToSafeInjuredPose(hitX, hitY)
      : { x: hitX, y: hitY };

  player.lives -= 1;
  player.invincible = showInjured ? framesToMs(135) : framesToMs(75);
  player.hurtTimer = showInjured ? 3000 : 0;
  player.pendingRespawn = showInjured;
  player.forceInjuredPose = showInjured;
  player.respawnVisual = respawnVisual;

  if (showInjured) {
    resetDirectionalInputState();
  }

  // Game over freezes the last pose on screen; otherwise we enter a delayed respawn state.
  if (player.lives <= 0) {
    gameState = "lost";
    saveHighScore(getTotalScore());
    statusMessage = "Game over. Drücke R für einen Neustart";
    if (showInjured && (holdPosition || respawnVisual === "injured")) {
      player.x = injuredPose.x;
      player.y = injuredPose.y;
      player.grounded = true;
    }
    player.vx = 0;
    player.vy = 0;
    return;
  }

  statusMessage = message;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;

  if (showInjured && (holdPosition || respawnVisual === "injured")) {
    player.x = injuredPose.x;
    player.y = injuredPose.y;
    player.grounded = true;
    return;
  }

  if (showInjured) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  player.pendingRespawn = false;
  player.forceInjuredPose = false;
  player.respawnVisual = "injured";
  player.x = player.checkpointX;
  player.y = player.checkpointY;
}

/**
 * Draws the layered background sky, dunes, stars and clouds.
 */
function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#271339");
  sky.addColorStop(0.45, "#813954");
  sky.addColorStop(1, "#cf6c45");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Sun glow is a fixed atmospheric overlay drawn in canvas space so it is
  // always visible regardless of how far the player has run.
  ctx.fillStyle = "rgba(255, 220, 170, 0.18)";
  ctx.beginPath();
  ctx.arc(740, 112, 68, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(-cameraX * CLOUD_PARALLAX, 0);

  // Tiling sand ridges – the pattern repeats every `ridgeSpacing` pixels so
  // ridges are always present no matter how far the player has run.
  const parallaxLeft = Math.floor(cameraX * CLOUD_PARALLAX);
  const ridgeSpacing = 300;
  const firstRidgeIndex = Math.floor(parallaxLeft / ridgeSpacing) - 1;
  const numRidgesVisible = Math.ceil(canvas.width / ridgeSpacing) + 3;
  ctx.fillStyle = "rgba(255, 168, 106, 0.15)";
  for (let j = firstRidgeIndex; j < firstRidgeIndex + numRidgesVisible; j += 1) {
    const ridgeX = j * ridgeSpacing;
    const ridgeY = 405 + (((j % 3) + 3) % 3) * 18;
    const ridgeW = 220 + (((j % 4) + 4) % 4) * 30;
    ctx.beginPath();
    ctx.moveTo(ridgeX, canvas.height);
    ctx.quadraticCurveTo(ridgeX + ridgeW * 0.45, ridgeY, ridgeX + ridgeW, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  // Tiling stars – computed relative to the current parallax viewport so they
  // tile infinitely and never disappear on long runs.
  const starSpacing = 130;
  const starBaseX = 120;
  const firstStarIndex = Math.floor((parallaxLeft - starBaseX) / starSpacing) - 1;
  const numStarsVisible = Math.ceil(canvas.width / starSpacing) + 3;
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  for (let j = firstStarIndex; j < firstStarIndex + numStarsVisible; j += 1) {
    const starX = starBaseX + j * starSpacing;
    const starY = 70 + (((j % 4) + 4) % 4) * 30;
    ctx.fillRect(starX, starY, 2, 2);
  }

  level.clouds.forEach((cloud) => {
    const x = cloud.x;
    const y = cloud.y;
    ctx.fillStyle = "rgba(255, 244, 234, 0.11)";
    ctx.beginPath();
    ctx.ellipse(x, y, cloud.w * 0.28, cloud.h * 0.34, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.2, y - cloud.h * 0.18, cloud.w * 0.24, cloud.h * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.42, y, cloud.w * 0.3, cloud.h * 0.38, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloud.w * 0.62, y + cloud.h * 0.04, cloud.w * 0.22, cloud.h * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/**
 * Draws a single platform segment.
 *
 * @param {{x:number, y:number, w:number, h:number, kind:string}} platform - Platform to render.
 */
function drawPlatform(platform) {
  const x = platform.x - cameraX;
  const gradient = ctx.createLinearGradient(x, platform.y, x, platform.y + platform.h);
  gradient.addColorStop(0, platform.kind === "ground" ? "#e07b48" : "#f2a35c");
  gradient.addColorStop(1, platform.kind === "ground" ? "#7e3720" : "#8e4723");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, platform.y, platform.w, platform.h);

  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(x, platform.y, platform.w, 6);
}

/**
 * Draws a spike hazard.
 *
 * @param {{x:number, y:number, w:number, h:number}} hazard - Hazard to render.
 */
function drawHazard(hazard) {
  const hazardState = getHazardState(hazard);
  const x = hazard.x - cameraX;
  const slotY = hazardState.baseY - 4;
  ctx.fillStyle = "rgba(74, 25, 15, 0.42)";
  ctx.beginPath();
  ctx.roundRect(x - 2, slotY, hazard.w + 4, 6, 3);
  ctx.fill();

  if (hazardState.height <= 0.5) {
    return;
  }

  const topY = hazardState.top;
  ctx.fillStyle = "#4c170f";
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + i * (hazard.w / 4), hazardState.baseY);
    ctx.lineTo(x + i * (hazard.w / 4) + hazard.w / 8, topY);
    ctx.lineTo(x + i * (hazard.w / 4) + hazard.w / 4, hazardState.baseY);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Returns the current alpha and scale for a spawning entity preview.
 *
 * @param {number} timer - Remaining telegraph time in milliseconds.
 * @param {number} duration - Total telegraph time in milliseconds.
 * @param {number} time - Current animation timestamp.
 * @returns {{alpha:number, scale:number}} Preview opacity and scale.
 */
function getSpawnPreviewState(timer, duration, time) {
  const progress = 1 - clamp(timer / Math.max(1, duration), 0, 1);
  const pulse = 1 + Math.sin(time / 95) * 0.08;
  return {
    alpha: 0.2 + progress * 0.8,
    scale: (0.45 + progress * 0.55) * pulse,
  };
}

function drawPickupGlyph(renderModel, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = renderModel.fillStyle ?? "#ffe37a";
  ctx.strokeStyle = renderModel.strokeStyle ?? "#9a6a00";
  ctx.lineWidth = renderModel.lineWidth ?? 2.5;
  ctx.font = renderModel.font ?? "700 42px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (renderModel.strokeStyle) {
    ctx.strokeText(renderModel.glyph, 0, 0);
  }
  ctx.fillText(renderModel.glyph, 0, 0);
  ctx.restore();
}

/**
 * Draws one typed pickup using its definition-driven render model.
 *
 * @param {{type:string, x:number, y:number, r:number, collected:boolean, spawnTimer:number, spawnDuration:number}} pickup - Pickup to render.
 * @param {number} time - Current animation timestamp.
 */
function drawPickup(pickup, time) {
  if (pickup.collected) {
    return;
  }

  const definition = getPickupDefinition(pickup.type);
  if (!definition) {
    return;
  }

  const renderModel = pickupSystem.getRenderModel(pickup.type, pickup) ?? {
    glyph: definition.render?.glyph ?? definition.emoji ?? "?",
    fillStyle: definition.render?.fillStyle,
    strokeStyle: definition.render?.strokeStyle,
    lineWidth: definition.render?.lineWidth,
    font: definition.render?.font,
    scale: 1,
  };
  const x = pickup.x - cameraX;
  const renderScale = renderModel.scale ?? 1;

  if (pickup.spawnTimer > 0) {
    const preview = getSpawnPreviewState(pickup.spawnTimer, pickup.spawnDuration, time);
    ctx.save();
    ctx.globalAlpha = preview.alpha;
    ctx.translate(x, pickup.y);
    ctx.scale(preview.scale * renderScale, preview.scale * renderScale);
    drawPickupGlyph(renderModel, 0, 0);
    ctx.restore();
    return;
  }

  const bobAmplitude = definition.render?.bobAmplitude ?? 4;
  const bobTimeDivisor = definition.render?.bobTimeDivisor ?? 180;
  const worldPhaseScale = definition.render?.worldPhaseScale ?? 0.01;
  const bob = Math.sin(time / bobTimeDivisor + pickup.x * worldPhaseScale) * bobAmplitude;
  const y = pickup.y + bob;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(renderScale, renderScale);
  drawPickupGlyph(renderModel, 0, 0);
  ctx.restore();
}

/**
 * Draws a bug enemy with a subtle idle bob.
 *
 * @param {{x:number, y:number, w:number, h:number, vx:number, alive:boolean}} bug - Enemy to render.
 * @param {number} time - Current animation timestamp.
 */
function drawBug(bug, time) {
  if (!bug.alive) {
    return;
  }

  if (bug.spawnTimer > 0) {
    const preview = getSpawnPreviewState(bug.spawnTimer, bug.spawnDuration, time);
    const x = (bug.spawnMarkerX ?? bug.x + bug.w / 2) - cameraX;
    const y = bug.spawnMarkerY ?? bug.y + bug.h / 2;
    const facing = bug.vx < 0 ? 1 : -1;

    ctx.save();
    ctx.globalAlpha = preview.alpha;
    ctx.translate(x, y + bug.h / 2);
    ctx.scale(facing * preview.scale, preview.scale);
    ctx.translate(-bug.w / 2, -bug.h / 2);

    if (sprites.bug.complete) {
      ctx.drawImage(sprites.bug, -10, -14, 66, 52);
    } else {
      ctx.fillStyle = "#5d1f14";
      ctx.fillRect(0, 0, bug.w, bug.h);
    }

    ctx.restore();
    return;
  }

  const x = bug.x - cameraX;
  const y = bug.falling ? bug.y : bug.y + Math.sin(time / 170 + bug.x * 0.03) * 1.5;
  const facing = bug.vx < 0 ? 1 : -1;

  ctx.save();
  ctx.translate(x + bug.w / 2, y + bug.h);
  ctx.scale(facing, 1);
  ctx.translate(-bug.w / 2, -bug.h);

  if (sprites.bug.complete) {
    ctx.drawImage(sprites.bug, -10, -14, 66, 52);
  } else {
    ctx.fillStyle = "#5d1f14";
    ctx.fillRect(0, 0, bug.w, bug.h);
  }

  ctx.restore();
}

/**
 * Draws a bonus rocket.
 *
 * @param {{x:number, y:number, w:number, h:number, fromLeft:boolean}} rocket - Rocket to render.
 */
function drawRocket(rocket) {
  const x = rocket.x - cameraX;
  const sprite = rocket.fromLeft ? sprites.rocketFromLeft : sprites.rocketFromRight;

  if (sprite.complete) {
    ctx.drawImage(sprite, x, rocket.y, rocket.w, rocket.h);
    return;
  }

  ctx.fillStyle = "#d8ddd9";
  ctx.fillRect(x, rocket.y, rocket.w, rocket.h);
}

/**
 * Draws the player character using the current movement or hurt pose.
 */
function drawTiger() {
  if (!player.visible) {
    return;
  }

  // Pit falls use a dedicated billboard graphic instead of drawing the tiger sprite at all.
  if (player.hurtTimer > 0 && player.respawnVisual === "attention" && gameState === "playing") {
    return;
  }

  const x = player.x - cameraX;
  const blink =
    player.invincible > 0 &&
    Math.floor(player.invincible / INVINCIBILITY_BLINK_INTERVAL_MS) % 2 === 0;

  if (blink) {
    return;
  }

  ctx.save();
  ctx.translate(x + player.w / 2, player.y + player.h);
  ctx.scale(player.direction, 1);
  ctx.translate(-player.w / 2, -player.h);

  let sprite = sprites.run[runFrameIndex];
  if (player.hurtTimer > 0 || player.forceInjuredPose) {
    sprite = sprites.injured;
  } else if (!player.grounded) {
    sprite = player.vy < 0 ? sprites.jumpUp : sprites.jumpDown;
  } else if (Math.abs(player.vx) <= 0.35) {
    sprite = sprites.standing;
  }

  if (sprite && sprite.complete) {
    ctx.drawImage(sprite, -36, player.h - 166, 126, 166);
  } else {
    ctx.fillStyle = "#d8732c";
    ctx.beginPath();
    ctx.arc(27, 27, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draws the special pit-fall respawn billboard graphic during countdowns.
 */
function drawRespawnAttention() {
  if (player.hurtTimer <= 0 || player.respawnVisual !== "attention" || gameState !== "playing" || player.lives <= 0) {
    return;
  }

  if (!sprites.attentionPlease.complete) {
    return;
  }

  const maxWidth = 325;
  const aspectRatio =
    sprites.attentionPlease.naturalWidth > 0
      ? sprites.attentionPlease.naturalHeight / sprites.attentionPlease.naturalWidth
      : 1;
  const drawWidth = maxWidth;
  const drawHeight = drawWidth * aspectRatio;
  const drawX = canvas.width - drawWidth - 18;
  const drawY = canvas.height - drawHeight - 18;
  ctx.drawImage(sprites.attentionPlease, drawX, drawY, drawWidth, drawHeight);
}

/**
 * Draws the top HUD bar, tooltip overlays and in-canvas touch controls.
 */
function drawHud() {
  const stats = getHudStats();
  const leftActive = keys.left;
  const rightActive = keys.right;

  ctx.save();
  ctx.font = "700 18px Trebuchet MS";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const panel = mobileHud.topBar;
  ctx.fillStyle = "rgba(14, 10, 18, 0.54)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(panel.x, panel.y, panel.w, panel.h);
  ctx.fill();
  ctx.stroke();

  stats.forEach((stat) => {
    ctx.fillStyle = stat.accent;
    ctx.font = `700 19px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText(stat.emoji, stat.sectionX, 24);
    ctx.font = "700 24px Trebuchet MS";
    ctx.fillText(String(stat.value), stat.valueX, 23);
  });

  [192, 384, 576, 768].forEach((x) => {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x, 40);
    ctx.stroke();
  });

  if (activeHudInfo) {
    // Tooltips are rendered inside the canvas so the game stays fully self-contained.
    const stat = stats.find((entry) => entry.key === activeHudInfo);
    if (stat) {
      ctx.font = "14px Trebuchet MS";
      const wrappedLines = stat.tooltip.flatMap((line) => wrapTextLines(line, stat.key === "score" ? 222 : 192));
      const tooltipWidth = stat.key === "score" ? 250 : 220;
      const tooltipX = clamp(stat.sectionX - 6, 18, canvas.width - tooltipWidth - 18);
      const tooltipY = panel.y + panel.h + 8;
      const tooltipHeight = 46 + wrappedLines.length * 22;

      ctx.fillStyle = "rgba(18, 12, 24, 0.96)";
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#fff0e0";
      ctx.font = "700 15px Trebuchet MS";
      ctx.fillText(`${stat.emoji} ${stat.label}`, tooltipX + 14, tooltipY + 22);
      ctx.font = "14px Trebuchet MS";
      wrappedLines.forEach((line, index) => {
        ctx.fillText(line, tooltipX + 14, tooltipY + 50 + index * 22);
      });
    }
  }

  if (shouldShowUpdatePrompt()) {
    const cardX = canvas.width - 286;
    const cardY = panel.y + panel.h + 10;
    const cardW = 268;
    const cardH = 136;
    const buttonW = 128;
    const buttonH = 34;
    const buttonX = cardX + 16;
    const buttonY = cardY + cardH - buttonH - 14;

    ctx.fillStyle = "rgba(24, 17, 31, 0.95)";
    ctx.strokeStyle = "rgba(255, 241, 220, 0.2)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fff4e5";
    ctx.font = "700 17px Trebuchet MS";
    ctx.fillText("Update verfügbar", cardX + 16, cardY + 22);

    ctx.fillStyle = "#ffd5b3";
    ctx.font = "15px Trebuchet MS";
    ctx.fillText("Neue Version ist bereit.", cardX + 16, cardY + 48);
    ctx.fillText("Tippe unten auf Update.", cardX + 16, cardY + 64);

    updateButtonRect = { x: buttonX, y: buttonY, w: buttonW, h: buttonH };
    ctx.fillStyle = "rgba(255, 214, 156, 0.94)";
    ctx.strokeStyle = "rgba(255, 246, 232, 0.78)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(buttonX, buttonY, buttonW, buttonH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#4c2412";
    ctx.font = "700 18px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText("Update", buttonX + buttonW / 2, buttonY + 19);
    ctx.textAlign = "left";
  } else {
    updateButtonRect = null;
  }

  const jumpActive = jumpButtonGlow > 0;

  const drawControl = (circle, active, accent, kind) => {
    const glowAlpha = active ? 0.16 : 0.06;
    const radiusBoost = active ? 8 : 0;

    ctx.fillStyle = `rgba(255, 255, 255, ${glowAlpha})`;
    ctx.beginPath();
    ctx.arc(circle.cx, circle.cy, circle.r + radiusBoost, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = active ? accent : "rgba(255, 255, 255, 0.24)";
    ctx.strokeStyle = active ? "rgba(255, 255, 255, 0.48)" : "rgba(255, 255, 255, 0.24)";
    ctx.lineWidth = active ? 4 : 3;
    ctx.beginPath();
    ctx.arc(circle.cx, circle.cy, circle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = active ? "#5a2a12" : "rgba(72, 36, 18, 0.72)";
    if (kind === "jump") {
      ctx.font = "700 42px Trebuchet MS";
      ctx.textAlign = "center";
      ctx.fillText("▲", circle.cx, circle.cy + 2);
      ctx.textAlign = "left";
      return;
    }

    const direction = kind === "left" ? 1 : -1;
    ctx.save();
    ctx.translate(circle.cx, circle.cy);
    ctx.scale(direction, 1);
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(10, -16);
    ctx.lineTo(10, 16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  if (isTouchDevice && gameState !== "lost") {
    drawControl(mobileHud.leftPad, leftActive, "rgba(255, 255, 255, 0.36)", "left");
    drawControl(mobileHud.rightPad, rightActive, "rgba(255, 255, 255, 0.36)", "right");
    drawControl(mobileHud.jumpPad, jumpActive, "rgba(255, 255, 255, 0.42)", "jump");
  }

  ctx.restore();
}

/**
 * Draws the lightweight in-canvas debug panel used for balancing and content testing.
 */
function drawDebugPanel() {
  if (!isDebugModeEnabled() || !debugPanelVisible) {
    return;
  }

  const runModel = getRunModel();
  const forcedPickupType = debugConfig.pickups.forcedType;
  const forcedEventType = debugConfig.specialEvent.forceType;
  const lines = [
    "DEBUG MODE  F3 panel  F6 event  F7 pickup  F8 backlog",
    `persist: ${canPersistHighScore() ? "yes" : "no"} | state=${gameState} | pause=${pauseReason ?? "-"}`,
    `event cfg: type=${forcedEventType ?? "auto"} | delay=${debugConfig.specialEvent.delayMs ?? "random"}ms`,
    `event now: phase=${specialEventState.phase} | type=${specialEventState.type ?? "-"} | timer=${Math.ceil(specialEventState.timer)}ms`,
    `spawn x: pickup=${formatDebugMultiplier(debugConfig.pickups.spawnMultiplier)} | income=${formatDebugMultiplier(debugConfig.spawns.incomeMultiplier)}`,
    `spawn x: bug=${formatDebugMultiplier(debugConfig.spawns.bugMultiplier)} | rocket=${formatDebugMultiplier(debugConfig.spawns.rocketMultiplier)}`,
    `forced pickup: ${forcedPickupType ?? "auto"} | backlog seed=${debugConfig.initialRun.backlog}`,
    `start run: money=${debugConfig.initialRun.currencyCents}ct | action=${debugConfig.initialRun.actionScore} | progress=${debugConfig.initialRun.progressScore} | lives=${debugConfig.initialRun.lives}`,
    `world: platforms=${level.platforms.length} | pickups=${level.pickups.length} | bugs=${level.bugs.filter((bug) => bug.alive).length} | rockets=${level.rockets.length}`,
    `run: open=${runModel.bugs.openInRun} | backlog=${runModel.bugs.backlog} | money=${formatEuroAmount(runModel.resources.currencyCents)} | score=${runModel.score.total}`,
    `economy: eur/h=${runModel.resources.euroRatePerHour} | balance=${formatDebugMultiplier(runModel.balanceMultiplier)} | x=${Math.floor(player.x)}`,
  ];

  ctx.save();
  ctx.fillStyle = "rgba(10, 14, 22, 0.88)";
  ctx.strokeStyle = "rgba(255, 227, 122, 0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(16, 58, 616, 220, 18);
  ctx.fill();
  ctx.stroke();

  ctx.font = "12px Consolas, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? "#ffe37a" : "#eef3ff";
    ctx.fillText(line, 30, 72 + index * 18);
  });
  ctx.restore();
}

/**
 * Draws the start and game-over overlay screens.
 */
function drawOverlay() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(8, 5, 12, 0.42)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#fff6ea";
  ctx.font = "700 50px Trebuchet MS";
  if (gameState === "ready") {
    installButtonRect = null;
    ctx.fillText("Curious Tiger: Red Dune Dash", canvas.width / 2, 150);
    ctx.font = "24px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";
    ctx.fillText("Bekämpfe Bugs, sammle Moneten und überlebe die Marsdünen.", canvas.width / 2, 196);
    ctx.font = "700 34px Trebuchet MS";
    ctx.fillStyle = "#fff6ea";
    ctx.fillText(isTouchDevice ? "Tippe zum Starten" : "Leertaste für den Start", canvas.width / 2, 286);
    ctx.font = "22px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";

    if (shouldShowInstallPrompt()) {
      const hintY = 344;
      const buttonWidth = 204;
      const buttonHeight = 44;
      const buttonX = canvas.width / 2 - buttonWidth / 2;
      const buttonY = 364;

      ctx.font = "18px Trebuchet MS";
      ctx.fillStyle = "rgba(255, 240, 221, 0.9)";
      ctx.fillText(
        deferredInstallPrompt || isIosInstallFallback()
          ? "Installiere das Spiel für schnelleren Zugriff auf deinem Gerät"
          : "",
        canvas.width / 2,
        hintY
      );

      if (deferredInstallPrompt || isIosInstallFallback()) {
        installButtonRect = { x: buttonX, y: buttonY, w: buttonWidth, h: buttonHeight };
        ctx.fillStyle = "rgba(255, 214, 156, 0.92)";
        ctx.strokeStyle = "rgba(255, 247, 234, 0.75)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 18);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = "#4c2412";
        ctx.font = "700 20px Trebuchet MS";
        ctx.fillText("Als App installieren", canvas.width / 2, buttonY + 26);
      }

      if (showInstallHelp && isIosInstallFallback()) {
        const helpWidth = 336;
        const helpHeight = 108;
        const helpX = canvas.width / 2 - helpWidth / 2;
        const helpY = buttonY + 58;
        ctx.fillStyle = "rgba(18, 12, 24, 0.96)";
        ctx.strokeStyle = "rgba(255,255,255,0.14)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(helpX, helpY, helpWidth, helpHeight, 18);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "#fff0e0";
        ctx.font = "700 16px Trebuchet MS";
        ctx.fillText("iPhone / iPad:", helpX + 16, helpY + 24);
        ctx.font = "15px Trebuchet MS";
        ctx.fillText("1. Safari Teilen-Menü öffnen", helpX + 16, helpY + 50);
        ctx.fillText("2. 'Zum Home-Bildschirm' wählen", helpX + 16, helpY + 74);
        ctx.fillText("3. Danach vom Home-Screen starten", helpX + 16, helpY + 98);
        ctx.textAlign = "center";
      }
    }
  } else if (gameState === "paused") {
    installButtonRect = null;
    ctx.fillText("Pause", canvas.width / 2, 175);
    ctx.font = "24px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";
    if (canResumePausedRun()) {
      ctx.fillText(getPauseResumePrompt(), canvas.width / 2, 220);
    } else {
      ctx.fillText("Das Spiel wird gleich fortgesetzt", canvas.width / 2, 220);
    }
    ctx.font = "20px Trebuchet MS";
    ctx.fillText(`Punkte: ${getTotalScore()}`, canvas.width / 2, 258);
    ctx.fillText(`Offene Bugs: ${getOutstandingBugCount()}`, canvas.width / 2, 286);
  } else if (gameState === "lost") {
    installButtonRect = null;
    ctx.fillText("Game over", canvas.width / 2, 175);
    ctx.font = "24px Trebuchet MS";
    ctx.fillStyle = "#ffd1aa";
    ctx.fillText(
      canPersistHighScore()
        ? isTouchDevice
          ? `Highscore: ${highScore}. Tippe für einen neuen Lauf`
          : `Highscore: ${highScore}. Drücke R für einen neuen Lauf`
        : isTouchDevice
          ? "Debug-Run beendet. Tippe für einen neuen Lauf"
          : "Debug-Run beendet. Drücke R für einen neuen Lauf",
      canvas.width / 2,
      220
    );

    if (sprites.gameOver.complete) {
      const maxWidth = 250;
      const aspectRatio = sprites.gameOver.naturalWidth > 0 ? sprites.gameOver.naturalHeight / sprites.gameOver.naturalWidth : 1;
      const drawWidth = maxWidth;
      const drawHeight = drawWidth * aspectRatio;
      const drawX = canvas.width - drawWidth - 18;
      const drawY = canvas.height - drawHeight - 18;
      ctx.drawImage(sprites.gameOver, drawX, drawY, drawWidth, drawHeight);
    }
  }
  ctx.restore();
}

/**
 * Draws the countdown used during hurt/respawn sequences.
 */
function drawRespawnCountdown() {
  if (player.hurtTimer <= 0 || gameState !== "playing" || player.lives <= 0) {
    return;
  }

  // Show 2 -> 1 -> 0 instead of a raw millisecond-based countdown.
  const countdown = Math.max(0, Math.ceil(player.hurtTimer / 1000) - 1);
  drawCenterCountdown(countdown);
}

/**
 * Draws a large semi-transparent number in the center of the playfield.
 *
 * @param {number} countdown - Countdown number to display.
 */
function drawCenterCountdown(countdown) {
  if (countdown < 0) {
    return;
  }

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255, 246, 234, 0.38)";
  ctx.strokeStyle = "rgba(60, 26, 18, 0.28)";
  ctx.lineWidth = 6;
  ctx.font = "700 124px Trebuchet MS";
  ctx.strokeText(String(countdown), canvas.width / 2, canvas.height / 2);
  ctx.fillText(String(countdown), canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

/**
 * Draws the short countdown shown after returning from portrait mode to landscape.
 */
function drawResumeCountdown() {
  if (resumeCountdownTimer <= 0 || gameState !== "playing" || isPortraitMobileView()) {
    return;
  }

  const countdown = Math.max(0, Math.ceil(resumeCountdownTimer / 1000) - 1);
  drawCenterCountdown(countdown);
}

/**
 * Draws the warning countdown that announces an upcoming special event.
 */
function drawSpecialEventAnnouncement() {
  const eventInfo = getCurrentSpecialEventInfo();
  if (
    !eventInfo ||
    eventInfo.phase !== SPECIAL_EVENT_PHASE.ANNOUNCE ||
    gameState !== "playing" ||
    player.hurtTimer > 0 ||
    resumeCountdownTimer > 0
  ) {
    return;
  }

  const countdown = Math.max(0, Math.ceil(eventInfo.timer / 1000));
  drawCenterCountdown(countdown);

  ctx.save();
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff4e5";
  ctx.font = "700 34px Trebuchet MS";
  ctx.fillText(eventInfo.announcementTitle, canvas.width / 2, canvas.height / 2 - 92);
  ctx.fillStyle = "#ffd5b3";
  ctx.font = "20px Trebuchet MS";
  ctx.fillText(eventInfo.announcementPrompt, canvas.width / 2, canvas.height / 2 + 82);
  ctx.restore();
}

/**
 * Draws a compact HUD badge for currently active special events.
 */
function drawSpecialEventStatus() {
  const eventInfo = getCurrentSpecialEventInfo();
  if (
    !eventInfo ||
    eventInfo.phase !== SPECIAL_EVENT_PHASE.ACTIVE ||
    gameState !== "playing" ||
    player.hurtTimer > 0 ||
    resumeCountdownTimer > 0
  ) {
    return;
  }

  const remaining = Math.max(0, Math.ceil(eventInfo.timer / 1000));
  const badgeX = 18;
  const badgeY = mobileHud.topBar.y + mobileHud.topBar.h + 10;
  const badgeW = 238;
  const badgeH = 52;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(28, 17, 22, 0.92)";
  ctx.strokeStyle = "rgba(255, 231, 201, 0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#fff3e3";
  ctx.font = "700 18px Trebuchet MS";
  ctx.fillText(eventInfo.title, badgeX + 14, badgeY + 21);
  ctx.fillStyle = "#ffd5b3";
  ctx.font = "15px Trebuchet MS";
  ctx.fillText(`${remaining}s verbleibend`, badgeX + 14, badgeY + 40);
  ctx.restore();
}

/**
 * Renders the full frame for the current game state.
 *
 * @param {number} time - Current animation timestamp.
 */
function render(time) {
  if (isPortraitMobileView()) {
    return;
  }

  // Render order matters: world first, then gameplay overlays, then HUD and modal overlays.
  drawBackground();
  level.platforms.forEach(drawPlatform);
  level.hazards.forEach(drawHazard);
  level.pickups.forEach((pickup) => drawPickup(pickup, time));
  level.bugs.forEach((bug) => {
    if (bug.spawnTimer <= 0) {
      drawBug(bug, time);
    }
  });
  level.rockets.forEach(drawRocket);
  drawTiger();
  level.bugs.forEach((bug) => {
    if (bug.spawnTimer > 0) {
      drawBug(bug, time);
    }
  });
  drawRespawnAttention();
  drawRespawnCountdown();
  drawResumeCountdown();
  drawSpecialEventAnnouncement();

  if (gameState !== "playing") {
    drawOverlay();
  }

  drawHud();
  drawSpecialEventStatus();
  drawHudEffects();
  drawDebugPanel();
}

/**
 * Main animation loop that updates simulation state and renders frames.
 *
 * @param {number} time - Current animation timestamp.
 */
function gameLoop(time) {
  const delta = time - lastTime;
  lastTime = time;

  if (delta < 100) {
    const runActive = gameState === "playing" && !isPortraitMobileView();
    const gameplayPaused = !runActive || player.hurtTimer > 0 || resumeCountdownTimer > 0;

    if (gameState === "lost") {
      player.pendingRespawn = false;
    }

    if (runActive) {
      if (!gameplayPaused) {
        worldTimeMs += delta;
      }

      jumpButtonGlow = Math.max(0, jumpButtonGlow - delta);
      player.hurtTimer = Math.max(0, player.hurtTimer - delta);
      resumeCountdownTimer = Math.max(0, resumeCountdownTimer - delta);
      // Delayed respawn is applied only once the countdown has finished and the run is still active.
      if (player.hurtTimer === 0 && player.pendingRespawn && gameState === "playing") {
        player.pendingRespawn = false;
        player.forceInjuredPose = false;
        player.respawnVisual = "injured";
        player.x = player.checkpointX;
        player.y = player.checkpointY;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
      }
      updateSpawnTelegraphs(delta);
      if (!gameplayPaused) {
        updateSpecialEvents(delta);
      }
      updateHudEffects(delta);
      handleMovement(delta);
      updateAnimation(delta);
    }
  }

  render(time);
  requestAnimationFrame(gameLoop);
}

/**
 * Starts the run from the ready state or makes the tiger jump.
 * The tiger can jump once from the ground and once more while airborne
 * (double jump), but no more than MAX_JUMPS times per airborne sequence.
 */
function tryJump() {
  if (isPortraitMobileView()) {
    return;
  }

  if (gameState === "ready") {
    gameState = "playing";
    statusMessage = isDebugModeEnabled() ? "Debug-Run gestartet" : "Endloslauf gestartet";
    player.visible = true;
    player.x = 42;
    player.y = -160;
    player.vx = 0.8;
    player.vy = 2.2;
    player.grounded = false;
    player.direction = 1;
    return;
  }
  if (gameState !== "playing") {
    return;
  }
  // Allow a jump if the tiger is grounded OR has jumps remaining for a double-jump.
  if (player.grounded || player.jumpsUsed < MAX_JUMPS) {
    player.vy = player.jumpPower;
    player.grounded = false;
    player.jumpsUsed += 1;
  }
}

window.addEventListener("keydown", (event) => {
  const code = event.code;
  if (isDebugModeEnabled() && code === "F3") {
    event.preventDefault();
    debugPanelVisible = !debugPanelVisible;
    return;
  }
  if (isDebugModeEnabled() && code === "F6") {
    event.preventDefault();
    stepDebugSpecialEvent();
    return;
  }
  if (isDebugModeEnabled() && code === "F7") {
    event.preventDefault();
    spawnDebugPickup();
    return;
  }
  if (isDebugModeEnabled() && code === "F8") {
    event.preventDefault();
    addDebugBacklogRecord();
    return;
  }
  if (code === "KeyP") {
    event.preventDefault();
    toggleManualPause();
    return;
  }
  if (code === "KeyA" || code === "ArrowLeft") {
    setDirectionalInput("keyboard-left", "left");
  }
  if (code === "KeyD" || code === "ArrowRight") {
    setDirectionalInput("keyboard-right", "right");
  }
  if (code === "KeyW" || code === "Space" || code === "ArrowUp") {
    event.preventDefault();
    tryJump();
  }
  if (code === "KeyR") {
    resetPlayer(true);
  }
});

window.addEventListener("keyup", (event) => {
  const code = event.code;
  if (code === "KeyA" || code === "ArrowLeft") {
    clearDirectionalInput("keyboard-left");
  }
  if (code === "KeyD" || code === "ArrowRight") {
    clearDirectionalInput("keyboard-right");
  }
});

window.addEventListener("blur", () => {
  resetDirectionalInputState();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    resetDirectionalInputState();
    pauseGame("background");
  }
});

canvas.addEventListener("pointerdown", (event) => {
  const point = getCanvasPoint(event);

  if (point && updateButtonRect && pointInRect(point, updateButtonRect)) {
    event.preventDefault();
    refreshForUpdate();
    return;
  }

  // The install CTA should win over all gameplay interactions on the start screen.
  if (point && installButtonRect && pointInRect(point, installButtonRect)) {
    event.preventDefault();
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(() => {
        deferredInstallPrompt = null;
      });
    } else if (isIosInstallFallback()) {
      showInstallHelp = !showInstallHelp;
    }
    return;
  }

  if (event.pointerType !== "mouse" && canResumePausedRun()) {
    event.preventDefault();
    activeHudInfo = null;
    requestLandscapeLock();
    resumeGame(shouldUseResumeCountdown());
    return;
  }

  const infoHit = point && gameState !== "paused" ? getHudInfoHit(point) : null;

  if (infoHit) {
    event.preventDefault();
    activeHudInfo = activeHudInfo === infoHit.key ? null : infoHit.key;
    return;
  }

  activeHudInfo = null;

  if (event.pointerType === "mouse") {
    return;
  }

  event.preventDefault();
  canvas.setPointerCapture?.(event.pointerId);
  requestLandscapeLock();
  const action = getTouchAction(point);

  if (gameState === "lost") {
    resetPlayer(true);
    return;
  }

  if (action === "left" || action === "right") {
    activeTouchControls.set(event.pointerId, action);
    setDirectionalInput(event.pointerId, action);
    return;
  }

  if (action === "jump") {
    jumpButtonGlow = JUMP_BUTTON_GLOW_DURATION_MS;
    tryJump();
    return;
  }

  if (gameState === "ready" || gameState === "playing") {
    jumpButtonGlow = JUMP_BUTTON_GLOW_DURATION_MS;
    tryJump();
  }
});

const releaseTouchControl = (event) => {
  if (!activeTouchControls.has(event.pointerId)) {
    return;
  }

  event.preventDefault();
  activeTouchControls.delete(event.pointerId);
  clearDirectionalInput(event.pointerId);
  canvas.releasePointerCapture?.(event.pointerId);
};

const updateTouchControl = (event) => {
  if (!activeTouchControls.has(event.pointerId) || event.pointerType === "mouse") {
    return;
  }

  const point = getCanvasPoint(event);
  const previousAction = activeTouchControls.get(event.pointerId);
  const nextAction = getTouchAction(point);

  if (previousAction === nextAction) {
    return;
  }

  if (previousAction === "left" || previousAction === "right") {
    clearDirectionalInput(event.pointerId);
  }

  if (nextAction === "left" || nextAction === "right") {
    activeTouchControls.set(event.pointerId, nextAction);
    setDirectionalInput(event.pointerId, nextAction);
    return;
  }

  activeTouchControls.delete(event.pointerId);
};

canvas.addEventListener("pointerup", releaseTouchControl);
canvas.addEventListener("pointercancel", releaseTouchControl);
canvas.addEventListener("pointermove", updateTouchControl);
canvas.addEventListener("lostpointercapture", releaseTouchControl);
canvas.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse") {
    return;
  }
  releaseTouchControl(event);
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

resetPlayer(true);
gameState = "ready";
statusMessage = "Bereit für den Start";
player.visible = false;
player.x = -999;
player.y = -999;
syncCanvasOnlyMode();
requestAnimationFrame(gameLoop);
