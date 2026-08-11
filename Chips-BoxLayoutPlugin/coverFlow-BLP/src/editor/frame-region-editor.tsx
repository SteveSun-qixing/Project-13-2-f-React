import React from "react";
import { Button, Input, Result, Segmented, Space } from "antd";
import { EmbeddedDocumentFrame } from "@chips/ui";
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
  description: string;
  previewRatio?: string;
  previewAutoHeight?: boolean;
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

interface PreviewState {
  status: "idle" | "loading" | "ready" | "error";
  resourceUrl?: string;
}

function FrameRegionPreview({
  region,
  title,
  ratio,
  autoHeight,
  readBoxAsset,
}: {
  region: FrameRegionConfig;
  title: string;
  ratio?: string;
  autoHeight?: boolean;
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>;
}) {
  const [state, setState] = React.useState<PreviewState>({ status: "idle" });

  React.useEffect(() => {
    if (region.mode !== "image" || !region.assetPath) {
      setState({ status: "idle" });
      return;
    }

    if (!readBoxAsset) {
      setState({
        status: "error",
      });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void readBoxAsset(region.assetPath)
      .then((resource) => {
        if (cancelled) {
          return;
        }
        if (typeof resource.resourceUrl === "string" && resource.resourceUrl.trim().length > 0) {
          setState({
            status: "ready",
            resourceUrl: resource.resourceUrl,
          });
          return;
        }
        setState({
          status: "error",
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({
            status: "error",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [readBoxAsset, region.assetPath, region.mode]);

  if (region.mode === "html" && region.html) {
    return (
      <EmbeddedDocumentFrame
        title={title}
        srcDoc={region.html}
        ratio={autoHeight ? undefined : ratio}
        autoHeight={autoHeight}
        maxHeightFactor={autoHeight ? 3 : undefined}
        sandbox="allow-scripts"
      />
    );
  }

  if (region.mode === "image" && state.status === "ready" && state.resourceUrl) {
    return (
      <img
        data-frame-region-preview-image
        src={state.resourceUrl}
        alt={title}
      />
    );
  }

  if (region.mode === "image" && state.status === "loading") {
    return (
      <div data-frame-region-preview-status role="status">
        {formatMessage("editor.asset_loading")}
      </div>
    );
  }

  if (region.mode === "image" && state.status === "error") {
    return (
      <div data-frame-region-preview-status role="status">
        {formatMessage("editor.read_failed")}
      </div>
    );
  }

  return (
    <div data-frame-region-preview-status>
      {formatMessage("editor.frame_empty")}
    </div>
  );
}

export function FrameRegionEditor({
  id,
  region,
  title,
  description,
  previewRatio,
  previewAutoHeight = false,
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
  const hasContent = hasFrameRegionContent(region);
  const hasImageAssetBridge = Boolean(importBoxAsset && readBoxAsset && deleteBoxAsset);
  const imageBridgeMissing = region.mode === "image" && !hasImageAssetBridge;

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
    if (!importBoxAsset || !readBoxAsset || !deleteBoxAsset) {
      setErrorWhenMounted("editor.asset_bridge_missing");
      return;
    }

    setBusyAction("import");
    try {
      const imported = await importBoxAsset({
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
          await deleteBoxAsset(previousAssetPath);
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
    importBoxAsset,
    mountedRef,
    onChange,
    preferredAssetPrefix,
    readBoxAsset,
    region.assetPath,
    region.mode,
    setErrorWhenMounted,
  ]);

  const handleClear = React.useCallback(async () => {
    if (region.mode === "image") {
      const deleted = await deleteExistingAsset(region.assetPath);
      if (!deleted) {
        return;
      }
    }

    setErrorWhenMounted(undefined);
    onChange({
      mode: "none",
    });
  }, [deleteExistingAsset, onChange, region.assetPath, region.mode, setErrorWhenMounted]);

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
    <div
      className="chips-coverflow-layout-editor__group"
      data-frame-region-editor={id}
    >
      <div className="chips-coverflow-layout-editor__region-head">
        <div className="chips-coverflow-layout-editor__row">
          <span className="chips-coverflow-layout-editor__row-label">{title}</span>
          <Segmented
            value={region.mode}
            aria-label={formatMessage("editor.frame_mode")}
            options={modeOptions}
            onChange={(value) => {
              void applyMode(value as FrameMode);
            }}
          />
        </div>
        <p className="chips-coverflow-layout-editor__region-desc">{description}</p>
      </div>

      {region.mode === "image" ? (
        <div className="chips-coverflow-layout-editor__image-area">
          <Space wrap className="chips-coverflow-layout-editor__asset-toolbar">
            <Button
              type="default"
              size="small"
              disabled={!hasImageAssetBridge || busyAction === "delete"}
              loading={busyAction === "import"}
              onClick={() => {
                fileInputRef.current?.click();
              }}
            >
              {formatMessage(region.assetPath ? "editor.replace_image" : "editor.upload_image")}
            </Button>
            <Button
              type="text"
              danger
              size="small"
              className="chips-coverflow-layout-editor__remove-button"
              disabled={!hasContent || busyAction === "import"}
              loading={busyAction === "delete"}
              onClick={() => {
                void handleClear();
              }}
            >
              {formatMessage("editor.clear_asset")}
            </Button>
          </Space>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              void handleUpload(event.currentTarget.files?.[0]);
            }}
          />
          <span className="chips-coverflow-layout-editor__asset-path" data-frame-region-asset-path>
            {region.assetPath ?? formatMessage("editor.frame_empty")}
          </span>
          <p className="chips-coverflow-layout-editor__group-footer">
            {formatMessage("editor.asset_hint")}
          </p>
          {errorKey ? (
            <p className="chips-coverflow-layout-editor__error" role="alert">
              {formatMessage(errorKey)}
            </p>
          ) : null}
          {imageBridgeMissing ? (
            <Result
              status="error"
              className="chips-coverflow-layout-editor__bridge-warning"
              title={formatMessage("editor.asset_bridge_missing")}
              subTitle={formatMessage("editor.asset_bridge_missing_desc")}
            />
          ) : null}
        </div>
      ) : null}

      {region.mode === "html" ? (
        <div className="chips-coverflow-layout-editor__code-area">
          <Input.TextArea
            value={region.html ?? ""}
            aria-label={formatMessage("editor.html")}
            placeholder={formatMessage("editor.html_placeholder")}
            rows={10}
            style={{ resize: "block" }}
            onChange={(event) => {
              setErrorWhenMounted(undefined);
              onChange({
                mode: "html",
                html: event.target.value,
              });
            }}
          />
          <p className="chips-coverflow-layout-editor__group-footer">
            {formatMessage("editor.html_hint")}
          </p>
          <div className="chips-coverflow-layout-editor__row-actions">
            <Button
              type="text"
              danger
              size="small"
              className="chips-coverflow-layout-editor__remove-button"
              disabled={!hasContent || busyAction !== undefined}
              onClick={() => {
                void handleClear();
              }}
            >
              {formatMessage("editor.clear_asset")}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="chips-coverflow-layout-editor__preview-shell" data-frame-region-preview-shell>
        <span className="chips-coverflow-layout-editor__preview-label" data-frame-region-preview-label>
          {formatMessage("editor.preview")}
        </span>
        <div
          className="chips-coverflow-layout-editor__preview"
          data-frame-region-preview
          style={!previewAutoHeight && previewRatio
            ? { aspectRatio: previewRatio.replace(":", " / ") }
            : undefined}
        >
          <FrameRegionPreview
            region={region}
            title={title}
            ratio={previewRatio}
            autoHeight={previewAutoHeight}
            readBoxAsset={readBoxAsset}
          />
        </div>
      </div>
    </div>
  );
}
