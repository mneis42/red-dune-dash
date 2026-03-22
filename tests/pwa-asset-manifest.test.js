const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

require("../app-assets.js");

const assetManifest = globalThis.RED_DUNE_ASSET_MANIFEST;
const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function normalizeAssetPath(assetPath) {
  if (assetPath.startsWith("./")) {
    return assetPath;
  }

  return `./${assetPath.replace(/^\//, "")}`;
}

function extractLocalAssetRefs(documentText) {
  const assetRefs = [];
  const assetPattern = /<(?:link|script|img)\b[^>]+(?:href|src)="([^"]+)"/g;

  for (const match of documentText.matchAll(assetPattern)) {
    const [, rawPath] = match;
    if (!rawPath || /^(?:[a-z]+:|\/\/|#)/i.test(rawPath)) {
      continue;
    }

    assetRefs.push(normalizeAssetPath(rawPath));
  }

  return Array.from(new Set(assetRefs));
}

const htmlAssetRefs = extractLocalAssetRefs(indexHtml);
const offlineCacheAssets = new Set(assetManifest.offlineCacheAssets);
const networkFirstPaths = new Set(assetManifest.networkFirstPaths);

test("index.html local assets stay covered by the offline cache manifest", () => {
  const missingAssets = htmlAssetRefs.filter((assetPath) => !offlineCacheAssets.has(assetPath));
  assert.deepEqual(missingAssets, []);
});

test("core HTML bootstrap assets stay on network-first routing", () => {
  const expectedNetworkFirstAssets = htmlAssetRefs.filter((assetPath) =>
    [".js", ".css", ".webmanifest"].some((suffix) => assetPath.endsWith(suffix))
  );
  const missingPaths = expectedNetworkFirstAssets.filter((assetPath) => {
    const normalizedPath = assetPath.replace(/^\./, "");
    return !networkFirstPaths.has(normalizedPath);
  });

  assert.deepEqual(missingPaths, []);
});

async function runTests() {
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`ok - ${name}`);
    } catch (error) {
      console.error(`not ok - ${name}`);
      console.error(error);
      process.exitCode = 1;
    }
  }
}

runTests().catch((error) => {
  console.error("not ok - unhandled test runner failure");
  console.error(error);
  process.exitCode = 1;
});
