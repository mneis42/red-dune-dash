const assert = require("node:assert/strict");
const { createTestHarness, formatStandaloneVerboseHint, isParentRunEnabled } = require("../scripts/test-harness.js");

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
  assert.equal(
    captured.logs[1][0],
    `Hint: rerun RED_DUNE_TEST_OUTPUT=verbose node ${process.argv[1]} for suite-local detail.`
  );
});

test("parent-run detection only enables machine mode for value 1", () => {
  assert.equal(isParentRunEnabled(undefined), false);
  assert.equal(isParentRunEnabled(""), false);
  assert.equal(isParentRunEnabled("true"), false);
  assert.equal(isParentRunEnabled("1"), true);
});

test("standalone verbose hint falls back cleanly without argv path", () => {
  const originalArgv = process.argv;
  process.argv = [originalArgv[0]];
  try {
    assert.equal(
      formatStandaloneVerboseHint(),
      "Hint: rerun the same suite with RED_DUNE_TEST_OUTPUT=verbose for suite-local detail."
    );
  } finally {
    process.argv = originalArgv;
  }
});

run();
