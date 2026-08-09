import React from "react";
import { EmbeddedDocumentFrame } from "@chips/ui";
import type { FrameRegionConfig } from "../schema/layout-config";
import type { ResolvedRuntimeResource } from "./types";
import { formatMessage } from "../lib/messages";

export interface FrameRegionSource {
  src?: string;
  srcDoc?: string;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildImageFrameHtml(imageUrl: string): string {
  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    "    html, body { margin: 0; width: 100%; height: 100%; background: transparent; }",
    "    body { overflow: hidden; }",
    "    img { width: 100%; height: 100%; display: block; object-fit: cover; }",
    "  </style>",
    "</head>",
    `  <body><img src="${escapeHtmlAttribute(imageUrl)}" alt="" /></body>`,
    "</html>",
  ].join("\n");
}

export async function resolveFrameRegionSource(
  region: FrameRegionConfig,
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>,
): Promise<FrameRegionSource | null> {
  if (region.mode === "html" && region.html) {
    return {
      srcDoc: region.html,
    };
  }

  if (region.mode === "image" && region.assetPath && readBoxAsset) {
    const asset = await readBoxAsset(region.assetPath);
    if (typeof asset.resourceUrl !== "string" || asset.resourceUrl.trim().length === 0) {
      return null;
    }

    return {
      srcDoc: buildImageFrameHtml(asset.resourceUrl),
    };
  }

  return null;
}

interface FrameRegionState {
  status: "idle" | "loading" | "ready" | "error";
  source?: FrameRegionSource;
}

export interface FrameRegionSurfaceProps {
  region: FrameRegionConfig;
  title: string;
  ratio?: string;
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>;
  onActivate?: () => void;
}

export function FrameRegionSurface({
  region,
  title,
  ratio,
  readBoxAsset,
  onActivate,
}: FrameRegionSurfaceProps) {
  const [state, setState] = React.useState<FrameRegionState>({ status: "idle" });

  React.useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void resolveFrameRegionSource(region, readBoxAsset)
      .then((source) => {
        if (!cancelled) {
          setState(source ? { status: "ready", source } : { status: "error" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [readBoxAsset, region]);

  if (state.status === "ready" && state.source) {
    return (
      <EmbeddedDocumentFrame
        title={title}
        src={state.source.src}
        srcDoc={state.source.srcDoc}
        ratio={ratio}
        sandbox="allow-scripts"
        onActivate={onActivate}
      />
    );
  }

  if (state.status === "loading" || state.status === "error") {
    return (
      <div data-frame-region-status role="status">
        {formatMessage(state.status === "loading" ? "layout.asset_loading" : "layout.asset_error")}
      </div>
    );
  }

  return null;
}
