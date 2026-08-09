import test from "node:test";
import assert from "node:assert/strict";
import {
  createScopedTokenResolver,
  createThemeCacheKey,
  createTamaguiCoreTokens,
  createTokenResolver,
  flattenTokenTree,
  resolveScopedTokenValue,
  THEME_SCOPE_CHAIN_HIGH_TO_LOW,
  THEME_SCOPE_CHAIN_LOW_TO_HIGH
} from "../src/index.js";

test("flattenTokenTree produces dot keys", () => {
  const flat = flattenTokenTree({
    chips: {
      sys: {
        color: {
          primary: "#000"
        }
      }
    }
  });

  assert.equal(flat["chips.sys.color.primary"], "#000");
});

test("createTokenResolver reads and checks keys", () => {
  const resolver = createTokenResolver({
    "chips.sys.color.primary": "#111"
  });

  assert.equal(resolver.get("chips.sys.color.primary"), "#111");
  assert.equal(resolver.has("chips.sys.color.primary"), true);
  assert.throws(() => resolver.get("chips.missing"), /TOKEN_KEY_MISSING/);
});

test("createTamaguiCoreTokens maps chips keys", () => {
  const tokens = createTamaguiCoreTokens({
    chips: {
      comp: {
        button: {
          height: {
            md: "40px"
          }
        }
      }
    }
  });

  assert.equal(tokens["comp_button_height_md"].value, "40px");
});

test("resolveScopedTokenValue follows high-to-low scope chain", () => {
  const resolved = resolveScopedTokenValue(
    "chips.comp.button.color.text",
    {
      global: {
        "chips.comp.button.color.text": "#000000"
      },
      app: {
        "chips.comp.button.color.text": "#111111"
      },
      component: {
        "chips.comp.button.color.text": "#222222"
      }
    },
    {}
  );

  assert.deepEqual(resolved, {
    source: "component",
    value: "#222222"
  });
});

test("createScopedTokenResolver returns fallback token and reports diagnostic once", () => {
  const diagnostics = [];
  const resolver = createScopedTokenResolver({
    scopes: {
      global: {
        chips: {
          sys: {
            color: {
              surface: "#ffffff"
            }
          }
        }
      }
    },
    fallbackTokens: {
      "chips.comp.button.color.text": "#333333"
    },
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });

  assert.equal(resolver.get("chips.comp.button.color.text"), "#333333");
  assert.equal(resolver.get("chips.comp.button.color.text"), "#333333");
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, "THEME_TOKEN_FALLBACK_APPLIED");
});

test("createScopedTokenResolver throws standard code when token missing", () => {
  const resolver = createScopedTokenResolver({
    scopes: {
      global: {
        "chips.sys.color.surface": "#fff"
      }
    }
  });

  assert.throws(
    () => resolver.get("chips.sys.color.missing"),
    (error) => error.code === "THEME_TOKEN_MISSING"
  );
});

test("createScopedTokenResolver resolves by prefix and exposes cache key helper", () => {
  const resolver = createScopedTokenResolver({
    scopes: {
      global: {
        "chips.comp.button.color.bg": "#fff",
        "chips.comp.button.color.text": "#111",
        "chips.comp.input.color.bg": "#eee"
      }
    }
  });

  const componentTokens = resolver.resolveByPrefix("chips.comp.button.");
  assert.deepEqual(componentTokens, {
    "chips.comp.button.color.bg": "#fff",
    "chips.comp.button.color.text": "#111"
  });

  assert.equal(resolver.getCacheKey("chips.default", "1.0.0"), "chips.default:1.0.0");
  assert.equal(createThemeCacheKey("", ""), "default:0");
});

test("theme scope chain constants match ecosystem order", () => {
  assert.deepEqual(THEME_SCOPE_CHAIN_LOW_TO_HIGH, [
    "global",
    "app",
    "box",
    "composite-card",
    "base-card",
    "component"
  ]);

  assert.deepEqual(THEME_SCOPE_CHAIN_HIGH_TO_LOW, [
    "component",
    "base-card",
    "composite-card",
    "box",
    "app",
    "global"
  ]);
});

test("createScopedTokenResolver reports missing token diagnostic once", () => {
  const diagnostics = [];
  const resolver = createScopedTokenResolver({
    scopes: {
      global: {
        "chips.sys.color.surface": "#fff"
      }
    },
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });

  assert.throws(
    () => resolver.get("chips.sys.color.primary"),
    (error) => error.code === "THEME_TOKEN_MISSING"
  );
  assert.throws(
    () => resolver.explain("chips.sys.color.primary"),
    (error) => error.code === "THEME_TOKEN_MISSING"
  );

  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, "THEME_TOKEN_MISSING");
  assert.equal(diagnostics[0].tokenKey, "chips.sys.color.primary");
});
