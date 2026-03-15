const assert = require("node:assert/strict");

require("../systems/bug-lifecycle-system.js");
require("../systems/debug-tools.js");
require("../systems/placement-system.js");
require("../systems/pickup-system.js");
require("../systems/simulation-core.js");
require("../systems/special-event-system.js");
require("../systems/generator-helpers.js");
require("../systems/respawn-helpers.js");

const simulationCore = globalThis.RedDuneSimulationCore;
const bugLifecycle = globalThis.RedDuneBugLifecycle;
const debugTools = globalThis.RedDuneDebugTools;
const placement = globalThis.RedDunePlacement;
const pickups = globalThis.RedDunePickups;
const specialEvents = globalThis.RedDuneSpecialEvents;
const generatorHelpers = globalThis.RedDuneGeneratorHelpers;
const respawnHelpers = globalThis.RedDuneRespawnHelpers;

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("simulation core calculates euro rate, balance, and monotonic progress", () => {
  assert.equal(simulationCore.calculateEuroRatePerHour(450, 900_000), 18);
  assert.equal(simulationCore.calculateBugBalanceMultiplier(0), 1.35);
  assert.equal(simulationCore.calculateBugBalanceMultiplier(5), 0.8);
  assert.equal(simulationCore.calculateIncomeBalanceMultiplier(75), 1.1);
  assert.equal(
    simulationCore.calculateRunBalanceMultiplier({
      outstandingBugs: 2,
      euroRatePerHour: 75,
    }),
    1.125
  );
  assert.equal(
    simulationCore.calculateProgressScoreTarget({
      farthestX: 600,
      spawnX: 120,
      distanceDivisor: 12,
      runBalanceMultiplier: 1.125,
    }),
    45
  );
  assert.equal(simulationCore.lockProgressScore(52, 45), 52);
  assert.deepEqual(simulationCore.calculateScoreBreakdown(180, 52), {
    action: 180,
    progress: 52,
    total: 232,
  });
});

test("simulation core supports deterministic random helpers", () => {
  const randomA = simulationCore.createSeededRandom(12345);
  const randomB = simulationCore.createSeededRandom(12345);

  const sampleA = [randomA(), randomA(), randomA()];
  const sampleB = [randomB(), randomB(), randomB()];
  assert.deepEqual(sampleA, sampleB);

  const sequenceRandom = simulationCore.createSequenceRandom([0.2, 0.8], 0.5);
  assert.equal(sequenceRandom(), 0.2);
  assert.equal(sequenceRandom(), 0.8);
  assert.equal(sequenceRandom(), 0.5);
});

test("income source spawning is testable with an injected random value", () => {
  assert.equal(
    simulationCore.shouldSpawnIncomeSource({
      baseChance: 0.5,
      outstandingBugs: 10,
      randomValue: 0.05,
    }),
    true
  );
  assert.equal(
    simulationCore.shouldSpawnIncomeSource({
      baseChance: 0.5,
      outstandingBugs: 10,
      randomValue: 0.2,
    }),
    false
  );
});

test("bug lifecycle system tracks resolved and missed bugs independently of world entities", () => {
  const bugSystem = bugLifecycle.createBugLifecycleSystem();
  const resolvedBug = bugSystem.register(bugLifecycle.BUG_STATUS.ACTIVE_WORLD);
  const missedBug = bugSystem.register(bugLifecycle.BUG_STATUS.ACTIVE_WORLD);

  bugSystem.markResolved(resolvedBug);
  bugSystem.markMissed(missedBug);

  assert.deepEqual(bugSystem.getCounts(), {
    activeWorld: 0,
    missed: 1,
    backlog: 0,
    resolved: 1,
    reactivated: 0,
    totalKnown: 2,
  });
});

test("bug lifecycle system can pick historical unresolved bugs for reactivation without duplicating active world bugs", () => {
  const bugSystem = bugLifecycle.createBugLifecycleSystem();
  const activeBug = bugSystem.register(bugLifecycle.BUG_STATUS.ACTIVE_WORLD);
  const missedBug = bugSystem.register(bugLifecycle.BUG_STATUS.MISSED);
  const backlogBug = bugSystem.register(bugLifecycle.BUG_STATUS.BACKLOG);
  const reactivatedBug = bugSystem.register(bugLifecycle.BUG_STATUS.REACTIVATED);
  bugSystem.register(bugLifecycle.BUG_STATUS.RESOLVED);

  const first = bugSystem.pickReactivatableRecord({
    activeBugIds: [activeBug],
    randomInt: () => 0,
  });
  assert.equal(first.id, missedBug);

  const second = bugSystem.pickReactivatableRecord({
    activeBugIds: [activeBug, missedBug],
    randomInt: () => 0,
  });
  assert.equal(second.id, backlogBug);

  const third = bugSystem.pickReactivatableRecord({
    activeBugIds: [activeBug, missedBug, backlogBug],
    randomInt: () => 0,
  });
  assert.equal(third.id, reactivatedBug);

  const noneLeft = bugSystem.pickReactivatableRecord({
    activeBugIds: [activeBug, missedBug, backlogBug, reactivatedBug],
    randomInt: () => 0,
  });
  assert.equal(noneLeft, null);
});

test("placement system computes stable safe zones and nearest safe positions", () => {
  const placementSystem = placement.createPlacementSystem();
  const platform = { x: 100, y: 300, w: 300, h: 18 };
  const blockedIntervals = [
    placementSystem.createBlockedPlacementInterval(220, 40, 0, placementSystem.config.collectibleHazardPadding),
  ];
  const safeZones = placementSystem.getPlatformSafeZones(platform, {
    minimumZoneWidth: placementSystem.config.gemMinimumZoneWidth,
    blockedIntervals,
  });

  assert.equal(safeZones.length, 2);
  assert.deepEqual(safeZones[0], { start: 128, end: 196 });
  assert.deepEqual(safeZones[1], { start: 284, end: 372 });
  assert.equal(placementSystem.pickNearestSafeZoneX(safeZones, 240), 196);
});

test("debug tools parse query overrides and scale balancing helpers deterministically", () => {
  const config = debugTools.createDebugConfig(
    "?debugEvent=big-order&debugPickup=score-boost&debugPickupSpawnMultiplier=2.5&debugIncomeSpawnMultiplier=0.4&debugBacklog=7&debugLives=5"
  );

  assert.equal(config.enabled, true);
  assert.equal(config.showPanel, true);
  assert.equal(config.specialEvent.forceType, "big-order");
  assert.equal(config.pickups.forcedType, "score-boost");
  assert.equal(config.pickups.spawnMultiplier, 2.5);
  assert.equal(config.spawns.incomeMultiplier, 0.4);
  assert.equal(config.initialRun.backlog, 7);
  assert.equal(config.initialRun.lives, 5);
  assert.equal(debugTools.scaleChance(0.25, 2), 0.4375);
  assert.equal(debugTools.scaleDelay(1200, 2, 300), 600);
  assert.equal(debugTools.getSpawnIterations(2.4, 0.2), 3);
  assert.equal(debugTools.getSpawnIterations(0.4, 0.8), 0);
});

test("pickup system exposes typed spawn rules and preserves pickup metadata", () => {
  const pickupSystem = pickups.createPickupSystem(
    pickups.createPickupDefinitions({
      gemValueCents: 15,
      scoreConfig: {
        gemPickup: 30,
        rocketPickup: 200,
      },
      spawnTelegraphDuration: 1000,
    })
  );

  const pickup = pickupSystem.createPickup(pickups.PICKUP_TYPE.CURRENCY, 240, 180, {
    telegraph: true,
    sourceEvent: "big-order",
    renderScale: 2,
  });

  assert.equal(pickup.spawnTimer, 1000);
  assert.equal(pickup.spawnDuration, 1000);
  assert.equal(pickup.sourceEvent, "big-order");
  assert.equal(pickup.r, 28);
  assert.equal(pickupSystem.canSpawnOnPlatform(pickups.PICKUP_TYPE.CURRENCY, { w: 100 }), true);
  assert.equal(pickupSystem.canSpawnOnPlatform(pickups.PICKUP_TYPE.EXTRA_LIFE, { w: 240 }), false);
  assert.equal(pickupSystem.getDefinition(pickups.PICKUP_TYPE.BACKLOG_REVIVAL).label, "Backlog-Impuls");
  assert.equal(pickupSystem.getRenderModel(pickups.PICKUP_TYPE.CURRENCY, pickup).scale, 2);
});

test("pickup system applies typed currency and extra-life effects through callbacks", () => {
  const pickupSystem = pickups.createPickupSystem(
    pickups.createPickupDefinitions({
      gemValueCents: 15,
      scoreConfig: {
        gemPickup: 30,
        rocketPickup: 200,
      },
      spawnTelegraphDuration: 1000,
    })
  );
  const player = {
    lives: 3,
    invincible: 0,
  };
  const runState = {
    currencyCents: 0,
    actionScore: 0,
  };
  const hudEffects = [];
  const hitEffects = [];
  const currencyEvents = [];
  let statusMessage = "";

  const context = {
    player,
    runState,
    createHitEffect(x, y, emoji, color = null) {
      const effect = { x, y, emoji, color };
      hitEffects.push(effect);
      return effect;
    },
    spawnHudEmoji(worldX, worldY, emoji, statKey) {
      hudEffects.push({ worldX, worldY, emoji, statKey });
    },
    setStatusMessage(message) {
      statusMessage = message;
    },
    onCurrencyCollected(payload) {
      currencyEvents.push(payload);
    },
  };

  assert.equal(
    pickupSystem.applyEffect(pickups.PICKUP_TYPE.CURRENCY, {
      ...context,
      pickup: { x: 120, y: 210, r: 14 },
    }),
    true
  );
  assert.equal(runState.currencyCents, 15);
  assert.equal(runState.actionScore, 30);
  assert.equal(statusMessage, "15 ct geborgen");
  assert.equal(currencyEvents.length, 1);
  assert.equal(currencyEvents[0].currencyCents, 15);
  assert.deepEqual(
    hudEffects.map((effect) => effect.statKey),
    ["gems", "score"]
  );

  assert.equal(
    pickupSystem.applyEffect(pickups.PICKUP_TYPE.EXTRA_LIFE, {
      ...context,
      pickup: { x: 300, y: 180, w: 52, h: 20 },
    }),
    true
  );
  assert.equal(player.lives, 4);
  assert.equal(runState.actionScore, 230);
  assert.equal(statusMessage, "Rakete erwischt. Extraleben erhalten");
  assert.equal(hitEffects.length, 4);
});

test("pickup system applies currency overrides and forwards bonus bug metadata", () => {
  const pickupSystem = pickups.createPickupSystem(
    pickups.createPickupDefinitions({
      gemValueCents: 10,
      scoreConfig: {
        gemPickup: 30,
        rocketPickup: 200,
      },
      spawnTelegraphDuration: 1000,
    })
  );
  const runState = {
    currencyCents: 0,
    actionScore: 0,
  };
  const currencyEvents = [];
  let statusMessage = "";

  assert.equal(
    pickupSystem.applyEffect(pickups.PICKUP_TYPE.CURRENCY, {
      pickup: {
        x: 120,
        y: 210,
        r: 28,
        currencyCents: 100,
        spawnBugOnCollect: { chance: 0.5, telegraph: true },
      },
      player: { lives: 3, invincible: 0 },
      runState,
      createHitEffect(x, y, emoji, color = null) {
        return { x, y, emoji, color };
      },
      spawnHudEmoji() {},
      setStatusMessage(message) {
        statusMessage = message;
      },
      onCurrencyCollected(payload) {
        currencyEvents.push(payload);
      },
    }),
    true
  );

  assert.equal(runState.currencyCents, 100);
  assert.equal(runState.actionScore, 30);
  assert.equal(statusMessage, "1 EUR geborgen");
  assert.equal(currencyEvents.length, 1);
  assert.deepEqual(currencyEvents[0].spawnBugOnCollect, { chance: 0.5, telegraph: true });
});

test("special event system can be driven deterministically through time and injected random hooks", () => {
  const randomChance = simulationCore.createSequenceRandom([0.2, 0.95], 0.99);
  const counters = {
    bigOrderGems: 0,
    bigOrderBugs: 0,
    bugWaveFalling: 0,
    bugWaveGround: 0,
  };
  const config = {
    minDelay: 1000,
    maxDelay: 1000,
    announceDuration: 1000,
    activeDuration: 1500,
    bugWaveRocketSpawnMultiplier: 2,
    bugWaveMaxFalling: 7,
    bugWaveGroundSpawnIntervalMin: 500,
    bugWaveGroundSpawnIntervalMax: 600,
    bigOrder: {
      groundGemChance: 1,
      groundBugChance: 0.5,
      plateGemChance: 1,
      plateExtraGemChance: 0.9,
      plateBugChance: 0.42,
      bonusPlatformChance: 0.44,
      bonusExtraGemChance: 1,
      bonusBugChance: 0.3,
      visibleExtraGemChance: 0.75,
      visibleGemSpawnIntervalMin: 450,
      visibleGemSpawnIntervalMax: 900,
      visibleExtraBugChance: 0.2,
      visibleBugSpawnIntervalMin: 1100,
      visibleBugSpawnIntervalMax: 1800,
    },
  };
  const definitions = specialEvents.createSpecialEventDefinitions(config, {
    randomInt: (min) => min,
    randomChance,
    lerp: (start, end, alpha) => start + (end - start) * alpha,
    clamp: simulationCore.clamp,
    getFallingBugCount: () => 0,
    spawnBugWaveBug() {
      counters.bugWaveFalling += 1;
    },
    spawnBugWaveGroundBug() {
      counters.bugWaveGround += 1;
    },
    spawnBigOrderGem() {
      counters.bigOrderGems += 1;
    },
    spawnBigOrderBug() {
      counters.bigOrderBugs += 1;
    },
  });
  const statusMessages = [];
  const eventSystem = specialEvents.createSpecialEventSystem({
    config,
    definitions,
    randomInt: (min) => min,
    debugType: "big-order",
    onStatusMessage(message) {
      statusMessages.push(message);
    },
  });

  assert.equal(eventSystem.getInfo(), null);

  eventSystem.update(1000);
  assert.equal(eventSystem.state.phase, specialEvents.SPECIAL_EVENT_PHASE.ANNOUNCE);
  assert.equal(eventSystem.getInfo().type, "big-order");

  eventSystem.update(1000);
  assert.equal(eventSystem.state.phase, specialEvents.SPECIAL_EVENT_PHASE.ACTIVE);
  assert.equal(statusMessages.at(-1), "Großauftrag aktiv. Mehr Moneten und mehr Bugs unterwegs");

  eventSystem.update(700);
  assert.equal(counters.bigOrderGems, 2);
  assert.equal(counters.bigOrderBugs, 0);

  eventSystem.update(300);
  assert.equal(counters.bigOrderBugs, 1);

  eventSystem.update(500);
  assert.equal(eventSystem.state.phase, specialEvents.SPECIAL_EVENT_PHASE.IDLE);
  assert.equal(statusMessages.at(-1), "Großauftrag abgeschlossen");
});

test("special event system supports weighted backlog-aware event selection", () => {
  const eventTypes = ["bug-wave", "big-order"];
  assert.equal(
    specialEvents.pickWeightedEventType(
      eventTypes,
      (type) => (type === "bug-wave" ? 4 : 1),
      0.1
    ),
    "bug-wave"
  );
  assert.equal(
    specialEvents.pickWeightedEventType(
      eventTypes,
      (type) => (type === "bug-wave" ? 1 : 1),
      0.9
    ),
    "big-order"
  );

  const config = {
    minDelay: 1000,
    maxDelay: 1000,
    announceDuration: 500,
    activeDuration: 500,
    bugWaveRocketSpawnMultiplier: 2,
    bugWaveMaxFalling: 7,
    bugWaveGroundSpawnIntervalMin: 500,
    bugWaveGroundSpawnIntervalMax: 600,
    bigOrder: {
      visibleExtraGemChance: 0,
      visibleGemSpawnIntervalMin: 450,
      visibleGemSpawnIntervalMax: 900,
      visibleExtraBugChance: 0,
      visibleBugSpawnIntervalMin: 1100,
      visibleBugSpawnIntervalMax: 1800,
    },
  };
  const definitions = specialEvents.createSpecialEventDefinitions(config, {
    randomInt: (min) => min,
    randomChance: () => 0,
    lerp: (start, end, alpha) => start + (end - start) * alpha,
    clamp: simulationCore.clamp,
    getFallingBugCount: () => 0,
    spawnBugWaveBug() {},
    spawnBugWaveGroundBug() {},
    spawnBigOrderGem() {},
    spawnBigOrderBug() {},
  });

  const eventSystem = specialEvents.createSpecialEventSystem({
    config,
    definitions,
    randomInt: (min) => min,
    pickType({ eventTypes: availableTypes }) {
      return specialEvents.pickWeightedEventType(
        availableTypes,
        (type) => (type === "bug-wave" ? 5 : 1),
        0.2
      );
    },
  });

  eventSystem.update(1000);
  assert.equal(eventSystem.state.phase, specialEvents.SPECIAL_EVENT_PHASE.ANNOUNCE);
  assert.equal(eventSystem.state.type, "bug-wave");
});

test("special event helpers can deterministically choose grossauftrag bonus euros", () => {
  assert.deepEqual(
    specialEvents.pickBigOrderCurrencyVariant(
      {
        baseCurrencyCents: 10,
        bonusEuroChance: 0.3,
        bonusCurrencyCents: 100,
        bonusRenderScale: 2,
        bonusBugSpawnChance: 0.5,
      },
      0.2
    ),
    {
      variant: "bonus-euro",
      isBonus: true,
      currencyCents: 100,
      renderScale: 2,
      spawnBugOnCollect: { chance: 0.5, telegraph: true },
    }
  );

  assert.deepEqual(
    specialEvents.pickBigOrderCurrencyVariant(
      {
        baseCurrencyCents: 10,
        bonusEuroChance: 0.3,
        bonusCurrencyCents: 100,
        bonusRenderScale: 2,
        bonusBugSpawnChance: 0.5,
      },
      0.8
    ),
    {
      variant: "standard-euro",
      isBonus: false,
      currencyCents: 10,
      renderScale: 1,
      spawnBugOnCollect: null,
    }
  );
});

test("generator helpers roll back failed optional chunk features without leaving partial state", () => {
  const bugSystem = bugLifecycle.createBugLifecycleSystem();
  const initialBugA = bugSystem.register(bugLifecycle.BUG_STATUS.ACTIVE_WORLD);
  const initialBugB = bugSystem.register(bugLifecycle.BUG_STATUS.ACTIVE_WORLD);

  const level = {
    platforms: [{ x: 0, y: 400, w: 300, h: 40, kind: "ground" }],
    hazards: [{ x: 40, y: 380, w: 40, h: 20 }],
    pickups: [{ type: "dummy", x: 180, y: 360 }],
    bugs: [],
    nextChunkX: 300,
  };
  const player = { h: 40 };

  const helpers = generatorHelpers.createGeneratorHelpers({
    level,
    bugLifecycleSystem: bugSystem,
    player,
    randomInt: (min, max) => min,
    randomBetween: (min, max) => min,
    clamp: simulationCore.clamp,
    createPlatform(x, y, w, h, kind) {
      return { x, y, w, h, kind };
    },
    addGemOnPlatform() {},
    addBugOnPlatform() {},
  });

  const baselinePlatformCount = level.platforms.length;
  const baselineHazardCount = level.hazards.length;
  const baselinePickupCount = level.pickups.length;
  const baselineBugCount = level.bugs.length;

  const failed = helpers.commitChunkFeatureAttempt(() => {
    const bugId = bugSystem.register(bugLifecycle.BUG_STATUS.ACTIVE_WORLD);
    level.platforms.push({ x: 320, y: 360, w: 120, h: 20, kind: "plate" });
    level.hazards.push({ x: 340, y: 380, w: 40, h: 20 });
    level.pickups.push({ type: "extra", x: 340, y: 340 });
    level.bugs.push({ id: bugId, x: 340, y: 360, w: 32, h: 24 });
    return false;
  });
  assert.equal(failed, false);

  assert.equal(level.platforms.length, baselinePlatformCount);
  assert.equal(level.hazards.length, baselineHazardCount);
  assert.equal(level.pickups.length, baselinePickupCount);
  assert.equal(level.bugs.length, baselineBugCount);

  const counts = bugSystem.getCounts();
  assert.equal(counts.totalKnown, 2);
  assert.ok(bugSystem.state.records.has(initialBugA));
  assert.ok(bugSystem.state.records.has(initialBugB));
});

test("generator helpers commit successful optional features and keep new entities", () => {
  const bugSystem = bugLifecycle.createBugLifecycleSystem();
  const level = {
    platforms: [{ x: 0, y: 400, w: 300, h: 40, kind: "ground" }],
    hazards: [],
    pickups: [],
    bugs: [],
    nextChunkX: 300,
  };
  const player = { h: 40 };

  const helpers = generatorHelpers.createGeneratorHelpers({
    level,
    bugLifecycleSystem: bugSystem,
    player,
    randomInt: (min, max) => min,
    randomBetween: (min, max) => min,
    clamp: simulationCore.clamp,
    createPlatform(x, y, w, h, kind) {
      return { x, y, w, h, kind };
    },
    addGemOnPlatform() {},
    addBugOnPlatform() {},
  });

  const committed = helpers.commitChunkFeatureAttempt(() => {
    const bugId = bugSystem.register(bugLifecycle.BUG_STATUS.ACTIVE_WORLD);
    level.platforms.push({ x: 320, y: 360, w: 120, h: 20, kind: "plate" });
    level.hazards.push({ x: 340, y: 380, w: 40, h: 20 });
    level.pickups.push({ type: "extra", x: 340, y: 340 });
    level.bugs.push({ id: bugId, x: 340, y: 360, w: 32, h: 24 });
    return true;
  });

  assert.equal(committed, true);
  assert.equal(level.platforms.length, 2);
  assert.equal(level.hazards.length, 1);
  assert.equal(level.pickups.length, 1);
  assert.equal(level.bugs.length, 1);
});

test("ensureStepPlatform creates a helper step for too-high platforms and keeps approach reachable", () => {
  const bugSystem = bugLifecycle.createBugLifecycleSystem();
  const level = {
    platforms: [],
    hazards: [],
    pickups: [],
    bugs: [],
    nextChunkX: 0,
  };
  const player = { h: 40 };
  const groundY = 460;

  const ground = { x: 0, y: groundY, w: 360, h: 40, kind: "ground" };
  const target = { x: 260, y: 280, w: 120, h: 20, kind: "plate" };
  level.platforms.push(ground, target);

  let decoratedGems = 0;
  let decoratedBugs = 0;

  const helpers = generatorHelpers.createGeneratorHelpers({
    level,
    bugLifecycleSystem: bugSystem,
    player,
    randomInt: (min, max) => min,
    randomBetween: (min, max) => min,
    clamp: simulationCore.clamp,
    createPlatform(x, y, w, h, kind) {
      return { x, y, w, h, kind };
    },
    addGemOnPlatform() {
      decoratedGems += 1;
    },
    addBugOnPlatform() {
      decoratedBugs += 1;
    },
  });

  const ok = helpers.ensureStepPlatform(target, groundY);
  assert.equal(ok, true);
  assert.equal(level.platforms.length, 3);

  const step = level.platforms.find((p) => p.kind === "plate" && p !== target);
  assert.ok(step);
  assert.ok(step.y > target.y);
  assert.ok(step.y < groundY);

  assert.equal(decoratedGems, 1);
  assert.equal(decoratedBugs, 1);
  assert.equal(helpers.hasReachableApproach(target, ground), true);
});

test("generator helpers expose basic hazard and clearance helpers for fairness corrections", () => {
  const bugSystem = bugLifecycle.createBugLifecycleSystem();
  const level = {
    platforms: [
      { x: 0, y: 440, w: 200, h: 20, kind: "ground" },
      { x: 260, y: 380, w: 120, h: 20, kind: "plate" },
    ],
    hazards: [
      { x: 40, y: 420, w: 40, h: 20 },
      { x: 280, y: 420, w: 40, h: 20 },
    ],
    pickups: [],
    bugs: [],
    nextChunkX: 0,
  };
  const player = { h: 40 };

  const helpers = generatorHelpers.createGeneratorHelpers({
    level,
    bugLifecycleSystem: bugSystem,
    player,
    randomInt: (min, max) => min,
    randomBetween: (min, max) => min,
    clamp: simulationCore.clamp,
    createPlatform(x, y, w, h, kind) {
      return { x, y, w, h, kind };
    },
    addGemOnPlatform() {},
    addBugOnPlatform() {},
  });

  assert.equal(
    helpers.platformCollides(
      { x: 250, y: 380, w: 80, h: 20 },
      18,
    ),
    true
  );

  helpers.removeHazardsUnderSpan(250, 360);
  assert.equal(level.hazards.length, 1);
  assert.deepEqual(level.hazards[0], { x: 40, y: 420, w: 40, h: 20 });

  assert.equal(helpers.isTooCloseToGround({ y: 412, h: 20 }, 440), true);
  assert.equal(helpers.isTooCloseToGround({ y: 360, h: 20 }, 440), false);
});

test("respawn helpers choose safe checkpoint positions away from hazards", () => {
  const placementSystem = placement.createPlacementSystem();
  const level = {
    platforms: [{ x: 0, y: 440, w: 260, h: 20, kind: "ground" }],
    hazards: [
      { x: 40, y: 422, w: 40, h: 18 },
      { x: 180, y: 422, w: 40, h: 18 },
    ],
    bugs: [],
  };
  const player = {
    x: 120,
    y: 400,
    w: 40,
    h: 40,
    checkpointX: 0,
    checkpointY: 400,
  };

  const helpers = respawnHelpers.createRespawnHelpers({
    level,
    player,
    placementSystem,
    placementSafetyConfig: placementSystem.config,
    getHazardState(hazard) {
      // For checkpoint-Berechnung reicht eine statische Geometrie ohne Zyklus.
      return {
        exposure: 1,
        active: true,
        top: hazard.y,
        baseY: hazard.y + hazard.h,
        height: hazard.h,
      };
    },
  });

  const ground = level.platforms[0];
  const checkpointX = helpers.getSafeCheckpointX(ground);
  // Checkpoint sollte innerhalb der Plattform, aber ausserhalb der unmittelbaren Hazard-Spans liegen.
  assert.ok(checkpointX > ground.x + placementSystem.config.platformEdgePadding);
  assert.ok(checkpointX + player.w < ground.x + ground.w - placementSystem.config.platformEdgePadding);
  // Der konkrete Wert haengt von der inneren Safe-Zonen-Berechnung ab; hier reicht ein
  // stabiler Bereichscheck rund um die Plattformmitte.
  assert.ok(checkpointX > 80);
  assert.ok(checkpointX < 180);
});

test("respawn helpers snap hurt poses to supporting platforms or checkpoint", () => {
  const placementSystem = placement.createPlacementSystem();
  const level = {
    platforms: [
      { x: 0, y: 440, w: 260, h: 20, kind: "ground" },
      { x: 320, y: 360, w: 120, h: 20, kind: "ground" },
    ],
    hazards: [],
    bugs: [],
  };
  const player = {
    x: 100,
    y: 400,
    w: 40,
    h: 40,
    checkpointX: 40,
    checkpointY: 400,
  };

  const helpers = respawnHelpers.createRespawnHelpers({
    level,
    player,
    placementSystem,
    placementSafetyConfig: placementSystem.config,
    getHazardState(hazard) {
      return {
        exposure: 1,
        active: true,
        top: hazard.y,
        baseY: hazard.y + hazard.h,
        height: hazard.h,
      };
    },
  });

  // Fall auf eine existierende Plattform.
  const safeOnGround = helpers.moveToSafeInjuredPose(120, 420);
  assert.equal(safeOnGround.y, level.platforms[0].y - player.h);

  // Verletzungsposition ueber einer Luecke vor der zweiten Plattform -> sollte auf diese Plattform schnappen.
  const safeOnSecond = helpers.moveToSafeInjuredPose(340, 380);
  assert.equal(safeOnSecond.y, level.platforms[1].y - player.h);

  // Komplett ohne tragende Plattform unter dem Spieler -> Rueckfall auf Checkpoint.
  level.platforms.length = 0;
  const backToCheckpoint = helpers.moveToSafeInjuredPose(200, 600);
  assert.equal(backToCheckpoint.x, player.checkpointX);
  assert.equal(backToCheckpoint.y, player.checkpointY);
});

test("respawn helpers detect hazard center-band hits and correctly exclude inactive or non-overlapping hazards", () => {
  const placementSystem = placement.createPlacementSystem();
  const level = {
    platforms: [{ x: 0, y: 440, w: 300, h: 20, kind: "ground" }],
    hazards: [],
    bugs: [],
  };
  // Player: 40x40 at (100, 400). Center x = 120. Center band = [105, 135].
  const player = {
    x: 100,
    y: 400,
    w: 40,
    h: 40,
    checkpointX: 0,
    checkpointY: 400,
  };

  function makeActiveState(hazard) {
    return {
      exposure: 1,
      active: true,
      top: hazard.y,
      baseY: hazard.y + hazard.h,
      height: hazard.h,
    };
  }

  function makeInactiveState(hazard) {
    return {
      exposure: 0,
      active: false,
      top: hazard.y + hazard.h,
      baseY: hazard.y + hazard.h,
      height: 0,
    };
  }

  // Hazard directly under player center and vertically overlapping -> hit.
  const hazardCenter = { x: 112, y: 418, w: 16, h: 22 };
  const helpersHit = respawnHelpers.createRespawnHelpers({
    level,
    player,
    placementSystem,
    placementSafetyConfig: placementSystem.config,
    getHazardState: () => makeActiveState(hazardCenter),
  });
  assert.equal(helpersHit.hitsHazardWithPlayerCenter(hazardCenter), true,
    "center-overlapping active hazard should register a hit");

  // Hazard is active but center band is entirely to the left of the hazard -> no hit.
  // Player center = 120, center band = [105, 135]. Hazard at x=200 -> no overlap.
  const hazardRight = { x: 200, y: 418, w: 16, h: 22 };
  const helpersRight = respawnHelpers.createRespawnHelpers({
    level,
    player,
    placementSystem,
    placementSafetyConfig: placementSystem.config,
    getHazardState: () => makeActiveState(hazardRight),
  });
  assert.equal(helpersRight.hitsHazardWithPlayerCenter(hazardRight), false,
    "active hazard outside center band (right side) should not register a hit");

  // Hazard is active but center band is entirely to the right of the hazard -> no hit.
  const hazardLeft = { x: 0, y: 418, w: 16, h: 22 };
  const helpersLeft = respawnHelpers.createRespawnHelpers({
    level,
    player,
    placementSystem,
    placementSafetyConfig: placementSystem.config,
    getHazardState: () => makeActiveState(hazardLeft),
  });
  assert.equal(helpersLeft.hitsHazardWithPlayerCenter(hazardLeft), false,
    "active hazard outside center band (left side) should not register a hit");

  // Hazard overlaps center band horizontally but is inactive -> no hit.
  const hazardInactive = { x: 112, y: 418, w: 16, h: 22 };
  const helpersInactive = respawnHelpers.createRespawnHelpers({
    level,
    player,
    placementSystem,
    placementSafetyConfig: placementSystem.config,
    getHazardState: () => makeInactiveState(hazardInactive),
  });
  assert.equal(helpersInactive.hitsHazardWithPlayerCenter(hazardInactive), false,
    "inactive hazard (height=0) should not register a hit");

  // Hazard is active and center-band-adjacent but no vertical overlap -> no hit.
  // Player y range [400, 440]. Hazard at y=450 places top at 450, baseY at 472 -> below player.
  const hazardBelow = { x: 112, y: 450, w: 16, h: 22 };
  const helpersBelow = respawnHelpers.createRespawnHelpers({
    level,
    player,
    placementSystem,
    placementSafetyConfig: placementSystem.config,
    getHazardState: () => makeActiveState(hazardBelow),
  });
  assert.equal(helpersBelow.hitsHazardWithPlayerCenter(hazardBelow), false,
    "active hazard with no vertical overlap should not register a hit");
});

let failed = 0;

tests.forEach(({ name, fn }) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
});

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`All ${tests.length} gameplay system tests passed.`);
}
