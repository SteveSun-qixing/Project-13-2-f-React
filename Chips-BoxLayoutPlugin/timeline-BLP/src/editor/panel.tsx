import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Button, ConfigProvider, Input, Segmented, Select, Switch, Typography } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { FrameRegionEditor } from "./frame-region-editor";
import type { BoxEntrySnapshot, ResolvedRuntimeResource } from "../shared/types";
import {
  normalizeLayoutConfig,
  type FrameRegionConfig,
  type LayoutConfig,
  type TimelineCardDensity,
  type TimelineOrientation,
  type TimelinePointConfig,
  type TimelineScaleMode,
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
.chips-box-timeline-editor {
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

.chips-box-timeline-editor,
.chips-box-timeline-editor * {
  box-sizing: border-box;
}

.chips-box-timeline-editor__form {
  width: 100%;
  min-width: 0;
  padding: 8px 12px 28px;
}

/* ---------- 分组（iOS inset grouped 风格） ---------- */

.chips-box-timeline-editor__group {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  overflow: hidden;
}

.chips-box-timeline-editor__group + .chips-box-timeline-editor__group {
  margin-top: 16px;
}

.chips-box-timeline-editor__group-head {
  padding: 12px 14px 6px;
}

.chips-box-timeline-editor__group-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-box-timeline-editor__group-desc {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-timeline-editor__row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 0 14px;
}

.chips-box-timeline-editor__row + .chips-box-timeline-editor__row::before,
.chips-box-timeline-editor__row + .chips-box-timeline-editor__group-footer::before,
.chips-box-timeline-editor__row + .chips-box-timeline-editor__point::before,
.chips-box-timeline-editor__row + .chips-box-timeline-editor__asset-area::before {
  content: "";
  position: absolute;
  top: 0;
  left: 14px;
  right: 0;
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.chips-box-timeline-editor__row-label {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 400;
  color: #1d1d1f;
}

.chips-box-timeline-editor__group-footer {
  margin: 10px 6px 0;
  padding: 0 8px 12px;
  font-size: 11.5px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-box-timeline-editor .ant-segmented {
  flex-shrink: 0;
}

/* ---------- 行内 Select ---------- */

.chips-box-timeline-editor .ant-select {
  min-width: 0;
  flex-shrink: 1;
}

.chips-box-timeline-editor .ant-select .ant-select-content {
  padding-inline: 0;
  font-size: 14px;
  line-height: 1.5;
  color: #6e6e73;
}

.chips-box-timeline-editor .ant-select:hover .ant-select-content {
  color: #1d1d1f;
}

.chips-box-timeline-editor .ant-select .ant-select-suffix {
  color: #8e8e93;
}

/* ---------- 时间点 ---------- */

.chips-box-timeline-editor__point {
  position: relative;
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 12px 14px;
}

.chips-box-timeline-editor__point + .chips-box-timeline-editor__point {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.chips-box-timeline-editor__point-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.chips-box-timeline-editor__point-title {
  min-width: 0;
  overflow-wrap: anywhere;
}

.chips-box-timeline-editor__point-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
}

.chips-box-timeline-editor__field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-box-timeline-editor__field-label {
  font-size: 12px;
  font-weight: 600;
  color: #6e6e73;
}

.chips-box-timeline-editor__entry-list {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-box-timeline-editor__entry-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background-color: #ffffff;
}

.chips-box-timeline-editor__entry-title {
  min-width: 0;
  overflow-wrap: anywhere;
}

/* ---------- 条目绑定 ---------- */

.chips-box-timeline-editor__binding-row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 12px 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.chips-box-timeline-editor__binding-row .ant-select {
  flex: 1 1 0;
}

/* ---------- 区域编辑 ---------- */

.chips-box-timeline-editor__asset-area,
.chips-box-timeline-editor__code-area {
  position: relative;
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 12px 14px;
}

.chips-box-timeline-editor__row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chips-box-timeline-editor [data-frame-region-asset-path] {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #6e6e73;
  font-size: 12px;
}

.chips-box-timeline-editor [data-frame-region-preview-shell] {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 0 14px 12px;
}

.chips-box-timeline-editor [data-frame-region-preview] {
  width: 100%;
  min-height: 160px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  background-color: #ffffff;
}

.chips-box-timeline-editor [data-frame-region-preview] .chips-embedded-document-frame,
.chips-box-timeline-editor [data-frame-region-preview] iframe {
  width: 100%;
  height: 100%;
}

.chips-box-timeline-editor [data-frame-region-preview-image] {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-box-timeline-editor [data-frame-region-preview-status] {
  min-height: 160px;
  display: grid;
  place-items: center;
  padding: 16px;
  color: #6e6e73;
  text-align: center;
}

.chips-box-timeline-editor [data-frame-region-preview-label] {
  color: #6e6e73;
  font-size: 12px;
}

.chips-box-timeline-editor__error {
  margin: 8px 6px 0;
  font-size: 12px;
  line-height: 1.6;
  color: #ff3b30;
}

.chips-box-timeline-editor__bridge-error.ant-result {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 0;
  margin: 0;
}

.chips-box-timeline-editor__bridge-error .ant-result-icon {
  margin: 0;
  padding-top: 2px;
}

.chips-box-timeline-editor__bridge-error .ant-result-title {
  font-size: 13px;
  line-height: 1.5;
  color: #ff3b30;
}

.chips-box-timeline-editor__bridge-error .ant-result-subtitle {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.6;
}

.chips-box-timeline-editor .chips-box-timeline-editor__remove-button {
  font-size: 13px;
  min-height: 0;
  padding: 4px 6px;
}

.chips-box-timeline-editor :focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

@media (max-width: 560px) {
  .chips-box-timeline-editor__point-grid,
  .chips-box-timeline-editor__binding-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .chips-box-timeline-editor__binding-row {
    display: grid;
  }
}
`;

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function updateProps(config: LayoutConfig, patch: Partial<LayoutConfig["props"]>): LayoutConfig {
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

function createPointId(points: TimelinePointConfig[]): string {
  const used = new Set(points.map((point) => point.id));
  let index = points.length + 1;
  let id = `point-${index}`;
  while (used.has(id)) {
    index += 1;
    id = `point-${index}`;
  }
  return id;
}

function updatePoint(
  config: LayoutConfig,
  pointId: string,
  patch: Partial<TimelinePointConfig>
): LayoutConfig {
  return updateProps(config, {
    points: config.props.points.map((point) => (
      point.id === pointId
        ? {
          ...point,
          ...patch,
        }
        : point
    )),
  });
}

function removePoint(config: LayoutConfig, pointId: string): LayoutConfig {
  return updateProps(config, {
    points: config.props.points.filter((point) => point.id !== pointId),
  });
}

function addPoint(config: LayoutConfig): LayoutConfig {
  const id = createPointId(config.props.points);
  return updateProps(config, {
    points: [
      ...config.props.points,
      {
        id,
        label: formatMessage("editor.new_point_label", { index: config.props.points.length + 1 }),
        entryIds: [],
      },
    ],
  });
}

function bindEntry(config: LayoutConfig, pointId: string, entryId: string): LayoutConfig {
  return updateProps(config, {
    points: config.props.points.map((point) => {
      const withoutEntry = point.entryIds.filter((currentEntryId) => currentEntryId !== entryId);
      return point.id === pointId
        ? {
          ...point,
          entryIds: [...withoutEntry, entryId],
        }
        : {
          ...point,
          entryIds: withoutEntry,
        };
    }),
  });
}

function removeEntryFromPoint(config: LayoutConfig, pointId: string, entryId: string): LayoutConfig {
  return updateProps(config, {
    points: config.props.points.map((point) => (
      point.id === pointId
        ? {
          ...point,
          entryIds: point.entryIds.filter((currentEntryId) => currentEntryId !== entryId),
        }
        : point
    )),
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
  const [selectedEntryId, setSelectedEntryId] = React.useState<string>("");
  const [selectedPointId, setSelectedPointId] = React.useState<string>("");
  const entryById = React.useMemo(() => new Map(entries.map((entry) => [entry.entryId, entry])), [entries]);
  const assignedEntryIds = React.useMemo(() => new Set(config.props.points.flatMap((point) => point.entryIds)), [config.props.points]);
  const unscheduledEntries = React.useMemo(
    () => entries.filter((entry) => entry.enabled && !assignedEntryIds.has(entry.entryId)),
    [assignedEntryIds, entries]
  );

  React.useEffect(() => {
    setConfig(normalizeLayoutConfig(initialConfig));
  }, [initialConfig]);

  React.useEffect(() => {
    setSelectedEntryId((current) => current || (unscheduledEntries[0]?.entryId ?? ""));
  }, [unscheduledEntries]);

  React.useEffect(() => {
    setSelectedPointId((current) => current || (config.props.points[0]?.id ?? ""));
  }, [config.props.points]);

  function commit(next: LayoutConfig): void {
    const normalized = normalizeLayoutConfig(next);
    setConfig(normalized);
    onChange(normalized);
  }

  const pointOptions = config.props.points.map((point) => ({
    value: point.id,
    label: point.label,
  }));
  const unscheduledOptions = unscheduledEntries.map((entry) => ({
    value: entry.entryId,
    label: resolveEntryTitle(entry),
  }));
  const canBind = Boolean(selectedEntryId && selectedPointId);

  return (
    <section
      className="chips-box-timeline-editor"
      data-scope="chips-box-layout-editor"
      aria-label={formatMessage("editor.aria_label")}
    >
      <style>{EDITOR_STYLE_TEXT}</style>
      <form
        className="chips-box-timeline-editor__form"
        aria-label={formatMessage("editor.aria_label")}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="chips-box-timeline-editor__group">
          <header className="chips-box-timeline-editor__group-head">
            <p className="chips-box-timeline-editor__group-title">
              {formatMessage("editor.section.timeline")}
            </p>
            <p className="chips-box-timeline-editor__group-desc">
              {formatMessage("editor.section.timeline_desc")}
            </p>
          </header>

          <div className="chips-box-timeline-editor__row">
            <span className="chips-box-timeline-editor__row-label">
              {formatMessage("editor.orientation")}
            </span>
            <Segmented
              value={config.props.orientation}
              aria-label={formatMessage("editor.orientation")}
              options={[
                { value: "vertical", label: formatMessage("editor.orientation_vertical") },
                { value: "horizontal", label: formatMessage("editor.orientation_horizontal") },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  orientation: value as TimelineOrientation,
                }));
              }}
            />
          </div>

          <div className="chips-box-timeline-editor__row">
            <span className="chips-box-timeline-editor__row-label">
              {formatMessage("editor.scale_mode")}
            </span>
            <Segmented
              value={config.props.scaleMode}
              aria-label={formatMessage("editor.scale_mode")}
              options={[
                { value: "equal-points", label: formatMessage("editor.scale_equal_points") },
                { value: "date-distance", label: formatMessage("editor.scale_date_distance") },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  scaleMode: value as TimelineScaleMode,
                }));
              }}
            />
          </div>
          <p className="chips-box-timeline-editor__group-footer">
            {formatMessage("editor.scale_hint")}
          </p>

          <div className="chips-box-timeline-editor__row">
            <span className="chips-box-timeline-editor__row-label">
              {formatMessage("editor.card_density")}
            </span>
            <Segmented
              value={config.props.cardDensity}
              aria-label={formatMessage("editor.card_density")}
              options={[
                { value: "compact", label: formatMessage("editor.density_compact") },
                { value: "comfortable", label: formatMessage("editor.density_comfortable") },
                { value: "spacious", label: formatMessage("editor.density_spacious") },
              ]}
              onChange={(value) => {
                commit(updateProps(config, {
                  cardDensity: value as TimelineCardDensity,
                }));
              }}
            />
          </div>

          <div className="chips-box-timeline-editor__row">
            <span className="chips-box-timeline-editor__row-label">
              {formatMessage("editor.show_covers")}
            </span>
            <Switch
              checked={config.props.showCovers}
              onChange={(checked) => {
                commit(updateProps(config, {
                  showCovers: checked,
                }));
              }}
            />
          </div>
          <p className="chips-box-timeline-editor__group-footer">
            {formatMessage("editor.show_covers_hint")}
          </p>

          <p className="chips-box-timeline-editor__group-footer">
            {formatMessage("editor.entry_count", { count: entries.length })}
          </p>
        </div>

        <div className="chips-box-timeline-editor__group">
          <header className="chips-box-timeline-editor__group-head">
            <p className="chips-box-timeline-editor__group-title">
              {formatMessage("editor.section.points")}
            </p>
            <p className="chips-box-timeline-editor__group-desc">
              {formatMessage("editor.section.points_desc")}
            </p>
          </header>

          <div className="chips-box-timeline-editor__row">
            <Button
              type="default"
              onClick={() => {
                commit(addPoint(config));
              }}
            >
              {formatMessage("editor.add_point")}
            </Button>
          </div>

          {config.props.points.length === 0 ? (
            <p className="chips-box-timeline-editor__group-footer">
              {formatMessage("editor.no_points")}
            </p>
          ) : null}

          {config.props.points.map((point, index) => {
            const pointEntries = point.entryIds
              .map((entryId) => entryById.get(entryId))
              .filter((entry): entry is BoxEntrySnapshot => Boolean(entry));

            return (
              <section key={point.id} className="chips-box-timeline-editor__point" data-point-id={point.id}>
                <div className="chips-box-timeline-editor__point-header">
                  <Typography.Text
                    strong
                    className="chips-box-timeline-editor__point-title"
                  >
                    {formatMessage("editor.point_title", { index: index + 1 })}
                  </Typography.Text>
                  <Button
                    type="text"
                    danger
                    size="small"
                    className="chips-box-timeline-editor__remove-button"
                    onClick={() => {
                      commit(removePoint(config, point.id));
                    }}
                  >
                    {formatMessage("editor.delete_point")}
                  </Button>
                </div>

                <div className="chips-box-timeline-editor__point-grid">
                  <div className="chips-box-timeline-editor__field">
                    <span className="chips-box-timeline-editor__field-label">
                      {formatMessage("editor.point_label")}
                    </span>
                    <Input
                      value={point.label}
                      aria-label={formatMessage("editor.point_label")}
                      onChange={(event) => {
                        commit(updatePoint(config, point.id, {
                          label: event.target.value,
                        }));
                      }}
                    />
                  </div>

                  <div className="chips-box-timeline-editor__field">
                    <span className="chips-box-timeline-editor__field-label">
                      {formatMessage("editor.point_date")}
                    </span>
                    <Input
                      value={point.date ?? ""}
                      aria-label={formatMessage("editor.point_date")}
                      placeholder={formatMessage("editor.point_date_placeholder")}
                      onChange={(event) => {
                        commit(updatePoint(config, point.id, {
                          date: event.target.value,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="chips-box-timeline-editor__field">
                  <span className="chips-box-timeline-editor__field-label">
                    {formatMessage("editor.point_note")}
                  </span>
                  <Input.TextArea
                    value={point.note ?? ""}
                    aria-label={formatMessage("editor.point_note")}
                    rows={3}
                    style={{ resize: "block" }}
                    onChange={(event) => {
                      commit(updatePoint(config, point.id, {
                        note: event.target.value,
                      }));
                    }}
                  />
                </div>

                <div className="chips-box-timeline-editor__entry-list">
                  {pointEntries.length === 0 ? (
                    <p className="chips-box-timeline-editor__group-footer">
                      {formatMessage("editor.point_no_entries")}
                    </p>
                  ) : null}
                  {pointEntries.map((entry) => (
                    <div key={entry.entryId} className="chips-box-timeline-editor__entry-row">
                      <span className="chips-box-timeline-editor__entry-title">{resolveEntryTitle(entry)}</span>
                      <Button
                        type="text"
                        danger
                        size="small"
                        className="chips-box-timeline-editor__remove-button"
                        onClick={() => {
                          commit(removeEntryFromPoint(config, point.id, entry.entryId));
                        }}
                      >
                        {formatMessage("editor.remove_entry")}
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <div className="chips-box-timeline-editor__group">
          <header className="chips-box-timeline-editor__group-head">
            <p className="chips-box-timeline-editor__group-title">
              {formatMessage("editor.section.bindings")}
            </p>
            <p className="chips-box-timeline-editor__group-desc">
              {formatMessage("editor.section.bindings_desc")}
            </p>
          </header>

          <p className="chips-box-timeline-editor__group-footer">
            {formatMessage("editor.unscheduled_count", { count: unscheduledEntries.length })}
          </p>

          <div className="chips-box-timeline-editor__binding-row">
            <Select
              value={selectedEntryId}
              placeholder={formatMessage("editor.select_entry")}
              aria-label={formatMessage("editor.select_entry")}
              variant="borderless"
              options={unscheduledOptions}
              disabled={unscheduledOptions.length === 0}
              onChange={setSelectedEntryId}
            />
            <Select
              value={selectedPointId}
              placeholder={formatMessage("editor.select_point")}
              aria-label={formatMessage("editor.select_point")}
              variant="borderless"
              options={pointOptions}
              disabled={pointOptions.length === 0}
              onChange={setSelectedPointId}
            />
            <Button
              type="default"
              disabled={!canBind}
              onClick={() => {
                if (!canBind) {
                  return;
                }
                commit(bindEntry(config, selectedPointId, selectedEntryId));
                setSelectedEntryId("");
              }}
            >
              {formatMessage("editor.bind_entry")}
            </Button>
          </div>
        </div>

        <FrameRegionEditor
          id="background"
          region={config.props.background}
          title={formatMessage("editor.background_title")}
          description={formatMessage("editor.background_desc")}
          previewRatio="16:9"
          preferredAssetPrefix="assets/layouts/chips.layout.timeline.blp/background"
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
          preferredAssetPrefix="assets/layouts/chips.layout.timeline.blp/top-region"
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
  rootElement.setAttribute("data-chips-timeline-editor-root", "true");
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
