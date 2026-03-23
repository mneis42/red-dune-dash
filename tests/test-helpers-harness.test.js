const assert = require("node:assert/strict");
const { createTestHarness } = require("../scripts/test-harness.js");

const { test, run } = createTestHarness("test:test-helpers");

async function withPatchedConsole(callback) {
  const originalLog = console.log;
  const originalError = console.error;
  const logs = [];
  const errors = [];

  console.log = (...args) => logs.push(args);
  console.error = (...args) => errors.push(args);

  try {
    return await callback({ logs, errors });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

test("standalone compact runs keep error details for single-suite debugging", async () => {
  const originalEnv = {
    RED_DUNE_TEST_OUTPUT: process.env.RED_DUNE_TEST_OUTPUT,
    RED_DUNE_TEST_PARENT_RUN: process.env.RED_DUNE_TEST_PARENT_RUN,
    RED_DUNE_TEST_MAX_FAILURES: process.env.RED_DUNE_TEST_MAX_FAILURES,
  };
  const originalExitCode = process.exitCode;

  delete process.env.RED_DUNE_TEST_PARENT_RUN;
  delete process.env.RED_DUNE_TEST_OUTPUT;
  delete process.env.RED_DUNE_TEST_MAX_FAILURES;
  process.exitCode = 0;

  const harness = createTestHarness("debug-suite");
  const failure = new Error("boom");
  harness.test("shows stack source", () => {
    throw failure;
  });

  let captured;
  try {
    await withPatchedConsole(async ({ logs, errors }) => {
      await harness.run();
      captured = { logs, errors };
    });
  } finally {
    if (originalEnv.RED_DUNE_TEST_OUTPUT === undefined) {
      delete process.env.RED_DUNE_TEST_OUTPUT;
    } else {
      process.env.RED_DUNE_TEST_OUTPUT = originalEnv.RED_DUNE_TEST_OUTPUT;
    }
    if (originalEnv.RED_DUNE_TEST_PARENT_RUN === undefined) {
      delete process.env.RED_DUNE_TEST_PARENT_RUN;
    } else {
      process.env.RED_DUNE_TEST_PARENT_RUN = originalEnv.RED_DUNE_TEST_PARENT_RUN;
    }
    if (originalEnv.RED_DUNE_TEST_MAX_FAILURES === undefined) {
      delete process.env.RED_DUNE_TEST_MAX_FAILURES;
    } else {
      process.env.RED_DUNE_TEST_MAX_FAILURES = originalEnv.RED_DUNE_TEST_MAX_FAILURES;
    }
    process.exitCode = originalExitCode;
  }

  assert.equal(captured.errors[0][0], "debug-suite: shows stack source: failed");
  assert.equal(captured.errors[1][0], failure);
  assert.equal(captured.logs[0][0], "debug-suite: 0 ok, 1 failed");
});

run();
