import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { DotChartOutlined } from "@ant-design/icons";
import { ConfigProvider, InputNumber, Segmented, Select } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { FrameRegionEditor } from "./frame-region-editor";
import { createScatterPlacements } from "../shared/scatter";
import type { BoxEntrySnapshot, ResolvedRuntimeResource } from "../shared/types";
import {
  CYCLE_INTERVAL_MS_MAX,
  CYCLE_INTERVAL_MS_MIN,
  VISIBLE_FAKE_COUNT_MAX,
  VISIBLE_FAKE_COUNT_MIN,
  normalizeLayoutConfig,
  type CardSize,
  type FrameRegionConfig,
  type LayoutConfig,
  type MotionMode,
  type SortMode,
  type SpreadMode,
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
.chips-box-scattered-layout-editor {
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

.chips-box-scattered-layout-editor,
.chips-box-scattered-layout-editor * {
  box-sizing: border-box;
}

.chips-box-scattered-layout-editor__form {
  width: 100%;
  min-width: 0;
  padding: 8px 12px 28px;
}

/* ---------- 面板头 ---------- */

.chips-box-scattered-layout-editor__head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px 14px;
}

.chips-box-scattered-layout-editor__head-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
}

.chips-box-scattered-layout-editor__head-text {
  min-width: 0;
}

.chips-box-scattered-layout-editor__head-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-box-scattered-layout-editor__head-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-scattered-layout-editor__head-count {
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

.chips-box-scattered-layout-editor__group {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.chips-box-scattered-layout-editor__group + .chips-box-scattered-layout-editor__group {
  margin-top: 16px;
}

.chips-box-scattered-layout-editor__group-head {
  padding: 12px 14px 8px;
}

.chips-box-scattered-layout-editor__group-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-box-scattered-layout-editor__group-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-scattered-layout-editor__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 14px;
}

.chips-box-scattered-layout-editor__row + .chips-box-scattered-layout-editor__row::before,
.chips-box-scattered-layout-editor__row + .chips-box-scattered-layout-editor__image-area::before,
.chips-box-scattered-layout-editor__row + .chips-box-scattered-layout-editor__code-area::before,
.chips-box-scattered-layout-editor__image-area + .chips-box-scattered-layout-editor__row::before,
.chips-box-scattered-layout-editor__code-area + .chips-box-scattered-layout-editor__row::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.chips-box-scattered-layout-editor__row-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  color: #1d1d1f;
}

.chips-box-scattered-layout-editor__group-footer {
  margin: 10px 6px 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #6e6e73;
}

/* ---------- 行内控件 ---------- */

.chips-box-scattered-layout-editor .ant-select {
  min-width: 0;
  flex-shrink: 1;
}

.chips-box-scattered-layout-editor .ant-select .ant-select-content {
  padding-inline: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #6e6e73;
}

.chips-box-scattered-layout-editor .ant-select:hover .ant-select-content {
  color: #1d1d1f;
}

.chips-box-scattered-layout-editor .ant-select .ant-select-suffix {
  color: #8e8e93;
}

.chips-box-scattered-layout-editor .ant-segmented {
  flex-shrink: 0;
}

.chips-box-scattered-layout-editor .ant-input-number {
  min-width: 112px;
}

.chips-box-scattered-layout-editor__text-input {
  flex: 1;
  min-width: 0;
  width: auto;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  color: #1d1d1f;
  background: #ffffff;
  font: inherit;
}

/* ---------- 区域编辑器 ---------- */

.chips-box-scattered-layout-editor__image-area,
.chips-box-scattered-layout-editor__code-area {
  position: relative;
  padding: 10px 14px 12px;
}

.chips-box-scattered-layout-editor__row-actions {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  padding-top: 6px;
}

.chips-box-scattered-layout-editor__remove-button {
  font-size: 13px;
  min-height: 0;
  padding: 4px 6px;
}

.chips-box-scattered-layout-editor__asset-label {
  display: block;
  margin-top: 10px;
  color: #6e6e73;
  font-size: 12px;
}

.chips-box-scattered-layout-editor [data-frame-region-asset-path] {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #6e6e73;
  font-size: 12px;
  margin-top: 8px;
}

.chips-box-scattered-layout-editor [data-frame-region-preview-shell] {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px 14px 12px;
}

.chips-box-scattered-layout-editor [data-frame-region-preview] {
  width: 100%;
  min-height: 160px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #ffffff;
}

.chips-box-scattered-layout-editor [data-frame-region-preview] .chips-embedded-document-frame,
.chips-box-scattered-layout-editor [data-frame-region-preview] iframe {
  width: 100%;
  height: 100%;
}

.chips-box-scattered-layout-editor [data-frame-region-preview-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-box-scattered-layout-editor [data-frame-region-preview-status] {
  min-height: 160px;
  display: grid;
  place-items: center;
  padding: 16px;
  color: #6e6e73;
  text-align: center;
}

.chips-box-scattered-layout-editor [data-frame-region-preview-label] {
  color: #6e6e73;
  font-size: 12px;
}

/* ---------- 散落预览 ---------- */

.chips-box-scattered-layout-editor__preview {
  position: relative;
  min-height: 180px;
  overflow: hidden;
  margin: 10px 14px 14px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: #f2f2f7;
}

.chips-box-scattered-layout-editor__preview-card {
  position: absolute;
  left: 50%;
  top: 50%;
  width: clamp(82px, 28%, 132px);
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: var(--scatter-color);
  transform: translate(calc(-50% + var(--scatter-x)), calc(-50% + var(--scatter-y))) rotate(var(--scatter-rotate)) scale(var(--scatter-scale));
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.12);
}

/* ---------- 错误 ---------- */

.chips-box-scattered-layout-editor__error {
  margin: 8px 6px 0;
  font-size: 12px;
  line-height: 1.6;
  color: #ff3b30;
}

.chips-box-scattered-layout-editor__text-input:focus-visible,
.chips-box-scattered-layout-editor__remove-button:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}
`;

const PREVIEW_COLORS = [
  "color-mix(in srgb, #0a84ff 24%, #ffffff)",
  "color-mix(in srgb, #34c759 24%, #ffffff)",
  "color-mix(in srgb, #ff2d55 22%, #ffffff)",
  "color-mix(in srgb, #ff9f0a 20%, #ffffff)",
  "color-mix(in srgb, #30b0c7 20%, #ffffff)",
  "color-mix(in srgb, #ffcc00 20%, #ffffff)",
  "color-mix(in srgb, #f2f2f7 86%, #0a84ff)",
];

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
  region: FrameRegionConfig,
): LayoutConfig {
  return updateProps(config, {
    [key]: region,
  });
}

function ScatterPreview({ config }: { config: LayoutConfig }) {
  const placements = React.useMemo(
    () => createScatterPlacements(Math.max(4, Math.min(8, config.props.visibleFakeCount + 1)), config.props.randomSeed, config.props.spread),
    [config.props.randomSeed, config.props.spread, config.props.visibleFakeCount],
  );

  return (
    <div className="chips-box-scattered-layout-editor__preview" aria-hidden="true">
      {placements.map((placement, index) => (
        <span
          key={`${config.props.randomSeed}-${index}`}
          className="chips-box-scattered-layout-editor__preview-card"
          style={{
            "--scatter-x": `${placement.x}%`,
            "--scatter-y": `${placement.y}%`,
            "--scatter-rotate": `${placement.rotate}deg`,
            "--scatter-scale": placement.scale,
            "--scatter-color": PREVIEW_COLORS[placement.colorIndex % PREVIEW_COLORS.length],
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
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
      className="chips-box-scattered-layout-editor"
      data-scope="chips-box-layout-editor"
      aria-label={formatMessage("editor.aria_label")}
    >
      <style>{EDITOR_STYLE_TEXT}</style>
      <form
        className="chips-box-scattered-layout-editor__form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="chips-box-scattered-layout-editor__head">
          <span className="chips-box-scattered-layout-editor__head-icon">
            <DotChartOutlined style={{ fontSize: 18 }} />
          </span>
          <div className="chips-box-scattered-layout-editor__head-text">
            <p className="chips-box-scattered-layout-editor__head-title">散乱布局</p>
            <p className="chips-box-scattered-layout-editor__head-desc">随机卡片堆浏览、顶层封面切换与布局参数编辑</p>
          </div>
          <span className="chips-box-scattered-layout-editor__head-count">
            {formatMessage("editor.entry_count", { count: entries.length })}
          </span>
        </div>

        <div className="chips-box-scattered-layout-editor__group">
          <div className="chips-box-scattered-layout-editor__group-head">
            <p className="chips-box-scattered-layout-editor__group-title">
              {formatMessage("editor.section.behavior")}
            </p>
            <p className="chips-box-scattered-layout-editor__group-desc">
              {formatMessage("editor.section.behavior_desc")}
            </p>
          </div>
          <div className="chips-box-scattered-layout-editor__row">
            <span className="chips-box-scattered-layout-editor__row-label">
              {formatMessage("editor.sort_mode")}
            </span>
            <Select
              className="chips-box-scattered-layout-editor__sort-select"
              variant="borderless"
              value={config.props.sortMode}
              aria-label={formatMessage("editor.sort_mode")}
              options={[
                {
                  value: "manual",
                  label: formatMessage("editor.sort_manual"),
                },
                {
                  value: "name",
                  label: formatMessage("editor.sort_name"),
                },
                {
                  value: "random",
                  label: formatMessage("editor.sort_random"),
                },
              ]}
              onChange={(value: SortMode) => {
                commit(updateProps(config, {
                  sortMode: value,
                }));
              }}
            />
          </div>
          <p className="chips-box-scattered-layout-editor__group-footer">
            {config.props.sortMode === "random"
              ? formatMessage("editor.sort_random_hint")
              : config.props.sortMode === "name"
                ? formatMessage("editor.sort_name_hint")
                : formatMessage("editor.sort_manual_hint")}
          </p>
          <div className="chips-box-scattered-layout-editor__row">
            <span className="chips-box-scattered-layout-editor__row-label">
              {formatMessage("editor.random_seed")}
            </span>
            <input
              className="chips-box-scattered-layout-editor__text-input"
              value={config.props.randomSeed}
              aria-label={formatMessage("editor.random_seed")}
              onChange={(event) => {
                commit(updateProps(config, {
                  randomSeed: event.currentTarget.value,
                }));
              }}
            />
          </div>
          <p className="chips-box-scattered-layout-editor__group-footer">
            {formatMessage("editor.random_seed_hint")}
          </p>
          <div className="chips-box-scattered-layout-editor__row">
            <span className="chips-box-scattered-layout-editor__row-label">
              {formatMessage("editor.visible_fake_count")}
            </span>
            <InputNumber
              value={config.props.visibleFakeCount}
              min={VISIBLE_FAKE_COUNT_MIN}
              max={VISIBLE_FAKE_COUNT_MAX}
              step={1}
              aria-label={formatMessage("editor.visible_fake_count")}
              onChange={(value: number | null) => {
                commit(updateProps(config, {
                  visibleFakeCount: typeof value === "number" ? value : config.props.visibleFakeCount,
                }));
              }}
            />
          </div>
          <div className="chips-box-scattered-layout-editor__row">
            <span className="chips-box-scattered-layout-editor__row-label">
              {formatMessage("editor.cycle_interval")}
            </span>
            <InputNumber
              value={config.props.cycleIntervalMs}
              min={CYCLE_INTERVAL_MS_MIN}
              max={CYCLE_INTERVAL_MS_MAX}
              step={500}
              aria-label={formatMessage("editor.cycle_interval")}
              onChange={(value: number | null) => {
                commit(updateProps(config, {
                  cycleIntervalMs: typeof value === "number" ? value : config.props.cycleIntervalMs,
                }));
              }}
            />
          </div>
          <p className="chips-box-scattered-layout-editor__group-footer">
            {formatMessage("editor.cycle_interval_hint")}
          </p>
        </div>

        <div className="chips-box-scattered-layout-editor__group">
          <div className="chips-box-scattered-layout-editor__group-head">
            <p className="chips-box-scattered-layout-editor__group-title">
              {formatMessage("editor.section.appearance")}
            </p>
            <p className="chips-box-scattered-layout-editor__group-desc">
              {formatMessage("editor.section.appearance_desc")}
            </p>
          </div>
          <div className="chips-box-scattered-layout-editor__row">
            <span className="chips-box-scattered-layout-editor__row-label">
              {formatMessage("editor.card_size")}
            </span>
            <Segmented
              value={config.props.cardSize}
              aria-label={formatMessage("editor.card_size")}
              options={[
                {
                  value: "compact",
                  label: formatMessage("editor.card_size_compact"),
                },
                {
                  value: "regular",
                  label: formatMessage("editor.card_size_regular"),
                },
                {
                  value: "large",
                  label: formatMessage("editor.card_size_large"),
                },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  cardSize: value as CardSize,
                }));
              }}
            />
          </div>
          <div className="chips-box-scattered-layout-editor__row">
            <span className="chips-box-scattered-layout-editor__row-label">
              {formatMessage("editor.spread")}
            </span>
            <Segmented
              value={config.props.spread}
              aria-label={formatMessage("editor.spread")}
              options={[
                {
                  value: "calm",
                  label: formatMessage("editor.spread_calm"),
                },
                {
                  value: "loose",
                  label: formatMessage("editor.spread_loose"),
                },
                {
                  value: "wild",
                  label: formatMessage("editor.spread_wild"),
                },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  spread: value as SpreadMode,
                }));
              }}
            />
          </div>
          <div className="chips-box-scattered-layout-editor__row">
            <span className="chips-box-scattered-layout-editor__row-label">
              {formatMessage("editor.motion")}
            </span>
            <Segmented
              value={config.props.motion}
              aria-label={formatMessage("editor.motion")}
              options={[
                {
                  value: "auto",
                  label: formatMessage("editor.motion_auto"),
                },
                {
                  value: "reduced",
                  label: formatMessage("editor.motion_reduced"),
                },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  motion: value as MotionMode,
                }));
              }}
            />
          </div>
          <p className="chips-box-scattered-layout-editor__group-footer">
            {formatMessage("editor.motion_hint")}
          </p>
          <ScatterPreview config={config} />
        </div>

        <FrameRegionEditor
          id="background"
          region={config.props.background}
          title={formatMessage("editor.background_title")}
          description={formatMessage("editor.background_desc")}
          previewRatio="16:9"
          preferredAssetPrefix="assets/layouts/chips.layout.scattered.blp/background"
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
          preferredAssetPrefix="assets/layouts/chips.layout.scattered.blp/top-region"
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
  rootElement.setAttribute("data-chips-scattered-layout-editor-root", "true");
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
