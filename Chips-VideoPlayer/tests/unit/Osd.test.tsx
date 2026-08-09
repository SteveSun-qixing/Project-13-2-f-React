// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { Osd, type OsdData } from "../../src/components/Osd";
import "./__animation-events";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ReactNode } from "react";
import { SoundOutlined } from "@ant-design/icons";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function renderUi(ui: ReactNode): { container: HTMLElement; rerender: (next: ReactNode) => void; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
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

function dispatchAnimationEnd(element: Element, animationName: string): void {
  const event = new Event("animationend", { bubbles: true });
  Object.defineProperty(event, "animationName", { value: animationName });
  element.dispatchEvent(event);
}

const volumeOsd: OsdData = {
  key: "volume-85",
  icon: <SoundOutlined />,
  title: "音量",
  subtitle: "85%",
  progress: 0.85,
};

describe("Osd（OSD 反馈系统）", () => {
  it("osd 为 null 时不渲染任何内容", () => {
    const { container, unmount } = renderUi(<Osd osd={null} />);
    expect(container.querySelector(".video-player-osd")).toBeNull();
    unmount();
  });

  it("渲染图标、标题、副标题与横向进度条，并带 aria-live 声明", () => {
    const { container, unmount } = renderUi(<Osd osd={volumeOsd} />);
    const root = container.querySelector(".video-player-osd");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("role")).toBe("status");
    expect(root?.getAttribute("aria-live")).toBe("polite");

    const card = container.querySelector(".video-player-osd__card");
    expect(card).not.toBeNull();
    expect(container.querySelector(".video-player-osd__icon")).not.toBeNull();
    expect(container.querySelector(".video-player-osd__title")?.textContent).toBe("音量");
    expect(container.querySelector(".video-player-osd__subtitle")?.textContent).toBe("85%");

    const fill = container.querySelector<HTMLElement>(".video-player-osd__progress-fill");
    expect(fill).not.toBeNull();
    expect(fill?.style.width).toBe("85%");
    unmount();
  });

  it("没有 subtitle / progress 时省略对应区块", () => {
    const { container, unmount } = renderUi(<Osd osd={{ key: "rate-1.5", title: "1.5x" }} />);
    expect(container.querySelector(".video-player-osd__subtitle")).toBeNull();
    expect(container.querySelector(".video-player-osd__progress")).toBeNull();
    expect(container.querySelector(".video-player-osd__title")?.textContent).toBe("1.5x");
    unmount();
  });

  it("progress 超出 0..1 时收敛到边界", () => {
    const { container, unmount } = renderUi(<Osd osd={{ key: "mute", title: "静音", progress: 2 }} />);
    const fill = container.querySelector<HTMLElement>(".video-player-osd__progress-fill");
    expect(fill?.style.width).toBe("100%");
    unmount();
  });

  it("key 变化时重建卡片以重新触发入场动画", () => {
    const { container, rerender, unmount } = renderUi(<Osd osd={volumeOsd} />);
    const firstCard = container.querySelector(".video-player-osd__card");
    expect(firstCard).not.toBeNull();

    rerender(<Osd osd={{ ...volumeOsd, key: "volume-90", subtitle: "90%" }} />);
    const secondCard = container.querySelector(".video-player-osd__card");
    expect(secondCard).not.toBeNull();
    expect(secondCard).not.toBe(firstCard);
    expect(secondCard?.contains(firstCard as Node)).toBe(false);
    unmount();
  });

  it("入场动画结束后通知 onDismiss，其余动画名忽略", () => {
    const onDismiss = vi.fn();
    const { container, unmount } = renderUi(<Osd osd={volumeOsd} onDismiss={onDismiss} />);
    const card = container.querySelector(".video-player-osd__card");
    expect(card).not.toBeNull();

    dispatchAnimationEnd(card as Element, "video-player-osd-enter");
    expect(onDismiss).toHaveBeenCalledTimes(1);

    dispatchAnimationEnd(card as Element, "video-player-osd-exit");
    expect(onDismiss).toHaveBeenCalledTimes(1);
    unmount();
  });
});
