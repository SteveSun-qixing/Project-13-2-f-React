import React from "react";
import { Button, Tag } from "antd";
import type { BasecardOpenResourceInput } from "../index";
import type { BasecardConfig } from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import { analyzeHyperlinkUrl, type HyperlinkUrlAnalysis } from "../shared/utils";

export type OpenHyperlinkOptions = {
  openResource?: (input: BasecardOpenResourceInput) => void;
  title?: string;
  config: BasecardConfig;
  analysis: HyperlinkUrlAnalysis;
};

export function openHyperlinkResource(options: OpenHyperlinkOptions): void {
  if (!options.openResource || !options.analysis.openable) {
    return;
  }

  options.openResource({
    resourceId: options.analysis.normalizedUrl,
    mimeType: "text/html",
    title: options.title,
    fileName: options.analysis.hostname || undefined,
    payload: {
      kind: "chips.hyperlink-card",
      version: "1.0.0",
      cardType: "base.hyperlink",
      openMode: options.config.open_mode,
      displayDensity: options.config.display_density,
      sourceUrl: options.analysis.normalizedUrl,
      securityLevel: options.analysis.level,
      securityReason: options.analysis.reason,
    },
  });
}

export const VIEW_STYLE_TEXT = `
.chips-hyperlink-card {
  width: 100%;
  color: #1d1d1f;
  font: 14px/1.5 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-hyperlink-card,
.chips-hyperlink-card * {
  box-sizing: border-box;
}

.chips-hyperlink-card__surface {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 12px 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: transparent;
  color: #1d1d1f;
  font: inherit;
  line-height: 1.35;
  overflow-wrap: anywhere;
  text-align: left;
  text-decoration: none;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    color 0.16s ease;
}

.chips-hyperlink-card[data-density="compact"] .chips-hyperlink-card__surface {
  min-height: 36px;
  padding-block: 8px;
}

.chips-hyperlink-card[data-density="spacious"] .chips-hyperlink-card__surface {
  min-height: 56px;
  padding-block: 16px;
}

.chips-hyperlink-card__surface[data-openable="true"] {
  cursor: pointer;
}

.chips-hyperlink-card__surface[data-openable="false"] {
  cursor: default;
  border-style: dashed;
  color: #6e6e73;
}

.chips-hyperlink-card .chips-hyperlink-card__surface-button {
  all: unset;
  box-sizing: border-box;
  display: block;
  width: 100%;
}

.chips-hyperlink-card__surface[data-openable="true"]:hover,
.chips-hyperlink-card__surface[data-openable="true"]:focus-visible,
.chips-hyperlink-card__surface-button:hover .chips-hyperlink-card__surface,
.chips-hyperlink-card__surface-button:focus-visible .chips-hyperlink-card__surface {
  border-color: #6e6e73;
  background: #f2f2f7;
  color: #1d1d1f;
  outline: none;
}

.chips-hyperlink-card__surface-button:focus-visible .chips-hyperlink-card__surface {
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.14);
}

.chips-hyperlink-card__icon-frame {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #f2f2f7;
  color: #0a84ff;
  overflow: hidden;
}

.chips-hyperlink-card__icon-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-hyperlink-card__icon-fallback {
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
}

.chips-hyperlink-card__content {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1 1 auto;
}

.chips-hyperlink-card__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}

.chips-hyperlink-card__title {
  min-width: 0;
  font-weight: 650;
  overflow-wrap: anywhere;
}

.chips-hyperlink-card__description,
.chips-hyperlink-card__meta {
  margin: 0;
  color: #6e6e73;
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.chips-hyperlink-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chips-hyperlink-card__badge {
  margin-inline-end: 0;
  border: none;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
}

.chips-hyperlink-card__badge[data-tone="success"] {
  background: rgba(52, 199, 89, 0.12);
  color: #34c759;
}

.chips-hyperlink-card__badge[data-tone="warning"] {
  background: rgba(255, 159, 10, 0.12);
  color: #ff9f0a;
}

.chips-hyperlink-card__badge[data-tone="error"] {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
}
`;

export interface BasecardViewProps {
  config: BasecardConfig;
  openResource?: (input: BasecardOpenResourceInput) => void;
}

function getSecurityLabelKey(analysis: HyperlinkUrlAnalysis, hasOpenResource: boolean): string {
  if (analysis.openable && !hasOpenResource) {
    return "hyperlink.security.hostUnavailable";
  }

  if (analysis.reason === "secure") {
    return "hyperlink.security.secure";
  }

  if (analysis.reason === "insecure-http") {
    return "hyperlink.security.insecureHttp";
  }

  if (analysis.reason === "empty") {
    return "hyperlink.security.empty";
  }

  if (analysis.reason === "credentials-blocked") {
    return "hyperlink.security.credentialsBlocked";
  }

  return "hyperlink.security.blocked";
}

function getSecurityBadgeTone(
  analysis: HyperlinkUrlAnalysis,
  hasOpenResource: boolean,
): "success" | "warning" | "error" {
  if (!analysis.openable || !hasOpenResource) {
    return "error";
  }

  return analysis.level === "warning" ? "warning" : "success";
}

function resolveAriaLabel(params: {
  title: string;
  urlText: string;
  securityText: string;
  openable: boolean;
}): string {
  const { title, urlText, securityText, openable } = params;
  return openable
    ? formatMessage("hyperlink.view.openAria", { title, url: urlText, security: securityText })
    : formatMessage("hyperlink.view.disabledAria", { title, url: urlText, security: securityText });
}

export function BasecardView({ config, openResource }: BasecardViewProps) {
  const anchorText = config.anchor_text || formatMessage("hyperlink.view.emptyAnchorText");
  const description = (config.description ?? "").trim();
  const analysis = analyzeHyperlinkUrl(config.url);
  const iconAnalysis = config.icon_url ? analyzeHyperlinkUrl(config.icon_url) : null;
  const canOpen = Boolean(openResource && analysis.openable);
  const securityText = formatMessage(getSecurityLabelKey(analysis, Boolean(openResource)));
  const displayUrl = analysis.normalizedUrl || analysis.input || formatMessage("hyperlink.view.emptyUrl");
  const hostname = analysis.hostname || displayUrl;
  const ariaLabel = resolveAriaLabel({
    title: anchorText,
    urlText: displayUrl,
    securityText,
    openable: canOpen,
  });

  const content = (
    <span
      className="chips-hyperlink-card__surface"
      data-openable={canOpen ? "true" : "false"}
    >
      <span className="chips-hyperlink-card__icon-frame" aria-hidden="true">
        {iconAnalysis?.openable ? (
          <img
            className="chips-hyperlink-card__icon-image"
            src={iconAnalysis.normalizedUrl}
            alt=""
            draggable={false}
          />
        ) : (
          <span className="chips-hyperlink-card__icon-fallback">↗</span>
        )}
      </span>
      <span className="chips-hyperlink-card__content">
        <span className="chips-hyperlink-card__title-row">
          <span className="chips-hyperlink-card__title">{anchorText}</span>
          {config.show_security_hint ? (
            <Tag
              className="chips-hyperlink-card__badge"
              data-tone={getSecurityBadgeTone(analysis, Boolean(openResource))}
            >
              {securityText}
            </Tag>
          ) : null}
        </span>
        {description ? (
          <span className="chips-hyperlink-card__description">{description}</span>
        ) : null}
        <span className="chips-hyperlink-card__meta">
          <span>{hostname}</span>
          <span aria-hidden="true">·</span>
          <span>{formatMessage(`hyperlink.openMode.${config.open_mode}`)}</span>
        </span>
      </span>
    </span>
  );

  return (
    <div
      className="chips-hyperlink-card"
      data-card-type={config.card_type}
      data-density={config.display_density}
    >
      {canOpen ? (
        <Button
          className="chips-hyperlink-card__surface-button"
          htmlType="button"
          aria-label={ariaLabel}
          onClick={() => {
            openHyperlinkResource({
              openResource,
              title: anchorText,
              config,
              analysis,
            });
          }}
        >
          {content}
        </Button>
      ) : (
        <div
          role="group"
          aria-label={ariaLabel}
          aria-disabled="true"
        >
          {content}
        </div>
      )}
    </div>
  );
}
