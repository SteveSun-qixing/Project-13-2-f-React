import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import type { PlatformLaunchContext } from "chips-sdk";
import { App } from "../../src/App";
import { AppRoot } from "../../src/app/AppRoot";
import {
  createRuntimeDiagnostic,
  resolveRuntimeSceneId,
} from "../../src/app/AppRuntimeProvider";
import { sceneDefinitions } from "../../src/app/scene-registry";
import { formatMessage } from "../../src/lib/messages";
import {
  createAppMockClient,
  type CreateAppMockClientOptions,
} from "../../src/testing/mock-environment";
import { renderWithAntd } from "../../src/testing/render-with-antd";

/**
 * jsdom 不提供 window.matchMedia，而 antd 响应式布局（Descriptions 等）
 * 在挂载阶段就会读取它，这里补充最小 polyfill 以支撑应用级冒烟渲染。
 */
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

/**
 * AppRoot 直接持有 `src/runtime/chips-client.ts` 导出的单例客户端，
 * 该单例在模块导入阶段就按当时的环境探测结果固定了传输适配器，
 * 测试环境中无法再绑定 mock Bridge。这里把该模块替换为可按用例
 * 换入的 mock client，使应用骨架按正式链路消费 chips-sdk mock 能力。
 */
const mockChipsClientHolder = vi.hoisted(() => ({
  current: null as unknown,
}));

vi.mock("../../src/runtime/chips-client", () => ({
  get chipsClient() {
    if (!mockChipsClientHolder.current) {
      throw new Error("应用冒烟测试尚未初始化 mock client。");
    }
    return mockChipsClientHolder.current;
  },
}));

/**
 * jsdom 未安装 canvas 包，Konva 舞台在创建 2D 上下文时会抛出
 * "Cannot read properties of null"。应用冒烟测试只验证场景骨架与
 * 数据链路，不验证 Konva 逐像素绘制，因此将 react-konva 节点替换为
 * 保留组件形态的占位元素。
 */
vi.mock("react-konva", async () => {
  const React = await import("react");
  const createKonvaStub = (nodeName: string) => {
    const KonvaStub = React.forwardRef(function KonvaStub(props, ref) {
      return React.createElement("div", {
        ref,
        "data-konva-node": nodeName,
      });
    });
    KonvaStub.displayName = `KonvaStub(${nodeName})`;
    return KonvaStub;
  };
  return {
    Stage: createKonvaStub("Stage"),
    Layer: createKonvaStub("Layer"),
    Rect: createKonvaStub("Rect"),
    Group: createKonvaStub("Group"),
    Line: createKonvaStub("Line"),
    Path: createKonvaStub("Path"),
    Text: createKonvaStub("Text"),
    Image: createKonvaStub("Image"),
    Arc: createKonvaStub("Arc"),
  };
});

describe("App (标准应用插件根组件)", () => {
  it("应当导出一个可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
    expect(App).toBe(AppRoot);
  });

  it("应通过本地中文文案表解析文案与参数插值", () => {
    expect(formatMessage("app.identity.displayName")).toBe("Chips Office");
    expect(formatMessage("app.commands.openWorkspace.title")).toBe("打开工作区");
    expect(formatMessage("app.runtime.dialog.sceneId", { value: "main" })).toBe("场景：main");
    expect(formatMessage("app.missing.key")).toBe("app.missing.key");
  });

  it("应提供场景注册表与 Host mock 渲染外壳", () => {
    expect(sceneDefinitions.map((scene) => scene.id)).toEqual(["main", "word-editor", "document", "slide", "sheet", "settings"]);
    expect(sceneDefinitions[0]?.title).toBe("工作区");

    const client = createAppMockClient();
    expect(client.state.launchContext.sceneId).toBe("main");
    expect(client.state.permissions).toContain("command.invoke");
    client.restoreBridge();

    const rendered = renderWithAntd(<App />);
    expect(rendered.element).toBeTruthy();
    expect(rendered.client.state.launchContext.surfaceContext?.sceneId).toBe("main");
    rendered.client.restoreBridge();
  });

  it("应从 launch context 解析运行时场景和诊断对象", () => {
    const client = createAppMockClient();
    expect(
      resolveRuntimeSceneId(
        client.state.launchContext as unknown as PlatformLaunchContext,
      ),
    ).toBe("main");

    const diagnostic = createRuntimeDiagnostic(
      "APP_RUNTIME_TEST",
      "运行时测试诊断。",
      "test",
      { sceneId: "main" },
    );
    expect(diagnostic).toMatchObject({
      code: "APP_RUNTIME_TEST",
      source: "test",
      details: { sceneId: "main" },
    });
    client.restoreBridge();
  });
});

describe("应用场景逐个渲染冒烟", () => {
  /** 场景切换顺序与 AppShell sceneOptions 的 Segmented 选项顺序一致。 */
  const SCENE_SWITCH_ORDER = [
    "main",
    "word-editor",
    "document",
    "slide",
    "sheet",
    "settings",
  ] as const;

  type SceneId = (typeof SCENE_SWITCH_ORDER)[number];

  type AppSmokeClient = ReturnType<typeof createAppMockClient>;

  function renderAppWithMock(options: CreateAppMockClientOptions = {}) {
    const client = createAppMockClient(options);
    mockChipsClientHolder.current = client;
    const utils = render(<App />);
    return { client, utils };
  }

  async function switchScene(
    container: HTMLElement,
    sceneId: SceneId,
  ): Promise<void> {
    const inputs = container.querySelectorAll<HTMLInputElement>(
      ".ant-segmented-item-input",
    );
    expect(
      inputs.length,
      "场景切换控件应提供与 AppShell sceneOptions 等量的选项",
    ).toBe(SCENE_SWITCH_ORDER.length);
    const index = SCENE_SWITCH_ORDER.indexOf(sceneId);
    expect(index, `场景 ${sceneId} 应在场景切换控件中存在`).toBeGreaterThan(-1);
    fireEvent.click(inputs[index]);
    await waitFor(
      () => {
        expect(
          container.querySelector(".ant-segmented-item-selected .ant-segmented-item-label")
            ?.getAttribute("title"),
        ).toBeDefined();
      },
      { timeout: 3000 },
    );
  }

  afterEach(() => {
    cleanup();
    const client = mockChipsClientHolder.current as AppSmokeClient | null;
    client?.restoreBridge();
    mockChipsClientHolder.current = null;
  });

  it("主场景应渲染工作区骨架与四类文档入口", async () => {
    const { utils } = renderAppWithMock();

    expect(await utils.findByText("运行概览")).toBeTruthy();
    expect(utils.container.querySelector(".app-shell__workspace")).not.toBeNull();
    expect(
      utils.container.querySelector('.ant-segmented[role="radiogroup"]'),
    ).not.toBeNull();
    expect(
      utils.container.querySelector(".app-shell__scene-list"),
    ).not.toBeNull();

    for (const entryTitle of ["Word 文档", "PowerPoint 演示", "Excel 表格", "PDF 查看器"]) {
      expect(utils.getByText(entryTitle), `主场景应提供「${entryTitle}」入口`).toBeTruthy();
    }
  });

  it("word 场景应渲染编辑工具栏与页面画布骨架", async () => {
    const { utils } = renderAppWithMock();
    await utils.findByText("运行概览");
    await switchScene(utils.container, "word-editor");

    await waitFor(
      () => {
        expect(utils.container.querySelector(".word-editor")).not.toBeNull();
      },
      { timeout: 3000 },
    );
    expect(utils.container.querySelector('.word-toolbar[role="toolbar"]')).not.toBeNull();
    expect(utils.container.querySelector(".word-canvas")).not.toBeNull();
    expect(utils.container.querySelector(".word-canvas__container")).not.toBeNull();
    expect(utils.container.querySelector(".word-canvas__background")).not.toBeNull();
    expect(
      utils.container.querySelector(".word-canvas__empty"),
      "空文档应渲染页面画布的空状态节点",
    ).not.toBeNull();
    expect(utils.container.querySelector(".word-editor__statusbar")).not.toBeNull();
  });

  it("document 场景应渲染 PDF 查看区骨架", async () => {
    const { utils } = renderAppWithMock();
    await utils.findByText("运行概览");
    await switchScene(utils.container, "document");

    expect(await utils.findByText("未打开文档", {}, { timeout: 5000 })).toBeTruthy();
    expect(utils.container.querySelector(".pdf-viewer--idle")).not.toBeNull();
    expect(utils.getByText("打开 PDF 文件")).toBeTruthy();
  });

  it("slide 场景应渲染编辑器舞台与状态栏骨架", async () => {
    const { utils } = renderAppWithMock();
    await utils.findByText("运行概览");
    await switchScene(utils.container, "slide");

    expect(await utils.findByText("无幻灯片", {}, { timeout: 5000 })).toBeTruthy();
    expect(utils.getByText("未修改")).toBeTruthy();
    expect(utils.container.querySelector(".ant-layout")).not.toBeNull();
  });

  it("sheet 场景应能新建工作簿并渲染网格骨架", async () => {
    const { utils } = renderAppWithMock();
    await utils.findByText("运行概览");
    await switchScene(utils.container, "sheet");

    expect(await utils.findByText("表格编辑器", {}, { timeout: 5000 })).toBeTruthy();
    fireEvent.click(utils.getByText("新建工作簿"));

    await waitFor(
      () => {
        expect(
          utils.container.querySelector('.sheet-editor[role="application"]'),
        ).not.toBeNull();
      },
      { timeout: 3000 },
    );
    expect(utils.container.querySelector(".sheet-editor__grid-container")).not.toBeNull();
    expect(utils.container.querySelector(".sheet-grid")).not.toBeNull();
    expect(utils.container.querySelector(".sheet-formula-bar")).not.toBeNull();
    expect(
      utils.container.querySelector('.sheet-tabs[role="tablist"]'),
    ).not.toBeNull();
    expect(utils.container.querySelector('.sheet-toolbar[role="toolbar"]')).not.toBeNull();
  });

  it("settings 场景应渲染环境状态与运行时诊断骨架", async () => {
    const { utils } = renderAppWithMock();
    await utils.findByText("运行概览");
    await switchScene(utils.container, "settings");

    expect(await utils.findByText("Host 环境", {}, { timeout: 5000 })).toBeTruthy();
    expect(utils.getByText("运行时诊断")).toBeTruthy();
  });

  it("slide 场景应通过 file.session 会话加载启动参数指定的演示文稿", async () => {
    const { createBlankPptx } = await import("../../src/engine/pptx-engine/src/index");
    const pptxBytes = await createBlankPptx();

    const { client, utils } = renderAppWithMock({
      launchParams: { resourceOpen: "/workspace/documents/演示文稿.pptx" },
      fileSession: { bytes: pptxBytes },
    });
    await utils.findByText("运行概览");
    await switchScene(utils.container, "slide");

    expect(
      await utils.findByText("第 1 页，共 1 页", {}, { timeout: 8000 }),
    ).toBeTruthy();
    expect(utils.container.querySelector(".ant-layout")).not.toBeNull();
    expect(
      utils.container.querySelector('[data-konva-node="Stage"]'),
      "载入幻灯片后应挂载舞台组件",
    ).not.toBeNull();

    const invokedActions = client.calls.map((call) => call.action);
    expect(invokedActions).toContain("file.session.open");
    expect(invokedActions).toContain("file.session.read");
  });
});
