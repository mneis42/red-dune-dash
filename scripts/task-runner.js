const { spawn } = require("node:child_process");
const path = require("node:path");

const { DEFAULT_MAX_FAILURES, MACHINE_SUMMARY_PREFIX, formatOutcomeSummary, parseMaxFailures } = require("./test-harness.js");

const TEST_SUITES = [
  { id: "test:simulation", file: "tests/simulation-core.test.js" },
  { id: "test:service-worker", file: "tests/service-worker.test.js" },
  { id: "test:pwa-assets", file: "tests/pwa-asset-manifest.test.js" },
  { id: "test:pwa-smoke", file: "tests/pwa-local-smoke.test.js" },
  { id: "test:advisory-rules", file: "tests/advisory-rules.test.js" },
  { id: "test:agent-advisory", file: "tests/agent-advisory.test.js" },
  { id: "test:preflight", file: "tests/agent-preflight.test.js" },
  { id: "test:summary", file: "tests/agent-summary.test.js" },
  { id: "test:task-runner", file: "tests/task-runner.test.js" },
  { id: "test:test-helpers", file: "tests/test-helpers-harness.test.js" },
  { id: "test:git-guard", file: "tests/agent-git-guard.test.js" },
  { id: "test:gh-safe", file: "tests/gh-safe.test.js" },
  { id: "test:instruction-lint", file: "tests/instruction-lint.test.js" },
  { id: "test:docs-language-lint", file: "tests/docs-language-lint.test.js" },
  { id: "test:backlog-lint", file: "tests/backlog-template-lint.test.js" },
  { id: "test:backlog-branch", file: "tests/backlog-to-branch.test.js" },
];

const VERIFY_STEPS = [
  { id: "check", type: "node", file: "scripts/check-syntax.js" },
  { id: "test", type: "workflow", workflow: "test" },
  { id: "instruction:lint", type: "node", file: "scripts/instruction-lint.js" },
  { id: "docs:language:lint", type: "node", file: "scripts/docs-language-lint.js" },
  { id: "backlog:lint", type: "node", file: "scripts/backlog-template-lint.js" },
];

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const command = args[0] || "verify";
  let mode = "compact";
  let maxFailures = DEFAULT_MAX_FAILURES;

  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--verbose") {
      mode = "verbose";
      continue;
    }

    if (arg.startsWith("--max-failures=")) {
      maxFailures = parseMaxFailures(arg.slice("--max-failures=".length));
      continue;
    }

    if (arg === "--max-failures" && index + 1 < args.length) {
      maxFailures = parseMaxFailures(args[index + 1]);
      index += 1;
    }
  }

  return { command, mode, maxFailures };
}

function forwardLines(stream, onLine) {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    lines.forEach((line) => onLine(line));
  });
  stream.on("end", () => {
    if (buffer) {
      onLine(buffer);
    }
  });
}

function runNodeFile(file, { env = {}, onStdoutLine, onStderrLine } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(process.cwd(), file)], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    forwardLines(child.stdout, (line) => {
      if (onStdoutLine) {
        onStdoutLine(line);
      } else {
        process.stdout.write(`${line}\n`);
      }
    });
    forwardLines(child.stderr, (line) => {
      if (onStderrLine) {
        onStderrLine(line);
      } else {
        process.stderr.write(`${line}\n`);
      }
    });

    child.on("error", reject);
    child.on("close", (code) => resolve({ exitCode: code ?? 1 }));
  });
}

function createRejectedResult(error, fallback = {}) {
  return {
    exitCode: 1,
    rejected: true,
    error,
    ...fallback,
  };
}

async function invokeWithRejectionCapture(callback, fallback = {}) {
  try {
    return await callback();
  } catch (error) {
    return createRejectedResult(error, fallback);
  }
}

async function runTestSuite(suite, options) {
  let summary = null;
  const { mode, remainingFailures } = options;

  const result = await runNodeFile(suite.file, {
    env: {
      RED_DUNE_TEST_OUTPUT: mode,
      RED_DUNE_TEST_PARENT_RUN: "1",
      RED_DUNE_TEST_MAX_FAILURES: String(remainingFailures),
    },
    onStdoutLine(line) {
      if (line.startsWith(MACHINE_SUMMARY_PREFIX)) {
        summary = JSON.parse(line.slice(MACHINE_SUMMARY_PREFIX.length));
        return;
      }
      process.stdout.write(`${line}\n`);
    },
    onStderrLine(line) {
      process.stderr.write(`${line}\n`);
    },
  });

  return {
    exitCode: result.exitCode,
    missingSummary: summary === null,
    summary: summary || null,
  };
}

async function runTestWorkflow({ mode, maxFailures }, dependencies = {}) {
  const executeSuite = dependencies.runTestSuite || runTestSuite;
  const writeStdout = dependencies.writeStdout || ((line) => process.stdout.write(`${line}\n`));
  const writeStderr = dependencies.writeStderr || ((line) => process.stderr.write(`${line}\n`));
  const rerunHint = dependencies.rerunHint || "npm run test:verbose";

  const totalCounts = { ok: 0, failed: 0 };
  let truncated = false;
  let exitCode = 0;

  for (const [index, suite] of TEST_SUITES.entries()) {
    const remainingFailures = Math.max(1, maxFailures - totalCounts.failed);
    const result = await invokeWithRejectionCapture(
      () => executeSuite(suite, { mode, remainingFailures }),
      {
        missingSummary: false,
        summary: {
          suiteName: suite.id,
          total: 0,
          counts: { ok: 0, failed: 1 },
          truncated: false,
        },
      }
    );
    const counts = { ...(result.summary?.counts || { ok: 0, failed: 0 }) };
    if (result.missingSummary) {
      counts.failed = Math.max(1, counts.failed || 0);
      exitCode = 1;
      writeStderr(`${suite.id}: runner failure: missing machine summary`);
    }
    if (result.exitCode !== 0 && (counts.failed || 0) === 0) {
      counts.failed = 1;
    }

    totalCounts.ok += counts.ok || 0;
    totalCounts.failed += counts.failed || 0;
    if (result.exitCode !== 0) {
      exitCode = 1;
    }

    if (result.rejected) {
      writeStderr(`${suite.id}: runner failure: failed`);
      if (result.error) {
        writeStderr(result.error.stack || String(result.error));
      }
    }

    if (result.summary?.truncated) {
      truncated = true;
      break;
    }

    if (totalCounts.failed >= maxFailures) {
      truncated = index < TEST_SUITES.length - 1;
      break;
    }
  }

  writeStdout(formatOutcomeSummary("tests", totalCounts));
  if (truncated) {
    writeStderr(`tests: stopped after ${maxFailures} failures; not all tests ran.`);
  }
  if (mode === "compact" && totalCounts.failed > 0) {
    writeStdout(`Hint: rerun ${rerunHint} for detailed output.`);
  }

  return exitCode !== 0 || totalCounts.failed > 0 ? 1 : 0;
}

async function runVerifyWorkflow({ mode, maxFailures }, dependencies = {}) {
  const executeNodeFile = dependencies.runNodeFile || runNodeFile;
  const executeTestWorkflow = dependencies.runTestWorkflow || runTestWorkflow;
  const writeStderr = dependencies.writeStderr || ((line) => process.stderr.write(`${line}\n`));
  let exitCode = 0;

  for (const step of VERIFY_STEPS) {
    if (step.type === "workflow") {
      const result = await invokeWithRejectionCapture(
        () => executeTestWorkflow({ mode, maxFailures }, { ...dependencies, rerunHint: "npm run verify:verbose" }),
        {}
      );
      const stepExitCode = result.exitCode ?? result;
      if (stepExitCode !== 0) {
        exitCode = 1;
      }
      if (result.rejected) {
        writeStderr(`${step.id}: runner failure: failed`);
        if (result.error) {
          writeStderr(result.error.stack || String(result.error));
        }
      }
      continue;
    }

    const result = await invokeWithRejectionCapture(() => executeNodeFile(step.file), {});
    if (result.exitCode !== 0) {
      exitCode = 1;
    }
    if (result.rejected) {
      writeStderr(`${step.id}: runner failure: failed`);
      if (result.error) {
        writeStderr(result.error.stack || String(result.error));
      }
    }
  }

  return exitCode;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  let exitCode;
  if (options.command === "test") {
    exitCode = await runTestWorkflow(options);
  } else if (options.command === "verify") {
    exitCode = await runVerifyWorkflow(options);
  } else {
    console.error(`Unknown task runner command: ${options.command}`);
    exitCode = 1;
  }

  process.exitCode = exitCode;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_MAX_FAILURES,
  TEST_SUITES,
  VERIFY_STEPS,
  formatOutcomeSummary,
  parseArgs,
  runNodeFile,
  runTestSuite,
  runTestWorkflow,
  runVerifyWorkflow,
};
