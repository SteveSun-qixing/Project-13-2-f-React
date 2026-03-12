import { describe, it, expect } from "vitest";
import { createClient } from "../src/core/client";
import type { StandardError } from "../src/types/errors";

describe("createClient", () => {
  it("uses custom transport when provided", async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];

    const client = createClient({
      environment: "node",
      transport: async (action, payload) => {
        calls.push({ action, payload });
        if (action === "file.read") {
          return { content: "content" };
        }
        throw { code: "SERVICE_NOT_FOUND", message: "not found" };
      },
    });

    const result = await client.file.read("/test.txt");
    expect(result).toBe("content");
    expect(calls[0]?.action).toBe("file.read");
  });

  it("wraps non-standard errors as StandardError", async () => {
    const client = createClient({
      environment: "node",
      transport: async () => {
        throw new Error("boom");
      },
    });

    let captured: StandardError | undefined;
    try {
      await client.file.read("/test.txt");
    } catch (err) {
      captured = err as StandardError;
    }

    expect(captured).toBeDefined();
    expect(captured?.code).toBe("INTERNAL_ERROR");
    expect(captured?.message).toContain("boom");
  });

  it("unwraps file and zip responses", async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];
    const client = createClient({
      environment: "node",
      transport: async (action, payload) => {
        calls.push({ action, payload });
        if (action === "file.stat") {
          return {
            meta: {
              path: "/tmp/demo.txt",
              size: 4,
              isFile: true,
              isDirectory: false,
              mtimeMs: 123,
            },
          };
        }
        if (action === "file.list") {
          return { entries: ["a.txt", "nested"] };
        }
        if (action === "file.exists") {
          return { exists: true };
        }
        if (action === "zip.list") {
          return {
            entries: [{ path: "content/demo.yaml", size: 12, isDirectory: false }],
          };
        }
        return { ack: true };
      },
    });

    await expect(client.file.stat("/tmp/demo.txt")).resolves.toEqual({
      path: "/tmp/demo.txt",
      size: 4,
      isFile: true,
      isDirectory: false,
      mtimeMs: 123,
    });
    await expect(client.file.list("/tmp")).resolves.toEqual(["a.txt", "nested"]);
    await expect(client.file.exists("/tmp/demo.txt")).resolves.toBe(true);
    await expect(client.file.mkdir("/tmp/demo-dir")).resolves.toBeUndefined();
    await expect(client.file.delete("/tmp/demo-dir")).resolves.toBeUndefined();
    await expect(client.file.copy("/tmp/a", "/tmp/b")).resolves.toBeUndefined();
    await expect(client.file.move("/tmp/b", "/tmp/c")).resolves.toBeUndefined();
    await expect(client.zip.compress("/tmp/card", "/tmp/card.zip")).resolves.toBeUndefined();
    await expect(client.zip.extract("/tmp/card.zip", "/tmp/out")).resolves.toBeUndefined();
    await expect(client.zip.list("/tmp/card.zip")).resolves.toEqual([
      { path: "content/demo.yaml", size: 12, isDirectory: false },
    ]);

    expect(calls.map((item) => item.action)).toContain("file.exists");
    expect(calls.map((item) => item.action)).toContain("zip.list");
  });

  it("unwraps i18n responses and preserves theme snapshots", async () => {
    const client = createClient({
      environment: "node",
      transport: async (action) => {
        if (action === "i18n.getCurrent") {
          return { locale: "zh-CN" };
        }
        if (action === "i18n.translate") {
          return { text: "系统已就绪" };
        }
        if (action === "i18n.listLocales") {
          return { locales: ["zh-CN", "en-US"] };
        }
        if (action === "theme.getAllCss") {
          return { css: ":root{--chips-sys-color-surface:#fff;}", themeId: "chips-official.default-theme" };
        }
        throw { code: "SERVICE_NOT_FOUND", message: action };
      },
    });

    await expect(client.i18n.getCurrent()).resolves.toBe("zh-CN");
    await expect(client.i18n.translate("system.ready")).resolves.toBe("系统已就绪");
    await expect(client.i18n.listLocales()).resolves.toEqual(["zh-CN", "en-US"]);
    await expect(client.theme.getAllCss()).resolves.toEqual({
      css: ":root{--chips-sys-color-surface:#fff;}",
      themeId: "chips-official.default-theme",
    });
  });

  it("unwraps plugin metadata responses", async () => {
    const plugin = {
      id: "theme.theme.chips-official-default-theme",
      manifestPath: "/tmp/theme/manifest.yaml",
      installPath: "/tmp/theme",
      enabled: true,
      version: "1.0.0",
      type: "theme",
      name: "薯片官方 · 默认主题",
      description: "default theme",
      capabilities: [],
      theme: {
        themeId: "chips-official.default-theme",
        displayName: "薯片官方 · 默认主题",
        isDefault: true,
      },
    };
    const client = createClient({
      environment: "node",
      transport: async (action) => {
        if (action === "plugin.list") {
          return { plugins: [plugin] };
        }
        if (action === "plugin.get") {
          return { plugin };
        }
        if (action === "plugin.getCardPlugin") {
          return { plugin: undefined };
        }
        if (action === "plugin.getLayoutPlugin") {
          return { plugin: undefined };
        }
        if (action === "plugin.getSelf") {
          return { plugin };
        }
        throw { code: "SERVICE_NOT_FOUND", message: action };
      },
    });

    await expect(client.plugin.list({ type: "theme" })).resolves.toEqual([plugin]);
    await expect(client.plugin.get(plugin.id)).resolves.toEqual(plugin);
    await expect(client.plugin.getSelf()).resolves.toEqual(plugin);
    await expect(client.plugin.getCardPlugin("RichTextCard")).resolves.toBeUndefined();
    await expect(client.plugin.getLayoutPlugin("grid-layout")).resolves.toBeUndefined();
  });

  it("unwraps plugin shortcut and launch responses", async () => {
    const shortcut = {
      pluginId: "app.viewer",
      name: "Card Viewer",
      location: "desktop",
      launcherPath: "/Users/test/Desktop/Card Viewer.lnk",
      executablePath: "/Applications/Chips Host",
      args: ["--chips-launch-plugin=app.viewer"],
      exists: true,
    };
    const launchResult = {
      window: { id: "window-1" },
      session: { sessionId: "session-1", sessionNonce: "nonce-1", permissions: ["plugin.manage"] },
    };
    const client = createClient({
      environment: "node",
      transport: async (action) => {
        if (action === "plugin.getShortcut" || action === "plugin.createShortcut") {
          return { shortcut };
        }
        if (action === "plugin.removeShortcut") {
          return { removed: true, launcherPath: shortcut.launcherPath, location: "desktop" };
        }
        if (action === "plugin.launch") {
          return launchResult;
        }
        throw { code: "SERVICE_NOT_FOUND", message: action };
      },
    });

    await expect(client.plugin.getShortcut("app.viewer")).resolves.toEqual(shortcut);
    await expect(client.plugin.createShortcut("app.viewer")).resolves.toEqual(shortcut);
    await expect(client.plugin.removeShortcut("app.viewer")).resolves.toEqual({
      removed: true,
      launcherPath: shortcut.launcherPath,
      location: "desktop",
    });
    await expect(client.plugin.launch("app.viewer", { trigger: "shortcut" })).resolves.toEqual(launchResult);
  });

  it("unwraps module query/list responses and uses the Host module.mount payload contract", async () => {
    const calls: Array<{ action: string; payload: unknown }> = [];
    const moduleState = {
      slot: "editor.sidebar",
      module: { id: "chips.editor.sidebar", kind: "panel" },
      mountedAt: 123,
    };
    const client = createClient({
      environment: "node",
      transport: async (action, payload) => {
        calls.push({ action, payload });
        if (action === "module.mount" || action === "module.unmount") {
          return { ack: true };
        }
        if (action === "module.query") {
          return { module: moduleState };
        }
        if (action === "module.list") {
          return { modules: [moduleState] };
        }
        throw { code: "SERVICE_NOT_FOUND", message: action };
      },
    });

    await expect(client.module.mount("editor.sidebar", { id: "chips.editor.sidebar", kind: "panel" })).resolves.toBeUndefined();
    await expect(client.module.query("editor.sidebar")).resolves.toEqual(moduleState);
    await expect(client.module.list()).resolves.toEqual([moduleState]);
    await expect(client.module.unmount("editor.sidebar")).resolves.toBeUndefined();

    expect(calls[0]).toEqual({
      action: "module.mount",
      payload: {
        slot: "editor.sidebar",
        module: { id: "chips.editor.sidebar", kind: "panel" },
      },
    });
  });

  it("throws BRIDGE_UNAVAILABLE when no transport and no window.chips", async () => {
    const client = createClient({
      environment: "node",
    });

    let captured: StandardError | undefined;
    try {
      await client.file.read("/test.txt");
    } catch (err) {
      captured = err as StandardError;
    }

    expect(captured).toBeDefined();
    expect(captured?.code).toBe("BRIDGE_UNAVAILABLE");
  });

  it("unwraps Host IPC encoded standard errors from the plugin bridge", async () => {
    const previousWindow = globalThis.window;
    const windowStub = {
      chips: {
        invoke: async () => {
          throw new Error(
            '__chips_ipc_error__:{"code":"ROUTE_TIMEOUT","message":"Route timeout: platform.dialogOpenFile","details":{"timeoutMs":2000},"retryable":true}',
          );
        },
        on: () => () => undefined,
        once: () => undefined,
        emit: async () => undefined,
      },
    } as unknown as Window;

    globalThis.window = windowStub;

    try {
      const client = createClient({ environment: "plugin" });
      let captured: StandardError | undefined;

      try {
        await client.file.read("/test.txt");
      } catch (err) {
        captured = err as StandardError;
      }

      expect(captured).toBeDefined();
      expect(captured?.code).toBe("ROUTE_TIMEOUT");
      expect(captured?.message).toBe("Route timeout: platform.dialogOpenFile");
      expect(captured?.retryable).toBe(true);
    } finally {
      if (previousWindow) {
        globalThis.window = previousWindow;
      } else {
        delete (globalThis as { window?: Window }).window;
      }
    }
  });

  it("reads launch context from the plugin bridge platform helper", () => {
    const previousWindow = globalThis.window;
    globalThis.window = {
      chips: {
        platform: {
          getLaunchContext() {
            return {
              pluginId: "app.viewer",
              sessionId: "session-1",
              launchParams: {
                targetPath: "/tmp/demo.card",
                trigger: "shortcut",
              },
            };
          },
        },
      },
    } as unknown as Window;

    try {
      const client = createClient({
        environment: "plugin",
        transport: async () => {
          throw new Error("transport should not be used");
        },
      });
      expect(client.platform.getLaunchContext()).toEqual({
        pluginId: "app.viewer",
        sessionId: "session-1",
        launchParams: {
          targetPath: "/tmp/demo.card",
          trigger: "shortcut",
        },
      });
    } finally {
      globalThis.window = previousWindow;
    }
  });

  it("reads drag-and-drop file paths from the preload bridge", () => {
    const previousWindow = globalThis.window;
    const windowStub = {
      chips: {
        invoke: async () => undefined,
        on: () => () => undefined,
        once: () => undefined,
        emit: async () => undefined,
        platform: {
          getPathForFile(file: unknown) {
            return file === "theme.cpk" ? "/tmp/theme.cpk" : "";
          },
        },
      },
    } as unknown as Window;

    globalThis.window = windowStub;

    try {
      const client = createClient({ environment: "plugin" });
      expect(client.platform.getPathForFile("theme.cpk")).toBe("/tmp/theme.cpk");
      expect(client.platform.getPathForFile("missing")).toBe("");
    } finally {
      if (previousWindow) {
        globalThis.window = previousWindow;
      } else {
        delete (globalThis as { window?: Window }).window;
      }
    }
  });
});
