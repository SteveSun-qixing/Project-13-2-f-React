import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  ConfigProvider,
  Image,
  Input,
  InputNumber,
  Result,
  Spin,
  Switch,
  Tag,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type {
  BasecardResourceImportRequest,
  BasecardResourceImportResult,
  BasecardVideoThumbnailRequest,
  BasecardVideoThumbnailResult,
} from "../index";
import {
  normalizeBasecardConfig,
  validateBasecardConfig,
  type BasecardConfig,
  type SubtitleKind,
  type SubtitleTrackConfig,
} from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import {
  cloneConfig,
  dedupeResourcePaths,
  generateStableId,
  isSupportedImportUrl,
  normalizeRelativeCardResourcePath,
  resolveFileName,
  sanitizeImportedFileName,
  stripFileExtension,
  useResolvedResourceUrl,
} from "../shared/utils";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (
    input: BasecardResourceImportRequest,
  ) => Promise<BasecardResourceImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
  extractVideoThumbnail?: (
    input: BasecardVideoThumbnailRequest,
  ) => Promise<BasecardVideoThumbnailResult>;
}

type EditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

type ResourceField = "video" | "cover";
type SubtitleBusyField = `subtitle:${string}`;
type BusyField = ResourceField | SubtitleBusyField | null;

const VIDEO_ACCEPT = ".mp4,.webm,.mov,.m4v,.ogv,.ogg,video/*";
const COVER_ACCEPT = "image/*";
const SUBTITLE_ACCEPT = ".vtt,.srt,.ass,.ssa,text/vtt,text/plain,application/x-subrip";
const DEFAULT_THUMBNAIL_OPTIONS = {
  timeSeconds: 0,
  format: "png",
  width: 1280,
  height: 720,
  fit: "cover",
} as const;

const EDITOR_STYLE_TEXT = `
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: #ffffff;
}

.chips-video-editor {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: auto;
  padding: 18px clamp(12px, 3vw, 20px) 28px;
  color: #1d1d1f;
  background: #ffffff;
  font: 14px/1.55 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-video-editor,
.chips-video-editor * {
  box-sizing: border-box;
}

.chips-video-editor__shell {
  display: grid;
  gap: 22px;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
}

.chips-video-editor__alert {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(242, 242, 247, 0.92);
  color: #1d1d1f;
}

.chips-video-editor__alert .ant-result {
  padding: 0;
  background: transparent;
}

.chips-video-editor__alert .ant-result-icon {
  margin-bottom: 6px;
}

.chips-video-editor__errors-list {
  margin: 0;
  padding-left: 18px;
}

.chips-video-editor__group {
  display: grid;
  gap: 10px;
}

.chips-video-editor__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.chips-video-editor__group-title {
  margin: 0;
  font-size: 15px;
  font-weight: 720;
  line-height: 1.35;
  letter-spacing: 0;
}

.chips-video-editor__status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 26px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  background: rgba(10, 132, 255, 0.08);
  color: #0a84ff;
}

.chips-video-editor__list {
  display: grid;
}

.chips-video-editor__row,
.chips-video-editor__field-row {
  display: grid;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.chips-video-editor__row--compact {
  gap: 8px;
}

.chips-video-editor__row-label,
.chips-video-editor__field-label {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: #1d1d1f;
}

.chips-video-editor__row-body {
  display: grid;
  gap: 10px;
}

.chips-video-editor__dropzone {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 116px;
  padding: 18px;
  border: 1.5px dashed rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  background: rgba(242, 242, 247, 0.64);
  color: #1d1d1f;
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease;
}

.chips-video-editor__dropzone[data-state="dragover"] {
  border-color: rgba(10, 132, 255, 0.34);
  background: rgba(10, 132, 255, 0.06);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.08);
}

.chips-video-editor__dropzone[data-state="busy"] {
  cursor: progress;
}

.chips-video-editor__dropzone:hover,
.chips-video-editor__dropzone:focus-within {
  border-color: rgba(10, 132, 255, 0.28);
}

.chips-video-editor__dropzone-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.chips-video-editor__dropzone-text {
  font-size: 14px;
  font-weight: 650;
  color: #1d1d1f;
}

.chips-video-editor__url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
}

.chips-video-editor__resource-tile {
  position: relative;
  display: grid;
  align-items: stretch;
  min-height: 144px;
  padding: 0;
  border-radius: 8px;
  background: rgba(242, 242, 247, 0.7);
  overflow: hidden;
}

.chips-video-editor__resource-tile-body {
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
}

.chips-video-editor__resource-tile .ant-image {
  display: block;
  width: 100%;
}

.chips-video-editor__resource-preview {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: #f2f2f7;
}

.chips-video-editor__resource-meta {
  padding: 10px 12px;
  background: #ffffff;
}

.chips-video-editor__resource-tile-name {
  display: block;
  font-size: 14px;
  font-weight: 650;
  color: #1d1d1f;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.chips-video-editor__resource-delete {
  position: absolute;
  top: 10px;
  right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.72);
  color: #ffffff;
  font: inherit;
  font-weight: 700;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease;
  cursor: pointer;
}

.chips-video-editor__resource-tile:hover .chips-video-editor__resource-delete,
.chips-video-editor__resource-tile:focus-within .chips-video-editor__resource-delete {
  opacity: 1;
  pointer-events: auto;
}

.chips-video-editor__resource-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px 12px;
  background: #ffffff;
}

.chips-video-editor__resource-actions .ant-btn {
  min-height: 34px;
}

.chips-video-editor__input.ant-input {
  width: 100%;
  min-height: 40px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  background: #ffffff;
  color: inherit;
  font: inherit;
  outline: none;
  padding: 0 14px;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.chips-video-editor__input.ant-input:hover,
.chips-video-editor__input.ant-input:focus {
  border-color: rgba(10, 132, 255, 0.42);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.1);
}

.chips-video-editor__file-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 15px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: #ffffff;
  color: #1d1d1f;
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease;
}

.chips-video-editor__file-button:hover,
.chips-video-editor__file-button:focus-visible {
  border-color: rgba(10, 132, 255, 0.42);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.1);
}

.chips-video-editor__file-button:focus-visible {
  outline: 2px solid rgba(10, 132, 255, 0.6);
  outline-offset: 2px;
}

.chips-video-editor__field-row {
  grid-template-columns: 112px minmax(0, 1fr);
  align-items: center;
}

.chips-video-editor__field-row .ant-input,
.chips-video-editor__field-row .ant-input-number {
  width: 100%;
}

.chips-video-editor__switch-grid {
  display: grid;
  gap: 10px;
}

.chips-video-editor__switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.chips-video-editor__subtitle-list {
  display: grid;
  gap: 10px;
}

.chips-video-editor__subtitle-item {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  background: rgba(242, 242, 247, 0.76);
}

.chips-video-editor__subtitle-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chips-video-editor__subtitle-item-title {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.chips-video-editor__subtitle-item-title strong,
.chips-video-editor__subtitle-item-title span {
  overflow-wrap: anywhere;
}

.chips-video-editor__subtitle-fields {
  display: grid;
  gap: 8px;
}

.chips-video-editor__subtitle-field {
  display: grid;
  gap: 6px;
}

.chips-video-editor__subtitle-field-label {
  font-size: 12px;
  font-weight: 700;
  color: #6e6e73;
}

.chips-video-editor__subtitle-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chips-video-editor__badge {
  border-radius: 6px;
  margin-inline-end: 0;
}

.chips-video-editor__badge--accent {
  background: rgba(10, 132, 255, 0.08);
  border-color: rgba(10, 132, 255, 0.2);
  color: #0a84ff;
}

.chips-video-editor__badge--neutral {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.08);
  color: #6e6e73;
}

@media (max-width: 560px) {
  .chips-video-editor {
    padding-inline: 12px;
  }

  .chips-video-editor__field-row,
  .chips-video-editor__url-row {
    grid-template-columns: 1fr;
  }

  .chips-video-editor__field-row {
    gap: 8px;
  }

  .chips-video-editor__resource-delete {
    opacity: 1;
    pointer-events: auto;
  }
}
`;

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `${fallback} ${error.message.trim()}`.trim();
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return `${fallback} ${error.trim()}`.trim();
  }

  return fallback;
}

function normalizePlaybackRate(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 1;
  }

  return Math.min(4, Math.max(0.25, value));
}

function normalizeStartTime(value: number | null): number {
  if (value === null || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
}

function hasMetadataChanged(a: BasecardConfig, b: BasecardConfig): boolean {
  return a.video_title !== b.video_title
    || a.creator !== b.creator
    || a.publish_time !== b.publish_time
    || a.playback.autoplay !== b.playback.autoplay
    || a.playback.loop !== b.playback.loop
    || a.playback.muted !== b.playback.muted
    || a.playback.playback_rate !== b.playback.playback_rate
    || a.playback.start_time !== b.playback.start_time;
}

function mergePendingMetadata(
  incomingConfig: BasecardConfig,
  draftConfig: BasecardConfig,
): BasecardConfig {
  return normalizeBasecardConfig({
    ...incomingConfig,
    video_title: draftConfig.video_title,
    creator: draftConfig.creator,
    publish_time: draftConfig.publish_time,
    playback: draftConfig.playback,
  });
}

function isSameConfig(a: BasecardConfig, b: BasecardConfig): boolean {
  return a.card_type === b.card_type
    && a.theme === b.theme
    && a.video_file === b.video_file
    && a.cover_image === b.cover_image
    && JSON.stringify(a.subtitles) === JSON.stringify(b.subtitles)
    && JSON.stringify(a.playback) === JSON.stringify(b.playback)
    && a.video_title === b.video_title
    && a.publish_time === b.publish_time
    && a.creator === b.creator;
}

function getVisibleErrors(errors: Record<string, string>): string[] {
  return Object.entries(errors)
    .filter(([field]) => field !== "video_file")
    .map(([, message]) => message);
}

function translateErrorMessages(errors: Record<string, string>): string[] {
  return getVisibleErrors(errors).map((message) => formatMessage(message));
}

function isSubtitleBusyField(value: BusyField, subtitleId: string): boolean {
  return value === `subtitle:${subtitleId}`;
}

function inferExtensionFromMimeType(mimeType: string, fallbackExtension: string): string {
  const lower = mimeType.toLowerCase();

  if (lower.includes("mp4")) {
    return "mp4";
  }
  if (lower.includes("webm")) {
    return "webm";
  }
  if (lower.includes("quicktime")) {
    return "mov";
  }
  if (lower.includes("ogg")) {
    return "ogv";
  }
  if (lower.includes("png")) {
    return "png";
  }
  if (lower.includes("webp")) {
    return "webp";
  }
  if (lower.includes("gif")) {
    return "gif";
  }
  if (lower.includes("jpeg") || lower.includes("jpg")) {
    return "jpg";
  }
  if (lower.includes("vtt")) {
    return "vtt";
  }
  if (lower.includes("subrip") || lower.includes("srt")) {
    return "srt";
  }

  return fallbackExtension;
}

function parseFileNameFromContentDisposition(headerValue: string | null): string | undefined {
  if (!headerValue) {
    return undefined;
  }

  const utf8Match = headerValue.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = headerValue.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)/i);
  const candidate = plainMatch?.[1] ?? plainMatch?.[2];
  return candidate?.trim();
}

function buildImportedFileName(options: {
  sourceUrl: string;
  contentDisposition: string | null;
  mimeType: string;
  fallbackStem: string;
  fallbackExtension: string;
}): string {
  const {
    sourceUrl,
    contentDisposition,
    mimeType,
    fallbackStem,
    fallbackExtension,
  } = options;

  const fromHeader = parseFileNameFromContentDisposition(contentDisposition);
  if (fromHeader) {
    return sanitizeImportedFileName(fromHeader, `${fallbackStem}.${inferExtensionFromMimeType(mimeType, fallbackExtension)}`);
  }

  try {
    const parsed = new URL(sourceUrl);
    const fromPath = decodeURIComponent(parsed.pathname.split("/").pop() ?? "").trim();
    if (fromPath) {
      const sanitized = sanitizeImportedFileName(fromPath, fallbackStem);
      if (/\.[^.]+$/u.test(sanitized)) {
        return sanitized;
      }
      return `${sanitizeImportedFileName(sanitized, fallbackStem)}.${inferExtensionFromMimeType(mimeType, fallbackExtension)}`;
    }
  } catch {
    return `${fallbackStem}.${inferExtensionFromMimeType(mimeType, fallbackExtension)}`;
  }

  return `${fallbackStem}.${inferExtensionFromMimeType(mimeType, fallbackExtension)}`;
}

async function downloadFileFromUrl(options: {
  sourceUrl: string;
  fallbackStem: string;
  fallbackExtension: string;
  invalidUrlMessage: string;
  requestFailedMessage(status: number): string;
}): Promise<File> {
  const {
    sourceUrl,
    fallbackStem,
    fallbackExtension,
    invalidUrlMessage,
    requestFailedMessage,
  } = options;

  if (!isSupportedImportUrl(sourceUrl)) {
    throw new Error(invalidUrlMessage);
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(requestFailedMessage(response.status));
  }

  const blob = await response.blob();
  const mimeType = blob.type || "";
  const fileName = buildImportedFileName({
    sourceUrl,
    contentDisposition: response.headers.get("content-disposition"),
    mimeType,
    fallbackStem,
    fallbackExtension,
  });

  return new File([blob], fileName, {
    type: blob.type || undefined,
  });
}

function createSubtitleTrackFromResource(path: string, fileName: string, index: number): SubtitleTrackConfig {
  const baseName = stripFileExtension(resolveFileName(path) || fileName || `subtitle-${index + 1}`);

  return {
    id: generateStableId("subtitle"),
    label: baseName,
    language: "",
    kind: "subtitles",
    file_path: path,
    default: index === 0,
  };
}

function getSubtitleLabel(track: SubtitleTrackConfig, index: number): string {
  return track.label
    || track.language
    || resolveFileName(track.file_path)
    || formatMessage("video.editor.subtitles.fallback_label", { index: index + 1 });
}

function getSubtitleKindLabel(kind: SubtitleKind): string {
  return kind === "captions"
    ? formatMessage("video.editor.subtitles.kind_captions")
    : formatMessage("video.editor.subtitles.kind_subtitles");
}

function BasecardEditor(props: BasecardEditorProps) {
  const [config, setConfig] = useState(() => normalizeBasecardConfig(props.initialConfig));
  const [playbackRateDraft, setPlaybackRateDraft] = useState<number | null>(config.playback.playback_rate);
  const [startTimeDraft, setStartTimeDraft] = useState<number | null>(config.playback.start_time);
  const [errors, setErrors] = useState<Record<string, string>>(() =>
    validateBasecardConfig(normalizeBasecardConfig(props.initialConfig)).errors,
  );
  const [panelError, setPanelError] = useState("");
  const [busyField, setBusyField] = useState<BusyField>(null);
  const [dragField, setDragField] = useState<ResourceField | null>(null);
  const [urlDrafts, setUrlDrafts] = useState({
    video: "",
    cover: "",
    subtitle: "",
  });
  const configRef = useRef(config);
  const committedConfigRef = useRef(config);
  const onChangeRef = useRef(props.onChange);

  useEffect(() => {
    onChangeRef.current = props.onChange;
  }, [props.onChange]);

  useEffect(() => {
    const nextCommittedConfig = normalizeBasecardConfig(props.initialConfig);
    const currentDraftConfig = configRef.current;
    const shouldPreserveDraftMetadata = hasMetadataChanged(currentDraftConfig, committedConfigRef.current);
    const nextLocalConfig = shouldPreserveDraftMetadata
      ? mergePendingMetadata(nextCommittedConfig, currentDraftConfig)
      : nextCommittedConfig;

    committedConfigRef.current = nextCommittedConfig;
    configRef.current = nextLocalConfig;
    setConfig(nextLocalConfig);
    setErrors(validateBasecardConfig(nextLocalConfig).errors);

    if (!shouldPreserveDraftMetadata) {
      setPlaybackRateDraft(nextLocalConfig.playback.playback_rate);
      setStartTimeDraft(nextLocalConfig.playback.start_time);
    }
  }, [props.initialConfig]);

  useEffect(() => {
    return () => {
      const currentConfig = normalizeBasecardConfig(configRef.current);
      const validation = validateBasecardConfig(currentConfig);

      if (validation.valid && hasMetadataChanged(currentConfig, committedConfigRef.current)) {
        onChangeRef.current(cloneConfig(currentConfig));
      }
    };
  }, []);

  const flattenedErrors = useMemo(
    () => translateErrorMessages(errors),
    [errors],
  );
  const videoPreviewUrl = useResolvedResourceUrl(config.video_file, props.resolveResourceUrl, props.releaseResourceUrl);
  const coverPreviewUrl = useResolvedResourceUrl(config.cover_image, props.resolveResourceUrl, props.releaseResourceUrl);

  function applyLocalConfig(nextConfig: BasecardConfig) {
    const normalized = normalizeBasecardConfig(nextConfig);
    const validation = validateBasecardConfig(normalized);

    configRef.current = normalized;
    setConfig(normalized);
    setErrors(validation.errors);

    return {
      normalized,
      validation,
    };
  }

  function emitIfValid(normalizedConfig: BasecardConfig, validation: ReturnType<typeof validateBasecardConfig>): void {
    if (!validation.valid || isSameConfig(normalizedConfig, committedConfigRef.current)) {
      return;
    }

    committedConfigRef.current = normalizedConfig;
    onChangeRef.current(cloneConfig(normalizedConfig));
  }

  function commitConfig(nextConfig: BasecardConfig): void {
    const { normalized, validation } = applyLocalConfig(nextConfig);
    emitIfValid(normalized, validation);
  }

  function updateLocalConfig(patch: Partial<BasecardConfig>): void {
    applyLocalConfig({
      ...configRef.current,
      ...patch,
    });
  }

  function flushMetadataDraft(): void {
    if (!hasMetadataChanged(configRef.current, committedConfigRef.current)) {
      return;
    }

    const currentConfig = normalizeBasecardConfig(configRef.current);
    const validation = validateBasecardConfig(currentConfig);
    setErrors(validation.errors);
    emitIfValid(currentConfig, validation);
  }

  function updateUrlDraft(field: ResourceField, value: string): void {
    setUrlDrafts((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearUrlDraft(field: ResourceField): void {
    updateUrlDraft(field, "");
  }

  function updateSubtitleUrlDraft(value: string): void {
    setUrlDrafts((current) => ({
      ...current,
      subtitle: value,
    }));
  }

  async function importRequiredResource(file: File, preferredPath: string): Promise<BasecardResourceImportResult> {
    if (!props.importResource) {
      throw new Error(formatMessage("video.editor.errors.import_unavailable"));
    }

    return props.importResource({
      file,
      preferredPath,
    });
  }

  async function extractVideoThumbnail(
    resourcePath: string,
    preferredPath: string,
  ): Promise<BasecardVideoThumbnailResult | null> {
    const normalizedResourcePath = normalizeRelativeCardResourcePath(resourcePath);
    const normalizedOutputPath = normalizeRelativeCardResourcePath(preferredPath);
    if (!normalizedResourcePath || !normalizedOutputPath || !props.extractVideoThumbnail) {
      return null;
    }

    return props.extractVideoThumbnail({
      resourcePath: normalizedResourcePath,
      outputPath: normalizedOutputPath,
      overwrite: true,
      options: DEFAULT_THUMBNAIL_OPTIONS,
    });
  }

  async function deleteResourceQuietly(resourcePath: string): Promise<void> {
    const normalizedPath = normalizeRelativeCardResourcePath(resourcePath);
    if (!normalizedPath || !props.deleteResource) {
      return;
    }

    try {
      await props.deleteResource(normalizedPath);
    } catch (error) {
      setPanelError(resolveErrorMessage(error, formatMessage("video.editor.errors.delete_failed")));
    }
  }

  async function importVideoFile(file: File): Promise<void> {
    const currentConfig = configRef.current;
    const preferredVideoPath = sanitizeImportedFileName(file.name, "video.mp4");
    const importedVideo = await importRequiredResource(file, preferredVideoPath);
    const baseName = stripFileExtension(resolveFileName(importedVideo.path) || file.name || "video");
    const preferredCoverPath = sanitizeImportedFileName(`${baseName}-cover.png`, "video-cover.png");
    let extractedCoverPath = "";
    let thumbnailErrorMessage = "";

    try {
      const thumbnail = await extractVideoThumbnail(importedVideo.path, preferredCoverPath);
      extractedCoverPath = thumbnail?.path ?? "";
    } catch (error) {
      thumbnailErrorMessage = resolveErrorMessage(error, formatMessage("video.editor.errors.thumbnail_failed"));
    }

    commitConfig({
      ...currentConfig,
      video_file: importedVideo.path,
      cover_image: extractedCoverPath,
    });

    const deletions = dedupeResourcePaths([
      currentConfig.video_file && currentConfig.video_file !== importedVideo.path ? currentConfig.video_file : "",
      currentConfig.cover_image && currentConfig.cover_image !== extractedCoverPath ? currentConfig.cover_image : "",
    ]);

    await Promise.all(deletions.map((resourcePath) => deleteResourceQuietly(resourcePath)));

    if (thumbnailErrorMessage) {
      setPanelError(thumbnailErrorMessage);
    }
  }

  async function importCoverFile(file: File): Promise<void> {
    const currentConfig = configRef.current;
    const baseName = stripFileExtension(resolveFileName(currentConfig.video_file) || file.name || "video");
    const importedCover = await importRequiredResource(
      file,
      sanitizeImportedFileName(file.name, `${baseName}-cover.jpg`),
    );

    commitConfig({
      ...currentConfig,
      cover_image: importedCover.path,
    });

    if (currentConfig.cover_image && currentConfig.cover_image !== importedCover.path) {
      await deleteResourceQuietly(currentConfig.cover_image);
    }
  }

  async function importSubtitleFile(file: File, replaceTrackId?: string): Promise<void> {
    const currentConfig = configRef.current;
    const importedSubtitle = await importRequiredResource(
      file,
      sanitizeImportedFileName(file.name, "subtitle.vtt"),
    );
    const existingIndex = currentConfig.subtitles.findIndex((track) => track.id === replaceTrackId);
    const nextTrack = createSubtitleTrackFromResource(
      importedSubtitle.path,
      file.name,
      existingIndex >= 0 ? existingIndex : currentConfig.subtitles.length,
    );
    const nextSubtitles = existingIndex >= 0
      ? currentConfig.subtitles.map((track, index) => (
        index === existingIndex
          ? {
            ...track,
            file_path: importedSubtitle.path,
            label: track.label || nextTrack.label,
          }
          : track
      ))
      : [...currentConfig.subtitles, nextTrack];

    commitConfig({
      ...currentConfig,
      subtitles: nextSubtitles,
    });

    if (existingIndex >= 0) {
      const oldPath = currentConfig.subtitles[existingIndex]?.file_path;
      if (oldPath && oldPath !== importedSubtitle.path) {
        await deleteResourceQuietly(oldPath);
      }
    }
  }

  async function withBusyField(field: BusyField, task: () => Promise<void>): Promise<void> {
    setBusyField(field);
    setPanelError("");

    try {
      await task();
    } finally {
      setBusyField((current) => (current === field ? null : current));
      setDragField((current) => (current === field ? null : current));
    }
  }

  async function handleVideoUpload(file: File): Promise<void> {
    await withBusyField("video", async () => {
      try {
        await importVideoFile(file);
      } catch (error) {
        setPanelError(resolveErrorMessage(error, formatMessage("video.editor.errors.video_import_failed")));
      }
    });
  }

  async function handleCoverUpload(file: File): Promise<void> {
    await withBusyField("cover", async () => {
      try {
        await importCoverFile(file);
      } catch (error) {
        setPanelError(resolveErrorMessage(error, formatMessage("video.editor.errors.cover_import_failed")));
      }
    });
  }

  async function handleSubtitleUpload(file: File, replaceTrackId?: string): Promise<void> {
    await withBusyField(replaceTrackId ? `subtitle:${replaceTrackId}` : "subtitle:new", async () => {
      try {
        await importSubtitleFile(file, replaceTrackId);
      } catch (error) {
        setPanelError(resolveErrorMessage(error, formatMessage("video.editor.errors.subtitle_import_failed")));
      }
    });
  }

  async function handleUrlImport(field: ResourceField): Promise<void> {
    const sourceUrl = urlDrafts[field].trim();
    if (!sourceUrl) {
      return;
    }

    await withBusyField(field, async () => {
      try {
        const file = await downloadFileFromUrl({
          sourceUrl,
          fallbackStem: field === "video" ? "video-from-url" : "cover-from-url",
          fallbackExtension: field === "video" ? "mp4" : "jpg",
          invalidUrlMessage: formatMessage("video.editor.errors.url_invalid"),
          requestFailedMessage: (status) => formatMessage("video.editor.errors.url_request_failed", { status }),
        });

        if (field === "video") {
          await importVideoFile(file);
        } else {
          await importCoverFile(file);
        }

        clearUrlDraft(field);
      } catch (error) {
        setPanelError(resolveErrorMessage(error, formatMessage("video.editor.errors.url_import_failed")));
      }
    });
  }

  async function handleSubtitleUrlImport(): Promise<void> {
    const sourceUrl = urlDrafts.subtitle.trim();
    if (!sourceUrl) {
      return;
    }

    await withBusyField("subtitle:new", async () => {
      try {
        const file = await downloadFileFromUrl({
          sourceUrl,
          fallbackStem: "subtitle-from-url",
          fallbackExtension: "vtt",
          invalidUrlMessage: formatMessage("video.editor.errors.url_invalid"),
          requestFailedMessage: (status) => formatMessage("video.editor.errors.url_request_failed", { status }),
        });
        await importSubtitleFile(file);
        updateSubtitleUrlDraft("");
      } catch (error) {
        setPanelError(resolveErrorMessage(error, formatMessage("video.editor.errors.url_import_failed")));
      }
    });
  }

  async function handleRemoveVideo(): Promise<void> {
    const currentConfig = configRef.current;
    commitConfig({
      ...currentConfig,
      video_file: "",
      cover_image: "",
    });
    await Promise.all([
      deleteResourceQuietly(currentConfig.video_file),
      deleteResourceQuietly(currentConfig.cover_image),
    ]);
  }

  async function handleRemoveCover(): Promise<void> {
    const currentPath = configRef.current.cover_image;
    commitConfig({
      ...configRef.current,
      cover_image: "",
    });
    await deleteResourceQuietly(currentPath);
  }

  async function handleRemoveSubtitle(trackId: string): Promise<void> {
    const currentConfig = configRef.current;
    const track = currentConfig.subtitles.find((item) => item.id === trackId);
    commitConfig({
      ...currentConfig,
      subtitles: currentConfig.subtitles.filter((item) => item.id !== trackId),
    });
    await deleteResourceQuietly(track?.file_path ?? "");
  }

  function handleUpdateSubtitle(trackId: string, patch: Partial<SubtitleTrackConfig>): void {
    const currentConfig = configRef.current;
    commitConfig({
      ...currentConfig,
      subtitles: currentConfig.subtitles.map((track) => (
        track.id === trackId
          ? {
            ...track,
            ...patch,
            default: patch.default ?? track.default,
          }
          : patch.default === true
            ? { ...track, default: false }
            : track
      )),
    });
  }

  function handlePlaybackPatch(patch: Partial<BasecardConfig["playback"]>): void {
    updateLocalConfig({
      playback: {
        ...configRef.current.playback,
        ...patch,
      },
    });
  }

  function renderUploadSurface(options: {
    field: ResourceField;
    accept: string;
    inputRole: string;
    placeholder: string;
    uploadLabel: string;
    urlValue: string;
    inputValue: string;
    onFileSelected: (file: File) => Promise<void>;
  }) {
    const {
      field,
      accept,
      inputRole,
      placeholder,
      uploadLabel,
      urlValue,
      inputValue,
      onFileSelected,
    } = options;
    const isBusy = busyField !== null;
    const dropState = busyField === field ? "busy" : dragField === field ? "dragover" : "idle";

    return (
      <div className="chips-video-editor__row-body">
        <label
          className="chips-video-editor__dropzone"
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
            className="chips-video-editor__dropzone-input"
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
          <span className="chips-video-editor__dropzone-text">
            {busyField === field ? formatMessage("video.editor.status.uploading") : uploadLabel}
          </span>
        </label>

        <div className="chips-video-editor__url-row">
          <Input
            data-role={`${field}-url-input`}
            className="chips-video-editor__input"
            value={urlValue}
            aria-label={placeholder}
            placeholder={placeholder}
            disabled={isBusy}
            onChange={(event) => {
              updateUrlDraft(field, event.target.value);
            }}
            onPressEnter={(event) => {
              event.preventDefault();
              void handleUrlImport(field);
            }}
          />
          <Button
            data-role={`${field}-url-submit`}
            disabled={isBusy || inputValue.trim().length === 0}
            onClick={() => {
              void handleUrlImport(field);
            }}
          >
            {formatMessage("video.editor.actions.import_url")}
          </Button>
        </div>
      </div>
    );
  }

  const isBusy = busyField !== null;

  return (
    <form
      className="chips-video-editor"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        flushMetadataDraft();
      }}
    >
      <div className="chips-video-editor__shell">
        {panelError ? (
          <div className="chips-video-editor__alert">
            <Result
              status="error"
              title={formatMessage("video.editor.errors.operation_failed")}
              subTitle={panelError}
            />
          </div>
        ) : null}

        {flattenedErrors.length > 0 ? (
          <div className="chips-video-editor__alert">
            <Result
              status="error"
              title={formatMessage("video.editor.errors.validation_failed")}
              subTitle={flattenedErrors[0]}
            />
            {flattenedErrors.length > 1 ? (
              <ul className="chips-video-editor__errors-list">
                {flattenedErrors.slice(1).map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <section className="chips-video-editor__group">
          <div className="chips-video-editor__group-head">
            <h2 className="chips-video-editor__group-title">{formatMessage("video.editor.resources.title")}</h2>
            <span className="chips-video-editor__status">
              {busyField ? <Spin size="small" /> : null}
              {busyField === "video"
                ? formatMessage("video.editor.status.video")
                : busyField === "cover"
                  ? formatMessage("video.editor.status.cover")
                  : busyField?.startsWith("subtitle:")
                    ? formatMessage("video.editor.status.subtitle")
                  : formatMessage("video.editor.status.ready")}
            </span>
          </div>

          <div className="chips-video-editor__list">
            <div className="chips-video-editor__row">
              <p className="chips-video-editor__row-label">{formatMessage("video.editor.resources.video")}</p>
              {config.video_file ? (
                <div className="chips-video-editor__resource-tile" data-role="video-resource">
                  <div className="chips-video-editor__resource-tile-body">
                    <video
                      className="chips-video-editor__resource-preview"
                      src={videoPreviewUrl}
                      title={resolveFileName(config.video_file)}
                      controls
                      preload="metadata"
                    />
                    <div className="chips-video-editor__resource-meta">
                      <span className="chips-video-editor__resource-tile-name">{resolveFileName(config.video_file)}</span>
                    </div>
                  </div>
                  <div className="chips-video-editor__resource-actions">
                    <label className="chips-video-editor__file-button">
                      {formatMessage("video.editor.actions.replace_video")}
                      <input
                        data-role="replace-video-input"
                        className="chips-video-editor__dropzone-input"
                        type="file"
                        accept={VIDEO_ACCEPT}
                        disabled={isBusy}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) {
                            void handleVideoUpload(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <Button
                      disabled={isBusy}
                      onClick={() => {
                        void handleRemoveVideo();
                      }}
                    >
                      {formatMessage("video.editor.actions.remove")}
                    </Button>
                  </div>
                </div>
              ) : renderUploadSurface({
                field: "video",
                accept: VIDEO_ACCEPT,
                inputRole: "video-input",
                placeholder: formatMessage("video.editor.placeholders.video_url"),
                uploadLabel: formatMessage("video.editor.actions.upload_video"),
                urlValue: urlDrafts.video,
                inputValue: urlDrafts.video,
                onFileSelected: handleVideoUpload,
              })}
            </div>

            <div className="chips-video-editor__row">
              <p className="chips-video-editor__row-label">{formatMessage("video.editor.resources.cover")}</p>
              {config.cover_image ? (
                <div className="chips-video-editor__resource-tile" data-role="cover-resource">
                  <div className="chips-video-editor__resource-tile-body">
                    <Image
                      className="chips-video-editor__resource-preview"
                      src={coverPreviewUrl}
                      alt={resolveFileName(config.cover_image)}
                      preview={false}
                      loading="lazy"
                    />
                    <div className="chips-video-editor__resource-meta">
                      <span className="chips-video-editor__resource-tile-name">{resolveFileName(config.cover_image)}</span>
                    </div>
                  </div>
                  <div className="chips-video-editor__resource-actions">
                    <label className="chips-video-editor__file-button">
                      {formatMessage("video.editor.actions.replace_cover")}
                      <input
                        data-role="replace-cover-input"
                        className="chips-video-editor__dropzone-input"
                        type="file"
                        accept={COVER_ACCEPT}
                        disabled={isBusy}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          if (file) {
                            void handleCoverUpload(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <Button
                      disabled={isBusy}
                      onClick={() => {
                        void handleRemoveCover();
                      }}
                    >
                      {formatMessage("video.editor.actions.remove")}
                    </Button>
                  </div>
                </div>
              ) : renderUploadSurface({
                field: "cover",
                accept: COVER_ACCEPT,
                inputRole: "cover-input",
                placeholder: formatMessage("video.editor.placeholders.cover_url"),
                uploadLabel: formatMessage("video.editor.actions.upload_cover"),
                urlValue: urlDrafts.cover,
                inputValue: urlDrafts.cover,
                onFileSelected: handleCoverUpload,
              })}
            </div>
          </div>
        </section>

        <section className="chips-video-editor__group">
          <div className="chips-video-editor__group-head">
            <h2 className="chips-video-editor__group-title">{formatMessage("video.editor.subtitles.title")}</h2>
            <Tag className={config.subtitles.length > 0
              ? "chips-video-editor__badge chips-video-editor__badge--accent"
              : "chips-video-editor__badge chips-video-editor__badge--neutral"
            }>
              {formatMessage("video.editor.subtitles.count", { count: config.subtitles.length })}
            </Tag>
          </div>

          <div className="chips-video-editor__list">
            <div className="chips-video-editor__row">
              <p className="chips-video-editor__row-label">{formatMessage("video.editor.subtitles.import")}</p>
              <div className="chips-video-editor__row-body">
                <label
                  className="chips-video-editor__dropzone"
                  data-state={busyField === "subtitle:new" ? "busy" : "idle"}
                  onDragEnter={(event) => {
                    event.preventDefault();
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = isBusy ? "none" : "copy";
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (isBusy) {
                      return;
                    }
                    const file = event.dataTransfer.files?.[0];
                    if (file) {
                      void handleSubtitleUpload(file);
                    }
                  }}
                >
                  <input
                    data-role="subtitle-input"
                    className="chips-video-editor__dropzone-input"
                    type="file"
                    accept={SUBTITLE_ACCEPT}
                    disabled={isBusy}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file) {
                        void handleSubtitleUpload(file);
                      }
                      event.currentTarget.value = "";
                    }}
                  />
                  <span className="chips-video-editor__dropzone-text">
                    {busyField === "subtitle:new"
                      ? formatMessage("video.editor.status.uploading")
                      : formatMessage("video.editor.subtitles.upload")}
                  </span>
                </label>

                <div className="chips-video-editor__url-row">
                  <Input
                    data-role="subtitle-url-input"
                    className="chips-video-editor__input"
                    value={urlDrafts.subtitle}
                    aria-label={formatMessage("video.editor.placeholders.subtitle_url")}
                    placeholder={formatMessage("video.editor.placeholders.subtitle_url")}
                    disabled={isBusy}
                    onChange={(event) => {
                      updateSubtitleUrlDraft(event.target.value);
                    }}
                    onPressEnter={(event) => {
                      event.preventDefault();
                      void handleSubtitleUrlImport();
                    }}
                  />
                  <Button
                    data-role="subtitle-url-submit"
                    disabled={isBusy || urlDrafts.subtitle.trim().length === 0}
                    onClick={() => {
                      void handleSubtitleUrlImport();
                    }}
                  >
                    {formatMessage("video.editor.actions.import_url")}
                  </Button>
                </div>
              </div>
            </div>

            {config.subtitles.length > 0 ? (
              <div className="chips-video-editor__subtitle-list">
                {config.subtitles.map((track, index) => (
                  <div key={track.id} className="chips-video-editor__subtitle-item" data-role={`subtitle-${track.id}`}>
                    <div className="chips-video-editor__subtitle-item-head">
                      <div className="chips-video-editor__subtitle-item-title">
                        <strong>{getSubtitleLabel(track, index)}</strong>
                        <span>{resolveFileName(track.file_path)}</span>
                      </div>
                      <Tag className={track.default
                        ? "chips-video-editor__badge chips-video-editor__badge--accent"
                        : "chips-video-editor__badge chips-video-editor__badge--neutral"
                      }>
                        {track.default ? formatMessage("video.editor.subtitles.default") : getSubtitleKindLabel(track.kind)}
                      </Tag>
                    </div>

                    <div className="chips-video-editor__subtitle-fields">
                      <div className="chips-video-editor__subtitle-field">
                        <span className="chips-video-editor__subtitle-field-label">
                          {formatMessage("video.editor.subtitles.label")}
                        </span>
                        <Input
                          data-role={`subtitle-label-input-${track.id}`}
                          className="chips-video-editor__input"
                          value={track.label}
                          aria-label={formatMessage("video.editor.subtitles.label")}
                          placeholder={formatMessage("video.editor.subtitles.label_placeholder")}
                          onChange={(event) => {
                            handleUpdateSubtitle(track.id, { label: event.target.value });
                          }}
                        />
                      </div>
                      <div className="chips-video-editor__subtitle-field">
                        <span className="chips-video-editor__subtitle-field-label">
                          {formatMessage("video.editor.subtitles.language")}
                        </span>
                        <Input
                          data-role={`subtitle-language-input-${track.id}`}
                          className="chips-video-editor__input"
                          value={track.language}
                          aria-label={formatMessage("video.editor.subtitles.language")}
                          placeholder={formatMessage("video.editor.subtitles.language_placeholder")}
                          onChange={(event) => {
                            handleUpdateSubtitle(track.id, { language: event.target.value });
                          }}
                        />
                      </div>
                    </div>

                    <div className="chips-video-editor__switch-row">
                      <span>{formatMessage("video.editor.subtitles.default")}</span>
                      <Switch
                        checked={track.default}
                        disabled={isBusy}
                        aria-label={formatMessage("video.editor.subtitles.default")}
                        onChange={(checked) => {
                          handleUpdateSubtitle(track.id, { default: checked });
                        }}
                      />
                    </div>

                    <div className="chips-video-editor__subtitle-actions">
                      <label className="chips-video-editor__file-button">
                        {formatMessage("video.editor.subtitles.replace")}
                        <input
                          data-role={`replace-subtitle-input-${track.id}`}
                          className="chips-video-editor__dropzone-input"
                          type="file"
                          accept={SUBTITLE_ACCEPT}
                          disabled={isBusy}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            if (file) {
                              void handleSubtitleUpload(file, track.id);
                            }
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <Button
                        disabled={isBusy || isSubtitleBusyField(busyField, track.id)}
                        onClick={() => {
                          void handleRemoveSubtitle(track.id);
                        }}
                      >
                        {formatMessage("video.editor.actions.remove")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="chips-video-editor__group">
          <div className="chips-video-editor__group-head">
            <h2 className="chips-video-editor__group-title">{formatMessage("video.editor.meta.title")}</h2>
          </div>

          <div
            className="chips-video-editor__list"
            onBlur={(event) => {
              const nextFocused = event.relatedTarget instanceof Node ? event.relatedTarget : null;
              if (!event.currentTarget.contains(nextFocused)) {
                flushMetadataDraft();
              }
            }}
          >
            <div className="chips-video-editor__field-row">
              <span className="chips-video-editor__field-label">{formatMessage("video.editor.fields.video_title")}</span>
              <Input
                data-role="video-title-input"
                className="chips-video-editor__input"
                value={config.video_title}
                aria-label={formatMessage("video.editor.fields.video_title")}
                placeholder={formatMessage("video.editor.placeholders.video_title")}
                onChange={(event) => {
                  updateLocalConfig({ video_title: event.target.value });
                }}
              />
            </div>

            <div className="chips-video-editor__field-row">
              <span className="chips-video-editor__field-label">{formatMessage("video.editor.fields.creator")}</span>
              <Input
                data-role="creator-input"
                className="chips-video-editor__input"
                value={config.creator}
                aria-label={formatMessage("video.editor.fields.creator")}
                placeholder={formatMessage("video.editor.placeholders.creator")}
                onChange={(event) => {
                  updateLocalConfig({ creator: event.target.value });
                }}
              />
            </div>

            <div className="chips-video-editor__field-row">
              <span className="chips-video-editor__field-label">{formatMessage("video.editor.fields.publish_time")}</span>
              <Input
                data-role="publish-time-input"
                className="chips-video-editor__input"
                value={config.publish_time}
                aria-label={formatMessage("video.editor.fields.publish_time")}
                placeholder={formatMessage("video.editor.placeholders.publish_time")}
                onChange={(event) => {
                  updateLocalConfig({ publish_time: event.target.value });
                }}
              />
            </div>
          </div>
        </section>

        <section className="chips-video-editor__group">
          <div className="chips-video-editor__group-head">
            <h2 className="chips-video-editor__group-title">{formatMessage("video.editor.playback.title")}</h2>
          </div>

          <div
            className="chips-video-editor__list"
            onBlur={(event) => {
              const nextFocused = event.relatedTarget instanceof Node ? event.relatedTarget : null;
              if (!event.currentTarget.contains(nextFocused)) {
                flushMetadataDraft();
              }
            }}
          >
            <div className="chips-video-editor__switch-grid">
              <div className="chips-video-editor__switch-row">
                <span>{formatMessage("video.editor.playback.autoplay")}</span>
                <Switch
                  checked={config.playback.autoplay}
                  aria-label={formatMessage("video.editor.playback.autoplay")}
                  onChange={(checked) => {
                    handlePlaybackPatch({ autoplay: checked });
                  }}
                />
              </div>
              <div className="chips-video-editor__switch-row">
                <span>{formatMessage("video.editor.playback.loop")}</span>
                <Switch
                  checked={config.playback.loop}
                  aria-label={formatMessage("video.editor.playback.loop")}
                  onChange={(checked) => {
                    handlePlaybackPatch({ loop: checked });
                  }}
                />
              </div>
              <div className="chips-video-editor__switch-row">
                <span>{formatMessage("video.editor.playback.muted")}</span>
                <Switch
                  checked={config.playback.muted}
                  aria-label={formatMessage("video.editor.playback.muted")}
                  onChange={(checked) => {
                    handlePlaybackPatch({ muted: checked });
                  }}
                />
              </div>
            </div>

            <label className="chips-video-editor__field-row">
              <span className="chips-video-editor__field-label">{formatMessage("video.editor.playback.playback_rate")}</span>
              <InputNumber
                value={playbackRateDraft}
                min={0.25}
                max={4}
                step={0.25}
                aria-label={formatMessage("video.editor.playback.playback_rate")}
                onChange={(value) => {
                  setPlaybackRateDraft(value);
                  handlePlaybackPatch({ playback_rate: normalizePlaybackRate(value) });
                }}
                onBlur={() => {
                  const normalized = normalizePlaybackRate(playbackRateDraft);
                  setPlaybackRateDraft(normalized);
                  handlePlaybackPatch({ playback_rate: normalized });
                }}
              />
            </label>

            <label className="chips-video-editor__field-row">
              <span className="chips-video-editor__field-label">{formatMessage("video.editor.playback.start_time")}</span>
              <InputNumber
                value={startTimeDraft}
                min={0}
                step={1}
                aria-label={formatMessage("video.editor.playback.start_time")}
                onChange={(value) => {
                  setStartTimeDraft(value);
                  handlePlaybackPatch({ start_time: normalizeStartTime(value) });
                }}
                onBlur={() => {
                  const normalized = normalizeStartTime(startTimeDraft);
                  setStartTimeDraft(normalized);
                  handlePlaybackPatch({ start_time: normalized });
                }}
              />
            </label>
          </div>
        </section>
      </div>
    </form>
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
