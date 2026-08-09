import { describe, it, expect } from "vitest";
import { App } from "../../src/App";
import { AppRoot } from "../../src/app/AppRoot";
import { AppRuntimeProvider } from "../../src/app/AppRuntimeProvider";
import { AppShell } from "../../src/app/AppShell";

describe("App (视频播放器根组件)", () => {
  it("应当导出一个可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
  });

  it("应当采用 AppRuntime / AppRoot / Shell 的入口结构", () => {
    expect(App).toBe(AppRoot);
    expect(AppRuntimeProvider).toBeTypeOf("function");
    expect(AppShell).toBeTypeOf("function");
  });
});
