// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  matchesShortcut,
  useCommandShortcuts,
  type CommandItem,
} from "../src/runtime/commands";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createKeyEvent(
  key: string,
  options: { metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {},
): KeyboardEvent {
  return {
    key,
    metaKey: options.metaKey ?? false,
    ctrlKey: options.ctrlKey ?? false,
    shiftKey: options.shiftKey ?? false,
    altKey: options.altKey ?? false,
  } as KeyboardEvent;
}

function dispatchKeyDown(target: EventTarget, init: KeyboardEventInit): void {
  target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
}

function mountShortcuts(commands: CommandItem[]): () => void {
  function ShortcutHarness({ items }: { items: CommandItem[] }): null {
    useCommandShortcuts(items);
    return null;
  }

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ShortcutHarness items={commands} />);
  });
  return () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
}

describe("matchesShortcut", () => {
  it("匹配 Mod+O", () => {
    expect(matchesShortcut(createKeyEvent("o", { metaKey: true }), "Mod+O")).toBe(true);
    expect(matchesShortcut(createKeyEvent("o", { ctrlKey: true }), "Mod+O")).toBe(true);
    expect(matchesShortcut(createKeyEvent("o"), "Mod+O")).toBe(false);
  });

  it("匹配单键 ArrowLeft", () => {
    expect(matchesShortcut(createKeyEvent("ArrowLeft"), "ArrowLeft")).toBe(true);
    expect(matchesShortcut(createKeyEvent("ArrowLeft", { metaKey: true }), "ArrowLeft")).toBe(false);
  });

  it("匹配带符号键 Mod+-", () => {
    expect(matchesShortcut(createKeyEvent("-", { metaKey: true }), "Mod+-")).toBe(true);
  });

  it("匹配 Shift 组合", () => {
    expect(matchesShortcut(createKeyEvent("O", { metaKey: true, shiftKey: true }), "Mod+Shift+O")).toBe(true);
    expect(matchesShortcut(createKeyEvent("o", { metaKey: true }), "Mod+Shift+O")).toBe(false);
  });
});

describe("useCommandShortcuts", () => {
  it("匹配快捷键时触发命令", () => {
    let calls = 0;
    const unmount = mountShortcuts([
      { id: "toggle", title: "切换", shortcut: " ", run: () => { calls += 1; } },
    ]);
    dispatchKeyDown(window, { key: " " });
    expect(calls).toBe(1);
    unmount();
  });

  it("焦点在 button 上按键不触发命令", () => {
    let calls = 0;
    const unmount = mountShortcuts([
      { id: "toggle", title: "切换", shortcut: " ", run: () => { calls += 1; } },
    ]);
    const button = document.createElement("button");
    document.body.appendChild(button);
    dispatchKeyDown(button, { key: " " });
    expect(calls).toBe(0);
    button.remove();
    unmount();
  });

  it("焦点在 role=button 元素上按键不触发命令", () => {
    let calls = 0;
    const unmount = mountShortcuts([
      { id: "toggle", title: "切换", shortcut: " ", run: () => { calls += 1; } },
    ]);
    const roleButton = document.createElement("div");
    roleButton.setAttribute("role", "button");
    document.body.appendChild(roleButton);
    dispatchKeyDown(roleButton, { key: " " });
    expect(calls).toBe(0);
    roleButton.remove();
    unmount();
  });

  it("焦点在链接上按键不触发命令", () => {
    let calls = 0;
    const unmount = mountShortcuts([
      { id: "toggle", title: "切换", shortcut: " ", run: () => { calls += 1; } },
    ]);
    const link = document.createElement("a");
    link.setAttribute("href", "#");
    document.body.appendChild(link);
    dispatchKeyDown(link, { key: " " });
    expect(calls).toBe(0);
    link.remove();
    unmount();
  });

  it("焦点在输入框上按键不触发命令", () => {
    let calls = 0;
    const unmount = mountShortcuts([
      { id: "toggle", title: "切换", shortcut: " ", run: () => { calls += 1; } },
    ]);
    const input = document.createElement("input");
    document.body.appendChild(input);
    dispatchKeyDown(input, { key: " " });
    expect(calls).toBe(0);
    input.remove();
    unmount();
  });

  it("IME 组合中（isComposing）按键不触发命令", () => {
    let calls = 0;
    const unmount = mountShortcuts([
      { id: "toggle", title: "切换", shortcut: " ", run: () => { calls += 1; } },
    ]);
    dispatchKeyDown(window, { key: " ", isComposing: true });
    expect(calls).toBe(0);
    dispatchKeyDown(window, { key: " " });
    expect(calls).toBe(1);
    unmount();
  });

  it("enabled=false 的命令不触发", () => {
    let calls = 0;
    const unmount = mountShortcuts([
      { id: "toggle", title: "切换", shortcut: " ", enabled: false, run: () => { calls += 1; } },
    ]);
    dispatchKeyDown(window, { key: " " });
    expect(calls).toBe(0);
    unmount();
  });
});
