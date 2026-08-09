import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { PlayCircleOutlined } from "@ant-design/icons";
import { Checkbox, ConfigProvider, InputNumber, Segmented, Select } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { FrameRegionEditor } from "./frame-region-editor";
import type { BoxEntrySnapshot, ResolvedRuntimeResource } from "../shared/types";
import {
  CENTER_SCALE_MAX,
  CENTER_SCALE_MIN,
  SIDE_ANGLE_MAX,
  SIDE_ANGLE_MIN,
  normalizeLayoutConfig,
  type CoverFlowSpacing,
  type CoverSize,
  type FrameRegionConfig,
  type LayoutConfig,
  type SortMode,
  type WheelSensitivity,
} from "../schema/layout-config";
import { formatMessage } from "../lib/messages";

export interface LayoutEditorPanelProps {
  entries: BoxEntrySnapshot[];
  config: LayoutConfig;
  readBoxAsset?(assetPath: string): Promise<ResolvedRuntimeResource>;
  importBoxAsset?(input: { file: File; preferredPath?: string }): Promise<{ assetPath: string }>;
  deleteBoxAsset?(assetPath: string): Promise<void>;
  onChange(next: LayoutConfig): void;
}

export type LayoutEditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

const EDITOR_STYLE_TEXT = `
.chips-coverflow-layout-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  color: #1d1d1f;
  background: #ffffff;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.chips-coverflow-layout-editor,
.chips-coverflow-layout-editor * {
  box-sizing: border-box;
}

.chips-coverflow-layout-editor__form {
  width: 100%;
  min-width: 0;
  padding: 8px 12px 28px;
}

/* ---------- 面板头 ---------- */

.chips-coverflow-layout-editor__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px 14px;
}

.chips-coverflow-layout-editor__head-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
}

.chips-coverflow-layout-editor__head-text {
  min-width: 0;
}

.chips-coverflow-layout-editor__head-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-coverflow-layout-editor__head-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-coverflow-layout-editor__head-count {
  margin-left: auto;
  flex-shrink: 0;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  color: #6e6e73;
  background: #f2f2f7;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
}

/* ---------- 分组（iOS inset grouped 风格） ---------- */

.chips-coverflow-layout-editor__group {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.chips-coverflow-layout-editor__group + .chips-coverflow-layout-editor__group {
  margin-top: 16px;
}

.chips-coverflow-layout-editor__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 14px;
}

.chips-coverflow-layout-editor__row + .chips-coverflow-layout-editor__row::before,
.chips-coverflow-layout-editor__row + .chips-coverflow-layout-editor__code-area::before,
.chips-coverflow-layout-editor__row + .chips-coverflow-layout-editor__image-area::before,
.chips-coverflow-layout-editor__code-area + .chips-coverflow-layout-editor__row::before,
.chips-coverflow-layout-editor__image-area + .chips-coverflow-layout-editor__row::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.chips-coverflow-layout-editor__row-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  color: #1d1d1f;
}

.chips-coverflow-layout-editor__group-footer {
  margin: 10px 6px 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #6e6e73;
}

/* ---------- 排序行 Select ---------- */

.chips-coverflow-layout-editor .ant-select {
  min-width: 0;
  flex-shrink: 1;
}

.chips-coverflow-layout-editor .ant-select .ant-select-content {
  padding-inline: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #6e6e73;
}

.chips-coverflow-layout-editor .ant-select:hover .ant-select-content {
  color: #1d1d1f;
}

.chips-coverflow-layout-editor .ant-select .ant-select-suffix {
  color: #8e8e93;
}

/* ---------- 行内分段控件 ---------- */

.chips-coverflow-layout-editor .ant-segmented {
  flex-shrink: 0;
}

/* ---------- 数值输入 ---------- */

.chips-coverflow-layout-editor .ant-input-number {
  flex-shrink: 0;
  width: 96px;
}

/* ---------- 复选框 ---------- */

.chips-coverflow-layout-editor .ant-checkbox-wrapper {
  flex-shrink: 0;
}

/* ---------- 区域编辑 ---------- */

.chips-coverflow-layout-editor__region-head {
  padding: 10px 14px 0;
}

.chips-coverflow-layout-editor__region-desc {
  margin: 2px 0 10px;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-coverflow-layout-editor__image-area,
.chips-coverflow-layout-editor__code-area {
  position: relative;
  padding: 4px 14px 12px;
}

.chips-coverflow-layout-editor__preview-shell {
  position: relative;
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px 14px 12px;
}

.chips-coverflow-layout-editor__preview-shell::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.chips-coverflow-layout-editor__asset-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chips-coverflow-layout-editor__asset-path {
  display: block;
  min-width: 0;
  margin-top: 10px;
  overflow-wrap: anywhere;
  color: #6e6e73;
  font-size: 12px;
}

.chips-coverflow-layout-editor__preview {
  width: 100%;
  min-height: 160px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background-color: #ffffff;
}

.chips-coverflow-layout-editor__preview .chips-embedded-document-frame,
.chips-coverflow-layout-editor__preview .chips-embedded-document-frame iframe {
  width: 100%;
  height: 100%;
}

.chips-coverflow-layout-editor__preview-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-coverflow-layout-editor__preview-status {
  min-height: 160px;
  display: grid;
  place-items: center;
  padding: 16px;
  color: #6e6e73;
  text-align: center;
  font-size: 13px;
}

.chips-coverflow-layout-editor__preview-label {
  color: #6e6e73;
  font-size: 12px;
}

.chips-coverflow-layout-editor__row-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

.chips-coverflow-layout-editor__remove-button {
  font-size: 13px;
  min-height: 0;
  padding: 4px 6px;
}

.chips-coverflow-layout-editor__bridge-warning.ant-result {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0 0;
  padding: 0;
}

.chips-coverflow-layout-editor__bridge-warning .ant-result-icon {
  margin: 0;
  padding-top: 2px;
}

.chips-coverflow-layout-editor__bridge-warning .ant-result-title {
  font-size: 13px;
  line-height: 1.6;
  color: inherit;
}

.chips-coverflow-layout-editor__bridge-warning .ant-result-subtitle {
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

/* ---------- 错误 ---------- */

.chips-coverflow-layout-editor__error {
  margin: 8px 6px 0;
  font-size: 12px;
  line-height: 1.6;
  color: #ff3b30;
}

.chips-coverflow-layout-editor :focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}
`;

function updateProps(
  config: LayoutConfig,
  patch: Partial<LayoutConfig["props"]>
): LayoutConfig {
  return normalizeLayoutConfig({
    ...config,
    props: {
      ...config.props,
      ...patch,
    },
  });
}

function updateFrameRegion(
  config: LayoutConfig,
  key: "background" | "topRegion",
  region: FrameRegionConfig
): LayoutConfig {
  return updateProps(config, {
    [key]: region,
  });
}

export function LayoutEditorPanel({
  entries,
  config: initialConfig,
  readBoxAsset,
  importBoxAsset,
  deleteBoxAsset,
  onChange,
}: LayoutEditorPanelProps) {
  const [config, setConfig] = React.useState(() => normalizeLayoutConfig(initialConfig));

  React.useEffect(() => {
    setConfig(normalizeLayoutConfig(initialConfig));
  }, [initialConfig]);

  function commit(next: LayoutConfig): void {
    const normalized = normalizeLayoutConfig(next);
    setConfig(normalized);
    onChange(normalized);
  }

  return (
    <section
      className="chips-coverflow-layout-editor"
      data-scope="chips-coverflow-layout-editor"
      aria-label={formatMessage("editor.aria_label")}
    >
      <style>{EDITOR_STYLE_TEXT}</style>
      <form
        className="chips-coverflow-layout-editor__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="chips-coverflow-layout-editor__head">
          <span className="chips-coverflow-layout-editor__head-icon">
            <PlayCircleOutlined style={{ fontSize: 18 }} />
          </span>
          <div className="chips-coverflow-layout-editor__head-text">
            <p className="chips-coverflow-layout-editor__head-title">
              {formatMessage("editor.section.coverflow")}
            </p>
            <p className="chips-coverflow-layout-editor__head-desc">
              {formatMessage("editor.section.coverflow_desc")}
            </p>
          </div>
          <span className="chips-coverflow-layout-editor__head-count">
            {formatMessage("editor.entry_count", { count: entries.length })}
          </span>
        </div>

        <div className="chips-coverflow-layout-editor__group">
          <div className="chips-coverflow-layout-editor__row">
            <span className="chips-coverflow-layout-editor__row-label">
              {formatMessage("editor.sort_mode")}
            </span>
            <Select
              className="chips-coverflow-layout-editor__sort-select"
              variant="borderless"
              value={config.props.sortMode}
              aria-label={formatMessage("editor.sort_mode")}
              options={[
                {
                  value: "manual",
                  label: formatMessage("editor.sort_manual"),
                },
                {
                  value: "name-asc",
                  label: formatMessage("editor.sort_name_asc"),
                },
                {
                  value: "name-desc",
                  label: formatMessage("editor.sort_name_desc"),
                },
              ]}
              onChange={(value: SortMode) => {
                commit(updateProps(config, {
                  sortMode: value,
                }));
              }}
            />
          </div>
          <p className="chips-coverflow-layout-editor__group-footer">
            {config.props.sortMode === "manual"
              ? formatMessage("editor.sort_manual_hint")
              : formatMessage("editor.sort_runtime_hint")}
          </p>

          <div className="chips-coverflow-layout-editor__row">
            <span className="chips-coverflow-layout-editor__row-label">
              {formatMessage("editor.cover_size")}
            </span>
            <Segmented
              value={config.props.coverSize}
              aria-label={formatMessage("editor.cover_size")}
              options={[
                { value: "compact", label: formatMessage("editor.cover_size_compact") },
                { value: "regular", label: formatMessage("editor.cover_size_regular") },
                { value: "large", label: formatMessage("editor.cover_size_large") },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  coverSize: value as CoverSize,
                }));
              }}
            />
          </div>

          <div className="chips-coverflow-layout-editor__row">
            <span className="chips-coverflow-layout-editor__row-label">
              {formatMessage("editor.spacing")}
            </span>
            <Segmented
              value={config.props.spacing}
              aria-label={formatMessage("editor.spacing")}
              options={[
                { value: "tight", label: formatMessage("editor.spacing_tight") },
                { value: "regular", label: formatMessage("editor.spacing_regular") },
                { value: "wide", label: formatMessage("editor.spacing_wide") },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  spacing: value as CoverFlowSpacing,
                }));
              }}
            />
          </div>

          <div className="chips-coverflow-layout-editor__row">
            <span className="chips-coverflow-layout-editor__row-label">
              {formatMessage("editor.side_angle")}
            </span>
            <InputNumber
              value={config.props.sideAngleDeg}
              min={SIDE_ANGLE_MIN}
              max={SIDE_ANGLE_MAX}
              step={1}
              aria-label={formatMessage("editor.side_angle")}
              onChange={(value) => {
                commit(updateProps(config, {
                  sideAngleDeg: typeof value === "number" ? value : config.props.sideAngleDeg,
                }));
              }}
            />
          </div>
          <p className="chips-coverflow-layout-editor__group-footer">
            {formatMessage("editor.side_angle_hint", {
              min: SIDE_ANGLE_MIN,
              max: SIDE_ANGLE_MAX,
            })}
          </p>

          <div className="chips-coverflow-layout-editor__row">
            <span className="chips-coverflow-layout-editor__row-label">
              {formatMessage("editor.center_scale")}
            </span>
            <InputNumber
              value={config.props.centerScale}
              min={CENTER_SCALE_MIN}
              max={CENTER_SCALE_MAX}
              step={0.01}
              aria-label={formatMessage("editor.center_scale")}
              onChange={(value) => {
                commit(updateProps(config, {
                  centerScale: typeof value === "number" ? value : config.props.centerScale,
                }));
              }}
            />
          </div>
          <p className="chips-coverflow-layout-editor__group-footer">
            {formatMessage("editor.center_scale_hint", {
              min: CENTER_SCALE_MIN,
              max: CENTER_SCALE_MAX,
            })}
          </p>

          <div className="chips-coverflow-layout-editor__row">
            <span className="chips-coverflow-layout-editor__row-label">
              {formatMessage("editor.wheel_sensitivity")}
            </span>
            <Segmented
              value={config.props.wheelSensitivity}
              aria-label={formatMessage("editor.wheel_sensitivity")}
              options={[
                { value: "low", label: formatMessage("editor.wheel_low") },
                { value: "medium", label: formatMessage("editor.wheel_medium") },
                { value: "high", label: formatMessage("editor.wheel_high") },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  wheelSensitivity: value as WheelSensitivity,
                }));
              }}
            />
          </div>

          <div className="chips-coverflow-layout-editor__row">
            <span className="chips-coverflow-layout-editor__row-label">
              {formatMessage("editor.show_reflection")}
            </span>
            <Checkbox
              checked={config.props.showReflection}
              aria-label={formatMessage("editor.show_reflection")}
              onChange={(event) => {
                commit(updateProps(config, {
                  showReflection: event.target.checked,
                }));
              }}
            />
          </div>
        </div>

        <FrameRegionEditor
          id="background"
          region={config.props.background}
          title={formatMessage("editor.background_title")}
          description={formatMessage("editor.background_desc")}
          previewRatio="16:9"
          preferredAssetPrefix="assets/layouts/chips.layout.coverflow.blp/background"
          readBoxAsset={readBoxAsset}
          importBoxAsset={importBoxAsset}
          deleteBoxAsset={deleteBoxAsset}
          onChange={(nextRegion) => {
            commit(updateFrameRegion(config, "background", nextRegion));
          }}
        />

        <FrameRegionEditor
          id="topRegion"
          region={config.props.topRegion}
          title={formatMessage("editor.top_region_title")}
          description={formatMessage("editor.top_region_desc")}
          previewRatio="16:5"
          preferredAssetPrefix="assets/layouts/chips.layout.coverflow.blp/top-region"
          readBoxAsset={readBoxAsset}
          importBoxAsset={importBoxAsset}
          deleteBoxAsset={deleteBoxAsset}
          onChange={(nextRegion) => {
            commit(updateFrameRegion(config, "topRegion", nextRegion));
          }}
        />
      </form>
    </section>
  );
}

export function createLayoutEditorRoot(props: LayoutEditorPanelProps): LayoutEditorRoot {
  const rootElement = document.createElement("div") as LayoutEditorRoot;
  rootElement.setAttribute("data-chips-coverflow-layout-editor-root", "true");
  rootElement.style.width = "100%";
  rootElement.style.height = "100%";
  rootElement.style.minHeight = "0";

  const reactRoot: Root = createRoot(rootElement);

  flushSync(() => {
    reactRoot.render(
      <ConfigProvider locale={zhCN} theme={appleTheme}>
        <LayoutEditorPanel {...props} />
      </ConfigProvider>,
    );
  });

  rootElement.__chipsDispose = () => {
    reactRoot.unmount();
  };

  return rootElement;
}
