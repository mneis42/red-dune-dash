const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createTestHarness } = require("./test-helpers.js");

const {
  readOptionValue,
  parseArgs,
  isShortSingleLinePlainText,
  shouldUseBodyFile,
  classifyGhCommand,
  collectExecutionNotes,
  buildBodyArgs,
  main,
} = require("../scripts/gh-safe.js");

const { test, run } = createTestHarness("test:gh-safe");

test("parseArgs preserves gh args and body-stdin selection", () => {
  const result = parseArgs(["pr", "create", "--title", "Demo", "--body-stdin"]);

  assert.deepEqual(result, {
    passthroughArgs: ["pr", "create", "--title", "Demo"],
    bodyMode: "stdin",
    bodyValue: null,
    errors: [],
  });
});

test("readOptionValue supports split and equals forms", () => {
  assert.deepEqual(readOptionValue(["--body", "hello"], 0, "--body"), {
    value: "hello",
    nextIndex: 1,
    missing: false,
  });
  assert.deepEqual(readOptionValue(["--body=hello"], 0, "--body"), {
    value: "hello",
    nextIndex: 0,
    missing: false,
  });
});

test("parseArgs supports equals syntax for body options", () => {
  const result = parseArgs(["pr", "comment", "42", "--body=Use `npm test` before merge."]);

  assert.deepEqual(result, {
    passthroughArgs: ["pr", "comment", "42"],
    bodyMode: "inline",
    bodyValue: "Use `npm test` before merge.",
    errors: [],
  });
});

test("parseArgs supports equals syntax for body-file options", () => {
  const result = parseArgs(["pr", "comment", "42", "--body-file=message.md"]);

  assert.deepEqual(result, {
    passthroughArgs: ["pr", "comment", "42"],
    bodyMode: "file",
    bodyValue: "message.md",
    errors: [],
  });
});

test("parseArgs accepts inline body values that begin with dashes", () => {
  const result = parseArgs(["pr", "comment", "42", "--body", "--dry-run still fails here"]);

  assert.deepEqual(result, {
    passthroughArgs: ["pr", "comment", "42"],
    bodyMode: "inline",
    bodyValue: "--dry-run still fails here",
    errors: [],
  });
});
test("short single-line plain text bodies stay inline", () => {
  assert.equal(isShortSingleLinePlainText("Short plain note."), true);
  assert.equal(shouldUseBodyFile("Short plain note."), false);
});

test("inline code forces file-backed body handling", () => {
  assert.equal(isShortSingleLinePlainText("Use `npm test` before merge."), false);
  assert.equal(shouldUseBodyFile("Use `npm test` before merge."), true);
});

test("classifyGhCommand marks networked PR operations for upfront escalation", () => {
  assert.deepEqual(classifyGhCommand(["pr", "create", "--title", "Demo"]).classification, "network-required");
  assert.deepEqual(classifyGhCommand(["api", "repos/owner/repo/pulls"]).classification, "network-required");
});

test("classifyGhCommand keeps local help/version commands sandbox-safe", () => {
  assert.deepEqual(classifyGhCommand(["version"]).classification, "sandbox-safe");
  assert.deepEqual(classifyGhCommand(["--help"]).classification, "sandbox-safe");
  assert.deepEqual(classifyGhCommand(["pr", "create", "--help"]).classification, "sandbox-safe");
});

test("collectExecutionNotes adds gh api fallback wording for pr view json", () => {
  const result = collectExecutionNotes(["pr", "view", "42", "--json", "reviewThreads"]);

  assert.equal(result.classification.classification, "network-required");
  assert.equal(result.notes.length, 2);
  assert.match(result.notes[0], /request escalated execution up front/);
  assert.match(result.notes[1], /use `gh api`/);
});

test("multiline markdown review text is written to a temporary file", () => {
  const body = [
    "High: review body should preserve inline code like `npm test`.",
    "",
    "```text",
    "fenced code survives",
    "```",
  ].join("\n");
  let removedPath = null;
  const createdFiles = [];

  const result = buildBodyArgs(
    {
      passthroughArgs: ["pr", "review", "42", "--comment"],
      bodyMode: "inline",
      bodyValue: body,
      errors: [],
    },
    {
      tmpRoot: "/tmp",
      mkdtempSync: (prefix) => `${prefix}fixture`,
      writeFileSync: (filePath, contents) => {
        createdFiles.push({ filePath, contents });
      },
      rmSync: (candidatePath) => {
        removedPath = candidatePath;
      },
    }
  );

  assert.equal(result.mode, "temp-file");
  assert.deepEqual(result.args, ["--body-file", path.join("/tmp", "gh-body-fixture", "body.md")]);
  assert.equal(createdFiles.length, 1);
  assert.equal(createdFiles[0].contents, body);
  result.cleanup();
  assert.equal(removedPath, path.join("/tmp", "gh-body-fixture"));
});

test("explicit body files are preserved without temp-file rewrite", () => {
  const result = buildBodyArgs({
    passthroughArgs: ["pr", "comment", "42"],
    bodyMode: "file",
    bodyValue: "message.md",
    errors: [],
  });

  assert.equal(result.mode, "explicit-file");
  assert.deepEqual(result.args, ["--body-file", "message.md"]);
});

test("main routes stdin markdown through body-file and cleans temporary directory", () => {
  const body = "Line one with `code`.\n\n```text\nblock\n```";
  const createdFiles = [];
  const removedPaths = [];
  const runnerCalls = [];
  const logs = [];

  const exitCode = main(["pr", "comment", "42", "--body-stdin"], {
    logError: (line) => logs.push(line),
    readStdin: () => body,
    tmpRoot: "/tmp",
    mkdtempSync: (prefix) => `${prefix}run`,
    writeFileSync: (filePath, contents) => {
      createdFiles.push({ filePath, contents });
    },
    rmSync: (candidatePath) => {
      removedPaths.push(candidatePath);
    },
    runner: (_command, args) => {
      runnerCalls.push(args);
      return { status: 0 };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(runnerCalls, [["pr", "comment", "42", "--body-file", path.join("/tmp", "gh-body-run", "body.md")]]);
  assert.equal(createdFiles[0].contents, body);
  assert.deepEqual(removedPaths, [path.join("/tmp", "gh-body-run")]);
  assert.equal(logs.length, 1);
});

test("main keeps short inline bodies on native --body", () => {
  const runnerCalls = [];
  const logs = [];

  const exitCode = main(["pr", "comment", "42", "--body", "Short plain note."], {
    logError: (line) => logs.push(line),
    runner: (_command, args) => {
      runnerCalls.push(args);
      return { status: 0 };
    },
  });

  assert.equal(exitCode, 0);
  assert.deepEqual(runnerCalls, [["pr", "comment", "42", "--body", "Short plain note."]]);
  assert.equal(logs.length, 1);
});

test("main emits escalation note before running network-required gh commands", () => {
  const logs = [];

  const exitCode = main(["pr", "comment", "42", "--body", "Short plain note."], {
    logError: (line) => logs.push(line),
    runner: () => ({ status: 0 }),
  });

  assert.equal(exitCode, 0);
  assert.equal(logs.length, 1);
  assert.match(logs[0], /request escalated execution up front/);
});

run();
