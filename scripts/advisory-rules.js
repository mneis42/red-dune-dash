const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_RULES_PATH = path.join(process.cwd(), "workflow", "advisory-rules.json");

function normalizeRepoPath(inputPath) {
  return String(inputPath || "")
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\//, "")
    .replace(/^\/+/, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function globToRegExp(globPattern) {
  const pattern = normalizeRepoPath(globPattern);

  if (!pattern) {
    return /^$/;
  }

  let regexSource = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const next = pattern[index + 1];

    if (char === "*" && next === "*") {
      regexSource += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      regexSource += "[^/]*";
      continue;
    }

    regexSource += escapeRegExp(char);
  }

  return new RegExp(`^${regexSource}$`);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0);
}

function validateAllowedKeys(target, allowedKeys, fieldPath) {
  const errors = [];

  Object.keys(target).forEach((key) => {
    if (!allowedKeys.has(key)) {
      errors.push(`${fieldPath}.${key} is not allowed`);
    }
  });

  return errors;
}

function validateRuleLike(rule, fieldPath, { requireMatch }) {
  const errors = [];
  const required = [
    "id",
    "area",
    "riskTags",
    "recommendedChecks",
    "manualChecks",
    "suggestedDocs",
    "suggestedReading",
    "ciSignals",
  ];

  if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
    return [`${fieldPath} must be an object`];
  }

  for (const key of required) {
    if (!(key in rule)) {
      errors.push(`${fieldPath}.${key} is required`);
    }
  }

  if (requireMatch && !("match" in rule)) {
    errors.push(`${fieldPath}.match is required`);
  }

  if (typeof rule.id !== "string" || rule.id.trim().length === 0) {
    errors.push(`${fieldPath}.id must be a non-empty string`);
  }
  if (typeof rule.area !== "string" || rule.area.trim().length === 0) {
    errors.push(`${fieldPath}.area must be a non-empty string`);
  }

  if (requireMatch && !isStringArray(rule.match)) {
    errors.push(`${fieldPath}.match must be a non-empty string array`);
  }

  const arrayFields = [
    "riskTags",
    "recommendedChecks",
    "manualChecks",
    "suggestedDocs",
    "suggestedReading",
    "ciSignals",
  ];
  for (const key of arrayFields) {
    if (!isStringArray(rule[key]) && !(Array.isArray(rule[key]) && rule[key].length === 0)) {
      errors.push(`${fieldPath}.${key} must be a string array`);
    }
  }

  return errors;
}

function validateAdvisoryDocument(document) {
  const errors = [];

  if (!document || typeof document !== "object" || Array.isArray(document)) {
    return { valid: false, errors: ["document must be an object"] };
  }

  if (!Number.isInteger(document.version) || document.version < 1) {
    errors.push("version must be an integer >= 1");
  }

  if (!document.governance || typeof document.governance !== "object" || Array.isArray(document.governance)) {
    errors.push("governance must be an object");
  } else {
    if (document.governance.advisoryOnly !== true) {
      errors.push("governance.advisoryOnly must be true");
    }
    if (typeof document.governance.routingAuthority !== "string" || document.governance.routingAuthority.trim().length === 0) {
      errors.push("governance.routingAuthority must be a non-empty string");
    }
    if (typeof document.governance.note !== "string" || document.governance.note.trim().length === 0) {
      errors.push("governance.note must be a non-empty string");
    }
  }

  if (!("policyGates" in document)) {
    errors.push("policyGates is required");
  }

  if (!Array.isArray(document.rules) || document.rules.length === 0) {
    errors.push("rules must be a non-empty array");
  } else {
    const seenIds = new Set();
    document.rules.forEach((rule, index) => {
      const fieldPath = `rules[${index}]`;
      validateRuleLike(rule, fieldPath, { requireMatch: true }).forEach((entry) => errors.push(entry));

      if (rule && typeof rule.id === "string") {
        if (seenIds.has(rule.id)) {
          errors.push(`${fieldPath}.id must be unique`);
        }
        seenIds.add(rule.id);
      }
    });
  }

  if ("unknownFileFallback" in document) {
    validateRuleLike(document.unknownFileFallback, "unknownFileFallback", { requireMatch: false }).forEach((entry) =>
      errors.push(entry)
    );
  }

  if ("policyGates" in document) {
    if (!document.policyGates || typeof document.policyGates !== "object" || Array.isArray(document.policyGates)) {
      errors.push("policyGates must be an object");
    } else {
      validateAllowedKeys(document.policyGates, new Set(["stages"]), "policyGates").forEach((entry) => errors.push(entry));

      if (!Array.isArray(document.policyGates.stages) || document.policyGates.stages.length === 0) {
        errors.push("policyGates.stages must be a non-empty array");
      } else {
        document.policyGates.stages.forEach((stage, stageIndex) => {
          const fieldPath = `policyGates.stages[${stageIndex}]`;
          if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
            errors.push(`${fieldPath} must be an object`);
            return;
          }

          validateAllowedKeys(stage, new Set(["id", "label", "blocking", "status", "summary", "candidateGates"]), fieldPath).forEach(
            (entry) => errors.push(entry)
          );

          ["id", "label", "status", "summary"].forEach((key) => {
            if (typeof stage[key] !== "string" || stage[key].trim().length === 0) {
              errors.push(`${fieldPath}.${key} must be a non-empty string`);
            }
          });
          if (typeof stage.blocking !== "boolean") {
            errors.push(`${fieldPath}.blocking must be a boolean`);
          }

          if (!("candidateGates" in stage)) {
            return;
          }
          if (!Array.isArray(stage.candidateGates)) {
            errors.push(`${fieldPath}.candidateGates must be an array`);
            return;
          }

          stage.candidateGates.forEach((gate, gateIndex) => {
            const gateFieldPath = `${fieldPath}.candidateGates[${gateIndex}]`;
            if (!gate || typeof gate !== "object" || Array.isArray(gate)) {
              errors.push(`${gateFieldPath} must be an object`);
              return;
            }

            validateAllowedKeys(
              gate,
              new Set([
                "id",
                "status",
                "confidence",
                "blocking",
                "source",
                "documentationStatusLine",
                "documentationDetailLine",
              ]),
              gateFieldPath
            ).forEach((entry) => errors.push(entry));

            ["id", "status", "confidence", "documentationStatusLine", "documentationDetailLine"].forEach((key) => {
              if (typeof gate[key] !== "string" || gate[key].trim().length === 0) {
                errors.push(`${gateFieldPath}.${key} must be a non-empty string`);
              }
            });
            if (typeof gate.blocking !== "boolean") {
              errors.push(`${gateFieldPath}.blocking must be a boolean`);
            }
            if (!isStringArray(gate.source) && !(Array.isArray(gate.source) && gate.source.length === 0)) {
              errors.push(`${gateFieldPath}.source must be a string array`);
            }
          });
        });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function loadAdvisoryDocument(filePath = DEFAULT_RULES_PATH) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const document = JSON.parse(raw);
  return { absolutePath, document };
}

function stableUnique(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}

function collectMergedHints(ruleEntries) {
  return {
    areas: stableUnique(ruleEntries.map((entry) => entry.area)),
    riskTags: stableUnique(ruleEntries.flatMap((entry) => entry.riskTags)),
    recommendedChecks: stableUnique(ruleEntries.flatMap((entry) => entry.recommendedChecks)),
    manualChecks: stableUnique(ruleEntries.flatMap((entry) => entry.manualChecks)),
    suggestedDocs: stableUnique(ruleEntries.flatMap((entry) => entry.suggestedDocs)),
    suggestedReading: stableUnique(ruleEntries.flatMap((entry) => entry.suggestedReading)),
    ciSignals: stableUnique(ruleEntries.flatMap((entry) => entry.ciSignals)),
  };
}

function resolveAdvisoryForFiles(changedFiles, document) {
  const normalizedFiles = stableUnique((changedFiles || []).map(normalizeRepoPath).filter(Boolean)).sort();
  const compiledRules = document.rules.map((rule, index) => ({
    ...rule,
    _order: index,
    _compiledPatterns: rule.match.map(globToRegExp),
  }));

  const fallback = document.unknownFileFallback ? { ...document.unknownFileFallback, _order: Number.MAX_SAFE_INTEGER } : null;

  const perFile = [];
  const matchedRuleIds = new Set();

  for (const filePath of normalizedFiles) {
    const matchedRules = compiledRules
      .filter((rule) => rule._compiledPatterns.some((pattern) => pattern.test(filePath)))
      .sort((a, b) => a._order - b._order);

    if (matchedRules.length === 0 && fallback) {
      matchedRuleIds.add(fallback.id);
      perFile.push({ filePath, ruleIds: [fallback.id], usedFallback: true });
      continue;
    }

    matchedRules.forEach((rule) => matchedRuleIds.add(rule.id));
    perFile.push({
      filePath,
      ruleIds: matchedRules.map((rule) => rule.id),
      usedFallback: false,
    });
  }

  const matchedRules = [];
  for (const rule of compiledRules) {
    if (matchedRuleIds.has(rule.id)) {
      const { _order, _compiledPatterns, ...cleanRule } = rule;
      matchedRules.push(cleanRule);
    }
  }
  if (fallback && matchedRuleIds.has(fallback.id)) {
    const { _order, ...cleanFallback } = fallback;
    matchedRules.push(cleanFallback);
  }

  return {
    changedFiles: normalizedFiles,
    perFile,
    matchedRules,
    merged: collectMergedHints(matchedRules),
    governance: document.governance,
    strategy: {
      multiMatch: "merge-dedupe",
      unknownFiles: fallback ? "fallback-rule" : "none",
    },
  };
}

module.exports = {
  DEFAULT_RULES_PATH,
  normalizeRepoPath,
  validateAdvisoryDocument,
  loadAdvisoryDocument,
  resolveAdvisoryForFiles,
};
