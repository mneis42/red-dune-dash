const assert = require("node:assert/strict");

const {
  parseArgs,
  parseAllowedCheckCommand,
  resolveUserImpact,
  buildOpenQuestions,
  buildCopyBlock,
  buildSummaryResult,
  formatHumanReadable,
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

test("parseArgs supports json, staged, run-checks, files, and rules flags", () => {
  const options = parseArgs([
    "--json",
    "--staged",
    "--run-checks",
    "--files",
    "a.js,b.js",
    "--rules",
    "workflow/custom.json",
  ]);

  assert.deepEqual(options, {
    json: true,
    staged: true,
    files: ["a.js", "b.js"],
    rulesPath: "workflow/custom.json",
    runChecks: true,
    includeLogs: false,
  });
});

test("parseArgs supports include-logs flag", () => {
  const options = parseArgs(["--include-logs"]);
  assert.equal(options.includeLogs, true);
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
  assert.ok(Array.isArray(result.openQuestions));
  assert.equal(typeof result.copyBlock, "string");
});

test("formatHumanReadable contains expected stable sections", () => {
  const advisory = createAdvisoryResult({ perFile: [] });
  const result = buildSummaryResult(["systems/simulation-core.js"], advisory, { runChecks: false });
  const output = formatHumanReadable(result, { runChecks: false });

  const sections = [
    "Agent summary",
    "Checks and outcomes",
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
