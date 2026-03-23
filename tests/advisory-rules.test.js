const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createTestHarness } = require("./test-helpers.js");

const {
  loadAdvisoryDocument,
  validateAdvisoryDocument,
  resolveAdvisoryForFiles,
} = require("../scripts/advisory-rules.js");

const { test, run } = createTestHarness("test:advisory-rules");

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
    "docs-language-lint",
    "backlog-lint",
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

test("policy gate document and advisory docs stay in sync for stage 3 gate entries", () => {
  const { document } = loadAdvisoryDocument();
  const docsPath = path.join(process.cwd(), "docs", "advisory-rules.md");
  const docsText = fs.readFileSync(docsPath, "utf8");
  const stageThree = document.policyGates.stages.find((stage) => stage.id === "stage-3-hard-fail");

  assert.ok(stageThree, "expected stage-3-hard-fail policy gate stage");
  assert.ok(Array.isArray(stageThree.candidateGates), "expected stage 3 candidate gates");

  for (const gate of stageThree.candidateGates) {
    assert.match(docsText, new RegExp(`\`{1}${gate.id}\`{1}`), `missing gate id in docs: ${gate.id}`);
    assert.match(
      docsText,
      new RegExp(gate.documentationStatusLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `missing gate status line in docs: ${gate.id}`
    );
    assert.match(
      docsText,
      new RegExp(gate.documentationDetailLine.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `missing gate detail line in docs: ${gate.id}`
    );
  }
});

test("validateAdvisoryDocument rejects unexpected policy gate keys", () => {
  const { document } = loadAdvisoryDocument();
  const invalidDocument = JSON.parse(JSON.stringify(document));
  invalidDocument.policyGates.extraField = true;
  invalidDocument.policyGates.stages[0].unexpected = "nope";
  invalidDocument.policyGates.stages[2].candidateGates[0].typoField = "bad";

  const result = validateAdvisoryDocument(invalidDocument);

  assert.equal(result.valid, false);
  assert.equal(result.errors.includes("policyGates.extraField is not allowed"), true);
  assert.equal(result.errors.includes("policyGates.stages[0].unexpected is not allowed"), true);
  assert.equal(
    result.errors.includes("policyGates.stages[2].candidateGates[0].typoField is not allowed"),
    true
  );
});

test("validateAdvisoryDocument rejects missing policyGates block", () => {
  const { document } = loadAdvisoryDocument();
  const invalidDocument = JSON.parse(JSON.stringify(document));
  delete invalidDocument.policyGates;

  const result = validateAdvisoryDocument(invalidDocument);

  assert.equal(result.valid, false);
  assert.equal(result.errors.includes("policyGates is required"), true);
});

test("validateAdvisoryDocument reports null policyGates as a validation error without throwing", () => {
  const { document } = loadAdvisoryDocument();
  const invalidDocument = JSON.parse(JSON.stringify(document));
  invalidDocument.policyGates = null;

  assert.doesNotThrow(() => validateAdvisoryDocument(invalidDocument));

  const result = validateAdvisoryDocument(invalidDocument);
  assert.equal(result.valid, false);
  assert.equal(result.errors.includes("policyGates must be an object"), true);
});

test("validateAdvisoryDocument requires stage 3 candidate gates", () => {
  const { document } = loadAdvisoryDocument();
  const invalidDocument = JSON.parse(JSON.stringify(document));
  delete invalidDocument.policyGates.stages[2].candidateGates;

  const result = validateAdvisoryDocument(invalidDocument);

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.includes("policyGates.stages[2].candidateGates is required for stage-3-hard-fail"),
    true
  );
});

test("validateAdvisoryDocument rejects empty stage 3 candidate gate list", () => {
  const { document } = loadAdvisoryDocument();
  const invalidDocument = JSON.parse(JSON.stringify(document));
  invalidDocument.policyGates.stages[2].candidateGates = [];

  const result = validateAdvisoryDocument(invalidDocument);

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.includes("policyGates.stages[2].candidateGates must be a non-empty array for stage-3-hard-fail"),
    true
  );
});

test("validateAdvisoryDocument requires canonical progressive stage ids", () => {
  const { document } = loadAdvisoryDocument();
  const invalidDocument = JSON.parse(JSON.stringify(document));
  invalidDocument.policyGates.stages[1].id = "stage-2-warn";

  const result = validateAdvisoryDocument(invalidDocument);

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.includes("policyGates.stages must include canonical stage id stage-2-warning"),
    true
  );
});

test("validateAdvisoryDocument rejects duplicate canonical progressive stage ids", () => {
  const { document } = loadAdvisoryDocument();
  const invalidDocument = JSON.parse(JSON.stringify(document));
  invalidDocument.policyGates.stages[1].id = "stage-1-advisory";

  const result = validateAdvisoryDocument(invalidDocument);

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.includes("policyGates.stages must include canonical stage id stage-1-advisory exactly once"),
    true
  );
  assert.equal(
    result.errors.includes("policyGates.stages must include canonical stage id stage-2-warning"),
    true
  );
});

test("validateAdvisoryDocument rejects duplicate stage 3 candidate gate ids", () => {
  const { document } = loadAdvisoryDocument();
  const invalidDocument = JSON.parse(JSON.stringify(document));
  invalidDocument.policyGates.stages[2].candidateGates[1].id = invalidDocument.policyGates.stages[2].candidateGates[0].id;

  const result = validateAdvisoryDocument(invalidDocument);

  assert.equal(result.valid, false);
  assert.equal(
    result.errors.includes(
      "policyGates.stages[2].candidateGates must include unique gate ids; duplicate id broken-instruction-references"
    ),
    true
  );
});

run();
