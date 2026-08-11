import React from "react";
import { createCache, StyleProvider } from "@ant-design/cssinjs";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { BasecardRenderContext } from "../index";
import type { BasecardConfig } from "../schema/card-config";
import { BasecardView, VIEW_STYLE_TEXT } from "./view";

type MountState = {
  root: Root;
};

type StyleCache = ReturnType<typeof createCache>;

const documentStyleCaches = new WeakMap<Document, StyleCache>();

function getDocumentStyleCache(ownerDocument: Document): StyleCache {
  const cached = documentStyleCaches.get(ownerDocument);
  if (cached) {
    return cached;
  }

  const cache = createCache();
  documentStyleCaches.set(ownerDocument, cache);
  return cache;
}

export function mountBasecardView(ctx: BasecardRenderContext): () => void {
  const { container, config } = ctx;
  const ownerDocument = container.ownerDocument;

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const mountNode = ownerDocument.createElement("div");
  mountNode.setAttribute("data-chips-basecard-view-root", "true");
  mountNode.style.width = "100%";
  container.appendChild(mountNode);

  const styleProviderProps = ownerDocument === document
    ? { container: ownerDocument.head }
    : {
        cache: getDocumentStyleCache(ownerDocument),
        container: ownerDocument.head,
      };

  const state: MountState = {
    root: createRoot(mountNode),
  };

  flushSync(() => {
    state.root.render(
      React.createElement(
        StyleProvider,
        styleProviderProps,
        React.createElement(
          ConfigProvider,
          { locale: zhCN, theme: appleTheme },
          React.createElement(
            React.Fragment,
            null,
            React.createElement("style", null, VIEW_STYLE_TEXT),
            React.createElement(BasecardView, {
              config: config as BasecardConfig,
            }),
          ),
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
