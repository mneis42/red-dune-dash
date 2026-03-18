const fs = require("node:fs");
const path = require("node:path");
const { parseFrontmatter } = require("./backlog-template-lint.js");

const DEFAULT_MAX_FILES = 6;
const DEFAULT_CHECKS = ["npm run check", "npm test"];
const STOP_WORDS = new Set([
  "todo",
  "helper",
  "create",
  "provide",
  "short",
  "likely",
  "files",
  "first",
  "scope",
  "goal",
  "notes",
  "acceptance",
  "criteria",
  "suggested",
  "verification",
  "with",
  "from",
  "that",
  "this",
  "into",
  "keep",
  "small",
  "light",
  "practical",
  "item",
  "selected",
]);

function parseArgs(argv) {
  const options = {
    file: null,
    json: false,
    maxFiles: DEFAULT_MAX_FILES,
    errors: [],
  };

  function readValue(flag, index) {
    const value = argv[index + 1];
    if (!value || String(value).startsWith("--")) {
      options.errors.push(`Missing value for ${flag}.`);
      return null;
    }
    return String(value);
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--file") {
      const value = readValue("--file", i);
      if (value !== null) {
        options.file = value;
        i += 1;
      }
      continue;
    }

    if (arg === "--max-files") {
      const value = readValue("--max-files", i);
      if (value !== null) {
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
          options.errors.push("--max-files must be an integer between 1 and 20.");
        } else {
          options.maxFiles = parsed;
        }
        i += 1;
      }
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    options.errors.push(`Unknown option: ${arg}`);
  }

  if (!options.file) {
    options.errors.push("Missing required option --file <path-to-backlog-item>.");
  }

  return options;
}

function toRepoRelativePath(repoRoot, filePath) {
  const absolute = path.resolve(repoRoot, filePath);
  return path.relative(repoRoot, absolute).replaceAll("\\", "/");
}

function resolveBacklogItemPath(repoRoot, filePath) {
  const rawPath = String(filePath || "").trim();
  if (!rawPath) {
    throw new Error("Backlog item path is required.");
  }

  if (path.isAbsolute(rawPath)) {
    throw new Error("Backlog item path must be relative to the repository root.");
  }

  const relativePath = toRepoRelativePath(repoRoot, rawPath);
  if (!relativePath || relativePath.startsWith("../") || relativePath.includes("/../") || relativePath === "..") {
    throw new Error("Backlog item path must stay inside the repository.");
  }

  if (!relativePath.startsWith("backlog/")) {
    throw new Error("Backlog item path must point to a file under backlog/.");
  }

  if (!relativePath.endsWith(".md")) {
    throw new Error("Backlog item path must reference a markdown file (.md).");
  }

  const absolutePath = path.resolve(repoRoot, relativePath);
  return {
    relativePath,
    absolutePath,
  };
}

function readBacklogItem(repoRoot, filePath) {
  const { relativePath, absolutePath } = resolveBacklogItemPath(repoRoot, filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Backlog item not found: ${relativePath}`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const frontmatter = parseFrontmatter(content).map;
  return {
    filePath: relativePath,
    content,
    frontmatter,
  };
}

function findSection(content, heading) {
  const text = String(content || "");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRegex = new RegExp(`^##\\s+${escapedHeading}\\s*$`, "m");
  const headingMatch = headingRegex.exec(text);
  if (!headingMatch || typeof headingMatch.index !== "number") {
    return "";
  }

  const sectionStart = headingMatch.index + headingMatch[0].length;
  const rest = text.slice(sectionStart);
  const nextHeadingMatch = /\n##\s+/.exec(rest);
  const sectionText = nextHeadingMatch ? rest.slice(0, nextHeadingMatch.index) : rest;

  return sectionText.trim();
}

function extractBulletLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("-") || /^\d+\./.test(line))
    .map((line) => line.replace(/^(-|\d+\.)\s*/, "").trim())
    .filter(Boolean);
}

function extractTodoTitle(content) {
  const match = String(content || "").match(/^#\s+TODO:\s+(.+)$/m);
  return match ? match[1].trim() : "Untitled backlog item";
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 56);
}

function suggestBranchName(backlogPath, title) {
  const basename = path.basename(String(backlogPath || ""));
  const numberMatch = basename.match(/^(\d+)-/);
  const slug = slugify(title);

  if (numberMatch) {
    return `chore/backlog-${numberMatch[1]}-${slug || "item"}`;
  }

  return `chore/${slug || "backlog-item"}`;
}

function buildExecutionBrief(goalText, scopeItems, acceptanceItems) {
  const goal = String(goalText || "").replace(/\s+/g, " ").trim();
  const scopePreview = scopeItems.slice(0, 3);
  const acceptancePreview = acceptanceItems.slice(0, 2);

  const lines = [];
  lines.push(goal || "No explicit goal text found.");

  if (scopePreview.length > 0) {
    lines.push(`Scope focus: ${scopePreview.join("; ")}.`);
  }

  if (acceptancePreview.length > 0) {
    lines.push(`Done when: ${acceptancePreview.join("; ")}.`);
  }

  return lines.join(" ");
}

function tokenizeForRelevance(text) {
  return stableUnique(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
  );
}

function stableUnique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  }
  return out;
}

function collectRepositoryFiles(repoRoot) {
  const results = [];
  const ignoredDirs = new Set([".git", "node_modules", "assets", "icons"]);
  const ignoredExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2"]);

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name);
      const relative = path.relative(repoRoot, absolute).replaceAll("\\", "/");

      if (entry.isDirectory()) {
        if (
          ignoredDirs.has(entry.name) ||
          entry.name === "backlog" ||
          relative.startsWith("backlog/") ||
          (entry.name.startsWith(".") && entry.name !== ".github")
        ) {
          continue;
        }
        walk(absolute);
        continue;
      }

      if (entry.name.startsWith(".")) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      if (ignoredExtensions.has(extension)) {
        continue;
      }

      results.push(relative);
    }
  }

  walk(repoRoot);
  return results;
}

function scoreFilePath(filePath, tokens) {
  const normalized = String(filePath || "").toLowerCase();
  let score = 0;

  for (const token of tokens) {
    if (normalized.includes(token)) {
      score += 5;
    }
  }

  if (normalized.startsWith("scripts/")) {
    score += 2;
  }
  if (normalized.startsWith("tests/")) {
    score += 2;
  }
  if (normalized === "readme.md") {
    score += 2;
  }
  if (normalized.startsWith("instructions/") || normalized === "agents.md" || normalized === "contributing.md") {
    score += 1;
  }

  return score;
}

function suggestLikelyFiles(tokens, filePaths, maxFiles) {
  const scored = filePaths
    .map((filePath) => ({ filePath, score: scoreFilePath(filePath, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.filePath.localeCompare(b.filePath);
    });

  return scored.slice(0, maxFiles).map((entry) => entry.filePath);
}

function normalizeChecks(checks) {
  const filtered = stableUnique(
    checks
      .map((line) => line.trim())
      .map((line) => line.replace(/^`+|`+$/g, "").trim())
      .filter(Boolean)
  );
  return filtered.length > 0 ? filtered : DEFAULT_CHECKS;
}

function buildResult(repoRoot, item, options) {
  const title = extractTodoTitle(item.content);
  const goalText = findSection(item.content, "Goal").replace(/\s+/g, " ").trim();
  const scopeItems = extractBulletLines(findSection(item.content, "Scope"));
  const acceptanceItems = extractBulletLines(findSection(item.content, "Acceptance Criteria"));
  const checks = normalizeChecks(extractBulletLines(findSection(item.content, "Suggested Verification")));

  const relevanceText = [title, goalText, ...scopeItems, ...acceptanceItems].join(" ");
  const tokens = tokenizeForRelevance(relevanceText);
  const files = collectRepositoryFiles(repoRoot);
  const likelyFiles = stableUnique([item.filePath, ...suggestLikelyFiles(tokens, files, options.maxFiles)]).slice(
    0,
    options.maxFiles
  );

  return {
    backlogItem: {
      file: item.filePath,
      title,
      priority: item.frontmatter.priority || null,
    },
    branchName: suggestBranchName(item.filePath, title),
    executionBrief: buildExecutionBrief(goalText, scopeItems, acceptanceItems),
    likelyFiles,
    likelyChecks: checks,
  };
}

function formatResult(result) {
  const lines = [];
  lines.push("Backlog-to-branch helper");
  lines.push("========================");
  lines.push(`Backlog item: ${result.backlogItem.file}`);
  lines.push(`Title: ${result.backlogItem.title}`);
  lines.push(`Suggested branch: ${result.branchName}`);
  lines.push("");
  lines.push("Execution brief");
  lines.push(`- ${result.executionBrief}`);
  lines.push("");
  lines.push("Likely files to inspect first");
  if (result.likelyFiles.length === 0) {
    lines.push("- (no strong matches from current repo paths)");
  } else {
    result.likelyFiles.forEach((filePath) => lines.push(`- ${filePath}`));
  }
  lines.push("");
  lines.push("Likely checks to run");
  result.likelyChecks.forEach((entry) => lines.push(`- ${entry}`));
  return lines.join("\n");
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.errors.length > 0) {
    options.errors.forEach((entry) => console.error(entry));
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const item = readBacklogItem(repoRoot, options.file);
  const result = buildResult(repoRoot, item, options);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(formatResult(result));
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  resolveBacklogItemPath,
  findSection,
  extractBulletLines,
  extractTodoTitle,
  suggestBranchName,
  buildExecutionBrief,
  tokenizeForRelevance,
  suggestLikelyFiles,
  normalizeChecks,
  buildResult,
  formatResult,
};
