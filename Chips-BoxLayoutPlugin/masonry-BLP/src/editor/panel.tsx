import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { DashboardOutlined } from "@ant-design/icons";
import { Checkbox, ConfigProvider, InputNumber, Segmented, Select } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { FrameRegionEditor } from "./frame-region-editor";
import type { BoxEntrySnapshot, ResolvedRuntimeResource } from "../shared/types";
import {
  normalizeLayoutConfig,
  type ColumnMode,
  type FrameRegionConfig,
  type GapMode,
  type LayoutConfig,
  type SortMode,
  type TitleMode,
} from "../schema/layout-config";
import { formatMessage } from "../lib/messages";

export interface LayoutEditorPanelProps {
  entries: BoxEntrySnapshot[];
  config: LayoutConfig;
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>;
  importBoxAsset?: (input: { file: File; preferredPath?: string }) => Promise<{ assetPath: string }>;
  deleteBoxAsset?: (assetPath: string) => Promise<void>;
  onChange(next: LayoutConfig): void;
}

export type LayoutEditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

const EDITOR_STYLE_TEXT = `
.chips-masonry-layout-editor {
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

.chips-masonry-layout-editor,
.chips-masonry-layout-editor * {
  box-sizing: border-box;
}

.chips-masonry-layout-editor__form {
  width: 100%;
  min-width: 0;
  padding: 8px 12px 28px;
}

/* ---------- 面板头 ---------- */

.chips-masonry-layout-editor__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px 14px;
}

.chips-masonry-layout-editor__head-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
}

.chips-masonry-layout-editor__head-text {
  min-width: 0;
}

.chips-masonry-layout-editor__head-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-masonry-layout-editor__head-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-masonry-layout-editor__head-count {
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

.chips-masonry-layout-editor__group {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.chips-masonry-layout-editor__group + .chips-masonry-layout-editor__group {
  margin-top: 16px;
}

.chips-masonry-layout-editor__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 14px;
}

.chips-masonry-layout-editor__row + .chips-masonry-layout-editor__row::before,
.chips-masonry-layout-editor__row + .chips-masonry-layout-editor__code-area::before,
.chips-masonry-layout-editor__row + .chips-masonry-layout-editor__image-area::before,
.chips-masonry-layout-editor__code-area + .chips-masonry-layout-editor__row::before,
.chips-masonry-layout-editor__image-area + .chips-masonry-layout-editor__row::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.chips-masonry-layout-editor__row-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  color: #1d1d1f;
}

.chips-masonry-layout-editor__group-footer {
  margin: 0 6px;
  padding: 0 8px 10px;
  font-size: 11.5px;
  line-height: 1.6;
  color: #6e6e73;
}

/* ---------- 行内 Select ---------- */

.chips-masonry-layout-editor .ant-select {
  min-width: 0;
  flex-shrink: 1;
}

.chips-masonry-layout-editor .ant-select .ant-select-content {
  padding-inline: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #6e6e73;
}

.chips-masonry-layout-editor .ant-select:hover .ant-select-content {
  color: #1d1d1f;
}

.chips-masonry-layout-editor .ant-select .ant-select-suffix {
  color: #8e8e93;
}

/* ---------- 行内分段控件 ---------- */

.chips-masonry-layout-editor .ant-segmented {
  flex-shrink: 0;
}

/* ---------- 数字输入 ---------- */

.chips-masonry-layout-editor .ant-input-number {
  flex-shrink: 1;
  min-width: 88px;
  max-width: 120px;
}

/* ---------- 复选框 ---------- */

.chips-masonry-layout-editor .ant-checkbox-wrapper {
  flex-shrink: 0;
}

/* ---------- 图片拖放框 ---------- */

.chips-masonry-layout-editor__image-area {
  position: relative;
  padding: 10px 14px 12px;
}

.chips-masonry-layout-editor__drop-zone {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 96px;
  border: 1.5px dashed rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  color: #6e6e73;
  font-size: 13px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.chips-masonry-layout-editor__drop-zone:hover:not(.chips-masonry-layout-editor__drop-zone--disabled) {
  border-color: #0a84ff;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
}

.chips-masonry-layout-editor__drop-zone--dragging {
  border-color: #0a84ff;
  border-style: solid;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
}

.chips-masonry-layout-editor__drop-zone--disabled {
  cursor: default;
  opacity: 0.6;
}

.chips-masonry-layout-editor__drop-zone-empty {
  display: grid;
  justify-items: center;
  gap: 6px;
}

.chips-masonry-layout-editor__drop-zone--filled {
  position: relative;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.08);
  padding: 0;
  overflow: hidden;
  min-height: 0;
}

.chips-masonry-layout-editor__drop-zone-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-masonry-layout-editor__drop-zone-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.chips-masonry-layout-editor__drop-zone--filled:hover .chips-masonry-layout-editor__drop-zone-overlay {
  opacity: 1;
}

.chips-masonry-layout-editor__drop-zone-status {
  padding: 16px;
  color: #6e6e73;
  font-size: 12px;
}

.chips-masonry-layout-editor__row-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
}

.chips-masonry-layout-editor__remove-button {
  font-size: 13px;
  min-height: 0;
  padding: 4px 6px;
}

/* ---------- 代码模式 ---------- */

.chips-masonry-layout-editor__code-area {
  position: relative;
  padding: 10px 14px 12px;
}

/* ---------- 错误 ---------- */

.chips-masonry-layout-editor__error {
  margin: 8px 6px 0;
  font-size: 12px;
  line-height: 1.6;
  color: #ff3b30;
}

/* ---------- 资源桥缺失告警条 ---------- */

.chips-masonry-layout-editor__alert {
  margin: 10px 6px 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(242, 242, 247, 0.92);
  color: #ff3b30;
  font-size: 13px;
}

.chips-masonry-layout-editor__alert--error .ant-result {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0;
  background: transparent;
}

.chips-masonry-layout-editor__alert--error .ant-result-icon {
  margin: 0;
  line-height: 1.4;
}

.chips-masonry-layout-editor__alert--error .ant-result-title {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: inherit;
}

.chips-masonry-layout-editor__alert--error .ant-result-subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: inherit;
}

.chips-masonry-layout-editor__drop-zone:focus-visible,
.chips-masonry-layout-editor__remove-button:focus-visible {
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
      className="chips-masonry-layout-editor"
      data-scope="chips-masonry-layout-editor"
      aria-label={formatMessage("editor.aria_label")}
    >
      <style>{EDITOR_STYLE_TEXT}</style>
      <form
        className="chips-masonry-layout-editor__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="chips-masonry-layout-editor__head">
          <span className="chips-masonry-layout-editor__head-icon">
            <DashboardOutlined style={{ fontSize: 18 }} />
          </span>
          <div className="chips-masonry-layout-editor__head-text">
            <p className="chips-masonry-layout-editor__head-title">
              {formatMessage("editor.head_title")}
            </p>
            <p className="chips-masonry-layout-editor__head-desc">
              {formatMessage("editor.head_desc")}
            </p>
          </div>
          <span className="chips-masonry-layout-editor__head-count">
            {formatMessage("editor.entry_count", { count: entries.length })}
          </span>
        </div>

        <div className="chips-masonry-layout-editor__group">
          <div className="chips-masonry-layout-editor__row">
            <span className="chips-masonry-layout-editor__row-label">
              {formatMessage("editor.sort_mode")}
            </span>
            <Select
              className="chips-masonry-layout-editor__sort-select"
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
          <p className="chips-masonry-layout-editor__group-footer">
            {config.props.sortMode === "manual"
              ? formatMessage("editor.sort_manual_hint")
              : formatMessage("editor.sort_runtime_hint")}
          </p>
        </div>

        <div className="chips-masonry-layout-editor__group">
          <div className="chips-masonry-layout-editor__row">
            <span className="chips-masonry-layout-editor__row-label">
              {formatMessage("editor.column_mode")}
            </span>
            <Segmented
              value={config.props.columnMode}
              aria-label={formatMessage("editor.column_mode")}
              options={[
                {
                  value: "compact",
                  label: formatMessage("editor.column_compact"),
                },
                {
                  value: "auto",
                  label: formatMessage("editor.column_auto"),
                },
                {
                  value: "wide",
                  label: formatMessage("editor.column_wide"),
                },
              ]}
              onChange={(value: ColumnMode) => {
                commit(updateProps(config, {
                  columnMode: value,
                }));
              }}
            />
          </div>
          <p className="chips-masonry-layout-editor__group-footer">
            {formatMessage("editor.column_mode_hint")}
          </p>

          <div className="chips-masonry-layout-editor__row">
            <span className="chips-masonry-layout-editor__row-label">
              {formatMessage("editor.gap")}
            </span>
            <Segmented
              value={config.props.gap}
              aria-label={formatMessage("editor.gap")}
              options={[
                {
                  value: "compact",
                  label: formatMessage("editor.gap_compact"),
                },
                {
                  value: "regular",
                  label: formatMessage("editor.gap_regular"),
                },
                {
                  value: "spacious",
                  label: formatMessage("editor.gap_spacious"),
                },
              ]}
              onChange={(value: GapMode) => {
                commit(updateProps(config, {
                  gap: value,
                }));
              }}
            />
          </div>

          <div className="chips-masonry-layout-editor__row">
            <span className="chips-masonry-layout-editor__row-label">
              {formatMessage("editor.title_mode")}
            </span>
            <Select
              className="chips-masonry-layout-editor__sort-select"
              variant="borderless"
              value={config.props.titleMode}
              aria-label={formatMessage("editor.title_mode")}
              options={[
                {
                  value: "below-cover",
                  label: formatMessage("editor.title_below"),
                },
                {
                  value: "overlay",
                  label: formatMessage("editor.title_overlay"),
                },
                {
                  value: "hidden",
                  label: formatMessage("editor.title_hidden"),
                },
              ]}
              onChange={(value: TitleMode) => {
                commit(updateProps(config, {
                  titleMode: value,
                }));
              }}
            />
          </div>

          <div className="chips-masonry-layout-editor__row">
            <span className="chips-masonry-layout-editor__row-label">
              {formatMessage("editor.entry_text")}
            </span>
            <Checkbox
              checked={config.props.showSummary}
              aria-label={formatMessage("editor.show_summary")}
              onChange={(event) => {
                commit(updateProps(config, {
                  showSummary: event.target.checked,
                }));
              }}
            >
              {formatMessage("editor.show_summary")}
            </Checkbox>
          </div>

          <div className="chips-masonry-layout-editor__row">
            <span className="chips-masonry-layout-editor__row-label">
              {formatMessage("editor.page_size")}
            </span>
            <InputNumber
              value={config.props.pageSize}
              min={20}
              max={240}
              step={20}
              aria-label={formatMessage("editor.page_size")}
              onChange={(value: number | null) => {
                commit(updateProps(config, {
                  pageSize: typeof value === "number" ? value : 120,
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
          preferredAssetPrefix="assets/layouts/masonry/background"
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
          previewAutoHeight
          preferredAssetPrefix="assets/layouts/masonry/top-region"
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
  rootElement.setAttribute("data-chips-masonry-layout-editor-root", "true");
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
