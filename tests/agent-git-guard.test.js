const assert = require("node:assert/strict");
const { createTestHarness } = require("./test-helpers.js");

const {
  parseArgs,
  isIndexLockFailure,
  waitForLockRelease,
  runCommitWithRecovery,
  parsePushTarget,
  verifyRemoteTracking,
  runPushWithVerification,
} = require("../scripts/agent-git-guard.js");

const { test, run } = createTestHarness("test:git-guard");

test("parseArgs reads command and git args after separator", () => {
  const result = parseArgs(["commit", "--", "-m", "test"]);
  assert.equal(result.command, "commit");
  assert.deepEqual(result.gitArgs, ["-m", "test"]);
  assert.deepEqual(result.errors, []);
});

test("parseArgs rejects unsupported command", () => {
  const result = parseArgs(["status"]);
  assert.ok(result.errors.some((entry) => entry.includes("Unsupported command")));
});

test("isIndexLockFailure detects git index lock errors", () => {
  assert.equal(
    isIndexLockFailure({ stdout: "", stderr: "fatal: Unable to create '/repo/.git/index.lock': File exists." }),
    true
  );
  assert.equal(
    isIndexLockFailure({ stdout: "", stderr: "Another git process seems to be running in this repository." }),
    true
  );
  assert.equal(isIndexLockFailure({ stdout: "", stderr: "fatal: other failure" }), false);
  assert.equal(
    isIndexLockFailure({ stdout: "", stderr: "fatal: Unable to create '/repo/.git/index.lock': Operation not permitted" }),
    false
  );
});

test("waitForLockRelease retries until the lock disappears", () => {
  let calls = 0;
  const result = waitForLockRelease("/repo/.git/index.lock", {
    pollMs: 1,
    maxAttempts: 4,
    existsSync: () => {
      calls += 1;
      return calls < 3;
    },
    sleep: () => {},
  });

  assert.equal(result.released, true);
  assert.equal(result.checks.length, 3);
  assert.equal(result.checks[2].present, false);
});

test("runCommitWithRecovery retries once after index lock clears", () => {
  const runnerCalls = [];
  const responses = [
    {
      status: 1,
      stdout: "",
      stderr: "fatal: Unable to create '/repo/.git/index.lock': File exists.",
      signal: null,
      error: null,
    },
    {
      status: 0,
      stdout: "[branch 123] test\n",
      stderr: "",
      signal: null,
      error: null,
    },
  ];

  let existsCalls = 0;
  const result = runCommitWithRecovery(["-m", "test"], {
    runner: (_command, args) => {
      runnerCalls.push(args);
      return responses.shift();
    },
    exec: (_command, args) => {
      if (args.join(" ") === "rev-parse --git-path index.lock") {
        return ".git/index.lock\n";
      }
      throw new Error(`unexpected git args: ${args.join(" ")}`);
    },
    existsSync: () => {
      existsCalls += 1;
      return existsCalls === 1;
    },
    sleep: () => {},
  });

  assert.equal(result.ok, true);
  assert.equal(result.retried, true);
  assert.equal(result.recovered, true);
  assert.deepEqual(runnerCalls, [
    ["commit", "-m", "test"],
    ["commit", "-m", "test"],
  ]);
});

test("runCommitWithRecovery stops when the index lock persists", () => {
  const result = runCommitWithRecovery(["-m", "test"], {
    runner: () => ({
      status: 1,
      stdout: "",
      stderr: "fatal: Unable to create '/repo/.git/index.lock': File exists.",
      signal: null,
      error: null,
    }),
    exec: () => ".git/index.lock\n",
    existsSync: () => true,
    sleep: () => {},
  });

  assert.equal(result.ok, false);
  assert.equal(result.retried, false);
  assert.match(result.message, /lock persisted/);
});

test("runCommitWithRecovery does not retry non-lock commit failures", () => {
  let attempts = 0;
  const result = runCommitWithRecovery(["-m", "test"], {
    runner: () => {
      attempts += 1;
      return {
        status: 1,
        stdout: "",
        stderr: "fatal: unable to auto-detect email address",
        signal: null,
        error: null,
      };
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.retried, false);
  assert.equal(attempts, 1);
  assert.match(result.message, /git commit failed/);
});

test("parsePushTarget falls back to upstream when push args do not name a target", () => {
  const result = parsePushTarget([], (_command, args) => {
    if (args.join(" ") === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
      return "origin/feature\n";
    }
    throw new Error(`unexpected git args: ${args.join(" ")}`);
  });

  assert.equal(result.remoteRef, "origin/feature");
  assert.equal(result.source, "upstream");
});

test("parsePushTarget keeps origin when push uses -u origin HEAD", () => {
  const result = parsePushTarget(["-u", "origin", "HEAD"], (_command, args) => {
    const joined = args.join(" ");
    if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
      throw new Error("no upstream");
    }
    if (joined === "branch --show-current") {
      return "feature/test\n";
    }
    throw new Error(`unexpected git args: ${joined}`);
  });

  assert.equal(result.remoteRef, "origin/feature/test");
  assert.equal(result.source, "push-args");
});

test("parsePushTarget normalizes HEAD refspecs to the current branch", () => {
  const result = parsePushTarget(["origin", "HEAD"], (_command, args) => {
    const joined = args.join(" ");
    if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
      throw new Error("no upstream");
    }
    if (joined === "branch --show-current") {
      return "feature/test\n";
    }
    throw new Error(`unexpected git args: ${joined}`);
  });

  assert.equal(result.remoteRef, "origin/feature/test");
  assert.equal(result.source, "push-args");
});

test("parsePushTarget lets an explicit remote and refspec override upstream", () => {
  const result = parsePushTarget(["other-remote", "HEAD:release"], (_command, args) => {
    const joined = args.join(" ");
    if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
      return "origin/current\n";
    }
    if (joined === "branch --show-current") {
      return "feature/test\n";
    }
    throw new Error(`unexpected git args: ${joined}`);
  });

  assert.equal(result.remoteRef, "other-remote/release");
  assert.equal(result.source, "push-args");
});

test("verifyRemoteTracking detects stale remote refs after fetch", () => {
  const calls = [];
  const result = verifyRemoteTracking(["-u", "origin", "feature"], {
    exec: (_command, args) => {
      calls.push(args.join(" "));
      const joined = args.join(" ");
      if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
        throw new Error("no upstream");
      }
      if (joined === "branch --show-current") {
        return "feature/test\n";
      }
      if (joined === "rev-parse HEAD") {
        return "abc123\n";
      }
      if (joined === "fetch --no-tags origin feature") {
        return "";
      }
      if (joined === "rev-parse refs/remotes/origin/feature") {
        return "def456\n";
      }
      throw new Error(`unexpected git args: ${joined}`);
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /stayed at def456/);
  assert.ok(calls.includes("fetch --no-tags origin feature"));
});

test("verifyRemoteTracking follows an explicit push target instead of upstream", () => {
  const calls = [];
  const result = verifyRemoteTracking(["other-remote", "HEAD:release"], {
    exec: (_command, args) => {
      calls.push(args.join(" "));
      const joined = args.join(" ");
      if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
        return "origin/current\n";
      }
      if (joined === "branch --show-current") {
        return "feature/test\n";
      }
      if (joined === "rev-parse HEAD") {
        return "abc123\n";
      }
      if (joined === "fetch --no-tags other-remote release") {
        return "";
      }
      if (joined === "rev-parse refs/remotes/other-remote/release") {
        return "abc123\n";
      }
      throw new Error(`unexpected git args: ${joined}`);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.target.remoteRef, "other-remote/release");
  assert.ok(calls.includes("fetch --no-tags other-remote release"));
});

test("runPushWithVerification retries once when remote verification lags", () => {
  const runnerCalls = [];
  const pushResponses = [
    { status: 0, stdout: "Everything up-to-date\n", stderr: "", signal: null, error: null },
    { status: 0, stdout: "pushed\n", stderr: "", signal: null, error: null },
  ];

  const remoteShas = ["old123\n", "head123\n"];
  const result = runPushWithVerification(["-u", "origin", "feature"], {
    runner: (_command, args) => {
      runnerCalls.push(args);
      return pushResponses.shift();
    },
    exec: (_command, args) => {
      const joined = args.join(" ");
      if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
        throw new Error("no upstream");
      }
      if (joined === "branch --show-current") {
        return "feature/test\n";
      }
      if (joined === "rev-parse HEAD") {
        return "head123\n";
      }
      if (joined === "fetch --no-tags origin feature") {
        return "";
      }
      if (joined === "rev-parse refs/remotes/origin/feature") {
        return remoteShas.shift();
      }
      throw new Error(`unexpected git args: ${joined}`);
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.retried, true);
  assert.equal(result.recovered, true);
  assert.deepEqual(runnerCalls, [
    ["push", "-u", "origin", "feature"],
    ["push", "-u", "origin", "feature"],
  ]);
});

test("runPushWithVerification fails when the remote ref still lags after retry", () => {
  let pushCalls = 0;
  const result = runPushWithVerification(["-u", "origin", "feature"], {
    runner: () => {
      pushCalls += 1;
      return { status: 0, stdout: "Everything up-to-date\n", stderr: "", signal: null, error: null };
    },
    exec: (_command, args) => {
      const joined = args.join(" ");
      if (joined === "rev-parse --abbrev-ref --symbolic-full-name @{u}") {
        throw new Error("no upstream");
      }
      if (joined === "branch --show-current") {
        return "feature/test\n";
      }
      if (joined === "rev-parse HEAD") {
        return "head123\n";
      }
      if (joined === "fetch --no-tags origin feature") {
        return "";
      }
      if (joined === "rev-parse refs/remotes/origin/feature") {
        return "old123\n";
      }
      throw new Error(`unexpected git args: ${joined}`);
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.retried, true);
  assert.equal(pushCalls, 2);
  assert.match(result.message, /verification still failed/);
});

run();
