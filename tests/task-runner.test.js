const assert = require("node:assert/strict");
const { createTestHarness } = require("../scripts/test-harness.js");

const {
  parseArgs,
  runTestWorkflow,
  runVerifyWorkflow,
  TEST_SUITES,
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

test("parseArgs accepts split max-failures syntax", () => {
  assert.deepEqual(parseArgs(["test", "--max-failures", "3"]), {
    command: "test",
    mode: "compact",
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
    "Hint: rerun npm run test:verbose for detailed output.",
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

test("runTestWorkflow fails when a suite exits non-zero without failed counts", async () => {
  const stdout = [];
  const stderr = [];
  let callCount = 0;

  const exitCode = await runTestWorkflow(
    { mode: "compact", maxFailures: 5 },
    {
      writeStdout(line) {
        stdout.push(line);
      },
      writeStderr(line) {
        stderr.push(line);
      },
      async runTestSuite() {
        callCount += 1;
        if (callCount > 1) {
          return {
            exitCode: 0,
            summary: {
              suiteName: "test:service-worker",
              total: 1,
              counts: { ok: 1, failed: 0 },
              truncated: false,
            },
          };
        }

        return {
          exitCode: 1,
          summary: {
            suiteName: "test:simulation",
            total: 1,
            counts: { ok: 1, failed: 0 },
            truncated: false,
          },
        };
      },
    }
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, [
    `tests: ${TEST_SUITES.length} ok, 1 failed`,
    "Hint: rerun npm run test:verbose for detailed output.",
  ]);
  assert.deepEqual(stderr, []);
});

test("runTestWorkflow treats a missing machine summary as a runner failure", async () => {
  const stdout = [];
  const stderr = [];
  let callCount = 0;

  const exitCode = await runTestWorkflow(
    { mode: "compact", maxFailures: 5 },
    {
      writeStdout(line) {
        stdout.push(line);
      },
      writeStderr(line) {
        stderr.push(line);
      },
      async runTestSuite() {
        callCount += 1;
        if (callCount > 1) {
          return {
            exitCode: 0,
            missingSummary: false,
            summary: {
              suiteName: "test:service-worker",
              total: 1,
              counts: { ok: 1, failed: 0 },
              truncated: false,
            },
          };
        }

        return {
          exitCode: 0,
          missingSummary: true,
          summary: null,
        };
      },
    }
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, [
    `tests: ${TEST_SUITES.length - 1} ok, 1 failed`,
    "Hint: rerun npm run test:verbose for detailed output.",
  ]);
  assert.deepEqual(stderr, ["test:simulation: runner failure: missing machine summary"]);
});

test("runTestWorkflow treats an invalid machine summary as a runner failure", async () => {
  const stdout = [];
  const stderr = [];
  let callCount = 0;

  const exitCode = await runTestWorkflow(
    { mode: "compact", maxFailures: 5 },
    {
      writeStdout(line) {
        stdout.push(line);
      },
      writeStderr(line) {
        stderr.push(line);
      },
      async runTestSuite() {
        callCount += 1;
        if (callCount > 1) {
          return {
            exitCode: 0,
            invalidSummaryError: null,
            missingSummary: false,
            summary: {
              suiteName: "test:service-worker",
              total: 1,
              counts: { ok: 1, failed: 0 },
              truncated: false,
            },
          };
        }

        return {
          exitCode: 0,
          invalidSummaryError: new SyntaxError("Unexpected token } in JSON at position 1"),
          missingSummary: false,
          summary: null,
        };
      },
    }
  );

  assert.equal(exitCode, 1);
  assert.deepEqual(stdout, [
    `tests: ${TEST_SUITES.length - 1} ok, 1 failed`,
    "Hint: rerun npm run test:verbose for detailed output.",
  ]);
  assert.equal(stderr[0], "test:simulation: runner failure: invalid machine summary");
  assert.match(stderr[1], /Unexpected token/);
});

test("runTestWorkflow keeps going after a rejected suite and reports the failure", async () => {
  const stdout = [];
  const stderr = [];
  const seen = [];

  const exitCode = await runTestWorkflow(
    { mode: "compact", maxFailures: 5 },
    {
      writeStdout(line) {
        stdout.push(line);
      },
      writeStderr(line) {
        stderr.push(line);
      },
      async runTestSuite(suite) {
        seen.push(suite.id);
        if (suite.id === "test:simulation") {
          throw new Error("suite exploded");
        }
        return {
          exitCode: 0,
          summary: {
            suiteName: suite.id,
            total: 1,
            counts: { ok: 1, failed: 0 },
            truncated: false,
          },
        };
      },
    }
  );

  assert.equal(exitCode, 1);
  assert.equal(seen.includes("test:service-worker"), true);
  assert.equal(stderr[0], "test:simulation: runner failure: failed");
  assert.match(stderr[1], /suite exploded/);
  assert.deepEqual(stdout, [
    `tests: ${TEST_SUITES.length - 1} ok, 1 failed`,
    "Hint: rerun npm run test:verbose for detailed output.",
  ]);
});

test("runVerifyWorkflow continues through later stages after failures", async () => {
  const executed = [];
  let receivedRerunHint = null;

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
      async runTestWorkflow(_options, deps) {
        executed.push("workflow:test");
        receivedRerunHint = deps.rerunHint;
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
  assert.equal(receivedRerunHint, "npm run verify:verbose");
});

test("runVerifyWorkflow continues after rejected steps and reports runner failures", async () => {
  const executed = [];
  const stderr = [];

  const exitCode = await runVerifyWorkflow(
    { mode: "compact", maxFailures: 5 },
    {
      writeStderr(line) {
        stderr.push(line);
      },
      async runNodeFile(file) {
        executed.push(file);
        if (file === "scripts/check-syntax.js") {
          throw new Error("check crashed");
        }
        return { exitCode: 0 };
      },
      async runTestWorkflow() {
        executed.push("workflow:test");
        throw new Error("tests crashed");
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
  assert.equal(stderr[0], "check: runner failure: failed");
  assert.match(stderr[1], /check crashed/);
  assert.equal(stderr[2], "test: runner failure: failed");
  assert.match(stderr[3], /tests crashed/);
});

run();
