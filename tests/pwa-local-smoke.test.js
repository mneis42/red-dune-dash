const assert = require("node:assert/strict");

const {
  DEFAULT_BASE_URL,
  normalizeBaseUrl,
  parseArgs,
  runSmokeCheck,
} = require("../scripts/pwa-local-smoke.js");

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function createResponse({ status = 200, contentType = "text/plain", body = "" }) {
  return {
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? contentType : null;
      },
    },
    async text() {
      return body;
    },
    async json() {
      return JSON.parse(body);
    },
  };
}

test("parseArgs keeps the default base URL when no flag is supplied", () => {
  assert.deepEqual(parseArgs([]), { baseUrl: DEFAULT_BASE_URL });
});

test("normalizeBaseUrl enforces an http trailing slash", () => {
  assert.equal(normalizeBaseUrl("http://127.0.0.1:8000").toString(), "http://127.0.0.1:8000/");
});

test("runSmokeCheck passes when the local server exposes core PWA files", async () => {
  const fetchImpl = async (url) => {
    const routes = {
      "/": createResponse({
        contentType: "text/html; charset=utf-8",
        body: '<!doctype html><link rel="manifest" href="manifest.webmanifest"><script src="app-assets.js"></script>',
      }),
      "/manifest.webmanifest": createResponse({
        contentType: "application/manifest+json",
        body: JSON.stringify({ display: "standalone", icons: [{ src: "icons/icon-192x192.png" }] }),
      }),
      "/service-worker.js": createResponse({
        contentType: "application/javascript",
        body: 'importScripts("./app-assets.js"); self.addEventListener("fetch", () => {});',
      }),
      "/version.json": createResponse({
        contentType: "application/json",
        body: JSON.stringify({ version: "dev" }),
      }),
    };

    return routes[new URL(url).pathname] ?? createResponse({ status: 404, body: "missing" });
  };

  const result = await runSmokeCheck({ baseUrl: "http://127.0.0.1:8000", fetchImpl });
  assert.equal(result.ok, true);
  assert.deepEqual(result.failures, []);
});

test("runSmokeCheck reports high-signal failures for broken local PWA endpoints", async () => {
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;

    if (pathname === "/") {
      return createResponse({ contentType: "text/html", body: "<!doctype html>" });
    }

    if (pathname === "/manifest.webmanifest") {
      return createResponse({
        contentType: "application/json",
        body: JSON.stringify({ display: "browser", icons: [] }),
      });
    }

    if (pathname === "/service-worker.js") {
      return createResponse({ contentType: "text/plain", body: "console.log('missing sw');" });
    }

    return createResponse({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ version: "" }),
    });
  };

  const result = await runSmokeCheck({ baseUrl: "http://127.0.0.1:8000", fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.failures.some((entry) => entry.includes("index: expected manifest link")), true);
  assert.equal(result.failures.some((entry) => entry.includes("manifest: expected display=standalone")), true);
  assert.equal(result.failures.some((entry) => entry.includes("service-worker: expected fetch listener registration")), true);
  assert.equal(result.failures.some((entry) => entry.includes("version: expected status 200")), true);
});

test("runSmokeCheck reports invalid JSON payloads as endpoint failures", async () => {
  const fetchImpl = async (url) => {
    const pathname = new URL(url).pathname;

    if (pathname === "/") {
      return createResponse({
        contentType: "text/html",
        body: '<!doctype html><link rel="manifest" href="manifest.webmanifest"><script src="app-assets.js"></script>',
      });
    }

    if (pathname === "/manifest.webmanifest") {
      return createResponse({
        contentType: "application/manifest+json",
        body: "{invalid-json",
      });
    }

    if (pathname === "/service-worker.js") {
      return createResponse({
        contentType: "application/javascript",
        body: 'importScripts("./app-assets.js"); self.addEventListener("fetch", () => {});',
      });
    }

    return createResponse({
      contentType: "application/json",
      body: JSON.stringify({ version: "dev" }),
    });
  };

  const result = await runSmokeCheck({ baseUrl: "http://127.0.0.1:8000", fetchImpl });
  assert.equal(result.ok, false);
  assert.equal(result.failures.some((entry) => entry.includes("manifest: validation failed")), true);
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
