const { execFileSync } = require("node:child_process");
const {
  loadAdvisoryDocument,
  validateAdvisoryDocument,
  resolveAdvisoryForFiles,
} = require("./advisory-rules.js");

const SIGNAL_METADATA = {
  syntax: {
    label: "Syntax validation",
    checkOutcomes: ["npm run check"],
    jobStatuses: [],
    aggregateJobs: ["verify-linux-signals"],
  },
  "simulation-tests": {
    label: "Simulation tests",
    checkOutcomes: ["npm run test:simulation"],
    jobStatuses: [],
    aggregateJobs: ["verify-linux-signals"],
  },
  "service-worker-tests": {
    label: "Service worker tests",
    checkOutcomes: ["npm run test:service-worker"],
    jobStatuses: [],
    aggregateJobs: ["verify-linux-signals"],
  },
  "instruction-lint": {
    label: "Instruction lint",
    checkOutcomes: ["npm run instruction:lint"],
    jobStatuses: [],
    aggregateJobs: ["verify-linux-signals"],
  },
  "docs-language-lint": {
    label: "Docs language lint",
    checkOutcomes: ["npm run docs:language:lint"],
    jobStatuses: [],
    aggregateJobs: ["verify-linux-signals"],
  },
  "backlog-lint": {
    label: "Backlog lint",
    checkOutcomes: ["npm run backlog:lint"],
    jobStatuses: [],
    aggregateJobs: ["verify-linux-signals"],
  },
  "test-suite": {
    label: "Repository test suite",
    checkOutcomes: ["npm test"],
    jobStatuses: [],
    aggregateJobs: ["verify-linux-signals"],
  },
  "verify-linux-signals": {
    label: "Linux verification job",
    checkOutcomes: [],
    jobStatuses: ["verify-linux-signals"],
    aggregateJobs: [],
  },
  "cross-platform-verify": {
    label: "Cross-platform verification job",
    checkOutcomes: [],
    jobStatuses: ["cross-platform-verify"],
    aggregateJobs: [],
  },
  "required-check": {
    label: "Required compatibility gate",
    checkOutcomes: [],
    jobStatuses: ["required-check"],
    aggregateJobs: [],
  },
  "advisory-fallback": {
    label: "Fallback advisory classification",
    checkOutcomes: [],
    jobStatuses: [],
    aggregateJobs: [],
  },
};

const VALID_RUNTIME_STATES = new Set(["pass", "fail", "cancelled", "skipped", "not-observed"]);
const HARD_GATE_CANDIDATES = [
  {
    id: "broken-instruction-references",
    status: "enforced",
    confidence: "high",
    blocking: true,
    source: ["npm run instruction:lint", "CI verify-linux-signals"],
    note:
      "Broken internal instruction links, missing canonical references, and missing required workflow coverage already fail deterministic workflow validation.",
  },
  {
    id: "missing-mandatory-canonical-artifacts",
    status: "enforced",
    confidence: "high",
    blocking: true,
    source: ["npm run instruction:lint", "npm run backlog:lint", "CI verify-linux-signals"],
    note:
      "Required canonical workflow files and required backlog/template artifacts are already protected by deterministic lint checks.",
  },
  {
    id: "broken-mandatory-validation-jobs",
    status: "enforced",
    confidence: "high",
    blocking: true,
    source: ["CI verify-linux-signals", "CI test"],
    note:
      "Required verification jobs already hard-fail the compatibility gate when deterministic validation jobs are red.",
  },
  {
    id: "protected-branch-violations",
    status: "candidate-only",
    confidence: "high",
    blocking: false,
    source: ["scripts/setup-hooks.js", "agent:preflight guardrail signal"],
    note:
      "Protected-branch behavior is currently guarded locally and surfaced as an observable preflight signal, but it is not promoted to a CI hard-fail gate yet.",
  },
];

function stableUnique(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

function normalizeRuntimeState(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "success" || normalized === "passed" || normalized === "pass") {
    return "pass";
  }

  if (normalized === "failure" || normalized === "failed" || normalized === "fail" || normalized === "error") {
    return "fail";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "cancelled";
  }

  if (normalized === "skipped") {
    return "skipped";
  }

  if (normalized === "not-observed" || normalized === "missing" || normalized === "unknown") {
    return "not-observed";
  }

  return null;
}

function readOptionValue(argv, index) {
  const candidate = argv[index + 1];
  if (!candidate || String(candidate).startsWith("--")) {
    return null;
  }
  return String(candidate);
}

function parseNameValuePairs(entries) {
  const result = {};

  entries.forEach((entry) => {
    const value = String(entry || "").trim();
    if (!value) {
      return;
    }

    const separatorIndex = value.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = value.slice(0, separatorIndex).trim();
    const rawState = value.slice(separatorIndex + 1).trim();
    const normalizedState = normalizeRuntimeState(rawState);
    if (!key || !normalizedState) {
      return;
    }

    result[key] = normalizedState;
  });

  return result;
}

function parseRuntimeStateMap(raw) {
  if (!raw) {
    return {};
  }

  const value = String(raw).trim();
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, state]) => [String(key), normalizeRuntimeState(state)])
        .filter((entry) => entry[0] && entry[1] && VALID_RUNTIME_STATES.has(entry[1]))
    );
  } catch (_error) {
    return parseNameValuePairs(value.split(","));
  }
}

function mergeRuntimeStateMaps(...maps) {
  return Object.assign({}, ...maps);
}

function isProblemRuntimeState(status) {
  return status === "fail" || status === "cancelled" || status === "skipped";
}

function describeProblemState(status) {
  if (status === "cancelled") {
    return "was cancelled";
  }
  if (status === "skipped") {
    return "was skipped";
  }
  return "is currently failing";
}

function isAggregateOnlySignal(signalId) {
  const metadata = SIGNAL_METADATA[signalId] || { checkOutcomes: [], jobStatuses: [] };
  return metadata.checkOutcomes.length === 0 && metadata.jobStatuses.length > 0;
}

function shouldSuppressAggregateHint(entry, matchedSignals) {
  if (!isAggregateOnlySignal(entry.id)) {
    return false;
  }

  const aggregateJobNames = new Set(
    entry.observedJobs.filter((job) => isProblemRuntimeState(job.status)).map((job) => job.jobName)
  );
  if (aggregateJobNames.size === 0) {
    return false;
  }

  return matchedSignals.some((otherEntry) => {
    if (otherEntry.id === entry.id || isAggregateOnlySignal(otherEntry.id) || !isProblemRuntimeState(otherEntry.status)) {
      return false;
    }

    const metadata = SIGNAL_METADATA[otherEntry.id] || { aggregateJobs: [] };
    return Array.isArray(metadata.aggregateJobs) && metadata.aggregateJobs.some((jobName) => aggregateJobNames.has(jobName));
  });
}

function evaluateRuntimeSignals(result, options) {
  const runtime = {
    jobStatuses: mergeRuntimeStateMaps(
      parseRuntimeStateMap(process.env.AGENT_ADVISORY_CI_JOB_STATUSES),
      parseNameValuePairs(options.ciJobStatuses)
    ),
    checkOutcomes: mergeRuntimeStateMaps(
      parseRuntimeStateMap(process.env.AGENT_ADVISORY_CI_CHECK_OUTCOMES),
      parseNameValuePairs(options.ciCheckOutcomes)
    ),
  };
  const hasExplicitRuntimeSignals =
    Object.keys(runtime.jobStatuses).length > 0 || Object.keys(runtime.checkOutcomes).length > 0;
  const observedJobNames = new Set(Object.keys(runtime.jobStatuses));
  const observedCheckCommands = new Set(Object.keys(runtime.checkOutcomes));

  const matchedSignals = stableUnique(result.merged.ciSignals || []).map((signalId) => {
    const metadata = SIGNAL_METADATA[signalId] || {
      label: signalId,
      checkOutcomes: [],
      jobStatuses: [],
      aggregateJobs: [],
    };
    const observedChecks = metadata.checkOutcomes.map((command) => ({
      command,
      status: runtime.checkOutcomes[command] || "not-observed",
    }));
    const observedJobs = metadata.jobStatuses.map((jobName) => ({
      jobName,
      status: runtime.jobStatuses[jobName] || "not-observed",
    }));
    const observedStatuses = stableUnique(
      [...observedChecks.map((entry) => entry.status), ...observedJobs.map((entry) => entry.status)].filter(Boolean)
    );
    const hasRelevantRuntimeContext =
      metadata.checkOutcomes.some((command) => observedCheckCommands.has(command)) ||
      metadata.jobStatuses.some((jobName) => observedJobNames.has(jobName));

    let status = "not-observed";
    if (observedStatuses.includes("fail")) {
      status = "fail";
    } else if (observedStatuses.includes("cancelled")) {
      status = "cancelled";
    } else if (observedStatuses.includes("skipped")) {
      status = "skipped";
    } else if (observedStatuses.includes("pass") && observedStatuses.every((entry) => entry === "pass")) {
      status = "pass";
    } else if (observedStatuses.includes("pass")) {
      status = "pass";
    }

    return {
      id: signalId,
      label: metadata.label,
      status,
      observedChecks,
      observedJobs,
      hasRelevantRuntimeContext,
    };
  });

  const actionableHints = [];

  matchedSignals
    .filter((entry) => isProblemRuntimeState(entry.status))
    .filter((entry) => !shouldSuppressAggregateHint(entry, matchedSignals))
    .forEach((entry) => {
      const failingChecks = entry.observedChecks
        .filter((check) => isProblemRuntimeState(check.status))
        .map((check) => check.command);
      const failingJobs = entry.observedJobs
        .filter((job) => isProblemRuntimeState(job.status))
        .map((job) => job.jobName);
      const failingTargets = [...failingChecks, ...failingJobs];
      actionableHints.push(
        `${entry.label} ${describeProblemState(entry.status)}${failingTargets.length > 0 ? ` (${failingTargets.join(", ")})` : ""}.`
      );
    });

  matchedSignals
    .filter(
      (entry) =>
        hasExplicitRuntimeSignals &&
        entry.status === "not-observed" &&
        entry.hasRelevantRuntimeContext &&
        (entry.observedChecks.length > 0 || entry.observedJobs.length > 0)
    )
    .forEach((entry) => {
      actionableHints.push(`${entry.label} has no observed runtime outcome in this advisory run yet.`);
    });

  return {
    hasExplicitRuntimeSignals,
    jobStatuses: runtime.jobStatuses,
    checkOutcomes: runtime.checkOutcomes,
    matchedSignals,
    actionableHints: stableUnique(actionableHints),
  };
}

function buildPolicyGateStatus(runtimeSignals) {
  const warnings = stableUnique(runtimeSignals.actionableHints || []);

  return {
    stages: [
      {
        id: "stage-1-advisory",
        label: "Advisory only",
        blocking: false,
        status: "active",
        summary: "Changed-file matching and workflow hints stay advisory and do not reroute canonical workflows.",
      },
      {
        id: "stage-2-warning",
        label: "Warning mode",
        blocking: false,
        status: warnings.length > 0 ? "active-with-warnings" : "active-no-warnings",
        summary: "Explicit risky runtime states surface as non-blocking warnings based on deterministic CI signals.",
        warnings,
      },
      {
        id: "stage-3-hard-fail",
        label: "Selective hard fail",
        blocking: true,
        status: "selective-enforcement",
        summary: "Only narrow, high-confidence policy gates should block.",
        candidateGates: HARD_GATE_CANDIDATES,
      },
    ],
  };
}

function parseArgs(argv) {
  const options = {
    json: false,
    staged: false,
    unmatched: false,
    files: null,
    rulesPath: null,
    ciJobStatuses: [],
    ciCheckOutcomes: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--staged") {
      options.staged = true;
      continue;
    }
    if (arg === "--unmatched") {
      options.unmatched = true;
      continue;
    }
    if (arg === "--files") {
      const value = readOptionValue(argv, index) || "";
      index += 1;
      options.files = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === "--rules") {
      options.rulesPath = readOptionValue(argv, index) || null;
      index += 1;
      continue;
    }
    if (arg === "--ci-job-status") {
      const value = readOptionValue(argv, index);
      if (value) {
        options.ciJobStatuses.push(value);
        index += 1;
      }
      continue;
    }
    if (arg === "--ci-check-outcome") {
      const value = readOptionValue(argv, index);
      if (value) {
        options.ciCheckOutcomes.push(value);
        index += 1;
      }
      continue;
    }
  }

  return options;
}

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getChangedFiles(options) {
  if (Array.isArray(options.files)) {
    return options.files;
  }

  if (options.staged) {
    return runGit(["diff", "--name-only", "--cached"]);
  }

  const staged = runGit(["diff", "--name-only", "--cached"]);
  const unstaged = runGit(["diff", "--name-only"]);
  const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);
  return Array.from(new Set([...staged, ...unstaged, ...untracked]));
}

function formatHumanReadable(result) {
  const lines = [];
  lines.push("Advisory summary");
  lines.push("===============");
  lines.push(`Changed files: ${result.changedFiles.length}`);

  if (result.changedFiles.length === 0) {
    lines.push("No local file changes detected.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Areas");
  if (result.merged.areas.length === 0) {
    lines.push("- none");
  } else {
    result.merged.areas.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Recommended checks");
  if (result.merged.recommendedChecks.length === 0) {
    lines.push("- none");
  } else {
    result.merged.recommendedChecks.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Manual checks");
  if (result.merged.manualChecks.length === 0) {
    lines.push("- none");
  } else {
    result.merged.manualChecks.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Matched rule ids");
  if (result.matchedRules.length === 0) {
    lines.push("- none");
  } else {
    result.matchedRules.forEach((rule) => lines.push(`- ${rule.id}`));
  }

  lines.push("");
  lines.push("CI runtime signals");
  if (
    Object.keys(result.runtimeSignals.jobStatuses || {}).length === 0 &&
    Object.keys(result.runtimeSignals.checkOutcomes || {}).length === 0 &&
    (result.runtimeSignals.matchedSignals || []).length === 0
  ) {
    lines.push("- none observed");
  } else {
    const jobStatuses = Object.entries(result.runtimeSignals.jobStatuses || {});
    if (jobStatuses.length === 0) {
      lines.push("- jobs: none observed");
    } else {
      jobStatuses.forEach(([jobName, status]) => lines.push(`- job ${jobName}: ${status}`));
    }

    const checkOutcomes = Object.entries(result.runtimeSignals.checkOutcomes || {});
    if (checkOutcomes.length === 0) {
      lines.push("- checks: none observed");
    } else {
      checkOutcomes.forEach(([command, status]) => lines.push(`- check ${command}: ${status}`));
    }

    const matchedSignals = result.runtimeSignals.matchedSignals || [];
    if (matchedSignals.length === 0) {
      lines.push("- matched CI signals: none");
    } else {
      matchedSignals.forEach((entry) => {
        lines.push(`- signal ${entry.id} (${entry.label}): ${entry.status}`);
      });
    }
  }

  lines.push("");
  lines.push("Advisory CI hints");
  if ((result.runtimeSignals.actionableHints || []).length === 0) {
    lines.push("- none");
  } else {
    result.runtimeSignals.actionableHints.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Progressive policy gates");
  ((result.policyGates && result.policyGates.stages) || []).forEach((stage) => {
    lines.push(`- ${stage.id} (${stage.label}): ${stage.status}${stage.blocking ? ", blocking" : ", non-blocking"}`);
    lines.push(`  summary: ${stage.summary}`);
    if (Array.isArray(stage.warnings) && stage.warnings.length > 0) {
      stage.warnings.forEach((entry) => lines.push(`  warning: ${entry}`));
    }
    if (Array.isArray(stage.candidateGates) && stage.candidateGates.length > 0) {
      stage.candidateGates.forEach((gate) => {
        lines.push(
          `  gate ${gate.id}: ${gate.status}, ${gate.blocking ? "blocking" : "non-blocking"}, confidence=${gate.confidence}`
        );
      });
    }
  });

  lines.push("");
  lines.push("Per-file mapping");
  result.perFile.forEach((entry) => {
    const fallbackMark = entry.usedFallback ? " (fallback)" : "";
    lines.push(`- ${entry.filePath}: ${entry.ruleIds.join(", ")}${fallbackMark}`);
  });

  return lines.join("\n");
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const { absolutePath, document } = loadAdvisoryDocument(options.rulesPath || undefined);
  const validation = validateAdvisoryDocument(document);

  if (!validation.valid) {
    console.error(`Invalid advisory rules in ${absolutePath}`);
    validation.errors.forEach((entry) => console.error(`- ${entry}`));
    return 1;
  }

  const changedFiles = getChangedFiles(options);
  const result = resolveAdvisoryForFiles(changedFiles, document);
  result.rulesPath = absolutePath;
  result.runtimeSignals = evaluateRuntimeSignals(result, options);
  result.policyGates = buildPolicyGateStatus(result.runtimeSignals);

  if (options.unmatched) {
    const unmatchedFiles = result.perFile.filter((entry) => entry.usedFallback).map((entry) => entry.filePath);
    const payload = {
      unmatchedFiles,
      unmatchedCount: unmatchedFiles.length,
      changedCount: result.changedFiles.length,
      rulesPath: absolutePath,
    };

    if (options.json) {
      console.log(JSON.stringify(payload, null, 2));
      return 0;
    }

    console.log("Unmatched advisory files");
    console.log("========================");
    if (unmatchedFiles.length === 0) {
      console.log("None.");
      return 0;
    }
    unmatchedFiles.forEach((entry) => console.log(`- ${entry}`));
    return 0;
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  console.log(formatHumanReadable(result));
  return 0;
}

module.exports = {
  SIGNAL_METADATA,
  isAggregateOnlySignal,
  shouldSuppressAggregateHint,
  isProblemRuntimeState,
  describeProblemState,
  parseArgs,
  parseRuntimeStateMap,
  parseNameValuePairs,
  evaluateRuntimeSignals,
  buildPolicyGateStatus,
  runGit,
  getChangedFiles,
  formatHumanReadable,
  main,
};

if (require.main === module) {
  const exitCode = main();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
