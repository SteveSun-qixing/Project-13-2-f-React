function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export const THEME_SCOPE_CHAIN_LOW_TO_HIGH = [
  "global",
  "app",
  "box",
  "composite-card",
  "base-card",
  "component"
];

export const THEME_SCOPE_CHAIN_HIGH_TO_LOW = [...THEME_SCOPE_CHAIN_LOW_TO_HIGH].reverse();

function isFlatTokenMap(value) {
  if (!isObject(value)) {
    return false;
  }

  return Object.keys(value).every((key) => {
    if (!key.includes(".")) {
      return false;
    }
    const entry = value[key];
    return !isObject(entry);
  });
}

function toFlatTokenMap(value) {
  if (!isObject(value)) {
    return {};
  }

  if (isFlatTokenMap(value)) {
    return { ...value };
  }

  return flattenTokenTree(value);
}

export function flattenTokenTree(tokenTree) {
  const out = {};

  const walk = (value, keyPath) => {
    if (isObject(value)) {
      for (const [key, next] of Object.entries(value)) {
        walk(next, keyPath.concat(key));
      }
      return;
    }

    out[keyPath.join(".")] = value;
  };

  walk(tokenTree, []);
  return out;
}

function toThemeError(code, message, details, retryable) {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  error.retryable = retryable === true;
  return error;
}

export function createThemeCacheKey(themeId, version) {
  const resolvedThemeId = typeof themeId === "string" && themeId.length > 0 ? themeId : "default";
  const resolvedVersion = typeof version === "string" && version.length > 0 ? version : "0";
  return `${resolvedThemeId}:${resolvedVersion}`;
}

export function createTokenResolver(flatTokens) {
  return {
    get(key) {
      if (!Object.hasOwn(flatTokens, key)) {
        throw new Error(`TOKEN_KEY_MISSING:${key}`);
      }
      return flatTokens[key];
    },
    has(key) {
      return Object.hasOwn(flatTokens, key);
    },
    keys() {
      return Object.keys(flatTokens).sort();
    }
  };
}

export function resolveScopedTokenValue(tokenKey, scopedTokenMaps, fallbackTokens = {}) {
  const flatFallbackTokens = toFlatTokenMap(fallbackTokens);

  for (const scope of THEME_SCOPE_CHAIN_HIGH_TO_LOW) {
    const tokenMap = scopedTokenMaps[scope];
    if (tokenMap && Object.hasOwn(tokenMap, tokenKey)) {
      return {
        source: scope,
        value: tokenMap[tokenKey]
      };
    }
  }

  if (Object.hasOwn(flatFallbackTokens, tokenKey)) {
    return {
      source: "fallback",
      value: flatFallbackTokens[tokenKey]
    };
  }

  throw toThemeError(
    "THEME_TOKEN_MISSING",
    `Token key not found in theme chain: ${tokenKey}`,
    {
      tokenKey
    },
    false
  );
}

export function createScopedTokenResolver(options) {
  const {
    scopes = {},
    fallbackTokens = {},
    onDiagnostic
  } = options || {};

  const flatScopedMaps = {};
  for (const scope of THEME_SCOPE_CHAIN_LOW_TO_HIGH) {
    flatScopedMaps[scope] = toFlatTokenMap(scopes[scope]);
  }

  const flatFallbackTokens = toFlatTokenMap(fallbackTokens);
  const fallbackAlertedKeys = new Set();
  const missingAlertedKeys = new Set();

  const getResolvedToken = (tokenKey) =>
    resolveScopedTokenValue(tokenKey, flatScopedMaps, flatFallbackTokens);

  const reportDiagnostic = (event) => {
    if (typeof onDiagnostic === "function") {
      onDiagnostic(event);
    }
  };

  const reportFallbackIfNeeded = (tokenKey, source) => {
    if (source !== "fallback" || fallbackAlertedKeys.has(tokenKey)) {
      return;
    }

    fallbackAlertedKeys.add(tokenKey);
    reportDiagnostic({
      code: "THEME_TOKEN_FALLBACK_APPLIED",
      tokenKey,
      source
    });
  };

  const reportMissingIfNeeded = (tokenKey, error) => {
    if (missingAlertedKeys.has(tokenKey)) {
      return;
    }

    missingAlertedKeys.add(tokenKey);
    reportDiagnostic({
      code: "THEME_TOKEN_MISSING",
      tokenKey,
      details: error && error.details ? error.details : undefined
    });
  };

  return {
    get(tokenKey) {
      try {
        const resolved = getResolvedToken(tokenKey);
        reportFallbackIfNeeded(tokenKey, resolved.source);
        return resolved.value;
      } catch (error) {
        reportMissingIfNeeded(tokenKey, error);
        throw error;
      }
    },
    has(tokenKey) {
      try {
        getResolvedToken(tokenKey);
        return true;
      } catch {
        return false;
      }
    },
    keys() {
      const all = new Set(Object.keys(flatFallbackTokens));
      for (const scope of THEME_SCOPE_CHAIN_LOW_TO_HIGH) {
        for (const key of Object.keys(flatScopedMaps[scope])) {
          all.add(key);
        }
      }
      return [...all].sort();
    },
    resolveByPrefix(prefix) {
      const tokenMap = {};
      for (const key of this.keys()) {
        if (key.startsWith(prefix)) {
          tokenMap[key] = this.get(key);
        }
      }
      return tokenMap;
    },
    explain(tokenKey) {
      try {
        const resolved = getResolvedToken(tokenKey);
        reportFallbackIfNeeded(tokenKey, resolved.source);
        return resolved;
      } catch (error) {
        reportMissingIfNeeded(tokenKey, error);
        throw error;
      }
    },
    getCacheKey(themeId, version) {
      return createThemeCacheKey(themeId, version);
    }
  };
}

export function createTamaguiCoreTokens(tokenTree) {
  const flat = flattenTokenTree(tokenTree);
  const out = {};

  for (const [key, value] of Object.entries(flat)) {
    if (key.startsWith("chips.")) {
      out[key.slice("chips.".length).replaceAll(".", "_")] = { value };
    }
  }

  return out;
}
