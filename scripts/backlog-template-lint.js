const fs = require("node:fs");
const path = require("node:path");

const BACKLOG_DIR = "backlog";
const BACKLOG_DONE_DIR = "backlog/done";
const PRIORITIZED_FILE_PATTERN = /^\d+-.+\.md$/;
const ENHANCED_METADATA_MIN_ITEM_NUMBER = 12;

const BACKLOG_ITEM_REQUIRED_FIELDS = [
  "workflow_type",
  "source",
  "priority",
  "status",
  "created_at",
];

const BACKLOG_ITEM_NEW_REQUIRED_FIELDS = ["planning_model", "execution_model", "last_updated"];

const BACKLOG_ITEM_REQUIRED_HEADINGS = [
  "# TODO:",
  "## Goal",
  "## Scope",
  "## Out Of Scope",
  "## Acceptance Criteria",
  "## Suggested Verification",
  "## Notes",
];

const FEATURE_REQUEST_REQUIRED_FIELDS = [
  "workflow_type",
  "title",
  "overall_status",
  "planning_model",
  "branch",
  "created_at",
  "last_updated",
];

const FEATURE_REQUEST_REQUIRED_HEADINGS = [
  "# Feature Request TODO",
  "## Feature Summary",
  "## Verification Baseline",
  "## Assumptions And Open Questions",
  "## Decision Gate",
  "## TODO Index",
  "## Documentation Follow-ups",
];

function parseFrontmatter(content) {
  const text = String(content || "");
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return { map: {}, hasFrontmatter: false };
  }

  const map = {};
  const lines = match[1].split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key) {
      map[key] = value;
    }
  }

  return { map, hasFrontmatter: true };
}

function hasAllHeadings(content, headings) {
  const text = String(content || "");
  const missing = [];
  for (const heading of headings) {
    if (!text.includes(heading)) {
      missing.push(heading);
    }
  }
  return missing;
}

function getPrioritizedItemNumber(filePath) {
  const basename = path.basename(String(filePath || ""));
  const match = basename.match(/^(\d+)-/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasPlaceholderValue(value) {
  const normalized = String(value || "").trim();
  return /^<.+>$/.test(normalized);
}

function listBacklogFiles(repoRoot) {
  const backlogPath = path.join(repoRoot, BACKLOG_DIR);
  if (!fs.existsSync(backlogPath)) {
    return [];
  }

  return fs
    .readdirSync(backlogPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(BACKLOG_DIR, entry.name).replaceAll("\\", "/"))
    .sort();
}

function listDoneBacklogFiles(repoRoot) {
  const donePath = path.join(repoRoot, BACKLOG_DONE_DIR);
  if (!fs.existsSync(donePath)) {
    return [];
  }

  return fs
    .readdirSync(donePath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => path.join(BACKLOG_DONE_DIR, entry.name).replaceAll("\\", "/"))
    .sort();
}

function extractTodoTitle(content) {
  const match = String(content || "").match(/^#\s+TODO:\s+(.+)$/m);
  return match ? match[1].trim() : "";
}

function normalizeComparableTitle(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeFileStem(filePath) {
  const stem = path.basename(String(filePath || ""), ".md").toLowerCase();
  return stem
    .replace(/^\d{8}-\d{6}-/, "")
    .replace(/^\d+-todo-/, "")
    .replace(/^todo-/, "")
    .replace(/^\d+-/, "");
}

function buildComparableKey(content, filePath, parsedFrontmatter) {
  const frontmatterResult = parsedFrontmatter || parseFrontmatter(content);
  const frontmatter = frontmatterResult.map;
  const workflowType = frontmatter.workflow_type;

  if (workflowType === "feature-request") {
    const fromFeatureTitle = normalizeComparableTitle(frontmatter.title);
    if (fromFeatureTitle) {
      return fromFeatureTitle;
    }
  }

  const title = extractTodoTitle(content);
  const fromTitle = normalizeComparableTitle(title);
  if (fromTitle) {
    return fromTitle;
  }

  return normalizeComparableTitle(normalizeFileStem(filePath));
}

function findDuplicateKeys(entries) {
  const seen = new Map();
  for (const entry of entries) {
    if (!seen.has(entry.key)) {
      seen.set(entry.key, []);
    }
    seen.get(entry.key).push(entry);
  }

  return [...seen.values()].filter((group) => group.length > 1);
}

function validateDoneBacklogFile(repoRoot, filePath) {
  const issues = [];
  const absolutePath = path.join(repoRoot, filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  const parsedFrontmatter = parseFrontmatter(content);
  const { map: frontmatter, hasFrontmatter } = parsedFrontmatter;

  if (hasFrontmatter && Object.prototype.hasOwnProperty.call(frontmatter, "status") && frontmatter.status !== "done") {
    issues.push(`${filePath}: backlog/done entries must use frontmatter status: done.`);
  }

  return { issues, content, key: buildComparableKey(content, filePath, parsedFrontmatter) };
}

function validateBacklogContent(filePath, content, parsedFrontmatter) {
  const issues = [];
  const frontmatterResult = parsedFrontmatter || parseFrontmatter(content);
  const { map: frontmatter, hasFrontmatter } = frontmatterResult;

  if (!hasFrontmatter) {
    issues.push(`${filePath}: missing YAML frontmatter block.`);
    return issues;
  }

  const workflowType = frontmatter.workflow_type;
  if (!workflowType) {
    issues.push(`${filePath}: missing frontmatter field workflow_type.`);
    return issues;
  }

  if (workflowType === "backlog-item") {
    for (const field of BACKLOG_ITEM_REQUIRED_FIELDS) {
      if (!frontmatter[field]) {
        issues.push(`${filePath}: missing frontmatter field ${field}.`);
      }
    }

    const itemNumber = getPrioritizedItemNumber(filePath);
    const priorityValue = Number.parseInt(frontmatter.priority, 10);
    if (
      itemNumber !== null &&
      Number.isInteger(priorityValue) &&
      priorityValue !== itemNumber
    ) {
      issues.push(
        `${filePath}: frontmatter priority ${priorityValue} must match prioritized filename number ${itemNumber}.`
      );
    }
    const requiresEnhancedMetadata =
      itemNumber !== null && itemNumber >= ENHANCED_METADATA_MIN_ITEM_NUMBER;

    if (requiresEnhancedMetadata) {
      for (const field of BACKLOG_ITEM_NEW_REQUIRED_FIELDS) {
        if (!frontmatter[field]) {
          issues.push(
            `${filePath}: missing frontmatter field ${field} for prioritized backlog items ${ENHANCED_METADATA_MIN_ITEM_NUMBER}+.`
          );
          continue;
        }

        if (hasPlaceholderValue(frontmatter[field])) {
          issues.push(`${filePath}: frontmatter field ${field} must not be a placeholder value.`);
        }
      }
    }

    const missingHeadings = hasAllHeadings(content, BACKLOG_ITEM_REQUIRED_HEADINGS);
    for (const heading of missingHeadings) {
      issues.push(`${filePath}: missing required heading ${heading}.`);
    }

    return issues;
  }

  if (workflowType === "feature-request") {
    for (const field of FEATURE_REQUEST_REQUIRED_FIELDS) {
      if (!frontmatter[field]) {
        issues.push(`${filePath}: missing frontmatter field ${field}.`);
      }
    }

    const missingHeadings = hasAllHeadings(content, FEATURE_REQUEST_REQUIRED_HEADINGS);
    for (const heading of missingHeadings) {
      issues.push(`${filePath}: missing required heading ${heading}.`);
    }

    return issues;
  }

  issues.push(
    `${filePath}: unsupported workflow_type ${workflowType}. Use workflow_type: backlog-item with templates/todo-backlog-item-template.md or workflow_type: feature-request with templates/todo-feature-request-template.md.`
  );
  return issues;
}

function validateBacklogFile(repoRoot, filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  const parsedFrontmatter = parseFrontmatter(content);
  return validateBacklogContent(filePath, content, parsedFrontmatter);
}

function runBacklogTemplateLint(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const files = listBacklogFiles(repoRoot);
  const doneFiles = listDoneBacklogFiles(repoRoot);
  const issues = [];
  const openKeys = [];
  const doneKeys = [];

  for (const filePath of files) {
    const absolutePath = path.join(repoRoot, filePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    const parsedFrontmatter = parseFrontmatter(content);
    const key = buildComparableKey(content, filePath, parsedFrontmatter);

    let isOpen = false;
    if (parsedFrontmatter && typeof parsedFrontmatter === "object" && parsedFrontmatter.map) {
      const workflowType = parsedFrontmatter.map.workflow_type;
      if (workflowType === "backlog-item") {
        isOpen = parsedFrontmatter.map.status === "open";
      } else if (workflowType === "feature-request") {
        isOpen = parsedFrontmatter.map.overall_status === "open";
      }
    }

    openKeys.push({ filePath, key, isOpen });
    issues.push(...validateBacklogContent(filePath, content, parsedFrontmatter));
  }

  for (const filePath of doneFiles) {
    const result = validateDoneBacklogFile(repoRoot, filePath);
    doneKeys.push({ filePath, key: result.key });
    issues.push(...result.issues);
  }

  const openDuplicates = findDuplicateKeys(openKeys);
  for (const group of openDuplicates) {
    const filesWithSameKey = group.map((entry) => entry.filePath).sort();
    issues.push(
      `Duplicate backlog topic "${group[0].key}" in backlog/: ${filesWithSameKey.join(", ")}.`
    );
  }

  const doneByKey = new Map();
  for (const entry of doneKeys) {
    if (!doneByKey.has(entry.key)) {
      doneByKey.set(entry.key, []);
    }
    doneByKey.get(entry.key).push(entry.filePath);
  }

  for (const entry of openKeys) {
    if (!entry.isOpen) {
      continue;
    }

    const donePaths = doneByKey.get(entry.key);
    if (donePaths && donePaths.length > 0) {
      const sortedDonePaths = [...donePaths].sort();
      issues.push(
        `Open backlog item duplicates archived topic "${entry.key}": ${entry.filePath} (open) vs ${sortedDonePaths.join(", ")} (done).`
      );
    }
  }

  return {
    repoRoot,
    files,
    doneFiles,
    issues,
  };
}

function formatResult(result) {
  if (result.issues.length === 0) {
    return `backlog:lint: ok (${result.files.length} open files, ${result.doneFiles.length} done files checked)`;
  }

  const lines = [];
  lines.push(`backlog:lint: FAILED (${result.issues.length} issues)`);
  lines.push(`backlog:lint: checked ${result.files.length} open files and ${result.doneFiles.length} done files.`);
  for (const issue of result.issues) {
    lines.push(`- ${issue}`);
  }

  return lines.join("\n");
}

if (require.main === module) {
  const result = runBacklogTemplateLint();
  const output = formatResult(result);
  if (result.issues.length > 0) {
    console.error(output);
    process.exitCode = 1;
  } else {
    console.log(output);
  }
}

module.exports = {
  parseFrontmatter,
  listBacklogFiles,
  listDoneBacklogFiles,
  extractTodoTitle,
  normalizeComparableTitle,
  normalizeFileStem,
  buildComparableKey,
  findDuplicateKeys,
  validateBacklogContent,
  validateBacklogFile,
  validateDoneBacklogFile,
  runBacklogTemplateLint,
  formatResult,
};
