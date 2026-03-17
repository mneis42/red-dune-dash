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

function readConfiguredHooksPath(cwd) {
  try {
    const configured = execFileSync("git", ["config", "--get", "core.hooksPath"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return configured || null;
  } catch {
    return null;
  }
}

function resolveRepoRoot(cwd) {
  try {
    const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return root || cwd;
  } catch {
    return cwd;
  }
}

function detectGuardrailStatus(options = {}) {
  const cwd = options.cwd || process.cwd();
  const existsSync = options.existsSync || fs.existsSync;
  const repoRoot = typeof options.resolveRepoRoot === "function" ? options.resolveRepoRoot(cwd) : resolveRepoRoot(cwd);
  const configuredHooksPath =
    typeof options.readHooksPath === "function" ? options.readHooksPath(cwd) : readConfiguredHooksPath(cwd);

  if (configuredHooksPath) {
    const resolvedHooksPath = path.isAbsolute(configuredHooksPath)
      ? configuredHooksPath
      : path.resolve(repoRoot, configuredHooksPath);
    const hookPath = path.join(resolvedHooksPath, "pre-push");
    const active = existsSync(hookPath);

    return {
      signal: "core-hooks-path-pre-push-checked",
      active,
      path: hookPath,
      note: active
        ? "Detected via configured core.hooksPath and pre-push hook. Current-state signal only."
        : "core.hooksPath is configured but expected pre-push hook is missing. Current-state signal only.",
    };
  }

  const hookPath = path.join(cwd, ".git", "hooks", "pre-commit");
  return {
    signal: "legacy-git-hooks-pre-commit-checked",
    active: existsSync(hookPath),
    path: hookPath,
    note: "Legacy fallback when core.hooksPath is not configured. Current-state signal only.",
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

const DOCUMENTATION_DRIFT_PROFILES = [
  {
    id: "gameplay-system-doc-drift",
    triggerAreas: ["gameplay"],
    title: "Gameplay/system changes likely need gameplay docs sync",
    reason: "Gameplay logic can drift from technical and balancing documentation.",
    suggestedDocs: [
      "docs/simulation-core.md",
      "docs/event-model.md",
      "docs/pickup-model.md",
      "docs/generator-rules.md",
      "docs/placement-rules.md",
      "docs/respawn-fairness.md",
      "README.md",
    ],
  },
  {
    id: "pwa-offline-doc-drift",
    triggerAreas: ["pwa"],
    title: "PWA/service-worker changes likely need offline and PWA doc sync",
    reason: "Caching, installability, and offline behavior should stay documented for local validation.",
    suggestedDocs: ["README.md", "docs/asset-manifest.md"],
  },
  {
    id: "workflow-instruction-doc-drift",
    triggerAreas: ["workflow-docs"],
    title: "Workflow/instruction changes likely need process docs sync",
    reason: "Process updates should stay consistent across all workflow entry points.",
    suggestedDocs: ["README.md", "CONTRIBUTING.md", "AGENTS.md", "instructions/"],
  },
];

const REVIEW_DEPTH_TIERS = {
  light: {
    expectedOutcomes: [
      "single-area correctness verified",
      "recommended checks acknowledged and run",
    ],
  },
  standard: {
    expectedOutcomes: [
      "cross-area behavior reviewed",
      "targeted regression checks and docs sanity completed",
    ],
  },
  deep: {
    expectedOutcomes: [
      "high-risk impact review completed",
      "workflow/PWA implications and rollback risk assessed",
    ],
  },
};

const REVIEW_DEPTH_PRECEDENCE_RULE = "highest-risk-tier-wins";
const ROUTING_AUTHORITY = "AGENTS.md";

const REVIEW_DEPTH_HIGH_RISK_AREAS = new Set(["workflow-docs", "pwa"]);
const REVIEW_DEPTH_HIGH_RISK_TAGS = new Set([
  "offline",
  "caching",
  "installability",
  "process-drift",
  "instruction-consistency",
]);

function recommendReviewDepth(advisoryResult) {
  const matchedAreas = advisoryResult.merged.areas;
  const classifiedAreas = matchedAreas.filter((area) => area !== "unclassified");
  const hasUnclassifiedArea = matchedAreas.includes("unclassified");
  const riskTags = advisoryResult.merged.riskTags;

  const triggeringHighRiskAreas = classifiedAreas.filter((area) => REVIEW_DEPTH_HIGH_RISK_AREAS.has(area));
  const triggeringHighRiskTags = riskTags.filter((tag) => REVIEW_DEPTH_HIGH_RISK_TAGS.has(tag));

  if (triggeringHighRiskAreas.length > 0 || triggeringHighRiskTags.length > 0) {
    return {
      tier: "deep",
      rationale:
        "High-risk workflow/PWA surface detected; prefer deep review. Mixed-risk diffs always use the highest-risk tier.",
      reasons: stableUnique([
        ...triggeringHighRiskAreas.map((area) => `high-risk area: ${area}`),
        ...triggeringHighRiskTags.map((tag) => `high-risk tag: ${tag}`),
      ]),
      expectedOutcomes: REVIEW_DEPTH_TIERS.deep.expectedOutcomes,
      advisoryOnly: true,
    };
  }

  if (classifiedAreas.length > 1 || riskTags.includes("cross-system-behavior")) {
    return {
      tier: "standard",
      rationale: "Cross-cutting change surface detected; standard depth is recommended.",
      reasons: stableUnique([
        classifiedAreas.length > 1 ? `multiple matched areas: ${classifiedAreas.join(", ")}` : null,
        riskTags.includes("cross-system-behavior") ? "risk tag: cross-system-behavior" : null,
      ]).filter(Boolean),
      expectedOutcomes: REVIEW_DEPTH_TIERS.standard.expectedOutcomes,
      advisoryOnly: true,
    };
  }

  return {
    tier: "light",
    rationale: "Contained change surface detected; light review is usually sufficient.",
    reasons: stableUnique([
      classifiedAreas.length === 1 ? `single matched area: ${classifiedAreas[0]}` : "no matched area; limited local context",
      hasUnclassifiedArea ? "fallback area present: unclassified" : null,
    ]).filter(Boolean),
    expectedOutcomes: REVIEW_DEPTH_TIERS.light.expectedOutcomes,
    advisoryOnly: true,
  };
}

function buildDocumentationDriftHints(advisoryResult) {
  const matchedAreas = new Set(advisoryResult.merged.areas);
  const hints = DOCUMENTATION_DRIFT_PROFILES.filter((profile) =>
    profile.triggerAreas.some((area) => matchedAreas.has(area))
  ).map((profile) => ({
    id: profile.id,
    title: profile.title,
    reason: profile.reason,
    triggerAreas: profile.triggerAreas,
    suggestedDocs: profile.suggestedDocs,
    advisoryOnly: true,
  }));

  return {
    advisoryOnly: true,
    triggered: hints.length > 0,
    hints,
    suggestedDocs: stableUnique(hints.flatMap((hint) => hint.suggestedDocs)),
    note: "Documentation drift hints are advisory only and never block execution.",
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
  const reviewDepth = recommendReviewDepth(advisoryResult);

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
    reviewDepth,
    documentationDrift: buildDocumentationDriftHints(advisoryResult),
    unrelatedChanges: relatedClassification,
    guardrail: detectGuardrailStatus(),
    governance: advisoryResult.governance,
    policy: {
      advisoryOnly: true,
      exitCodePolicy: "non-blocking for advisory warnings",
      routingAuthority: ROUTING_AUTHORITY,
      reviewDepthPrecedenceRule: REVIEW_DEPTH_PRECEDENCE_RULE,
      routingNote: "Review depth is advisory only and cannot override canonical workflow routing.",
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
  lines.push("Review depth recommendation");
  lines.push(`Tier: ${result.reviewDepth.tier}`);
  lines.push(`Why: ${result.reviewDepth.rationale}`);
  if (result.reviewDepth.reasons.length > 0) {
    lines.push("Reasons");
    result.reviewDepth.reasons.forEach((entry) => lines.push(`- ${entry}`));
  }
  lines.push("Expected outcomes");
  result.reviewDepth.expectedOutcomes.forEach((entry) => lines.push(`- ${entry}`));
  lines.push(
    `Policy: advisory only; canonical workflow routing remains in ${result.policy.routingAuthority} (${result.policy.reviewDepthPrecedenceRule}).`
  );

  lines.push("");
  lines.push("Documentation drift hints");
  if (!result.documentationDrift || result.documentationDrift.hints.length === 0) {
    lines.push("- none");
  } else {
    result.documentationDrift.hints.forEach((hint) => {
      lines.push(`- ${hint.title}`);
      lines.push(`  Trigger areas: ${hint.triggerAreas.join(", ")}`);
      lines.push(`  Suggested docs: ${hint.suggestedDocs.join(", ")}`);
      lines.push(`  Why: ${hint.reason}`);
    });
    lines.push(`Note: ${result.documentationDrift.note}`);
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
  detectGuardrailStatus,
  resolveTaskAreas,
  classifyRelatedChanges,
  validateScope,
  recommendReviewDepth,
  buildDocumentationDriftHints,
  buildPreflightResult,
  formatHumanReadable,
};
