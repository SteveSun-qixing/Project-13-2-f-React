import React from "react";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { createRoot, type Root } from "react-dom/client";
import { appleTheme } from "@chips/ui";
import { LayoutViewPage } from "./page";
import type { BoxEntryPage, BoxLayoutRuntime } from "../shared/types";
import type { LayoutConfig } from "../schema/layout-config";

export interface MountLayoutViewOptions {
  container: HTMLElement;
  initialView: BoxEntryPage;
  config: LayoutConfig;
  runtime: BoxLayoutRuntime;
}

export function mountLayoutView(options: MountLayoutViewOptions): () => void {
  const root: Root = createRoot(options.container);
  root.render(
    React.createElement(
      ConfigProvider,
      { locale: zhCN, theme: appleTheme },
      React.createElement(LayoutViewPage, {
        initialView: options.initialView,
        config: options.config,
        runtime: options.runtime,
      })
    )
  );

  return () => {
    root.unmount();
    options.container.replaceChildren();
  };
}
