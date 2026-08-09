import test from "node:test";
import assert from "node:assert/strict";
import { createScopedTokenResolver } from "@chips/tamagui-core-adapter";
import { subscribeThemeChanged } from "@chips/hooks";
import { injectFault } from "@chips/testing";
import { resolveConfigValue, resolveI18nText } from "../src/index.js";

test("fault injection token missing triggers standard missing error", () => {
  const fault = injectFault("token-missing", {
    key: "chips.comp.button.root.surface.active"
  });
  const resolver = createScopedTokenResolver({
    scopes: {
      global: {
        "chips.sys.color.surface": "#fff"
      }
    }
  });

  assert.throws(
    () => resolver.get(fault.payload.key),
    (error) => error.code === "THEME_TOKEN_MISSING"
  );
});

test("fault injection theme scope invalid falls back to valid scope", () => {
  const fault = injectFault("theme-parse-failed", {
    component: "broken-scope"
  });
  const resolver = createScopedTokenResolver({
    scopes: {
      global: {
        "chips.sys.color.surface": "#fff"
      },
      component: fault.payload.component
    }
  });

  assert.equal(resolver.get("chips.sys.color.surface"), "#fff");
});

test("fault injection config source exception falls back to default", () => {
  const fault = injectFault("config-source-exception", {
    key: "systemUx.toast.maxStack"
  });
  const diagnostics = [];

  const resolved = resolveConfigValue({
    configSource() {
      throw new Error("config failed");
    },
    key: fault.payload.key,
    defaultValue: 3,
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });

  assert.equal(resolved, 3);
  assert.equal(diagnostics[0].code, "SYSTEM_UX_CONFIG_SOURCE_ERROR");
});

test("fault injection i18n adapter exception falls back to template", () => {
  const fault = injectFault("i18n-adapter-exception", {
    key: "systemUx.toast.close"
  });
  const diagnostics = [];

  const resolved = resolveI18nText({
    i18n: {
      translate() {
        throw new Error("i18n failed");
      }
    },
    key: fault.payload.key,
    fallback: "[[systemUx.toast.close]]",
    onDiagnostic(event) {
      diagnostics.push(event);
    }
  });

  assert.equal(resolved, "[[systemUx.toast.close]]");
  assert.ok(diagnostics.some((event) => event.code === "SYSTEM_UX_I18N_ADAPTER_ERROR"));
});

test("fault injection event source anomaly keeps subscribe call safe", () => {
  const fault = injectFault("event-anomaly", {
    source: {
      on() {
        throw new Error("event source failed");
      },
      off() {}
    }
  });

  assert.throws(
    () =>
      subscribeThemeChanged(fault.payload.source, "theme.changed", () => {}),
    /event source failed/
  );

  const safeUnsubscribe = subscribeThemeChanged(null, "theme.changed", () => {});
  assert.equal(typeof safeUnsubscribe, "function");
});
