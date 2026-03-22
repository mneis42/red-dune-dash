const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadCliModuleFresh() {
  const modulePath = require.resolve("../scripts/agent-advisory.js");
  delete require.cache[modulePath];
  return require(modulePath);
}

test("importing advisory CLI module does not auto-run main", () => {
  const originalLog = console.log;
  const originalError = console.error;
  const logMessages = [];
  const errorMessages = [];

  console.log = (...args) => {
    logMessages.push(args.map((value) => String(value)).join(" "));
  };
  console.error = (...args) => {
    errorMessages.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const cli = loadCliModuleFresh();
    assert.equal(typeof cli.main, "function");
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.equal(logMessages.length, 0);
  assert.equal(errorMessages.length, 0);
});

test("module exports reusable CLI helpers", () => {
  const cli = loadCliModuleFresh();
  assert.equal(typeof cli.parseArgs, "function");
  assert.equal(typeof cli.parseRuntimeStateMap, "function");
  assert.equal(typeof cli.parseNameValuePairs, "function");
  assert.equal(typeof cli.evaluateRuntimeSignals, "function");
  assert.equal(typeof cli.runGit, "function");
  assert.equal(typeof cli.getChangedFiles, "function");
  assert.equal(typeof cli.formatHumanReadable, "function");
  assert.equal(typeof cli.main, "function");
});

test("parseArgs collects explicit CI runtime signal flags", () => {
  const cli = loadCliModuleFresh();
  const options = cli.parseArgs([
    "--files",
    "service-worker.js",
    "--ci-job-status",
    "verify-linux=success",
    "--ci-check-outcome",
    "npm test=fail",
  ]);

  assert.deepEqual(options.files, ["service-worker.js"]);
  assert.deepEqual(options.ciJobStatuses, ["verify-linux=success"]);
  assert.deepEqual(options.ciCheckOutcomes, ["npm test=fail"]);
});

test("parseRuntimeStateMap accepts JSON and normalizes statuses", () => {
  const cli = loadCliModuleFresh();
  const result = cli.parseRuntimeStateMap('{"verify-linux":"success","required-gate":"failure","ignored":"weird"}');

  assert.deepEqual(result, {
    "verify-linux": "pass",
    "required-gate": "fail",
  });
});

test("evaluateRuntimeSignals maps matched CI signals to observed check outcomes", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["syntax", "service-worker-tests"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: ["verify-linux=success"],
    ciCheckOutcomes: ["npm run check=success", "npm run test:service-worker=failure"],
  });

  assert.deepEqual(runtime.jobStatuses, {
    "verify-linux": "pass",
  });
  assert.deepEqual(runtime.checkOutcomes, {
    "npm run check": "pass",
    "npm run test:service-worker": "fail",
  });
  assert.equal(runtime.matchedSignals[0].id, "syntax");
  assert.equal(runtime.matchedSignals[0].status, "pass");
  assert.equal(runtime.matchedSignals[1].id, "service-worker-tests");
  assert.equal(runtime.matchedSignals[1].status, "fail");
  assert.match(runtime.actionableHints.join("\n"), /Service worker tests is currently failing/);
});

test("evaluateRuntimeSignals turns matched failing job status into an advisory hint", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["cross-platform-verify"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: ["cross-platform-verify=failure"],
    ciCheckOutcomes: ["npm run check=success"],
  });

  assert.deepEqual(runtime.jobStatuses, {
    "cross-platform-verify": "fail",
  });
  assert.equal(runtime.matchedSignals[0].status, "fail");
  assert.match(runtime.actionableHints.join("\n"), /Cross-platform verification job is currently failing/);
});

test("evaluateRuntimeSignals keeps unmatched failing job status visible without adding unrelated hints", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["syntax"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: ["cross-platform-verify=failure"],
    ciCheckOutcomes: ["npm run check=success"],
  });

  assert.deepEqual(runtime.jobStatuses, {
    "cross-platform-verify": "fail",
  });
  assert.deepEqual(runtime.actionableHints, []);
});

test("formatHumanReadable includes runtime signal sections when provided", () => {
  const cli = loadCliModuleFresh();
  const output = cli.formatHumanReadable({
    changedFiles: ["service-worker.js"],
    merged: {
      areas: ["pwa"],
      recommendedChecks: ["npm test"],
      manualChecks: ["offline reload smoke check"],
    },
    matchedRules: [{ id: "pwa-offline" }],
    perFile: [{ filePath: "service-worker.js", ruleIds: ["pwa-offline"], usedFallback: false }],
    runtimeSignals: {
      jobStatuses: { "verify-linux": "pass" },
      checkOutcomes: { "npm run test:service-worker": "fail" },
      matchedSignals: [{ id: "service-worker-tests", label: "Service worker tests", status: "fail" }],
      actionableHints: ["Service worker tests is currently failing (npm run test:service-worker)."],
    },
  });

  assert.match(output, /CI runtime signals/);
  assert.match(output, /job verify-linux: pass/);
  assert.match(output, /check npm run test:service-worker: fail/);
  assert.match(output, /signal service-worker-tests \(Service worker tests\): fail/);
  assert.match(output, /Advisory CI hints/);
});

test("main keeps JSON behavior when executed programmatically", () => {
  const cli = loadCliModuleFresh();
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => {
    output.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const exitCode = cli.main([
      "--json",
      "--files",
      "version.json",
      "--ci-job-status",
      "verify-linux=success",
      "--ci-check-outcome",
      "npm run check=success",
    ]);
    assert.equal(exitCode, 0);
  } finally {
    console.log = originalLog;
  }

  assert.equal(output.length, 1);
  const payload = JSON.parse(output[0]);
  assert.deepEqual(payload.changedFiles, ["version.json"]);
  assert.equal(Array.isArray(payload.perFile), true);
  assert.deepEqual(payload.runtimeSignals.jobStatuses, {
    "verify-linux": "pass",
  });
});

test("main returns non-zero for invalid advisory rules without exiting host process", () => {
  const cli = loadCliModuleFresh();
  const tempFilePath = path.join(os.tmpdir(), `invalid-advisory-${Date.now()}.json`);
  const originalError = console.error;
  const errors = [];

  fs.writeFileSync(tempFilePath, JSON.stringify({ version: 1, rules: [] }), "utf8");
  console.error = (...args) => {
    errors.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const exitCode = cli.main(["--rules", tempFilePath]);
    assert.equal(exitCode, 1);
  } finally {
    console.error = originalError;
    fs.rmSync(tempFilePath, { force: true });
  }

  assert.equal(errors.some((line) => line.includes("Invalid advisory rules in")), true);
});

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      console.error(`not ok - ${name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
}

runTests().catch((error) => {
  console.error("not ok - unhandled test runner failure");
  console.error(error);
  process.exitCode = 1;
});
