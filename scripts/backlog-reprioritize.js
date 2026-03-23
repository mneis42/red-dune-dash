const fs = require("node:fs");
const path = require("node:path");
const { parseFrontmatter } = require("./backlog-template-lint.js");

const PRIORITIZED_BACKLOG_PATTERN = /^(\d+)-(.+)\.md$/i;
const TEMP_SEGMENT = "__tmp-reprioritize__";
const ENHANCED_METADATA_MIN_ITEM_NUMBER = 12;
const BACKLOG_ITEM_REQUIRED_FIELDS = ["workflow_type", "source", "priority", "status", "created_at"];
const BACKLOG_ITEM_NEW_REQUIRED_FIELDS = ["planning_model", "execution_model", "last_updated"];
const WINDOWS_RESERVED_SEGMENTS = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  "com1",
  "com2",
  "com3",
  "com4",
  "com5",
  "com6",
  "com7",
  "com8",
  "com9",
  "lpt1",
  "lpt2",
  "lpt3",
  "lpt4",
  "lpt5",
  "lpt6",
  "lpt7",
  "lpt8",
  "lpt9",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableUnique(values) {
  return [...new Set(values)];
}

function normalizeRepoRelative(candidatePath) {
  return String(candidatePath || "").replaceAll("\\", "/");
}

function isPathInside(parentPath, childPath) {
  const relativePath = normalizeRepoRelative(path.relative(parentPath, childPath));
  return relativePath === "" || (!relativePath.startsWith("../") && relativePath !== ".." && !relativePath.includes("/../"));
}

function resolveRealPathInsideRepo(repoRoot, candidatePath, label) {
  let realRepoRoot;
  try {
    realRepoRoot = fs.realpathSync(repoRoot);
  } catch (error) {
    throw new Error(`Unable to resolve repository root for ${label}: ${error.message}`);
  }

  let realCandidatePath;
  try {
    realCandidatePath = fs.realpathSync(candidatePath);
  } catch (error) {
    throw new Error(`Unable to resolve ${label}: ${error.message}`);
  }

  if (!isPathInside(realRepoRoot, realCandidatePath)) {
    throw new Error(`${label} must resolve inside the repository root.`);
  }

  return {
    realRepoRoot,
    realCandidatePath,
  };
}

function splitTopLevelJsonMembers(rawText) {
  const text = String(rawText || "").trim();
  if (!text.startsWith("{") || !text.endsWith("}")) {
    throw new Error("Mapping file must contain a JSON object with old priority numbers as keys.");
  }

  const body = text.slice(1, -1);
  const members = [];
  let current = "";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const character of body) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      current += character;
      if (inString) {
        escaped = true;
      }
      continue;
    }

    if (character === "\"") {
      current += character;
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (character === "{" || character === "[") {
        depth += 1;
      } else if (character === "}" || character === "]") {
        depth -= 1;
      } else if (character === "," && depth === 0) {
        if (current.trim()) {
          members.push(current.trim());
        }
        current = "";
        continue;
      }
    }

    current += character;
  }

  if (current.trim()) {
    members.push(current.trim());
  }

  return members.filter(Boolean);
}

function parseRawMappingEntries(content) {
  const members = splitTopLevelJsonMembers(content);
  const entries = [];

  for (const member of members) {
    const separatorIndex = member.indexOf(":");
    if (separatorIndex === -1) {
      throw new Error(`Invalid mapping entry: ${member}`);
    }

    const rawKey = member.slice(0, separatorIndex).trim();
    const rawValue = member.slice(separatorIndex + 1).trim();

    let parsedKey;
    let parsedValue;
    try {
      parsedKey = JSON.parse(rawKey);
    } catch (error) {
      throw new Error(`Invalid mapping key ${rawKey}: ${error.message}`);
    }

    try {
      parsedValue = JSON.parse(rawValue);
    } catch (error) {
      throw new Error(`Invalid mapping value for ${rawKey}: ${error.message}`);
    }

    entries.push({
      from: Number.parseInt(parsedKey, 10),
      to: Number.parseInt(parsedValue, 10),
      rawFrom: String(parsedKey),
      rawTo: parsedValue,
    });
  }

  return entries;
}

function parseArgs(argv) {
  const options = {
    backlogDir: "backlog",
    mappingFile: null,
    apply: false,
    json: false,
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

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }

    if (arg === "--json") {
      options.json = true;
      continue;
    }

    if (arg === "--mapping-file") {
      const value = readValue("--mapping-file", index);
      if (value !== null) {
        options.mappingFile = value;
        index += 1;
      }
      continue;
    }

    if (arg === "--backlog-dir") {
      const value = readValue("--backlog-dir", index);
      if (value !== null) {
        options.backlogDir = value;
        index += 1;
      }
      continue;
    }

    options.errors.push(`Unknown option: ${arg}`);
  }

  if (!options.mappingFile) {
    options.errors.push("Missing required option --mapping-file <path-to-json>.");
  }

  return options;
}

function resolveSubdirectory(repoRoot, dirPath) {
  const rawPath = String(dirPath || "").trim();
  if (!rawPath) {
    throw new Error("Backlog directory is required.");
  }

  if (path.isAbsolute(rawPath)) {
    throw new Error("Backlog directory must be relative to the repository root.");
  }

  const absolutePath = path.resolve(repoRoot, rawPath);
  const relativePath = normalizeRepoRelative(path.relative(repoRoot, absolutePath));

  if (!relativePath || relativePath === ".." || relativePath.startsWith("../") || relativePath.includes("/../")) {
    throw new Error("Backlog directory must stay inside the repository.");
  }

  const { realCandidatePath } = resolveRealPathInsideRepo(repoRoot, absolutePath, "Backlog directory");

  return {
    absolutePath: realCandidatePath,
    relativePath,
  };
}

function parseMappingFile(content) {
  let parsed;

  try {
    parsed = JSON.parse(String(content || ""));
  } catch (error) {
    throw new Error(`Mapping file must contain valid JSON: ${error.message}`);
  }

  if (!isObject(parsed)) {
    throw new Error("Mapping file must contain a JSON object with old priority numbers as keys.");
  }

  const entries = parseRawMappingEntries(content);

  if (entries.length === 0) {
    throw new Error("Mapping file must define at least one old->new priority mapping.");
  }

  const issues = [];

  for (const entry of entries) {
    if (!Number.isInteger(entry.from) || entry.from < 1 || String(entry.from) !== entry.rawFrom.trim()) {
      issues.push(`Invalid source priority key: ${JSON.stringify(entry.rawFrom)}.`);
    }

    const normalizedRawTarget = String(entry.rawTo).trim();
    if (!Number.isInteger(entry.to) || entry.to < 1 || String(entry.to) !== normalizedRawTarget) {
      issues.push(`Invalid target priority value for ${JSON.stringify(entry.rawFrom)}: ${JSON.stringify(entry.rawTo)}.`);
    }
  }

  if (issues.length > 0) {
    throw new Error(issues.join(" "));
  }

  const targets = entries.map((entry) => entry.to);
  const duplicateTargets = [...new Set(targets.filter((value, index) => targets.indexOf(value) !== index))];
  if (duplicateTargets.length > 0) {
    throw new Error(`Duplicate target priorities are not allowed: ${duplicateTargets.sort((left, right) => left - right).join(", ")}.`);
  }

  const sources = entries.map((entry) => entry.from);
  const duplicateSources = [...new Set(sources.filter((value, index) => sources.indexOf(value) !== index))];
  if (duplicateSources.length > 0) {
    throw new Error(`Duplicate source priorities are not allowed: ${duplicateSources.sort((left, right) => left - right).join(", ")}.`);
  }

  return entries.sort((left, right) => left.from - right.from);
}

function readMappingFile(repoRoot, mappingFile) {
  const absolutePath = path.resolve(repoRoot, mappingFile);
  const relativePath = normalizeRepoRelative(path.relative(repoRoot, absolutePath));

  if (!relativePath || relativePath === ".." || relativePath.startsWith("../") || relativePath.includes("/../")) {
    throw new Error("Mapping file must stay inside the repository.");
  }

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Mapping file not found: ${relativePath}`);
  }

  const { realCandidatePath } = resolveRealPathInsideRepo(repoRoot, absolutePath, "Mapping file");

  return {
    path: relativePath,
    entries: parseMappingFile(fs.readFileSync(realCandidatePath, "utf8")),
  };
}

function listPrioritizedBacklogFiles(backlogDirAbsolute, backlogDirRelative) {
  if (!fs.existsSync(backlogDirAbsolute)) {
    throw new Error(`Backlog directory not found: ${backlogDirRelative}`);
  }

  return fs
    .readdirSync(backlogDirAbsolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .map((entry) => {
      const match = entry.name.match(PRIORITIZED_BACKLOG_PATTERN);
      if (!match) {
        return null;
      }

      return {
        fileName: entry.name,
        priority: Number.parseInt(match[1], 10),
        suffix: match[2],
        absolutePath: path.join(backlogDirAbsolute, entry.name),
        relativePath: normalizeRepoRelative(path.join(backlogDirRelative, entry.name)),
        content: fs.readFileSync(path.join(backlogDirAbsolute, entry.name), "utf8"),
      };
    })
    .filter(Boolean)
    .map((file) => ({
      ...file,
      parsedFrontmatter: parseFrontmatter(file.content),
    }))
    .sort((left, right) => left.priority - right.priority || left.fileName.localeCompare(right.fileName));
}

function validatePrioritizedFileSet(files) {
  const issues = [];
  const filesByPriority = new Map();

  for (const file of files) {
    if (!filesByPriority.has(file.priority)) {
      filesByPriority.set(file.priority, []);
    }
    filesByPriority.get(file.priority).push(file.relativePath);
  }

  for (const [priority, filePaths] of filesByPriority.entries()) {
    if (filePaths.length > 1) {
      issues.push(
        `Duplicate prioritized backlog number ${priority}: ${filePaths.sort().join(", ")}.`
      );
    }
  }

  return issues;
}

function validateMappingCoverage(entries, files) {
  const issues = [];
  const fileByPriority = new Map(files.map((file) => [file.priority, file]));
  const sourcePriorities = entries.map((entry) => entry.from);

  for (const entry of entries) {
    if (!fileByPriority.has(entry.from)) {
      issues.push(`Missing source file for priority ${entry.from}.`);
    }
  }

  for (const file of files) {
    if (!sourcePriorities.includes(file.priority)) {
      issues.push(`Missing mapping for prioritized backlog file ${file.relativePath}.`);
    }
  }

  return issues;
}

function hasWindowsReservedSegment(fileName) {
  return fileName
    .split(".")
    .slice(0, -1)
    .join(".")
    .split(/[\\/]/)
    .some((segment) => WINDOWS_RESERVED_SEGMENTS.has(segment.toLowerCase()));
}

function hasWindowsReservedPathSegment(relativePath) {
  return normalizeRepoRelative(relativePath)
    .split("/")
    .some((segment) => WINDOWS_RESERVED_SEGMENTS.has(segment.toLowerCase()));
}

function hasPlaceholderValue(value) {
  return /^<.+>$/.test(String(value || "").trim());
}

function updateFrontmatterField(content, fieldName, nextValue) {
  const fieldPattern = new RegExp(`^(\\s*${fieldName}:\\s*).*$`, "m");
  if (!fieldPattern.test(content)) {
    throw new Error(`Cannot update missing frontmatter field ${fieldName}.`);
  }

  return content.replace(fieldPattern, `$1${nextValue}`);
}

function buildUpdatedContent(file, nextPriority) {
  const parsedFrontmatter = file.parsedFrontmatter || parseFrontmatter(file.content);
  if (!parsedFrontmatter.hasFrontmatter) {
    throw new Error(`${file.relativePath}: missing YAML frontmatter; reprioritize cannot update priority safely.`);
  }

  const workflowType = parsedFrontmatter.map.workflow_type;
  if (workflowType !== "backlog-item") {
    return file.content;
  }

  for (const field of BACKLOG_ITEM_REQUIRED_FIELDS) {
    if (!parsedFrontmatter.map[field]) {
      throw new Error(
        `${file.relativePath}: missing frontmatter field ${field}; reprioritize cannot keep file lint-valid.`
      );
    }
  }

  if (nextPriority >= ENHANCED_METADATA_MIN_ITEM_NUMBER) {
    for (const field of BACKLOG_ITEM_NEW_REQUIRED_FIELDS) {
      const value = parsedFrontmatter.map[field];
      if (!value || hasPlaceholderValue(value)) {
        throw new Error(
          `${file.relativePath}: reprioritize to ${nextPriority} requires frontmatter field ${field} for prioritized backlog items ${ENHANCED_METADATA_MIN_ITEM_NUMBER}+.`
        );
      }
    }
  }

  return updateFrontmatterField(file.content, "priority", String(nextPriority));
}

function buildRenamePlan(entries, files, backlogDirRelative) {
  const fileByPriority = new Map(files.map((file) => [file.priority, file]));
  const destinationPaths = [];
  const tempPaths = [];
  const operations = [];
  const backlogDirAbsolute = files[0] ? path.dirname(files[0].absolutePath) : null;

  if (hasWindowsReservedPathSegment(backlogDirRelative)) {
    throw new Error(`Backlog directory uses a Windows-reserved path segment: ${backlogDirRelative}`);
  }

  for (const entry of entries) {
    const currentFile = fileByPriority.get(entry.from);
    const nextFileName = `${entry.to}-${currentFile.suffix}.md`;
    const finalRelativePath = normalizeRepoRelative(path.join(backlogDirRelative, nextFileName));
    const tempRelativePath = normalizeRepoRelative(
      path.join(backlogDirRelative, `${TEMP_SEGMENT}-${String(entry.from)}-${String(entry.to)}-${currentFile.suffix}.md`)
    );

    if (hasWindowsReservedSegment(nextFileName)) {
      throw new Error(`Target filename uses a Windows-reserved segment: ${nextFileName}`);
    }

    destinationPaths.push(finalRelativePath.toLowerCase());
    tempPaths.push(tempRelativePath.toLowerCase());
    const updatedContent = buildUpdatedContent(currentFile, entry.to);
    operations.push({
      from: entry.from,
      to: entry.to,
      sourcePath: currentFile.relativePath,
      sourceAbsolutePath: currentFile.absolutePath,
      originalContent: currentFile.content,
      updatedContent,
      tempPath: tempRelativePath,
      tempAbsolutePath: path.resolve(path.dirname(currentFile.absolutePath), path.basename(tempRelativePath)),
      finalPath: finalRelativePath,
      finalAbsolutePath: path.resolve(path.dirname(currentFile.absolutePath), nextFileName),
    });
  }

  const duplicateDestinations = destinationPaths.filter((value, index) => destinationPaths.indexOf(value) !== index);
  if (duplicateDestinations.length > 0) {
    throw new Error(`Multiple renames would collide on the same target path: ${stableUnique(duplicateDestinations).join(", ")}.`);
  }

  const duplicateTempPaths = tempPaths.filter((value, index) => tempPaths.indexOf(value) !== index);
  if (duplicateTempPaths.length > 0) {
    throw new Error(`Multiple renames would collide on the same temporary path: ${stableUnique(duplicateTempPaths).join(", ")}.`);
  }

  const sourcePathSet = new Set(files.map((file) => file.relativePath.toLowerCase()));
  const existingPathSet = new Set(
    (backlogDirAbsolute
      ? fs
          .readdirSync(backlogDirAbsolute, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => normalizeRepoRelative(path.join(backlogDirRelative, entry.name)).toLowerCase())
      : [])
  );

  for (const operation of operations) {
    if (
      existingPathSet.has(operation.tempPath.toLowerCase()) &&
      !sourcePathSet.has(operation.tempPath.toLowerCase())
    ) {
      throw new Error(`Temporary path already exists and would be overwritten: ${operation.tempPath}`);
    }

    if (
      existingPathSet.has(operation.finalPath.toLowerCase()) &&
      !sourcePathSet.has(operation.finalPath.toLowerCase())
    ) {
      throw new Error(`Target path already exists outside the provided mapping: ${operation.finalPath}`);
    }
  }

  return operations;
}

function executeRenamePlan(operations, fileSystem = fs) {
  const movedToTemp = [];
  const movedToFinal = [];
  const rewrittenFiles = [];

  try {
    for (const operation of operations) {
      fileSystem.renameSync(operation.sourceAbsolutePath, operation.tempAbsolutePath);
      movedToTemp.push(operation);
    }

    for (const operation of operations) {
      fileSystem.renameSync(operation.tempAbsolutePath, operation.finalAbsolutePath);
      movedToFinal.push(operation);
    }

    for (const operation of operations) {
      if (operation.updatedContent !== operation.originalContent) {
        fileSystem.writeFileSync(operation.finalAbsolutePath, operation.updatedContent);
        rewrittenFiles.push(operation);
      }
    }
  } catch (error) {
    for (let index = rewrittenFiles.length - 1; index >= 0; index -= 1) {
      const operation = rewrittenFiles[index];
      try {
        fileSystem.writeFileSync(operation.finalAbsolutePath, operation.originalContent);
      } catch {
        // Best-effort rollback; preserve the original failure as the surfaced error.
      }
    }

    for (let index = movedToFinal.length - 1; index >= 0; index -= 1) {
      const operation = movedToFinal[index];
      try {
        fileSystem.renameSync(operation.finalAbsolutePath, operation.tempAbsolutePath);
      } catch {
        // Best-effort rollback; preserve the original failure as the surfaced error.
      }
    }

    for (let index = movedToTemp.length - 1; index >= 0; index -= 1) {
      const operation = movedToTemp[index];
      try {
        fileSystem.renameSync(operation.tempAbsolutePath, operation.sourceAbsolutePath);
      } catch {
        // Best-effort rollback; preserve the original failure as the surfaced error.
      }
    }

    throw error;
  }
}

function formatPlanSummary(result) {
  const lines = [];
  lines.push(`backlog:reprioritize: ${result.mode} (${result.operations.length} planned renames)`);
  lines.push(`mapping-file: ${result.mappingPath}`);
  lines.push(`backlog-dir: ${result.backlogDir}`);

  for (const operation of result.operations) {
    lines.push(`${operation.sourcePath} -> ${operation.finalPath}`);
  }

  return lines.join("\n");
}

function planReprioritization(repoRoot, options) {
  const { absolutePath: backlogDirAbsolute, relativePath: backlogDirRelative } = resolveSubdirectory(repoRoot, options.backlogDir);
  const mapping = readMappingFile(repoRoot, options.mappingFile);
  const files = listPrioritizedBacklogFiles(backlogDirAbsolute, backlogDirRelative);
  const issues = [
    ...validatePrioritizedFileSet(files),
    ...validateMappingCoverage(mapping.entries, files),
  ];

  if (issues.length > 0) {
    throw new Error(issues.join(" "));
  }

  const operations = buildRenamePlan(mapping.entries, files, backlogDirRelative);

  return {
    mode: options.apply ? "apply" : "dry-run",
    backlogDir: backlogDirRelative,
    mappingPath: mapping.path,
    operations,
  };
}

function runCli(argv, dependencies = {}) {
  const options = parseArgs(argv);
  const writeStdout = dependencies.writeStdout || ((line) => process.stdout.write(`${line}\n`));
  const writeStderr = dependencies.writeStderr || ((line) => process.stderr.write(`${line}\n`));
  const repoRoot = dependencies.repoRoot || process.cwd();
  const fileSystem = dependencies.fs || fs;

  if (options.errors.length > 0) {
    writeStderr(options.errors.join("\n"));
    return 1;
  }

  try {
    const result = planReprioritization(repoRoot, options);

    if (options.apply) {
      executeRenamePlan(result.operations, fileSystem);
    }

    if (options.json) {
      writeStdout(
        JSON.stringify(
          {
            mode: result.mode,
            mappingFile: result.mappingPath,
            backlogDir: result.backlogDir,
            plannedRenameCount: result.operations.length,
            renames: result.operations.map((operation) => ({
              from: operation.from,
              to: operation.to,
              sourcePath: operation.sourcePath,
              finalPath: operation.finalPath,
            })),
          },
          null,
          2
        )
      );
    } else {
      writeStdout(formatPlanSummary(result));
    }

    return 0;
  } catch (error) {
    writeStderr(`backlog:reprioritize: FAILED`);
    writeStderr(error.message);
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2));
}

module.exports = {
  PRIORITIZED_BACKLOG_PATTERN,
  TEMP_SEGMENT,
  WINDOWS_RESERVED_SEGMENTS,
  isPathInside,
  resolveRealPathInsideRepo,
  hasWindowsReservedPathSegment,
  parseArgs,
  splitTopLevelJsonMembers,
  parseRawMappingEntries,
  parseMappingFile,
  readMappingFile,
  listPrioritizedBacklogFiles,
  validatePrioritizedFileSet,
  validateMappingCoverage,
  buildUpdatedContent,
  buildRenamePlan,
  executeRenamePlan,
  formatPlanSummary,
  planReprioritization,
  runCli,
};
