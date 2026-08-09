// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { KeyHelpDialog, type KeyHelpGroup } from "../../src/components/KeyHelpDialog";

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

const groups: KeyHelpGroup[] = [
  {
    title: "播放",
    items: [
      { keys: "Space / K", label: "播放 / 暂停" },
      { keys: "← →", label: "快退 / 快进 5 秒" },
    ],
  },
  {
    title: "声音",
    items: [{ keys: "M", label: "静音" }],
  },
];

describe("KeyHelpDialog（快捷键帮助弹窗）", () => {
  it("open 为 false 时不渲染", () => {
    const { container, unmount } = renderUi(
      <KeyHelpDialog open={false} onClose={() => {}} groups={groups} />,
    );
    expect(container.querySelector(".video-player-key-help")).toBeNull();
    unmount();
  });

  it("open 为 true 时渲染分组、快捷键与说明", () => {
    const { container, unmount } = renderUi(
      <KeyHelpDialog open onClose={() => {}} groups={groups} />,
    );
    const root = container.querySelector(".video-player-key-help");
    expect(root).not.toBeNull();

    const dialog = container.querySelector(".video-player-key-help__dialog");
    expect(dialog?.getAttribute("role")).toBe("dialog");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(container.querySelector(".video-player-key-help__title")?.textContent).toBe("快捷键");

    const groupTitles = container.querySelectorAll(".video-player-key-help__group-title");
    expect(groupTitles.length).toBe(2);
    expect(groupTitles[0]?.textContent).toBe("播放");

    const items = container.querySelectorAll(".video-player-key-help__item");
    expect(items.length).toBe(3);
    expect(items[0]?.querySelector("kbd")?.textContent).toBe("Space / K");
    expect(items[0]?.textContent).toContain("播放 / 暂停");
    unmount();
  });

  it("自定义标题时优先展示", () => {
    const { container, unmount } = renderUi(
      <KeyHelpDialog open onClose={() => {}} groups={groups} title="键盘快捷方式" />,
    );
    expect(container.querySelector(".video-player-key-help__title")?.textContent).toBe("键盘快捷方式");
    unmount();
  });

  it("Esc 键关闭弹窗", () => {
    const onClose = vi.fn();
    const { unmount } = renderUi(<KeyHelpDialog open onClose={onClose} groups={groups} />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("点击遮罩关闭弹窗，点击对话框内部不关闭", () => {
    const onClose = vi.fn();
    const { container, unmount } = renderUi(
      <KeyHelpDialog open onClose={onClose} groups={groups} />,
    );
    const root = container.querySelector(".video-player-key-help") as Element;
    const dialog = container.querySelector(".video-player-key-help__dialog") as Element;

    act(() => {
      dialog.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      root.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("点击关闭按钮触发 onClose", () => {
    const onClose = vi.fn();
    const { container, unmount } = renderUi(
      <KeyHelpDialog open onClose={onClose} groups={groups} />,
    );
    const close = container.querySelector(".video-player-key-help__close") as Element;
    act(() => {
      close.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("open 为 false 时按 Esc 不触发 onClose", () => {
    const onClose = vi.fn();
    const { unmount } = renderUi(<KeyHelpDialog open={false} onClose={onClose} groups={groups} />);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    unmount();
  });
});
