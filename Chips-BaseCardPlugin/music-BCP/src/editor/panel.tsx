import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, ConfigProvider, Image, Input, Progress, Result, Skeleton, Space } from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type {
  BasecardResourceImportRequest,
  BasecardResourceImportResult,
  BasecardTiffToPngRequest,
  BasecardTiffToPngResult,
} from "../index";
import {
  normalizeBasecardConfig,
  validateBasecardConfig,
  type BasecardConfig,
  type ProductionTeamRole,
} from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import { parseEmbeddedAudioMetadata, type EmbeddedAudioMetadata } from "../shared/audio-metadata";
import {
  buildDerivedResourcePath,
  cloneConfig,
  deriveDisplayTitle,
  generateStableId,
  inferImageExtensionFromMimeType,
  isTiffMimeType,
  normalizeRelativeCardResourcePath,
  resolveFileExtension,
  resolveResourceUrlWithRetry,
  resolveFileName,
  sanitizeImportedFileName,
  splitArtists,
  stripFileExtension,
  upsertSingerRole,
} from "../shared/utils";
import { DEFAULT_MUSIC_COVER_URL } from "../shared/default-cover";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (
    input: BasecardResourceImportRequest,
  ) => Promise<BasecardResourceImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
  convertTiffToPng?: (
    input: BasecardTiffToPngRequest,
  ) => Promise<BasecardTiffToPngResult>;
}

type EditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

type ResourceField = "audio" | "cover" | "lyrics";
type BusyField = ResourceField | null;

const AUDIO_ACCEPT = ".mp3,.flac,.wav,.ogg,.oga,.m4a,.aac,.opus,.webm,audio/*";
const COVER_ACCEPT = "image/*";
const LYRICS_ACCEPT = ".lrc,.txt,.srt,text/plain";
const MAX_METADATA_PARSE_BYTES = 100 * 1024 * 1024;

const EDITOR_STYLE_TEXT = `
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

.chips-music-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 12px clamp(12px, 3vw, 18px) 24px;
  color: #1d1d1f;
  background: #ffffff;
  font: 14px/1.55 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-music-editor,
.chips-music-editor * {
  box-sizing: border-box;
}

.chips-music-editor__shell {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
}

.chips-music-editor__alert {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(242, 242, 247, 0.92);
  color: #1d1d1f;
  font-size: 13px;
}

.chips-music-editor__alert--error {
  color: #ff3b30;
}

.chips-music-editor__alert .ant-result {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0;
  background: transparent;
}

.chips-music-editor__alert .ant-result-icon {
  margin: 0;
  line-height: 1.4;
}

.chips-music-editor__alert .ant-result-title {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: inherit;
}

.chips-music-editor__alert .ant-result-subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: inherit;
}

.chips-music-editor__errors-list {
  margin: 8px 0 0;
  padding-left: 18px;
}

.chips-music-editor__group {
  padding-top: 4px;
}

.chips-music-editor__group + .chips-music-editor__group {
  margin-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.chips-music-editor__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 2px;
}

.chips-music-editor__group-title {
  margin: 0;
  color: #1d1d1f;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.chips-music-editor__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: #0a84ff;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.chips-music-editor__status .ant-progress {
  width: 42px;
  min-width: 42px;
  margin-inline-end: 2px;
}

.chips-music-editor__list,
.chips-music-editor__team-list {
  display: grid;
  min-width: 0;
}

.chips-music-editor__team-list {
  gap: 12px;
  margin-top: 12px;
}

.chips-music-editor__list > :last-child,
.chips-music-editor__team-card-body > :last-child {
  border-bottom: none;
}

.chips-music-editor__row,
.chips-music-editor__field-row {
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.chips-music-editor__row {
  display: grid;
  gap: 10px;
}

.chips-music-editor__field-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 12px;
}

.chips-music-editor__team-item {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  background: #ffffff;
}

.chips-music-editor__row-label,
.chips-music-editor__field-label {
  margin: 0;
  font-size: 13px;
  font-weight: 650;
  color: #1d1d1f;
}

.chips-music-editor__row-label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.chips-music-editor__field-label {
  padding-top: 8px;
}

.chips-music-editor__label-badge {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
  font-size: 11px;
  font-weight: 700;
}

.chips-music-editor__row-body,
.chips-music-editor__field-control {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.chips-music-editor__dropzone {
  position: relative;
  display: grid;
  min-height: 72px;
  padding: 12px 14px;
  border: 1.5px dashed rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  background: transparent;
  color: #1d1d1f;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.chips-music-editor__dropzone[data-state="dragover"] {
  border-color: rgba(10, 132, 255, 0.34);
  background: rgba(10, 132, 255, 0.06);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.08);
}

.chips-music-editor__dropzone[data-state="busy"] {
  cursor: progress;
}

.chips-music-editor__dropzone:hover,
.chips-music-editor__dropzone:focus-within {
  border-color: rgba(10, 132, 255, 0.28);
}

.chips-music-editor__dropzone-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.chips-music-editor__dropzone-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.chips-music-editor__dropzone-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.chips-music-editor__dropzone-preview {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 50px;
  height: 50px;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.chips-music-editor__dropzone-preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-music-editor__dropzone-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.06);
  color: #1d1d1f;
  font-size: 12px;
  font-weight: 700;
}

.chips-music-editor__dropzone-text {
  font-size: 14px;
  font-weight: 650;
  color: #1d1d1f;
}

.chips-music-editor__dropzone-note {
  color: #6e6e73;
  font-size: 12px;
}

.chips-music-editor__resource-tile {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-music-editor__resource-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  align-items: start;
  min-width: 0;
}

.chips-music-editor__resource-cover {
  width: 88px;
  height: 88px;
  overflow: hidden;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.chips-music-editor__resource-cover .ant-image,
.chips-music-editor__dropzone-preview .ant-image {
  display: block;
  margin: 0;
  width: 100%;
  height: 100%;
}

.chips-music-editor__resource-cover .ant-image-img,
.chips-music-editor__dropzone-preview .ant-image-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-music-editor__resource-summary {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.chips-music-editor__resource-summary-title {
  display: block;
  font-size: 15px;
  font-weight: 700;
  color: #1d1d1f;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.chips-music-editor__resource-summary-subtitle {
  display: block;
  color: #6e6e73;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.chips-music-editor__resource-preview--cover {
  display: block;
  width: 88px;
  height: 88px;
  overflow: hidden;
  border-radius: 14px;
  object-fit: cover;
  background: rgba(229, 229, 234, 0.76);
  border: 1px solid rgba(0, 0, 0, 0.06);
}

audio.chips-music-editor__audio-preview {
  display: block;
  width: 100%;
  min-height: 40px;
  margin: 0;
}

.chips-music-editor__resource-meta {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chips-music-editor__resource-tile-name {
  display: block;
  font-size: 14px;
  font-weight: 650;
  color: #1d1d1f;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.chips-music-editor__resource-tile-subtitle {
  display: block;
  color: #6e6e73;
  font-size: 12px;
}

.chips-music-editor__resource-actions {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: 8px;
}

.chips-music-editor__toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.chips-music-editor__field-row--multiline {
  align-items: start;
}

.chips-music-editor__hint {
  color: #6e6e73;
  font-size: 12px;
}

.chips-music-editor__team-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chips-music-editor__team-card-body {
  display: grid;
  gap: 0;
}

.chips-music-editor__team-card-body .chips-music-editor__field-row {
  padding: 10px 0;
}

.chips-music-editor__team-item-title {
  font-size: 14px;
  font-weight: 700;
  color: #1d1d1f;
}

.chips-music-editor__team-card-actions {
  display: flex;
  justify-content: flex-end;
}

.chips-music-editor__team-empty {
  padding: 12px 0 4px;
  color: #6e6e73;
  font-size: 13px;
}

@media (max-width: 560px) {
  .chips-music-editor {
    padding-inline: 12px;
  }

  .chips-music-editor__field-row {
    grid-template-columns: 1fr;
    gap: 6px;
  }

  .chips-music-editor__field-label {
    padding-top: 0;
  }

  .chips-music-editor__dropzone-content {
    align-items: flex-start;
  }

  .chips-music-editor__team-card-actions {
    justify-content: stretch;
  }

  .chips-music-editor__team-card-actions .ant-btn {
    width: 100%;
  }
}

@media (max-width: 420px) {
  .chips-music-editor__resource-cover,
  .chips-music-editor__resource-preview--cover {
    width: 64px;
    height: 64px;
  }

  .chips-music-editor__dropzone-content {
    flex-direction: column;
    gap: 10px;
  }
}
`;

function resolveErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  return fallbackMessage;
}

function getImmediateResourceUrl(
  resourcePath: string,
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
): string {
  const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
  if (!normalizedPath) {
    return "";
  }

  return resolveResourceUrl ? "" : normalizedPath;
}

function useResolvedEditorResourceUrl(
  resourcePath: string,
  resolveResourceUrl?: (resourcePath: string) => Promise<string>,
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void,
): string {
  const [resolvedUrl, setResolvedUrl] = useState(() => getImmediateResourceUrl(resourcePath, resolveResourceUrl));

  useEffect(() => {
    let cancelled = false;
    const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);

    if (!normalizedPath) {
      setResolvedUrl("");
      return undefined;
    }

    if (!resolveResourceUrl) {
      setResolvedUrl(normalizedPath);
      return undefined;
    }

    setResolvedUrl("");

    void resolveResourceUrlWithRetry(resolveResourceUrl, normalizedPath)
      .then((nextUrl) => {
        if (!cancelled) {
          setResolvedUrl(nextUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedUrl("");
        }
      });

    return () => {
      cancelled = true;
      void Promise.resolve(releaseResourceUrl?.(normalizedPath)).catch(() => undefined);
    };
  }, [releaseResourceUrl, resolveResourceUrl, resourcePath]);

  return resolvedUrl;
}

function dedupeResourcePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter((path) => path.trim().length > 0)));
}

function createLyricsFile(fileName: string, content: string): File {
  return new File([content], fileName, {
    type: "text/plain;charset=utf-8",
  });
}

function createArtworkFile(fileName: string, bytes: Uint8Array, mimeType: string): File {
  const buffer = new ArrayBuffer(bytes.byteLength);
  const output = new Uint8Array(buffer);
  output.set(bytes);

  return new File([buffer], fileName, {
    type: mimeType || "image/jpeg",
  });
}

function normalizeRoleUpdate(
  productionTeam: ProductionTeamRole[],
  roleId: string,
  updater: (role: ProductionTeamRole) => ProductionTeamRole,
): ProductionTeamRole[] {
  return productionTeam.map((role) => (role.id === roleId ? updater(role) : role));
}

function FilePickerButton(props: {
  label: string;
  role: string;
  accept: string;
  disabled: boolean;
  onFileSelected: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <Button
        type="default"
        disabled={props.disabled}
        onClick={() => {
          inputRef.current?.click();
        }}
      >
        {props.label}
      </Button>
      <input
        ref={inputRef}
        data-role={props.role}
        type="file"
        accept={props.accept}
        disabled={props.disabled}
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            props.onFileSelected(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </>
  );
}

function BasecardEditor(props: BasecardEditorProps) {
  const [config, setConfig] = useState(() => normalizeBasecardConfig(props.initialConfig));
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    validateBasecardConfig(normalizeBasecardConfig(props.initialConfig)).errors,
  );
  const [panelError, setPanelError] = useState("");
  const [panelNotice, setPanelNotice] = useState("");
  const [busyField, setBusyField] = useState<BusyField>(null);
  const [dragField, setDragField] = useState<ResourceField | null>(null);
  const configRef = useRef(config);
  const audioPreviewUrl = useResolvedEditorResourceUrl(
    config.audio_file,
    props.resolveResourceUrl,
    props.releaseResourceUrl,
  );
  const coverPreviewUrl = useResolvedEditorResourceUrl(
    config.album_cover,
    props.resolveResourceUrl,
    props.releaseResourceUrl,
  );
  const hasAudioFile = Boolean(normalizeRelativeCardResourcePath(config.audio_file));
  const displayCoverUrl = coverPreviewUrl || DEFAULT_MUSIC_COVER_URL;
  const displayTitle = deriveDisplayTitle(config) || formatMessage("music.view.untitled");
  const lyricsBadge = resolveFileExtension(config.lyrics_file).toUpperCase() || "TXT";

  useEffect(() => {
    const nextConfig = normalizeBasecardConfig(props.initialConfig);
    configRef.current = nextConfig;
    setConfig(nextConfig);
    setErrors(validateBasecardConfig(nextConfig).errors);
  }, [props.initialConfig]);

  const flattenedErrors = useMemo(
    () => Object.entries(errors)
      .filter(([key]) => !(key === "audio_file" && !hasAudioFile))
      .map(([, message]) => message),
    [errors, hasAudioFile],
  );

  function commitConfig(nextConfig: BasecardConfig): void {
    const normalized = normalizeBasecardConfig(nextConfig);
    const validation = validateBasecardConfig(normalized);

    configRef.current = normalized;
    setConfig(normalized);
    setErrors(validation.errors);
    props.onChange(cloneConfig(normalized));
  }

  function updateConfig(patch: Partial<BasecardConfig>): void {
    commitConfig({
      ...configRef.current,
      ...patch,
    });
  }

  async function importRequiredResource(file: File, preferredPath: string): Promise<BasecardResourceImportResult> {
    if (!props.importResource) {
      throw new Error(formatMessage("music.editor.errors.import_unavailable"));
    }

    return props.importResource({
      file,
      preferredPath,
    });
  }

  function isTiffFile(file: File): boolean {
    const extension = resolveFileExtension(file.name);
    return isTiffMimeType(file.type) || extension === "tiff" || extension === "tif";
  }

  async function convertImportedTiffCoverToPng(
    sourcePath: string,
    outputPath: string,
  ): Promise<BasecardTiffToPngResult> {
    if (!props.convertTiffToPng) {
      throw new Error(formatMessage("music.editor.errors.tiff_conversion_unavailable"));
    }

    return props.convertTiffToPng({
      resourcePath: sourcePath,
      outputPath,
      overwrite: true,
    });
  }

  async function importCoverResource(
    file: File,
    baseName: string,
  ): Promise<{ path: string; cleanupPaths: string[] }> {
    if (!isTiffFile(file)) {
      const coverExtension = resolveFileExtension(file.name)
        || inferImageExtensionFromMimeType(file.type)
        || "jpg";
      const preferredCoverPath = buildDerivedResourcePath(baseName, "cover", coverExtension);
      const importedCover = await importRequiredResource(file, preferredCoverPath);

      return {
        path: importedCover.path,
        cleanupPaths: [],
      };
    }

    const tiffExtension = resolveFileExtension(file.name)
      || inferImageExtensionFromMimeType(file.type)
      || "tiff";
    const sourceCoverPath = buildDerivedResourcePath(baseName, "cover-source", tiffExtension);
    const importedSourceCover = await importRequiredResource(file, sourceCoverPath);

    try {
      const convertedCover = await convertImportedTiffCoverToPng(
        importedSourceCover.path,
        buildDerivedResourcePath(baseName, "cover", "png"),
      );

      return {
        path: convertedCover.path,
        cleanupPaths: importedSourceCover.path === convertedCover.path ? [] : [importedSourceCover.path],
      };
    } catch (error) {
      await deleteResourceQuietly(importedSourceCover.path);
      throw error;
    }
  }

  async function deleteResourceQuietly(resourcePath: string): Promise<void> {
    const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
    if (!normalizedPath || !props.deleteResource) {
      return;
    }

    try {
      await props.deleteResource(normalizedPath);
    } catch (error) {
      setPanelError(resolveErrorMessage(error, formatMessage("music.editor.errors.delete_failed")));
    }
  }

  async function deleteOutgoingResourcesOrThrow(resourcePaths: string[]): Promise<void> {
    for (const resourcePath of dedupeResourcePaths(resourcePaths)) {
      const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
      if (!normalizedPath || !props.deleteResource) {
        continue;
      }

      await props.deleteResource(normalizedPath);
    }
  }

  async function withBusyField(field: ResourceField, task: () => Promise<void>): Promise<void> {
    setBusyField(field);
    setPanelError("");
    setPanelNotice("");

    try {
      await task();
    } finally {
      setBusyField((current) => (current === field ? null : current));
      setDragField((current) => (current === field ? null : current));
    }
  }

  async function handleAudioUpload(file: File): Promise<void> {
    await withBusyField("audio", async () => {
      const currentConfig = configRef.current;
      const importedPaths: string[] = [];

      try {
        const preferredAudioPath = sanitizeImportedFileName(file.name, "track.mp3");
        const importedAudio = await importRequiredResource(file, preferredAudioPath);
        importedPaths.push(importedAudio.path);

        let embeddedMetadata: EmbeddedAudioMetadata = {};
        if (file.size > MAX_METADATA_PARSE_BYTES) {
          setPanelNotice(formatMessage("music.editor.notices.metadata_skipped"));
        } else {
          embeddedMetadata = parseEmbeddedAudioMetadata({
            bytes: await file.arrayBuffer(),
            fileName: file.name,
            mimeType: file.type,
          });
        }

        const nextStem = stripFileExtension(resolveFileName(importedAudio.path) || resolveFileName(file.name) || "track");
        const outgoingPaths: string[] = [];

        let nextConfig = normalizeBasecardConfig({
          ...currentConfig,
          audio_file: importedAudio.path,
          music_name: embeddedMetadata.title?.trim() || currentConfig.music_name || nextStem,
          album_name: embeddedMetadata.album?.trim() || currentConfig.album_name,
        });

        if (embeddedMetadata.artist?.trim()) {
          nextConfig = normalizeBasecardConfig({
            ...nextConfig,
            production_team: upsertSingerRole(
              nextConfig.production_team,
              splitArtists(embeddedMetadata.artist),
            ),
          });
        }

        if (embeddedMetadata.artwork) {
          const artworkExtension = inferImageExtensionFromMimeType(embeddedMetadata.artwork.mimeType) ?? "jpg";
          const embeddedCoverFileName = buildDerivedResourcePath(nextStem, "embedded-cover", artworkExtension);
          const importedCover = await importCoverResource(
            createArtworkFile(
              embeddedCoverFileName,
              embeddedMetadata.artwork.bytes,
              embeddedMetadata.artwork.mimeType,
            ),
            nextStem,
          );
          importedPaths.push(importedCover.path);
          await Promise.all(importedCover.cleanupPaths.map((path) => deleteResourceQuietly(path)));

          if (currentConfig.album_cover && currentConfig.album_cover !== importedCover.path) {
            outgoingPaths.push(currentConfig.album_cover);
          }

          nextConfig = normalizeBasecardConfig({
            ...nextConfig,
            album_cover: importedCover.path,
          });
        }

        if (embeddedMetadata.timedLyricsText || embeddedMetadata.lyricsText) {
          const lyricsContent = embeddedMetadata.timedLyricsText || embeddedMetadata.lyricsText || "";
          const lyricsExtension = embeddedMetadata.timedLyricsText ? "lrc" : "txt";
          const lyricsFileName = buildDerivedResourcePath(nextStem, "lyrics", lyricsExtension);
          const importedLyrics = await importRequiredResource(
            createLyricsFile(lyricsFileName, lyricsContent),
            lyricsFileName,
          );
          importedPaths.push(importedLyrics.path);

          if (currentConfig.lyrics_file && currentConfig.lyrics_file !== importedLyrics.path) {
            outgoingPaths.push(currentConfig.lyrics_file);
          }

          nextConfig = normalizeBasecardConfig({
            ...nextConfig,
            lyrics_file: importedLyrics.path,
          });
        }

        if (currentConfig.audio_file && currentConfig.audio_file !== importedAudio.path) {
          outgoingPaths.push(currentConfig.audio_file);
        }

        await deleteOutgoingResourcesOrThrow(outgoingPaths);

        commitConfig(nextConfig);
      } catch (error) {
        await Promise.all(dedupeResourcePaths(importedPaths).map((path) => deleteResourceQuietly(path)));
        setPanelError(resolveErrorMessage(error, formatMessage("music.editor.errors.audio_import_failed")));
      }
    });
  }

  async function handleCoverUpload(file: File): Promise<void> {
    await withBusyField("cover", async () => {
      const currentConfig = configRef.current;
      const importedPaths: string[] = [];

      try {
        const baseName = resolveFileName(currentConfig.audio_file) || resolveFileName(file.name) || "cover";
        const importedCover = await importCoverResource(file, baseName);
        importedPaths.push(importedCover.path);
        await Promise.all(importedCover.cleanupPaths.map((path) => deleteResourceQuietly(path)));

        if (currentConfig.album_cover && currentConfig.album_cover !== importedCover.path) {
          await deleteOutgoingResourcesOrThrow([currentConfig.album_cover]);
        }

        commitConfig({
          ...currentConfig,
          album_cover: importedCover.path,
        });
      } catch (error) {
        await Promise.all(dedupeResourcePaths(importedPaths).map((path) => deleteResourceQuietly(path)));
        setPanelError(resolveErrorMessage(error, formatMessage("music.editor.errors.cover_import_failed")));
      }
    });
  }

  async function handleLyricsUpload(file: File): Promise<void> {
    await withBusyField("lyrics", async () => {
      const currentConfig = configRef.current;
      const importedPaths: string[] = [];

      try {
        const baseName = resolveFileName(currentConfig.audio_file) || resolveFileName(file.name) || "lyrics";
        const preferredLyricsPath = buildDerivedResourcePath(
          baseName,
          "lyrics",
          resolveFileExtension(file.name) || "txt",
        );
        const importedLyrics = await importRequiredResource(file, preferredLyricsPath);
        importedPaths.push(importedLyrics.path);

        if (currentConfig.lyrics_file && currentConfig.lyrics_file !== importedLyrics.path) {
          await deleteOutgoingResourcesOrThrow([currentConfig.lyrics_file]);
        }

        commitConfig({
          ...currentConfig,
          lyrics_file: importedLyrics.path,
        });
      } catch (error) {
        await Promise.all(dedupeResourcePaths(importedPaths).map((path) => deleteResourceQuietly(path)));
        setPanelError(resolveErrorMessage(error, formatMessage("music.editor.errors.lyrics_import_failed")));
      }
    });
  }

  async function handleRemoveAudio(): Promise<void> {
    await withBusyField("audio", async () => {
      const currentPath = normalizeRelativeCardResourcePath(configRef.current.audio_file);
      if (!currentPath || !props.deleteResource) {
        commitConfig({
          ...configRef.current,
          audio_file: "",
        });
        return;
      }

      try {
        await props.deleteResource(currentPath);
        commitConfig({
          ...configRef.current,
          audio_file: "",
        });
      } catch (error) {
        setPanelError(resolveErrorMessage(error, formatMessage("music.editor.errors.delete_failed")));
      }
    });
  }

  async function handleRemoveCover(): Promise<void> {
    await withBusyField("cover", async () => {
      const currentPath = normalizeRelativeCardResourcePath(configRef.current.album_cover);
      if (!currentPath || !props.deleteResource) {
        commitConfig({
          ...configRef.current,
          album_cover: "",
        });
        return;
      }

      try {
        await props.deleteResource(currentPath);
        commitConfig({
          ...configRef.current,
          album_cover: "",
        });
      } catch (error) {
        setPanelError(resolveErrorMessage(error, formatMessage("music.editor.errors.delete_failed")));
      }
    });
  }

  async function handleRemoveLyrics(): Promise<void> {
    await withBusyField("lyrics", async () => {
      const currentPath = normalizeRelativeCardResourcePath(configRef.current.lyrics_file);
      if (!currentPath || !props.deleteResource) {
        commitConfig({
          ...configRef.current,
          lyrics_file: "",
        });
        return;
      }

      try {
        await props.deleteResource(currentPath);
        commitConfig({
          ...configRef.current,
          lyrics_file: "",
        });
      } catch (error) {
        setPanelError(resolveErrorMessage(error, formatMessage("music.editor.errors.delete_failed")));
      }
    });
  }

  function handleAddTeamRole(): void {
    commitConfig({
      ...configRef.current,
      production_team: [
        ...configRef.current.production_team,
        {
          id: generateStableId("team"),
          role: "",
          people: [],
        },
      ],
    });
  }

  function handleUpdateTeamRole(roleId: string, patch: Partial<ProductionTeamRole>): void {
    commitConfig({
      ...configRef.current,
      production_team: normalizeRoleUpdate(
        configRef.current.production_team,
        roleId,
        (role) => ({
          ...role,
          ...patch,
        }),
      ),
    });
  }

  function handleRemoveTeamRole(roleId: string): void {
    commitConfig({
      ...configRef.current,
      production_team: configRef.current.production_team.filter((role) => role.id !== roleId),
    });
  }

  function renderUploadSurface(options: {
    field: ResourceField;
    accept: string;
    inputRole: string;
    uploadLabel: string;
    note?: string;
    preview?: React.ReactNode;
    onFileSelected: (file: File) => Promise<void>;
  }) {
    const {
      field,
      accept,
      inputRole,
      uploadLabel,
      note,
      preview,
      onFileSelected,
    } = options;
    const dropState = busyField === field ? "busy" : dragField === field ? "dragover" : "idle";
    const isBusy = busyField !== null;

    return (
      <div className="chips-music-editor__row-body">
        <label
          className="chips-music-editor__dropzone"
          data-state={dropState}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isBusy) {
              setDragField(field);
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!isBusy) {
              event.dataTransfer.dropEffect = "copy";
              setDragField(field);
            }
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            setDragField((current) => (current === field ? null : current));
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragField((current) => (current === field ? null : current));
            if (isBusy) {
              return;
            }
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void onFileSelected(file);
            }
          }}
        >
          <input
            data-role={inputRole}
            className="chips-music-editor__dropzone-input"
            type="file"
            accept={accept}
            disabled={isBusy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) {
                void onFileSelected(file);
              }
              event.currentTarget.value = "";
            }}
          />

          <span className="chips-music-editor__dropzone-content">
            {preview}
            <span className="chips-music-editor__dropzone-copy">
              <span className="chips-music-editor__dropzone-text">
                {busyField === field ? formatMessage(`music.editor.status.${field}`) : uploadLabel}
              </span>
              {note ? (
                <span className="chips-music-editor__dropzone-note">{note}</span>
              ) : null}
            </span>
          </span>
        </label>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="chips-music-editor"
      onSubmit={(event) => {
        event.preventDefault();
      }}
    >
      <div className="chips-music-editor__shell">
        {panelError ? (
          <div className="chips-music-editor__alert chips-music-editor__alert--error">
            <Result
              status="error"
              title={formatMessage("music.editor.errors.operation_failed")}
              subTitle={panelError}
            />
          </div>
        ) : null}

        {panelNotice ? (
          <div className="chips-music-editor__alert">{panelNotice}</div>
        ) : null}

        {flattenedErrors.length > 0 ? (
          <div className="chips-music-editor__alert chips-music-editor__alert--error">
            <Result
              status="error"
              title={formatMessage("music.editor.errors.validation_failed")}
              subTitle={flattenedErrors[0]}
            />
            <ul className="chips-music-editor__errors-list">
              {flattenedErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <section className="chips-music-editor__group">
          <div className="chips-music-editor__group-head">
            <span className="chips-music-editor__group-title">{formatMessage("music.editor.resources.title")}</span>
            {busyField ? (
              <span className="chips-music-editor__status">
                <Progress
                  className="chips-music-editor__status-progress"
                  type="line"
                  percent={100}
                  status="active"
                  showInfo={false}
                  size={{ width: 42, height: 6 }}
                  aria-label={formatMessage(`music.editor.status.${busyField}`)}
                />
                {formatMessage(`music.editor.status.${busyField}`)}
              </span>
            ) : null}
          </div>

          <div className="chips-music-editor__list">
            <div className="chips-music-editor__row">
              <p className="chips-music-editor__row-label">
                <span>{formatMessage("music.editor.audio.title")}</span>
                <span className="chips-music-editor__label-badge">{formatMessage("music.editor.badge.required")}</span>
              </p>
              {config.audio_file ? (
                <div className="chips-music-editor__resource-tile" data-role="audio-resource">
                  <div className="chips-music-editor__resource-head">
                    <div className="chips-music-editor__resource-cover" aria-hidden="true">
                      <Image
                        src={displayCoverUrl}
                        alt={displayTitle}
                        preview={false}
                        loading="lazy"
                      />
                    </div>
                    <div className="chips-music-editor__resource-summary">
                      <span className="chips-music-editor__resource-summary-title">{displayTitle}</span>
                      <span className="chips-music-editor__resource-summary-subtitle">
                        {resolveFileName(config.audio_file)}
                      </span>
                    </div>
                    <div className="chips-music-editor__resource-actions">
                      <FilePickerButton
                        label={formatMessage("music.editor.audio.replace")}
                        role="replace-audio-input"
                        accept={AUDIO_ACCEPT}
                        disabled={busyField !== null}
                        onFileSelected={(file) => {
                          void handleAudioUpload(file);
                        }}
                      />
                      <Button
                        type="default"
                        data-role="remove-audio"
                        disabled={busyField !== null}
                        onClick={() => {
                          void handleRemoveAudio();
                        }}
                      >
                        {formatMessage("music.editor.actions.remove")}
                      </Button>
                    </div>
                  </div>
                  <div className="chips-music-editor__resource-meta">
                    {audioPreviewUrl ? (
                      <audio
                        className="chips-music-editor__audio-preview"
                        controls
                        preload="metadata"
                        src={audioPreviewUrl}
                        title={displayTitle}
                      />
                    ) : (
                      <Skeleton active paragraph={{ rows: 1 }} title={false} />
                    )}
                  </div>
                </div>
              ) : renderUploadSurface({
                field: "audio",
                accept: AUDIO_ACCEPT,
                inputRole: "audio-input",
                uploadLabel: formatMessage("music.editor.audio.upload"),
                note: formatMessage("music.editor.audio.required"),
                onFileSelected: handleAudioUpload,
              })}
            </div>

            <div className="chips-music-editor__row">
              <p className="chips-music-editor__row-label">{formatMessage("music.editor.cover.title")}</p>
              {config.album_cover ? (
                <div className="chips-music-editor__resource-tile" data-role="cover-resource">
                  <div className="chips-music-editor__resource-head">
                    <Image
                      className="chips-music-editor__resource-preview--cover"
                      src={displayCoverUrl}
                      alt={formatMessage("music.editor.cover.selected")}
                      preview={false}
                      loading="lazy"
                    />
                    <div className="chips-music-editor__resource-meta">
                      <span className="chips-music-editor__resource-tile-name">{resolveFileName(config.album_cover)}</span>
                    </div>
                    <div className="chips-music-editor__resource-actions">
                      <FilePickerButton
                        label={formatMessage("music.editor.cover.replace")}
                        role="replace-cover-input"
                        accept={COVER_ACCEPT}
                        disabled={busyField !== null}
                        onFileSelected={(file) => {
                          void handleCoverUpload(file);
                        }}
                      />
                      <Button
                        type="default"
                        data-role="remove-cover"
                        disabled={busyField !== null}
                        onClick={() => {
                          void handleRemoveCover();
                        }}
                      >
                        {formatMessage("music.editor.cover.remove")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : renderUploadSurface({
                field: "cover",
                accept: COVER_ACCEPT,
                inputRole: "cover-input",
                uploadLabel: formatMessage("music.editor.cover.upload"),
                note: formatMessage("music.editor.cover.default_placeholder"),
                preview: (
                  <span className="chips-music-editor__dropzone-preview" aria-hidden="true">
                    <Image
                      src={DEFAULT_MUSIC_COVER_URL}
                      alt=""
                      preview={false}
                      loading="lazy"
                    />
                  </span>
                ),
                onFileSelected: handleCoverUpload,
              })}
            </div>

            <div className="chips-music-editor__row">
              <p className="chips-music-editor__row-label">{formatMessage("music.editor.lyrics.title")}</p>
              {config.lyrics_file ? (
                <div className="chips-music-editor__resource-tile" data-role="lyrics-resource">
                  <div className="chips-music-editor__resource-head">
                    <span className="chips-music-editor__dropzone-badge">{lyricsBadge}</span>
                    <div className="chips-music-editor__resource-meta">
                      <span className="chips-music-editor__resource-tile-name">{resolveFileName(config.lyrics_file)}</span>
                    </div>
                    <div className="chips-music-editor__resource-actions">
                      <FilePickerButton
                        label={formatMessage("music.editor.lyrics.replace")}
                        role="replace-lyrics-input"
                        accept={LYRICS_ACCEPT}
                        disabled={busyField !== null}
                        onFileSelected={(file) => {
                          void handleLyricsUpload(file);
                        }}
                      />
                      <Button
                        type="default"
                        data-role="remove-lyrics"
                        disabled={busyField !== null}
                        onClick={() => {
                          void handleRemoveLyrics();
                        }}
                      >
                        {formatMessage("music.editor.lyrics.remove")}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : renderUploadSurface({
                field: "lyrics",
                accept: LYRICS_ACCEPT,
                inputRole: "lyrics-input",
                uploadLabel: formatMessage("music.editor.lyrics.upload"),
                preview: (
                  <span className="chips-music-editor__dropzone-badge" aria-hidden="true">LRC / TXT</span>
                ),
                onFileSelected: handleLyricsUpload,
              })}
            </div>
          </div>
        </section>

        <section className="chips-music-editor__group">
          <div className="chips-music-editor__group-head">
            <span className="chips-music-editor__group-title">{formatMessage("music.editor.metadata.title")}</span>
          </div>

          <div className="chips-music-editor__list">
            <div className="chips-music-editor__field-row" data-field="music_name">
              <span className="chips-music-editor__field-label">
                {formatMessage("music.editor.fields.music_name")}
              </span>
              <div className="chips-music-editor__field-control">
                <Input
                  data-role="music-name-input"
                  type="text"
                  value={config.music_name}
                  placeholder={deriveDisplayTitle(config) || formatMessage("music.editor.fields.music_name_placeholder")}
                  onChange={(event) => {
                    updateConfig({ music_name: event.currentTarget.value });
                  }}
                />
              </div>
            </div>

            <div className="chips-music-editor__field-row" data-field="album_name">
              <span className="chips-music-editor__field-label">
                {formatMessage("music.editor.fields.album_name")}
              </span>
              <div className="chips-music-editor__field-control">
                <Input
                  data-role="album-name-input"
                  type="text"
                  value={config.album_name}
                  placeholder={formatMessage("music.editor.fields.album_name_placeholder")}
                  onChange={(event) => {
                    updateConfig({ album_name: event.currentTarget.value });
                  }}
                />
              </div>
            </div>

            <div className="chips-music-editor__field-row" data-field="release_date">
              <span className="chips-music-editor__field-label">
                {formatMessage("music.editor.fields.release_date")}
              </span>
              <div className="chips-music-editor__field-control">
                <Input
                  data-role="release-date-input"
                  type="date"
                  value={config.release_date}
                  onChange={(event) => {
                    updateConfig({ release_date: event.currentTarget.value });
                  }}
                />
              </div>
            </div>

            <div className="chips-music-editor__field-row" data-field="language">
              <span className="chips-music-editor__field-label">
                {formatMessage("music.editor.fields.language")}
              </span>
              <div className="chips-music-editor__field-control">
                <Input
                  data-role="language-input"
                  type="text"
                  value={config.language}
                  placeholder={formatMessage("music.editor.fields.language_placeholder")}
                  onChange={(event) => {
                    updateConfig({ language: event.currentTarget.value });
                  }}
                />
              </div>
            </div>

            <div className="chips-music-editor__field-row" data-field="genre">
              <span className="chips-music-editor__field-label">
                {formatMessage("music.editor.fields.genre")}
              </span>
              <div className="chips-music-editor__field-control">
                <Input
                  data-role="genre-input"
                  type="text"
                  value={config.genre}
                  placeholder={formatMessage("music.editor.fields.genre_placeholder")}
                  onChange={(event) => {
                    updateConfig({ genre: event.currentTarget.value });
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="chips-music-editor__group">
          <div className="chips-music-editor__group-head">
            <span className="chips-music-editor__group-title">{formatMessage("music.editor.team.title")}</span>
            <Space className="chips-music-editor__toolbar">
              <Button onClick={handleAddTeamRole}>
                {formatMessage("music.editor.team.add_role")}
              </Button>
            </Space>
          </div>

          {config.production_team.length > 0 ? (
            <div className="chips-music-editor__team-list">
              {config.production_team.map((role) => (
                <div key={role.id} className="chips-music-editor__team-item">
                  <div className="chips-music-editor__team-item-head">
                    <span className="chips-music-editor__team-item-title">
                      {role.role || formatMessage("music.editor.team.role_placeholder")}
                    </span>
                  </div>

                  <div className="chips-music-editor__team-card-body">
                    <div className="chips-music-editor__field-row" data-field={`team-role-${role.id}`}>
                      <span className="chips-music-editor__field-label">
                        {formatMessage("music.editor.team.role_label")}
                      </span>
                      <div className="chips-music-editor__field-control">
                        <Input
                          data-role={`team-role-input-${role.id}`}
                          type="text"
                          value={role.role}
                          placeholder={formatMessage("music.editor.team.role_placeholder")}
                          onChange={(event) => {
                            handleUpdateTeamRole(role.id, {
                              role: event.currentTarget.value,
                            });
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="chips-music-editor__field-row chips-music-editor__field-row--multiline"
                      data-field={`team-people-${role.id}`}
                    >
                      <span className="chips-music-editor__field-label">
                        {formatMessage("music.editor.team.people_label")}
                      </span>
                      <div className="chips-music-editor__field-control">
                        <Input.TextArea
                          data-role={`team-people-input-${role.id}`}
                          value={role.people.join("\n")}
                          placeholder={formatMessage("music.editor.team.people_placeholder")}
                          rows={4}
                          onChange={(event) => {
                            handleUpdateTeamRole(role.id, {
                              people: event.currentTarget.value
                                .split(/\r?\n/u)
                                .map((item) => item.trim())
                                .filter((item) => item.length > 0),
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="chips-music-editor__team-card-actions">
                    <Button
                      type="default"
                      onClick={() => {
                        handleRemoveTeamRole(role.id);
                      }}
                    >
                      {formatMessage("music.editor.team.remove_role")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="chips-music-editor__team-empty">{formatMessage("music.editor.team.empty")}</div>
          )}
        </section>
      </div>
    </form>
  );
}

export function createBasecardEditorRoot(props: BasecardEditorProps): HTMLElement {
  const rootElement = document.createElement("div") as EditorRoot;
  rootElement.setAttribute("data-chips-music-editor-root", "true");
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
