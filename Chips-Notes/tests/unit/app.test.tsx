import { describe, it, expect } from "vitest";
import { App } from "../../src/App";

describe("App (标准应用插件根组件)", () => {
  it("应当导出一个可用的 React 组件", () => {
    expect(App).toBeTypeOf("function");
  });
});
