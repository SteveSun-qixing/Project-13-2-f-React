import React from "react";
import { EmbeddedDocumentFrame } from "@chips/ui";
import type { FrameRegionConfig } from "../schema/layout-config";
import type { ResolvedRuntimeResource } from "./types";

export interface FrameRegionSource {
  src?: string;
  srcDoc?: string;
}

export type FrameImageFit = "cover" | "natural";

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildImageFrameHtml(imageUrl: string, fit: FrameImageFit = "cover"): string {
  const rootStyle = fit === "natural"
    ? "margin: 0; width: 100%; background: transparent;"
    : "margin: 0; width: 100%; height: 100%; background: transparent;";
  const bodyOverflow = fit === "natural" ? "visible" : "hidden";
  const imageStyle = fit === "natural"
    ? "display: block; width: 100%; height: auto;"
    : "width: 100%; height: 100%; display: block; object-fit: cover;";

  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    "  <style>",
    `    html, body { ${rootStyle} }`,
    `    body { overflow: ${bodyOverflow}; }`,
    `    img { ${imageStyle} }`,
    "  </style>",
    "</head>",
    `  <body><img src="${escapeHtmlAttribute(imageUrl)}" alt="" /></body>`,
    "</html>",
  ].join("\n");
}

export async function resolveFrameRegionSource(
  region: FrameRegionConfig,
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>,
  fit: FrameImageFit = "cover",
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
      srcDoc: buildImageFrameHtml(asset.resourceUrl, fit),
    };
  }

  return null;
}

export interface FrameRegionSurfaceProps {
  region: FrameRegionConfig;
  title: string;
  ratio?: string;
  autoHeight?: boolean;
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>;
  onActivate?: () => void;
}

export function FrameRegionSurface({
  region,
  title,
  ratio,
  autoHeight,
  readBoxAsset,
  onActivate,
}: FrameRegionSurfaceProps) {
  const [source, setSource] = React.useState<FrameRegionSource | null>(null);
  const fit: FrameImageFit = autoHeight ? "natural" : "cover";

  React.useEffect(() => {
    let cancelled = false;
    void resolveFrameRegionSource(region, readBoxAsset, fit).then((next) => {
      if (!cancelled) {
        setSource(next);
      }
    }).catch(() => {
      if (!cancelled) {
        setSource(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fit, readBoxAsset, region]);

  if (!source) {
    return null;
  }

  return (
    <EmbeddedDocumentFrame
      title={title}
      src={source.src}
      srcDoc={source.srcDoc}
      ratio={autoHeight ? undefined : ratio}
      autoHeight={autoHeight}
      maxHeightFactor={autoHeight && region.mode === "html" ? 3 : undefined}
      sandbox="allow-scripts"
      onActivate={onActivate}
    />
  );
}
