const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

function parseArgs(argv) {
  const args = { baseUrl: DEFAULT_BASE_URL };

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];

    if (entry === "--base-url") {
      args.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${entry}`);
  }

  if (!args.baseUrl) {
    throw new Error("Missing value for --base-url");
  }

  return args;
}

function normalizeBaseUrl(baseUrl) {
  const url = new URL(baseUrl);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Base URL must use http or https.");
  }

  url.pathname = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  url.search = "";
  url.hash = "";
  return url;
}

async function readText(response) {
  if (typeof response.text === "function") {
    return response.text();
  }

  return "";
}

async function readJson(response) {
  if (typeof response.json === "function") {
    return response.json();
  }

  return JSON.parse(await readText(response));
}

function contentTypeIncludes(response, expectedParts) {
  const headerValue = response.headers?.get?.("content-type") ?? "";
  return expectedParts.some((entry) => headerValue.toLowerCase().includes(entry));
}

async function checkEndpoint(baseUrl, definition, fetchImpl) {
  const targetUrl = new URL(definition.path, baseUrl);
  const response = await fetchImpl(targetUrl);
  const failures = [];

  if (response.status !== 200) {
    failures.push(`${definition.label}: expected status 200, got ${response.status}`);
    return failures;
  }

  if (definition.contentTypeParts && !contentTypeIncludes(response, definition.contentTypeParts)) {
    const headerValue = response.headers?.get?.("content-type") ?? "(missing)";
    failures.push(
      `${definition.label}: expected content-type to include ${definition.contentTypeParts.join(" or ")}, got ${headerValue}`
    );
  }

  try {
    await definition.validate(response, failures);
  } catch (error) {
    failures.push(`${definition.label}: validation failed (${error.message})`);
  }

  return failures;
}

async function runSmokeCheck({ baseUrl = DEFAULT_BASE_URL, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch is required to run the PWA smoke check.");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const endpoints = [
    {
      path: "./",
      label: "index",
      contentTypeParts: ["text/html"],
      async validate(response, failures) {
        const body = await readText(response);
        if (!body.includes('<link rel="manifest" href="manifest.webmanifest">')) {
          failures.push('index: expected manifest link in HTML shell');
        }
        if (!body.includes('<script src="app-assets.js"></script>')) {
          failures.push("index: expected app-assets bootstrap script in HTML shell");
        }
      },
    },
    {
      path: "./manifest.webmanifest",
      label: "manifest",
      contentTypeParts: ["application/manifest+json", "application/json"],
      async validate(response, failures) {
        const manifest = await readJson(response);
        if (manifest.display !== "standalone") {
          failures.push(`manifest: expected display=standalone, got ${manifest.display ?? "(missing)"}`);
        }
        if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
          failures.push("manifest: expected at least one icon");
        }
      },
    },
    {
      path: "./service-worker.js",
      label: "service-worker",
      contentTypeParts: ["javascript", "ecmascript", "text/plain"],
      async validate(response, failures) {
        const body = await readText(response);
        if (!body.includes('self.addEventListener("fetch"')) {
          failures.push("service-worker: expected fetch listener registration");
        }
        if (!body.includes('importScripts("./app-assets.js")')) {
          failures.push("service-worker: expected asset manifest import");
        }
      },
    },
    {
      path: "./version.json",
      label: "version",
      contentTypeParts: ["application/json", "text/plain"],
      async validate(response, failures) {
        const payload = await readJson(response);
        if (typeof payload.version !== "string" || payload.version.length === 0) {
          failures.push("version: expected non-empty string version");
        }
      },
    },
  ];

  const failures = [];

  for (const definition of endpoints) {
    const endpointFailures = await checkEndpoint(normalizedBaseUrl, definition, fetchImpl);
    failures.push(...endpointFailures);
  }

  return {
    ok: failures.length === 0,
    baseUrl: normalizedBaseUrl.toString(),
    failures,
    checkedPaths: endpoints.map((entry) => entry.path),
  };
}

async function main(argv = process.argv.slice(2)) {
  try {
    const { baseUrl } = parseArgs(argv);
    const result = await runSmokeCheck({ baseUrl });

    if (!result.ok) {
      console.error(`PWA smoke check failed for ${result.baseUrl}`);
      result.failures.forEach((failure) => console.error(`- ${failure}`));
      process.exitCode = 1;
      return;
    }

    console.log(`PWA smoke check passed for ${result.baseUrl}`);
    result.checkedPaths.forEach((checkedPath) => console.log(`ok - ${checkedPath}`));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  DEFAULT_BASE_URL,
  normalizeBaseUrl,
  parseArgs,
  runSmokeCheck,
};

if (require.main === module) {
  main();
}
