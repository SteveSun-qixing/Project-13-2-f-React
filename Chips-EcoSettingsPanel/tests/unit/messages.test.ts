import { describe, expect, it } from "vitest";
import { formatMessage } from "../../src/lib/messages";

describe("中文文案表", () => {
  it("按 key 返回中文文案", () => {
    expect(formatMessage("settingsPanel.app.title")).toBe("生态设置面板");
    expect(formatMessage("settingsPanel.common.details")).toBe("详情");
  });

  it("支持参数插值", () => {
    expect(
      formatMessage("settingsPanel.appPlugins.feedback.enableSuccess", {
        name: "测试插件",
      }),
    ).toBe("已启用 测试插件。");
  });

  it("未知 key 原样返回，便于发现缺词", () => {
    expect(formatMessage("settingsPanel.missing.key")).toBe("settingsPanel.missing.key");
  });
});
