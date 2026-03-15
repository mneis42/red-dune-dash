(function registerSpecialEventSystem(globalScope) {
  const SPECIAL_EVENT_PHASE = Object.freeze({
    IDLE: "idle",
    ANNOUNCE: "announce",
    ACTIVE: "active",
  });
  const baseChunkGenerationConfig = Object.freeze({
    groundGemChance: 0.55,
    groundBugChance: 0.33,
    plateGemChance: 0.72,
    plateExtraGemChance: 0,
    plateBugChance: 0.3,
    bonusPlatformChance: 0.22,
    bonusExtraGemChance: 0,
    bonusBugChance: 0,
  });

  function pickWeightedEventType(eventTypes, getWeight, randomValue = Math.random()) {
    if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
      return null;
    }

    const weights = eventTypes.map((type) => {
      const weight = Number(getWeight?.(type));
      return Number.isFinite(weight) ? Math.max(0, weight) : 0;
    });
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    if (totalWeight <= 0) {
      return eventTypes[0] ?? null;
    }

    let threshold = Math.min(Math.max(Number(randomValue), 0), 0.999999999) * totalWeight;
    for (let index = 0; index < eventTypes.length; index += 1) {
      threshold -= weights[index];
      if (threshold < 0) {
        return eventTypes[index];
      }
    }

    return eventTypes.at(-1) ?? null;
  }

  /**
   * Creates the event definition table for the current balancing config and runtime hooks.
   *
   * @param {object} specialEventConfig - Active event config block.
   * @param {{randomInt:Function,lerp:Function,clamp:Function,getFallingBugCount:Function,spawnBugWaveBug:Function,spawnBugWaveGroundBug:Function,spawnBigOrderGem:Function,spawnBigOrderBug:Function}} hooks - Runtime hooks from the main game loop.
   * @returns {Record<string, object>} Event definition map.
   */
  function createSpecialEventDefinitions(specialEventConfig, hooks) {
    const {
      randomInt,
      randomChance = Math.random,
      lerp,
      clamp,
      getFallingBugCount,
      spawnBugWaveBug,
      spawnBugWaveGroundBug,
      spawnBigOrderGem,
      spawnBigOrderBug,
    } = hooks;

    return {
      "bug-wave": {
        title: "Bugwelle",
        announcementTitle: "Bugwelle rollt an",
        announcementPrompt: "Bereite dich vor",
        activeStatusMessage: "Bugwelle aktiv. Ausweichen und Bugs auf Plattformen zertrampeln",
        completionStatusMessage: "Bugwelle vorbei",
        rocketSpawnMultiplier: specialEventConfig.bugWaveRocketSpawnMultiplier,
        rocketSpawnPhases: [SPECIAL_EVENT_PHASE.ANNOUNCE, SPECIAL_EVENT_PHASE.ACTIVE],
        createRuntime(phase) {
          if (phase === SPECIAL_EVENT_PHASE.ANNOUNCE) {
            return {
              fallingSpawnTimer: 1400,
              groundSpawnTimer: 1100,
            };
          }
          if (phase === SPECIAL_EVENT_PHASE.ACTIVE) {
            return {
              fallingSpawnTimer: 1200,
              groundSpawnTimer: 950,
            };
          }
          return {};
        },
        updateActive(delta, state) {
          const progress = 1 - state.timer / specialEventConfig.activeDuration;
          const spawnInterval = Math.round(lerp(1700, 320, clamp(progress, 0, 1)));

          state.runtime.fallingSpawnTimer -= delta;
          state.runtime.groundSpawnTimer -= delta;

          while (
            state.runtime.fallingSpawnTimer <= 0 &&
            getFallingBugCount() < specialEventConfig.bugWaveMaxFalling
          ) {
            spawnBugWaveBug();
            state.runtime.fallingSpawnTimer += spawnInterval;
          }

          while (state.runtime.groundSpawnTimer <= 0) {
            spawnBugWaveGroundBug();
            state.runtime.groundSpawnTimer += randomInt(
              specialEventConfig.bugWaveGroundSpawnIntervalMin,
              specialEventConfig.bugWaveGroundSpawnIntervalMax
            );
          }
        },
      },
      "big-order": {
        title: "Großauftrag",
        announcementTitle: "Großauftrag kommt rein",
        announcementPrompt: "Bereite dich vor",
        activeStatusMessage: "Großauftrag aktiv. Mehr Moneten und mehr Bugs unterwegs",
        completionStatusMessage: "Großauftrag abgeschlossen",
        chunkGeneration: specialEventConfig.bigOrder,
        createRuntime(phase) {
          if (phase === SPECIAL_EVENT_PHASE.ANNOUNCE) {
            return {
              gemSpawnTimer: 900,
              bugSpawnTimer: 1200,
            };
          }
          if (phase === SPECIAL_EVENT_PHASE.ACTIVE) {
            return {
              gemSpawnTimer: 700,
              bugSpawnTimer: 1000,
            };
          }
          return {};
        },
        updateActive(delta, state) {
          const bigOrderConfig = specialEventConfig.bigOrder;

          state.runtime.gemSpawnTimer -= delta;
          while (state.runtime.gemSpawnTimer <= 0) {
            spawnBigOrderGem();
            if (randomChance() < bigOrderConfig.visibleExtraGemChance) {
              spawnBigOrderGem();
            }
            state.runtime.gemSpawnTimer += randomInt(
              bigOrderConfig.visibleGemSpawnIntervalMin,
              bigOrderConfig.visibleGemSpawnIntervalMax
            );
          }

          state.runtime.bugSpawnTimer -= delta;
          while (state.runtime.bugSpawnTimer <= 0) {
            spawnBigOrderBug();
            if (randomChance() < bigOrderConfig.visibleExtraBugChance) {
              spawnBigOrderBug();
            }
            state.runtime.bugSpawnTimer += randomInt(
              bigOrderConfig.visibleBugSpawnIntervalMin,
              bigOrderConfig.visibleBugSpawnIntervalMax
            );
          }
        },
      },
    };
  }

  /**
   * Creates the runtime special-event scheduler and query helpers.
   *
   * @param {{config:object,definitions:Record<string,object>,randomInt:Function,randomChance?:Function,debugDelayMs:number|null,debugType:string|null,pickType?:Function,onStatusMessage?:Function}} options - Event system options.
   * @returns {{state:{type:string|null,phase:string,timer:number,runtime:object},getDefinition:Function,getTitle:Function,getInfo:Function,getChunkGenerationRules:Function,getRocketSpawnMultiplier:Function,isActive:Function,scheduleNext:Function,reset:Function,startAnnouncement:Function,activate:Function,complete:Function,update:Function}} Special-event system.
   */
  function createSpecialEventSystem(options) {
    const {
      config,
      definitions,
      randomInt,
      randomChance = Math.random,
      debugDelayMs = null,
      debugType = null,
      pickType: customPickType = null,
      onStatusMessage = () => {},
    } = options;

    const state = {
      type: null,
      phase: SPECIAL_EVENT_PHASE.IDLE,
      timer: 0,
      runtime: {},
    };

    function getDefinition(type) {
      if (typeof type !== "string") {
        return null;
      }

      return definitions[type] ?? null;
    }

    function getCurrentDefinition() {
      return getDefinition(state.type);
    }

    function getActiveDefinition() {
      if (state.phase !== SPECIAL_EVENT_PHASE.ACTIVE) {
        return null;
      }

      return getCurrentDefinition();
    }

    function getTitle(type, forAnnouncement = false) {
      const definition = getDefinition(type);
      if (!definition) {
        return "";
      }

      return forAnnouncement ? definition.announcementTitle : definition.title;
    }

    function getPhaseDuration(type, phase) {
      const definition = getDefinition(type);
      if (phase === SPECIAL_EVENT_PHASE.ANNOUNCE) {
        return definition?.announceDuration ?? config.announceDuration;
      }
      if (phase === SPECIAL_EVENT_PHASE.ACTIVE) {
        return definition?.activeDuration ?? config.activeDuration;
      }
      return 0;
    }

    function getNextDelay() {
      return debugDelayMs ?? randomInt(config.minDelay, config.maxDelay);
    }

    function createRuntime(type, phase) {
      const definition = getDefinition(type);
      return definition?.createRuntime ? definition.createRuntime(phase) : {};
    }

    function setState(type, phase, timer) {
      state.type = type;
      state.phase = phase;
      state.timer = timer;
      state.runtime = createRuntime(type, phase);
    }

    function pickType() {
      if (getDefinition(debugType)) {
        return debugType;
      }

      const eventTypes = Object.keys(definitions);
      if (eventTypes.length === 0) {
        return null;
      }

      if (typeof customPickType === "function") {
        const nextType = customPickType({
          eventTypes,
          definitions,
          getDefinition,
          randomInt,
          randomChance,
        });
        if (getDefinition(nextType)) {
          return nextType;
        }
      }

      return eventTypes[randomInt(0, eventTypes.length - 1)];
    }

    function getInfo() {
      const definition = getCurrentDefinition();
      if (!definition || state.phase === SPECIAL_EVENT_PHASE.IDLE) {
        return null;
      }

      return {
        type: state.type,
        phase: state.phase,
        timer: state.timer,
        title: definition.title,
        announcementTitle: definition.announcementTitle,
        announcementPrompt: definition.announcementPrompt ?? "Bereite dich vor",
      };
    }

    function getChunkGenerationRules() {
      const activeDefinition = getActiveDefinition();
      if (!activeDefinition?.chunkGeneration) {
        return baseChunkGenerationConfig;
      }

      return { ...baseChunkGenerationConfig, ...activeDefinition.chunkGeneration };
    }

    function getRocketSpawnMultiplier() {
      const definition = getCurrentDefinition();
      if (!definition?.rocketSpawnMultiplier) {
        return 1;
      }

      if (!definition.rocketSpawnPhases?.includes(state.phase)) {
        return 1;
      }

      return definition.rocketSpawnMultiplier;
    }

    function getAnnouncementMessage(type) {
      const seconds = Math.ceil(getPhaseDuration(type, SPECIAL_EVENT_PHASE.ANNOUNCE) / 1000);
      return `${getTitle(type, true)} in ${seconds} Sekunden`;
    }

    function isActive(type) {
      return state.phase === SPECIAL_EVENT_PHASE.ACTIVE && state.type === type;
    }

    function scheduleNext() {
      setState(null, SPECIAL_EVENT_PHASE.IDLE, getNextDelay());
    }

    function reset() {
      scheduleNext();
    }

    function startAnnouncement() {
      const nextType = pickType();
      if (!nextType) {
        scheduleNext();
        return;
      }

      setState(nextType, SPECIAL_EVENT_PHASE.ANNOUNCE, getPhaseDuration(nextType, SPECIAL_EVENT_PHASE.ANNOUNCE));
      onStatusMessage(getAnnouncementMessage(nextType));
    }

    function activate() {
      const currentType = state.type;
      const definition = getCurrentDefinition();
      if (!currentType || !definition) {
        scheduleNext();
        return;
      }

      setState(currentType, SPECIAL_EVENT_PHASE.ACTIVE, getPhaseDuration(currentType, SPECIAL_EVENT_PHASE.ACTIVE));
      onStatusMessage(definition.activeStatusMessage);
    }

    function complete() {
      const definition = getCurrentDefinition();
      onStatusMessage(definition?.completionStatusMessage ?? "Sonderevent abgeschlossen");
      scheduleNext();
    }

    function update(delta) {
      if (state.phase === SPECIAL_EVENT_PHASE.IDLE) {
        state.timer = Math.max(0, state.timer - delta);
        if (state.timer === 0) {
          startAnnouncement();
        }
        return;
      }

      state.timer = Math.max(0, state.timer - delta);

      if (state.phase === SPECIAL_EVENT_PHASE.ANNOUNCE) {
        if (state.timer === 0) {
          activate();
        }
        return;
      }

      const definition = getCurrentDefinition();
      definition?.updateActive?.(delta, state);

      if (state.timer === 0) {
        complete();
      }
    }

    scheduleNext();

    return {
      state,
      getDefinition,
      getTitle,
      getInfo,
      getChunkGenerationRules,
      getRocketSpawnMultiplier,
      isActive,
      scheduleNext,
      reset,
      startAnnouncement,
      activate,
      complete,
      update,
    };
  }

  globalScope.RedDuneSpecialEvents = Object.freeze({
    SPECIAL_EVENT_PHASE,
    baseChunkGenerationConfig,
    pickWeightedEventType,
    createSpecialEventDefinitions,
    createSpecialEventSystem,
  });
})(typeof self !== "undefined" ? self : globalThis);
