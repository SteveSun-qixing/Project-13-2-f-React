import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { BasecardRenderContext } from "../index";
import { normalizeBasecardConfig, type BasecardConfig } from "../schema/card-config";
import { BasecardView, VIEW_STYLE_TEXT } from "./view";

type MountState = {
  root: Root;
};

export function mountBasecardView(ctx: BasecardRenderContext): () => void {
  const { container, config } = ctx;

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const mountNode = document.createElement("div");
  mountNode.setAttribute("data-chips-basecard-view-root", "true");
  mountNode.style.width = "100%";
  container.appendChild(mountNode);

  const state: MountState = {
    root: createRoot(mountNode),
  };

  flushSync(() => {
    const normalizedConfig = normalizeBasecardConfig(config as unknown as Record<string, unknown>);
    state.root.render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement("style", null, VIEW_STYLE_TEXT),
        React.createElement(BasecardView, {
          config: normalizedConfig as BasecardConfig,
          openResource: ctx.openResource,
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
