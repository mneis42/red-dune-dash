const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  parseFrontmatter,
  validateBacklogFile,
  validateDoneBacklogFile,
  runBacklogTemplateLint,
} = require("../scripts/backlog-template-lint.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function withTempRepo(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rdd-backlog-lint-"));

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

test("parseFrontmatter extracts top-level key-value pairs", () => {
  const parsed = parseFrontmatter("---\nworkflow_type: backlog-item\nstatus: open\n---\n# TODO\n");
  assert.equal(parsed.hasFrontmatter, true);
  assert.equal(parsed.map.workflow_type, "backlog-item");
  assert.equal(parsed.map.status, "open");
});

test("validateBacklogFile accepts valid backlog-item file", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/12-todo-valid.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: workflow-ideas.md",
        "idea_number: 1",
        "priority: 1",
        "status: open",
        "planning_model: GPT-5.3-Codex",
        "execution_model: GPT-5.3-Codex",
        "created_at: 2026-03-16",
        "last_updated: 2026-03-16",
        "---",
        "",
        "# TODO: Example",
        "",
        "## Goal",
        "",
        "x",
        "",
        "## Scope",
        "",
        "- x",
        "",
        "## Out Of Scope",
        "",
        "- x",
        "",
        "## Acceptance Criteria",
        "",
        "- x",
        "",
        "## Suggested Verification",
        "",
        "- npm run check",
        "",
        "## Notes",
      ].join("\n")
    );

    const issues = validateBacklogFile(root, "backlog/12-todo-valid.md");
    assert.deepEqual(issues, []);
  });
});

test("validateBacklogFile keeps legacy numbered backlog-item files compatible", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/1-todo-legacy.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: workflow-ideas.md",
        "idea_number: 1",
        "priority: 1",
        "status: open",
        "created_at: 2026-03-16",
        "---",
        "",
        "# TODO: Legacy",
        "",
        "## Goal",
        "## Scope",
        "## Out Of Scope",
        "## Acceptance Criteria",
        "## Suggested Verification",
        "## Notes",
      ].join("\n")
    );

    const issues = validateBacklogFile(root, "backlog/1-todo-legacy.md");
    assert.deepEqual(issues, []);
  });
});

test("validateBacklogFile allows backlog-item without idea_number", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/12-todo-no-idea-number.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: review-findings-2026-03-17",
        "priority: 12",
        "status: open",
        "planning_model: GPT-5.3-Codex",
        "execution_model: GPT-5.3-Codex",
        "created_at: 2026-03-17",
        "last_updated: 2026-03-17",
        "---",
        "",
        "# TODO: No idea number",
        "",
        "## Goal",
        "## Scope",
        "## Out Of Scope",
        "## Acceptance Criteria",
        "## Suggested Verification",
        "## Notes",
      ].join("\n")
    );

    const issues = validateBacklogFile(root, "backlog/12-todo-no-idea-number.md");
    assert.deepEqual(issues, []);
  });
});

test("validateBacklogFile requires enhanced metadata for new prioritized backlog-item files", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/12-todo-missing-metadata.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: workflow-ideas.md",
        "idea_number: 12",
        "priority: 12",
        "status: open",
        "created_at: 2026-03-17",
        "---",
        "",
        "# TODO: Missing metadata",
        "",
        "## Goal",
        "## Scope",
        "## Out Of Scope",
        "## Acceptance Criteria",
        "## Suggested Verification",
        "## Notes",
      ].join("\n")
    );

    const issues = validateBacklogFile(root, "backlog/12-todo-missing-metadata.md");
    assert.equal(issues.some((entry) => entry.includes("planning_model")), true);
    assert.equal(issues.some((entry) => entry.includes("execution_model")), true);
    assert.equal(issues.some((entry) => entry.includes("last_updated")), true);
  });
});

test("validateBacklogFile accepts valid feature-request backlog file", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/1-todo-feature.md",
      [
        "---",
        "workflow_type: feature-request",
        "title: Example feature",
        "overall_status: open",
        "planning_model: GPT-5.3-Codex",
        "branch: feature/example",
        "created_at: 2026-03-16",
        "last_updated: 2026-03-16",
        "---",
        "",
        "# Feature Request TODO",
        "",
        "## Feature Summary",
        "## Verification Baseline",
        "## Assumptions And Open Questions",
        "## Decision Gate",
        "## TODO Index",
        "## Documentation Follow-ups",
      ].join("\n")
    );

    const issues = validateBacklogFile(root, "backlog/1-todo-feature.md");
    assert.deepEqual(issues, []);
  });
});

test("validateBacklogFile rejects unsupported workflow_type", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/1-todo-invalid.md",
      [
        "---",
        "workflow_type: other",
        "created_at: 2026-03-16",
        "---",
        "",
        "# TODO: Invalid",
      ].join("\n")
    );

    const issues = validateBacklogFile(root, "backlog/1-todo-invalid.md");
    assert.equal(issues.length > 0, true);
    assert.match(issues[0], /unsupported workflow_type/);
  });
});

test("runBacklogTemplateLint checks prioritized and done backlog files", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/12-todo-valid.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: workflow-ideas.md",
        "idea_number: 1",
        "priority: 1",
        "status: open",
        "planning_model: GPT-5.3-Codex",
        "execution_model: GPT-5.3-Codex",
        "created_at: 2026-03-16",
        "last_updated: 2026-03-16",
        "---",
        "",
        "# TODO: Example",
        "",
        "## Goal",
        "## Scope",
        "## Out Of Scope",
        "## Acceptance Criteria",
        "## Suggested Verification",
        "## Notes",
      ].join("\n")
    );

    write("backlog/done/20260316-foo.md", "---\nstatus: done\n---\n# TODO: done fixture entry\n");

    const result = runBacklogTemplateLint({ repoRoot: root });
    assert.equal(result.files.length, 1);
    assert.equal(result.doneFiles.length, 1);
    assert.deepEqual(result.issues, []);
  });
});

test("validateDoneBacklogFile rejects status other than done", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/done/20260318-foo.md",
      ["---", "status: open", "---", "# TODO: Example"].join("\n")
    );

    const result = validateDoneBacklogFile(root, "backlog/done/20260318-foo.md");
    assert.equal(result.issues.length >= 1, true);
    assert.equal(result.issues.some((entry) => /status: done/.test(entry)), true);
  });
});

test("validateDoneBacklogFile ignores status-like lines outside frontmatter", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/done/20260318-example.md",
      [
        "---",
        "workflow_type: backlog-item",
        "---",
        "# TODO: Example",
        "",
        "## Notes",
        "status: open",
      ].join("\n")
    );

    const result = validateDoneBacklogFile(root, "backlog/done/20260318-example.md");
    assert.deepEqual(result.issues, []);
  });
});

test("runBacklogTemplateLint rejects duplicate normalized titles in backlog", () => {
  withTempRepo(({ root, write }) => {
    const body = [
      "## Goal",
      "x",
      "## Scope",
      "- x",
      "## Out Of Scope",
      "- x",
      "## Acceptance Criteria",
      "- x",
      "## Suggested Verification",
      "- npm run check",
      "## Notes",
    ].join("\n\n");

    write(
      "backlog/12-todo-alpha.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: workflow-ideas.md",
        "priority: 12",
        "status: open",
        "planning_model: GPT-5.3-Codex",
        "execution_model: GPT-5.3-Codex",
        "created_at: 2026-03-18",
        "last_updated: 2026-03-18",
        "---",
        "",
        "# TODO: Normalize Rule Names",
        "",
        body,
      ].join("\n")
    );

    write(
      "backlog/13-todo-beta.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: workflow-ideas.md",
        "priority: 13",
        "status: open",
        "planning_model: GPT-5.3-Codex",
        "execution_model: GPT-5.3-Codex",
        "created_at: 2026-03-18",
        "last_updated: 2026-03-18",
        "---",
        "",
        "# TODO: Normalize-rule names",
        "",
        body,
      ].join("\n")
    );

    const result = runBacklogTemplateLint({ repoRoot: root });
    assert.equal(result.issues.some((entry) => entry.includes("Duplicate backlog topic")), true);
  });
});

test("runBacklogTemplateLint rejects open-vs-done topic collisions", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/12-todo-open-item.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: workflow-ideas.md",
        "priority: 12",
        "status: open",
        "planning_model: GPT-5.3-Codex",
        "execution_model: GPT-5.3-Codex",
        "created_at: 2026-03-18",
        "last_updated: 2026-03-18",
        "---",
        "",
        "# TODO: Add Guardrails",
        "",
        "## Goal",
        "x",
        "## Scope",
        "- x",
        "## Out Of Scope",
        "- x",
        "## Acceptance Criteria",
        "- x",
        "## Suggested Verification",
        "- npm run check",
        "## Notes",
      ].join("\n")
    );

    write(
      "backlog/done/20260318-120000-add-guardrails.md",
      ["---", "status: done", "---", "# TODO: Add guardrails"].join("\n")
    );

    const result = runBacklogTemplateLint({ repoRoot: root });
    assert.equal(
      result.issues.some((entry) => entry.includes("Open backlog item duplicates archived topic")),
      true
    );
  });
});

test("runBacklogTemplateLint reports all matching done paths for open-vs-done collisions", () => {
  withTempRepo(({ root, write }) => {
    write(
      "backlog/12-todo-open-item.md",
      [
        "---",
        "workflow_type: backlog-item",
        "source: workflow-ideas.md",
        "priority: 12",
        "status: open",
        "planning_model: GPT-5.3-Codex",
        "execution_model: GPT-5.3-Codex",
        "created_at: 2026-03-18",
        "last_updated: 2026-03-18",
        "---",
        "",
        "# TODO: Add Guardrails",
        "",
        "## Goal",
        "x",
        "## Scope",
        "- x",
        "## Out Of Scope",
        "- x",
        "## Acceptance Criteria",
        "- x",
        "## Suggested Verification",
        "- npm run check",
        "## Notes",
      ].join("\n")
    );

    write(
      "backlog/done/20260318-120000-add-guardrails.md",
      ["---", "status: done", "---", "# TODO: Add guardrails"].join("\n")
    );

    write(
      "backlog/done/20260318-130000-add-guardrails.md",
      ["---", "status: done", "---", "# TODO: Add Guardrails"].join("\n")
    );

    const result = runBacklogTemplateLint({ repoRoot: root });
    const collisionIssue = result.issues.find((entry) =>
      entry.includes("Open backlog item duplicates archived topic")
    );
    assert.equal(Boolean(collisionIssue), true);
    assert.equal(collisionIssue.includes("20260318-120000-add-guardrails.md"), true);
    assert.equal(collisionIssue.includes("20260318-130000-add-guardrails.md"), true);
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
