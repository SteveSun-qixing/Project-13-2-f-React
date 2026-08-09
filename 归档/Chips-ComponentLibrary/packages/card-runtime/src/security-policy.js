const DEFAULT_SANDBOX_TOKENS = ["allow-scripts", "allow-same-origin"];

const FORBIDDEN_SANDBOX_TOKEN_SET = new Set([
  "allow-top-navigation",
  "allow-top-navigation-by-user-activation",
  "allow-popups-to-escape-sandbox"
]);

function normalizeTokenList(value) {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length > 0);
}

export function resolveIframeSandboxPolicy(sandbox) {
  const tokenSet = new Set(DEFAULT_SANDBOX_TOKENS);
  const tokens = normalizeTokenList(sandbox);

  for (const token of tokens) {
    if (!FORBIDDEN_SANDBOX_TOKEN_SET.has(token)) {
      tokenSet.add(token);
    }
  }

  return Array.from(tokenSet).join(" ");
}

function normalizeAllowedOrigins(allowedOrigins) {
  if (!Array.isArray(allowedOrigins)) {
    return [];
  }

  return allowedOrigins.filter((origin) => typeof origin === "string" && origin.length > 0);
}

export function isAllowedFrameOrigin(origin, allowedOrigins) {
  if (typeof origin !== "string" || origin.length === 0) {
    return false;
  }

  const normalized = normalizeAllowedOrigins(allowedOrigins);
  if (normalized.length === 0) {
    return true;
  }

  return normalized.includes(origin);
}
