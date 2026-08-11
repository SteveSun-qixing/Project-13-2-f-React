import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { BasecardRenderContext } from "../index";
import { BasecardView, VIEW_STYLE_TEXT } from "./view";

type MountState = {
  root: Root;
};

const mountedViewCleanups = new WeakMap<HTMLElement, () => void>();

export function mountBasecardView(ctx: BasecardRenderContext): () => void {
  const { container } = ctx;

  const previousDispose = mountedViewCleanups.get(container);
  if (previousDispose) {
    previousDispose();
  } else {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  const mountNode = document.createElement("div");
  mountNode.setAttribute("data-chips-basecard-view-root", "true");
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
        React.createElement(BasecardView, {
          config: ctx.config,
          openResource: ctx.openResource,
        }),
      ),
    );
  });

  const dispose = () => {
    if (mountedViewCleanups.get(container) !== dispose) {
      return;
    }

    state.root.unmount();
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    mountedViewCleanups.delete(container);
  };

  mountedViewCleanups.set(container, dispose);
  return dispose;
}
