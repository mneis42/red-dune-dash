const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildHeadingAnchors,
  runInstructionLint,
  ISSUE_SEVERITY_BY_CODE,
} = require("../scripts/instruction-lint.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function withTempRepo(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rdd-instruction-lint-"));

  function write(relativePath, content) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  try {
    callback({ root, write });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("buildHeadingAnchors applies duplicate-suffix strategy", () => {
  const anchors = buildHeadingAnchors("# Title\n## Repeated\n## Repeated\n## Repeated");
  assert.equal(anchors.has("repeated"), true);
  assert.equal(anchors.has("repeated-1"), true);
  assert.equal(anchors.has("repeated-2"), true);
});

test("buildHeadingAnchors removes punctuation from heading anchors", () => {
  const anchors = buildHeadingAnchors("## Release v2.0: Overview");
  assert.equal(anchors.has("release-v20-overview"), true);
  assert.equal(anchors.has("release-v2.0:-overview"), false);
});

test("runInstructionLint succeeds for valid canonical references and anchors", () => {
  withTempRepo(({ root, write }) => {
    write(
      "AGENTS.md",
      [
        "# Agent Instructions",
        "",
        "- [Full](instructions/full-code-review.md)",
        "- [Change](instructions/change-review.md)",
        "- [Feature](instructions/feature-request.md)",
        "- [Bug](instructions/bug-report.md)",
        "- [Pre-PR](instructions/pre-pr-checklist.md)",
      ].join("\n")
    );

    write("README.md", "# Readme\n\nSee [Guide](instructions/feature-request.md#goal).\n");
    write("CONTRIBUTING.md", "# Contributing\n\nSee [Checklist](instructions/pre-pr-checklist.md).\n");
    write("instructions/full-code-review.md", "# Full Code Review Instructions\n\n## Goal\n");
    write("instructions/change-review.md", "# Change Review Instructions\n\n## Goal\n");
    write(
      "instructions/feature-request.md",
      "# Feature Request Instructions\n\n## Goal\n\nSee [Checklist](pre-pr-checklist.md).\n"
    );
    write(
      "instructions/bug-report.md",
      "# Bug Report Instructions\n\n## Goal\n\nSee [Checklist](pre-pr-checklist.md).\n"
    );
    write("instructions/pre-pr-checklist.md", "# Pre-PR Checklist\n\n## Purpose\n");
    write(
      ".github/copilot-instructions.md",
      "# Copilot\n\nSee [Feature](../instructions/feature-request.md#goal).\nSee [Checklist](../instructions/pre-pr-checklist.md).\n"
    );

    const result = runInstructionLint({ repoRoot: root });
    assert.equal(result.issues.length, 0);
  });
});

test("runInstructionLint reports missing link targets", () => {
  withTempRepo(({ root, write }) => {
    write(
      "AGENTS.md",
      [
        "# Agent Instructions",
        "",
        "- [Full](instructions/full-code-review.md)",
        "- [Change](instructions/change-review.md)",
        "- [Feature](instructions/feature-request.md)",
        "- [Bug](instructions/bug-report.md)",
      ].join("\n")
    );

    write("README.md", "# Readme\n\nSee [Missing](instructions/missing.md).\n");
    write("CONTRIBUTING.md", "# Contributing\n");
    write("instructions/full-code-review.md", "# Full\n");
    write("instructions/change-review.md", "# Change\n");
    write("instructions/feature-request.md", "# Feature\n");
    write("instructions/bug-report.md", "# Bug\n");

    const result = runInstructionLint({ repoRoot: root });
    const codes = result.issues.map((issue) => issue.code);
    assert.equal(codes.includes("missing-link-target"), true);
  });
});

test("runInstructionLint reports missing anchors", () => {
  withTempRepo(({ root, write }) => {
    write(
      "AGENTS.md",
      [
        "# Agent Instructions",
        "",
        "- [Full](instructions/full-code-review.md)",
        "- [Change](instructions/change-review.md)",
        "- [Feature](instructions/feature-request.md)",
        "- [Bug](instructions/bug-report.md)",
      ].join("\n")
    );

    write("README.md", "# Readme\n\nSee [Feature Goal](instructions/feature-request.md#not-there).\n");
    write("CONTRIBUTING.md", "# Contributing\n");
    write("instructions/full-code-review.md", "# Full\n");
    write("instructions/change-review.md", "# Change\n");
    write("instructions/feature-request.md", "# Feature Request Instructions\n\n## Goal\n");
    write("instructions/bug-report.md", "# Bug\n");

    const result = runInstructionLint({ repoRoot: root });
    const codes = result.issues.map((issue) => issue.code);
    assert.equal(codes.includes("missing-anchor"), true);
  });
});

test("runInstructionLint reports missing canonical references in AGENTS", () => {
  withTempRepo(({ root, write }) => {
    write(
      "AGENTS.md",
      [
        "# Agent Instructions",
        "",
        "- [Full](instructions/full-code-review.md)",
        "- [Feature](instructions/feature-request.md)",
      ].join("\n")
    );

    write("README.md", "# Readme\n");
    write("CONTRIBUTING.md", "# Contributing\n");
    write("instructions/full-code-review.md", "# Full\n");
    write("instructions/change-review.md", "# Change\n");
    write("instructions/feature-request.md", "# Feature\n");
    write("instructions/bug-report.md", "# Bug\n");

    const result = runInstructionLint({ repoRoot: root });
    const finding = result.issues.find((issue) => issue.code === "missing-canonical-reference");
    assert.ok(finding);
    assert.equal(finding.severity, "high");
  });
});

test("runInstructionLint returns severity counts", () => {
  withTempRepo(({ root, write }) => {
    write(
      "AGENTS.md",
      [
        "# Agent Instructions",
        "",
        "- [Full](instructions/full-code-review.md)",
        "- [Feature](instructions/feature-request.md)",
      ].join("\n")
    );

    write("README.md", "# Readme\n\nSee [Missing](instructions/missing.md).\n");
    write("CONTRIBUTING.md", "# Contributing\n");
    write("instructions/full-code-review.md", "# Full\n");
    write("instructions/change-review.md", "# Change\n");
    write("instructions/feature-request.md", "# Feature\n");
    write("instructions/bug-report.md", "# Bug\n");

    const result = runInstructionLint({ repoRoot: root });
    assert.equal(result.severityCounts.high >= 1, true);
    assert.equal(result.severityCounts.medium >= 1, true);
    assert.equal(result.severityCounts.low, 0);
  });
});

test("runInstructionLint reports missing mandatory pre-PR checklist references", () => {
  withTempRepo(({ root, write }) => {
    write(
      "AGENTS.md",
      [
        "# Agent Instructions",
        "",
        "- [Full](instructions/full-code-review.md)",
        "- [Change](instructions/change-review.md)",
        "- [Feature](instructions/feature-request.md)",
        "- [Bug](instructions/bug-report.md)",
      ].join("\n")
    );

    write("README.md", "# Readme\n");
    write("CONTRIBUTING.md", "# Contributing\n");
    write("instructions/full-code-review.md", "# Full\n");
    write("instructions/change-review.md", "# Change\n");
    write("instructions/feature-request.md", "# Feature\n");
    write("instructions/bug-report.md", "# Bug\n");
    write("instructions/pre-pr-checklist.md", "# Checklist\n");
    write(".github/copilot-instructions.md", "# Copilot\n");

    const result = runInstructionLint({ repoRoot: root });
    const finding = result.issues.find((issue) => issue.code === "missing-pre-pr-checklist-reference");
    assert.ok(finding);
    assert.equal(finding.severity, "high");
  });
});

test("all known issue codes have explicit severity mapping", () => {
  const requiredCodes = [
    "missing-canonical-file",
    "missing-agents-file",
    "missing-canonical-reference",
    "missing-pre-pr-checklist-reference",
    "missing-link-target",
    "missing-anchor",
    "invalid-anchor-target",
    "empty-link-target",
  ];

  for (const code of requiredCodes) {
    assert.ok(ISSUE_SEVERITY_BY_CODE[code]);
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
