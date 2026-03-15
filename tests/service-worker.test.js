const assert = require("node:assert/strict");

// Minimal SW-ähnliches Globalobjekt bereitstellen, damit service-worker.js
// importiert werden kann, ohne echte Browser-APIs zu benötigen.
const listeners = {};
const fakeCaches = new Map();

globalThis.self = {
  addEventListener(type, listener) {
    listeners[type] = listener;
  },
  skipWaiting() {},
  clients: {
    claim() {},
  },
  location: {
    origin: "https://example.com",
  },
};

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

// Dummy fetch, wird in diesen Smoke-Tests nicht als echter Netzwerkpfad verwendet.
globalThis.fetch = async (request) => ({
  status: 200,
  type: "basic",
  url: typeof request === "string" ? request : request.url,
  clone() {
    return this;
  },
});

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

  const requests = [];
  const responds = [];

  function makeEvent(url, options = {}) {
    const { method = "GET", mode = "same-origin" } = options;
    return {
      request: {
        method,
        mode,
        url,
      },
      respondWith(promise) {
        responds.push(promise);
      },
    };
  }

  const coreUrl = "https://example.com/index.html";
  const coreEvent = makeEvent(coreUrl, { method: "GET", mode: "navigate" });
  fetchListener(coreEvent);
  assert.equal(responds.length > 0, true);

  const otherOriginEvent = makeEvent("https://other.example.com/index.html");
  responds.length = 0;
  fetchListener(otherOriginEvent);
  assert.equal(responds.length, 0);

  const postEvent = makeEvent(coreUrl, { method: "POST" });
  responds.length = 0;
  fetchListener(postEvent);
  assert.equal(responds.length, 0);
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
