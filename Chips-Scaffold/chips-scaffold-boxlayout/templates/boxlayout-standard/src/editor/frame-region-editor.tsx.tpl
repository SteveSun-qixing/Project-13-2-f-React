import React from "react";
import { Button, Input, Segmented } from "antd";
import { PictureOutlined } from "@ant-design/icons";
import {
  hasFrameRegionContent,
  isSafeBoxAssetPath,
  type FrameRegionConfig,
} from "../schema/layout-config";
import type { ResolvedRuntimeResource } from "../shared/types";
import { formatMessage } from "../lib/messages";

type FrameMode = FrameRegionConfig["mode"];

export interface FrameRegionEditorProps {
  id: string;
  region: FrameRegionConfig;
  title: string;
  preferredAssetPrefix: string;
  readBoxAsset?(assetPath: string): Promise<ResolvedRuntimeResource>;
  importBoxAsset?(input: { file: File; preferredPath?: string }): Promise<{ assetPath: string }>;
  deleteBoxAsset?(assetPath: string): Promise<void>;
  onChange(next: FrameRegionConfig): void;
}

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

function buildPreferredAssetPath(prefix: string, file: File): string {
  return `${prefix}/${Date.now()}-${sanitizeAssetFileName(file.name)}`;
}

function useMountedRef(): React.MutableRefObject<boolean> {
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}

interface ImagePreviewState {
  status: "idle" | "loading" | "ready" | "error";
  resourceUrl?: string;
}

export function FrameRegionEditor({
  id,
  region,
  title,
  preferredAssetPrefix,
  readBoxAsset,
  importBoxAsset,
  deleteBoxAsset,
  onChange,
}: FrameRegionEditorProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const mountedRef = useMountedRef();
  const [errorKey, setErrorKey] = React.useState<string | undefined>();
  const [busyAction, setBusyAction] = React.useState<"import" | "delete" | undefined>();
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<ImagePreviewState>({ status: "idle" });

  const hasImage = region.mode === "image";
  const hasImageAsset = hasImage && typeof region.assetPath === "string" && region.assetPath.trim().length > 0;
  const hasBridge = Boolean(importBoxAsset && readBoxAsset && deleteBoxAsset);

  React.useEffect(() => {
    if (!hasImage || !hasImageAsset) {
      setPreview({ status: "idle" });
      return;
    }

    if (!readBoxAsset) {
      setPreview({ status: "error" });
      return;
    }

    let cancelled = false;
    setPreview({ status: "loading" });
    void readBoxAsset(region.assetPath!)
      .then((resource) => {
        if (cancelled) {
          return;
        }
        if (typeof resource.resourceUrl === "string" && resource.resourceUrl.trim().length > 0) {
          setPreview({
            status: "ready",
            resourceUrl: resource.resourceUrl,
          });
          return;
        }
        setPreview({ status: "error" });
      })
      .catch(() => {
        if (!cancelled) {
          setPreview({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasImage, hasImageAsset, readBoxAsset, region.assetPath]);

  const setErrorWhenMounted = React.useCallback((nextKey: string | undefined) => {
    if (mountedRef.current) {
      setErrorKey(nextKey);
    }
  }, [mountedRef]);

  const deleteExistingAsset = React.useCallback(async (assetPath: string | undefined): Promise<boolean> => {
    if (!assetPath) {
      return true;
    }
    if (!deleteBoxAsset) {
      setErrorWhenMounted("editor.asset_bridge_missing");
      return false;
    }

    setBusyAction("delete");
    try {
      await deleteBoxAsset(assetPath);
      setErrorWhenMounted(undefined);
      return true;
    } catch {
      setErrorWhenMounted("editor.delete_failed");
      return false;
    } finally {
      if (mountedRef.current) {
        setBusyAction(undefined);
      }
    }
  }, [deleteBoxAsset, mountedRef, setErrorWhenMounted]);

  const applyMode = React.useCallback(async (nextMode: FrameMode) => {
    if (nextMode === region.mode) {
      return;
    }

    if (region.mode === "image" && nextMode !== "image") {
      const deleted = await deleteExistingAsset(region.assetPath);
      if (!deleted) {
        return;
      }
    }

    setErrorWhenMounted(undefined);
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
  }, [deleteExistingAsset, onChange, region, setErrorWhenMounted]);

  const handleUpload = React.useCallback(async (file: File | undefined) => {
    if (!file) {
      return;
    }
    if (!hasBridge) {
      setErrorWhenMounted("editor.asset_bridge_missing");
      return;
    }

    setBusyAction("import");
    try {
      const imported = await importBoxAsset!({
        file,
        preferredPath: buildPreferredAssetPath(preferredAssetPrefix, file),
      });
      if (!isSafeBoxAssetPath(imported.assetPath)) {
        setErrorWhenMounted("editor.imported_asset_path_invalid");
        return;
      }

      const previousAssetPath = region.mode === "image" ? region.assetPath : undefined;
      onChange({
        mode: "image",
        assetPath: imported.assetPath,
      });
      setErrorWhenMounted(undefined);

      if (previousAssetPath && previousAssetPath !== imported.assetPath) {
        try {
          await deleteBoxAsset!(previousAssetPath);
        } catch {
          setErrorWhenMounted("editor.delete_failed");
        }
      }
    } catch {
      setErrorWhenMounted("editor.import_failed");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (mountedRef.current) {
        setBusyAction(undefined);
      }
    }
  }, [
    deleteBoxAsset,
    hasBridge,
    importBoxAsset,
    mountedRef,
    onChange,
    preferredAssetPrefix,
    region.assetPath,
    region.mode,
    setErrorWhenMounted,
  ]);

  const handleRemove = React.useCallback(async () => {
    if (region.mode !== "image") {
      return;
    }
    const deleted = await deleteExistingAsset(region.assetPath);
    if (!deleted) {
      return;
    }

    setErrorWhenMounted(undefined);
    onChange({
      mode: "none",
    });
  }, [deleteExistingAsset, onChange, region.assetPath, region.mode, setErrorWhenMounted]);

  const handleClearCode = React.useCallback(() => {
    if (region.mode !== "html") {
      return;
    }
    setErrorWhenMounted(undefined);
    onChange({
      mode: "html",
      html: "",
    });
  }, [onChange, region.mode, setErrorWhenMounted]);

  const handleFilePick = React.useCallback(() => {
    if (hasBridge && busyAction === undefined) {
      fileInputRef.current?.click();
    }
  }, [busyAction, hasBridge]);

  const handleDrop = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleUpload(file);
    }
  }, [handleUpload]);

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

  const dropZoneDisabled = !hasBridge || busyAction !== undefined;

  return (
    <div
      className="chips-box-layout-editor__group"
      data-frame-region-editor={id}
    >
      <div className="chips-box-layout-editor__row">
        <span className="chips-box-layout-editor__row-label">{title}</span>
        <Segmented
          value={region.mode}
          aria-label={title}
          options={modeOptions}
          onChange={(value) => {
            void applyMode(value as FrameMode);
          }}
        />
      </div>

      {hasImage ? (
        <div className="chips-box-layout-editor__image-area">
          <div
            className={[
              "chips-box-layout-editor__drop-zone",
              hasImageAsset ? "chips-box-layout-editor__drop-zone--filled" : "",
              dragging ? "chips-box-layout-editor__drop-zone--dragging" : "",
              dropZoneDisabled ? "chips-box-layout-editor__drop-zone--disabled" : "",
            ].filter(Boolean).join(" ")}
            data-drop-zone
            data-state={hasImageAsset ? "filled" : "empty"}
            role="button"
            tabIndex={dropZoneDisabled ? -1 : 0}
            aria-label={hasImageAsset
              ? formatMessage("editor.replace_hint")
              : formatMessage("editor.drop_zone_hint")}
            onClick={handleFilePick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleFilePick();
              }
            }}
            onDragOver={(event) => {
              if (dropZoneDisabled) {
                return;
              }
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => {
              setDragging(false);
            }}
            onDrop={handleDrop}
          >
            {hasImageAsset ? (
              preview.status === "loading" ? (
                <span className="chips-box-layout-editor__drop-zone-status">
                  {formatMessage("editor.asset_loading")}
                </span>
              ) : preview.status === "ready" && preview.resourceUrl ? (
                <React.Fragment>
                  <img
                    className="chips-box-layout-editor__drop-zone-image"
                    src={preview.resourceUrl}
                    alt={title}
                  />
                  <span className="chips-box-layout-editor__drop-zone-overlay">
                    {formatMessage("editor.replace_hint")}
                  </span>
                </React.Fragment>
              ) : (
                <span className="chips-box-layout-editor__drop-zone-status">
                  {formatMessage("editor.read_failed")}
                </span>
              )
            ) : (
              <span className="chips-box-layout-editor__drop-zone-empty">
                <PictureOutlined style={{ fontSize: 22 }} />
                {formatMessage("editor.drop_zone_hint")}
              </span>
            )}
          </div>

          {hasImageAsset ? (
            <div className="chips-box-layout-editor__row-actions">
              <Button
                type="text"
                danger
                size="small"
                className="chips-box-layout-editor__remove-button"
                disabled={busyAction !== undefined}
                onClick={() => {
                  void handleRemove();
                }}
              >
                {formatMessage("editor.remove_image")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {region.mode === "html" ? (
        <div className="chips-box-layout-editor__code-area">
          <Input.TextArea
            value={region.html ?? ""}
            aria-label={title}
            placeholder={formatMessage("editor.html_placeholder")}
            rows={3}
            style={{ resize: "block" }}
            onChange={(event) => {
              setErrorWhenMounted(undefined);
              onChange({
                mode: "html",
                html: event.target.value,
              });
            }}
          />
          <div className="chips-box-layout-editor__row-actions">
            <Button
              type="text"
              danger
              size="small"
              className="chips-box-layout-editor__remove-button"
              disabled={!hasFrameRegionContent(region) || busyAction !== undefined}
              onClick={handleClearCode}
            >
              {formatMessage("editor.clear_code")}
            </Button>
          </div>
        </div>
      ) : null}

      {errorKey ? (
        <p className="chips-box-layout-editor__error" role="alert">
          {formatMessage(errorKey)}
        </p>
      ) : null}

      {hasImage && !hasBridge ? (
        <p className="chips-box-layout-editor__error" role="alert">
          {formatMessage("editor.asset_bridge_missing")}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void handleUpload(event.currentTarget.files?.[0]);
        }}
      />
    </div>
  );
}
