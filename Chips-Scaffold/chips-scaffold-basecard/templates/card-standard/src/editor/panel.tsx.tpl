import React, { useEffect, useState } from "react";
import { Button, ConfigProvider, Input } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type {
  BasecardArchiveImportRequest,
  BasecardArchiveImportResult,
  BasecardResourceImportRequest,
  BasecardResourceImportResult,
  BasecardTiffToPngRequest,
  BasecardTiffToPngResult,
} from "../index";
import {
  normalizeBasecardConfig,
  validateBasecardConfig,
  type BasecardConfig,
} from "../schema/card-config";
import { formatMessage } from "../lib/messages";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (
    input: BasecardResourceImportRequest,
  ) => Promise<BasecardResourceImportResult>;
  importArchiveBundle?: (
    input: BasecardArchiveImportRequest,
  ) => Promise<BasecardArchiveImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
  convertTiffToPng?: (
    input: BasecardTiffToPngRequest,
  ) => Promise<BasecardTiffToPngResult>;
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
}

.chips-basecard-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  color: #1d1d1f;
  background-color: #ffffff;
  font: 14px/1.5 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-basecard-editor,
.chips-basecard-editor * {
  box-sizing: border-box;
}

.chips-basecard-editor__form {
  width: 100%;
}

.chips-basecard-editor__stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.chips-basecard-editor__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.chips-basecard-editor__field-label {
  color: #6e6e73;
  font-size: 12px;
  font-weight: 700;
}

.chips-basecard-editor__field-error {
  color: #ff3b30;
  font-size: 12px;
}

.chips-basecard-editor__resource-dropzone {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 120px;
  padding: 16px;
  border: 1.5px dashed rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  color: #6e6e73;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease,
    color 0.15s ease;
}

.chips-basecard-editor__resource-dropzone:hover {
  border-color: #0a84ff;
  background-color: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
}

.chips-basecard-editor__resource-dropzone:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

.chips-basecard-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.chips-basecard-editor__error {
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background-color: rgba(255, 59, 48, 0.08);
  color: #ff3b30;
  font-size: 13px;
}
`;

function toPreferredResourcePath(file: File): string {
  const fallbackName = "resource";
  const safeName = file.name
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/^\.+/, "")
    .trim();
  return `assets/${safeName || fallbackName}`;
}

function BasecardEditor(props: BasecardEditorProps) {
  const [config, setConfig] = useState(() => normalizeBasecardConfig(props.initialConfig));
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    validateBasecardConfig(normalizeBasecardConfig(props.initialConfig)).errors
  );
  const [resourceBridgeErrorKey, setResourceBridgeErrorKey] = useState<string | undefined>();

  useEffect(() => {
    const next = normalizeBasecardConfig(props.initialConfig);
    setConfig(next);
    setErrors(validateBasecardConfig(next).errors);
  }, [props.initialConfig]);

  function updateConfig(patch: Partial<BasecardConfig>) {
    const next = normalizeBasecardConfig({
      ...config,
      ...patch,
    });
    const validation = validateBasecardConfig(next);
    setConfig(next);
    setErrors(validation.errors);
    setResourceBridgeErrorKey(undefined);
    if (validation.valid) {
      props.onChange(next);
    }
  }

  async function importDroppedResource(file: File): Promise<void> {
    if (!props.importResource) {
      setResourceBridgeErrorKey("basecard.resource.importUnavailable");
      return;
    }

    try {
      const result = await props.importResource({
        file,
        preferredPath: toPreferredResourcePath(file),
      });
      updateConfig({ resource_path: result.path });
    } catch {
      setResourceBridgeErrorKey("basecard.resource.importFailed");
    }
  }

  function handleResourceDragOver(event: React.DragEvent<HTMLElement>): void {
    if (!props.importResource) {
      return;
    }
    event.preventDefault();
  }

  function handleResourceDrop(event: React.DragEvent<HTMLElement>): void {
    if (!props.importResource) {
      return;
    }

    event.preventDefault();
    const file = event.dataTransfer.files.item(0);
    if (file) {
      void importDroppedResource(file);
    }
  }

  async function handleDeleteResource(): Promise<void> {
    if (!config.resource_path || !props.deleteResource) {
      return;
    }

    try {
      await props.deleteResource(config.resource_path);
      updateConfig({ resource_path: undefined });
    } catch {
      setResourceBridgeErrorKey("basecard.resource.deleteFailed");
    }
  }

  const titleError = errors.title;
  const bodyError = errors.body;
  const resourcePathError = errors.resource_path;
  const firstErrorKey = resourceBridgeErrorKey ?? Object.values(errors)[0];

  return (
    <section
      className="chips-basecard-editor chips-basecard-editor--standard"
      aria-label={formatMessage("basecard.editor.ariaLabel")}
    >
      <form
        className="chips-basecard-editor__form"
        aria-label={formatMessage("basecard.editor.ariaLabel")}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="chips-basecard-editor__stack">
          <div className="chips-basecard-editor__field" data-chips-basecard-field="title">
            <span className="chips-basecard-editor__field-label">
              {formatMessage("basecard.field.title.label")}
            </span>
            <Input
              value={config.title}
              aria-label={formatMessage("basecard.field.title.ariaLabel")}
              placeholder={formatMessage("basecard.field.title.placeholder")}
              status={titleError ? "error" : undefined}
              onChange={(event) => {
                updateConfig({ title: event.target.value });
              }}
            />
            {titleError ? (
              <span className="chips-basecard-editor__field-error" role="alert">
                {formatMessage(titleError)}
              </span>
            ) : null}
          </div>

          <div className="chips-basecard-editor__field" data-chips-basecard-field="body">
            <span className="chips-basecard-editor__field-label">
              {formatMessage("basecard.field.body.label")}
            </span>
            <Input.TextArea
              value={config.body}
              aria-label={formatMessage("basecard.field.body.ariaLabel")}
              placeholder={formatMessage("basecard.field.body.placeholder")}
              status={bodyError ? "error" : undefined}
              rows={6}
              style={{ resize: "block" }}
              onChange={(event) => {
                updateConfig({ body: event.target.value });
              }}
            />
            {bodyError ? (
              <span className="chips-basecard-editor__field-error" role="alert">
                {formatMessage(bodyError)}
              </span>
            ) : null}
          </div>

          <div className="chips-basecard-editor__field" data-chips-basecard-field="resource_path">
            <span className="chips-basecard-editor__field-label">
              {formatMessage("basecard.resource.pathLabel")}
            </span>
            <Input
              value={config.resource_path ?? ""}
              aria-label={formatMessage("basecard.resource.pathAriaLabel")}
              placeholder={formatMessage("basecard.resource.pathPlaceholder")}
              status={resourcePathError ? "error" : undefined}
              onChange={(event) => {
                updateConfig({ resource_path: event.target.value });
              }}
            />
            {resourcePathError ? (
              <span className="chips-basecard-editor__field-error" role="alert">
                {formatMessage(resourcePathError)}
              </span>
            ) : null}
          </div>

          {props.importResource ? (
            <div
              className="chips-basecard-editor__resource-dropzone"
              role="button"
              tabIndex={0}
              aria-label={formatMessage("basecard.resource.dropzoneAriaLabel")}
              onDragOver={handleResourceDragOver}
              onDrop={handleResourceDrop}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                }
              }}
              data-chips-basecard-resource-dropzone="true"
            >
              {formatMessage("basecard.resource.dropzoneLabel")}
            </div>
          ) : null}

          {config.resource_path && props.deleteResource ? (
            <div className="chips-basecard-editor__actions">
              <Button
                type="default"
                onClick={() => {
                  void handleDeleteResource();
                }}
              >
                {formatMessage("basecard.resource.deleteAction")}
              </Button>
            </div>
          ) : null}

          {firstErrorKey ? (
            <p className="chips-basecard-editor__error" role="alert">
              {formatMessage(firstErrorKey)}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

export function createBasecardEditorRoot(props: BasecardEditorProps): HTMLElement {
  const rootElement = document.createElement("div") as EditorRoot;
  rootElement.setAttribute("data-chips-basecard-editor-root", "true");
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
