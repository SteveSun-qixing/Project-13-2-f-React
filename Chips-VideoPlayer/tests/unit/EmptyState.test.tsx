// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { EmptyState } from "../../src/components/EmptyState";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderUi(ui: ReactNode): { container: HTMLElement; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
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

describe("EmptyState（空态升级）", () => {
  it("渲染毛玻璃图标底座、主标题、格式提示与打开按钮", () => {
    const { container, unmount } = renderUi(<EmptyState onOpen={() => {}} />);
    expect(container.querySelector(".video-player-empty__icon-wrap")).not.toBeNull();
    expect(container.querySelector(".video-player-empty__icon-wrap .video-player-empty__icon")).not.toBeNull();
    expect(container.querySelector(".video-player-empty__title")?.textContent).toBe("将视频拖到这里，或点击选择文件");
    expect(container.querySelector(".video-player-empty__hint")?.textContent).toBe("MP4 · WebM · MOV · M4V");
    expect(container.querySelector(".video-player-empty__open")?.textContent).toBe("选择视频…");
    unmount();
  });

  it("点击打开按钮触发 onOpen", () => {
    const onOpen = vi.fn();
    const { container, unmount } = renderUi(<EmptyState onOpen={onOpen} />);
    const open = container.querySelector(".video-player-empty__open") as Element;
    act(() => {
      open.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("拖拽激活时切换为松开提示并放大图标底座", () => {
    const { container, unmount } = renderUi(<EmptyState onOpen={() => {}} dragActive />);
    expect(container.querySelector(".video-player-empty__title")?.textContent).toBe("松开以打开");
    const wrap = container.querySelector(".video-player-empty__icon-wrap");
    expect(wrap?.classList.contains("video-player-empty__icon-wrap--drag-active")).toBe(true);
    expect(wrap?.closest(".video-player-empty")?.getAttribute("aria-hidden")).toBe("true");
    unmount();
  });

  it("自定义文案时优先展示", () => {
    const { container, unmount } = renderUi(
      <EmptyState
        onOpen={() => {}}
        titleText="将视频拖拽至此"
        hintText="MP4 · WebM"
        openLabel="浏览…"
        dragPrompt="放开放开"
      />,
    );
    expect(container.querySelector(".video-player-empty__title")?.textContent).toBe("将视频拖拽至此");
    expect(container.querySelector(".video-player-empty__hint")?.textContent).toBe("MP4 · WebM");
    expect(container.querySelector(".video-player-empty__open")?.textContent).toBe("浏览…");
    unmount();
  });
});
