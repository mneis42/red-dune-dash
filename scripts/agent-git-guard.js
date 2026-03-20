const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const DEFAULT_LOCK_POLL_MS = 250;
const DEFAULT_LOCK_POLL_ATTEMPTS = 6;

function parseArgs(argv) {
  const options = {
    command: null,
    gitArgs: [],
    errors: [],
  };

  const values = Array.isArray(argv) ? argv : [];
  if (values.length === 0) {
    options.errors.push("Missing command. Use commit or push.");
    return options;
  }

  const [command, ...rest] = values;
  if (command !== "commit" && command !== "push") {
    options.errors.push(`Unsupported command: ${command}. Use commit or push.`);
    return options;
  }

  options.command = command;

  const separatorIndex = rest.indexOf("--");
  options.gitArgs = separatorIndex >= 0 ? rest.slice(separatorIndex + 1) : rest;

  if (options.gitArgs.length === 0) {
    options.errors.push(`Missing git arguments for ${command}. Pass them after --.`);
  }

  return options;
}

function runGit(args, exec = execFileSync) {
  return exec("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function tryRunGit(args, exec = execFileSync) {
  try {
    return runGit(args, exec);
  } catch (_error) {
    return null;
  }
}

function runGitCommand(args, runner = spawnSync) {
  const result = runner("git", args, {
    shell: false,
    encoding: "utf8",
    stdio: "pipe",
  });

  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: String(result.stdout || ""),
    stderr: String(result.stderr || ""),
    signal: result.signal || null,
    error: result.error || null,
  };
}

function isIndexLockFailure(result) {
  const combined = `${result.stderr}\n${result.stdout}`;
  if (/another git process seems to be running/i.test(combined)) {
    return true;
  }

  return /index\.lock/i.test(combined) && (/file exists/i.test(combined) || /already exists/i.test(combined));
}

function resolveIndexLockPath(exec = execFileSync) {
  const resolved = tryRunGit(["rev-parse", "--git-path", "index.lock"], exec);
  if (resolved) {
    return path.resolve(process.cwd(), resolved);
  }

  const gitDir = tryRunGit(["rev-parse", "--git-dir"], exec) || ".git";
  return path.resolve(process.cwd(), gitDir, "index.lock");
}

function wait(ms, sleep = null) {
  if (typeof sleep === "function") {
    sleep(ms);
    return;
  }

  const delayUntil = Date.now() + ms;
  while (Date.now() < delayUntil) {
    // Busy wait keeps the helper dependency-free for small recovery windows.
  }
}

function waitForLockRelease(lockPath, options = {}) {
  const existsSync = options.existsSync || fs.existsSync;
  const sleep = options.sleep || null;
  const pollMs = Number.isInteger(options.pollMs) ? options.pollMs : DEFAULT_LOCK_POLL_MS;
  const maxAttempts = Number.isInteger(options.maxAttempts) ? options.maxAttempts : DEFAULT_LOCK_POLL_ATTEMPTS;

  const checks = [];
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const present = existsSync(lockPath);
    checks.push({ attempt: attempt + 1, present });
    if (!present) {
      return { released: true, checks };
    }

    if (attempt < maxAttempts - 1) {
      wait(pollMs, sleep);
    }
  }

  return { released: false, checks };
}

function buildResultSummary(prefix, result) {
  const lines = [prefix];
  if (result.stdout.trim()) {
    lines.push(`stdout: ${result.stdout.trim()}`);
  }
  if (result.stderr.trim()) {
    lines.push(`stderr: ${result.stderr.trim()}`);
  }
  if (result.signal) {
    lines.push(`signal: ${result.signal}`);
  }
  if (result.error) {
    lines.push(`error: ${result.error.message}`);
  }
  return lines.join("\n");
}

function runCommitWithRecovery(gitArgs, options = {}) {
  const runner = options.runner || spawnSync;
  const exec = options.exec || execFileSync;
  const existsSync = options.existsSync || fs.existsSync;
  const sleep = options.sleep || null;

  const firstAttempt = runGitCommand(["commit", ...gitArgs], runner);
  if (firstAttempt.status === 0) {
    return {
      ok: true,
      retried: false,
      recovered: false,
      attempts: [firstAttempt],
      message: "git commit succeeded on the first attempt.",
    };
  }

  if (!isIndexLockFailure(firstAttempt)) {
    return {
      ok: false,
      retried: false,
      recovered: false,
      attempts: [firstAttempt],
      message: buildResultSummary("git commit failed.", firstAttempt),
    };
  }

  const lockPath = resolveIndexLockPath(exec);
  const lockWait = waitForLockRelease(lockPath, { existsSync, sleep });
  if (!lockWait.released) {
    return {
      ok: false,
      retried: false,
      recovered: false,
      attempts: [firstAttempt],
      lockPath,
      lockChecks: lockWait.checks,
      message: `git commit hit index.lock contention and the lock persisted at ${lockPath}. Remove the lock owner or wait for it to clear before retrying.`,
    };
  }

  const retryAttempt = runGitCommand(["commit", ...gitArgs], runner);
  if (retryAttempt.status === 0) {
    return {
      ok: true,
      retried: true,
      recovered: true,
      attempts: [firstAttempt, retryAttempt],
      lockPath,
      lockChecks: lockWait.checks,
      message: `git commit recovered after index.lock contention cleared at ${lockPath}.`,
    };
  }

  return {
    ok: false,
    retried: true,
    recovered: false,
    attempts: [firstAttempt, retryAttempt],
    lockPath,
    lockChecks: lockWait.checks,
    message: buildResultSummary(
      `git commit retried after index.lock contention cleared at ${lockPath}, but the retry still failed.`,
      retryAttempt
    ),
  };
}

function getCurrentBranch(exec = execFileSync) {
  return runGit(["branch", "--show-current"], exec) || "HEAD";
}

function parsePushTarget(pushArgs, exec = execFileSync) {
  const upstream = tryRunGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], exec);
  if (upstream) {
    const slashIndex = upstream.indexOf("/");
    if (slashIndex > 0) {
      const remote = upstream.slice(0, slashIndex);
      const branch = upstream.slice(slashIndex + 1);
      return {
        remote,
        branch,
        source: "upstream",
        remoteRef: `${remote}/${branch}`,
        trackingRef: `refs/remotes/${remote}/${branch}`,
      };
    }
  }

  const positional = [];
  for (let index = 0; index < pushArgs.length; index += 1) {
    const value = String(pushArgs[index]);

    if (value === "-u" || value === "--set-upstream") {
      index += 1;
      continue;
    }

    if (value.startsWith("-")) {
      continue;
    }

    positional.push(value);
  }

  const remote = positional[0] || "origin";
  const currentBranch = getCurrentBranch(exec);
  const refspec = positional[1] || currentBranch;
  const destination = refspec.includes(":") ? refspec.split(":").pop() : refspec;
  const normalizedDestination = destination === "HEAD" ? currentBranch : destination;
  const branch = String(normalizedDestination || currentBranch).replace(/^refs\/heads\//, "");

  return {
    remote,
    branch,
    source: "push-args",
    remoteRef: `${remote}/${branch}`,
    trackingRef: `refs/remotes/${remote}/${branch}`,
  };
}

function verifyRemoteTracking(pushArgs, options = {}) {
  const exec = options.exec || execFileSync;
  const target = parsePushTarget(pushArgs, exec);
  const headSha = runGit(["rev-parse", "HEAD"], exec);

  try {
    exec("git", ["fetch", "--no-tags", target.remote, target.branch], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    return {
      ok: false,
      target,
      headSha,
      remoteSha: null,
      reason: `Failed to refresh ${target.remoteRef}: ${error.message}`,
    };
  }

  const remoteSha = tryRunGit(["rev-parse", target.trackingRef], exec);
  if (!remoteSha) {
    return {
      ok: false,
      target,
      headSha,
      remoteSha: null,
      reason: `Tracked remote ref ${target.trackingRef} could not be resolved after fetch.`,
    };
  }

  return {
    ok: remoteSha === headSha,
    target,
    headSha,
    remoteSha,
    reason:
      remoteSha === headSha
        ? `Verified ${target.remoteRef} at ${remoteSha}.`
        : `Remote ${target.remoteRef} stayed at ${remoteSha} while local HEAD is ${headSha}.`,
  };
}

function runPushWithVerification(gitArgs, options = {}) {
  const runner = options.runner || spawnSync;
  const exec = options.exec || execFileSync;

  const firstAttempt = runGitCommand(["push", ...gitArgs], runner);
  if (firstAttempt.status !== 0) {
    return {
      ok: false,
      retried: false,
      recovered: false,
      attempts: [firstAttempt],
      verification: null,
      message: buildResultSummary("git push failed.", firstAttempt),
    };
  }

  const firstVerification = verifyRemoteTracking(gitArgs, { exec });
  if (firstVerification.ok) {
    return {
      ok: true,
      retried: false,
      recovered: false,
      attempts: [firstAttempt],
      verification: firstVerification,
      message: `git push completed and ${firstVerification.reason}`,
    };
  }

  const retryAttempt = runGitCommand(["push", ...gitArgs], runner);
  if (retryAttempt.status !== 0) {
    return {
      ok: false,
      retried: true,
      recovered: false,
      attempts: [firstAttempt, retryAttempt],
      verification: firstVerification,
      message: `${firstVerification.reason}\n${buildResultSummary("git push retry failed.", retryAttempt)}`,
    };
  }

  const retryVerification = verifyRemoteTracking(gitArgs, { exec });
  if (retryVerification.ok) {
    return {
      ok: true,
      retried: true,
      recovered: true,
      attempts: [firstAttempt, retryAttempt],
      verification: retryVerification,
      message: `git push needed verification recovery but now matches ${retryVerification.target.remoteRef} at ${retryVerification.remoteSha}.`,
    };
  }

  return {
    ok: false,
    retried: true,
    recovered: false,
    attempts: [firstAttempt, retryAttempt],
    verification: retryVerification,
    message: `git push looked successful twice, but verification still failed. ${retryVerification.reason}`,
  };
}

function printResult(result) {
  const output = String(result.message || "").trim();
  if (output) {
    const writer = result.ok ? console.log : console.error;
    writer(output);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.errors.length > 0) {
    options.errors.forEach((entry) => console.error(entry));
    process.exit(1);
  }

  const result =
    options.command === "commit"
      ? runCommitWithRecovery(options.gitArgs)
      : runPushWithVerification(options.gitArgs);

  printResult(result);
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  runGit,
  tryRunGit,
  runGitCommand,
  isIndexLockFailure,
  resolveIndexLockPath,
  waitForLockRelease,
  runCommitWithRecovery,
  getCurrentBranch,
  parsePushTarget,
  verifyRemoteTracking,
  runPushWithVerification,
};
