const assert = require("node:assert/strict");

// Make self an alias for globalThis for manifest propagation correctness
const listeners = {};
const fakeCaches = new Map();
const fetchCalls = [];
globalThis.self = globalThis;
self.addEventListener = function(type, listener) {
  listeners[type] = listener;
};
self.skipWaiting = function() {};
self.clients = { claim() {} };
self.registration = { scope: "https://example.com/red-dune-dash/" };
self.location = { origin: "https://example.com" };

globalThis.caches = {
  async open(name) {
    if (!fakeCaches.has(name)) {
      fakeCaches.set(name, new Map());
    }
    const store = fakeCaches.get(name);
    return {
      async addAll(entries) {
        entries.forEach((entry) => store.set(String(entry), { url: String(entry) }));
      },
      async match(request) {
        const key = typeof request === "string" ? request : request.url;
        return store.get(key) ?? null;
      },
      async put(request, response) {
        const key = typeof request === "string" ? request : request.url;
        store.set(key, response);
      },
    };
  },
  async keys() {
    return Array.from(fakeCaches.keys());
  },
  async delete(name) {
    return fakeCaches.delete(name);
  },
};

globalThis.fetch = async (request, options) => {
  fetchCalls.push({ request, options });
  return {
    status: 200,
    type: "basic",
    url: typeof request === "string" ? request : request.url,
    clone() {
      return this;
    },
  };
};

globalThis.importScripts = (...urls) => {
  urls.forEach((url) => {
    if (url === "./app-assets.js") {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      require("../app-assets.js");
    }
  });
};

require("../service-worker.js");

const assetManifest = globalThis.RED_DUNE_ASSET_MANIFEST ?? {
  cacheName: "red-dune-dash-v3",
  appShellAssets: [],
};

const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function createEvent(url, options = {}) {
  const { method = "GET", mode = "same-origin" } = options;
  const responds = [];

  return {
    responds,
    event: {
      request: {
        method,
        mode,
        url,
      },
      respondWith(promise) {
        responds.push(promise);
      },
    },
  };
}

test("service worker precaches all app shell assets", async () => {
  const installListener = listeners["install"];
  assert.ok(typeof installListener === "function");

  const event = {
    waitUntil(promise) {
      this._promise = promise;
    },
  };

  installListener(event);
  await event._promise;

  const cacheName = assetManifest.cacheName;
  const cache = await caches.open(cacheName);

  for (const asset of assetManifest.appShellAssets) {
    const response = await cache.match(asset);
    assert.ok(response, `expected app shell asset ${asset} to be cached`);
  }
});

test("service worker exposes fetch listener for same-origin GET requests", () => {
  const fetchListener = listeners["fetch"];
  assert.ok(typeof fetchListener === "function");

  const coreUrl = "https://example.com/index.html";
  const navigateRequest = createEvent(coreUrl, { method: "GET", mode: "navigate" });
  fetchListener(navigateRequest.event);
  assert.equal(navigateRequest.responds.length > 0, true);

  const otherOriginRequest = createEvent("https://other.example.com/index.html");
  fetchListener(otherOriginRequest.event);
  assert.equal(otherOriginRequest.responds.length, 0);

  const postRequest = createEvent(coreUrl, { method: "POST" });
  fetchListener(postRequest.event);
  assert.equal(postRequest.responds.length, 0);
});


function reloadServiceWorkerWithScope(scopeUrl) {
  // Remove cached modules to allow re-import with new scope
  delete require.cache[require.resolve("../service-worker.js")];
  listeners["fetch"] = undefined;
  listeners["install"] = undefined;
  listeners["activate"] = undefined;
  self.registration.scope = scopeUrl;
  require("../service-worker.js");
}

test("service worker applies network-first to core requests (root scope)", async () => {
  reloadServiceWorkerWithScope("https://example.com/");
  const fetchListener = listeners["fetch"];
  assert.ok(typeof fetchListener === "function");

  fetchCalls.length = 0;

  const rootVersionRequest = createEvent("https://example.com/version.json");
  fetchListener(rootVersionRequest.event);
  await rootVersionRequest.responds[0];

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].options?.cache, "no-store");
});

test("service worker applies network-first to core requests (project subpath scope)", async () => {
  reloadServiceWorkerWithScope("https://example.com/red-dune-dash/");
  const fetchListener = listeners["fetch"];
  assert.ok(typeof fetchListener === "function");

  fetchCalls.length = 0;

  const subpathVersionRequest = createEvent("https://example.com/red-dune-dash/version.json");
  fetchListener(subpathVersionRequest.event);
  await subpathVersionRequest.responds[0];

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].options?.cache, "no-store");
});

test("service worker keeps non-core same-origin assets on stale-while-revalidate", async () => {
  const fetchListener = listeners["fetch"];
  assert.ok(typeof fetchListener === "function");

  fetchCalls.length = 0;

  const assetRequest = createEvent("https://example.com/red-dune-dash/assets/run1.png");
  fetchListener(assetRequest.event);
  await assetRequest.responds[0];

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].options, undefined);
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
