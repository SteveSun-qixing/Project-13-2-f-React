import React from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { Button, ConfigProvider, Result, Select } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { FrameRegionEditor } from "./frame-region-editor";
import { EditorField, EditorSection } from "../shared/editor-layout";
import type { BoxEntrySnapshot, ResolvedRuntimeResource } from "../shared/types";
import {
  isSafeBoxAssetPath,
  normalizeLayoutConfig,
  validateLayoutConfig,
  type FrameRegionConfig,
  type GeoBounds,
  type LayoutConfig,
  type MapSourceConfig,
  type MapSourceMode,
  type MarkerStyle,
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
.chips-map-layout-editor {
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

.chips-map-layout-editor,
.chips-map-layout-editor * {
  box-sizing: border-box;
}

.chips-map-layout-editor__form {
  width: 100%;
  min-width: 0;
  padding: 16px;
}

.chips-map-layout-editor__section {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.chips-map-layout-editor__section-head {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.chips-map-layout-editor__section-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: #1d1d1f;
}

.chips-map-layout-editor__section-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: #6e6e73;
}

.chips-map-layout-editor__section-body {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.chips-map-layout-editor__field,
.chips-map-layout-editor__field-grid,
.chips-map-layout-editor__entry-list,
.chips-map-layout-editor__entry-row {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-map-layout-editor__field-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chips-map-layout-editor__entry-row {
  grid-template-columns: minmax(120px, 1fr) minmax(80px, 110px) minmax(80px, 110px);
  align-items: end;
  padding-block: 8px;
  border-block-end: 1px solid rgba(0, 0, 0, 0.08);
}

.chips-map-layout-editor__entry-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  grid-column: 1 / -1;
}

.chips-map-layout-editor__label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: #1d1d1f;
}

.chips-map-layout-editor input:not(.ant-select-input),
.chips-map-layout-editor select {
  min-width: 0;
  width: 100%;
  min-height: 36px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  padding-inline: 8px;
  color: #1d1d1f;
  background: #ffffff;
  font: inherit;
}

.chips-map-layout-editor input[type="checkbox"] {
  width: auto;
  min-height: auto;
}

.chips-map-layout-editor__checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #1d1d1f;
  cursor: pointer;
}

.chips-map-layout-editor__select {
  width: 100%;
}

.chips-map-layout-editor__remove-button {
  font-size: 13px;
  min-height: 0;
  padding: 4px 6px;
}

.chips-map-layout-editor__asset-path,
.chips-map-layout-editor__error,
.chips-map-layout-editor__hint {
  min-width: 0;
  overflow-wrap: anywhere;
  color: #6e6e73;
  font-size: 12px;
}

.chips-map-layout-editor__error {
  color: #ff3b30;
}

.chips-map-layout-editor__bridge-error.ant-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
}

.chips-map-layout-editor__bridge-error.ant-result .ant-result-icon {
  margin-inline-end: 0;
}

.chips-map-layout-editor__bridge-error.ant-result .ant-result-title {
  font-size: 13px;
  line-height: 1.5;
}

.chips-map-layout-editor__bridge-error.ant-result .ant-result-subtitle {
  font-size: 12px;
  line-height: 1.5;
}

.chips-map-layout-editor__map-preview {
  min-height: 150px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background:
    repeating-linear-gradient(0deg, color-mix(in srgb, #6e6e73 16%, transparent) 0 1px, transparent 1px 18px),
    repeating-linear-gradient(90deg, color-mix(in srgb, #6e6e73 16%, transparent) 0 1px, transparent 1px 18px),
    #f2f2f7;
}

.chips-map-layout-editor__map-preview img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 150px;
  object-fit: cover;
}

.chips-map-layout-editor button:focus-visible,
.chips-map-layout-editor input:focus-visible,
.chips-map-layout-editor select:focus-visible {
  outline: 2px solid #0a84ff;
  outline-offset: 2px;
}

@media (max-width: 520px) {
  .chips-map-layout-editor__field-grid,
  .chips-map-layout-editor__entry-row {
    grid-template-columns: minmax(0, 1fr);
  }
}
`;

function resolveEntryTitle(entry: BoxEntrySnapshot): string {
  return entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
}

function sanitizeAssetFileName(name: string): string {
  const sanitized = name
    .trim()
    .replace(/[\\/]+/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+/, "")
    .replace(/^\.+/, "")
    .replace(/-+$/, "");
  return sanitized.length > 0 ? sanitized : "map";
}

function buildPreferredMapAssetPath(file: File): string {
  return `assets/layouts/map/base-map/${Date.now()}-${sanitizeAssetFileName(file.name)}`;
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

function updateMapSource(config: LayoutConfig, patch: Partial<MapSourceConfig>): LayoutConfig {
  return updateProps(config, {
    mapSource: {
      ...config.props.mapSource,
      ...patch,
      bounds: patch.bounds ?? config.props.mapSource.bounds,
    },
  });
}

function updateBounds(config: LayoutConfig, patch: Partial<GeoBounds>): LayoutConfig {
  return updateMapSource(config, {
    bounds: {
      ...config.props.mapSource.bounds,
      ...patch,
    },
  });
}

function updateFrameRegion(config: LayoutConfig, region: FrameRegionConfig): LayoutConfig {
  return updateProps(config, {
    topRegion: region,
  });
}

function updateEntryLocation(
  config: LayoutConfig,
  entryId: string,
  patch: Partial<LayoutConfig["props"]["entries"][string]>,
): LayoutConfig {
  const current = config.props.entries[entryId] ?? {
    latitude: config.props.defaultView.latitude,
    longitude: config.props.defaultView.longitude,
  };
  return updateProps(config, {
    entries: {
      ...config.props.entries,
      [entryId]: {
        ...current,
        ...patch,
      },
    },
  });
}

function removeEntryLocation(config: LayoutConfig, entryId: string): LayoutConfig {
  const nextEntries = { ...config.props.entries };
  delete nextEntries[entryId];
  return updateProps(config, {
    entries: nextEntries,
  });
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function MapAssetPreview({
  assetPath,
  readBoxAsset,
}: {
  assetPath?: string;
  readBoxAsset?: (assetPath: string) => Promise<ResolvedRuntimeResource>;
}) {
  const [state, setState] = React.useState<{
    status: "idle" | "loading" | "ready" | "error";
    resourceUrl?: string;
  }>({ status: "idle" });

  React.useEffect(() => {
    if (!assetPath) {
      setState({ status: "idle" });
      return;
    }
    if (!readBoxAsset) {
      setState({ status: "error" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    void readBoxAsset(assetPath)
      .then((resource) => {
        if (!cancelled && resource.resourceUrl) {
          setState({
            status: "ready",
            resourceUrl: resource.resourceUrl,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [assetPath, readBoxAsset]);

  return (
    <div className="chips-map-layout-editor__map-preview">
      {state.status === "ready" && state.resourceUrl ? (
        <img src={state.resourceUrl} alt={formatMessage("editor.map_preview")} />
      ) : (
        <div className="chips-map-layout-editor__hint">
          {state.status === "loading"
            ? formatMessage("editor.asset_loading")
            : assetPath
              ? formatMessage("editor.read_failed")
              : formatMessage("editor.default_map_preview")}
        </div>
      )}
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
  const [assetErrorKey, setAssetErrorKey] = React.useState<string | undefined>();
  const [busyAsset, setBusyAsset] = React.useState(false);
  const mapFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const validation = React.useMemo(() => validateLayoutConfig(config), [config]);
  const assetErrorMessage = assetErrorKey ? formatMessage(assetErrorKey) : undefined;
  const locatedCount = entries.filter((entry) => config.props.entries[entry.entryId]).length;
  const unlocatedCount = entries.length - locatedCount;

  React.useEffect(() => {
    setConfig(normalizeLayoutConfig(initialConfig));
  }, [initialConfig]);

  function commit(next: LayoutConfig): void {
    const normalized = normalizeLayoutConfig(next);
    setConfig(normalized);
    onChange(normalized);
  }

  async function deleteMapAsset(assetPath: string | undefined): Promise<boolean> {
    if (!assetPath) {
      return true;
    }
    if (!deleteBoxAsset) {
      setAssetErrorKey("editor.asset_bridge_missing");
      return false;
    }
    try {
      await deleteBoxAsset(assetPath);
      setAssetErrorKey(undefined);
      return true;
    } catch {
      setAssetErrorKey("editor.delete_failed");
      return false;
    }
  }

  async function importMapAsset(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }
    if (!importBoxAsset || !readBoxAsset || !deleteBoxAsset) {
      setAssetErrorKey("editor.asset_bridge_missing");
      return;
    }

    setBusyAsset(true);
    try {
      const imported = await importBoxAsset({
        file,
        preferredPath: buildPreferredMapAssetPath(file),
      });
      if (!isSafeBoxAssetPath(imported.assetPath)) {
        setAssetErrorKey("editor.imported_asset_path_invalid");
        return;
      }
      const previousAssetPath = config.props.mapSource.assetPath;
      commit(updateMapSource(config, {
        mode: "image",
        projection: "linear-bounds",
        assetPath: imported.assetPath,
      }));
      setAssetErrorKey(undefined);
      if (previousAssetPath && previousAssetPath !== imported.assetPath) {
        await deleteBoxAsset(previousAssetPath).catch(() => {
          setAssetErrorKey("editor.delete_failed");
        });
      }
    } catch {
      setAssetErrorKey("editor.import_failed");
    } finally {
      if (mapFileInputRef.current) {
        mapFileInputRef.current.value = "";
      }
      setBusyAsset(false);
    }
  }

  async function clearMapAsset(): Promise<void> {
    const deleted = await deleteMapAsset(config.props.mapSource.assetPath);
    if (!deleted) {
      return;
    }
    commit(updateMapSource(config, {
      assetPath: undefined,
    }));
  }

  const modeOptions: { value: MapSourceMode; label: string; disabled?: boolean }[] =
    config.props.mapSource.mode === "host-map"
      ? [
          { value: "image", label: formatMessage("editor.map_source_image") },
          { value: "host-map", label: formatMessage("editor.map_source_host"), disabled: true },
        ]
      : [
          { value: "image", label: formatMessage("editor.map_source_image") },
        ];
  const markerOptions = [
    { value: "dot-title", label: formatMessage("editor.marker_dot_title") },
    { value: "pin-title", label: formatMessage("editor.marker_pin_title") },
  ];

  return (
    <section
      className="chips-map-layout-editor"
      data-scope="chips-box-layout-editor"
      aria-label={formatMessage("editor.aria_label")}
    >
      <style>{EDITOR_STYLE_TEXT}</style>
      <form
        className="chips-map-layout-editor__form"
        aria-label={formatMessage("editor.aria_label")}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <EditorSection
            title={formatMessage("editor.section.map_source")}
            description={formatMessage("editor.section.map_source_desc")}
          >
            <EditorField
              label={formatMessage("editor.map_source_mode")}
              hint={config.props.mapSource.mode === "host-map"
                ? formatMessage("editor.host_map_reserved_hint")
                : formatMessage("editor.map_source_image_hint")}
            >
              <Select<MapSourceMode>
                className="chips-map-layout-editor__select"
                value={config.props.mapSource.mode}
                options={modeOptions}
                onChange={(value) => {
                  if (config.props.mapSource.mode === "image") {
                    return;
                  }
                  void (async () => {
                    const deleted = await deleteMapAsset(config.props.mapSource.assetPath);
                    if (!deleted) {
                      return;
                    }
                    commit(updateMapSource(config, {
                      mode: "image",
                      projection: "linear-bounds",
                      assetPath: undefined,
                    }));
                  })();
                }}
              />
            </EditorField>

            <EditorField label={formatMessage("editor.map_asset")}>
              <input
                ref={mapFileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  void importMapAsset(event.currentTarget.files?.[0]);
                }}
              />
              <div className="chips-map-layout-editor__entry-actions">
                <Button
                  type="default"
                  disabled={busyAsset || config.props.mapSource.mode !== "image"}
                  onClick={() => {
                    mapFileInputRef.current?.click();
                  }}
                >
                  {config.props.mapSource.assetPath
                    ? formatMessage("editor.replace_image")
                    : formatMessage("editor.upload_image")}
                </Button>
                <Button
                  type="default"
                  disabled={busyAsset || !config.props.mapSource.assetPath}
                  onClick={() => {
                    void clearMapAsset();
                  }}
                >
                  {formatMessage("editor.clear_asset")}
                </Button>
              </div>
              <span className="chips-map-layout-editor__asset-path">
                {config.props.mapSource.assetPath ?? formatMessage("editor.default_map_asset")}
              </span>
              {assetErrorMessage ? (
                <p className="chips-map-layout-editor__error" role="alert">
                  {assetErrorMessage}
                </p>
              ) : null}
              {assetErrorKey === "editor.asset_bridge_missing" ? (
                <Result
                  className="chips-map-layout-editor__bridge-error"
                  status="error"
                  title={formatMessage("editor.asset_bridge_missing")}
                  subTitle={formatMessage("editor.asset_bridge_missing_desc")}
                />
              ) : null}
              <MapAssetPreview
                assetPath={config.props.mapSource.assetPath}
                readBoxAsset={readBoxAsset}
              />
            </EditorField>

            <div className="chips-map-layout-editor__field-grid">
              {(["west", "south", "east", "north"] as const).map((key) => (
                <EditorField key={key} label={formatMessage(`editor.bounds_${key}`)}>
                  <input
                    type="number"
                    step="0.000001"
                    value={config.props.mapSource.bounds[key]}
                    onChange={(event) => {
                      commit(updateBounds(config, {
                        [key]: parseNumberInput(event.currentTarget.value, config.props.mapSource.bounds[key]),
                      }));
                    }}
                  />
                </EditorField>
              ))}
            </div>
            {validation.errors["props.mapSource.bounds"] ? (
              <p className="chips-map-layout-editor__error" role="alert">
                {validation.errors["props.mapSource.bounds"]}
              </p>
            ) : null}
          </EditorSection>

          <EditorSection
            title={formatMessage("editor.section.view")}
            description={formatMessage("editor.section.view_desc")}
          >
            <div className="chips-map-layout-editor__field-grid">
              <EditorField label={formatMessage("editor.default_latitude")}>
                <input
                  type="number"
                  step="0.000001"
                  value={config.props.defaultView.latitude}
                  onChange={(event) => {
                    commit(updateProps(config, {
                      defaultView: {
                        ...config.props.defaultView,
                        latitude: parseNumberInput(event.currentTarget.value, config.props.defaultView.latitude),
                      },
                    }));
                  }}
                />
              </EditorField>
              <EditorField label={formatMessage("editor.default_longitude")}>
                <input
                  type="number"
                  step="0.000001"
                  value={config.props.defaultView.longitude}
                  onChange={(event) => {
                    commit(updateProps(config, {
                      defaultView: {
                        ...config.props.defaultView,
                        longitude: parseNumberInput(event.currentTarget.value, config.props.defaultView.longitude),
                      },
                    }));
                  }}
                />
              </EditorField>
              <EditorField label={formatMessage("editor.default_zoom")}>
                <input
                  type="number"
                  min="0.5"
                  max="8"
                  step="0.25"
                  value={config.props.defaultView.zoom}
                  onChange={(event) => {
                    commit(updateProps(config, {
                      defaultView: {
                        ...config.props.defaultView,
                        zoom: parseNumberInput(event.currentTarget.value, config.props.defaultView.zoom),
                      },
                    }));
                  }}
                />
              </EditorField>
              <EditorField label={formatMessage("editor.marker_style")}>
                <select
                  value={config.props.markerStyle}
                  onChange={(event) => {
                    commit(updateProps(config, {
                      markerStyle: event.currentTarget.value as MarkerStyle,
                    }));
                  }}
                >
                  {markerOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </EditorField>
            </div>
            <EditorField hint={formatMessage("editor.show_cover_on_select_hint")}>
              <label className="chips-map-layout-editor__checkbox">
                <input
                  type="checkbox"
                  checked={config.props.showCoverOnSelect}
                  onChange={(event) => {
                    commit(updateProps(config, {
                      showCoverOnSelect: event.currentTarget.checked,
                    }));
                  }}
                />
                {formatMessage("editor.show_cover_on_select")}
              </label>
            </EditorField>
            {["props.defaultView.latitude", "props.defaultView.longitude", "props.defaultView.zoom"].map((key) => (
              validation.errors[key] ? (
                <p key={key} className="chips-map-layout-editor__error" role="alert">
                  {validation.errors[key]}
                </p>
              ) : null
            ))}
          </EditorSection>

          <EditorSection
            title={formatMessage("editor.section.entries")}
            description={formatMessage("editor.section.entries_desc", {
              located: locatedCount,
              unlocated: unlocatedCount,
            })}
          >
            <p className="chips-map-layout-editor__hint">
              {formatMessage("editor.entry_count", { count: entries.length })}
            </p>
            <div className="chips-map-layout-editor__entry-list">
              {entries.map((entry) => {
                const location = config.props.entries[entry.entryId];
                const latitude = location?.latitude ?? config.props.defaultView.latitude;
                const longitude = location?.longitude ?? config.props.defaultView.longitude;
                const latitudeError = validation.errors[`props.entries.${entry.entryId}.latitude`];
                const longitudeError = validation.errors[`props.entries.${entry.entryId}.longitude`];
                return (
                  <div key={entry.entryId} className="chips-map-layout-editor__entry-row" data-entry-id={entry.entryId}>
                    <EditorField label={resolveEntryTitle(entry)}>
                      <input
                        type="text"
                        value={location?.labelOverride ?? ""}
                        placeholder={formatMessage("editor.label_override")}
                        onChange={(event) => {
                          commit(updateEntryLocation(config, entry.entryId, {
                            labelOverride: event.currentTarget.value,
                          }));
                        }}
                      />
                    </EditorField>
                    <EditorField
                      label={formatMessage("editor.latitude")}
                      error={latitudeError}
                    >
                      <input
                        data-entry-latitude={entry.entryId}
                        type="number"
                        step="0.000001"
                        value={latitude}
                        onChange={(event) => {
                          commit(updateEntryLocation(config, entry.entryId, {
                            latitude: parseNumberInput(event.currentTarget.value, latitude),
                          }));
                        }}
                      />
                    </EditorField>
                    <EditorField
                      label={formatMessage("editor.longitude")}
                      error={longitudeError}
                    >
                      <input
                        data-entry-longitude={entry.entryId}
                        type="number"
                        step="0.000001"
                        value={longitude}
                        onChange={(event) => {
                          commit(updateEntryLocation(config, entry.entryId, {
                            longitude: parseNumberInput(event.currentTarget.value, longitude),
                          }));
                        }}
                      />
                    </EditorField>
                    <div className="chips-map-layout-editor__entry-actions">
                      <Button
                        type="default"
                        onClick={() => {
                          commit(updateEntryLocation(config, entry.entryId, {
                            latitude,
                            longitude,
                          }));
                        }}
                      >
                        {location ? formatMessage("editor.update_location") : formatMessage("editor.place_entry")}
                      </Button>
                      <Button
                        type="default"
                        disabled={!location}
                        onClick={() => {
                          commit(removeEntryLocation(config, entry.entryId));
                        }}
                      >
                        {formatMessage("editor.clear_location")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </EditorSection>

          <FrameRegionEditor
            id="topRegion"
            region={config.props.topRegion}
            title={formatMessage("editor.top_region_title")}
            description={formatMessage("editor.top_region_desc")}
            previewRatio="16:5"
            preferredAssetPrefix="assets/layouts/map/top-region"
            readBoxAsset={readBoxAsset}
            importBoxAsset={importBoxAsset}
            deleteBoxAsset={deleteBoxAsset}
            onChange={(nextRegion) => {
              commit(updateFrameRegion(config, nextRegion));
            }}
          />
        </div>
      </form>
    </section>
  );
}

export function createLayoutEditorRoot(props: LayoutEditorPanelProps): LayoutEditorRoot {
  const rootElement = document.createElement("div") as LayoutEditorRoot;
  rootElement.setAttribute("data-chips-map-layout-editor-root", "true");
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
