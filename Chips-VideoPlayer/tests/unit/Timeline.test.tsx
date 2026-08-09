// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { Timeline } from "../../src/components/Timeline";

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

function mockTrackRect(track: Element, width = 100): void {
  vi.spyOn(track, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: 10,
    width,
    height: 10,
    toJSON: () => ({}),
  } as DOMRect);
}

function dispatchPointer(element: Element, type: string, clientX?: number): void {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (clientX !== undefined) {
    Object.defineProperty(event, "clientX", { value: clientX });
  }
  act(() => {
    element.dispatchEvent(event);
  });
}

function dispatchKey(element: Element, key: string): void {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

describe("Timeline（自研时间轴）", () => {
  it("渲染缓冲层与进度层，宽度按 bufferedUntil / currentTime 计算", () => {
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={10} bufferedUntil={60} />,
    );
    const timeline = container.querySelector(".video-player-timeline");
    expect(timeline).not.toBeNull();
    expect(timeline?.getAttribute("role")).toBe("slider");
    expect(timeline?.getAttribute("aria-valuemin")).toBe("0");
    expect(timeline?.getAttribute("aria-valuemax")).toBe("100");
    expect(timeline?.getAttribute("aria-valuenow")).toBe("10");
    expect(timeline?.getAttribute("aria-disabled")).toBe("false");

    const buffer = container.querySelector<HTMLElement>(".video-player-timeline__buffer");
    const progress = container.querySelector<HTMLElement>(".video-player-timeline__progress");
    expect(buffer?.style.width).toBe("60%");
    expect(progress?.style.width).toBe("10%");
    expect(container.querySelector(".video-player-timeline__thumb")).not.toBeNull();
    unmount();
  });

  it("拖拽过程中只触发 onPreview，松开后才触发 onCommit", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={10} bufferedUntil={60} onPreview={onPreview} onCommit={onCommit} />,
    );
    const timeline = container.querySelector(".video-player-timeline") as Element;
    mockTrackRect(container.querySelector(".video-player-timeline__track") as Element, 100);

    dispatchPointer(timeline, "pointerdown", 25);
    expect(onPreview).toHaveBeenLastCalledWith(25);
    expect(onCommit).not.toHaveBeenCalled();

    dispatchPointer(timeline, "pointermove", 80);
    expect(onPreview).toHaveBeenLastCalledWith(80);
    expect(onCommit).not.toHaveBeenCalled();
    expect(onPreview).toHaveBeenCalledTimes(2);

    dispatchPointer(timeline, "pointerup", 80);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(80);
    unmount();
  });

  it("拖拽超出边界时收敛到 0 与 duration", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={10} bufferedUntil={60} onPreview={onPreview} onCommit={onCommit} />,
    );
    const timeline = container.querySelector(".video-player-timeline") as Element;
    mockTrackRect(container.querySelector(".video-player-timeline__track") as Element, 100);

    dispatchPointer(timeline, "pointerdown", -30);
    expect(onPreview).toHaveBeenLastCalledWith(0);
    dispatchPointer(timeline, "pointermove", 300);
    expect(onPreview).toHaveBeenLastCalledWith(100);
    dispatchPointer(timeline, "pointerup", 300);
    expect(onCommit).toHaveBeenCalledWith(100);
    unmount();
  });

  it("未拖拽时按下并松开（单击）在松开处提交", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={10} bufferedUntil={60} onPreview={onPreview} onCommit={onCommit} />,
    );
    const timeline = container.querySelector(".video-player-timeline") as Element;
    mockTrackRect(container.querySelector(".video-player-timeline__track") as Element, 100);

    dispatchPointer(timeline, "pointerdown", 50);
    dispatchPointer(timeline, "pointerup", 50);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(50);
    unmount();
  });

  it("pointercancel 取消拖拽且不提交", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={10} bufferedUntil={60} onPreview={onPreview} onCommit={onCommit} />,
    );
    const timeline = container.querySelector(".video-player-timeline") as Element;
    mockTrackRect(container.querySelector(".video-player-timeline__track") as Element, 100);

    dispatchPointer(timeline, "pointerdown", 50);
    dispatchPointer(timeline, "pointercancel");
    expect(onCommit).not.toHaveBeenCalled();
    unmount();
  });

  it("hover 时显示时间提示（MM:SS / 总时长），离开后消失", () => {
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={10} bufferedUntil={60} />,
    );
    const timeline = container.querySelector(".video-player-timeline") as Element;
    mockTrackRect(container.querySelector(".video-player-timeline__track") as Element, 100);

    expect(container.querySelector(".video-player-timeline__tooltip")).toBeNull();
    dispatchPointer(timeline, "pointermove", 50);
    const tooltip = container.querySelector(".video-player-timeline__tooltip");
    expect(tooltip).not.toBeNull();
    expect(tooltip?.textContent).toContain("00:50");
    expect(tooltip?.textContent).toContain("01:40");

    dispatchPointer(timeline, "pointerout");
    expect(container.querySelector(".video-player-timeline__tooltip")).toBeNull();
    unmount();
  });

  it("键盘方向键 ±5s 提交，Home/End 到边界", () => {
    const onCommit = vi.fn();
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={30} bufferedUntil={60} onCommit={onCommit} />,
    );
    const timeline = container.querySelector(".video-player-timeline") as Element;

    dispatchKey(timeline, "ArrowRight");
    expect(onCommit).toHaveBeenLastCalledWith(35);
    dispatchKey(timeline, "ArrowLeft");
    expect(onCommit).toHaveBeenLastCalledWith(25);
    dispatchKey(timeline, "Home");
    expect(onCommit).toHaveBeenLastCalledWith(0);
    dispatchKey(timeline, "End");
    expect(onCommit).toHaveBeenLastCalledWith(100);
    unmount();
  });

  it("键盘提交同样受边界约束", () => {
    const onCommit = vi.fn();
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={98} bufferedUntil={60} onCommit={onCommit} />,
    );
    const timeline = container.querySelector(".video-player-timeline") as Element;

    dispatchKey(timeline, "ArrowRight");
    expect(onCommit).toHaveBeenLastCalledWith(100);
    dispatchKey(timeline, "ArrowLeft");
    expect(onCommit).toHaveBeenLastCalledWith(93);
    unmount();
  });

  it("disabled 时不可交互：指针与键盘均无回调，并声明 aria-disabled", () => {
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const { container, unmount } = renderUi(
      <Timeline duration={100} currentTime={10} bufferedUntil={60} disabled onPreview={onPreview} onCommit={onCommit} />,
    );
    const timeline = container.querySelector(".video-player-timeline") as Element;
    expect(timeline.getAttribute("aria-disabled")).toBe("true");
    expect(timeline.getAttribute("tabindex")).toBe("-1");

    dispatchPointer(timeline, "pointerdown", 50);
    dispatchPointer(timeline, "pointerup", 50);
    dispatchKey(timeline, "ArrowRight");
    expect(onPreview).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
    unmount();
  });
});
