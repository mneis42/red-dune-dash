const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const {
  loadAdvisoryDocument,
  validateAdvisoryDocument,
  resolveAdvisoryForFiles,
} = require("./advisory-rules.js");

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

function parseScope(raw) {
  return stableUnique(
    String(raw || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
  );
}

function parseArgs(argv) {
  const options = {
    json: false,
    rulesPath: null,
    staged: false,
    unstaged: false,
    scope: null,
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
    if (arg === "--unstaged") {
      options.unstaged = true;
      continue;
    }
    if (arg === "--scope") {
      options.scope = parseScope(argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg === "--rules") {
      options.rulesPath = argv[index + 1] || null;
      index += 1;
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

function getCurrentBranch() {
  const output = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  return output || "HEAD";
}

function collectChangedFiles(options) {
  const staged = runGit(["diff", "--name-only", "--cached"]);
  const unstaged = runGit(["diff", "--name-only"]);
  const untracked = runGit(["ls-files", "--others", "--exclude-standard"]);

  let combined = [];

  if (options.staged && !options.unstaged) {
    combined = staged;
  } else if (options.unstaged && !options.staged) {
    combined = [...unstaged, ...untracked];
  } else {
    combined = [...staged, ...unstaged, ...untracked];
  }

  return {
    staged,
    unstaged,
    untracked,
    changedFiles: stableUnique(combined).sort(),
  };
}

function detectGuardrailStatus() {
  const hookPath = path.join(process.cwd(), ".git", "hooks", "pre-commit");
  return {
    signal: "git-hooks-pre-commit-exists",
    active: fs.existsSync(hookPath),
    path: hookPath,
    note: "Current-state signal only. No setup history inference is used.",
  };
}

function resolveTaskAreas(options, advisoryResult) {
  if (Array.isArray(options.scope) && options.scope.length > 0) {
    return {
      areas: options.scope,
      source: "cli-scope",
    };
  }

  const inferred = advisoryResult.merged.areas.filter((area) => area !== "unclassified");
  return {
    areas: inferred,
    source: "matched-areas",
  };
}

function buildRuleAreaMap(result) {
  const areaByRuleId = new Map();
  for (const rule of result.matchedRules) {
    areaByRuleId.set(rule.id, rule.area);
  }
  return areaByRuleId;
}

function hasIntersection(left, rightSet) {
  for (const value of left) {
    if (rightSet.has(value)) {
      return true;
    }
  }
  return false;
}

function classifyRelatedChanges(advisoryResult, taskAreas) {
  const taskAreaSet = new Set(taskAreas);
  const areaByRuleId = buildRuleAreaMap(advisoryResult);

  const relatedFiles = [];
  const unrelatedFiles = [];

  for (const entry of advisoryResult.perFile) {
    const fileAreas = stableUnique(entry.ruleIds.map((ruleId) => areaByRuleId.get(ruleId)).filter(Boolean));

    if (taskAreaSet.size === 0) {
      relatedFiles.push({ filePath: entry.filePath, areas: fileAreas, ruleIds: entry.ruleIds });
      continue;
    }

    if (hasIntersection(fileAreas, taskAreaSet)) {
      relatedFiles.push({ filePath: entry.filePath, areas: fileAreas, ruleIds: entry.ruleIds });
      continue;
    }

    unrelatedFiles.push({ filePath: entry.filePath, areas: fileAreas, ruleIds: entry.ruleIds });
  }

  return {
    heuristic:
      "A file is unrelated when none of its matched areas intersects with task areas (task areas come from --scope or inferred matched areas).",
    taskAreas,
    relatedFiles,
    unrelatedFiles,
  };
}

function validateScope(scopeAreas, document) {
  if (!Array.isArray(scopeAreas) || scopeAreas.length === 0) {
    return { valid: true, invalidAreas: [] };
  }

  const knownAreas = new Set(document.rules.map((rule) => rule.area));
  if (document.unknownFileFallback && document.unknownFileFallback.area) {
    knownAreas.add(document.unknownFileFallback.area);
  }

  const invalidAreas = scopeAreas.filter((area) => !knownAreas.has(area));
  return {
    valid: invalidAreas.length === 0,
    invalidAreas,
    knownAreas: [...knownAreas].sort(),
  };
}

function buildPreflightResult(options, document, changedState, advisoryResult) {
  const branch = getCurrentBranch();
  const branchState = {
    current: branch,
    onMain: branch === "main",
  };

  const taskAreaResolution = resolveTaskAreas(options, advisoryResult);
  const relatedClassification = classifyRelatedChanges(advisoryResult, taskAreaResolution.areas);

  return {
    branchState,
    changeState: {
      stagedCount: changedState.staged.length,
      unstagedCount: changedState.unstaged.length,
      untrackedCount: changedState.untracked.length,
      changedCount: changedState.changedFiles.length,
      changedFiles: changedState.changedFiles,
    },
    advisory: {
      matchedRuleIds: advisoryResult.matchedRules.map((rule) => rule.id),
      matchedAreas: advisoryResult.merged.areas,
      riskTags: advisoryResult.merged.riskTags,
      recommendedChecks: advisoryResult.merged.recommendedChecks,
      suggestedDocs: advisoryResult.merged.suggestedDocs,
      suggestedReading: advisoryResult.merged.suggestedReading,
      fallbackFiles: advisoryResult.perFile.filter((entry) => entry.usedFallback).map((entry) => entry.filePath),
    },
    taskScope: taskAreaResolution,
    unrelatedChanges: relatedClassification,
    guardrail: detectGuardrailStatus(),
    governance: advisoryResult.governance,
    policy: {
      advisoryOnly: true,
      exitCodePolicy: "non-blocking for advisory warnings",
    },
  };
}

function formatHumanReadable(result) {
  const lines = [];
  lines.push("Agent preflight");
  lines.push("==============");
  lines.push(`Branch: ${result.branchState.current}${result.branchState.onMain ? " (main)" : ""}`);

  if (result.branchState.onMain) {
    lines.push("Warning: You are on main.");
  }

  lines.push(
    `Changed files: ${result.changeState.changedCount} (staged ${result.changeState.stagedCount}, unstaged ${result.changeState.unstagedCount}, untracked ${result.changeState.untrackedCount})`
  );

  if (result.changeState.changedFiles.length > 0) {
    lines.push("");
    lines.push("Changed file list");
    result.changeState.changedFiles.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push(`Task area source: ${result.taskScope.source}`);
  lines.push(`Task areas: ${result.taskScope.areas.length > 0 ? result.taskScope.areas.join(", ") : "none"}`);

  lines.push("");
  lines.push("Matched rules");
  if (result.advisory.matchedRuleIds.length === 0) {
    lines.push("- none");
  } else {
    result.advisory.matchedRuleIds.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Recommended checks");
  if (result.advisory.recommendedChecks.length === 0) {
    lines.push("- none");
  } else {
    result.advisory.recommendedChecks.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Likely docs / instructions");
  const docsAndReading = stableUnique([...result.advisory.suggestedDocs, ...result.advisory.suggestedReading]);
  if (docsAndReading.length === 0) {
    lines.push("- none");
  } else {
    docsAndReading.forEach((entry) => lines.push(`- ${entry}`));
  }

  lines.push("");
  lines.push("Unrelated local changes");
  lines.push(`Heuristic: ${result.unrelatedChanges.heuristic}`);
  if (result.unrelatedChanges.unrelatedFiles.length === 0) {
    lines.push("- none");
  } else {
    result.unrelatedChanges.unrelatedFiles.forEach((entry) => {
      const areas = entry.areas.length > 0 ? entry.areas.join(", ") : "none";
      lines.push(`- ${entry.filePath} (areas: ${areas})`);
    });
  }

  lines.push("");
  lines.push("Guardrail status");
  lines.push(`Signal: ${result.guardrail.signal}`);
  lines.push(`Active: ${result.guardrail.active ? "yes" : "no"}`);
  lines.push(`Path: ${result.guardrail.path}`);
  lines.push(`Note: ${result.guardrail.note}`);

  if (result.advisory.fallbackFiles.length > 0) {
    lines.push("");
    lines.push("Files using fallback advisory");
    result.advisory.fallbackFiles.forEach((entry) => lines.push(`- ${entry}`));
  }

  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { absolutePath, document } = loadAdvisoryDocument(options.rulesPath || undefined);
  const validation = validateAdvisoryDocument(document);

  if (!validation.valid) {
    console.error(`Invalid advisory rules in ${absolutePath}`);
    validation.errors.forEach((entry) => console.error(`- ${entry}`));
    process.exit(1);
  }

  const scopeValidation = validateScope(options.scope, document);
  if (!scopeValidation.valid) {
    console.error("Invalid --scope value.");
    console.error(`Unknown areas: ${scopeValidation.invalidAreas.join(", ")}`);
    console.error(`Known areas: ${scopeValidation.knownAreas.join(", ")}`);
    process.exit(1);
  }

  const changedState = collectChangedFiles(options);
  const advisoryResult = resolveAdvisoryForFiles(changedState.changedFiles, document);
  const result = buildPreflightResult(options, document, changedState, advisoryResult);
  result.rulesPath = absolutePath;

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatHumanReadable(result));
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  parseScope,
  resolveTaskAreas,
  classifyRelatedChanges,
  validateScope,
  buildPreflightResult,
  formatHumanReadable,
};
