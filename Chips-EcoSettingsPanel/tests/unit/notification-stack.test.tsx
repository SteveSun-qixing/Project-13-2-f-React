import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NotificationStack } from "../../src/shared/ui/NotificationStack";

describe("NotificationStack", () => {
  it("renders feedback items as closable alerts in a fixed toast region", () => {
    const markup = renderToStaticMarkup(
      <NotificationStack
        ariaLabel="运行反馈"
        closeButtonLabel="关闭"
        items={[
          {
            id: "plugin-installed",
            tone: "success",
            title: "应用插件安装",
            message: "应用插件已安装，列表已刷新。",
          },
        ]}
      />,
    );

    expect(markup).toContain("settings-feedback-toast");
    expect(markup).toContain("ant-alert");
    expect(markup).toContain("应用插件安装");
    expect(markup).toContain("应用插件已安装，列表已刷新。");
    expect(markup).toContain("关闭");
  });

  it("renders nothing when there are no items", () => {
    const markup = renderToStaticMarkup(
      <NotificationStack ariaLabel="运行反馈" items={[]} />,
    );

    expect(markup).toBe("");
  });
});
