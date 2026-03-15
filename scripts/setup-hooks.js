const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const hooksPath = path.join(repoRoot, ".githooks");
const prePushHook = path.join(hooksPath, "pre-push");

if (!fs.existsSync(hooksPath)) {
  throw new Error(`Missing hooks directory: ${hooksPath}`);
}

if (!fs.existsSync(prePushHook)) {
  throw new Error(`Missing pre-push hook: ${prePushHook}`);
}

execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
  cwd: repoRoot,
  stdio: "inherit"
});

try {
  fs.chmodSync(prePushHook, 0o755);
} catch (error) {
  console.warn(`Unable to update hook permissions for ${prePushHook}: ${error.message}`);
}

console.log("Configured git hooks for this repository.");
console.log("Direct pushes from main will now be blocked locally by .githooks/pre-push.");
