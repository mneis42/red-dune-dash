const fs = require("node:fs");
const path = require("node:path");

const PRIORITIZED_BACKLOG_PATTERN = /^(\d+)-(.+)\.md$/;
const TEMP_SEGMENT = "__tmp-reprioritize__";
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

  return {
    absolutePath,
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

  const entries = Object.entries(parsed).map(([source, target]) => ({
    from: Number.parseInt(source, 10),
    to: Number.parseInt(target, 10),
    rawFrom: source,
    rawTo: target,
  }));

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

  return {
    path: relativePath,
    entries: parseMappingFile(fs.readFileSync(absolutePath, "utf8")),
  };
}

function listPrioritizedBacklogFiles(backlogDirAbsolute, backlogDirRelative) {
  if (!fs.existsSync(backlogDirAbsolute)) {
    throw new Error(`Backlog directory not found: ${backlogDirRelative}`);
  }

  return fs
    .readdirSync(backlogDirAbsolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
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
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.priority - right.priority || left.fileName.localeCompare(right.fileName));
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

function buildRenamePlan(entries, files, backlogDirRelative) {
  const fileByPriority = new Map(files.map((file) => [file.priority, file]));
  const destinationPaths = [];
  const operations = [];

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
    operations.push({
      from: entry.from,
      to: entry.to,
      sourcePath: currentFile.relativePath,
      sourceAbsolutePath: currentFile.absolutePath,
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

  const sourceLowercase = new Set(files.map((file) => file.relativePath.toLowerCase()));
  for (const operation of operations) {
    if (sourceLowercase.has(operation.finalPath.toLowerCase()) && operation.sourcePath.toLowerCase() !== operation.finalPath.toLowerCase()) {
      throw new Error(`Case-insensitive target collision detected for ${operation.finalPath}.`);
    }
  }

  return operations;
}

function executeRenamePlan(operations, fileSystem = fs) {
  const movedToTemp = [];
  const movedToFinal = [];

  try {
    for (const operation of operations) {
      fileSystem.renameSync(operation.sourceAbsolutePath, operation.tempAbsolutePath);
      movedToTemp.push(operation);
    }

    for (const operation of operations) {
      fileSystem.renameSync(operation.tempAbsolutePath, operation.finalAbsolutePath);
      movedToFinal.push(operation);
    }
  } catch (error) {
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
  const issues = validateMappingCoverage(mapping.entries, files);

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
  hasWindowsReservedPathSegment,
  parseArgs,
  parseMappingFile,
  readMappingFile,
  listPrioritizedBacklogFiles,
  validateMappingCoverage,
  buildRenamePlan,
  executeRenamePlan,
  formatPlanSummary,
  planReprioritization,
  runCli,
};
