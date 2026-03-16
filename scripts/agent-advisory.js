const { execFileSync } = require("node:child_process");
const {
  loadAdvisoryDocument,
  validateAdvisoryDocument,
  resolveAdvisoryForFiles,
} = require("./advisory-rules.js");

function parseArgs(argv) {
  const options = {
    json: false,
    staged: false,
    unmatched: false,
    files: null,
    rulesPath: null,
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
      const value = argv[index + 1] || "";
      index += 1;
      options.files = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
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
  lines.push("Per-file mapping");
  result.perFile.forEach((entry) => {
    const fallbackMark = entry.usedFallback ? " (fallback)" : "";
    lines.push(`- ${entry.filePath}: ${entry.ruleIds.join(", ")}${fallbackMark}`);
  });

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

  const changedFiles = getChangedFiles(options);
  const result = resolveAdvisoryForFiles(changedFiles, document);
  result.rulesPath = absolutePath;

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
      return;
    }

    console.log("Unmatched advisory files");
    console.log("========================");
    if (unmatchedFiles.length === 0) {
      console.log("None.");
      return;
    }
    unmatchedFiles.forEach((entry) => console.log(`- ${entry}`));
    return;
  }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatHumanReadable(result));
}

main();