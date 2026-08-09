// @vitest-environment jsdom
import { App, ConfigProvider } from "antd";
import { describe, expect, it, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { AppChrome, type AppChromeToolbarItem } from "../src/components/AppChrome";
import type { MenuBarGroup } from "../src/components/MenuBar";
import { CommandProvider } from "../src/runtime/commands";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const menus: MenuBarGroup[] = [
  {
    menuId: "file",
    label: "文件",
    commands: [{ id: "open", title: "打开", shortcut: "Mod+O", run: () => {} }],
  },
];

const toolbarItems: AppChromeToolbarItem[] = [
  { id: "open", title: "打开", icon: <span>↗</span>, run: () => {} },
];

function renderChrome(ui: ReactNode): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <ConfigProvider>
        <App>
          <CommandProvider>{ui}</CommandProvider>
        </App>
      </ConfigProvider>,
    );
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("AppChrome tone", () => {  it("默认 light：浅色毛玻璃菜单栏与工具栏、深色文字", () => {
    const { container, unmount } = renderChrome(
      <AppChrome appName="测试应用" menus={menus} toolbarItems={toolbarItems}>
        <div>内容</div>
      </AppChrome>,
    );
    const menuBar = container.querySelector<HTMLElement>(".chips-menu-bar");
    const toolbar = container.querySelector<HTMLElement>(".chips-toolbar");
    const button = toolbar?.querySelector("button");

    expect(menuBar).not.toBeNull();
    expect(menuBar?.style.background).toBe("rgba(245, 245, 247, 0.78)");
    expect(menuBar?.style.borderBottomColor).toBe("rgba(0, 0, 0, 0.06)");
    expect(toolbar).not.toBeNull();
    expect(toolbar?.style.background).toBe("rgba(245, 245, 247, 0.9)");
    expect(button?.style.color).toBe("rgb(29, 29, 31)");
    unmount();
  });

  it("tone=dark-glass：深色毛玻璃菜单栏与工具栏、白色系文字", () => {
    const { container, unmount } = renderChrome(
      <AppChrome appName="测试应用" menus={menus} toolbarItems={toolbarItems} tone="dark-glass">
        <div>内容</div>
      </AppChrome>,
    );
    const menuBar = container.querySelector<HTMLElement>(".chips-menu-bar");
    const toolbar = container.querySelector<HTMLElement>(".chips-toolbar");
    const button = toolbar?.querySelector("button");

    expect(menuBar?.style.background).toBe("rgba(28, 28, 30, 0.55)");
    expect(menuBar?.style.borderBottomColor).toBe("rgba(255, 255, 255, 0.1)");
    expect(toolbar?.style.background).toBe("rgba(28, 28, 30, 0.9)");
    expect(toolbar?.style.borderBottomColor).toBe("rgba(255, 255, 255, 0.1)");
    expect(button?.style.color).toBe("rgba(255, 255, 255, 0.9)");
    unmount();
  });

  it("tone=dark-glass 下 disabled 按钮为暗化文字且无 hover 圆底", () => {
    const disabledItems: AppChromeToolbarItem[] = [
      { id: "save", title: "保存", enabled: false, run: () => {} },
    ];
    const { container, unmount } = renderChrome(
      <AppChrome appName="测试应用" toolbarItems={disabledItems} tone="dark-glass">
        <div>内容</div>
      </AppChrome>,
    );
    const button = container.querySelector<HTMLButtonElement>(".chips-toolbar button");

    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(true);
    expect(button?.style.color).toBe("rgba(255, 255, 255, 0.28)");
    expect(button?.style.background).toBe("transparent");
    unmount();
  });
});

describe("AppChrome immersive", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("immersive 默认关闭：渲染结构与现状一致（无浮动容器、内容区无额外 class）", () => {
    const { container, unmount } = renderChrome(
      <AppChrome appName="测试应用" menus={menus} toolbarItems={toolbarItems}>
        <div>内容</div>
      </AppChrome>,
    );
    const chrome = container.querySelector<HTMLElement>(".chips-app-chrome");
    const childClasses = Array.from(chrome?.children ?? []).map((element) => element.className);

    expect(childClasses).toEqual(["chips-menu-bar apple-titlebar", "chips-toolbar", "chips-app-chrome__content"]);
    expect(container.querySelector(".chips-app-chrome__top")).toBeNull();
    const content = container.querySelector<HTMLElement>(".chips-app-chrome__content");
    expect(content?.className).toBe("chips-app-chrome__content");
    unmount();
  });

  it("immersive 开启：顶部容器初始 translateY(-100%)，内容区附加沉浸 class", () => {
    const { container, unmount } = renderChrome(
      <AppChrome
        appName="测试应用"
        menus={menus}
        toolbarItems={toolbarItems}
        immersive
        immersiveContentClass="pv-dark-canvas"
      >
        <div>内容</div>
      </AppChrome>,
    );
    const top = container.querySelector<HTMLElement>(".chips-app-chrome__top");

    expect(top).not.toBeNull();
    expect(top?.style.position).toBe("absolute");
    expect(top?.style.transform).toBe("translateY(-100%)");
    expect(top?.style.transition).toBe("transform 0.25s ease");
    const content = container.querySelector<HTMLElement>(".chips-app-chrome__content");
    expect(content?.className).toBe("chips-app-chrome__content pv-dark-canvas");
    unmount();
  });

  it("immersive 下 Esc 可双向切换工具栏显隐", () => {
    const { container, unmount } = renderChrome(
      <AppChrome appName="测试应用" menus={menus} toolbarItems={toolbarItems} immersive>
        <div>内容</div>
      </AppChrome>,
    );
    const top = container.querySelector<HTMLElement>(".chips-app-chrome__top");

    expect(top?.style.transform).toBe("translateY(-100%)");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(top?.style.transform).toBe("translateY(0)");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(top?.style.transform).toBe("translateY(-100%)");
    unmount();
  });

  it("immersive 下任意鼠标移动浮现，2.5s 无移动后自动隐藏", () => {
    vi.useFakeTimers();
    const { container, unmount } = renderChrome(
      <AppChrome appName="测试应用" menus={menus} toolbarItems={toolbarItems} immersive>
        <div>内容</div>
      </AppChrome>,
    );
    const top = container.querySelector<HTMLElement>(".chips-app-chrome__top");

    expect(top?.style.transform).toBe("translateY(-100%)");
    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientY: 200 }));
    });
    expect(top?.style.transform).toBe("translateY(0)");
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(top?.style.transform).toBe("translateY(-100%)");
    unmount();
  });

  it("immersive 下鼠标移入顶部热区浮现且悬停期间不自动隐藏", () => {
    vi.useFakeTimers();
    const { container, unmount } = renderChrome(
      <AppChrome appName="测试应用" menus={menus} toolbarItems={toolbarItems} immersive>
        <div>内容</div>
      </AppChrome>,
    );
    const top = container.querySelector<HTMLElement>(".chips-app-chrome__top");
    if (!top) {
      throw new Error("顶部容器未渲染");
    }

    act(() => {
      window.dispatchEvent(new MouseEvent("mousemove", { clientY: 8 }));
    });
    expect(top.style.transform).toBe("translateY(0)");
    act(() => {
      top.dispatchEvent(new MouseEvent("mouseenter"));
      vi.advanceTimersByTime(2500);
    });
    expect(top.style.transform).toBe("translateY(0)");
    unmount();
  });
});
