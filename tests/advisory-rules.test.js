const assert = require("node:assert/strict");

const {
  loadAdvisoryDocument,
  validateAdvisoryDocument,
  resolveAdvisoryForFiles,
} = require("../scripts/advisory-rules.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

test("advisory rules file validates successfully", () => {
  const { document } = loadAdvisoryDocument();
  const result = validateAdvisoryDocument(document);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("matcher resolves gameplay and pwa areas with merged checks", () => {
  const { document } = loadAdvisoryDocument();
  const result = resolveAdvisoryForFiles(["systems/simulation-core.js", "service-worker.js"], document);

  assert.deepEqual(result.merged.areas, ["gameplay", "pwa"]);
  assert.deepEqual(result.merged.recommendedChecks, [
    "npm run check",
    "npm run test:simulation",
    "npm run test:service-worker",
  ]);
});

test("unknown files use fallback advisory rule", () => {
  const { document } = loadAdvisoryDocument();
  const result = resolveAdvisoryForFiles(["version.json"], document);

  assert.deepEqual(result.merged.areas, ["unclassified"]);
  assert.equal(result.perFile[0].usedFallback, true);
  assert.deepEqual(result.perFile[0].ruleIds, ["fallback-unclassified"]);
});

test("github workflow-adjacent files resolve as workflow docs instead of fallback", () => {
  const { document } = loadAdvisoryDocument();
  const result = resolveAdvisoryForFiles(
    [
      ".github/copilot-instructions.md",
      ".github/instructions/change-review.instructions.md",
      ".github/workflows/ci.yml",
    ],
    document
  );

  assert.deepEqual(result.merged.areas, ["workflow-docs"]);
  assert.equal(result.perFile.every((entry) => entry.usedFallback === false), true);
  assert.deepEqual(result.merged.ciSignals, [
    "instruction-lint",
    "verify-linux-signals",
    "cross-platform-verify",
    "required-check",
  ]);
  assert.deepEqual(result.perFile[0].ruleIds, ["workflow-docs"]);
  assert.deepEqual(result.perFile[1].ruleIds, ["workflow-docs"]);
  assert.deepEqual(result.perFile[2].ruleIds, ["workflow-docs"]);
});

test("multi-match strategy merges and de-duplicates arrays in stable order", () => {
  const customDocument = {
    version: 1,
    governance: {
      advisoryOnly: true,
      routingAuthority: "AGENTS.md",
      note: "advisory only",
    },
    rules: [
      {
        id: "a",
        match: ["systems/**"],
        area: "systems",
        riskTags: ["risk-1"],
        recommendedChecks: ["npm run check", "npm run test:simulation"],
        manualChecks: ["manual-a"],
        suggestedDocs: ["docs/"],
        suggestedReading: ["AGENTS.md"],
        ciSignals: ["syntax"],
      },
      {
        id: "b",
        match: ["systems/simulation-core.js"],
        area: "simulation",
        riskTags: ["risk-2"],
        recommendedChecks: ["npm run test:simulation"],
        manualChecks: ["manual-b"],
        suggestedDocs: ["docs/simulation-core.md"],
        suggestedReading: ["instructions/change-review.md"],
        ciSignals: ["simulation-tests"],
      },
    ],
  };

  const result = resolveAdvisoryForFiles(["systems/simulation-core.js"], customDocument);
  assert.deepEqual(result.merged.areas, ["systems", "simulation"]);
  assert.deepEqual(result.merged.recommendedChecks, ["npm run check", "npm run test:simulation"]);
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
