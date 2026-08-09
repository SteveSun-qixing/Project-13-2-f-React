import test from "node:test";
import assert from "node:assert/strict";
import React, { act } from "react";
import { JSDOM } from "jsdom";
import { createRoot } from "react-dom/client";
import {
  applyThemeVariablesInBatches,
  applyThemeVariables,
  ChipsEnvironmentProvider,
  ChipsThemeProvider,
  ChipsTokenProvider,
  createBinding,
  createChipsI18nText,
  subscribeThemeChanged,
  useBinding,
  useChipsBinding,
  useChipsAsyncState,
  useChipsClient,
  useChipsCommand,
  useChipsDiagnostics,
  useChipsEnvironment,
  useChipsFormState,
  useChipsI18n,
  useChipsI18nText,
  useChipsPermission,
  useChipsSurface,
  useChipsState,
  useChipsTheme,
  useComponentTokens,
  useFieldBinding,
  useThemeRuntime,
  useToken,
  useTokenResolver
} from "../src/index.js";
import {
  createMockChipsClient,
  createMockPermissionDeniedError
} from "../../testing/src/index.js";

test("hooks package exports expected APIs", () => {
  assert.equal(typeof ChipsTokenProvider, "function");
  assert.equal(typeof ChipsThemeProvider, "function");
  assert.equal(typeof ChipsEnvironmentProvider, "function");
  assert.equal(typeof createChipsI18nText, "function");
  assert.equal(typeof useChipsEnvironment, "function");
  assert.equal(typeof useChipsClient, "function");
  assert.equal(typeof useChipsTheme, "function");
  assert.equal(typeof useChipsI18n, "function");
  assert.equal(typeof useChipsI18nText, "function");
  assert.equal(typeof useChipsSurface, "function");
  assert.equal(typeof useChipsPermission, "function");
  assert.equal(typeof useChipsCommand, "function");
  assert.equal(typeof useChipsDiagnostics, "function");
  assert.equal(typeof useTokenResolver, "function");
  assert.equal(typeof useToken, "function");
  assert.equal(typeof useComponentTokens, "function");
  assert.equal(typeof useThemeRuntime, "function");
  assert.equal(typeof applyThemeVariablesInBatches, "function");
  assert.equal(typeof createBinding, "function");
  assert.equal(typeof useBinding, "function");
  assert.equal(typeof useChipsBinding, "function");
  assert.equal(typeof useChipsState, "function");
  assert.equal(typeof useChipsAsyncState, "function");
  assert.equal(typeof useChipsFormState, "function");
  assert.equal(typeof useFieldBinding, "function");
});

async function renderHook(useHook) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM("<!doctype html><html><body><div id=\"root\"></div></body></html>");
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousHTMLElement = globalThis.HTMLElement;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;

  const result = { current: null };
  function Probe() {
    result.current = useHook();
    return null;
  }

  const root = createRoot(dom.window.document.getElementById("root"));
  await act(async () => {
    root.render(React.createElement(Probe));
  });

  return {
    result,
    async update(callback) {
      await act(async () => {
        await callback(result.current);
      });
    },
    cleanup() {
      act(() => {
        root.unmount();
      });
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.HTMLElement = previousHTMLElement;
      dom.window.close();
    }
  };
}

test("createBinding adapts values to component control props", () => {
  const changes = [];
  const binding = createBinding({
    defaultValue: "draft",
    name: "title",
    onChange(value, event) {
      changes.push({ value, previousValue: event.previousValue, reason: event.reason });
    }
  });

  assert.equal(binding.get(), "draft");
  binding.set("published");
  assert.equal(binding.value, "published");

  const valueProps = binding.valueProps();
  valueProps.onValueChange("final");
  assert.equal(valueProps.value, "published");
  assert.equal(binding.value, "final");

  const inputProps = binding.inputProps();
  inputProps.onChange({ target: { value: "typed" } });
  assert.equal(binding.value, "typed");

  const checkedBinding = createBinding({ defaultValue: false });
  const checkedProps = checkedBinding.checkedProps();
  assert.equal(checkedProps.checked, false);
  checkedProps.onCheckedChange(true);
  assert.equal(checkedBinding.value, true);

  const openBinding = createBinding({ defaultValue: false });
  openBinding.openProps().onOpenChange(true);
  assert.equal(openBinding.value, true);
  assert.deepEqual(changes.map((change) => change.value), ["published", "final", "typed"]);
});

test("useBinding keeps latest value for sequential updater writes", async () => {
  const hook = await renderHook(() => useBinding({ defaultValue: 0 }));

  try {
    await hook.update((binding) => {
      binding.set((value) => value + 1);
      binding.set((value) => value + 1);
    });
    assert.equal(hook.result.current.value, 2);
  } finally {
    hook.cleanup();
  }
});

test("useChipsState exposes local state and binding transitions", async () => {
  const changes = [];
  const hook = await renderHook(() =>
    useChipsState(1, {
      name: "counter",
      onChange(value, event) {
        changes.push({ value, previousValue: event.previousValue });
      }
    })
  );

  try {
    assert.equal(hook.result.current.value, 1);
    await hook.update((state) => state.setValue((value) => value + 1));
    assert.equal(hook.result.current.value, 2);
    await hook.update((state) => state.binding.set(7));
    assert.equal(hook.result.current.value, 7);
    await hook.update((state) => state.reset());
    assert.equal(hook.result.current.value, 1);
    assert.deepEqual(changes.map((change) => change.value), [2, 7, 1]);
  } finally {
    hook.cleanup();
  }
});

test("useChipsAsyncState tracks idle loading success and error", async () => {
  let shouldFail = false;
  const hook = await renderHook(() =>
    useChipsAsyncState(async (value) => {
      if (shouldFail) {
        throw new Error("boom");
      }
      return `ok:${value}`;
    })
  );

  try {
    assert.equal(hook.result.current.status, "idle");
    await hook.update((state) => state.run("first"));
    assert.equal(hook.result.current.status, "success");
    assert.equal(hook.result.current.data, "ok:first");

    shouldFail = true;
    await hook.update(async (state) => {
      await assert.rejects(() => state.run("second"), /boom/);
    });
    assert.equal(hook.result.current.status, "error");
    assert.equal(hook.result.current.error.message, "boom");

    await hook.update((state) => state.reset());
    assert.equal(hook.result.current.status, "idle");
    assert.equal(hook.result.current.error, null);
  } finally {
    hook.cleanup();
  }
});

test("useChipsFormState creates field bindings and tracks dirty error reset state", async () => {
  const hook = await renderHook(() =>
    useChipsFormState({
      title: "Draft",
      settings: {
        enabled: false
      }
    })
  );

  try {
    assert.equal(hook.result.current.dirty, false);
    assert.equal(hook.result.current.valid, true);

    await hook.update((form) => form.getFieldBinding("title").valueProps().onValueChange("Published"));
    assert.equal(hook.result.current.values.title, "Published");
    assert.equal(hook.result.current.getFieldTouched("title"), true);
    assert.equal(hook.result.current.dirty, true);

    await hook.update((form) => form.getFieldBinding("settings.enabled").checkedProps().onCheckedChange(true));
    assert.equal(hook.result.current.values.settings.enabled, true);

    await hook.update((form) => {
      form.setFieldValue("title", (value) => `${value}!`);
      form.setFieldValue("title", (value) => `${value}!`);
    });
    assert.equal(hook.result.current.values.title, "Published!!");

    await hook.update((form) => form.setFieldError("title", "Title is required"));
    assert.equal(hook.result.current.getFieldMeta("title").invalid, true);
    assert.equal(hook.result.current.valid, false);

    await hook.update((form) => form.reset());
    assert.equal(hook.result.current.values.title, "Draft");
    assert.equal(hook.result.current.values.settings.enabled, false);
    assert.equal(hook.result.current.dirty, false);
    assert.equal(hook.result.current.valid, true);
  } finally {
    hook.cleanup();
  }
});

test("subscribeThemeChanged supports on/off event source", () => {
  const listeners = new Map();
  const payloads = [];
  const source = {
    on(name, handler) {
      listeners.set(name, handler);
    },
    off(name) {
      listeners.delete(name);
    }
  };

  const unsubscribe = subscribeThemeChanged(source, "theme.changed", (payload) => {
    payloads.push(payload);
  });

  listeners.get("theme.changed")({ themeId: "chips.dark" });
  assert.equal(payloads.length, 1);
  unsubscribe();
  assert.equal(listeners.has("theme.changed"), false);
});

test("applyThemeVariables writes css custom properties", () => {
  const records = [];
  const target = {
    style: {
      setProperty(name, value) {
        records.push({ name, value });
      }
    }
  };

  applyThemeVariables(target, {
    "chips.sys.color.surface": "#fff",
    "chips.comp.button.height.md": "40px"
  });

  assert.deepEqual(records, [
    { name: "--chips-sys-color-surface", value: "#fff" },
    { name: "--chips-comp-button-height-md", value: "40px" }
  ]);
});

test("applyThemeVariables throws when target is invalid", () => {
  assert.throws(
    () => applyThemeVariables({}, { "chips.sys.color.surface": "#fff" }),
    /THEME_VARIABLE_TARGET_INVALID/
  );
});

test("createChipsI18nText resolves nested keys, fallbacks and params synchronously", () => {
  const text = createChipsI18nText({
    locale: "zh-CN",
    fallbackLocale: "en-US",
    bundles: {
      "zh-CN": {
        demo: {
          greeting: "你好，{name}"
        }
      },
      "en-US": {
        demo: {
          greeting: "Hello, {name}",
          fallback: "Fallback {value}"
        }
      }
    }
  });

  assert.equal(text("demo.greeting", { name: "薯片" }), "你好，薯片");
  assert.equal(text("demo.fallback", { value: 7 }), "Fallback 7");
  assert.equal(text("demo.missing", undefined, "Missing {key}"), "Missing {key}");
  assert.equal(text("demo.unknown"), "demo.unknown");
});

test("createChipsI18nText applies fallback locale order and missing text", () => {
  const text = createChipsI18nText({
    locale: "fr-FR",
    fallbackLocales: ["ja-JP", "en-US"],
    fallbackLocale: "zh-CN",
    missingText: (key, context) => `${context.locale}:${key}`,
    bundles: {
      "ja-JP": {
        demo: {
          ordered: "日本語"
        }
      },
      "en-US": {
        demo: {
          ordered: "English"
        }
      }
    }
  });

  assert.equal(text("demo.ordered"), "日本語");
  assert.equal(text("demo.missing"), "fr-FR:demo.missing");
});

test("mock chips client exposes theme, i18n, surface and translation state for environment hooks", async () => {
  const client = createMockChipsClient({
    permissions: ["theme.read", "i18n.read"],
    translations: {
      "demo.save": "保存"
    }
  });

  assert.equal((await client.theme.getCurrent()).themeId, "chips-official.default-theme");
  assert.equal(await client.i18n.getCurrent(), "zh-CN");
  assert.equal(await client.i18n.translate("demo.save"), "保存");
  assert.equal(client.platform.getLaunchContext().surfaceContext.surfaceId, "test-surface");
  assert.equal(client.platform.getLaunchContext().surfaceContext.permissions.includes("theme.read"), true);
});

test("mock chips client emits theme and language changes through SDK-like events", async () => {
  const client = createMockChipsClient();
  const events = [];
  client.theme.onChanged((payload) => events.push(["theme", payload.themeId]));
  client.i18n.onChanged((payload) => events.push(["language", payload.locale]));

  await client.theme.apply("chips-official.default-dark-theme");
  await client.i18n.setCurrent("en-US");

  assert.deepEqual(events, [
    ["theme", "chips-official.default-dark-theme"],
    ["language", "en-US"]
  ]);
});

test("mock chips client preserves permission diagnostics for hook tests", async () => {
  const permissionError = createMockPermissionDeniedError("theme.getCurrent", "theme.read");
  const client = createMockChipsClient({ failTheme: permissionError });

  await assert.rejects(() => client.theme.getCurrent(), (error) => {
    assert.equal(error.code, "PERMISSION_DENIED");
    assert.deepEqual(error.permission.required, ["theme.read"]);
    return true;
  });
});

test("mock chips client exposes Host-like calls, command events and injected faults", async () => {
  const client = createMockChipsClient();
  const events = [];
  client.command.onRegistered((payload) => events.push(["registered", payload.commandId]));
  client.command.onInvoked((payload) => events.push(["invoked", payload.commandId]));

  await client.command.register({
    commandId: "chips.demo.save",
    titleKey: "demo.commands.save.title",
    handlerId: "save"
  });
  await client.command.invoke("chips.demo.save", { source: "test" }, { source: "toolbar" });

  assert.deepEqual(events, [
    ["registered", "chips.demo.save"],
    ["invoked", "chips.demo.save"]
  ]);
  assert.deepEqual(client.calls.map((call) => call.action), [
    "command.register",
    "command.invoke"
  ]);

  client.setPermissionDenied("control-plane.diagnose", "control.write", ["control.read"]);
  await assert.rejects(() => client.controlPlane.diagnose(), (error) => {
    assert.equal(error.code, "PERMISSION_DENIED");
    assert.deepEqual(error.permission.granted, ["control.read"]);
    return true;
  });
});

test("applyThemeVariablesInBatches applies variables with chunk diagnostics", async () => {
  const records = [];
  const diagnostics = [];
  const chunks = [];
  const target = {
    style: {
      setProperty(name, value) {
        records.push({ name, value });
      }
    }
  };

  const result = await applyThemeVariablesInBatches(
    target,
    {
      "chips.a": 1,
      "chips.b": 2,
      "chips.c": 3
    },
    {
      chunkSize: 2,
      scheduler: () => Promise.resolve(),
      onDiagnostic(event) {
        diagnostics.push(event);
      },
      onChunkApplied(event) {
        chunks.push(event);
      }
    }
  );

  assert.equal(result.appliedCount, 3);
  assert.equal(result.chunkCount, 2);
  assert.equal(records.length, 3);
  assert.equal(diagnostics.length, 2);
  assert.equal(chunks.length, 2);
});

test("applyThemeVariablesInBatches throws on abort", async () => {
  const target = {
    style: {
      setProperty() {}
    }
  };

  const signal = { aborted: true };
  await assert.rejects(
    () =>
      applyThemeVariablesInBatches(
        target,
        {
          "chips.a": 1
        },
        {
          signal
        }
      ),
    (error) => error.code === "THEME_VARIABLE_APPLY_ABORTED"
  );
});
