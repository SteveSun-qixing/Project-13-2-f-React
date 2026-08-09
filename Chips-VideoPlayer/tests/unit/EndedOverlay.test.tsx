// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { EndedOverlay } from "../../src/components/EndedOverlay";

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

describe("EndedOverlay（播放结束重播态）", () => {
  it("渲染重播图标、标题与重播主按钮", () => {
    const { container, unmount } = renderUi(<EndedOverlay onReplay={() => {}} />);
    expect(container.querySelector(".video-player-ended")).not.toBeNull();
    expect(container.querySelector(".video-player-ended__icon .anticon-rotate-right")).not.toBeNull();
    expect(container.querySelector(".video-player-ended__title")?.textContent).toBe("播放结束");
    expect(container.querySelector(".video-player-ended__replay")?.textContent).toBe("重新播放");
    unmount();
  });

  it("自定义 title 与按钮文案时优先展示自定义内容", () => {
    const { container, unmount } = renderUi(
      <EndedOverlay title="演示视频" replayLabel="再看一遍" onReplay={() => {}} />,
    );
    expect(container.querySelector(".video-player-ended__title")?.textContent).toBe("演示视频");
    expect(container.querySelector(".video-player-ended__replay")?.textContent).toBe("再看一遍");
    unmount();
  });

  it("点击重播按钮触发 onReplay，不触发 onClose", () => {
    const onReplay = vi.fn();
    const onClose = vi.fn();
    const { container, unmount } = renderUi(
      <EndedOverlay onReplay={onReplay} onClose={onClose} />,
    );
    const replay = container.querySelector(".video-player-ended__replay") as Element;
    act(() => {
      replay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onReplay).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });

  it("点击空白区域触发 onClose，点击卡片不触发", () => {
    const onReplay = vi.fn();
    const onClose = vi.fn();
    const { container, unmount } = renderUi(
      <EndedOverlay onReplay={onReplay} onClose={onClose} />,
    );
    const root = container.querySelector(".video-player-ended") as Element;
    const card = container.querySelector(".video-player-ended__card") as Element;

    act(() => {
      card.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      root.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onReplay).not.toHaveBeenCalled();
    unmount();
  });

  it("Esc 键触发 onClose", () => {
    const onReplay = vi.fn();
    const onClose = vi.fn();
    const { unmount } = renderUi(<EndedOverlay onReplay={onReplay} onClose={onClose} />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("未提供 onClose 时不渲染关闭提示", () => {
    const { container, unmount } = renderUi(<EndedOverlay onReplay={() => {}} />);
    expect(container.querySelector(".video-player-ended__close-hint")).toBeNull();
    unmount();
  });
});
