import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { UnorderedListOutlined } from "@ant-design/icons";
import { Checkbox, ConfigProvider, InputNumber, Segmented, Select } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { FrameRegionEditor } from "./frame-region-editor";
import {
  normalizeLayoutConfig,
  visibleFieldKeys,
  type CoverSize,
  type GroupMode,
  type LayoutConfig,
  type RowDensity,
  type SortMode,
  type VisibleFieldKey,
} from "../schema/layout-config";
import type { BoxEntrySnapshot, ResolvedRuntimeResource } from "../shared/types";
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
.chips-list-layout-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  color: #1d1d1f;
  background: #ffffff;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.chips-list-layout-editor,
.chips-list-layout-editor * {
  box-sizing: border-box;
}

.chips-list-layout-editor__body {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.chips-list-layout-editor__form {
  width: 100%;
  min-width: 0;
  padding: 8px 12px 28px;
}

/* ---------- 面板头 ---------- */

.chips-list-layout-editor__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px 14px;
}

.chips-list-layout-editor__head-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
}

.chips-list-layout-editor__head-text {
  min-width: 0;
}

.chips-list-layout-editor__head-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-list-layout-editor__head-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

/* ---------- 分组（iOS inset grouped 风格） ---------- */

.chips-list-layout-editor__group {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.chips-list-layout-editor__group + .chips-list-layout-editor__frame,
.chips-list-layout-editor__frame + .chips-list-layout-editor__frame {
  margin-top: 16px;
}

.chips-list-layout-editor__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 14px;
}

.chips-list-layout-editor__row + .chips-list-layout-editor__row::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.chips-list-layout-editor__row-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  color: #1d1d1f;
}

.chips-list-layout-editor__hint {
  margin: 8px 6px 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-list-layout-editor__group-footer {
  margin: 10px 6px 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #6e6e73;
}

/* ---------- 行内 Select ---------- */

.chips-list-layout-editor .ant-select {
  min-width: 0;
  flex-shrink: 1;
}

.chips-list-layout-editor .ant-select .ant-select-content {
  padding-inline: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #6e6e73;
}

.chips-list-layout-editor .ant-select:hover .ant-select-content {
  color: #1d1d1f;
}

.chips-list-layout-editor .ant-select .ant-select-suffix {
  color: #8e8e93;
}

/* ---------- 行内分段控件 ---------- */

.chips-list-layout-editor .ant-segmented {
  flex-shrink: 0;
}

/* ---------- 显示字段复选框 ---------- */

.chips-list-layout-editor__field-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  min-width: 0;
  justify-content: flex-end;
}

/* ---------- 帧区域编辑 ---------- */

.chips-list-layout-editor__frame {
  display: grid;
  gap: 14px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  padding: 14px;
}

.chips-list-layout-editor__frame-head {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.chips-list-layout-editor__frame-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-list-layout-editor__frame-desc {
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-list-layout-editor__frame-actions {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.chips-list-layout-editor__frame-action-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.chips-list-layout-editor__frame-asset {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #6e6e73;
}

.chips-list-layout-editor__html-input textarea {
  min-height: 220px;
  resize: vertical;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.6;
}

.chips-list-layout-editor__frame-preview {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.chips-list-layout-editor__frame-preview-label {
  font-size: 12px;
  color: #6e6e73;
}

.chips-list-layout-editor__frame-preview-box {
  min-width: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: linear-gradient(180deg, #f2f2f7 0%, #e5e5ea 100%);
}

.chips-list-layout-editor__frame-preview-empty {
  min-width: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  font-size: 13px;
  color: #6e6e73;
  text-align: center;
}

.chips-list-layout-editor__frame-preview-box .chips-embedded-document-frame,
.chips-list-layout-editor__frame-preview-box iframe {
  width: 100%;
  height: 100%;
}

.chips-list-layout-editor__remove-button {
  font-size: 13px;
  min-height: 0;
  padding: 4px 6px;
}
`;

function updateConfig(config: LayoutConfig, patch: Partial<LayoutConfig["props"]>): LayoutConfig {
  return normalizeLayoutConfig({
    ...config,
    props: {
      ...config.props,
      ...patch,
    },
  });
}

function toggleVisibleField(config: LayoutConfig, field: VisibleFieldKey, checked: boolean): VisibleFieldKey[] {
  const current = new Set(config.props.visibleFields);
  if (checked) {
    current.add(field);
  } else {
    current.delete(field);
  }

  if (current.size === 0) {
    current.add("createdAt");
  }

  return visibleFieldKeys.filter((item) => current.has(item));
}

const visibleFieldMessageKeys: Record<VisibleFieldKey, string> = {
  createdAt: "editor.field_created_at",
  summary: "editor.field_summary",
  tags: "editor.field_tags",
  type: "editor.field_type",
};

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
      className="chips-list-layout-editor"
      data-scope="chips-list-layout-editor"
      aria-label={formatMessage("editor.section.layout")}
    >
      <style>{EDITOR_STYLE_TEXT}</style>
      <div className="chips-list-layout-editor__body" data-part="body">
        <form
          className="chips-list-layout-editor__form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="chips-list-layout-editor__head">
            <span className="chips-list-layout-editor__head-icon">
              <UnorderedListOutlined style={{ fontSize: 18 }} />
            </span>
            <div className="chips-list-layout-editor__head-text">
              <p className="chips-list-layout-editor__head-title">
                {formatMessage("editor.section.layout")}
              </p>
              <p className="chips-list-layout-editor__head-desc">
                {formatMessage("editor.auto_list_hint")}
              </p>
            </div>
          </div>

          <div className="chips-list-layout-editor__group">
            <div className="chips-list-layout-editor__row">
              <span className="chips-list-layout-editor__row-label">
                {formatMessage("editor.sort_mode")}
              </span>
              <Select
                className="chips-list-layout-editor__sort-select"
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
                onChange={(value) => {
                  commit(updateConfig(config, {
                    sortMode: value as SortMode,
                  }));
                }}
              />
            </div>
            <p className="chips-list-layout-editor__group-footer">
              {config.props.sortMode === "manual"
                ? formatMessage("editor.sort_manual_hint")
                : formatMessage("editor.sort_runtime_hint")}
            </p>

            <div className="chips-list-layout-editor__row">
              <span className="chips-list-layout-editor__row-label">
                {formatMessage("editor.row_density")}
              </span>
              <Segmented
                value={config.props.rowDensity}
                aria-label={formatMessage("editor.row_density")}
                options={[
                  { value: "compact", label: formatMessage("editor.row_density_compact") },
                  { value: "comfortable", label: formatMessage("editor.row_density_comfortable") },
                  { value: "spacious", label: formatMessage("editor.row_density_spacious") },
                ]}
                onChange={(value) => {
                  commit(updateConfig(config, {
                    rowDensity: value as RowDensity,
                  }));
                }}
              />
            </div>

            <div className="chips-list-layout-editor__row">
              <span className="chips-list-layout-editor__row-label">
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
                  commit(updateConfig(config, {
                    coverSize: value as CoverSize,
                  }));
                }}
              />
            </div>

            <div className="chips-list-layout-editor__row">
              <span className="chips-list-layout-editor__row-label">
                {formatMessage("editor.group_mode")}
              </span>
              <Select
                className="chips-list-layout-editor__group-select"
                variant="borderless"
                value={config.props.groupMode}
                aria-label={formatMessage("editor.group_mode")}
                options={[
                  { value: "none", label: formatMessage("editor.group_none") },
                  { value: "type", label: formatMessage("editor.group_type") },
                  { value: "tag", label: formatMessage("editor.group_tag") },
                ]}
                onChange={(value) => {
                  commit(updateConfig(config, {
                    groupMode: value as GroupMode,
                  }));
                }}
              />
            </div>

            <div className="chips-list-layout-editor__row">
              <span className="chips-list-layout-editor__row-label">
                {formatMessage("editor.visible_fields")}
              </span>
              <div className="chips-list-layout-editor__field-list">
                {visibleFieldKeys.map((field) => (
                  <Checkbox
                    key={field}
                    checked={config.props.visibleFields.includes(field)}
                    onChange={(event) => {
                      commit(updateConfig(config, {
                        visibleFields: toggleVisibleField(config, field, event.target.checked),
                      }));
                    }}
                  >
                    {formatMessage(visibleFieldMessageKeys[field])}
                  </Checkbox>
                ))}
              </div>
            </div>

            <div className="chips-list-layout-editor__row">
              <span className="chips-list-layout-editor__row-label">
                {formatMessage("editor.page_size")}
              </span>
              <InputNumber
                min={20}
                max={240}
                step={20}
                value={config.props.pageSize}
                aria-label={formatMessage("editor.page_size")}
                onChange={(value) => {
                  commit(updateConfig(config, {
                    pageSize: typeof value === "number" ? value : 120,
                  }));
                }}
              />
            </div>
            <p className="chips-list-layout-editor__group-footer">
              {formatMessage("editor.entry_count", { count: entries.length })}
            </p>
          </div>

          <FrameRegionEditor
            id="background"
            region={config.props.background}
            title={formatMessage("editor.background_title")}
            description={formatMessage("editor.background_desc")}
            previewRatio="16:9"
            previewMinHeight="180px"
            preferredAssetPrefix="assets/layouts/list/background"
            readBoxAsset={readBoxAsset}
            importBoxAsset={importBoxAsset}
            deleteBoxAsset={deleteBoxAsset}
            onChange={(nextRegion) => {
              commit(updateConfig(config, {
                background: nextRegion,
              }));
            }}
          />

          <FrameRegionEditor
            id="topRegion"
            region={config.props.topRegion}
            title={formatMessage("editor.top_region_title")}
            description={formatMessage("editor.top_region_desc")}
            previewRatio="16:5"
            previewMinHeight="160px"
            preferredAssetPrefix="assets/layouts/list/top-region"
            readBoxAsset={readBoxAsset}
            importBoxAsset={importBoxAsset}
            deleteBoxAsset={deleteBoxAsset}
            onChange={(nextRegion) => {
              commit(updateConfig(config, {
                topRegion: nextRegion,
              }));
            }}
          />
        </form>
      </div>
    </section>
  );
}

export function createLayoutEditorRoot(props: LayoutEditorPanelProps): LayoutEditorRoot {
  const rootElement = document.createElement("div") as LayoutEditorRoot;
  rootElement.setAttribute("data-chips-list-layout-editor-root", "true");
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
