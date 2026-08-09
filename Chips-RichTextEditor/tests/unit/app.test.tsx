import { describe, it, expect } from "vitest";
import { App } from "../../src/App";
import { AppRoot } from "../../src/app/AppRoot";

describe("App (富文本编辑器项目基线)", () => {
  it("应当导出一个可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
    expect(App).toBe(AppRoot);
  });
});
