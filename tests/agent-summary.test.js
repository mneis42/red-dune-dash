const assert = require("node:assert/strict");

const {
  parseArgs,
  parseAllowedCheckCommand,
  detectDefaultBaseRef,
  getBranchChangedFiles,
  resolveUserImpact,
  buildOpenQuestions,
  buildCopyBlock,
  buildSummaryResult,
  buildPrePrChecklistOutcome,
  isFailingCheckStatus,
  formatHumanReadable,
  getChangedFiles,
} = require("../scripts/agent-summary.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function createAdvisoryResult(overrides = {}) {
  return {
    matchedRules: overrides.matchedRules || [
      { id: "gameplay-core", area: "gameplay" },
      { id: "workflow-docs", area: "workflow-docs" },
    ],
    merged: {
      areas: overrides.areas || ["gameplay", "workflow-docs"],
      riskTags: overrides.riskTags || ["game-balance", "process-drift"],
      recommendedChecks: overrides.recommendedChecks || ["npm run check", "npm test"],
      manualChecks: overrides.manualChecks || ["manual smoke check"],
      suggestedDocs: overrides.suggestedDocs || ["README.md"],
      suggestedReading: overrides.suggestedReading || ["AGENTS.md"],
      ciSignals: [],
    },
    perFile: overrides.perFile || [
      { filePath: "systems/simulation-core.js", ruleIds: ["gameplay-core"], usedFallback: false },
      { filePath: "todo.md", ruleIds: ["fallback-unclassified"], usedFallback: true },
    ],
  };
}

test("parseArgs supports json, staged, base, run-checks, files, and rules flags", () => {
  const options = parseArgs([
    "--json",
    "--staged",
    "--base",
    "origin/main",
    "--run-checks",
    "--files",
    "a.js,b.js",
    "--rules",
    "workflow/custom.json",
  ]);

  assert.deepEqual(options, {
    json: true,
    staged: true,
    baseRef: "origin/main",
    files: ["a.js", "b.js"],
    rulesPath: "workflow/custom.json",
    runChecks: true,
    includeLogs: false,
    contractConsumers: null,
    contractInseparable: false,
    errors: [],
  });
});

test("detectDefaultBaseRef returns null when origin head cannot be resolved", () => {
  const fakeExec = () => {
    throw new Error("missing origin head");
  };

  assert.equal(detectDefaultBaseRef(fakeExec), null);
});

test("getBranchChangedFiles returns empty array when diff lookup fails", () => {
  assert.deepEqual(getBranchChangedFiles(null), []);
});

test("parseArgs supports contract consumer options", () => {
  const options = parseArgs(["--contract-consumers", "3", "--contract-inseparable"]);

  assert.equal(options.contractConsumers, 3);
  assert.equal(options.contractInseparable, true);
  assert.deepEqual(options.errors, []);
});

test("parseArgs supports include-logs flag", () => {
  const options = parseArgs(["--include-logs"]);
  assert.equal(options.includeLogs, true);
  assert.equal(options.contractConsumers, null);
  assert.equal(options.contractInseparable, false);
});

test("parseArgs reports missing values for --files and --rules without consuming next flags", () => {
  const options = parseArgs(["--files", "--rules", "workflow/custom.json"]);

  assert.ok(options.errors.includes("Missing value for --files."));
  assert.equal(options.files, null);
  assert.equal(options.rulesPath, "workflow/custom.json");
});

test("parseArgs reports missing value for --rules", () => {
  const options = parseArgs(["--rules"]);
  assert.ok(options.errors.includes("Missing value for --rules."));
  assert.equal(options.rulesPath, null);
});

test("parseAllowedCheckCommand accepts npm test and npm run script commands", () => {
  assert.deepEqual(parseAllowedCheckCommand("npm test"), {
    executable: "npm",
    args: ["test"],
  });
  assert.deepEqual(parseAllowedCheckCommand("npm run check"), {
    executable: "npm",
    args: ["run", "check"],
  });
});

test("parseAllowedCheckCommand rejects unsafe shell-like commands", () => {
  assert.equal(parseAllowedCheckCommand("npm run check && rm -rf /"), null);
  assert.equal(parseAllowedCheckCommand("node script.js"), null);
});

test("resolveUserImpact maps known areas and deduplicates output", () => {
  const advisory = createAdvisoryResult({ areas: ["gameplay", "workflow-docs", "gameplay"] });
  const impact = resolveUserImpact(advisory);

  assert.equal(impact.length, 2);
  assert.match(impact[0], /Gameplay behavior/);
  assert.match(impact[1], /workflow and process guidance/i);
});

test("buildOpenQuestions covers fallback files and not-run checks", () => {
  const advisory = createAdvisoryResult();
  const questions = buildOpenQuestions(advisory, [
    { command: "npm run check", status: "not-run" },
    { command: "npm test", status: "not-run" },
  ]);

  assert.match(questions.join("\n"), /unclassified files/);
  assert.match(questions.join("\n"), /recommended checks/);
});

test("buildOpenQuestions reports deterministic no-question fallback", () => {
  const advisory = createAdvisoryResult({ perFile: [] });
  const questions = buildOpenQuestions(advisory, [
    { command: "npm run check", status: "pass" },
  ]);

  assert.deepEqual(questions, ["No open questions from deterministic signals."]);
});

test("buildCopyBlock returns concise, copy-ready section", () => {
  const block = buildCopyBlock({
    changedFiles: ["a", "b"],
    advisory: { mergedAreas: ["gameplay"] },
    prePrChecklist: {
      runLogDecision: {
        result: 'none required',
      },
      backlogSyncReview: {
        resultSummary: "manual review required (no backlog paths in diff; do not assume none affected)",
      },
      splitDecision: {
        finalDecision: "no-split-default",
        hardTriggerReasons: [],
        advisorySplitSignals: [],
      },
    },
    affectedDocs: ["README.md"],
    checkOutcomes: [{ command: "npm run check", status: "pass" }],
    risks: ["game-balance"],
  });

  assert.match(block, /^Summary/m);
  assert.match(block, /changed_files: 2/);
  assert.match(block, /checks: npm run check=pass/);
});

test("buildSummaryResult includes required summary fields", () => {
  const advisory = createAdvisoryResult({ perFile: [] });
  const result = buildSummaryResult(["systems/simulation-core.js"], advisory, { runChecks: false });

  assert.deepEqual(result.changedFiles, ["systems/simulation-core.js"]);
  assert.deepEqual(result.advisory.matchedRuleIds, ["gameplay-core", "workflow-docs"]);
  assert.ok(Array.isArray(result.checkOutcomes));
  assert.ok(Array.isArray(result.affectedDocs));
  assert.ok(Array.isArray(result.userVisibleImpact));
  assert.ok(Array.isArray(result.risks));
  assert.ok(result.prePrChecklist);
  assert.equal(typeof result.prePrChecklist.splitDecision.finalDecision, "string");
  assert.equal(typeof result.prePrChecklist.backlogSyncReview.resultSummary, "string");
  assert.ok(Array.isArray(result.openQuestions));
  assert.equal(typeof result.copyBlock, "string");
});

test("buildSummaryResult reports run-log creation when agent run logs changed", () => {
  const advisory = createAdvisoryResult(["instructions/pre-pr-checklist.md", "logs/agent-runs/2026-03-21-example.yaml"]);

  const result = buildSummaryResult(
    ["instructions/pre-pr-checklist.md", "logs/agent-runs/2026-03-21-example.yaml"],
    advisory,
    { runChecks: false }
  );

  assert.equal(
    result.prePrChecklist.runLogDecision.result,
    "created/updated: logs/agent-runs/2026-03-21-example.yaml"
  );
});

test("buildSummaryResult reports changed backlog files in backlog sync review", () => {
  const advisory = createAdvisoryResult({
    areas: ["workflow-docs"],
    matchedRules: [{ id: "repo-docs", area: "workflow-docs" }],
    perFile: [],
  });

  const result = buildSummaryResult(
    ["backlog/2-todo-reconcile-open-backlog-with-actual-implementation-state.md", "AGENTS.md"],
    advisory,
    { runChecks: false }
  );

  assert.equal(
    result.prePrChecklist.backlogSyncReview.resultSummary,
    "checked backlog updates in current branch: backlog/2-todo-reconcile-open-backlog-with-actual-implementation-state.md"
  );
});

test("buildSummaryResult requires manual backlog review when no backlog files changed", () => {
  const advisory = createAdvisoryResult({
    areas: ["tooling"],
    matchedRules: [{ id: "tooling-scripts-tests", area: "tooling" }],
    perFile: [],
  });

  const result = buildSummaryResult(
    ["scripts/backlog-template-lint.js", "tests/backlog-template-lint.test.js"],
    advisory,
    { runChecks: false }
  );

  assert.equal(
    result.prePrChecklist.backlogSyncReview.resultSummary,
    "manual review required (no backlog paths in diff; do not assume none affected)"
  );
});

test("getChangedFiles falls back to branch diff when working tree is clean", () => {
  const calls = [];
  const fakeExec = (_command, args) => {
    calls.push(args);
    const joined = args.join(" ");
    if (joined === "diff --name-only --cached") {
      return "";
    }
    if (joined === "diff --name-only") {
      return "";
    }
    if (joined === "ls-files --others --exclude-standard") {
      return "";
    }
    if (joined === "symbolic-ref --quiet refs/remotes/origin/HEAD") {
      return "origin/main\n";
    }
    if (joined === "diff --name-only origin/main...HEAD") {
      return "scripts/agent-summary.js\nbacklog/done/example.md\n";
    }
    throw new Error(`unexpected git args: ${joined}`);
  };

  assert.deepEqual(getChangedFiles({ files: null, staged: false, baseRef: null }, fakeExec), [
    "scripts/agent-summary.js",
    "backlog/done/example.md",
  ]);
  assert.ok(calls.some((args) => args.join(" ") === "diff --name-only origin/main...HEAD"));
});

test("buildSummaryResult prefers normalized advisory changedFiles output", () => {
  const advisory = createAdvisoryResult({ perFile: [] });
  advisory.changedFiles = ["README.md", "scripts/agent-summary.js"];

  const result = buildSummaryResult(["./README.md", "scripts\\agent-summary.js"], advisory, { runChecks: false });
  assert.deepEqual(result.changedFiles, ["README.md", "scripts/agent-summary.js"]);
});

test("formatHumanReadable contains expected stable sections", () => {
  const advisory = createAdvisoryResult({ perFile: [] });
  const result = buildSummaryResult(["systems/simulation-core.js"], advisory, { runChecks: false });
  const output = formatHumanReadable(result, { runChecks: false });

  const sections = [
    "Agent summary",
    "Checks and outcomes",
    "Pre-PR checklist outcome",
    "Affected docs / instructions",
    "User-visible impact",
    "Risks",
    "Open questions",
    "Copy-ready block (commit / PR / handoff)",
  ];

  for (const section of sections) {
    assert.ok(output.includes(section), `missing section: ${section}`);
  }
});

test("buildSummaryResult marks split-required for mixed workflow-docs and implementation areas", () => {
  const advisory = createAdvisoryResult({
    areas: ["workflow-docs", "tooling"],
    perFile: [],
  });
  advisory.changedFiles = [
    "CONTRIBUTING.md",
    "scripts/agent-summary.js",
    "tests/agent-summary.test.js",
    "AGENTS.md",
    "instructions/pre-pr-checklist.md",
    "README.md",
  ];

  const result = buildSummaryResult(advisory.changedFiles, advisory, { runChecks: false, contractConsumers: null });
  assert.equal(result.prePrChecklist.splitDecision.finalDecision, "split-required");
  assert.equal(
    result.prePrChecklist.triggerEvaluation.crossScopeMixedWorkflowAndImplementation,
    true
  );
});

test("buildSummaryResult keeps deep-plus-six as advisory split signal", () => {
  const advisory = createAdvisoryResult({
    areas: ["pwa"],
    matchedRules: [{ id: "pwa-offline", area: "pwa" }],
    perFile: [],
    riskTags: ["offline"],
  });
  advisory.changedFiles = [
    "service-worker.js",
    "app-assets.js",
    "manifest.webmanifest",
    "README.md",
    "docs/asset-manifest.md",
    "version.json",
  ];

  const result = buildSummaryResult(advisory.changedFiles, advisory, { runChecks: false, contractConsumers: null });
  assert.equal(result.prePrChecklist.splitDecision.finalDecision, "no-split-with-justification");
  assert.ok(
    result.prePrChecklist.splitDecision.advisorySplitSignals.includes(
      "deep review recommendation with 6+ touched files"
    )
  );
});

test("buildSummaryResult treats error and failed-signal check statuses as failures", () => {
  const advisory = createAdvisoryResult({
    areas: ["tooling"],
    matchedRules: [{ id: "tooling-scripts-tests", area: "tooling" }],
    perFile: [],
    recommendedChecks: ["npm run fake-check"],
  });

  const checkOutcomes = [
    { command: "npm run fake-check", status: "error", durationMs: 0, exitCode: 1 },
    { command: "npm run fake-check-2", status: "failed-signal", durationMs: 0, exitCode: null },
  ];

  const checklist = buildPrePrChecklistOutcome(
    ["scripts/tool.js"],
    advisory,
    checkOutcomes,
    advisory.merged.riskTags,
    { runChecks: false }
  );

  assert.ok(checklist.likelyReviewerObjections.includes("Failing checks must be resolved before merge."));
  assert.ok(checklist.remainingRisks.includes("failed-checks"));
});

test("isFailingCheckStatus is true for fail, error, failed-signal", () => {
  assert.equal(isFailingCheckStatus("fail"), true);
  assert.equal(isFailingCheckStatus("error"), true);
  assert.equal(isFailingCheckStatus("failed-signal"), true);
  assert.equal(isFailingCheckStatus("pass"), false);
  assert.equal(isFailingCheckStatus("not-run"), false);
  assert.equal(isFailingCheckStatus("skipped-unsafe"), false);
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
