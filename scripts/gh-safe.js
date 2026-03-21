const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const INLINE_BODY_MAX_LENGTH = 120;

function parseArgs(argv) {
  const options = {
    passthroughArgs: [],
    bodyMode: "none",
    bodyValue: null,
    errors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--body") {
      const value = argv[index + 1];
      if (!value || String(value).startsWith("--")) {
        options.errors.push("Missing value for --body.");
        continue;
      }
      if (options.bodyMode !== "none") {
        options.errors.push("Use only one of --body, --body-file, or --body-stdin.");
        index += 1;
        continue;
      }
      options.bodyMode = "inline";
      options.bodyValue = value;
      index += 1;
      continue;
    }

    if (arg === "--body-file") {
      const value = argv[index + 1];
      if (!value || String(value).startsWith("--")) {
        options.errors.push("Missing value for --body-file.");
        continue;
      }
      if (options.bodyMode !== "none") {
        options.errors.push("Use only one of --body, --body-file, or --body-stdin.");
        index += 1;
        continue;
      }
      options.bodyMode = "file";
      options.bodyValue = value;
      index += 1;
      continue;
    }

    if (arg === "--body-stdin") {
      if (options.bodyMode !== "none") {
        options.errors.push("Use only one of --body, --body-file, or --body-stdin.");
        continue;
      }
      options.bodyMode = "stdin";
      continue;
    }

    options.passthroughArgs.push(arg);
  }

  if (options.passthroughArgs.length === 0) {
    options.errors.push("Missing gh arguments. Example: pr create --title \"...\" --body-stdin");
  }

  return options;
}

function isShortSingleLinePlainText(body) {
  const value = String(body || "");
  if (value.length === 0 || value.length > INLINE_BODY_MAX_LENGTH) {
    return false;
  }
  if (value.includes("\n") || value.includes("\r")) {
    return false;
  }
  if (value.trim() !== value) {
    return false;
  }
  if (/[`*_[\]#<>~|]/.test(value)) {
    return false;
  }
  if (/!\[|\[[^\]]+\]\([^)]+\)/.test(value)) {
    return false;
  }
  if (/^\s*(?:[-*+] |>|\d+\.)\s/.test(value)) {
    return false;
  }
  return true;
}

function shouldUseBodyFile(body) {
  return !isShortSingleLinePlainText(body);
}

function readBodyFromMode(options, readStdin = () => fs.readFileSync(0, "utf8")) {
  if (options.bodyMode === "none" || options.bodyMode === "file") {
    return options.bodyValue;
  }

  if (options.bodyMode === "stdin") {
    return readStdin();
  }

  return options.bodyValue;
}

function createTemporaryBodyFile(body, dependencies = {}) {
  const mkdtempSync = dependencies.mkdtempSync || fs.mkdtempSync;
  const writeFileSync = dependencies.writeFileSync || fs.writeFileSync;
  const rmSync = dependencies.rmSync || fs.rmSync;
  const tmpRoot = dependencies.tmpRoot || os.tmpdir();

  const tempDir = mkdtempSync(path.join(tmpRoot, "gh-body-"));
  const tempFilePath = path.join(tempDir, "body.md");
  writeFileSync(tempFilePath, body, "utf8");

  return {
    tempFilePath,
    cleanup() {
      rmSync(tempDir, { recursive: true, force: true });
    },
  };
}

function buildBodyArgs(options, dependencies = {}) {
  if (options.bodyMode === "none") {
    return {
      args: [],
      mode: "none",
      reason: "No body option provided.",
      cleanup: () => {},
      tempFilePath: null,
    };
  }

  if (options.bodyMode === "file") {
    return {
      args: ["--body-file", options.bodyValue],
      mode: "explicit-file",
      reason: "Explicit --body-file preserved.",
      cleanup: () => {},
      tempFilePath: options.bodyValue,
    };
  }

  const body = readBodyFromMode(options, dependencies.readStdin);

  if (!shouldUseBodyFile(body)) {
    return {
      args: ["--body", body],
      mode: "inline",
      reason: "Short single-line plain text body kept inline.",
      cleanup: () => {},
      tempFilePath: null,
    };
  }

  const tempBodyFile = createTemporaryBodyFile(body, dependencies);
  return {
    args: ["--body-file", tempBodyFile.tempFilePath],
    mode: "temp-file",
    reason: "Multiline or Markdown-rich body routed through a temporary file.",
    cleanup: tempBodyFile.cleanup,
    tempFilePath: tempBodyFile.tempFilePath,
  };
}

function runGhCommand(args, runner = spawnSync) {
  return runner("gh", args, {
    shell: false,
    stdio: "inherit",
  });
}

function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  if (options.errors.length > 0) {
    options.errors.forEach((entry) => console.error(entry));
    return 1;
  }

  const bodyArgs = buildBodyArgs(options, dependencies);
  const finalArgs = [...options.passthroughArgs, ...bodyArgs.args];
  const result = runGhCommand(finalArgs, dependencies.runner || spawnSync);

  try {
    if (result.error) {
      console.error(result.error.message);
      return 1;
    }

    if (typeof result.status === "number") {
      return result.status;
    }

    return 1;
  } finally {
    bodyArgs.cleanup();
  }
}

module.exports = {
  INLINE_BODY_MAX_LENGTH,
  parseArgs,
  isShortSingleLinePlainText,
  shouldUseBodyFile,
  readBodyFromMode,
  createTemporaryBodyFile,
  buildBodyArgs,
  runGhCommand,
  main,
};

if (require.main === module) {
  process.exit(main());
}
