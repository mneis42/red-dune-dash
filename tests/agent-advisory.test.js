const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function loadCliModuleFresh() {
  const modulePath = require.resolve("../scripts/agent-advisory.js");
  delete require.cache[modulePath];
  return require(modulePath);
}

test("importing advisory CLI module does not auto-run main", () => {
  const originalLog = console.log;
  const originalError = console.error;
  const logMessages = [];
  const errorMessages = [];

  console.log = (...args) => {
    logMessages.push(args.map((value) => String(value)).join(" "));
  };
  console.error = (...args) => {
    errorMessages.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const cli = loadCliModuleFresh();
    assert.equal(typeof cli.main, "function");
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  assert.equal(logMessages.length, 0);
  assert.equal(errorMessages.length, 0);
});

test("module exports reusable CLI helpers", () => {
  const cli = loadCliModuleFresh();
  assert.equal(typeof cli.parseArgs, "function");
  assert.equal(typeof cli.runGit, "function");
  assert.equal(typeof cli.getChangedFiles, "function");
  assert.equal(typeof cli.formatHumanReadable, "function");
  assert.equal(typeof cli.main, "function");
});

test("main keeps JSON behavior when executed programmatically", () => {
  const cli = loadCliModuleFresh();
  const originalLog = console.log;
  const output = [];

  console.log = (...args) => {
    output.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const exitCode = cli.main(["--json", "--files", "version.json"]);
    assert.equal(exitCode, 0);
  } finally {
    console.log = originalLog;
  }

  assert.equal(output.length, 1);
  const payload = JSON.parse(output[0]);
  assert.deepEqual(payload.changedFiles, ["version.json"]);
  assert.equal(Array.isArray(payload.perFile), true);
});

test("main returns non-zero for invalid advisory rules without exiting host process", () => {
  const cli = loadCliModuleFresh();
  const tempFilePath = path.join(os.tmpdir(), `invalid-advisory-${Date.now()}.json`);
  const originalError = console.error;
  const errors = [];

  fs.writeFileSync(tempFilePath, JSON.stringify({ version: 1, rules: [] }), "utf8");
  console.error = (...args) => {
    errors.push(args.map((value) => String(value)).join(" "));
  };

  try {
    const exitCode = cli.main(["--rules", tempFilePath]);
    assert.equal(exitCode, 1);
  } finally {
    console.error = originalError;
    fs.unlinkSync(tempFilePath);
  }

  assert.equal(errors.some((line) => line.includes("Invalid advisory rules in")), true);
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
