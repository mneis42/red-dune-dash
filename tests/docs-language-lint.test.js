const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { runDocsLanguageLint } = require("../scripts/docs-language-lint.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function withTempRepo(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rdd-doc-lang-lint-"));

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

test("passes when technical docs are English", () => {
  withTempRepo(({ root, write }) => {
    write("README.md", "# Readme\n\nThis is technical documentation in English.\n");
    write("CONTRIBUTING.md", "# Contributing\n\nUse English docs.\n");
    write("AGENTS.md", "# Agents\n\nUse canonical workflows.\n");
    write("docs/example.md", "# Example\n\nThis describes generator rules.\n");
    write("instructions/change-review.md", "# Change Review\n\nReview changed files.\n");
    write(".github/instructions/change-review.instructions.md", "# Mirror\n\nTechnical docs are English.\n");
    write(".github/copilot-instructions.md", "# Copilot\n\nFollow instructions.\n");

    const result = runDocsLanguageLint({ repoRoot: root });
    assert.equal(result.findings.length, 0);
  });
});

test("reports German markers in technical docs", () => {
  withTempRepo(({ root, write }) => {
    write("README.md", "# Readme\n\nThis file is English.\n");
    write("CONTRIBUTING.md", "# Contributing\n\nUse English docs.\n");
    write("AGENTS.md", "# Agents\n\nUse canonical workflows.\n");
    write("docs/example.md", "# Beispiel\n\nDieses Dokument ist nicht in Englisch.\n");

    const result = runDocsLanguageLint({ repoRoot: root });
    assert.equal(result.findings.length > 0, true);
    assert.equal(result.findings.some((finding) => finding.filePath === "docs/example.md"), true);
  });
});

test("ignores excluded developer todo files", () => {
  withTempRepo(({ root, write }) => {
    write("README.md", "# Readme\n\nEnglish only.\n");
    write("CONTRIBUTING.md", "# Contributing\n\nEnglish only.\n");
    write("AGENTS.md", "# Agents\n\nEnglish only.\n");
    write("developer-todos.md", "# Developer TODOs\n\nDieses Dokument darf ignoriert werden.\n");

    const result = runDocsLanguageLint({ repoRoot: root });
    assert.equal(result.findings.length, 0);
  });
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