import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { appleTheme } from "@chips/ui";
import type { BasecardRenderContext } from "../index";
import { normalizeBasecardConfig } from "../schema/card-config";
import { VIEW_STYLE_TEXT, WebpageCardView } from "./view";

type MountState = {
  root: Root;
};

export function mountBasecardView(ctx: BasecardRenderContext): () => void {
  const { container } = ctx;
  const config = normalizeBasecardConfig(ctx.config);

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const mountNode = document.createElement("div");
  mountNode.setAttribute("data-chips-webpage-view-root", "true");
  mountNode.style.width = "100%";
  container.appendChild(mountNode);

  const state: MountState = {
    root: createRoot(mountNode),
  };

  flushSync(() => {
    state.root.render(
      React.createElement(
        ConfigProvider,
        { locale: zhCN, theme: appleTheme },
        React.createElement("style", null, VIEW_STYLE_TEXT),
        React.createElement(WebpageCardView, {
          config,
          resolveResourceUrl: ctx.resolveResourceUrl,
          releaseResourceUrl: ctx.releaseResourceUrl,
        }),
      ),
    );
  });

  return () => {
    state.root.unmount();
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };
}
