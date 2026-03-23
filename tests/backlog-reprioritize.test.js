const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createTestHarness } = require("../scripts/test-harness.js");

const {
  parseArgs,
  parseRawMappingEntries,
  parseMappingFile,
  planReprioritization,
  executeRenamePlan,
  runCli,
} = require("../scripts/backlog-reprioritize.js");
const { validateBacklogFile } = require("../scripts/backlog-template-lint.js");

const { test, run } = createTestHarness("test:backlog-reprioritize");

function withTempRepo(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rdd-backlog-reprioritize-"));

  function write(relativePath, content) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, content);
  }

  function read(relativePath) {
    return fs.readFileSync(path.join(root, relativePath), "utf8");
  }

  function exists(relativePath) {
    return fs.existsSync(path.join(root, relativePath));
  }

  function list(relativePath) {
    return fs.readdirSync(path.join(root, relativePath)).sort();
  }

  try {
    callback({ root, write, read, exists, list });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function createBacklogItemContent({ priority, title, extraFrontmatter = [] }) {
  return [
    "---",
    "workflow_type: backlog-item",
    "source: test",
    `priority: ${priority}`,
    "status: open",
    "created_at: 2026-03-23",
    ...extraFrontmatter,
    "---",
    "",
    `# TODO: ${title}`,
    "",
    "## Goal",
    "x",
    "",
    "## Scope",
    "- x",
    "",
    "## Out Of Scope",
    "- x",
    "",
    "## Acceptance Criteria",
    "- x",
    "",
    "## Suggested Verification",
    "- x",
    "",
    "## Notes",
    "- x",
    "",
  ].join("\n");
}

test("parseArgs reads mapping file, backlog dir, apply, and json options", () => {
  const options = parseArgs(["--mapping-file", "tmp/map.json", "--backlog-dir", "fixtures/backlog", "--apply", "--json"]);

  assert.deepEqual(options, {
    backlogDir: "fixtures/backlog",
    mappingFile: "tmp/map.json",
    apply: true,
    json: true,
    errors: [],
  });
});

test("parseMappingFile rejects duplicate targets", () => {
  assert.throws(() => parseMappingFile('{"1":2,"2":2}'), /Duplicate target priorities/);
});

test("parseRawMappingEntries preserves duplicate source keys before JSON object collapse", () => {
  const entries = parseRawMappingEntries('{"1":2,"1":3,"2":1}');

  assert.deepEqual(
    entries.map((entry) => [entry.rawFrom, entry.to]),
    [
      ["1", 2],
      ["1", 3],
      ["2", 1],
    ]
  );
});

test("parseMappingFile rejects duplicate source priorities from raw json content", () => {
  assert.throws(
    () => parseMappingFile('{"1":2,"1":3,"2":1}'),
    /Duplicate source priorities are not allowed: 1/
  );
});

test("planReprioritization builds deterministic dry-run summary", () => {
  withTempRepo(({ root, write }) => {
    write("backlog/1-todo-alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("backlog/2-todo-beta.md", createBacklogItemContent({ priority: 2, title: "Beta" }));
    write("mapping.json", JSON.stringify({ 1: 2, 2: 1 }, null, 2));

    const result = planReprioritization(root, {
      backlogDir: "backlog",
      mappingFile: "mapping.json",
      apply: false,
    });

    assert.equal(result.mode, "dry-run");
    assert.equal(result.operations.length, 2);
    assert.deepEqual(
      result.operations.map((entry) => [entry.sourcePath, entry.finalPath]),
      [
        ["backlog/1-todo-alpha.md", "backlog/2-todo-alpha.md"],
        ["backlog/2-todo-beta.md", "backlog/1-todo-beta.md"],
      ]
    );
  });
});

test("runCli apply performs two-phase rename without partial writes", () => {
  withTempRepo(({ root, write, exists, list }) => {
    write("backlog/1-todo-alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("backlog/2-todo-beta.md", createBacklogItemContent({ priority: 2, title: "Beta" }));
    write("mapping.json", JSON.stringify({ 1: 2, 2: 1 }, null, 2));

    const stdout = [];
    const stderr = [];
    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog", "--apply"], {
      repoRoot: root,
      writeStdout: (line) => stdout.push(line),
      writeStderr: (line) => stderr.push(line),
    });

    assert.equal(exitCode, 0);
    assert.deepEqual(stderr, []);
    assert.equal(stdout.length, 1);
    assert.equal(exists("backlog/1-todo-beta.md"), true);
    assert.equal(exists("backlog/2-todo-alpha.md"), true);
    assert.equal(exists("backlog/1-todo-alpha.md"), false);
    assert.equal(exists("backlog/2-todo-beta.md"), false);
    assert.deepEqual(list("backlog"), ["1-todo-beta.md", "2-todo-alpha.md"]);
    assert.deepEqual(validateBacklogFile(root, "backlog/1-todo-beta.md"), []);
    assert.deepEqual(validateBacklogFile(root, "backlog/2-todo-alpha.md"), []);
  });
});

test("runCli apply rewrites backlog-item priority and preserves 12+ lint validity", () => {
  withTempRepo(({ root, write, read, exists }) => {
    write(
      "backlog/11-todo-alpha.md",
      createBacklogItemContent({
        priority: 11,
        title: "Alpha",
        extraFrontmatter: ["planning_model: GPT-5.4", "execution_model: GPT-5.4", "last_updated: 2026-03-23"],
      })
    );
    write(
      "backlog/13-todo-beta.md",
      createBacklogItemContent({
        priority: 13,
        title: "Beta",
        extraFrontmatter: ["planning_model: GPT-5.4", "execution_model: GPT-5.4", "last_updated: 2026-03-23"],
      })
    );
    write("mapping.json", JSON.stringify({ 11: 13, 13: 11 }, null, 2));

    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog", "--apply"], {
      repoRoot: root,
      writeStdout: () => {},
      writeStderr: () => {},
    });

    assert.equal(exitCode, 0);
    assert.equal(exists("backlog/13-todo-alpha.md"), true);
    assert.equal(exists("backlog/11-todo-beta.md"), true);
    assert.match(read("backlog/13-todo-alpha.md"), /^priority: 13$/m);
    assert.match(read("backlog/11-todo-beta.md"), /^priority: 11$/m);
    assert.deepEqual(validateBacklogFile(root, "backlog/13-todo-alpha.md"), []);
    assert.deepEqual(validateBacklogFile(root, "backlog/11-todo-beta.md"), []);
  });
});

test("runCli dry-run does not mutate fixture files", () => {
  withTempRepo(({ root, write, read, list }) => {
    write("backlog/1-todo-alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("backlog/2-todo-beta.md", createBacklogItemContent({ priority: 2, title: "Beta" }));
    write("mapping.json", JSON.stringify({ 1: 2, 2: 1 }, null, 2));

    const beforeAlpha = read("backlog/1-todo-alpha.md");
    const beforeBeta = read("backlog/2-todo-beta.md");
    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog"], {
      repoRoot: root,
      writeStdout: () => {},
      writeStderr: () => {},
    });

    assert.equal(exitCode, 0);
    assert.equal(read("backlog/1-todo-alpha.md"), beforeAlpha);
    assert.equal(read("backlog/2-todo-beta.md"), beforeBeta);
    assert.deepEqual(list("backlog"), ["1-todo-alpha.md", "2-todo-beta.md"]);
  });
});

test("runCli rejects incomplete mappings before mutation", () => {
  withTempRepo(({ root, write, list }) => {
    write("backlog/1-todo-alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("backlog/2-todo-beta.md", createBacklogItemContent({ priority: 2, title: "Beta" }));
    write("mapping.json", JSON.stringify({ 1: 2 }, null, 2));

    const stderr = [];
    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog", "--apply"], {
      repoRoot: root,
      writeStdout: () => {},
      writeStderr: (line) => stderr.push(line),
    });

    assert.equal(exitCode, 1);
    assert.match(stderr.join("\n"), /Missing mapping for prioritized backlog file backlog\/2-todo-beta\.md/);
    assert.deepEqual(list("backlog"), ["1-todo-alpha.md", "2-todo-beta.md"]);
  });
});

test("runCli rejects missing source priorities before mutation", () => {
  withTempRepo(({ root, write, list }) => {
    write("backlog/1-todo-alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("mapping.json", JSON.stringify({ 1: 2, 2: 1 }, null, 2));

    const stderr = [];
    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog", "--apply"], {
      repoRoot: root,
      writeStdout: () => {},
      writeStderr: (line) => stderr.push(line),
    });

    assert.equal(exitCode, 1);
    assert.match(stderr.join("\n"), /Missing source file for priority 2/);
    assert.deepEqual(list("backlog"), ["1-todo-alpha.md"]);
  });
});

test("runCli rejects files with invalid numbered backlog coverage before mutation", () => {
  withTempRepo(({ root, write, list }) => {
    write("backlog/1-todo-alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("backlog/notes.md", "freeform\n");
    write("mapping.json", JSON.stringify({ 1: 2 }, null, 2));

    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog"], {
      repoRoot: root,
      writeStdout: () => {},
      writeStderr: () => {},
    });

    assert.equal(exitCode, 0);
    assert.deepEqual(list("backlog"), ["1-todo-alpha.md", "notes.md"]);
  });
});

test("runCli rejects duplicate prioritized numbers instead of silently picking one file", () => {
  withTempRepo(({ root, write, list }) => {
    write("backlog/1-alpha.md", "alpha\n");
    write("backlog/1-beta.md", "beta\n");
    write("mapping.json", JSON.stringify({ 1: 2 }, null, 2));

    const stderr = [];
    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog"], {
      repoRoot: root,
      writeStdout: () => {},
      writeStderr: (line) => stderr.push(line),
    });

    assert.equal(exitCode, 1);
    assert.match(stderr.join("\n"), /Duplicate prioritized backlog number 1/);
    assert.deepEqual(list("backlog"), ["1-alpha.md", "1-beta.md"]);
  });
});

test("runCli rejects case-collision targets explicitly", () => {
  withTempRepo(({ root, write, list }) => {
    write("backlog/1-todo-Alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("backlog/2-todo-alpha.md", createBacklogItemContent({ priority: 2, title: "alpha" }));
    write("mapping.json", JSON.stringify({ 1: 2, 2: 1 }, null, 2));

    const stderr = [];
    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog"], {
      repoRoot: root,
      writeStdout: () => {},
      writeStderr: (line) => stderr.push(line),
    });

    assert.equal(exitCode, 1);
    assert.match(stderr.join("\n"), /Case-insensitive target collision detected/);
    assert.deepEqual(list("backlog"), ["1-todo-Alpha.md", "2-todo-alpha.md"]);
  });
});

test("runCli rejects Windows-reserved backlog directory path segments", () => {
  withTempRepo(({ root, write, list }) => {
    write("con/1-todo-alpha.md", "alpha\n");
    write("mapping.json", JSON.stringify({ 1: 2 }, null, 2));

    const stderr = [];
    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "con"], {
      repoRoot: root,
      writeStdout: () => {},
      writeStderr: (line) => stderr.push(line),
    });

    assert.equal(exitCode, 1);
    assert.match(stderr.join("\n"), /Windows-reserved path segment/);
    assert.deepEqual(list("con"), ["1-todo-alpha.md"]);
  });
});

test("runCli emits machine-readable json output", () => {
  withTempRepo(({ root, write }) => {
    write("backlog/1-todo-alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("mapping.json", JSON.stringify({ 1: 3 }, null, 2));

    const stdout = [];
    const exitCode = runCli(["--mapping-file", "mapping.json", "--backlog-dir", "backlog", "--json"], {
      repoRoot: root,
      writeStdout: (line) => stdout.push(line),
      writeStderr: () => {},
    });

    assert.equal(exitCode, 0);
    const parsed = JSON.parse(stdout[0]);
    assert.equal(parsed.mode, "dry-run");
    assert.equal(parsed.plannedRenameCount, 1);
    assert.deepEqual(parsed.renames[0], {
      from: 1,
      to: 3,
      sourcePath: "backlog/1-todo-alpha.md",
      finalPath: "backlog/3-todo-alpha.md",
    });
  });
});

test("executeRenamePlan rolls back temp and final renames when second phase fails", () => {
  withTempRepo(({ root, write, list, exists }) => {
    write("backlog/1-todo-alpha.md", createBacklogItemContent({ priority: 1, title: "Alpha" }));
    write("backlog/2-todo-beta.md", createBacklogItemContent({ priority: 2, title: "Beta" }));
    write("mapping.json", JSON.stringify({ 1: 2, 2: 1 }, null, 2));

    const plan = planReprioritization(root, {
      backlogDir: "backlog",
      mappingFile: "mapping.json",
      apply: true,
    });

    let renameCount = 0;
    const flakyFs = {
      renameSync(sourcePath, targetPath) {
        renameCount += 1;
        if (renameCount === 4) {
          throw new Error("Injected rename failure during finalization.");
        }
        fs.renameSync(sourcePath, targetPath);
      },
      writeFileSync(filePath, content) {
        fs.writeFileSync(filePath, content);
      },
    };

    assert.throws(
      () => executeRenamePlan(plan.operations, flakyFs),
      /Injected rename failure during finalization/
    );
    assert.deepEqual(list("backlog"), ["1-todo-alpha.md", "2-todo-beta.md"]);
    assert.equal(exists("backlog/1-todo-alpha.md"), true);
    assert.equal(exists("backlog/2-todo-beta.md"), true);
  });
});

run();
