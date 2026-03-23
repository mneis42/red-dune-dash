const MACHINE_SUMMARY_PREFIX = "@@RED_DUNE_TEST_RESULT@@";
const DEFAULT_MAX_FAILURES = 5;

function parseMaxFailures(rawValue) {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_FAILURES;
}

function createSummary(suiteName, total) {
  return {
    suiteName,
    total,
    counts: {
      ok: 0,
      failed: 0,
    },
    truncated: false,
  };
}

function formatOutcomeSummary(label, counts) {
  const parts = [`${counts.ok ?? 0} ok`];
  for (const key of ["failed", "skipped", "warnings"]) {
    const value = counts[key] ?? 0;
    if (value > 0) {
      parts.push(`${value} ${key}`);
    }
  }

  return `${label}: ${parts.join(", ")}`;
}

function emitMachineSummary(summary) {
  if (!isParentRunEnabled(process.env.RED_DUNE_TEST_PARENT_RUN)) {
    return;
  }

  console.log(`${MACHINE_SUMMARY_PREFIX}${JSON.stringify(summary)}`);
}

function isParentRunEnabled(rawValue) {
  return rawValue === "1";
}

function createTestHarness(suiteName) {
  const tests = [];

  function test(name, fn) {
    tests.push({ name, fn });
  }

  async function run() {
    const mode = process.env.RED_DUNE_TEST_OUTPUT === "verbose" ? "verbose" : "compact";
    const maxFailures = parseMaxFailures(process.env.RED_DUNE_TEST_MAX_FAILURES);
    const isParentRun = isParentRunEnabled(process.env.RED_DUNE_TEST_PARENT_RUN);
    const summary = createSummary(suiteName, tests.length);

    try {
      for (const { name, fn } of tests) {
        if (summary.counts.failed >= maxFailures) {
          summary.truncated = true;
          break;
        }

        try {
          await fn();
          summary.counts.ok += 1;
          if (mode === "verbose") {
            console.log(`${suiteName}: ${name}: ok`);
          }
        } catch (error) {
          summary.counts.failed += 1;
          console.error(`${suiteName}: ${name}: failed`);
          if (mode === "verbose" || !isParentRun) {
            console.error(error);
          }
        }
      }
    } catch (error) {
      summary.counts.failed += 1;
      console.error(`${suiteName}: unhandled test runner failure: failed`);
      if (mode === "verbose" || !isParentRun) {
        console.error(error);
      }
    }

    if (summary.truncated) {
      console.error(`${suiteName}: stopped after ${maxFailures} failures; not all tests ran.`);
    }

    if (!isParentRun) {
      console.log(formatOutcomeSummary(suiteName, summary.counts));
      if (mode === "compact" && summary.counts.failed > 0) {
        console.log("Hint: rerun npm run verify:verbose for debugging detail.");
      }
    }

    emitMachineSummary(summary);

    if (summary.counts.failed > 0) {
      process.exitCode = 1;
    }
  }

  return {
    test,
    run,
  };
}

module.exports = {
  DEFAULT_MAX_FAILURES,
  MACHINE_SUMMARY_PREFIX,
  createTestHarness,
  formatOutcomeSummary,
  isParentRunEnabled,
  parseMaxFailures,
};
