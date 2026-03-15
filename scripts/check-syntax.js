const { execFileSync } = require("child_process");

const filesToCheck = [
  "app-assets.js",
  "service-worker.js",
  "game-endless.js",
  "systems/bug-lifecycle-system.js",
  "systems/debug-tools.js",
  "systems/game-state.js",
  "systems/generator-helpers.js",
  "systems/pickup-system.js",
  "systems/placement-system.js",
  "systems/respawn-helpers.js",
  "systems/simulation-core.js",
  "systems/special-event-system.js"
];

for (const file of filesToCheck) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log(`Checked ${filesToCheck.length} JavaScript files.`);
