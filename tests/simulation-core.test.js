const assert = require("node:assert/strict");

require("../systems/bug-lifecycle-system.js");
require("../systems/placement-system.js");
require("../systems/pickup-system.js");
require("../systems/simulation-core.js");
require("../systems/special-event-system.js");

const simulationCore = globalThis.RedDuneSimulationCore;
const bugLifecycle = globalThis.RedDuneBugLifecycle;
const placement = globalThis.RedDunePlacement;
const pickups = globalThis.RedDunePickups;
const specialEvents = globalThis.RedDuneSpecialEvents;

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
  });

  assert.equal(pickup.spawnTimer, 1000);
  assert.equal(pickup.spawnDuration, 1000);
  assert.equal(pickup.sourceEvent, "big-order");
  assert.equal(pickupSystem.canSpawnOnPlatform(pickups.PICKUP_TYPE.CURRENCY, { w: 100 }), true);
  assert.equal(pickupSystem.canSpawnOnPlatform(pickups.PICKUP_TYPE.EXTRA_LIFE, { w: 240 }), false);
  assert.equal(pickupSystem.getDefinition(pickups.PICKUP_TYPE.BACKLOG_REVIVAL).label, "Backlog-Impuls");
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
