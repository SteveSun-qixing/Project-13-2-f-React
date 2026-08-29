import React, { useEffect, useRef, useState } from "react";
import { Button, ConfigProvider, Progress, Result } from "antd";
import { FileAddOutlined } from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { BasecardResourceImportRequest, BasecardResourceImportResult } from "../index";
import {
  normalizeBasecardConfig,
  validateBasecardConfig,
  type BasecardConfig,
} from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import { formatExtensionBadge } from "../shared/utils";
import {
  cloneConfig,
  resolveFileExtension,
  sanitizeImportedFileName,
  stripFileExtension,
} from "../shared/utils";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (
    input: BasecardResourceImportRequest,
  ) => Promise<BasecardResourceImportResult>;
  importArchiveBundle?: (
    input: { file: File; preferredRootDir?: string; entryFile?: string },
  ) => Promise<{ rootDir: string; entryFile?: string; resourcePaths: string[] }>;
  deleteResource?: (resourcePath: string) => Promise<void>;
  convertTiffToPng?: (
    input: { resourcePath: string; outputPath: string; overwrite?: boolean },
  ) => Promise<{ path: string; mimeType: "image/png"; sourceMimeType: "image/tiff" }>;
}

type EditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

const EDITOR_STYLE_TEXT = `
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

.chips-file-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 12px clamp(12px, 3vw, 18px) 24px;
  color: #1d1d1f;
  background: #ffffff;
  font: 14px/1.55 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-file-editor,
.chips-file-editor * {
  box-sizing: border-box;
}

.chips-file-editor__shell {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.chips-file-editor__alert {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(242, 242, 247, 0.92);
  color: #1d1d1f;
  font-size: 13px;
}

.chips-file-editor__alert--error {
  color: #ff3b30;
}

.chips-file-editor__alert .ant-result {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0;
  background: transparent;
}

.chips-file-editor__alert .ant-result-icon {
  margin: 0;
  line-height: 1.4;
}

.chips-file-editor__alert .ant-result-title {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: inherit;
}

.chips-file-editor__alert .ant-result-subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: inherit;
}

.chips-file-editor__errors-list {
  margin: 8px 0 0;
  padding-left: 18px;
}

.chips-file-editor__group {
  padding-top: 4px;
}

.chips-file-editor__group + .chips-file-editor__group {
  margin-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.chips-file-editor__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 2px;
}

.chips-file-editor__group-title {
  margin: 0;
  color: #1d1d1f;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.chips-file-editor__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: #0a84ff;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.chips-file-editor__status .ant-progress {
  width: 42px;
  min-width: 42px;
  margin-inline-end: 2px;
}

.chips-file-editor__row {
  display: grid;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.chips-file-editor__row:last-child {
  border-bottom: none;
}

.chips-file-editor__row-label {
  margin: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  font-weight: 650;
  color: #1d1d1f;
}

.chips-file-editor__label-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
  font-size: 11px;
  font-weight: 700;
}

.chips-file-editor__row-body {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.chips-file-editor__dropzone {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 16px;
  border: 1.5px dashed rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  background: transparent;
  color: #1d1d1f;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.chips-file-editor__dropzone[data-state="dragover"] {
  border-color: rgba(10, 132, 255, 0.34);
  background: rgba(10, 132, 255, 0.06);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.08);
}

.chips-file-editor__dropzone[data-state="busy"] {
  cursor: progress;
}

.chips-file-editor__dropzone:hover,
.chips-file-editor__dropzone:focus-within {
  border-color: rgba(10, 132, 255, 0.28);
}

.chips-file-editor__dropzone-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.chips-file-editor__dropzone-content {
  display: grid;
  justify-items: center;
  gap: 8px;
  pointer-events: none;
}

.chips-file-editor__dropzone-icon {
  font-size: 28px;
  color: #0a84ff;
}

.chips-file-editor__dropzone-text {
  font-size: 14px;
  font-weight: 650;
  color: #1d1d1f;
}

.chips-file-editor__dropzone-note {
  color: #6e6e73;
  font-size: 12px;
}

.chips-file-editor__resource-tile {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: #ffffff;
}

.chips-file-editor__resource-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  min-width: 0;
}

.chips-file-editor__resource-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
  font-size: 12px;
  font-weight: 700;
}

.chips-file-editor__resource-name {
  min-width: 0;
  font-size: 15px;
  font-weight: 700;
  color: #1d1d1f;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.chips-file-editor__resource-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}

.chips-file-editor__field-list {
  display: grid;
  gap: 0;
  min-width: 0;
}

.chips-file-editor__field-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.chips-file-editor__field-row:last-child {
  border-bottom: none;
}

.chips-file-editor__field-label {
  padding-top: 2px;
  font-size: 13px;
  font-weight: 650;
  color: #1d1d1f;
}

.chips-file-editor__field-value {
  min-width: 0;
  color: #6e6e73;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.chips-file-editor__hint {
  color: #6e6e73;
  font-size: 12px;
}

@media (max-width: 560px) {
  .chips-file-editor {
    padding-inline: 12px;
  }

  .chips-file-editor__field-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .chips-file-editor__field-label {
    padding-top: 0;
  }
}
`;

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return fallbackMessage;
}

function splitImportedFileName(fileName: string): { stem: string; extension: string } {
  const trimmed = fileName.trim();
  const stem = stripFileExtension(trimmed);
  if (stem) {
    return { stem, extension: resolveFileExtension(trimmed) };
  }

  return { stem: trimmed, extension: "" };
}

function BasecardEditor(props: BasecardEditorProps) {
  const [config, setConfig] = useState(() => normalizeBasecardConfig(props.initialConfig));
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    validateBasecardConfig(normalizeBasecardConfig(props.initialConfig)).errors,
  );
  const [panelError, setPanelError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const configRef = useRef(config);

  const hasFile = config.file_file.length > 0;
  const extensionBadge = formatExtensionBadge(config.file_extension);

  useEffect(() => {
    const nextConfig = normalizeBasecardConfig(props.initialConfig);
    configRef.current = nextConfig;
    setConfig(nextConfig);
    setErrors(validateBasecardConfig(nextConfig).errors);
  }, [props.initialConfig]);

  const flattenedErrors = Object.entries(errors)
    .filter(([key]) => !(key === "file_file" && !hasFile))
    .map(([, message]) => message);

  function commitConfig(nextConfig: BasecardConfig): void {
    const normalized = normalizeBasecardConfig(nextConfig);
    const validation = validateBasecardConfig(normalized);

    configRef.current = normalized;
    setConfig(normalized);
    setErrors(validation.errors);
    props.onChange(cloneConfig(normalized));
  }

  async function deleteResourceQuietly(resourcePath: string): Promise<void> {
    if (!props.deleteResource) {
      return;
    }

    try {
      await props.deleteResource(resourcePath);
    } catch (error) {
      setPanelError(resolveErrorMessage(error, formatMessage("file.editor.errors.delete_failed")));
    }
  }

  async function handleFileUpload(file: File): Promise<void> {
    if (!props.importResource) {
      setPanelError(formatMessage("file.editor.errors.import_unavailable"));
      return;
    }

    setBusy(true);
    setPanelError("");

    let importedPath: string | undefined;

    try {
      const preferredPath = sanitizeImportedFileName(file.name, "file.bin");
      const imported = await props.importResource({
        file,
        preferredPath,
      });
      importedPath = imported.path;

      const { stem, extension } = splitImportedFileName(file.name);
      commitConfig({
        ...configRef.current,
        file_file: imported.path,
        file_name: stem,
        file_extension: extension,
      });
    } catch (error) {
      if (importedPath) {
        await deleteResourceQuietly(importedPath);
      }
      setPanelError(resolveErrorMessage(error, formatMessage("file.editor.errors.import_failed")));
    } finally {
      setBusy(false);
      setDragOver(false);
    }
  }

  async function handleRemoveFile(): Promise<void> {
    const currentPath = configRef.current.file_file;
    if (!currentPath) {
      return;
    }

    setBusy(true);
    setPanelError("");

    try {
      if (props.deleteResource) {
        await props.deleteResource(currentPath);
      }

      commitConfig({
        ...configRef.current,
        file_file: "",
        file_name: "",
        file_extension: "",
      });
    } catch (error) {
      setPanelError(resolveErrorMessage(error, formatMessage("file.editor.errors.delete_failed")));
    } finally {
      setBusy(false);
    }
  }

  const dropState = busy ? "busy" : dragOver ? "dragover" : "idle";

  return (
    <form
      noValidate
      className="chips-file-editor"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="chips-file-editor__shell">
        {panelError ? (
          <div className="chips-file-editor__alert chips-file-editor__alert--error">
            <Result
              status="error"
              title={formatMessage("file.editor.errors.operation_failed")}
              subTitle={panelError}
            />
          </div>
        ) : null}

        {flattenedErrors.length > 0 ? (
          <div className="chips-file-editor__alert chips-file-editor__alert--error">
            <Result
              status="error"
              title={formatMessage("file.editor.errors.validation_failed")}
              subTitle={flattenedErrors[0]}
            />
            <ul className="chips-file-editor__errors-list">
              {flattenedErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="chips-file-editor__group">
          <div className="chips-file-editor__group-head">
            <span className="chips-file-editor__group-title">
              {formatMessage("file.editor.resources.title")}
            </span>
            {busy ? (
              <span className="chips-file-editor__status">
                <Progress
                  className="chips-file-editor__status-progress"
                  type="line"
                  percent={100}
                  status="active"
                  showInfo={false}
                  size={{ width: 42, height: 6 }}
                  aria-label={formatMessage("file.editor.status.file")}
                />
                {formatMessage("file.editor.status.file")}
              </span>
            ) : null}
          </div>

          <div className="chips-file-editor__row">
            <p className="chips-file-editor__row-label">
              <span>{formatMessage("file.editor.file.title")}</span>
              <span className="chips-file-editor__label-badge">
                {formatMessage("file.editor.badge.required")}
              </span>
            </p>

            {hasFile ? (
              <div className="chips-file-editor__row-body">
                <div className="chips-file-editor__resource-tile" data-role="file-resource">
                  <div className="chips-file-editor__resource-head">
                    <span className="chips-file-editor__resource-badge" aria-hidden="true">
                      {extensionBadge || "—"}
                    </span>
                    <span className="chips-file-editor__resource-name">
                      {config.file_name || config.file_file}
                    </span>
                  </div>
                  <div className="chips-file-editor__resource-actions">
                    <Button
                      type="default"
                      danger
                      data-role="remove-file"
                      disabled={busy}
                      onClick={() => {
                        void handleRemoveFile();
                      }}
                    >
                      {formatMessage("file.editor.actions.remove")}
                    </Button>
                  </div>
                </div>

                <div className="chips-file-editor__field-list">
                  <div className="chips-file-editor__field-row" data-field="file_name">
                    <span className="chips-file-editor__field-label">
                      {formatMessage("file.editor.fields.file_name")}
                    </span>
                    <span className="chips-file-editor__field-value">
                      {config.file_name || "—"}
                    </span>
                  </div>
                  <div className="chips-file-editor__field-row" data-field="file_extension">
                    <span className="chips-file-editor__field-label">
                      {formatMessage("file.editor.fields.file_extension")}
                    </span>
                    <span className="chips-file-editor__field-value">
                      {extensionBadge || "—"}
                    </span>
                  </div>
                </div>
                <p className="chips-file-editor__hint">
                  {formatMessage("file.editor.file.recognized")}
                </p>
              </div>
            ) : (
              <div className="chips-file-editor__row-body">
                <label
                  className="chips-file-editor__dropzone"
                  data-state={dropState}
                  data-role="file-dropzone"
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (!busy) {
                      setDragOver(true);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!busy) {
                      event.dataTransfer.dropEffect = "copy";
                      setDragOver(true);
                    }
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      return;
                    }
                    setDragOver(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragOver(false);
                    if (busy) {
                      return;
                    }
                    const file = event.dataTransfer.files?.[0];
                    if (file) {
                      void handleFileUpload(file);
                    }
                  }}
                >
                  <input
                    data-role="file-input"
                    className="chips-file-editor__dropzone-input"
                    type="file"
                    disabled={busy}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) {
                        void handleFileUpload(file);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                  <span className="chips-file-editor__dropzone-content">
                    <FileAddOutlined
                      className="chips-file-editor__dropzone-icon"
                      aria-hidden={true}
                    />
                    <span className="chips-file-editor__dropzone-text">
                      {busy
                        ? formatMessage("file.editor.status.file")
                        : formatMessage("file.editor.file.upload")}
                    </span>
                    <span className="chips-file-editor__dropzone-note">
                      {formatMessage("file.editor.file.upload_note")}
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </section>
      </div>
    </form>
  );
}

export function createBasecardEditorRoot(props: BasecardEditorProps): HTMLElement {
  const rootElement = document.createElement("div") as EditorRoot;
  rootElement.setAttribute("data-chips-file-editor-root", "true");
  rootElement.style.width = "100%";
  rootElement.style.height = "100%";
  rootElement.style.minHeight = "0";

  const reactRoot: Root = createRoot(rootElement);

  flushSync(() => {
    reactRoot.render(
      <ConfigProvider locale={zhCN} theme={appleTheme}>
        <style>{EDITOR_STYLE_TEXT}</style>
        <BasecardEditor {...props} />
      </ConfigProvider>,
    );
  });

  rootElement.__chipsDispose = () => {
    reactRoot.unmount();
  };

  return rootElement;
}
