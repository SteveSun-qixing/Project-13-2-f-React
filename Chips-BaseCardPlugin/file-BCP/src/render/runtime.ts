import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { appleTheme } from "@chips/ui";
import type { BasecardRenderContext } from "../index";
import type { BasecardConfig } from "../schema/card-config";
import { FileBasecardView, VIEW_STYLE_TEXT } from "./view";

type MountState = {
  root: Root;
};

type BasecardViewContainer = HTMLElement & {
  __chipsFileCardViewDispose?: () => void;
};

export function mountBasecardView(ctx: BasecardRenderContext): () => void {
  const { container, config } = ctx;
  const hostContainer = container as BasecardViewContainer;

  hostContainer.__chipsFileCardViewDispose?.();

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const mountNode = document.createElement("div");
  mountNode.setAttribute("data-chips-file-card-view-root", "true");
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
        React.createElement(
          React.Fragment,
          null,
          React.createElement("style", null, VIEW_STYLE_TEXT),
          React.createElement(FileBasecardView, {
            config: config as BasecardConfig,
            resolveResourceUrl: ctx.resolveResourceUrl,
            releaseResourceUrl: ctx.releaseResourceUrl,
            openResource: ctx.openResource,
          }),
        ),
      ),
    );
  });

  let disposed = false;
  const cleanup = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    state.root.unmount();
    if (hostContainer.__chipsFileCardViewDispose === cleanup) {
      delete hostContainer.__chipsFileCardViewDispose;
    }
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  };

  hostContainer.__chipsFileCardViewDispose = cleanup;

  return cleanup;
}
