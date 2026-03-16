const assert = require("node:assert/strict");

const {
  parseScope,
  resolveTaskAreas,
  classifyRelatedChanges,
  validateScope,
  formatHumanReadable,
} = require("../scripts/agent-preflight.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function createAdvisoryResult(perFile, matchedRules, mergedAreas) {
  return {
    perFile,
    matchedRules,
    merged: {
      areas: mergedAreas,
      riskTags: [],
      recommendedChecks: [],
      manualChecks: [],
      suggestedDocs: [],
      suggestedReading: [],
      ciSignals: [],
    },
    governance: {
      advisoryOnly: true,
      routingAuthority: "AGENTS.md",
      note: "advisory only",
    },
  };
}

test("parseScope splits comma-separated values with stable dedupe", () => {
  assert.deepEqual(parseScope("gameplay, pwa, gameplay"), ["gameplay", "pwa"]);
});

test("resolveTaskAreas prefers explicit scope when provided", () => {
  const advisory = createAdvisoryResult([], [], ["gameplay", "pwa"]);
  const result = resolveTaskAreas({ scope: ["workflow-docs"] }, advisory);
  assert.deepEqual(result, {
    areas: ["workflow-docs"],
    source: "cli-scope",
  });
});

test("resolveTaskAreas infers areas from matches and drops unclassified", () => {
  const advisory = createAdvisoryResult([], [], ["gameplay", "unclassified"]);
  const result = resolveTaskAreas({ scope: null }, advisory);
  assert.deepEqual(result, {
    areas: ["gameplay"],
    source: "matched-areas",
  });
});

test("classifyRelatedChanges marks files outside task areas as unrelated", () => {
  const advisory = createAdvisoryResult(
    [
      { filePath: "systems/simulation-core.js", ruleIds: ["gameplay-core"], usedFallback: false },
      { filePath: "README.md", ruleIds: ["workflow-docs"], usedFallback: false },
      { filePath: "version.json", ruleIds: ["fallback-unclassified"], usedFallback: true },
    ],
    [
      { id: "gameplay-core", area: "gameplay" },
      { id: "workflow-docs", area: "workflow-docs" },
      { id: "fallback-unclassified", area: "unclassified" },
    ],
    ["gameplay", "workflow-docs", "unclassified"]
  );

  const classification = classifyRelatedChanges(advisory, ["gameplay"]);
  assert.deepEqual(
    classification.unrelatedFiles.map((entry) => entry.filePath),
    ["README.md", "version.json"]
  );
  assert.deepEqual(
    classification.relatedFiles.map((entry) => entry.filePath),
    ["systems/simulation-core.js"]
  );
});

test("validateScope rejects unknown area names", () => {
  const document = {
    rules: [{ area: "gameplay" }, { area: "pwa" }],
    unknownFileFallback: { area: "unclassified" },
  };

  const result = validateScope(["gameplay", "unknown-area"], document);
  assert.equal(result.valid, false);
  assert.deepEqual(result.invalidAreas, ["unknown-area"]);
});

test("human output includes advisory policy note and unrelated section", () => {
  const output = formatHumanReadable({
    branchState: { current: "feature/x", onMain: false },
    changeState: {
      stagedCount: 1,
      unstagedCount: 1,
      untrackedCount: 0,
      changedCount: 2,
      changedFiles: ["README.md", "systems/simulation-core.js"],
    },
    taskScope: { source: "matched-areas", areas: ["gameplay"] },
    advisory: {
      matchedRuleIds: ["gameplay-core", "workflow-docs"],
      recommendedChecks: ["npm run check"],
      suggestedDocs: ["README.md"],
      suggestedReading: ["AGENTS.md"],
      fallbackFiles: [],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [{ filePath: "README.md", areas: ["workflow-docs"], ruleIds: ["workflow-docs"] }],
    },
    guardrail: {
      signal: "git-hooks-pre-commit-exists",
      active: true,
      path: ".git/hooks/pre-commit",
      note: "Current-state signal only. No setup history inference is used.",
    },
  });

  assert.match(output, /Unrelated local changes/);
  assert.match(output, /No setup history inference is used/);
});

test("human output warns when running on main branch", () => {
  const output = formatHumanReadable({
    branchState: { current: "main", onMain: true },
    changeState: {
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      changedCount: 0,
      changedFiles: [],
    },
    taskScope: { source: "matched-areas", areas: [] },
    advisory: {
      matchedRuleIds: [],
      recommendedChecks: [],
      suggestedDocs: [],
      suggestedReading: [],
      fallbackFiles: [],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [],
    },
    guardrail: {
      signal: "git-hooks-pre-commit-exists",
      active: false,
      path: ".git/hooks/pre-commit",
      note: "Current-state signal only. No setup history inference is used.",
    },
  });

  assert.match(output, /Warning: You are on main\./);
});

test("human output handles no-change scenario without file list items", () => {
  const output = formatHumanReadable({
    branchState: { current: "feature/x", onMain: false },
    changeState: {
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      changedCount: 0,
      changedFiles: [],
    },
    taskScope: { source: "matched-areas", areas: [] },
    advisory: {
      matchedRuleIds: [],
      recommendedChecks: [],
      suggestedDocs: [],
      suggestedReading: [],
      fallbackFiles: [],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [],
    },
    guardrail: {
      signal: "git-hooks-pre-commit-exists",
      active: false,
      path: ".git/hooks/pre-commit",
      note: "Current-state signal only. No setup history inference is used.",
    },
  });

  assert.match(output, /Changed files: 0 \(staged 0, unstaged 0, untracked 0\)/);
  assert.doesNotMatch(output, /Changed file list/);
});

test("human output includes mixed change counts and fallback files section", () => {
  const output = formatHumanReadable({
    branchState: { current: "feature/x", onMain: false },
    changeState: {
      stagedCount: 1,
      unstagedCount: 2,
      untrackedCount: 1,
      changedCount: 4,
      changedFiles: ["README.md", "scripts/agent-preflight.js", "tests/agent-preflight.test.js", "todo.md"],
    },
    taskScope: { source: "cli-scope", areas: ["workflow-docs"] },
    advisory: {
      matchedRuleIds: ["workflow-docs", "tooling-scripts-tests", "fallback-unclassified"],
      recommendedChecks: ["npm run check", "npm test"],
      suggestedDocs: ["README.md"],
      suggestedReading: ["AGENTS.md"],
      fallbackFiles: ["todo.md"],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [{ filePath: "scripts/agent-preflight.js", areas: ["tooling"], ruleIds: ["tooling-scripts-tests"] }],
    },
    guardrail: {
      signal: "git-hooks-pre-commit-exists",
      active: true,
      path: ".git/hooks/pre-commit",
      note: "Current-state signal only. No setup history inference is used.",
    },
  });

  assert.match(output, /Changed files: 4 \(staged 1, unstaged 2, untracked 1\)/);
  assert.match(output, /Files using fallback advisory/);
  assert.match(output, /- todo\.md/);
});

test("human output keeps section order deterministic", () => {
  const output = formatHumanReadable({
    branchState: { current: "feature/x", onMain: false },
    changeState: {
      stagedCount: 1,
      unstagedCount: 0,
      untrackedCount: 0,
      changedCount: 1,
      changedFiles: ["README.md"],
    },
    taskScope: { source: "matched-areas", areas: ["workflow-docs"] },
    advisory: {
      matchedRuleIds: ["workflow-docs"],
      recommendedChecks: ["npm run check"],
      suggestedDocs: ["README.md"],
      suggestedReading: ["AGENTS.md"],
      fallbackFiles: [],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [],
    },
    guardrail: {
      signal: "git-hooks-pre-commit-exists",
      active: true,
      path: ".git/hooks/pre-commit",
      note: "Current-state signal only. No setup history inference is used.",
    },
  });

  const sectionOrder = [
    "Task area source:",
    "Matched rules",
    "Recommended checks",
    "Likely docs / instructions",
    "Unrelated local changes",
    "Guardrail status",
  ];

  let previousIndex = -1;
  for (const section of sectionOrder) {
    const index = output.indexOf(section);
    assert.notEqual(index, -1, `missing section: ${section}`);
    assert.ok(index > previousIndex, `section order broken at: ${section}`);
    previousIndex = index;
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
