import React from "react";
import { Button, Input, Segmented } from "antd";
import { FrameRegionSurface } from "../shared/frame-region";
import { hasFrameRegionContent, isSafeBoxAssetPath, type FrameRegionConfig } from "../schema/layout-config";
import type { ResolvedRuntimeResource } from "../shared/types";
import { formatMessage } from "../lib/messages";

export interface FrameRegionEditorProps {
  id: string;
  region: FrameRegionConfig;
  title: string;
  description: string;
  previewRatio: string;
  previewMinHeight?: string;
  preferredAssetPrefix: string;
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>;
  importBoxAsset?: (input: { file: File; preferredPath?: string }) => Promise<{ assetPath: string }>;
  deleteBoxAsset?: (assetPath: string) => Promise<void>;
  onChange(next: FrameRegionConfig): void;
}

type FrameMode = FrameRegionConfig["mode"];

const MODE_MESSAGE_KEY: Record<FrameMode, string> = {
  none: "editor.frame_mode_none",
  image: "editor.frame_mode_image",
  html: "editor.frame_mode_html",
};

function sanitizeAssetFileName(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/^\.+/, "")
    .replace(/-+$/, "");
  return sanitized.length > 0 ? sanitized : "asset";
}

async function safeDeleteAsset(
  assetPath: string | undefined,
  deleteBoxAsset?: (assetPath: string) => Promise<void>,
): Promise<boolean> {
  if (!assetPath) {
    return true;
  }
  if (!deleteBoxAsset) {
    return false;
  }
  try {
    await deleteBoxAsset(assetPath);
    return true;
  } catch {
    return false;
  }
}

export function FrameRegionEditor({
  id,
  region,
  title,
  description,
  previewRatio,
  previewMinHeight,
  preferredAssetPrefix,
  readBoxAsset,
  importBoxAsset,
  deleteBoxAsset,
  onChange,
}: FrameRegionEditorProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const hasContent = hasFrameRegionContent(region);

  const applyMode = async (nextMode: FrameMode) => {
    if (nextMode === region.mode) {
      return;
    }

    if (region.mode === "image" && nextMode !== "image") {
      const deleted = await safeDeleteAsset(region.assetPath, deleteBoxAsset);
      if (!deleted) {
        return;
      }
    }

    if (nextMode === "image") {
      onChange({
        mode: "image",
        assetPath: region.mode === "image" ? region.assetPath : undefined,
      });
      return;
    }

    if (nextMode === "html") {
      onChange({
        mode: "html",
        html: region.mode === "html" ? region.html : "",
      });
      return;
    }

    onChange({
      mode: "none",
    });
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file || !importBoxAsset) {
      event.currentTarget.value = "";
      return;
    }

    const imported = await importBoxAsset({
      file,
      preferredPath: `${preferredAssetPrefix}/${Date.now()}-${sanitizeAssetFileName(file.name)}`,
    });
    if (!isSafeBoxAssetPath(imported.assetPath)) {
      await safeDeleteAsset(imported.assetPath, deleteBoxAsset);
      event.currentTarget.value = "";
      return;
    }
    const previousAssetPath = region.mode === "image" ? region.assetPath : undefined;
    if (previousAssetPath && previousAssetPath !== imported.assetPath) {
      const deleted = await safeDeleteAsset(previousAssetPath, deleteBoxAsset);
      if (!deleted) {
        await safeDeleteAsset(imported.assetPath, deleteBoxAsset);
        event.currentTarget.value = "";
        return;
      }
    }

    onChange({
      mode: "image",
      assetPath: imported.assetPath,
    });

    event.currentTarget.value = "";
  };

  const handleClear = async () => {
    if (region.mode === "image") {
      const deleted = await safeDeleteAsset(region.assetPath, deleteBoxAsset);
      if (!deleted) {
        return;
      }
    }
    onChange({
      mode: "none",
    });
  };

  const modeOptions = React.useMemo(() => ([
    {
      value: "none",
      label: formatMessage(MODE_MESSAGE_KEY.none),
    },
    {
      value: "image",
      label: formatMessage(MODE_MESSAGE_KEY.image),
    },
    {
      value: "html",
      label: formatMessage(MODE_MESSAGE_KEY.html),
    },
  ]), []);

  return (
    <section
      className="chips-list-layout-editor__frame"
      data-frame-region-editor={id}
    >
      <div className="chips-list-layout-editor__frame-head">
        <strong className="chips-list-layout-editor__frame-title">{title}</strong>
        <span className="chips-list-layout-editor__frame-desc">{description}</span>
      </div>

      <Segmented
        value={region.mode}
        aria-label={title}
        options={modeOptions}
        onChange={(value) => {
          void applyMode(value as FrameMode);
        }}
      />

      {region.mode === "image" ? (
        <div className="chips-list-layout-editor__frame-actions">
          <div className="chips-list-layout-editor__frame-action-row">
            <Button
              type="default"
              onClick={() => fileInputRef.current?.click()}
            >
              {formatMessage("editor.upload_image")}
            </Button>
            <Button
              type="default"
              onClick={() => { void handleClear(); }}
            >
              {formatMessage("editor.clear_frame")}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => { void handleUpload(event); }}
          />
          <span className="chips-list-layout-editor__frame-asset">
            {region.assetPath ?? formatMessage("editor.frame_empty")}
          </span>
        </div>
      ) : null}

      {region.mode === "html" ? (
        <div className="chips-list-layout-editor__frame-actions">
          <div className="chips-list-layout-editor__html-input">
            <Input.TextArea
              rows={12}
              value={region.html ?? ""}
              placeholder={formatMessage("editor.html_placeholder")}
              onChange={(event) => {
                onChange({
                  mode: "html",
                  html: event.target.value,
                });
              }}
            />
          </div>
          <div className="chips-list-layout-editor__frame-action-row">
            <Button
              type="default"
              onClick={() => { void handleClear(); }}
            >
              {formatMessage("editor.clear_frame")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="chips-list-layout-editor__frame-preview">
        <span className="chips-list-layout-editor__frame-preview-label">
          {formatMessage("editor.preview")}
        </span>
        <div
          className="chips-list-layout-editor__frame-preview-box"
          style={{ minHeight: previewMinHeight ?? "180px" }}
        >
          <FrameRegionSurface
            region={region}
            title={title}
            ratio={previewRatio}
            readBoxAsset={readBoxAsset}
          />
          {!hasContent ? (
            <div
              className="chips-list-layout-editor__frame-preview-empty"
              style={{ minHeight: previewMinHeight ?? "180px" }}
            >
              {formatMessage("editor.frame_empty")}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
