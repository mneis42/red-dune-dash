const assert = require("node:assert/strict");
const { createTestHarness } = require("../scripts/test-harness.js");

const {
  parseArgs,
  runTestWorkflow,
  runVerifyWorkflow,
} = require("../scripts/task-runner.js");

const { test, run } = createTestHarness("test:task-runner");

test("parseArgs keeps compact defaults", () => {
  assert.deepEqual(parseArgs(["test"]), {
    command: "test",
    mode: "compact",
    maxFailures: 5,
  });
});

test("parseArgs accepts verbose mode and max-failures override", () => {
  assert.deepEqual(parseArgs(["verify", "--verbose", "--max-failures=3"]), {
    command: "verify",
    mode: "verbose",
    maxFailures: 3,
  });
});

test("runTestWorkflow aggregates counts and stops when max failures is reached", async () => {
  const stdout = [];
  const stderr = [];
  const calls = [];

  const exitCode = await runTestWorkflow(
    { mode: "compact", maxFailures: 3 },
    {
      writeStdout(line) {
        stdout.push(line);
      },
      writeStderr(line) {
        stderr.push(line);
      },
      async runTestSuite(suite, options) {
        calls.push({ id: suite.id, remainingFailures: options.remainingFailures });
        if (calls.length === 1) {
          return {
            exitCode: 1,
            summary: {
              suiteName: suite.id,
              total: 4,
              counts: { ok: 1, failed: 2 },
              truncated: false,
            },
          };
        }

        return {
          exitCode: 1,
          summary: {
            suiteName: suite.id,
            total: 2,
            counts: { ok: 0, failed: 1 },
            truncated: true,
          },
        };
      },
    }
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(calls, [
    { id: "test:simulation", remainingFailures: 3 },
    { id: "test:service-worker", remainingFailures: 1 },
  ]);
  assert.deepEqual(stdout, [
    "tests: 1 ok, 3 failed",
    "Hint: rerun npm run verify:verbose for debugging detail.",
  ]);
  assert.deepEqual(stderr, ["tests: stopped after 3 failures; not all tests ran."]);
});

test("runTestWorkflow does not claim truncation when the last suite reaches the failure cap", async () => {
  const stdout = [];
  const stderr = [];
  const originalSuites = require("../scripts/task-runner.js").TEST_SUITES.slice();

  const exitCode = await runTestWorkflow(
    { mode: "compact", maxFailures: 3 },
    {
      writeStdout(line) {
        stdout.push(line);
      },
      writeStderr(line) {
        stderr.push(line);
      },
      async runTestSuite(suite) {
        if (suite.id === originalSuites[0].id) {
          return {
            exitCode: 1,
            summary: {
              suiteName: suite.id,
              total: 2,
              counts: { ok: 0, failed: 2 },
              truncated: false,
            },
          };
        }

        return {
          exitCode: suite.id === originalSuites[originalSuites.length - 1].id ? 1 : 0,
          summary: {
            suiteName: suite.id,
            total: 1,
            counts: {
              ok: suite.id === originalSuites[originalSuites.length - 1].id ? 0 : 1,
              failed: suite.id === originalSuites[originalSuites.length - 1].id ? 1 : 0,
            },
            truncated: false,
          },
        };
      },
    }
  );

  assert.equal(exitCode, 1);
  assert.equal(stdout[0].includes("3 failed"), true);
  assert.deepEqual(stderr, []);
});

test("runVerifyWorkflow continues through later stages after failures", async () => {
  const executed = [];

  const exitCode = await runVerifyWorkflow(
    { mode: "compact", maxFailures: 5 },
    {
      async runNodeFile(file) {
        executed.push(file);
        if (file === "scripts/check-syntax.js") {
          return { exitCode: 1 };
        }
        return { exitCode: 0 };
      },
      async runTestWorkflow() {
        executed.push("workflow:test");
        return 1;
      },
    }
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(executed, [
    "scripts/check-syntax.js",
    "workflow:test",
    "scripts/instruction-lint.js",
    "scripts/docs-language-lint.js",
    "scripts/backlog-template-lint.js",
  ]);
});

run();
