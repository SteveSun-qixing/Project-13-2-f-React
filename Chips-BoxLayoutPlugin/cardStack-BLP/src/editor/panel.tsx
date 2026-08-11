import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { ConfigProvider, Input, InputNumber, Segmented, Select, Typography } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { FrameRegionEditor } from "./frame-region-editor";
import type { BoxEntrySnapshot, ResolvedRuntimeResource } from "../shared/types";
import {
  normalizeLayoutConfig,
  type CardSize,
  type FrameRegionConfig,
  type LayoutConfig,
  type ReviewLoop,
  type SortMode,
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
.chips-box-layout-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  color: #1d1d1f;
  background-color: #ffffff;
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}

.chips-box-layout-editor,
.chips-box-layout-editor * {
  box-sizing: border-box;
}

.chips-box-layout-editor__form {
  width: 100%;
  min-width: 0;
  padding: 16px;
}

.chips-box-layout-editor__stack {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.chips-box-layout-editor__section {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.chips-box-layout-editor__section-head {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.chips-box-layout-editor__section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-box-layout-editor__section-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-layout-editor__region {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.chips-box-layout-editor__region-head {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.chips-box-layout-editor__region-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-box-layout-editor__region-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-layout-editor__field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-box-layout-editor__field-label {
  font-size: 14px;
  line-height: 1.5;
  color: #1d1d1f;
}

.chips-box-layout-editor__field-hint {
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-layout-editor__muted-text {
  display: block;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-layout-editor__error {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #ff3b30;
}

.chips-box-layout-editor .ant-select {
  min-width: 0;
  max-width: 100%;
}

.chips-box-layout-editor .ant-select .ant-select-content {
  padding-inline: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #6e6e73;
}

.chips-box-layout-editor .ant-select:hover .ant-select-content {
  color: #1d1d1f;
}

.chips-box-layout-editor .ant-select .ant-select-suffix {
  color: #8e8e93;
}

.chips-box-layout-editor .ant-segmented {
  width: fit-content;
  max-width: 100%;
}

.chips-box-layout-editor__asset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chips-box-layout-editor__bridge-error .ant-result-title {
  font-size: 13px;
  color: #ff3b30;
}

.chips-box-layout-editor__bridge-error .ant-result-subtitle {
  font-size: 12px;
  color: #6e6e73;
}

.chips-box-layout-editor [data-frame-region-asset-path] {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #6e6e73;
  font-size: 12px;
}

.chips-box-layout-editor [data-frame-region-preview-shell] {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-box-layout-editor [data-frame-region-preview] {
  width: 100%;
  min-height: 160px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #ffffff;
}

.chips-box-layout-editor [data-frame-region-preview] .chips-embedded-document-frame,
.chips-box-layout-editor [data-frame-region-preview] iframe {
  width: 100%;
  height: 100%;
}

.chips-box-layout-editor [data-frame-region-preview-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-box-layout-editor [data-frame-region-preview-status] {
  min-height: 160px;
  display: grid;
  place-items: center;
  padding: 16px;
  color: #6e6e73;
  text-align: center;
}

.chips-box-layout-editor [data-frame-region-preview-label] {
  color: #6e6e73;
  font-size: 12px;
}

.chips-box-layout-editor [data-cardstack-preview] {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-width: 0;
  padding-block: 8px;
}

.chips-box-layout-editor [data-cardstack-preview-stack] {
  position: relative;
  width: min(100%, 220px);
  aspect-ratio: 3 / 4;
}

.chips-box-layout-editor [data-cardstack-preview-layer] {
  position: absolute;
  inset: 0;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background-color: #f2f2f7;
  box-shadow: 0 8px 24px rgb(15 23 42 / 10%);
  transform:
    translate3d(calc(var(--layer-index) * 8px), calc(var(--layer-index) * 8px), 0)
    rotate(calc(var(--layer-index) * var(--preview-rotation) * 1deg));
}

.chips-box-layout-editor [data-cardstack-preview-layer="top"] {
  display: grid;
  place-items: center;
  padding: 16px;
  color: #1d1d1f;
  font-weight: 700;
  background-color: #ffffff;
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

function PreviewStack({
  config,
}: {
  config: LayoutConfig;
}) {
  const layerCount = Math.min(config.props.stackDepth, 5);
  return (
    <div data-cardstack-preview>
      <div
        data-cardstack-preview-stack
        style={{
          "--preview-rotation": String(config.props.spreadRotationDeg),
        } as React.CSSProperties}
        aria-hidden="true"
      >
        {Array.from({ length: layerCount }).map((_, index) => {
          const reverseIndex = layerCount - index - 1;
          return (
            <div
              key={index}
              data-cardstack-preview-layer={index === layerCount - 1 ? "top" : "base"}
              style={{
                "--layer-index": String(reverseIndex),
              } as React.CSSProperties}
            >
              {index === layerCount - 1 ? formatMessage("editor.preview_card") : null}
            </div>
          );
        })}
      </div>
      <Typography.Text className="chips-box-layout-editor__muted-text">
        {formatMessage("editor.preview_hint")}
      </Typography.Text>
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
      className="chips-box-layout-editor"
      data-scope="chips-box-layout-editor"
      aria-label={formatMessage("editor.aria_label")}
    >
      <style>{EDITOR_STYLE_TEXT}</style>
      <form
        className="chips-box-layout-editor__form"
        aria-label={formatMessage("editor.aria_label")}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="chips-box-layout-editor__stack">
          <section className="chips-box-layout-editor__section">
            <div className="chips-box-layout-editor__section-head">
              <p className="chips-box-layout-editor__section-title">
                {formatMessage("editor.section.stack")}
              </p>
              <p className="chips-box-layout-editor__section-desc">
                {formatMessage("editor.section.stack_desc")}
              </p>
            </div>

            <div className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.sort_mode")}
              </span>
              <Select
                className="chips-box-layout-editor__sort-select"
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
              <span className="chips-box-layout-editor__field-hint">
                {config.props.sortMode === "manual"
                  ? formatMessage("editor.sort_manual_hint")
                  : config.props.sortMode === "random"
                    ? formatMessage("editor.sort_random_hint")
                    : formatMessage("editor.sort_runtime_hint")}
              </span>
            </div>

            {config.props.sortMode === "random" ? (
              <div className="chips-box-layout-editor__field">
                <span className="chips-box-layout-editor__field-label">
                  {formatMessage("editor.random_seed")}
                </span>
                <Input
                  value={config.props.randomSeed}
                  aria-label={formatMessage("editor.random_seed")}
                  onChange={(event) => {
                    commit(updateProps(config, {
                      randomSeed: event.target.value,
                    }));
                  }}
                />
                <span className="chips-box-layout-editor__field-hint">
                  {formatMessage("editor.random_seed_hint")}
                </span>
              </div>
            ) : null}

            <div className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.card_size")}
              </span>
              <Segmented
                value={config.props.cardSize}
                aria-label={formatMessage("editor.card_size")}
                options={[
                  { value: "compact", label: formatMessage("editor.card_size_compact") },
                  { value: "regular", label: formatMessage("editor.card_size_regular") },
                  { value: "large", label: formatMessage("editor.card_size_large") },
                ]}
                onChange={(value) => {
                  commit(updateProps(config, {
                    cardSize: value as CardSize,
                  }));
                }}
              />
            </div>

            <div className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.review_loop")}
              </span>
              <Segmented
                value={config.props.reviewLoop}
                aria-label={formatMessage("editor.review_loop")}
                options={[
                  { value: "stop-at-end", label: formatMessage("editor.review_stop") },
                  { value: "loop", label: formatMessage("editor.review_loop_enabled") },
                ]}
                onChange={(value) => {
                  commit(updateProps(config, {
                    reviewLoop: value as ReviewLoop,
                  }));
                }}
              />
            </div>

            <div className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.stack_depth")}
              </span>
              <InputNumber
                value={config.props.stackDepth}
                min={2}
                max={8}
                step={1}
                aria-label={formatMessage("editor.stack_depth")}
                style={{ width: 140 }}
                onChange={(value) => {
                  commit(updateProps(config, {
                    stackDepth: typeof value === "number" ? value : 4,
                  }));
                }}
              />
              <span className="chips-box-layout-editor__field-hint">
                {formatMessage("editor.stack_depth_hint")}
              </span>
            </div>

            <div className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.spread_rotation")}
              </span>
              <InputNumber
                value={config.props.spreadRotationDeg}
                min={0}
                max={12}
                step={1}
                aria-label={formatMessage("editor.spread_rotation")}
                style={{ width: 140 }}
                onChange={(value) => {
                  commit(updateProps(config, {
                    spreadRotationDeg: typeof value === "number" ? value : 5,
                  }));
                }}
              />
              <span className="chips-box-layout-editor__field-hint">
                {formatMessage("editor.spread_rotation_hint")}
              </span>
            </div>

            <div className="chips-box-layout-editor__field">
              <span className="chips-box-layout-editor__field-label">
                {formatMessage("editor.swipe_threshold")}
              </span>
              <InputNumber
                value={config.props.swipeThreshold}
                min={80}
                max={260}
                step={10}
                aria-label={formatMessage("editor.swipe_threshold")}
                style={{ width: 140 }}
                onChange={(value) => {
                  commit(updateProps(config, {
                    swipeThreshold: typeof value === "number" ? value : 120,
                  }));
                }}
              />
              <span className="chips-box-layout-editor__field-hint">
                {formatMessage("editor.swipe_threshold_hint")}
              </span>
            </div>

            <Typography.Text className="chips-box-layout-editor__muted-text">
              {formatMessage("editor.entry_count", { count: entries.length })}
            </Typography.Text>

            <PreviewStack config={config} />
          </section>

          <FrameRegionEditor
            id="background"
            region={config.props.background}
            title={formatMessage("editor.background_title")}
            description={formatMessage("editor.background_desc")}
            previewRatio="16:9"
            preferredAssetPrefix="assets/layouts/chips.layout.cardstack.blp/background"
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
            preferredAssetPrefix="assets/layouts/chips.layout.cardstack.blp/top-region"
            readBoxAsset={readBoxAsset}
            importBoxAsset={importBoxAsset}
            deleteBoxAsset={deleteBoxAsset}
            onChange={(nextRegion) => {
              commit(updateFrameRegion(config, "topRegion", nextRegion));
            }}
          />
        </div>
      </form>
    </section>
  );
}

export function createLayoutEditorRoot(props: LayoutEditorPanelProps): LayoutEditorRoot {
  const rootElement = document.createElement("div") as LayoutEditorRoot;
  rootElement.setAttribute("data-chips-box-layout-editor-root", "true");
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
