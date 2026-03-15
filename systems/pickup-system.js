(function registerPickupSystem(globalScope) {
  const PICKUP_TYPE = Object.freeze({
    CURRENCY: "currency",
    EXTRA_LIFE: "extra-life",
    BACKLOG_REVIVAL: "backlog-revival",
    SCORE_BOOST: "score-boost",
    TEMPORARY_SHIELD: "temporary-shield",
    EVENT_TRIGGER: "event-trigger",
  });

  function getPickupCenter(pickup) {
    if (typeof pickup?.w === "number" && typeof pickup?.h === "number") {
      return {
        x: pickup.x + pickup.w / 2,
        y: pickup.y + pickup.h / 2,
      };
    }

    return {
      x: pickup.x,
      y: pickup.y,
    };
  }

  /**
   * Creates the pickup type definitions used by the current run.
   *
   * @param {{gemValueCents:number,scoreConfig:{gemPickup:number,rocketPickup:number},spawnTelegraphDuration:number}} config - Pickup balancing config.
   * @returns {Record<string, object>} Pickup definition table.
   */
  function createPickupDefinitions(config) {
    return {
      [PICKUP_TYPE.CURRENCY]: {
        type: PICKUP_TYPE.CURRENCY,
        label: "Moneten",
        emoji: "€",
        hudStatKey: "gems",
        platformSpawnable: true,
        spawnTelegraphDuration: config.spawnTelegraphDuration,
        minimumPlatformWidth: 90,
        minimumSafeZoneWidth: 36,
        radius: 14,
        render: {
          glyph: "€",
          fillStyle: "#ffe37a",
          strokeStyle: "#9a6a00",
          font: "700 42px Trebuchet MS",
          lineWidth: 2.5,
          bobAmplitude: 4,
          bobTimeDivisor: 180,
          worldPhaseScale: 0.01,
        },
        shouldSpawn(context) {
          return context.shouldSpawnIncomeSource();
        },
        applyEffect(context) {
          const moneyEffect = context.createHitEffect(context.pickup.x, context.pickup.y, "€", "#ffe37a");
          const scoreEffect = context.createHitEffect(context.pickup.x + 16, context.pickup.y - 8, "⭐");
          context.spawnHudEmoji(moneyEffect.x, moneyEffect.y, moneyEffect.emoji, "gems");
          context.spawnHudEmoji(scoreEffect.x, scoreEffect.y, scoreEffect.emoji, "score");
          context.runState.currencyCents += config.gemValueCents;
          context.runState.actionScore += config.scoreConfig.gemPickup;
          context.setStatusMessage(`${config.gemValueCents} ct geborgen`);
        },
      },
      [PICKUP_TYPE.EXTRA_LIFE]: {
        type: PICKUP_TYPE.EXTRA_LIFE,
        label: "Extraleben",
        emoji: "🚀",
        hudStatKey: "lives",
        platformSpawnable: false,
        applyEffect(context) {
          const center = getPickupCenter(context.pickup);
          const lifeEffect = context.createHitEffect(
            center.x - 12,
            center.y,
            "🚀"
          );
          const scoreEffect = context.createHitEffect(
            center.x + 16,
            center.y - 10,
            "⭐"
          );
          context.spawnHudEmoji(lifeEffect.x, lifeEffect.y, lifeEffect.emoji, "lives");
          context.spawnHudEmoji(scoreEffect.x, scoreEffect.y, scoreEffect.emoji, "score");
          context.player.lives += 1;
          context.runState.actionScore += config.scoreConfig.rocketPickup;
          context.setStatusMessage("Rakete erwischt. Extraleben erhalten");
        },
      },
      [PICKUP_TYPE.BACKLOG_REVIVAL]: {
        type: PICKUP_TYPE.BACKLOG_REVIVAL,
        label: "Backlog-Impuls",
        emoji: "↺",
        hudStatKey: "bugsOpen",
        platformSpawnable: false,
        spawnTelegraphDuration: config.spawnTelegraphDuration,
        minimumPlatformWidth: 100,
        minimumSafeZoneWidth: 40,
        radius: 16,
        render: {
          glyph: "↺",
          fillStyle: "#b2f2d1",
          strokeStyle: "#1f6f55",
          font: "700 40px Trebuchet MS",
          lineWidth: 2.5,
          bobAmplitude: 5,
          bobTimeDivisor: 210,
          worldPhaseScale: 0.012,
        },
        shouldSpawn() {
          return false;
        },
        applyEffect(context) {
          context.onBacklogRevival?.({ amount: 1, pickup: context.pickup });
          context.setStatusMessage("Backlog-Impuls aufgenommen");
        },
      },
      [PICKUP_TYPE.SCORE_BOOST]: {
        type: PICKUP_TYPE.SCORE_BOOST,
        label: "Score-Boost",
        emoji: "⭐",
        hudStatKey: "score",
        platformSpawnable: false,
        spawnTelegraphDuration: config.spawnTelegraphDuration,
        minimumPlatformWidth: 100,
        minimumSafeZoneWidth: 40,
        radius: 16,
        render: {
          glyph: "⭐",
          fillStyle: "#fff1b8",
          strokeStyle: "#8a6e00",
          font: "700 38px Trebuchet MS",
          lineWidth: 2.5,
          bobAmplitude: 5,
          bobTimeDivisor: 200,
          worldPhaseScale: 0.014,
        },
        shouldSpawn() {
          return false;
        },
        applyEffect(context) {
          const center = getPickupCenter(context.pickup);
          const bonus = 150;
          context.runState.actionScore += bonus;
          const scoreEffect = context.createHitEffect(center.x, center.y, "⭐");
          context.spawnHudEmoji(scoreEffect.x, scoreEffect.y, scoreEffect.emoji, "score");
          context.setStatusMessage(`Score-Boost eingesackt: +${bonus}`);
        },
      },
      [PICKUP_TYPE.TEMPORARY_SHIELD]: {
        type: PICKUP_TYPE.TEMPORARY_SHIELD,
        label: "Schutzschild",
        emoji: "🛡",
        hudStatKey: "lives",
        platformSpawnable: false,
        spawnTelegraphDuration: config.spawnTelegraphDuration,
        minimumPlatformWidth: 110,
        minimumSafeZoneWidth: 42,
        radius: 16,
        render: {
          glyph: "🛡",
          fillStyle: "#c8f4ff",
          strokeStyle: "#2b6c7d",
          font: "700 34px Trebuchet MS",
          lineWidth: 2.5,
          bobAmplitude: 4,
          bobTimeDivisor: 220,
          worldPhaseScale: 0.011,
        },
        shouldSpawn() {
          return false;
        },
        applyEffect(context) {
          const center = getPickupCenter(context.pickup);
          context.player.invincible = Math.max(context.player.invincible, 2500);
          const shieldEffect = context.createHitEffect(center.x, center.y, "🛡");
          context.spawnHudEmoji(shieldEffect.x, shieldEffect.y, shieldEffect.emoji, "lives");
          context.setStatusMessage("Schutzschild aktiv");
        },
      },
      [PICKUP_TYPE.EVENT_TRIGGER]: {
        type: PICKUP_TYPE.EVENT_TRIGGER,
        label: "Event-Trigger",
        emoji: "!",
        hudStatKey: "score",
        platformSpawnable: false,
        spawnTelegraphDuration: config.spawnTelegraphDuration,
        minimumPlatformWidth: 110,
        minimumSafeZoneWidth: 42,
        radius: 16,
        render: {
          glyph: "!",
          fillStyle: "#ffd5b3",
          strokeStyle: "#7a3515",
          font: "700 40px Trebuchet MS",
          lineWidth: 2.5,
          bobAmplitude: 5,
          bobTimeDivisor: 190,
          worldPhaseScale: 0.013,
        },
        shouldSpawn() {
          return false;
        },
        applyEffect(context) {
          context.triggerEvent?.(context.pickup.triggerEventType ?? null);
          context.setStatusMessage("Event-Trigger gesammelt");
        },
      },
    };
  }

  /**
   * Creates the runtime pickup system helpers for entity creation, rendering metadata and effect application.
   *
   * @param {Record<string, object>} definitions - Pickup definition table.
   * @returns {{getDefinition:Function,createPickup:Function,canSpawnOnPlatform:Function,shouldSpawnOnPlatform:Function,updateSpawnTimers:Function,applyEffect:Function,getRenderModel:Function}} Pickup helpers.
   */
  function createPickupSystem(definitions) {
    function getDefinition(type) {
      if (typeof type !== "string") {
        return null;
      }

      return definitions[type] ?? null;
    }

    function createPickup(type, x, y, options = {}) {
      const definition = getDefinition(type);
      if (!definition) {
        return null;
      }

      const {
        telegraph = false,
        spawnDuration = definition.spawnTelegraphDuration ?? 0,
        ...metadata
      } = options;
      return {
        ...metadata,
        type,
        x,
        y,
        r: definition.radius ?? 14,
        collected: false,
        spawnTimer: telegraph ? spawnDuration : 0,
        spawnDuration,
      };
    }

    function canSpawnOnPlatform(type, platform) {
      const definition = getDefinition(type);
      if (!definition || definition.platformSpawnable === false) {
        return false;
      }

      return platform.w >= (definition.minimumPlatformWidth ?? 0);
    }

    function shouldSpawnOnPlatform(type, context) {
      const definition = getDefinition(type);
      if (!definition) {
        return false;
      }

      if (typeof definition.shouldSpawn !== "function") {
        return true;
      }

      return definition.shouldSpawn(context);
    }

    function updateSpawnTimers(pickups, delta) {
      pickups.forEach((pickup) => {
        if (pickup.spawnTimer > 0) {
          pickup.spawnTimer = Math.max(0, pickup.spawnTimer - delta);
        }
      });
    }

    function applyEffect(type, context) {
      const definition = getDefinition(type);
      if (!definition?.applyEffect) {
        return false;
      }

      definition.applyEffect(context);
      return true;
    }

    function getRenderModel(type) {
      return getDefinition(type)?.render ?? null;
    }

    return {
      getDefinition,
      createPickup,
      canSpawnOnPlatform,
      shouldSpawnOnPlatform,
      updateSpawnTimers,
      applyEffect,
      getRenderModel,
    };
  }

  globalScope.RedDunePickups = Object.freeze({
    PICKUP_TYPE,
    createPickupDefinitions,
    createPickupSystem,
  });
})(typeof self !== "undefined" ? self : globalThis);
