import React, { useEffect, useId, useRef, useState } from "react";
import { ConfigProvider, Input, Segmented, Switch, Tooltip } from "antd";
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
  type HyperlinkDisplayDensity,
  type HyperlinkOpenMode,
} from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import { analyzeHyperlinkUrl } from "../shared/utils";

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
  convertTiffToPng?: (input: BasecardTiffToPngRequest) => Promise<BasecardTiffToPngResult>;
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

.chips-basecard-editor {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  color: #1d1d1f;
  background: #ffffff;
  font: 14px/1.6 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-basecard-editor,
.chips-basecard-editor * {
  box-sizing: border-box;
}

.chips-basecard-editor__form {
  display: grid;
  gap: 16px;
}

.chips-basecard-editor__section {
  display: grid;
  gap: 16px;
  margin: 0;
}

.chips-basecard-editor__section-title {
  margin: 0;
  color: #1d1d1f;
  font-size: 15px;
  font-weight: 600;
}

.chips-basecard-editor__field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-basecard-editor__field-label {
  color: #1d1d1f;
  font-weight: 600;
}

.chips-basecard-editor__required-mark {
  margin-inline-start: 4px;
  color: #ff3b30;
}

.chips-basecard-editor__field-description,
.chips-basecard-editor__field-error {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
}

.chips-basecard-editor__field-description {
  color: #6e6e73;
}

.chips-basecard-editor__field-error {
  color: #ff3b30;
}

.chips-basecard-editor__switch-row,
.chips-basecard-editor__security-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chips-basecard-editor__switch-copy,
.chips-basecard-editor__security-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.chips-basecard-editor__switch-title,
.chips-basecard-editor__security-title {
  font-weight: 600;
}

.chips-basecard-editor__switch-description,
.chips-basecard-editor__security-description {
  color: #6e6e73;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.chips-basecard-editor__switch-row .ant-switch {
  flex: 0 0 auto;
}

.chips-basecard-editor__segmented {
  display: inline-flex;
  flex-wrap: wrap;
}

.chips-basecard-editor__security-row {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.04);
}

.chips-basecard-editor__security-title[data-tone="success"] {
  color: #34c759;
}

.chips-basecard-editor__security-title[data-tone="warning"] {
  color: #ff9f0a;
}

.chips-basecard-editor__security-title[data-tone="error"] {
  color: #ff3b30;
}

.chips-basecard-editor__help-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 28px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  background: transparent;
  color: #6e6e73;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;
}

.chips-basecard-editor__help-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #1d1d1f;
}

.chips-basecard-editor__help-button:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.14);
  color: #1d1d1f;
}

.chips-basecard-editor__errors {
  min-height: 0;
  color: #ff3b30;
  font-size: 13px;
}

.chips-basecard-editor__errors-list {
  margin: 0;
  padding-left: 18px;
}
`;

function getErrorMessage(errors: Record<string, string>, field: string): string | null {
  const key = errors[field];
  return key ? formatMessage(key) : null;
}

function getSecurityLabelKey(reason: string): string {
  if (reason === "secure") {
    return "hyperlink.security.secure";
  }

  if (reason === "insecure-http") {
    return "hyperlink.security.insecureHttp";
  }

  if (reason === "empty") {
    return "hyperlink.security.empty";
  }

  if (reason === "credentials-blocked") {
    return "hyperlink.security.credentialsBlocked";
  }

  return "hyperlink.security.blocked";
}

function getSecurityTone(reason: string): "success" | "warning" | "error" {
  if (reason === "secure") {
    return "success";
  }

  if (reason === "insecure-http") {
    return "warning";
  }

  return "error";
}

function createOpenModeOptions(): Array<{ value: HyperlinkOpenMode; label: string }> {
  return [
    { value: "external-browser", label: formatMessage("hyperlink.openMode.external-browser") },
    { value: "resource-router", label: formatMessage("hyperlink.openMode.resource-router") },
  ];
}

function createDensityOptions(): Array<{ value: HyperlinkDisplayDensity; label: string }> {
  return [
    { value: "compact", label: formatMessage("hyperlink.density.compact") },
    { value: "comfortable", label: formatMessage("hyperlink.density.comfortable") },
    { value: "spacious", label: formatMessage("hyperlink.density.spacious") },
  ];
}

function BasecardEditor(props: BasecardEditorProps) {
  const [config, setConfig] = useState(() => normalizeBasecardConfig(props.initialConfig));
  const configRef = useRef(config);
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    validateBasecardConfig(normalizeBasecardConfig(props.initialConfig)).errors
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const anchorInputId = useId();
  const urlInputId = useId();
  const descriptionInputId = useId();
  const iconUrlInputId = useId();
  const urlAnalysis = analyzeHyperlinkUrl(config.url);
  const securityText = formatMessage(getSecurityLabelKey(urlAnalysis.reason));
  const anchorError = getErrorMessage(errors, "anchor_text");
  const urlError = getErrorMessage(errors, "url");
  const iconUrlError = getErrorMessage(errors, "icon_url");

  useEffect(() => {
    const next = normalizeBasecardConfig(props.initialConfig);
    configRef.current = next;
    setConfig(next);
    setErrors(validateBasecardConfig(next).errors);
  }, [props.initialConfig]);

  function updateConfig(patch: Partial<BasecardConfig>) {
    const next = normalizeBasecardConfig({
      ...configRef.current,
      ...patch,
    });
    const validation = validateBasecardConfig(next);
    configRef.current = next;
    setConfig(next);
    setErrors(validation.errors);
    if (validation.valid) {
      props.onChange(next);
    }
  }

  return (
    <div className="chips-basecard-editor chips-basecard-editor--standard">
      <form
        className="chips-basecard-editor__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <section className="chips-basecard-editor__section" aria-labelledby="chips-hyperlink-editor-content-title">
          <h2 id="chips-hyperlink-editor-content-title" className="chips-basecard-editor__section-title">
            {formatMessage("hyperlink.editor.contentSection")}
          </h2>
          <div className="chips-basecard-editor__field">
            <label className="chips-basecard-editor__field-label" htmlFor={anchorInputId}>
              {formatMessage("hyperlink.anchorText")}
              <span className="chips-basecard-editor__required-mark" aria-hidden="true">
                *
              </span>
            </label>
            <Input
              id={anchorInputId}
              size="large"
              value={config.anchor_text}
              placeholder={formatMessage("hyperlink.placeholder.anchorText")}
              required
              aria-invalid={anchorError ? true : undefined}
              status={anchorError ? "error" : undefined}
              onChange={(event) => {
                updateConfig({ anchor_text: event.target.value });
              }}
            />
            {anchorError ? (
              <p className="chips-basecard-editor__field-error">{anchorError}</p>
            ) : null}
          </div>

          <div className="chips-basecard-editor__field">
            <label className="chips-basecard-editor__field-label" htmlFor={urlInputId}>
              {formatMessage("hyperlink.url")}
              <span className="chips-basecard-editor__required-mark" aria-hidden="true">
                *
              </span>
            </label>
            <Input
              id={urlInputId}
              size="large"
              value={config.url}
              placeholder={formatMessage("hyperlink.placeholder.url")}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              aria-invalid={urlError ? true : undefined}
              status={urlError ? "error" : undefined}
              onChange={(event) => {
                updateConfig({ url: event.target.value });
              }}
            />
            <p className="chips-basecard-editor__field-description">
              {formatMessage("hyperlink.description.url")}
            </p>
            {urlError ? (
              <p className="chips-basecard-editor__field-error">{urlError}</p>
            ) : null}
          </div>

          <div className="chips-basecard-editor__field">
            <label className="chips-basecard-editor__field-label" htmlFor={descriptionInputId}>
              {formatMessage("hyperlink.description")}
            </label>
            <Input.TextArea
              id={descriptionInputId}
              value={config.description}
              placeholder={formatMessage("hyperlink.placeholder.description")}
              rows={3}
              style={{ resize: "vertical" }}
              onChange={(event) => {
                updateConfig({ description: event.target.value });
              }}
            />
            <p className="chips-basecard-editor__field-description">
              {formatMessage("hyperlink.description.description")}
            </p>
          </div>
        </section>

        <section className="chips-basecard-editor__section" aria-labelledby="chips-hyperlink-editor-display-title">
          <h2 id="chips-hyperlink-editor-display-title" className="chips-basecard-editor__section-title">
            {formatMessage("hyperlink.editor.displaySection")}
          </h2>

          <div className="chips-basecard-editor__field">
            <label className="chips-basecard-editor__field-label" htmlFor={iconUrlInputId}>
              {formatMessage("hyperlink.iconUrl")}
            </label>
            <Input
              id={iconUrlInputId}
              size="large"
              value={config.icon_url}
              placeholder={formatMessage("hyperlink.placeholder.iconUrl")}
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              status={iconUrlError ? "error" : undefined}
              onChange={(event) => {
                updateConfig({ icon_url: event.target.value });
              }}
            />
            <p className="chips-basecard-editor__field-description">
              {formatMessage("hyperlink.description.iconUrl")}
            </p>
            {iconUrlError ? (
              <p className="chips-basecard-editor__field-error">{iconUrlError}</p>
            ) : null}
          </div>

          <div className="chips-basecard-editor__field">
            <span className="chips-basecard-editor__field-label">
              {formatMessage("hyperlink.openMode")}
            </span>
            <div className="chips-basecard-editor__segmented">
              <Segmented<HyperlinkOpenMode>
                value={config.open_mode}
                aria-label={formatMessage("hyperlink.openMode")}
                options={createOpenModeOptions()}
                onChange={(value) => {
                  updateConfig({ open_mode: value });
                }}
              />
            </div>
            <p className="chips-basecard-editor__switch-description">
              {formatMessage("hyperlink.description.openMode")}
            </p>
          </div>

          <div className="chips-basecard-editor__field">
            <span className="chips-basecard-editor__field-label">
              {formatMessage("hyperlink.displayDensity")}
            </span>
            <div className="chips-basecard-editor__segmented">
              <Segmented<HyperlinkDisplayDensity>
                value={config.display_density}
                aria-label={formatMessage("hyperlink.displayDensity")}
                options={createDensityOptions()}
                onChange={(value) => {
                  updateConfig({ display_density: value });
                }}
              />
            </div>
          </div>

          <div className="chips-basecard-editor__switch-row">
            <span className="chips-basecard-editor__switch-copy">
              <span className="chips-basecard-editor__switch-title">{formatMessage("hyperlink.securityHint")}</span>
              <span className="chips-basecard-editor__switch-description">
                {formatMessage("hyperlink.description.securityHint")}
              </span>
            </span>
            <Switch
              checked={config.show_security_hint}
              aria-label={formatMessage("hyperlink.securityHint")}
              onChange={(checked) => {
                updateConfig({ show_security_hint: checked });
              }}
            />
          </div>
        </section>

        <section className="chips-basecard-editor__section" aria-labelledby="chips-hyperlink-editor-security-title">
          <h2 id="chips-hyperlink-editor-security-title" className="chips-basecard-editor__section-title">
            {formatMessage("hyperlink.editor.securitySection")}
          </h2>
          <div className="chips-basecard-editor__security-row">
            <span className="chips-basecard-editor__security-copy">
              <span
                className="chips-basecard-editor__security-title"
                data-tone={getSecurityTone(urlAnalysis.reason)}
              >
                {securityText}
              </span>
              <span className="chips-basecard-editor__security-description">
                {formatMessage("hyperlink.security.description", {
                  url: urlAnalysis.normalizedUrl || urlAnalysis.input || formatMessage("hyperlink.view.emptyUrl"),
                })}
              </span>
            </span>
            <Tooltip
              title={formatMessage("hyperlink.security.tooltip")}
              open={helpOpen}
              onOpenChange={(open) => {
                setHelpOpen(open);
              }}
            >
              <span
                className="chips-basecard-editor__help-button"
                role="button"
                tabIndex={0}
                aria-label={formatMessage("hyperlink.security.tooltip")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setHelpOpen((open) => !open);
                  }
                }}
              >
                ?
              </span>
            </Tooltip>
          </div>
        </section>

        <div className="chips-basecard-editor__errors" aria-live="polite">
          {Object.keys(errors).length > 0 ? (
            <ul className="chips-basecard-editor__errors-list">
              {Object.entries(errors).map(([key, message]) => (
                <li key={key}>{formatMessage(message)}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </form>
    </div>
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
