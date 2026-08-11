import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import type { BasecardRenderContext } from "../index";
import type { BasecardConfig } from "../schema/card-config";
import { MusicBasecardView, VIEW_STYLE_TEXT } from "./view";

type MountState = {
  root: Root;
};

export function mountBasecardView(ctx: BasecardRenderContext): () => void {
  const { container, config } = ctx;

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const mountNode = document.createElement("div");
  mountNode.setAttribute("data-chips-music-view-root", "true");
  mountNode.style.width = "100%";
  container.appendChild(mountNode);

  const state: MountState = {
    root: createRoot(mountNode),
  };

  flushSync(() => {
    state.root.render(
      React.createElement(
        ConfigProvider,
        {
          locale: zhCN,
          theme: appleTheme,
        },
        React.createElement(
          React.Fragment,
          null,
          React.createElement("style", null, VIEW_STYLE_TEXT),
          React.createElement(MusicBasecardView, {
            config: config as BasecardConfig,
            resolveResourceUrl: ctx.resolveResourceUrl,
            releaseResourceUrl: ctx.releaseResourceUrl,
            openResource: ctx.openResource,
          }),
        ),
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
