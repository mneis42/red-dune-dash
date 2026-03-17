const assert = require("node:assert/strict");

const {
  parseScope,
  detectGuardrailStatus,
  resolveTaskAreas,
  classifyRelatedChanges,
  validateScope,
  buildDocumentationDriftHints,
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

test("detectGuardrailStatus prefers configured hooksPath pre-push hook", () => {
  const result = detectGuardrailStatus({
    cwd: "/repo/subdir",
    resolveRepoRoot: () => "/repo",
    readHooksPath: () => ".githooks",
    existsSync: (candidatePath) => candidatePath === "/repo/.githooks/pre-push",
  });

  assert.deepEqual(result, {
    signal: "core-hooks-path-pre-push-checked",
    active: true,
    path: "/repo/.githooks/pre-push",
    note: "Detected via configured core.hooksPath and pre-push hook. Current-state signal only.",
  });
});

test("detectGuardrailStatus reports inactive when configured pre-push hook is missing", () => {
  const result = detectGuardrailStatus({
    cwd: "/repo",
    readHooksPath: () => ".githooks",
    existsSync: () => false,
  });

  assert.deepEqual(result, {
    signal: "core-hooks-path-pre-push-checked",
    active: false,
    path: "/repo/.githooks/pre-push",
    note: "core.hooksPath is configured but expected pre-push hook is missing. Current-state signal only.",
  });
});

test("detectGuardrailStatus falls back to legacy pre-commit signal without hooksPath", () => {
  const result = detectGuardrailStatus({
    cwd: "/repo",
    readHooksPath: () => null,
    existsSync: (candidatePath) => candidatePath === "/repo/.git/hooks/pre-commit",
  });

  assert.deepEqual(result, {
    signal: "legacy-git-hooks-pre-commit-checked",
    active: true,
    path: "/repo/.git/hooks/pre-commit",
    note: "Legacy fallback when core.hooksPath is not configured. Current-state signal only.",
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

test("buildDocumentationDriftHints returns all canonical mappings for matched areas", () => {
  const advisory = createAdvisoryResult([], [], ["gameplay", "pwa", "workflow-docs"]);
  const drift = buildDocumentationDriftHints(advisory);

  assert.equal(drift.triggered, true);
  assert.deepEqual(
    drift.hints.map((entry) => entry.id),
    ["gameplay-system-doc-drift", "pwa-offline-doc-drift", "workflow-instruction-doc-drift"]
  );
  assert.ok(drift.suggestedDocs.includes("README.md"));
  assert.ok(drift.suggestedDocs.includes("CONTRIBUTING.md"));
  assert.ok(drift.suggestedDocs.includes("instructions/"));
});

test("buildDocumentationDriftHints returns no hints for unrelated areas", () => {
  const advisory = createAdvisoryResult([], [], ["tooling", "ui-shell"]);
  const drift = buildDocumentationDriftHints(advisory);

  assert.equal(drift.triggered, false);
  assert.deepEqual(drift.hints, []);
  assert.deepEqual(drift.suggestedDocs, []);
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
    documentationDrift: {
      advisoryOnly: true,
      triggered: true,
      note: "Documentation drift hints are advisory only and never block execution.",
      hints: [
        {
          id: "workflow-instruction-doc-drift",
          title: "Workflow/instruction changes likely need process docs sync",
          reason: "Process updates should stay consistent across all workflow entry points.",
          triggerAreas: ["workflow-docs"],
          suggestedDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/"],
          advisoryOnly: true,
        },
      ],
      suggestedDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/"],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [{ filePath: "README.md", areas: ["workflow-docs"], ruleIds: ["workflow-docs"] }],
    },
    guardrail: {
      signal: "legacy-git-hooks-pre-commit-checked",
      active: true,
      path: ".git/hooks/pre-commit",
      note: "Legacy fallback when core.hooksPath is not configured. Current-state signal only.",
    },
  });

  assert.match(output, /Unrelated local changes/);
  assert.match(output, /Current-state signal only/);
  assert.match(output, /Documentation drift hints/);
  assert.match(output, /Workflow\/instruction changes likely need process docs sync/);
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
    documentationDrift: {
      advisoryOnly: true,
      triggered: false,
      note: "Documentation drift hints are advisory only and never block execution.",
      hints: [],
      suggestedDocs: [],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [],
    },
    guardrail: {
      signal: "legacy-git-hooks-pre-commit-checked",
      active: false,
      path: ".git/hooks/pre-commit",
      note: "Legacy fallback when core.hooksPath is not configured. Current-state signal only.",
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
    documentationDrift: {
      advisoryOnly: true,
      triggered: false,
      note: "Documentation drift hints are advisory only and never block execution.",
      hints: [],
      suggestedDocs: [],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [],
    },
    guardrail: {
      signal: "legacy-git-hooks-pre-commit-checked",
      active: false,
      path: ".git/hooks/pre-commit",
      note: "Legacy fallback when core.hooksPath is not configured. Current-state signal only.",
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
    documentationDrift: {
      advisoryOnly: true,
      triggered: true,
      note: "Documentation drift hints are advisory only and never block execution.",
      hints: [
        {
          id: "workflow-instruction-doc-drift",
          title: "Workflow/instruction changes likely need process docs sync",
          reason: "Process updates should stay consistent across all workflow entry points.",
          triggerAreas: ["workflow-docs"],
          suggestedDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/"],
          advisoryOnly: true,
        },
      ],
      suggestedDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/"],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [{ filePath: "scripts/agent-preflight.js", areas: ["tooling"], ruleIds: ["tooling-scripts-tests"] }],
    },
    guardrail: {
      signal: "legacy-git-hooks-pre-commit-checked",
      active: true,
      path: ".git/hooks/pre-commit",
      note: "Legacy fallback when core.hooksPath is not configured. Current-state signal only.",
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
    documentationDrift: {
      advisoryOnly: true,
      triggered: true,
      note: "Documentation drift hints are advisory only and never block execution.",
      hints: [
        {
          id: "workflow-instruction-doc-drift",
          title: "Workflow/instruction changes likely need process docs sync",
          reason: "Process updates should stay consistent across all workflow entry points.",
          triggerAreas: ["workflow-docs"],
          suggestedDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/"],
          advisoryOnly: true,
        },
      ],
      suggestedDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/"],
    },
    unrelatedChanges: {
      heuristic: "outside task areas",
      unrelatedFiles: [],
    },
    guardrail: {
      signal: "legacy-git-hooks-pre-commit-checked",
      active: true,
      path: ".git/hooks/pre-commit",
      note: "Legacy fallback when core.hooksPath is not configured. Current-state signal only.",
    },
  });

  const sectionOrder = [
    "Task area source:",
    "Matched rules",
    "Recommended checks",
    "Likely docs / instructions",
    "Documentation drift hints",
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
