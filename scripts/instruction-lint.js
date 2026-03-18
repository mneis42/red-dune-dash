const fs = require("node:fs");
const path = require("node:path");

const CANONICAL_INSTRUCTION_PATHS = [
  "instructions/full-code-review.md",
  "instructions/change-review.md",
  "instructions/feature-request.md",
  "instructions/bug-report.md",
];

const PRE_PR_CHECKLIST_PATH = "instructions/pre-pr-checklist.md";
const PRE_PR_CHECKLIST_REQUIRED_REFERENCE_PATHS = [
  "AGENTS.md",
  "CONTRIBUTING.md",
  "instructions/feature-request.md",
  "instructions/bug-report.md",
  ".github/copilot-instructions.md",
];

const DEFAULT_ROOT_MARKDOWN_FILES = ["AGENTS.md", "README.md", "CONTRIBUTING.md"];
const DEFAULT_SCAN_DIRECTORIES = ["instructions", ".github"];

const ISSUE_SEVERITY_BY_CODE = {
  "missing-canonical-file": "high",
  "missing-agents-file": "high",
  "missing-canonical-reference": "high",
  "missing-pre-pr-checklist-reference": "high",
  "missing-required-checklist-reference-file": "high",
  "missing-link-target": "medium",
  "missing-anchor": "medium",
  "invalid-anchor-target": "medium",
  "empty-link-target": "low",
};

function toPosix(value) {
  return String(value || "").replaceAll("\\", "/");
}

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

function isMarkdownFile(filePath) {
  return String(filePath || "").toLowerCase().endsWith(".md");
}

function normalizeHeadingText(heading) {
  return String(heading || "")
    .replace(/`+/g, "")
    .replace(/[\[\]()]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildHeadingAnchors(markdownText) {
  const lines = String(markdownText || "").split(/\r?\n/);
  const counter = new Map();
  const anchors = new Set();

  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (!match) {
      continue;
    }

    const base = normalizeHeadingText(match[1]);
    if (!base) {
      continue;
    }

    const count = counter.get(base) || 0;
    counter.set(base, count + 1);

    if (count === 0) {
      anchors.add(base);
    } else {
      anchors.add(`${base}-${count}`);
    }
  }

  return anchors;
}

function decodeLinkTarget(target) {
  const trimmed = String(target || "").trim();

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function parseMarkdownLinks(markdownText) {
  const text = String(markdownText || "");
  const regex = /\[[^\]]+\]\(([^)]+)\)/g;
  const links = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const index = match.index;
    if (index > 0 && text[index - 1] === "!") {
      continue;
    }

    const rawTarget = decodeLinkTarget(match[1]);
    if (!rawTarget) {
      continue;
    }

    const line = text.slice(0, index).split(/\r?\n/).length;
    links.push({
      href: rawTarget,
      line,
    });
  }

  return links;
}

function isExternalTarget(href) {
  const value = String(href || "").toLowerCase();
  return (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("vscode://")
  );
}

function splitLinkTarget(href) {
  const value = String(href || "").trim();
  const hashIndex = value.indexOf("#");

  if (hashIndex === -1) {
    return { linkPath: value, anchor: "" };
  }

  return {
    linkPath: value.slice(0, hashIndex),
    anchor: value.slice(hashIndex + 1),
  };
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function createIssue(code, filePath, line, message) {
  const severity = ISSUE_SEVERITY_BY_CODE[code] || "medium";
  return {
    code,
    severity,
    filePath: toPosix(filePath),
    line,
    message,
  };
}

function countBySeverity(issues) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    if (issue.severity in counts) {
      counts[issue.severity] += 1;
    }
  }
  return counts;
}

function collectMarkdownFiles(repoRoot) {
  const files = [];

  for (const rootEntry of DEFAULT_ROOT_MARKDOWN_FILES) {
    const absolutePath = path.join(repoRoot, rootEntry);
    if (fs.existsSync(absolutePath)) {
      files.push(rootEntry);
    }
  }

  function walk(relativeDir) {
    const absoluteDir = path.join(repoRoot, relativeDir);
    if (!fs.existsSync(absoluteDir)) {
      return;
    }

    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
      const childRelative = toPosix(path.join(relativeDir, entry.name));
      if (entry.isDirectory()) {
        walk(childRelative);
        continue;
      }
      if (entry.isFile() && isMarkdownFile(childRelative)) {
        files.push(childRelative);
      }
    }
  }

  for (const directory of DEFAULT_SCAN_DIRECTORIES) {
    walk(directory);
  }

  return stableUnique(files).sort();
}

function lintCanonicalAgentReferences(repoRoot, byPath) {
  const issues = [];
  const agentsPath = "AGENTS.md";
  const agents = byPath.get(agentsPath);

  for (const canonicalPath of CANONICAL_INSTRUCTION_PATHS) {
    const absolutePath = path.join(repoRoot, canonicalPath);
    if (!fs.existsSync(absolutePath)) {
      issues.push(
        createIssue(
          "missing-canonical-file",
          agentsPath,
          1,
          `Canonical instruction file is missing: ${canonicalPath}`
        )
      );
      continue;
    }

    if (!agents) {
      issues.push(
        createIssue(
          "missing-agents-file",
          agentsPath,
          1,
          "AGENTS.md is missing, canonical routing cannot be validated."
        )
      );
      continue;
    }

    const hasReference = agents.links.some((entry) => {
      if (isExternalTarget(entry.href)) {
        return false;
      }
      const target = splitLinkTarget(entry.href);
      const cleanTarget = safeDecodeURIComponent(target.linkPath).trim();
      return cleanTarget === canonicalPath;
    });

    if (!hasReference) {
      issues.push(
        createIssue(
          "missing-canonical-reference",
          agentsPath,
          1,
          `AGENTS.md does not reference canonical instruction path: ${canonicalPath}`
        )
      );
    }
  }

  return issues;
}

function lintPrePrChecklistReferences(repoRoot, byPath) {
  const issues = [];
  const checklistAbsolutePath = path.join(repoRoot, PRE_PR_CHECKLIST_PATH);

  if (!fs.existsSync(checklistAbsolutePath)) {
    issues.push(
      createIssue(
        "missing-canonical-file",
        PRE_PR_CHECKLIST_REQUIRED_REFERENCE_PATHS[0],
        1,
        `Canonical instruction file is missing: ${PRE_PR_CHECKLIST_PATH}`
      )
    );
    return issues;
  }

  for (const sourcePath of PRE_PR_CHECKLIST_REQUIRED_REFERENCE_PATHS) {
    const source = byPath.get(sourcePath);
    if (!source) {
      issues.push(
        createIssue(
          "missing-required-checklist-reference-file",
          sourcePath,
          1,
          `Required checklist reference file is missing: ${sourcePath}`
        )
      );
      continue;
    }

    const hasReference = source.links.some((entry) => {
      if (isExternalTarget(entry.href)) {
        return false;
      }
      const target = splitLinkTarget(entry.href);
      const cleanTarget = safeDecodeURIComponent(target.linkPath).trim();
      const resolvedTargetPath = toPosix(path.normalize(path.join(path.dirname(sourcePath), cleanTarget)));
      return resolvedTargetPath === PRE_PR_CHECKLIST_PATH;
    });

    if (!hasReference) {
      issues.push(
        createIssue(
          "missing-pre-pr-checklist-reference",
          sourcePath,
          1,
          `${sourcePath} does not reference mandatory checklist path: ${PRE_PR_CHECKLIST_PATH}`
        )
      );
    }
  }

  return issues;
}

function lintInstructionLinks(repoRoot, files) {
  const issues = [];
  const byPath = new Map();

  for (const relativePath of files) {
    const absolutePath = path.join(repoRoot, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    byPath.set(relativePath, {
      content,
      links: parseMarkdownLinks(content),
      anchors: buildHeadingAnchors(content),
    });
  }

  issues.push(...lintCanonicalAgentReferences(repoRoot, byPath));
  issues.push(...lintPrePrChecklistReferences(repoRoot, byPath));

  for (const sourcePath of files) {
    const sourceEntry = byPath.get(sourcePath);
    for (const link of sourceEntry.links) {
      if (isExternalTarget(link.href)) {
        continue;
      }

      const target = splitLinkTarget(link.href);
      const decodedPath = safeDecodeURIComponent(target.linkPath).trim();
      const decodedAnchor = safeDecodeURIComponent(target.anchor).trim().toLowerCase();

      if (!decodedPath && !decodedAnchor) {
        issues.push(createIssue("empty-link-target", sourcePath, link.line, "Empty markdown link target."));
        continue;
      }

      if (!decodedPath) {
        if (!sourceEntry.anchors.has(decodedAnchor)) {
          issues.push(
            createIssue(
              "missing-anchor",
              sourcePath,
              link.line,
              `Anchor not found in file: #${decodedAnchor}`
            )
          );
        }
        continue;
      }

      const resolvedTargetPath = toPosix(path.normalize(path.join(path.dirname(sourcePath), decodedPath)));
      const absoluteTargetPath = path.join(repoRoot, resolvedTargetPath);

      if (!fs.existsSync(absoluteTargetPath)) {
        issues.push(
          createIssue(
            "missing-link-target",
            sourcePath,
            link.line,
            `Linked path does not exist: ${decodedPath}`
          )
        );
        continue;
      }

      if (!decodedAnchor) {
        continue;
      }

      if (!fs.statSync(absoluteTargetPath).isFile() || !isMarkdownFile(resolvedTargetPath)) {
        issues.push(
          createIssue(
            "invalid-anchor-target",
            sourcePath,
            link.line,
            `Anchor references require a markdown file target: ${decodedPath}#${decodedAnchor}`
          )
        );
        continue;
      }

      let targetEntry = byPath.get(resolvedTargetPath);
      if (!targetEntry) {
        const targetContent = fs.readFileSync(absoluteTargetPath, "utf8");
        targetEntry = {
          content: targetContent,
          links: parseMarkdownLinks(targetContent),
          anchors: buildHeadingAnchors(targetContent),
        };
        byPath.set(resolvedTargetPath, targetEntry);
      }

      if (!targetEntry.anchors.has(decodedAnchor)) {
        issues.push(
          createIssue(
            "missing-anchor",
            sourcePath,
            link.line,
            `Anchor not found in ${resolvedTargetPath}: #${decodedAnchor}`
          )
        );
      }
    }
  }

  issues.sort((left, right) => {
    if (left.filePath !== right.filePath) {
      return left.filePath.localeCompare(right.filePath);
    }
    if (left.line !== right.line) {
      return left.line - right.line;
    }
    return left.code.localeCompare(right.code);
  });

  return {
    checkedFiles: files,
    issues,
    severityCounts: countBySeverity(issues),
  };
}

function runInstructionLint({ repoRoot = process.cwd(), files } = {}) {
  const fileList = Array.isArray(files) && files.length > 0 ? stableUnique(files).sort() : collectMarkdownFiles(repoRoot);
  return lintInstructionLinks(repoRoot, fileList);
}

function formatInstructionLintResult(result) {
  const lines = [];
  lines.push("Instruction lint");
  lines.push("================");
  lines.push(`Checked files: ${result.checkedFiles.length}`);
  lines.push(`Issues: ${result.issues.length}`);
  if (result.issues.length > 0) {
    const counts = result.severityCounts || { high: 0, medium: 0, low: 0 };
    lines.push(`Severity: high ${counts.high}, medium ${counts.medium}, low ${counts.low}`);
  }

  if (result.issues.length > 0) {
    lines.push("");
    lines.push("Findings");
    result.issues.forEach((issue) => {
      lines.push(`- [${issue.severity}] [${issue.code}] ${issue.filePath}:${issue.line} ${issue.message}`);
    });
  }

  return lines.join("\n");
}

function main() {
  const result = runInstructionLint();
  console.log(formatInstructionLintResult(result));

  if (result.issues.length > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  CANONICAL_INSTRUCTION_PATHS,
  ISSUE_SEVERITY_BY_CODE,
  normalizeHeadingText,
  buildHeadingAnchors,
  parseMarkdownLinks,
  collectMarkdownFiles,
  lintInstructionLinks,
  runInstructionLint,
  formatInstructionLintResult,
};
