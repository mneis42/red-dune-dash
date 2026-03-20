const { execFileSync, spawnSync } = require("node:child_process");
const {
  loadAdvisoryDocument,
  validateAdvisoryDocument,
  resolveAdvisoryForFiles,
} = require("./advisory-rules.js");
const { recommendReviewDepth } = require("./agent-preflight.js");

const AREA_USER_IMPACT = {
  gameplay: "Gameplay behavior may change for players (difficulty, pacing, rewards, or obstacle interactions).",
  pwa: "Offline behavior, installability, or cache/update paths may change for players.",
  "workflow-docs": "Developer-facing workflow and process guidance may change for contributors.",
  "ui-shell": "Visible UI layout or shell behavior may change across desktop/mobile screens.",
  tooling: "Tooling behavior may change for local developer workflows.",
  unclassified: "Change surface is not fully classified; user-visible impact should be confirmed manually.",
};

const CHECK_LOG_TAIL_LIMIT = 4000;
const CHECK_COMMAND_TIMEOUT_MS = 120000;

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

function parseArgs(argv) {
  const options = {
    json: false,
    staged: false,
    files: null,
    rulesPath: null,
    runChecks: false,
    includeLogs: false,
    contractConsumers: null,
    contractInseparable: false,
    errors: [],
  };

  function readNumberOptionValue(optionName, index) {
    const candidate = readOptionValue(optionName, index);
    if (candidate === null) {
      return null;
    }

    const parsed = Number.parseInt(candidate, 10);
    if (!Number.isInteger(parsed) || parsed < 0) {
      options.errors.push(`Invalid numeric value for ${optionName}: ${candidate}. Expected integer >= 0.`);
      return null;
    }

    return parsed;
  }

  function readOptionValue(optionName, index) {
    const candidate = argv[index + 1];
    if (!candidate || String(candidate).startsWith("--")) {
      options.errors.push(`Missing value for ${optionName}.`);
      return null;
    }
    return String(candidate);
  }

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
    if (arg === "--run-checks") {
      options.runChecks = true;
      continue;
    }
    if (arg === "--include-logs") {
      options.includeLogs = true;
      continue;
    }
    if (arg === "--contract-consumers") {
      const value = readNumberOptionValue("--contract-consumers", index);
      if (value === null) {
        continue;
      }
      index += 1;
      options.contractConsumers = value;
      continue;
    }
    if (arg === "--contract-inseparable") {
      options.contractInseparable = true;
      continue;
    }
    if (arg === "--files") {
      const value = readOptionValue("--files", index);
      if (value === null) {
        continue;
      }
      index += 1;
      options.files = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === "--rules") {
      const value = readOptionValue("--rules", index);
      if (value === null) {
        continue;
      }
      index += 1;
      options.rulesPath = value;
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
    return stableUnique(options.files);
  }

  if (options.staged) {
    return stableUnique(runGit(["diff", "--name-only", "--cached"]));
  }

  const staged = runGit(["diff", "--name-only", "--cached"]);
  const unstaged = runGit(["diff", "--name-only"]);
  const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);

  return stableUnique([...staged, ...unstaged, ...untracked]);
}

function resolveUserImpact(advisoryResult) {
  const impacts = advisoryResult.merged.areas.map((area) => AREA_USER_IMPACT[area] || AREA_USER_IMPACT.unclassified);
  return stableUnique(impacts);
}

function parseAllowedCheckCommand(command) {
  const value = String(command || "").trim();
  if (!value) {
    return null;
  }

  if (value === "npm test") {
    return { executable: "npm", args: ["test"] };
  }

  const match = value.match(/^npm\s+run\s+([A-Za-z0-9:_-]+)$/);
  if (!match) {
    return null;
  }

  return {
    executable: "npm",
    args: ["run", match[1]],
  };
}

function getLogTail(output) {
  const text = String(output || "");
  if (text.length <= CHECK_LOG_TAIL_LIMIT) {
    return text;
  }

  return text.slice(text.length - CHECK_LOG_TAIL_LIMIT);
}

function maybeAttachLogs(payload, result, options) {
  const stdout = getLogTail(result.stdout);
  const stderr = getLogTail(result.stderr);
  const failed = payload.status === "fail";

  if (!options.includeLogs && !failed) {
    return payload;
  }

  return {
    ...payload,
    stdout,
    stderr,
    logsTruncated: String(result.stdout || "").length > CHECK_LOG_TAIL_LIMIT || String(result.stderr || "").length > CHECK_LOG_TAIL_LIMIT,
  };
}

function buildCheckOutcomes(advisoryResult, options) {
  const checks = advisoryResult.merged.recommendedChecks;
  if (checks.length === 0) {
    return [];
  }

  if (!options.runChecks) {
    return checks.map((command) => ({
      command,
      status: "not-run",
      durationMs: 0,
      exitCode: null,
    }));
  }

  return checks.map((command) => {
    const parsedCommand = parseAllowedCheckCommand(command);
    if (!parsedCommand) {
      return {
        command,
        status: "skipped-unsafe",
        durationMs: 0,
        exitCode: null,
        reason: "Unsupported command format for safe execution.",
      };
    }

    const startedAt = Date.now();
    const result = spawnSync(parsedCommand.executable, parsedCommand.args, {
      shell: false,
      encoding: "utf8",
      stdio: "pipe",
      timeout: CHECK_COMMAND_TIMEOUT_MS,
    });

    if (result.error) {
      const payload = {
        command,
        status: "error",
        durationMs: Date.now() - startedAt,
        exitCode: Number.isInteger(result.status) ? result.status : null,
        signal: result.signal || null,
        reason: result.error.message,
      };
      return maybeAttachLogs(payload, result, options);
    }

    if (result.signal) {
      const payload = {
        command,
        status: "failed-signal",
        durationMs: Date.now() - startedAt,
        exitCode: Number.isInteger(result.status) ? result.status : null,
        signal: result.signal,
        reason: `Process ended by signal ${result.signal}.`,
      };
      return maybeAttachLogs(payload, result, options);
    }

    const payload = {
      command,
      status: result.status === 0 ? "pass" : "fail",
      durationMs: Date.now() - startedAt,
      exitCode: Number.isInteger(result.status) ? result.status : 1,
    };

    return maybeAttachLogs(payload, result, options);
  });
}

function isFailingCheckStatus(status) {
  return status === "fail" || status === "error" || status === "failed-signal";
}

function buildOpenQuestions(advisoryResult, checkOutcomes) {
  const questions = [];
  const fallbackFiles = advisoryResult.perFile.filter((entry) => entry.usedFallback).map((entry) => entry.filePath);

  if (fallbackFiles.length > 0) {
    questions.push(
      `Should we add explicit advisory rules for currently unclassified files: ${fallbackFiles.join(", ")}?`
    );
  }

  const notRunChecks = checkOutcomes.filter((entry) => entry.status === "not-run");
  if (notRunChecks.length > 0) {
    questions.push(
      `Should we run recommended checks before using this summary for postflight contexts: ${notRunChecks
        .map((entry) => entry.command)
        .join(", ")}?`
    );
  }

  const failedChecks = checkOutcomes.filter((entry) => isFailingCheckStatus(entry.status));
  if (failedChecks.length > 0) {
    questions.push(
      `How should failed checks be handled before merge: ${failedChecks.map((entry) => entry.command).join(", ")}?`
    );
  }

  const skippedChecks = checkOutcomes.filter((entry) => entry.status === "skipped-unsafe");
  if (skippedChecks.length > 0) {
    questions.push(
      `Should unsupported recommended commands be normalized for safe execution: ${skippedChecks
        .map((entry) => entry.command)
        .join(", ")}?`
    );
  }

  if (questions.length === 0) {
    questions.push("No open questions from deterministic signals.");
  }

  return questions;
}

function normalizeMatchedAreas(advisoryResult) {
  return stableUnique((advisoryResult.merged.areas || []).filter((area) => area && area !== "unclassified"));
}

function evaluateSplitDecision(changedFiles, advisoryResult, options) {
  const touchedFileCount = changedFiles.length;
  const matchedAreas = normalizeMatchedAreas(advisoryResult);
  const areaSet = new Set(matchedAreas);
  const implementationAreas = ["gameplay", "pwa", "ui-shell", "tooling"];
  const hasWorkflowDocs = areaSet.has("workflow-docs");
  const hasImplementationArea = implementationAreas.some((area) => areaSet.has(area));

  const crossScopeMixedWorkflowAndImplementation = hasWorkflowDocs && hasImplementationArea;
  const reviewDepth = recommendReviewDepth(advisoryResult);
  const deepReviewWithSixPlusFiles = reviewDepth.tier === "deep" && touchedFileCount >= 6;

  const consumers = Number.isInteger(options.contractConsumers) ? options.contractConsumers : null;
  const broadContractAffectsThreePlusConsumers = consumers !== null ? consumers >= 3 : null;

  const hardTriggerReasons = [];
  const advisorySplitSignals = [];
  if (crossScopeMixedWorkflowAndImplementation) {
    hardTriggerReasons.push("cross-scope mix: workflow-docs + implementation area");
  }
  if (deepReviewWithSixPlusFiles) {
    advisorySplitSignals.push("deep review recommendation with 6+ touched files");
  }
  if (broadContractAffectsThreePlusConsumers === true && !options.contractInseparable) {
    advisorySplitSignals.push("broad contract change affects 3+ consumer files");
  }

  let thresholdDecision = "no-split-default";
  if (touchedFileCount >= 10) {
    thresholdDecision = "split-required";
  } else if (touchedFileCount >= 6) {
    thresholdDecision = "no-split-with-justification";
  }

  const splitRequiredByHardTrigger = hardTriggerReasons.length > 0;
  const splitRequiredByThreshold = thresholdDecision === "split-required";
  const finalDecision = splitRequiredByHardTrigger ? "split-required" : thresholdDecision;

  const exceptionPath =
    "If split-required cannot be followed, add a short explicit exception in handoff with rationale and residual risk.";

  return {
    touchedFileCount,
    matchedAreas,
    thresholdBand:
      touchedFileCount >= 10 ? "10+" : touchedFileCount >= 6 ? "6-9" : touchedFileCount >= 1 ? "1-5" : "0",
    thresholdDecision,
    finalDecision,
    splitRequiredByHardTrigger,
    splitRequiredByThreshold,
    hardTriggerReasons,
    advisorySplitSignals,
    triggerEvaluation: {
      crossScopeMixedWorkflowAndImplementation,
      deepReviewWithSixPlusFiles,
      broadContractAffectsThreePlusConsumers,
      contractConsumers: consumers,
      contractInseparable: Boolean(options.contractInseparable),
    },
    thresholds: {
      defaultNoSplit: "1-5",
      justifiedNoSplit: "6-9",
      splitRequired: "10+",
      hardTriggersOverrideThresholds: true,
    },
    exceptionPath,
  };
}

function buildPrePrChecklistOutcome(changedFiles, advisoryResult, checkOutcomes, risks, options) {
  const split = evaluateSplitDecision(changedFiles, advisoryResult, options);
  const skippedChecks = checkOutcomes.filter((entry) => entry.status === "not-run" || entry.status === "skipped-unsafe");
  const failedChecks = checkOutcomes.filter((entry) => isFailingCheckStatus(entry.status));
  const fallbackFiles = advisoryResult.perFile.filter((entry) => entry.usedFallback).map((entry) => entry.filePath);
  const changedBacklogPaths = stableUnique(changedFiles.filter((entry) => entry === "todo.md" || entry.startsWith("backlog/")));

  const likelyReviewerObjections = [];
  if (split.finalDecision === "split-required") {
    likelyReviewerObjections.push("PR may be considered too broad; split or document explicit exception.");
  }
  if (split.advisorySplitSignals.length > 0) {
    likelyReviewerObjections.push("Advisory split signals are active; consider splitting or document rationale.");
  }
  if (failedChecks.length > 0) {
    likelyReviewerObjections.push("Failing checks must be resolved before merge.");
  }
  if (skippedChecks.length > 0) {
    likelyReviewerObjections.push("Skipped or not-run checks need explicit justification in handoff.");
  }
  if (fallbackFiles.length > 0) {
    likelyReviewerObjections.push("Fallback-classified files can hide scope ambiguity.");
  }

  const remainingRisks = stableUnique([
    ...risks,
    ...(failedChecks.length > 0 ? ["failed-checks"] : []),
    ...(skippedChecks.length > 0 ? ["verification-gaps"] : []),
    ...(fallbackFiles.length > 0 ? ["unknown-change-surface"] : []),
  ]);

  return {
    touchedFileCount: split.touchedFileCount,
    matchedAreas: split.matchedAreas,
    splitDecision: {
      thresholdBand: split.thresholdBand,
      thresholdDecision: split.thresholdDecision,
      finalDecision: split.finalDecision,
      hardTriggerReasons: split.hardTriggerReasons,
      advisorySplitSignals: split.advisorySplitSignals,
      thresholds: split.thresholds,
      exceptionPath: split.exceptionPath,
    },
    triggerEvaluation: split.triggerEvaluation,
    verification: {
      checkOutcomes,
      skippedChecks,
      skippedCheckJustificationRequired: skippedChecks.length > 0,
    },
    docsInstructionImpact: {
      affectedDocs: stableUnique([...advisoryResult.merged.suggestedDocs, ...advisoryResult.merged.suggestedReading]),
      touchedWorkflowDocs: split.matchedAreas.includes("workflow-docs"),
    },
    backlogSyncReview: {
      checkedPaths: changedBacklogPaths,
      resultSummary:
        changedBacklogPaths.length > 0
          ? `checked backlog updates in current branch: ${changedBacklogPaths.join(", ")}`
          : "none affected",
    },
    likelyReviewerObjections,
    remainingRisks,
  };
}

function buildCopyBlock(result) {
  const hardTriggerReasons = result.prePrChecklist.splitDecision.hardTriggerReasons || [];
  const advisorySplitSignals = result.prePrChecklist.splitDecision.advisorySplitSignals || [];
  const lines = [];
  lines.push("Summary");
  lines.push(`- changed_files: ${result.changedFiles.length}`);
  lines.push(`- matched_areas: ${result.advisory.mergedAreas.join(", ") || "none"}`);
  lines.push(`- pre_pr_split_decision: ${result.prePrChecklist.splitDecision.finalDecision}`);
  if (hardTriggerReasons.length > 0) {
    lines.push(`- pre_pr_split_reasons: ${hardTriggerReasons.join("; ")}`);
  }
  if (advisorySplitSignals.length > 0) {
    lines.push(`- pre_pr_split_advisory_signals: ${advisorySplitSignals.join("; ")}`);
  }
  lines.push(`- docs_to_review: ${result.affectedDocs.join(", ") || "none"}`);
  lines.push(`- backlog_sync_review: ${result.prePrChecklist.backlogSyncReview.resultSummary}`);

  const checkSummary = result.checkOutcomes
    .map((entry) => `${entry.command}=${entry.status}`)
    .join(", ");
  lines.push(`- checks: ${checkSummary || "none"}`);

  const riskSummary = result.risks.join("; ");
  lines.push(`- risks: ${riskSummary || "none"}`);

  return lines.join("\n");
}

function buildSummaryResult(changedFiles, advisoryResult, options) {
  const checkOutcomes = buildCheckOutcomes(advisoryResult, options);
  const risks = stableUnique(advisoryResult.merged.riskTags);
  const normalizedChangedFiles = Array.isArray(advisoryResult.changedFiles)
    ? advisoryResult.changedFiles
    : changedFiles;
  const prePrChecklist = buildPrePrChecklistOutcome(
    normalizedChangedFiles,
    advisoryResult,
    checkOutcomes,
    risks,
    options
  );

  const result = {
    changedFiles: normalizedChangedFiles,
    advisory: {
      matchedRuleIds: advisoryResult.matchedRules.map((rule) => rule.id),
      mergedAreas: advisoryResult.merged.areas,
      riskTags: advisoryResult.merged.riskTags,
      recommendedChecks: advisoryResult.merged.recommendedChecks,
      manualChecks: advisoryResult.merged.manualChecks,
      suggestedDocs: advisoryResult.merged.suggestedDocs,
      suggestedReading: advisoryResult.merged.suggestedReading,
      fallbackFiles: advisoryResult.perFile.filter((entry) => entry.usedFallback).map((entry) => entry.filePath),
    },
    checkOutcomes,
    affectedDocs: stableUnique([...advisoryResult.merged.suggestedDocs, ...advisoryResult.merged.suggestedReading]),
    userVisibleImpact: resolveUserImpact(advisoryResult),
    risks,
    prePrChecklist,
    openQuestions: buildOpenQuestions(advisoryResult, checkOutcomes),
  };

  result.copyBlock = buildCopyBlock(result);
  return result;
}

function formatHumanReadable(result, options) {
  const hardTriggerReasons = result.prePrChecklist.splitDecision.hardTriggerReasons || [];
  const advisorySplitSignals = result.prePrChecklist.splitDecision.advisorySplitSignals || [];
  const lines = [];
  lines.push("Agent summary");
  lines.push("=============");
  lines.push(`Changed files: ${result.changedFiles.length}`);

  if (result.changedFiles.length === 0) {
    lines.push("No local file changes detected.");
  } else {
    lines.push("");
    lines.push("Changed file list");
    result.changedFiles.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Checks and outcomes");
  if (result.checkOutcomes.length === 0) {
    lines.push("- none");
  } else {
    result.checkOutcomes.forEach((entry) => {
      const detail =
        entry.status === "not-run"
          ? "not run"
          : `${entry.status} (exit ${entry.exitCode ?? "n/a"}, ${entry.durationMs}ms${entry.signal ? `, signal ${entry.signal}` : ""}${
              entry.reason ? `, reason: ${entry.reason}` : ""
            })`;
      lines.push(`- ${entry.command}: ${detail}`);
    });
  }
  lines.push(`Mode: ${options.runChecks ? "postflight-like (checks executed)" : "local-change (checks not executed)"}`);

  lines.push("");
  lines.push("Pre-PR checklist outcome");
  lines.push(`- touched files: ${result.prePrChecklist.touchedFileCount}`);
  lines.push(`- matched areas: ${result.prePrChecklist.matchedAreas.join(", ") || "none"}`);
  lines.push(`- split decision: ${result.prePrChecklist.splitDecision.finalDecision}`);
  if (hardTriggerReasons.length > 0) {
    hardTriggerReasons.forEach((entry) => lines.push(`- split trigger: ${entry}`));
  }
  if (advisorySplitSignals.length > 0) {
    advisorySplitSignals.forEach((entry) => lines.push(`- split advisory: ${entry}`));
  }
  lines.push(`- skipped-check justification required: ${result.prePrChecklist.verification.skippedCheckJustificationRequired ? "yes" : "no"}`);
  lines.push(`- backlog sync review: ${result.prePrChecklist.backlogSyncReview.resultSummary}`);
  lines.push(`- likely reviewer objections: ${result.prePrChecklist.likelyReviewerObjections.join("; ") || "none"}`);
  lines.push(`- remaining risks: ${result.prePrChecklist.remainingRisks.join(", ") || "none"}`);

  lines.push("");
  lines.push("Affected docs / instructions");
  if (result.affectedDocs.length === 0) {
    lines.push("- none");
  } else {
    result.affectedDocs.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("User-visible impact");
  result.userVisibleImpact.forEach((entry) => lines.push(`- ${entry}`));

  lines.push("");
  lines.push("Risks");
  if (result.risks.length === 0) {
    lines.push("- none");
  } else {
    result.risks.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Open questions");
  result.openQuestions.forEach((entry) => lines.push(`- ${entry}`));

  lines.push("");
  lines.push("Copy-ready block (commit / PR / handoff)");
  lines.push(result.copyBlock);

  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.errors.length > 0) {
    options.errors.forEach((entry) => console.error(entry));
    process.exit(1);
  }

  const { absolutePath, document } = loadAdvisoryDocument(options.rulesPath || undefined);
  const validation = validateAdvisoryDocument(document);

  if (!validation.valid) {
    console.error(`Invalid advisory rules in ${absolutePath}`);
    validation.errors.forEach((entry) => console.error(`- ${entry}`));
    process.exit(1);
  }

  const changedFiles = getChangedFiles(options);
  const advisoryResult = resolveAdvisoryForFiles(changedFiles, document);
  const result = buildSummaryResult(changedFiles, advisoryResult, options);
  result.rulesPath = absolutePath;

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatHumanReadable(result, options));
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  parseAllowedCheckCommand,
  getChangedFiles,
  resolveUserImpact,
  normalizeMatchedAreas,
  evaluateSplitDecision,
  buildPrePrChecklistOutcome,
  buildCheckOutcomes,
  isFailingCheckStatus,
  buildOpenQuestions,
  buildCopyBlock,
  buildSummaryResult,
  formatHumanReadable,
};
