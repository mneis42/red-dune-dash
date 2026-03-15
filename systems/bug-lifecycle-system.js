(function registerBugLifecycleSystem(globalScope) {
  const BUG_STATUS = Object.freeze({
    ACTIVE_WORLD: "active-world",
    MISSED: "missed",
    BACKLOG: "backlog",
    RESOLVED: "resolved",
    REACTIVATED: "reactivated",
  });

  /**
   * Creates the run-local bug lifecycle ledger.
   *
   * @returns {{state:{nextId:number,records:Map<number,{id:number,status:string}>},reset:Function,register:Function,setStatus:Function,markResolved:Function,markMissed:Function,getCounts:Function}} Bug lifecycle system.
   */
  function createBugLifecycleSystem() {
    const state = {
      nextId: 1,
      records: new Map(),
    };

    function reset() {
      state.nextId = 1;
      state.records.clear();
    }

    function register(status = BUG_STATUS.ACTIVE_WORLD) {
      const bugId = state.nextId;
      state.nextId += 1;
      state.records.set(bugId, {
        id: bugId,
        status,
      });
      return bugId;
    }

    function setStatus(bugId, status) {
      if (bugId === undefined) {
        return;
      }

      const record = state.records.get(bugId);
      if (!record) {
        return;
      }

      record.status = status;
    }

    function markResolved(bugId) {
      setStatus(bugId, BUG_STATUS.RESOLVED);
    }

    function markMissed(bugId) {
      const record = state.records.get(bugId);
      if (!record || record.status === BUG_STATUS.RESOLVED) {
        return;
      }

      setStatus(bugId, BUG_STATUS.MISSED);
    }

    function getCounts() {
      const counts = {
        activeWorld: 0,
        missed: 0,
        backlog: 0,
        resolved: 0,
        reactivated: 0,
        totalKnown: state.records.size,
      };

      state.records.forEach((record) => {
        if (record.status === BUG_STATUS.ACTIVE_WORLD) {
          counts.activeWorld += 1;
          return;
        }
        if (record.status === BUG_STATUS.MISSED) {
          counts.missed += 1;
          return;
        }
        if (record.status === BUG_STATUS.BACKLOG) {
          counts.backlog += 1;
          return;
        }
        if (record.status === BUG_STATUS.RESOLVED) {
          counts.resolved += 1;
          return;
        }
        if (record.status === BUG_STATUS.REACTIVATED) {
          counts.reactivated += 1;
        }
      });

      return counts;
    }

    return {
      state,
      reset,
      register,
      setStatus,
      markResolved,
      markMissed,
      getCounts,
    };
  }

  globalScope.RedDuneBugLifecycle = Object.freeze({
    BUG_STATUS,
    createBugLifecycleSystem,
  });
})(typeof self !== "undefined" ? self : globalThis);
