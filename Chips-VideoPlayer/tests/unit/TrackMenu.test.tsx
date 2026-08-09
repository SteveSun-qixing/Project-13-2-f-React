// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { TrackMenu, type TrackMenuOption } from "../../src/components/TrackMenu";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderUi(
  ui: ReactNode,
): { container: HTMLElement; rerender: (next: ReactNode) => void; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return {
    container,
    rerender: (next: ReactNode) => {
      act(() => {
        root.render(next);
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const options: TrackMenuOption[] = [
  { key: "1", label: "1x", selected: false },
  { key: "1.25", label: "1.25x", selected: true },
  { key: "custom", label: "自定义", hint: "0.5x - 2x", selected: false },
];

describe("TrackMenu（dock 浮层菜单）", () => {
  it("渲染标题、全部选项与提示文本", () => {
    const { container, unmount } = renderUi(
      <TrackMenu title="倍速" options={options} onSelect={() => {}} onClose={() => {}} />,
    );
    const root = container.querySelector(".video-player-track-menu");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("role")).toBe("menu");
    expect(root?.getAttribute("aria-label")).toBe("倍速");
    expect(container.querySelector(".video-player-track-menu__title")?.textContent).toBe("倍速");

    const items = container.querySelectorAll(".video-player-track-menu__item");
    expect(items.length).toBe(3);
    expect(items[0]?.textContent).toContain("1x");
    expect(items[2]?.textContent).toContain("自定义");
    expect(items[2]?.textContent).toContain("0.5x - 2x");
    unmount();
  });

  it("选中项带 --selected 类、aria-checked 与 ✓ 图标", () => {
    const { container, unmount } = renderUi(
      <TrackMenu title="倍速" options={options} onSelect={() => {}} onClose={() => {}} />,
    );
    const items = container.querySelectorAll<HTMLElement>(".video-player-track-menu__item");
    const selected = items[1];
    expect(selected).toBeDefined();
    expect(selected?.classList.contains("video-player-track-menu__item--selected")).toBe(true);
    expect(selected?.getAttribute("aria-checked")).toBe("true");
    expect(selected?.querySelector(".anticon-check")).not.toBeNull();
    expect(items[0]?.classList.contains("video-player-track-menu__item--selected")).toBe(false);
    expect(items[0]?.getAttribute("aria-checked")).toBe("false");
    unmount();
  });

  it("点击选项触发 onSelect(key)，随后自动 onClose", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { container, unmount } = renderUi(
      <TrackMenu title="倍速" options={options} onSelect={onSelect} onClose={onClose} />,
    );
    const items = container.querySelectorAll<HTMLElement>(".video-player-track-menu__item");
    act(() => {
      items[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("custom");
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("Esc 键关闭菜单", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { unmount } = renderUi(
      <TrackMenu title="倍速" options={options} onSelect={onSelect} onClose={onClose} />,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
    unmount();
  });

  it("点击浮层外部触发 onClose，点击浮层内部不触发", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    const { container, unmount } = renderUi(
      <TrackMenu title="倍速" options={options} onSelect={onSelect} onClose={onClose} />,
    );
    const root = container.querySelector(".video-player-track-menu") as Element;

    act(() => {
      root.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("onClose 变化时监听器同步更新（无残留重复触发）", () => {
    const onClose = vi.fn();
    const { rerender, unmount } = renderUi(
      <TrackMenu title="倍速" options={options} onSelect={() => {}} onClose={onClose} />,
    );
    const nextOnClose = vi.fn();
    rerender(<TrackMenu title="倍速" options={options} onSelect={() => {}} onClose={nextOnClose} />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(nextOnClose).toHaveBeenCalledTimes(1);
    unmount();
  });
});
