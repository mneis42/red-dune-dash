const { execFileSync, spawnSync } = require("node:child_process");
const {
  loadAdvisoryDocument,
  validateAdvisoryDocument,
  resolveAdvisoryForFiles,
} = require("./advisory-rules.js");

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
    errors: [],
  };

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

  const failedChecks = checkOutcomes.filter((entry) => entry.status === "fail");
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

function buildCopyBlock(result) {
  const lines = [];
  lines.push("Summary");
  lines.push(`- changed_files: ${result.changedFiles.length}`);
  lines.push(`- matched_areas: ${result.advisory.mergedAreas.join(", ") || "none"}`);
  lines.push(`- docs_to_review: ${result.affectedDocs.join(", ") || "none"}`);

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
    openQuestions: buildOpenQuestions(advisoryResult, checkOutcomes),
  };

  result.copyBlock = buildCopyBlock(result);
  return result;
}

function formatHumanReadable(result, options) {
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
  buildCheckOutcomes,
  buildOpenQuestions,
  buildCopyBlock,
  buildSummaryResult,
  formatHumanReadable,
};
