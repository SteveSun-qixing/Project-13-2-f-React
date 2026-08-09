import React from "react";
import { EmbeddedDocumentFrame } from "@chips/ui";
import type { FrameRegionConfig } from "../schema/layout-config";
import type { ResolvedRuntimeResource } from "./types";

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
  const [source, setSource] = React.useState<FrameRegionSource | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void resolveFrameRegionSource(region, readBoxAsset).then((next) => {
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
  }, [readBoxAsset, region]);

  if (!source) {
    return null;
  }

  return (
    <EmbeddedDocumentFrame
      title={title}
      src={source.src}
      srcDoc={source.srcDoc}
      ratio={ratio}
      sandbox="allow-scripts"
      onActivate={onActivate}
    />
  );
}
