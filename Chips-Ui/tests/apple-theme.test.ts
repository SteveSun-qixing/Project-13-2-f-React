import { describe, expect, it } from "vitest";
import { appleTheme } from "../src/theme/apple-theme";

describe("appleTheme", () => {
  it("包含苹果风格核心 token", () => {
    expect(appleTheme.token).toBeDefined();
    expect(appleTheme.token?.colorPrimary).toBe("#0a84ff");
    expect(appleTheme.token?.colorBgBase).toBe("#f5f5f7");
    expect(appleTheme.token?.colorTextBase).toBe("#1d1d1f");
  });

  it("组件级定制完整", () => {
    expect(appleTheme.components?.Button?.borderRadius).toBe(8);
    expect(appleTheme.components?.Switch?.colorPrimary).toBe("#34c759");
    expect(appleTheme.components?.Segmented?.itemSelectedBg).toBe("#ffffff");
  });
});
