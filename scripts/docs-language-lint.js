const fs = require("node:fs");
const path = require("node:path");

const TARGET_ROOTS = ["docs", "instructions", ".github/instructions"];
const TARGET_ROOT_FILES = ["README.md", "CONTRIBUTING.md", "AGENTS.md", ".github/copilot-instructions.md"];
const EXCLUDED_FILES = new Set(["developer-todos.md", "developer-todos.ms"]);
// Historical archives and operational logs are intentionally outside the active-doc language policy.
const EXCLUDED_DIRECTORIES = ["backlog", "reviews", "logs/agent-runs"];

const GERMAN_MARKER_PATTERN =
  /(?:\b(?:der|die|das|und|oder|nicht|fuer|ist|sind|soll|sollen|wird|werden|mit|ohne|mehr|wenn|diese|dieses|dieser|diesen|aktuell|spaeter|kuenftig|zusaetzlich|bereits|ueber|dabei)\b|[A-Za-zäöüÄÖÜß]*[äöüÄÖÜß][A-Za-zäöüÄÖÜß]*)/i;

function toPosix(value) {
  return String(value || "").replaceAll("\\", "/");
}

function isMarkdownFile(filePath) {
  return String(filePath || "").toLowerCase().endsWith(".md");
}

function shouldSkipPath(relativePath) {
  const normalized = toPosix(relativePath);
  if (EXCLUDED_FILES.has(path.basename(normalized))) {
    return true;
  }

  return EXCLUDED_DIRECTORIES.some((directory) =>
    normalized === directory || normalized.startsWith(`${directory}/`)
  );
}

function collectMarkdownFiles(repoRoot) {
  const files = [];

  for (const rootFile of TARGET_ROOT_FILES) {
    const absolutePath = path.join(repoRoot, rootFile);
    if (fs.existsSync(absolutePath) && !shouldSkipPath(rootFile)) {
      files.push(toPosix(rootFile));
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
      if (shouldSkipPath(childRelative)) {
        continue;
      }

      if (entry.isDirectory()) {
        walk(childRelative);
        continue;
      }

      if (entry.isFile() && isMarkdownFile(childRelative)) {
        files.push(childRelative);
      }
    }
  }

  for (const rootDirectory of TARGET_ROOTS) {
    walk(rootDirectory);
  }

  return [...new Set(files)].sort();
}

function lintFileContent(filePath, content) {
  const findings = [];
  const lines = String(content || "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.trim().startsWith("```")) {
      continue;
    }

    const match = line.match(GERMAN_MARKER_PATTERN);
    if (!match) {
      continue;
    }

    findings.push({
      filePath: toPosix(filePath),
      line: index + 1,
      marker: match[0],
      text: line.trim(),
    });
  }

  return findings;
}

function runDocsLanguageLint(options = {}) {
  const repoRoot = options.repoRoot ? path.resolve(options.repoRoot) : process.cwd();
  const markdownFiles = collectMarkdownFiles(repoRoot);

  const findings = [];
  for (const relativePath of markdownFiles) {
    const absolutePath = path.join(repoRoot, relativePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    findings.push(...lintFileContent(relativePath, content));
  }

  return {
    repoRoot,
    scannedFiles: markdownFiles.length,
    findings,
  };
}

function printResult(result) {
  if (result.findings.length === 0) {
    console.log(`docs-language-lint: ok (${result.scannedFiles} files scanned)`);
    return;
  }

  console.error(
    `docs-language-lint: found ${result.findings.length} potential German language markers ` +
      `in technical documentation (${result.scannedFiles} files scanned)`
  );

  for (const finding of result.findings) {
    console.error(`${finding.filePath}:${finding.line} marker="${finding.marker}" text="${finding.text}"`);
  }
}

if (require.main === module) {
  const result = runDocsLanguageLint();
  printResult(result);
  process.exitCode = result.findings.length > 0 ? 1 : 0;
}

module.exports = {
  GERMAN_MARKER_PATTERN,
  collectMarkdownFiles,
  lintFileContent,
  runDocsLanguageLint,
};
