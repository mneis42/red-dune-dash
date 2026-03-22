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
  assert.equal(typeof cli.isAggregateOnlySignal, "function");
  assert.equal(typeof cli.shouldSuppressAggregateHint, "function");
  assert.equal(typeof cli.isProblemRuntimeState, "function");
  assert.equal(typeof cli.describeProblemState, "function");
  assert.equal(typeof cli.parseRuntimeStateMap, "function");
  assert.equal(typeof cli.parseNameValuePairs, "function");
  assert.equal(typeof cli.evaluateRuntimeSignals, "function");
  assert.equal(typeof cli.buildPolicyGateStatus, "function");
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
  const result = cli.parseRuntimeStateMap(
    '{"verify-linux":"success","required-gate":"failure","cross-platform":"cancelled","docs":"skipped","ignored":"weird"}'
  );

  assert.deepEqual(result, {
    "verify-linux": "pass",
    "required-gate": "fail",
    "cross-platform": "cancelled",
    docs: "skipped",
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

test("evaluateRuntimeSignals treats cancelled github job states as visible advisory problems", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["cross-platform-verify"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: ["cross-platform-verify=cancelled"],
    ciCheckOutcomes: [],
  });

  assert.equal(runtime.matchedSignals[0].status, "cancelled");
  assert.match(runtime.actionableHints.join("\n"), /Cross-platform verification job was cancelled/);
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

test("evaluateRuntimeSignals suppresses not-observed hints when no runtime signals were provided", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["verify-linux-signals", "cross-platform-verify", "required-check"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: [],
    ciCheckOutcomes: [],
  });

  assert.equal(runtime.hasExplicitRuntimeSignals, false);
  assert.equal(runtime.matchedSignals.every((entry) => entry.status === "not-observed"), true);
  assert.deepEqual(runtime.actionableHints, []);
});

test("evaluateRuntimeSignals suppresses unrelated not-observed hints for partial runtime context", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["instruction-lint", "cross-platform-verify", "required-check"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: ["cross-platform-verify=cancelled"],
    ciCheckOutcomes: [],
  });

  assert.equal(runtime.hasExplicitRuntimeSignals, true);
  assert.match(runtime.actionableHints.join("\n"), /Cross-platform verification job was cancelled/);
  assert.equal(runtime.actionableHints.some((entry) => entry.includes("Instruction lint has no observed runtime outcome")), false);
  assert.equal(runtime.actionableHints.some((entry) => entry.includes("Required compatibility gate has no observed runtime outcome")), false);
});

test("evaluateRuntimeSignals keeps missing-runtime hints out of warningHints", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["instruction-lint"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: [],
    ciCheckOutcomes: ["npm run instruction:lint=missing"],
  });

  assert.equal(runtime.actionableHints.some((entry) => entry.includes("has no observed runtime outcome")), true);
  assert.deepEqual(runtime.warningHints, []);
});

test("evaluateRuntimeSignals prefers specific docs and backlog lint hints for workflow-doc changes", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["instruction-lint", "docs-language-lint", "backlog-lint", "verify-linux-signals"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: ["verify-linux-signals=failure"],
    ciCheckOutcomes: ["npm run docs:language:lint=failure", "npm run backlog:lint=failure"],
  });

  assert.match(runtime.actionableHints.join("\n"), /Docs language lint is currently failing/);
  assert.match(runtime.actionableHints.join("\n"), /Backlog lint is currently failing/);
  assert.equal(runtime.actionableHints.some((entry) => entry.includes("Linux verification job is currently failing")), false);
});

test("evaluateRuntimeSignals keeps aggregate job hint when no specific failed check explains it", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["verify-linux-signals"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: ["verify-linux-signals=failure"],
    ciCheckOutcomes: [],
  });

  assert.deepEqual(runtime.actionableHints, ["Linux verification job is currently failing (verify-linux-signals)."]);
});

test("evaluateRuntimeSignals keeps independent aggregate job hints alongside specific check failures", () => {
  const cli = loadCliModuleFresh();
  const advisory = {
    merged: {
      ciSignals: ["docs-language-lint", "verify-linux-signals", "cross-platform-verify"],
    },
  };
  const runtime = cli.evaluateRuntimeSignals(advisory, {
    ciJobStatuses: ["verify-linux-signals=failure", "cross-platform-verify=failure"],
    ciCheckOutcomes: ["npm run docs:language:lint=failure"],
  });

  assert.match(runtime.actionableHints.join("\n"), /Docs language lint is currently failing/);
  assert.equal(runtime.actionableHints.some((entry) => entry.includes("Linux verification job is currently failing")), false);
  assert.match(runtime.actionableHints.join("\n"), /Cross-platform verification job is currently failing/);
});

test("buildPolicyGateStatus exposes warning mode and selective hard-fail candidates", () => {
  const cli = loadCliModuleFresh();
  const policy = cli.buildPolicyGateStatus({
    warningHints: ["Instruction lint is currently failing (npm run instruction:lint)."],
    actionableHints: ["Instruction lint is currently failing (npm run instruction:lint)."],
  }, {
    stages: [
      {
        id: "stage-1-advisory",
        label: "Advisory only",
        blocking: false,
        status: "active",
        summary: "Changed-file matching and workflow hints stay advisory and do not reroute canonical workflows.",
      },
      {
        id: "stage-2-warning",
        label: "Warning mode",
        blocking: false,
        status: "runtime-evaluated",
        summary: "Explicit risky runtime states surface as non-blocking warnings based on deterministic CI signals.",
      },
        {
          id: "stage-3-hard-fail",
          label: "Selective hard fail",
          blocking: true,
          status: "selective-enforcement",
          summary: "Only narrow, high-confidence policy gates should block.",
          candidateGates: [
            { id: "broken-instruction-references", status: "enforced", confidence: "high", blocking: true },
            { id: "protected-branch-violations", status: "candidate-only", confidence: "high", blocking: false },
          ],
        },
      ],
  });

  assert.equal(policy.stages.length, 3);
  assert.equal(policy.stages[0].id, "stage-1-advisory");
  assert.equal(policy.stages[1].id, "stage-2-warning");
  assert.equal(policy.stages[1].status, "active-with-warnings");
  assert.deepEqual(policy.stages[1].warnings, ["Instruction lint is currently failing (npm run instruction:lint)."]);
  assert.equal(policy.stages[2].id, "stage-3-hard-fail");
  assert.equal(policy.stages[2].candidateGates.some((entry) => entry.id === "protected-branch-violations"), true);
  assert.equal(policy.stages[2].candidateGates.some((entry) => entry.status === "enforced"), true);
});

test("formatHumanReadable includes runtime signal sections when provided", () => {
  const cli = loadCliModuleFresh();
  const policyGates = cli.buildPolicyGateStatus(
    {
      warningHints: ["Service worker tests is currently failing (npm run test:service-worker)."],
      actionableHints: ["Service worker tests is currently failing (npm run test:service-worker)."],
    },
    {
      stages: [
        {
          id: "stage-1-advisory",
          label: "Advisory only",
          blocking: false,
          status: "active",
          summary: "Changed-file matching and workflow hints stay advisory and do not reroute canonical workflows.",
        },
        {
          id: "stage-2-warning",
          label: "Warning mode",
          blocking: false,
          status: "runtime-evaluated",
          summary: "Explicit risky runtime states surface as non-blocking warnings based on deterministic CI signals.",
        },
        {
          id: "stage-3-hard-fail",
          label: "Selective hard fail",
          blocking: true,
          status: "selective-enforcement",
          summary: "Only narrow, high-confidence policy gates should block.",
          candidateGates: [{ id: "protected-branch-violations", status: "candidate-only", confidence: "high", blocking: false }],
        },
      ],
    }
  );
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
    policyGates,
  });

  assert.match(output, /CI runtime signals/);
  assert.match(output, /job verify-linux: pass/);
  assert.match(output, /check npm run test:service-worker: fail/);
  assert.match(output, /signal service-worker-tests \(Service worker tests\): fail/);
  assert.match(output, /Advisory CI hints/);
  assert.match(output, /Progressive policy gates/);
  assert.match(output, /stage-2-warning \(Warning mode\): active-with-warnings, non-blocking/);
  assert.match(output, /gate protected-branch-violations: candidate-only, non-blocking, confidence=high/);
});

test("formatHumanReadable tolerates callers that do not pass policyGates", () => {
  const cli = loadCliModuleFresh();
  const output = cli.formatHumanReadable({
    changedFiles: ["README.md"],
    merged: {
      areas: ["workflow-docs"],
      recommendedChecks: [],
      manualChecks: [],
    },
    matchedRules: [{ id: "workflow-docs-core" }],
    perFile: [{ filePath: "README.md", ruleIds: ["workflow-docs-core"], usedFallback: false }],
    runtimeSignals: {
      jobStatuses: {},
      checkOutcomes: {},
      matchedSignals: [],
      actionableHints: [],
    },
  });

  assert.match(output, /Progressive policy gates/);
});

test("formatHumanReadable keeps policy gate section on clean working trees", () => {
  const cli = loadCliModuleFresh();
  const output = cli.formatHumanReadable({
    changedFiles: [],
    merged: {
      areas: [],
      recommendedChecks: [],
      manualChecks: [],
    },
    matchedRules: [],
    perFile: [],
    runtimeSignals: {
      jobStatuses: {},
      checkOutcomes: {},
      matchedSignals: [],
      warningHints: [],
      actionableHints: [],
    },
    policyGates: {
      stages: [
        {
          id: "stage-1-advisory",
          label: "Advisory only",
          blocking: false,
          status: "active",
          summary: "Changed-file matching and workflow hints stay advisory and do not reroute canonical workflows.",
        },
      ],
    },
  });

  assert.match(output, /No local file changes detected\./);
  assert.match(output, /Progressive policy gates/);
  assert.match(output, /stage-1-advisory \(Advisory only\): active, non-blocking/);
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
  assert.equal(Array.isArray(payload.policyGates.stages), true);
  assert.equal(payload.policyGates.stages[2].id, "stage-3-hard-fail");
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
