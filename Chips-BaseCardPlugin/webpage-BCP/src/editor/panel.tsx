import React, { useEffect, useId, useRef, useState } from "react";
import { Button, ConfigProvider, Input, Segmented } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type {
  BasecardArchiveImportRequest,
  BasecardArchiveImportResult,
} from "../index";
import {
  defaultBasecardConfig,
  normalizeBasecardConfig,
  type BasecardConfig,
  type WebpageDisplayMode,
  type WebpageSourceType,
} from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import { cloneConfig, dedupeResourcePaths, validateWebpageUrl } from "../shared/utils";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  importArchiveBundle?: (input: BasecardArchiveImportRequest) => Promise<BasecardArchiveImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
}

type EditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

const AUTO_URL_SYNC_DELAY_MS = 360;

const WEBPAGE_BUNDLE_INCLUDE_RULE: NonNullable<BasecardArchiveImportRequest["include"]> = {
  mimeTypes: [
    "text/html",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/x-javascript",
    "application/json",
    "application/manifest+json",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/x-icon",
    "font/woff",
    "font/woff2",
    "application/font-woff",
    "application/font-woff2",
    "font/ttf",
    "font/otf",
    "application/vnd.ms-fontobject",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "application/wasm",
    "application/pdf",
  ],
  extensions: [
    ".html",
    ".htm",
    ".css",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".webmanifest",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".mp4",
    ".webm",
    ".mp3",
    ".ogg",
    ".wav",
    ".wasm",
    ".pdf",
    ".map",
  ],
};

const EDITOR_STYLE_TEXT = `
.chips-webpage-editor {
  width: 100%;
  min-height: 0;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  overflow: auto;
  color: #1d1d1f;
}

.chips-webpage-editor__group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #f2f2f7;
}

.chips-webpage-editor__group--summary {
  gap: 14px;
}

.chips-webpage-editor__header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chips-webpage-editor__section-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.chips-webpage-editor__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(29, 29, 31, 0.72);
}

.chips-webpage-editor__dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  border-radius: 16px;
  border: 1px dashed rgba(0, 0, 0, 0.18);
  background:
    linear-gradient(
      145deg,
      rgba(10, 132, 255, 0.06),
      rgba(0, 0, 0, 0.04)
    ),
    #ffffff;
  cursor: pointer;
  transition: border-color 120ms ease, transform 120ms ease, background-color 120ms ease;
}

.chips-webpage-editor__dropzone:hover {
  border-color: rgba(10, 132, 255, 0.5);
}

.chips-webpage-editor__dropzone--active {
  transform: translateY(-1px);
  border-color: rgba(10, 132, 255, 0.74);
  background:
    linear-gradient(
      145deg,
      rgba(10, 132, 255, 0.12),
      rgba(10, 132, 255, 0.06)
    ),
    #ffffff;
}

.chips-webpage-editor__dropzone[aria-disabled="true"] {
  opacity: 0.68;
  cursor: default;
}

.chips-webpage-editor__dropzone-title {
  font-size: 14px;
  font-weight: 700;
}

.chips-webpage-editor__dropzone-text {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(29, 29, 31, 0.72);
}

.chips-webpage-editor__file-input {
  display: none;
}

.chips-webpage-editor__current {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chips-webpage-editor__current-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
}

.chips-webpage-editor__meta {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(29, 29, 31, 0.74);
  word-break: break-word;
}

.chips-webpage-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chips-webpage-editor__status {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(29, 29, 31, 0.76);
}

.chips-webpage-editor__segmented .ant-segmented {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 8px;
  width: fit-content;
  max-width: 100%;
  padding: 6px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.08);
}

.chips-webpage-editor__segmented .ant-segmented-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 88px;
  min-height: 40px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  padding: 0 14px;
}

.chips-webpage-editor__segmented .ant-segmented-item-selected {
  background: #0a84ff;
  color: #ffffff;
}

.chips-webpage-editor__segmented-option {
  display: grid;
  gap: 3px;
  text-align: start;
}

.chips-webpage-editor__segmented-option-title {
  font-size: 13px;
  font-weight: 700;
}

.chips-webpage-editor__segmented-option-description {
  font-size: 11px;
  line-height: 1.45;
  opacity: 0.82;
}

.chips-webpage-editor__url-field {
  display: grid;
  gap: 8px;
}

.chips-webpage-editor__url-label {
  font-size: 12px;
  font-weight: 600;
  color: rgba(29, 29, 31, 0.84);
}

.chips-webpage-editor__url-input.ant-input {
  width: 100%;
  min-height: 42px;
  padding: 0 13px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
  color: #1d1d1f;
  box-sizing: border-box;
  font: inherit;
}

.chips-webpage-editor__url-hint,
.chips-webpage-editor__url-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
}

.chips-webpage-editor__url-hint {
  color: rgba(29, 29, 31, 0.72);
}

.chips-webpage-editor__url-error {
  color: #ff3b30;
}

.chips-webpage-editor__button {
  min-height: 38px;
  border: 0;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.08);
  color: #1d1d1f;
  padding: 0 14px;
}

.chips-webpage-editor__button-content,
.chips-webpage-editor__dropzone-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
`;

function removeAllBundleResources(
  resourcePaths: readonly string[],
  deleteResource?: (resourcePath: string) => Promise<void>,
): Promise<void> {
  if (!deleteResource) {
    return Promise.resolve();
  }

  return dedupeResourcePaths(resourcePaths).reduce(
    (task, resourcePath) => task.then(() => deleteResource(resourcePath)),
    Promise.resolve(),
  );
}

function createClearedConfig(config: BasecardConfig): BasecardConfig {
  return normalizeBasecardConfig({
    ...config,
    source_type: "url",
    source_url: "",
    bundle_root: "",
    entry_file: "index.html",
    resource_paths: [],
  });
}

function createSegmentedOption(
  title: string,
  description?: string,
  dataAttributes?: Record<string, string>,
): React.ReactElement {
  return (
    <span className="chips-webpage-editor__segmented-option" {...dataAttributes}>
      <span className="chips-webpage-editor__segmented-option-title">{title}</span>
      {description ? (
        <span className="chips-webpage-editor__segmented-option-description">{description}</span>
      ) : null}
    </span>
  );
}

function WebpageCardEditor(props: BasecardEditorProps) {
  const [config, setConfig] = useState<BasecardConfig>(
    () => normalizeBasecardConfig(cloneConfig(props.initialConfig as unknown as Record<string, unknown>)),
  );
  const [sourceMode, setSourceMode] = useState<WebpageSourceType>(config.source_type);
  const [urlInput, setUrlInput] = useState(config.source_url ?? "");
  const [statusText, setStatusText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const configRef = useRef(config);
  const mutationIdRef = useRef(0);
  const applyUrlSourceRef = useRef<(inputValue: string) => void>(() => undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputId = useId();

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const emitChange = (nextConfig: BasecardConfig) => {
    setConfig(nextConfig);
    props.onChange(nextConfig);
  };

  const applyDisplayMode = (nextMode: WebpageDisplayMode) => {
    if (configRef.current.display_mode === nextMode) {
      return;
    }

    const nextConfig = normalizeBasecardConfig({
      ...configRef.current,
      display_mode: nextMode,
      fixed_ratio: "7:16",
      max_height_ratio: 20,
    });
    emitChange(nextConfig);
    setErrorText("");
    setStatusText("");
  };

  const beginMutation = (): number => {
    mutationIdRef.current += 1;
    return mutationIdRef.current;
  };

  const isLatestMutation = (mutationId: number): boolean => mutationIdRef.current === mutationId;

  const switchSourceMode = (nextMode: WebpageSourceType) => {
    setSourceMode(nextMode);
    setErrorText("");
    setStatusText("");
  };

  const applyUrlSource = async (inputValue: string) => {
    const mutationId = beginMutation();
    const nextUrl = inputValue.trim();
    if (!validateWebpageUrl(nextUrl)) {
      if (isLatestMutation(mutationId)) {
        setErrorText(formatMessage("editor.invalid_url"));
        setStatusText("");
      }
      return;
    }

    const currentConfig = configRef.current;
    if (currentConfig.source_type === "url" && currentConfig.source_url === nextUrl) {
      if (isLatestMutation(mutationId)) {
        setErrorText("");
        setStatusText("");
      }
      return;
    }

    try {
      if (!isLatestMutation(mutationId)) {
        return;
      }
      if (currentConfig.source_type === "bundle" && currentConfig.resource_paths.length > 0) {
        await removeAllBundleResources(currentConfig.resource_paths, props.deleteResource);
      }
      if (!isLatestMutation(mutationId)) {
        return;
      }

      const nextConfig = normalizeBasecardConfig({
        ...currentConfig,
        source_type: "url",
        source_url: nextUrl,
        bundle_root: "",
        entry_file: "index.html",
        resource_paths: [],
      });
      emitChange(nextConfig);
      setErrorText("");
      setStatusText(formatMessage("editor.url_updated"));
    } catch (error) {
      if (!isLatestMutation(mutationId)) {
        return;
      }
      setErrorText(error instanceof Error ? error.message : formatMessage("editor.clear_failed"));
      setStatusText("");
    }
  };

  const clearSource = async () => {
    const mutationId = beginMutation();
    const currentConfig = configRef.current;

    try {
      if (!isLatestMutation(mutationId)) {
        return;
      }
      if (currentConfig.source_type === "bundle" && currentConfig.resource_paths.length > 0) {
        await removeAllBundleResources(currentConfig.resource_paths, props.deleteResource);
      }
      if (!isLatestMutation(mutationId)) {
        return;
      }

      const clearedConfig = createClearedConfig(currentConfig);
      emitChange(clearedConfig);
      setSourceMode("url");
      setUrlInput("");
      setErrorText("");
      setStatusText(formatMessage("editor.source_cleared"));
    } catch (error) {
      if (!isLatestMutation(mutationId)) {
        return;
      }
      setErrorText(error instanceof Error ? error.message : formatMessage("editor.clear_failed"));
      setStatusText("");
    }
  };

  const importBundleFile = async (file: File) => {
    if (!props.importArchiveBundle) {
      setErrorText(formatMessage("editor.import_unsupported"));
      setStatusText("");
      return;
    }

    const mutationId = beginMutation();
    setIsImporting(true);
    setErrorText("");
    setStatusText("");

    try {
      const result = await props.importArchiveBundle({
        file,
        preferredRootDir: "webpage-bundle",
        entryFile: "index.html",
        include: WEBPAGE_BUNDLE_INCLUDE_RULE,
        stripSingleRootDir: true,
        excludeSystemArtifacts: true,
      });
      const currentConfig = configRef.current;

      if (!isLatestMutation(mutationId)) {
        return;
      }
      if (currentConfig.source_type === "bundle" && currentConfig.resource_paths.length > 0) {
        await removeAllBundleResources(currentConfig.resource_paths, props.deleteResource);
      }
      if (!isLatestMutation(mutationId)) {
        return;
      }

      const nextConfig = normalizeBasecardConfig({
        ...currentConfig,
        source_type: "bundle",
        source_url: "",
        bundle_root: result.rootDir,
        entry_file: result.entryFile ?? "index.html",
        resource_paths: dedupeResourcePaths(result.resourcePaths),
      });
      emitChange(nextConfig);
      setSourceMode("bundle");
      setErrorText("");
      setStatusText(formatMessage("editor.import_success"));
    } catch (error) {
      if (!isLatestMutation(mutationId)) {
        return;
      }
      setErrorText(error instanceof Error ? error.message : formatMessage("editor.import_failed"));
      setStatusText("");
    } finally {
      if (isLatestMutation(mutationId)) {
        setIsImporting(false);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  applyUrlSourceRef.current = (inputValue: string) => {
    void applyUrlSource(inputValue);
  };

  useEffect(() => {
    if (sourceMode !== "url") {
      return;
    }

    const nextUrl = urlInput.trim();
    if (nextUrl.length === 0) {
      setErrorText("");
      return;
    }

    const timerId = window.setTimeout(() => {
      applyUrlSourceRef.current(nextUrl);
    }, AUTO_URL_SYNC_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [sourceMode, urlInput]);

  const currentSourceDescription = config.source_type === "bundle" && config.bundle_root
    ? formatMessage("editor.current_bundle")
    : config.source_type === "url" && config.source_url
      ? formatMessage("editor.current_url")
      : formatMessage("editor.current_empty");
  const currentDisplayDescription = config.display_mode === "fixed"
    ? formatMessage("editor.ratio_fixed_current")
    : formatMessage("editor.ratio_free_current");

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    void importBundleFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    if (isImporting) {
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    void importBundleFile(file);
  };

  return (
    <form
      className="chips-webpage-editor"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <section className="chips-webpage-editor__group">
        <div className="chips-webpage-editor__header">
          <h2 className="chips-webpage-editor__section-title">{formatMessage("editor.ratio_title")}</h2>
          <p className="chips-webpage-editor__hint">{formatMessage("editor.ratio_hint")}</p>
        </div>
        <div className="chips-webpage-editor__segmented">
          <Segmented
            value={config.display_mode}
            aria-label={formatMessage("editor.ratio_title")}
            options={[
              {
                value: "fixed",
                label: createSegmentedOption(
                  formatMessage("editor.ratio_fixed"),
                  formatMessage("editor.ratio_fixed_hint"),
                  { "data-display-mode": "fixed" },
                ),
              },
              {
                value: "free",
                label: createSegmentedOption(
                  formatMessage("editor.ratio_free"),
                  formatMessage("editor.ratio_free_hint"),
                  { "data-display-mode": "free" },
                ),
              },
            ]}
            onChange={(value) => {
              applyDisplayMode(value as WebpageDisplayMode);
            }}
          />
        </div>
      </section>

      <section className="chips-webpage-editor__group">
        <div className="chips-webpage-editor__header">
          <h2 className="chips-webpage-editor__section-title">{formatMessage("editor.mode_title")}</h2>
          <p className="chips-webpage-editor__hint">{formatMessage("editor.mode_hint")}</p>
        </div>
        <div className="chips-webpage-editor__segmented">
          <Segmented
            value={sourceMode}
            aria-label={formatMessage("editor.mode_title")}
            options={[
              {
                value: "url",
                label: createSegmentedOption(formatMessage("editor.mode_url"), undefined, { "data-source-mode": "url" }),
              },
              {
                value: "bundle",
                label: createSegmentedOption(formatMessage("editor.mode_bundle"), undefined, { "data-source-mode": "bundle" }),
              },
            ]}
            onChange={(value) => {
              switchSourceMode(value as WebpageSourceType);
            }}
          />
        </div>
      </section>

      <section className="chips-webpage-editor__group">
        {sourceMode === "url" ? (
          <div className="chips-webpage-editor__url-field">
            <label className="chips-webpage-editor__url-label" htmlFor={`${fileInputId}-url`}>
              {formatMessage("editor.url_title")}
            </label>
            <Input
              id={`${fileInputId}-url`}
              className="chips-webpage-editor__url-input"
              value={urlInput}
              placeholder={formatMessage("editor.url_placeholder")}
              status={sourceMode === "url" && errorText ? "error" : undefined}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => {
                setUrlInput(event.target.value);
              }}
            />
            <p className="chips-webpage-editor__url-hint">{formatMessage("editor.url_hint")}</p>
            {sourceMode === "url" && errorText && (
              <p className="chips-webpage-editor__url-error">{errorText}</p>
            )}
          </div>
        ) : (
          <>
            <div
              className={`chips-webpage-editor__dropzone ${isDragActive ? "chips-webpage-editor__dropzone--active" : ""}`}
              data-drop-active={isDragActive ? "true" : "false"}
              role="button"
              tabIndex={isImporting ? -1 : 0}
              aria-disabled={isImporting ? "true" : "false"}
              onClick={() => {
                if (!isImporting) {
                  fileInputRef.current?.click();
                }
              }}
              onKeyDown={(event) => {
                if (isImporting) {
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!isImporting) {
                  setIsDragActive(true);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isImporting) {
                  event.dataTransfer.dropEffect = "copy";
                  setIsDragActive(true);
                }
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  return;
                }
                setIsDragActive(false);
              }}
              onDrop={handleDrop}
            >
              <input
                id={fileInputId}
                ref={fileInputRef}
                className="chips-webpage-editor__file-input"
                type="file"
                accept=".zip,application/zip"
                disabled={isImporting}
                onChange={handleFileInputChange}
              />
              <strong className="chips-webpage-editor__dropzone-title">
                <UploadOutlined aria-hidden="true" style={{ fontSize: 18 }} />
                {isImporting ? formatMessage("editor.importing") : formatMessage("editor.bundle_upload_title")}
              </strong>
              <p className="chips-webpage-editor__dropzone-text">{formatMessage("editor.bundle_hint")}</p>
              <p className="chips-webpage-editor__dropzone-text">{formatMessage("editor.bundle_supported")}</p>
              <p className="chips-webpage-editor__dropzone-text">{formatMessage("editor.bundle_upload_action")}</p>
            </div>
            {sourceMode === "bundle" && errorText && (
              <p className="chips-webpage-editor__url-error">{errorText}</p>
            )}
          </>
        )}
      </section>

      <section className="chips-webpage-editor__group chips-webpage-editor__group--summary">
        <div className="chips-webpage-editor__current">
          <h2 className="chips-webpage-editor__section-title">{formatMessage("editor.current_title")}</h2>
          <p className="chips-webpage-editor__meta">{currentDisplayDescription}</p>
          <p className="chips-webpage-editor__current-text">{currentSourceDescription}</p>
          {config.source_type === "url" && config.source_url && (
            <p className="chips-webpage-editor__meta">{config.source_url}</p>
          )}
          {config.source_type === "bundle" && config.bundle_root && (
            <>
              <p className="chips-webpage-editor__meta">
                {formatMessage("editor.bundle_root", { rootDir: config.bundle_root })}
              </p>
              <p className="chips-webpage-editor__meta">
                {formatMessage("editor.bundle_entry", { entryFile: config.entry_file ?? "index.html" })}
              </p>
              <p className="chips-webpage-editor__meta">
                {formatMessage("editor.bundle_files", { count: config.resource_paths.length })}
              </p>
            </>
          )}
        </div>
        <div className="chips-webpage-editor__actions">
          <Button
            type="default"
            className="chips-webpage-editor__button"
            disabled={isImporting}
            onClick={() => {
              void clearSource();
            }}
          >
            <span className="chips-webpage-editor__button-content">
              <DeleteOutlined aria-hidden="true" style={{ fontSize: 16 }} />
              <span>{formatMessage("editor.clear_source")}</span>
            </span>
          </Button>
        </div>
      </section>

      {statusText && !errorText && (
        <p className="chips-webpage-editor__status" aria-live="polite">{statusText}</p>
      )}
    </form>
  );
}

export function createBasecardEditorRoot(props: BasecardEditorProps): EditorRoot {
  const container = document.createElement("div") as EditorRoot;
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.minHeight = "0";
  container.style.display = "flex";

  const root: Root = createRoot(container);
  flushSync(() => {
    root.render(
      React.createElement(
        ConfigProvider,
        { locale: zhCN, theme: appleTheme },
        React.createElement("style", null, EDITOR_STYLE_TEXT),
        React.createElement(WebpageCardEditor, {
          ...props,
          initialConfig: normalizeBasecardConfig(props.initialConfig ?? defaultBasecardConfig),
        }),
      ),
    );
  });

  container.__chipsDispose = () => {
    root.unmount();
  };

  return container;
}
