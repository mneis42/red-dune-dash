const assert = require("node:assert/strict");
const { createTestHarness } = require("./test-helpers.js");

const {
  parseArgs,
  resolveBacklogItemPath,
  findSection,
  extractBulletLines,
  suggestBranchName,
  buildExecutionBrief,
  tokenizeForRelevance,
  suggestLikelyFiles,
  normalizeChecks,
} = require("../scripts/backlog-to-branch.js");

const { test, run } = createTestHarness("test:backlog-branch");

test("parseArgs reads file, json, and max-files", () => {
  const options = parseArgs(["--file", "backlog/5-todo-backlog-to-branch-helper.md", "--json", "--max-files", "4"]);
  assert.equal(options.file, "backlog/5-todo-backlog-to-branch-helper.md");
  assert.equal(options.json, true);
  assert.equal(options.maxFiles, 4);
  assert.deepEqual(options.errors, []);
});

test("parseArgs reports missing required file option", () => {
  const options = parseArgs(["--json"]);
  assert.ok(options.errors.includes("Missing required option --file <path-to-backlog-item>."));
});

test("resolveBacklogItemPath rejects paths outside backlog", () => {
  const repoRoot = process.cwd();
  assert.throws(() => resolveBacklogItemPath(repoRoot, "../README.md"), /inside the repository/);
  assert.throws(() => resolveBacklogItemPath(repoRoot, "README.md"), /under backlog/);
});

test("findSection isolates heading content", () => {
  const content = ["## Goal", "one line", "", "## Scope", "- first", "- second", "", "## Notes", "- done"].join("\n");
  assert.equal(findSection(content, "Scope"), "- first\n- second");
});

test("findSection supports extracting the final section", () => {
  const content = ["## Goal", "one line", "", "## Notes", "- done", "- next"].join("\n");
  assert.equal(findSection(content, "Notes"), "- done\n- next");
});

test("extractBulletLines supports markdown bullets and numbered list items", () => {
  const lines = extractBulletLines("- first\n2. second\nplain");
  assert.deepEqual(lines, ["first", "second"]);
});

test("suggestBranchName uses backlog number and slug", () => {
  const branch = suggestBranchName("backlog/5-todo-backlog-to-branch-helper.md", "Backlog-To-Branch Helper");
  assert.equal(branch, "chore/backlog-5-backlog-to-branch-helper");
});

test("buildExecutionBrief keeps compact summary", () => {
  const text = buildExecutionBrief("Create helper", ["item one", "item two"], ["criterion one"]);
  assert.match(text, /Create helper/);
  assert.match(text, /Scope focus/);
  assert.match(text, /Done when/);
});

test("tokenizeForRelevance removes stop words and short tokens", () => {
  const tokens = tokenizeForRelevance("Backlog helper creates practical branch suggestion and execution brief");
  assert.ok(tokens.includes("backlog"));
  assert.ok(tokens.includes("branch"));
  assert.ok(tokens.includes("creates"));
  assert.ok(tokens.includes("suggestion"));
  assert.ok(!tokens.includes("helper"));
});

test("suggestLikelyFiles ranks by token matches and stable tie-breaks", () => {
  const files = ["README.md", "scripts/backlog-to-branch.js", "tests/backlog-to-branch.test.js", "docs/architecture.md"];
  const selected = suggestLikelyFiles(["backlog", "branch"], files, 2);
  assert.deepEqual(selected, ["scripts/backlog-to-branch.js", "tests/backlog-to-branch.test.js"]);
});

test("normalizeChecks falls back to defaults when section is empty", () => {
  const checks = normalizeChecks([]);
  assert.deepEqual(checks, ["npm run check", "npm test"]);
});

test("normalizeChecks strips markdown code wrapping and deduplicates", () => {
  const checks = normalizeChecks(["`npm run check`", "npm test", "npm test"]);
  assert.deepEqual(checks, ["npm run check", "npm test"]);
});

run();
