// @vitest-environment jsdom

import React from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AppPluginGovernanceRecord,
} from "../../src/shared/runtime/settings-runtime-service";
import type { FeedbackItem } from "../../src/shared/ui/NotificationStack";

type EventHandler = (payload?: unknown) => void | Promise<void>;

const eventHandlers = new Map<string, EventHandler[]>();
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let runtimeContextMock = createRuntimeContextMock();
let i18nMock = createI18nMock();
let serviceMock = createServiceMock();

vi.mock("../../src/app/providers/RuntimeProvider", () => ({
  useRuntimeContext() {
    return runtimeContextMock;
  },
}));

vi.mock("../../src/app/providers/I18nProvider", () => ({
  useI18n() {
    return i18nMock;
  },
}));

vi.mock("../../src/shared/runtime/settings-runtime-service", () => ({
  getSettingsRuntimeService() {
    return serviceMock;
  },
}));

function createRuntimeContextMock() {
  return {
    client: {
      events: {
        on: vi.fn((eventName: string, handler: EventHandler) => {
          const handlers = eventHandlers.get(eventName) ?? [];
          handlers.push(handler);
          eventHandlers.set(eventName, handlers);
          return () => {
            const currentHandlers = eventHandlers.get(eventName) ?? [];
            eventHandlers.set(
              eventName,
              currentHandlers.filter((currentHandler) => currentHandler !== handler),
            );
          };
        }),
      },
    },
    eventSource: {
      subscribe() {
        return () => undefined;
      },
    },
    ready: true,
    runtimeError: null,
    refreshRuntimeState: async () => undefined,
  };
}

function createI18nMock() {
  return {
    locale: "zh-CN",
    t(key: string, params?: Record<string, string | number>) {
      if (!params) {
        return key;
      }
      return `${key}:${JSON.stringify(params)}`;
    },
  };
}

function createServiceMock() {
  return {
    listAppPlugins: vi.fn(),
    installAppPlugin: vi.fn(),
    enablePlugin: vi.fn(),
    disablePlugin: vi.fn(),
    uninstallPlugin: vi.fn(),
    openPluginFileDialog: vi.fn(),
    getPathForFile: vi.fn(),
    showConfirm: vi.fn(),
  };
}

function resetHarnessMocks(): void {
  eventHandlers.clear();
  runtimeContextMock = createRuntimeContextMock();
  i18nMock = createI18nMock();
  serviceMock = createServiceMock();
}

async function flushReact(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function emitEvent(eventName: string, payload?: unknown): Promise<void> {
  await React.act(async () => {
    const handlers = [...(eventHandlers.get(eventName) ?? [])];
    for (const handler of handlers) {
      await handler(payload);
    }
    await flushReact();
  });
}

function createRenderer() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  return {
    async render(element: React.ReactElement): Promise<void> {
      await React.act(async () => {
        root.render(element);
        await flushReact();
      });
    },
    unmount(): void {
      React.act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("runtime hooks", () => {
  let renderer: ReturnType<typeof createRenderer> | null = null;

  beforeEach(() => {
    resetHarnessMocks();
  });

  afterEach(() => {
    renderer?.unmount();
    renderer = null;
    vi.clearAllMocks();
  });

  it("keeps host refresh subscriptions stable across rerenders and still calls the latest refresh handler", async () => {
    const { useHostRefresh } = await import("../../src/shared/hooks/useHostRefresh");
    const refreshLabels: string[] = [];

    function Harness({ label }: { label: string }) {
      const refresh = React.useCallback(async () => {
        refreshLabels.push(label);
      }, [label]);

      useHostRefresh(["plugin.installed", "plugin.enabled"], refresh);
      return <div>{label}</div>;
    }

    renderer = createRenderer();
    await renderer.render(<Harness label="first" />);

    expect(runtimeContextMock.client.events.on).toHaveBeenCalledTimes(2);

    await renderer.render(<Harness label="second" />);

    expect(runtimeContextMock.client.events.on).toHaveBeenCalledTimes(2);

    await emitEvent("plugin.installed");

    expect(refreshLabels).toEqual(["second"]);
  });

  it("refreshes app plugin governance state when Host emits plugin.disabled", async () => {
    const { useAppPluginGovernance } = await import("../../src/features/app-plugins/useAppPluginGovernance");
    serviceMock.listAppPlugins
      .mockResolvedValueOnce([
        {
          pluginId: "plugin.example",
          name: "Example Plugin",
          description: "Enabled",
          version: "1.0.0",
          enabled: true,
          selfManaged: false,
          installPath: "/plugins/example",
          installedAt: 1,
          capabilities: ["demo"],
        },
      ])
      .mockResolvedValueOnce([
        {
          pluginId: "plugin.example",
          name: "Example Plugin",
          description: "Disabled",
          version: "1.0.0",
          enabled: false,
          selfManaged: false,
          installPath: "/plugins/example",
          installedAt: 1,
          capabilities: ["demo"],
        },
      ]);

    let latestState: {
      plugins: Array<{ enabled: boolean }>;
    } = {
      plugins: [],
    };

    function Harness() {
      latestState = useAppPluginGovernance();
      return null;
    }

    renderer = createRenderer();
    await renderer.render(<Harness />);

    expect(serviceMock.listAppPlugins).toHaveBeenCalledTimes(1);
    expect(latestState.plugins[0]?.enabled).toBe(true);

    await emitEvent("plugin.disabled", { pluginId: "plugin.example" });

    expect(serviceMock.listAppPlugins).toHaveBeenCalledTimes(2);
    expect(latestState.plugins[0]?.enabled).toBe(false);
  });

  it("blocks self-managed app plugin actions at the hook layer", async () => {
    const { useAppPluginGovernance } = await import("../../src/features/app-plugins/useAppPluginGovernance");

    serviceMock.listAppPlugins.mockResolvedValue([
      {
        pluginId: "com.chips.eco-settings-panel",
        name: "Eco Settings Panel",
        description: "Self managed",
        version: "0.1.0",
        enabled: true,
        selfManaged: true,
        installPath: "/plugins/settings",
        installedAt: 1,
        capabilities: ["settings"],
      },
    ]);

    let latestState: {
      plugins: AppPluginGovernanceRecord[];
      togglePluginEnabled: (plugin: AppPluginGovernanceRecord) => Promise<void>;
      uninstallPlugin: (plugin: AppPluginGovernanceRecord) => Promise<void>;
      feedback: FeedbackItem[];
    } = {
      plugins: [],
      togglePluginEnabled: async () => undefined,
      uninstallPlugin: async () => undefined,
      feedback: [],
    };

    function Harness() {
      latestState = useAppPluginGovernance();
      return null;
    }

    renderer = createRenderer();
    await renderer.render(<Harness />);

    const currentApp = latestState.plugins[0];
    expect(currentApp?.selfManaged).toBe(true);

    await React.act(async () => {
      await latestState.togglePluginEnabled(currentApp);
      await latestState.uninstallPlugin(currentApp);
      await flushReact();
    });

    expect(serviceMock.disablePlugin).not.toHaveBeenCalled();
    expect(serviceMock.enablePlugin).not.toHaveBeenCalled();
    expect(serviceMock.showConfirm).not.toHaveBeenCalled();
    expect(serviceMock.uninstallPlugin).not.toHaveBeenCalled();
    expect(latestState.feedback.map((item) => item.title)).toEqual([
      "settingsPanel.appPlugins.feedback.selfManagedBlockedTitle",
      "settingsPanel.appPlugins.feedback.selfManagedBlockedTitle",
    ]);
  });
});
