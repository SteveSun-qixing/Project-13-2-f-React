import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Button, ConfigProvider } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import { appleTheme } from "@chips/ui";
import { createPortal, flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type {
  BasecardArchiveImportRequest,
  BasecardArchiveImportResult,
  BasecardResourceImportRequest,
  BasecardResourceImportResult,
  BasecardTiffToPngRequest,
  BasecardTiffToPngResult,
} from "../index";
import {
  defaultBasecardConfig,
  defaultLayoutOptions,
  normalizeBasecardConfig,
  type BasecardConfig,
  type GridMode,
  type ImageItem,
  type LayoutOptions,
  type LayoutType,
  type SingleAlignment,
} from "../schema/card-config";
import { formatMessage } from "../lib/messages";
import {
  cloneConfig,
  generateImageId,
  getEffectiveLayoutType,
  getInternalResourcePaths,
  getRemovedInternalResourcePaths,
  getSpacingMetrics,
  isTiffImageFile,
  normalizeRelativeCardResourcePath,
  sanitizeImportedFileName,
  toPngOutputPath,
  validateImageFormat,
  validateImageUrl,
} from "../shared/utils";

export interface BasecardEditorProps {
  initialConfig: BasecardConfig;
  onChange: (next: BasecardConfig) => void;
  resolveResourceUrl?: (resourcePath: string) => Promise<string>;
  releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
  importResource?: (
    input: BasecardResourceImportRequest,
  ) => Promise<BasecardResourceImportResult>;
  importArchiveBundle?: (
    input: BasecardArchiveImportRequest,
  ) => Promise<BasecardArchiveImportResult>;
  deleteResource?: (resourcePath: string) => Promise<void>;
  convertTiffToPng?: (
    input: BasecardTiffToPngRequest,
  ) => Promise<BasecardTiffToPngResult>;
}

type EditorRoot = HTMLElement & {
  __chipsDispose?: () => void;
};

type PreviewOrigin = "bridge" | "local" | "relative";

type DragOverlayState = {
  height: number;
  offsetX: number;
  offsetY: number;
  previewUrl: string;
  width: number;
};

type DragOverlayPosition = {
  clientX: number;
  clientY: number;
};

type PointerDragSession = {
  height: number;
  imageId: string;
  offsetX: number;
  offsetY: number;
  originIndex: number;
  previewUrl: string;
  startX: number;
  startY: number;
  started: boolean;
  width: number;
};

type GridLayoutMetrics = {
  gap: number;
  tileSize: number;
  width: number;
};

type GridSlot = {
  image?: ImageItem;
  key: string;
  kind: "add" | "image" | "placeholder";
};

type LayoutCardDefinition = {
  value: LayoutType;
  title: string;
  description: string;
  glyph: string;
};

const HISTORY_LIMIT = 100;
const INPUT_ACCEPT_VALUE = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/tiff,.tif,.tiff";
const IMAGE_GRID_COLUMNS = 3;
const IMAGE_GRID_GAP = 12;
const FALLBACK_TILE_SIZE = 96;

const EDITOR_STYLE_TEXT = `
html, body {
  margin: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  background:
    radial-gradient(circle at top, rgba(10, 132, 255, 0.08), transparent 48%),
    #ffffff;
}

.chips-image-editor {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  color: #1d1d1f;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(242, 242, 247, 0.95)),
    #ffffff;
  font: 14px/1.55 "SF Pro Text", "PingFang SC", sans-serif;
}

.chips-image-editor *,
.chips-image-editor *::before,
.chips-image-editor *::after {
  box-sizing: border-box;
}

.chips-image-editor__icon-button,
.chips-image-editor__action-button,
.chips-image-editor__ghost-button,
.chips-image-editor__mini-button,
.chips-image-editor__layout-card,
.chips-image-editor__align-button {
  appearance: none;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.92);
  color: inherit;
  font: inherit;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.chips-image-editor__icon-button,
.chips-image-editor__align-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  min-height: 38px;
  border-radius: 12px;
  cursor: pointer;
}

.chips-image-editor__icon-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.chips-image-editor__mini-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.chips-image-editor__action-button,
.chips-image-editor__ghost-button,
.chips-image-editor__mini-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 600;
}

.chips-image-editor__action-button {
  background: linear-gradient(135deg, #0a84ff, #0a84ff);
  border-color: rgba(10, 132, 255, 0.26);
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
}

.chips-image-editor__ghost-button {
  background: rgba(242, 242, 247, 0.94);
}

.chips-image-editor__mini-button {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 12px;
  background: rgba(242, 242, 247, 0.94);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.chips-image-editor__action-button:hover,
.chips-image-editor__ghost-button:hover,
.chips-image-editor__mini-button:hover:not(:disabled),
.chips-image-editor__icon-button:hover:not(:disabled),
.chips-image-editor__layout-card:hover:not(:disabled),
.chips-image-editor__align-button:hover:not(:disabled),
.chips-image-editor__select:hover,
.chips-image-editor__number-input:hover,
.chips-image-editor__text-input:hover,
.chips-image-editor__slider:hover {
  border-color: rgba(10, 132, 255, 0.42);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.10);
  transform: translateY(-1px);
}

.chips-image-editor__action-button:focus-visible,
.chips-image-editor__ghost-button:focus-visible,
.chips-image-editor__mini-button:focus-visible,
.chips-image-editor__icon-button:focus-visible,
.chips-image-editor__layout-card:focus-visible,
.chips-image-editor__align-button:focus-visible,
.chips-image-editor__select:focus-visible,
.chips-image-editor__number-input:focus-visible,
.chips-image-editor__text-input:focus-visible,
.chips-image-editor__slider:focus-visible {
  outline: none;
  border-color: rgba(10, 132, 255, 0.68);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.14);
}

.chips-image-editor__badge {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: #0a84ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.chips-image-editor__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 14px 128px;
  scroll-padding-bottom: 128px;
  scrollbar-gutter: stable;
}

.chips-image-editor__body::-webkit-scrollbar {
  width: 8px;
}

.chips-image-editor__body::-webkit-scrollbar-thumb {
  background: rgba(110, 110, 115, 0.48);
  border-radius: 999px;
}

.chips-image-editor__stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
}

.chips-image-editor__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(110, 110, 115, 0.18);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(242, 242, 247, 0.88)),
    #ffffff;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.08);
}

.chips-image-editor__section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.chips-image-editor__section-copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.chips-image-editor__section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chips-image-editor__section-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.chips-image-editor__section-hint {
  color: #6e6e73;
  font-size: 12px;
}

.chips-image-editor__dropzone {
  position: relative;
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 156px;
  padding: 18px;
  border: 1.5px dashed rgba(10, 132, 255, 0.38);
  border-radius: 24px;
  background:
    radial-gradient(circle at top, rgba(10, 132, 255, 0.13), transparent 55%),
    linear-gradient(180deg, rgba(242, 242, 247, 0.94), rgba(255, 255, 255, 0.98));
  text-align: center;
  cursor: pointer;
}

.chips-image-editor__dropzone[data-state="dragover"] {
  border-color: rgba(10, 132, 255, 0.54);
  background:
    radial-gradient(circle at top, rgba(10, 132, 255, 0.16), transparent 52%),
    linear-gradient(180deg, rgba(10, 132, 255, 0.07), rgba(255, 255, 255, 0.98));
}

.chips-image-editor__dropzone[data-state="uploading"] {
  cursor: progress;
}

.chips-image-editor__dropzone-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: rgba(10, 132, 255, 0.12);
  color: #0a84ff;
  font-size: 24px;
}

.chips-image-editor__dropzone-title {
  font-size: 15px;
  font-weight: 700;
}

.chips-image-editor__dropzone-description {
  color: #6e6e73;
}

.chips-image-editor__progress {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 82px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: #0a84ff;
  font-weight: 700;
}

.chips-image-editor__divider {
  display: flex;
  align-items: center;
  gap: 12px;
  color: rgba(110, 110, 115, 0.88);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.chips-image-editor__divider::before,
.chips-image-editor__divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(110, 110, 115, 0.45), transparent);
}

.chips-image-editor__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.chips-image-editor__row > * {
  min-width: 0;
}

.chips-image-editor__row--split {
  justify-content: space-between;
}

.chips-image-editor__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.chips-image-editor__field--full {
  grid-column: 1 / -1;
}

.chips-image-editor__field-label {
  color: #6e6e73;
  font-size: 12px;
  font-weight: 700;
}

.chips-image-editor__text-input,
.chips-image-editor__number-input,
.chips-image-editor__select {
  width: 100%;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(110, 110, 115, 0.22);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.94);
  color: inherit;
  font: inherit;
}

.chips-image-editor__details-form {
  display: grid;
  gap: 12px;
  margin-top: 14px;
  padding: 14px;
  border: 1px solid rgba(110, 110, 115, 0.18);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(242, 242, 247, 0.88)),
    #ffffff;
}

.chips-image-editor__details-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.chips-image-editor__details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.chips-image-editor__details-field {
  display: grid;
  gap: 8px;
}

.chips-image-editor__details-control {
  display: grid;
  gap: 8px;
}

.chips-image-editor__details-source {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: rgba(10, 132, 255, 0.1);
  color: #0a84ff;
  font-size: 12px;
  font-weight: 700;
}

.chips-image-editor__details-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.chips-image-editor__text-input::placeholder {
  color: rgba(110, 110, 115, 0.92);
}

.chips-image-editor__url-field {
  flex: 1 1 260px;
}

.chips-image-editor__slider {
  width: 100%;
}

.chips-image-editor__hint-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 16px;
  background: rgba(10, 132, 255, 0.08);
  color: #5e5ce6;
  font-size: 13px;
  font-weight: 600;
}

.chips-image-editor__layout-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.chips-image-editor__layout-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  min-height: 120px;
  padding: 14px;
  border-radius: 18px;
  text-align: left;
  cursor: pointer;
}

.chips-image-editor__layout-card[data-active="true"] {
  border-color: rgba(10, 132, 255, 0.52);
  background:
    radial-gradient(circle at top, rgba(10, 132, 255, 0.12), transparent 55%),
    rgba(10, 132, 255, 0.06);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.1);
}

.chips-image-editor__layout-card:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.chips-image-editor__layout-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 18px;
}

.chips-image-editor__layout-title {
  font-weight: 700;
}

.chips-image-editor__layout-description {
  color: #6e6e73;
  font-size: 12px;
}

.chips-image-editor__option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px;
}

.chips-image-editor__choice-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.chips-image-editor__choice-button {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  min-height: 84px;
  padding: 12px 14px;
  border-radius: 16px;
  text-align: left;
}

.chips-image-editor__choice-button[data-active="true"] {
  border-color: rgba(10, 132, 255, 0.48);
  background: rgba(10, 132, 255, 0.06);
  color: #0a84ff;
}

.chips-image-editor__choice-title {
  font-weight: 700;
}

.chips-image-editor__choice-description {
  color: #6e6e73;
  font-size: 12px;
  line-height: 1.5;
}

.chips-image-editor__align-group {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chips-image-editor__align-button[data-active="true"] {
  border-color: rgba(10, 132, 255, 0.48);
  background: rgba(10, 132, 255, 0.06);
  color: #0a84ff;
}

.chips-image-editor__image-grid-shell {
  position: relative;
  width: 100%;
}

.chips-image-editor__image-grid {
  position: relative;
  width: 100%;
  min-height: 96px;
}

.chips-image-editor__grid-slot {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--chips-image-grid-tile-size, 96px);
  height: var(--chips-image-grid-tile-size, 96px);
  transform: translate3d(0, 0, 0);
  transition:
    transform 0.26s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease;
  will-change: transform;
}

.chips-image-editor__grid-slot[data-kind="placeholder"] {
  transition:
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease;
}

.chips-image-editor__image-tile,
.chips-image-editor__add-tile,
.chips-image-editor__image-placeholder-tile {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid rgba(110, 110, 115, 0.2);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(242, 242, 247, 0.96)),
    rgba(255, 255, 255, 0.96);
  content-visibility: auto;
  contain-intrinsic-size: 120px;
}

.chips-image-editor__image-tile {
  padding: 0;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
  touch-action: none;
  transition:
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease,
    opacity 0.16s ease;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
}

.chips-image-editor__image-tile[data-dragging="true"] {
  opacity: 0.04;
}

.chips-image-editor__image-tile:active {
  cursor: grabbing;
}

.chips-image-editor__image-tile[data-dragging="false"]:hover {
  border-color: rgba(10, 132, 255, 0.28);
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.1);
}

.chips-image-editor__image-tile[data-selected="true"] {
  border-color: rgba(10, 132, 255, 0.62);
  box-shadow:
    0 0 0 3px rgba(10, 132, 255, 0.12),
    0 14px 28px rgba(0, 0, 0, 0.1);
}

.chips-image-editor__image-tile:focus-visible {
  outline: none;
  border-color: rgba(10, 132, 255, 0.68);
  box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.14);
}

.chips-image-editor__image-placeholder-tile {
  border-style: dashed;
  border-color: rgba(10, 132, 255, 0.42);
  background:
    linear-gradient(180deg, rgba(10, 132, 255, 0.06), rgba(10, 132, 255, 0.13)),
    rgba(10, 132, 255, 0.06);
  box-shadow: inset 0 0 0 1px rgba(10, 132, 255, 0.08);
  transform: scale(0.94);
}

.chips-image-editor__tile-media,
.chips-image-editor__tile-placeholder {
  display: block;
  width: 100%;
  height: 100%;
}

.chips-image-editor__tile-media img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chips-image-editor__tile-placeholder {
  display: grid;
  place-items: center;
  padding: 12px;
  color: #6e6e73;
  font-size: 12px;
  text-align: center;
}

.chips-image-editor__add-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  cursor: pointer;
  color: #6e6e73;
  background:
    linear-gradient(180deg, rgba(242, 242, 247, 0.96), rgba(229, 229, 234, 0.96)),
    rgba(229, 229, 234, 0.92);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.06);
}

.chips-image-editor__add-tile-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: rgba(110, 110, 115, 0.18);
  font-size: 28px;
  font-weight: 500;
}

.chips-image-editor__add-tile-label {
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.chips-image-editor__embedded-uploader {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 4px;
}

.chips-image-editor__delete-tray {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(calc(100% - 32px), 280px);
  min-height: 52px;
  padding: 0 16px;
  border: 1px solid rgba(255, 59, 48, 0.36);
  border-radius: 18px;
  background: rgba(255, 59, 48, 0.08);
  color: #ff3b30;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.16);
  transform: translate(-50%, 18px);
  opacity: 0;
  pointer-events: none;
  transition:
    opacity 0.18s ease,
    transform 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.chips-image-editor__delete-tray[data-active="true"] {
  opacity: 1;
  pointer-events: auto;
  transform: translate(-50%, 0);
}

.chips-image-editor__delete-tray[data-over="true"] {
  border-color: rgba(255, 59, 48, 0.52);
  background: rgba(255, 59, 48, 0.1);
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.22);
}

.chips-image-editor__drag-preview {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2147483647;
  width: 0;
  height: 0;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s ease;
  will-change: transform;
}

.chips-image-editor__drag-preview[data-active="true"] {
  opacity: 1;
}

.chips-image-editor__drag-preview-surface {
  overflow: hidden;
  border-radius: 10px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(242, 242, 247, 0.96)),
    rgba(255, 255, 255, 0.96);
  box-shadow: 0 18px 38px rgba(0, 0, 0, 0.24);
  border: 1px solid rgba(110, 110, 115, 0.18);
  transform: scale(1.02);
}

.chips-image-editor__drag-preview-surface img,
.chips-image-editor__drag-preview-placeholder {
  display: block;
  width: 100%;
  height: 100%;
}

.chips-image-editor__drag-preview-surface img {
  object-fit: cover;
}

.chips-image-editor__drag-preview-placeholder {
  display: grid;
  place-items: center;
  padding: 12px;
  color: #6e6e73;
  font-size: 12px;
  text-align: center;
}

.chips-image-editor__empty {
  display: grid;
  place-items: center;
  min-height: 180px;
  padding: 24px;
  border: 1px dashed rgba(110, 110, 115, 0.35);
  border-radius: 22px;
  background: rgba(242, 242, 247, 0.72);
  color: #6e6e73;
  text-align: center;
}

.chips-image-editor__message-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chips-image-editor__message {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 13px;
}

.chips-image-editor__message[data-tone="error"] {
  color: #ff3b30;
  background: rgba(255, 59, 48, 0.08);
}

@media (max-width: 880px) {
  .chips-image-editor__body {
    padding: 14px 14px 124px;
  }

  .chips-image-editor__section {
    padding: 16px;
    border-radius: 20px;
  }
}

@media (max-width: 640px) {
  .chips-image-editor__body {
    padding: 12px 12px 120px;
  }

  .chips-image-editor__section {
    padding: 14px;
    border-radius: 18px;
  }

  .chips-image-editor__section-header {
    gap: 10px;
  }

  .chips-image-editor__dropzone {
    min-height: 144px;
    padding: 16px;
  }

  .chips-image-editor__layout-grid,
  .chips-image-editor__option-grid,
  .chips-image-editor__choice-grid {
    grid-template-columns: 1fr;
  }
}
`;

function createObjectUrl(file: File): string {
  return URL.createObjectURL(file);
}

async function resolveResourceUrlWithRetry(
  resolveResourceUrl: ((resourcePath: string) => Promise<string>) | undefined,
  resourcePath: string,
): Promise<string> {
  if (!resolveResourceUrl) {
    return resourcePath;
  }

  try {
    return await resolveResourceUrl(resourcePath);
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 16));
    return resolveResourceUrl(resourcePath).catch(() => {
      throw firstError;
    });
  }
}

function arrayMove<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  const next = items.slice();
  const [item] = next.splice(fromIndex, 1);
  if (item === undefined) {
    return next;
  }
  next.splice(toIndex, 0, item);
  return next;
}

function stringifyConfig(config: BasecardConfig): string {
  return JSON.stringify(config);
}

function normalizeEditorConfig(input: BasecardConfig): BasecardConfig {
  return normalizeBasecardConfig(input as unknown as Record<string, unknown>);
}

function syncAvailablePath(path: string, occupied: Set<string>): string {
  const normalized = sanitizeImportedFileName(path);
  const dotIndex = normalized.lastIndexOf(".");
  const baseName = dotIndex > 0 ? normalized.slice(0, dotIndex) : normalized;
  const extension = dotIndex > 0 ? normalized.slice(dotIndex) : "";

  let candidate = normalized;
  let counter = 2;
  while (occupied.has(candidate)) {
    candidate = `${baseName}-${counter}${extension}`;
    counter += 1;
  }
  return candidate;
}

function getPreferredImagePath(file: File, occupiedPaths: Set<string>): string {
  const preferredPath = sanitizeImportedFileName(file.name);
  const normalizedPath = isTiffImageFile(file) ? toPngOutputPath(preferredPath) : preferredPath;
  return syncAvailablePath(normalizedPath, occupiedPaths);
}

function getPreferredSourcePath(file: File, preferredPath: string): string {
  return isTiffImageFile(file) ? sanitizeImportedFileName(file.name) : preferredPath;
}

function replaceResourcePath(
  config: BasecardConfig,
  fromPath: string,
  toPath: string,
): BasecardConfig {
  if (fromPath === toPath) {
    return config;
  }

  return {
    ...config,
    images: config.images.map((image) => {
      if (image.source !== "file" || image.file_path !== fromPath) {
        return image;
      }

      return {
        ...image,
        file_path: toPath,
      };
    }),
  };
}

function applySmartDefaults(config: BasecardConfig, previousImageCount: number): BasecardConfig {
  if (config.images.length <= 1) {
    if (previousImageCount !== 0) {
      return config;
    }

    return {
      ...config,
      layout_type: "single",
      layout_options: {
        ...config.layout_options,
        single_width_percent: 70,
        single_alignment: "center",
      },
    };
  }

  if (previousImageCount > 1 || config.layout_type !== "single") {
    return config;
  }

  return {
    ...config,
    layout_type: "grid",
    layout_options: {
      ...config.layout_options,
      grid_mode: "3x3",
      spacing_mode: "comfortable",
    },
  };
}

function LayoutCard(props: {
  definition: LayoutCardDefinition;
  active: boolean;
  disabled?: boolean;
  onSelect: (value: LayoutType) => void;
}) {
  const { definition, active, disabled = false, onSelect } = props;

  return (
    <button
      type="button"
      className="chips-image-editor__layout-card"
      data-active={active ? "true" : "false"}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          onSelect(definition.value);
        }
      }}
    >
      <span className="chips-image-editor__layout-glyph" aria-hidden="true">
        {definition.glyph}
      </span>
      <span className="chips-image-editor__layout-title">{definition.title}</span>
      <span className="chips-image-editor__layout-description">{definition.description}</span>
    </button>
  );
}

function ChoiceButton(props: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  const { active, title, description, onClick } = props;

  return (
    <button
      type="button"
      className="chips-image-editor__layout-card chips-image-editor__choice-button"
      data-active={active ? "true" : "false"}
      onClick={onClick}
    >
      <span className="chips-image-editor__choice-title">{title}</span>
      <span className="chips-image-editor__choice-description">{description}</span>
    </button>
  );
}

function ImageGridItem(props: {
  image: ImageItem;
  previewUrl: string;
  placeholderText: string;
  dragging: boolean;
  onPreviewError: (image: ImageItem) => void;
  onSelect: (imageId: string) => void;
  onPointerDown: (imageId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  selected: boolean;
  tileRef?: (node: HTMLDivElement | null) => void;
  style?: React.CSSProperties;
}) {
  const {
    image,
    previewUrl,
    placeholderText,
    dragging,
    onPreviewError,
    onSelect,
    onPointerDown,
    selected,
    tileRef,
    style,
  } = props;

  return (
    <div
      ref={tileRef}
      style={style}
      className="chips-image-editor__image-tile"
      data-dragging={dragging ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      role="button"
      tabIndex={0}
      onPointerDown={(event) => {
        onPointerDown(image.id, event);
      }}
      onClick={() => {
        onSelect(image.id);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(image.id);
        }
      }}
    >
      {previewUrl ? (
        <span className="chips-image-editor__tile-media">
          <img
            src={previewUrl}
            alt=""
            draggable={false}
            onError={() => {
              onPreviewError(image);
            }}
          />
        </span>
      ) : (
        <span className="chips-image-editor__tile-placeholder">{placeholderText}</span>
      )}
    </div>
  );
}

function ImagePlaceholderTile(props: { style?: React.CSSProperties }) {
  const { style } = props;
  return (
    <div
      style={style}
      className="chips-image-editor__image-placeholder-tile"
      aria-hidden="true"
    />
  );
}

function AddImageTile(props: {
  label: string;
  onClick: () => void;
  tileRef?: (node: HTMLButtonElement | null) => void;
  style?: React.CSSProperties;
}) {
  const { label, onClick, tileRef, style } = props;

  return (
    <button
      ref={tileRef}
      type="button"
      style={style}
      className="chips-image-editor__add-tile"
      onClick={onClick}
    >
      <span className="chips-image-editor__add-tile-icon" aria-hidden="true">
        +
      </span>
      <span className="chips-image-editor__add-tile-label">{label}</span>
    </button>
  );
}

function clampInsertIndex(value: number, max: number): number {
  return Math.max(0, Math.min(value, max));
}

function getGridLayoutMetrics(width: number): GridLayoutMetrics {
  const normalizedWidth =
    Number.isFinite(width) && width > 0
      ? width
      : FALLBACK_TILE_SIZE * IMAGE_GRID_COLUMNS + IMAGE_GRID_GAP * (IMAGE_GRID_COLUMNS - 1);
  const tileSize = Math.max(
    72,
    (normalizedWidth - IMAGE_GRID_GAP * (IMAGE_GRID_COLUMNS - 1)) / IMAGE_GRID_COLUMNS,
  );

  return {
    gap: IMAGE_GRID_GAP,
    tileSize,
    width: normalizedWidth,
  };
}

function getGridSlotPosition(index: number, metrics: GridLayoutMetrics): { x: number; y: number } {
  const row = Math.floor(index / IMAGE_GRID_COLUMNS);
  const column = index % IMAGE_GRID_COLUMNS;

  return {
    x: column * (metrics.tileSize + metrics.gap),
    y: row * (metrics.tileSize + metrics.gap),
  };
}

function getGridHeight(slotCount: number, metrics: GridLayoutMetrics): number {
  if (slotCount <= 0) {
    return 0;
  }

  const rowCount = Math.ceil(slotCount / IMAGE_GRID_COLUMNS);
  return rowCount * metrics.tileSize + Math.max(0, rowCount - 1) * metrics.gap;
}

function ImageCardEditor(props: BasecardEditorProps) {
  const addInputId = useId();
  const initial = normalizeEditorConfig(props.initialConfig);
  const [config, setConfig] = useState<BasecardConfig>(initial);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [dragPreviewIndex, setDragPreviewIndex] = useState<number | null>(null);
  const [dragOverlay, setDragOverlay] = useState<DragOverlayState | null>(null);
  const [isDeleteZoneOver, setIsDeleteZoneOver] = useState(false);
  const [showUploader, setShowUploader] = useState(initial.images.length === 0);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(initial.images[0]?.id ?? null);
  const [urlInput, setUrlInput] = useState("");
  const [replaceUrlInput, setReplaceUrlInput] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<string[]>([]);
  const configRef = useRef(config);
  const previewUrlsRef = useRef(previewUrls);
  const previewOriginsRef = useRef(new Map<string, PreviewOrigin>());
  const importedFilesRef = useRef(new Map<string, File>());
  const historyRef = useRef<{ undo: BasecardConfig[]; redo: BasecardConfig[] }>({
    undo: [],
    redo: [],
  });
  const resolvingPathsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const uploaderRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const addTileRef = useRef<HTMLButtonElement | null>(null);
  const deleteTrayRef = useRef<HTMLDivElement | null>(null);
  const dragPreviewRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<PointerDragSession | null>(null);
  const draggingImageIdRef = useRef<string | null>(null);
  const dragPreviewIndexRef = useRef<number | null>(null);
  const deleteZoneOverRef = useRef(false);
  const dragOverlayPositionRef = useRef<DragOverlayPosition | null>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  useEffect(() => {
    draggingImageIdRef.current = draggingImageId;
  }, [draggingImageId]);

  useEffect(() => {
    dragPreviewIndexRef.current = dragPreviewIndex;
  }, [dragPreviewIndex]);

  useEffect(() => {
    const position = dragOverlayPositionRef.current;
    if (!dragOverlay || !position) {
      return;
    }

    updateDragPreviewPosition(position.clientX, position.clientY);
  }, [dragOverlay]);

  useEffect(() => {
    if (showUploader) {
      uploaderRef.current?.scrollIntoView?.({
        block: "end",
        behavior: "smooth",
      });
    }
  }, [showUploader]);

  useLayoutEffect(() => {
    const node = gridRef.current;
    if (!node) {
      return;
    }

    const measure = (): void => {
      const nextWidth = node.getBoundingClientRect().width;
      setGridWidth((current) => {
        if (Math.abs(current - nextWidth) < 0.5) {
          return current;
        }
        return nextWidth;
      });
    };

    measure();

    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(() => {
        measure();
      });
      observer.observe(node);
      return () => {
        observer.disconnect();
      };
    }

    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
    };
  }, [config.images.length, draggingImageId]);

  function setPreviewUrlForPath(path: string, url: string, origin: PreviewOrigin): void {
    setPreviewUrls((current) => {
      if (current[path] === url) {
        return current;
      }

      const next = {
        ...current,
        [path]: url,
      };
      previewUrlsRef.current = next;
      return next;
    });
    previewOriginsRef.current.set(path, origin);
  }

  function releasePreviewUrl(path: string): void {
    const currentUrl = previewUrlsRef.current[path];
    const origin = previewOriginsRef.current.get(path);

    if (currentUrl) {
      if (origin === "local") {
        URL.revokeObjectURL(currentUrl);
      } else if (origin === "bridge") {
        void Promise.resolve(props.releaseResourceUrl?.(path)).catch(() => undefined);
      }
    }

    previewOriginsRef.current.delete(path);
    setPreviewUrls((current) => {
      if (!(path in current)) {
        return current;
      }

      const next = { ...current };
      delete next[path];
      previewUrlsRef.current = next;
      return next;
    });
  }

  function releaseAllPreviewUrls(): void {
    for (const path of Object.keys(previewUrlsRef.current)) {
      releasePreviewUrl(path);
    }
  }

  function emitMessages(nextMessages: string[]): void {
    setMessages(nextMessages.filter((message) => message.trim().length > 0));
  }

  function setDeleteZoneState(next: boolean): void {
    deleteZoneOverRef.current = next;
    setIsDeleteZoneOver(next);
  }

  function cloneCurrentConfig(): BasecardConfig {
    return cloneConfig(configRef.current);
  }

  async function importFileToCardRoot(
    file: File,
    occupiedPaths: Set<string>,
  ): Promise<{ resourcePath: string; previewFile?: File }> {
    if (!validateImageFormat(file.type) && !isTiffImageFile(file)) {
      throw new Error(formatMessage("error.unsupported_format"));
    }

    const preferredPath = getPreferredImagePath(file, occupiedPaths);
    let resourcePath = preferredPath;

    if (props.importResource) {
      const result = await props.importResource({
        file,
        preferredPath: getPreferredSourcePath(file, preferredPath),
      });
      resourcePath = normalizeRelativeCardResourcePath(result.path) ?? preferredPath;
    }

    if (isTiffImageFile(file)) {
      if (!props.importResource) {
        throw new Error(formatMessage("error.import_resource_unavailable"));
      }

      if (!props.convertTiffToPng) {
        throw new Error(formatMessage("error.tiff_conversion_unavailable"));
      }

      const outputPath = syncAvailablePath(toPngOutputPath(resourcePath), occupiedPaths);
      const converted = await props.convertTiffToPng({
        resourcePath,
        outputPath,
        overwrite: false,
      });
      const convertedPath = normalizeRelativeCardResourcePath(converted.path) ?? outputPath;
      if (resourcePath !== convertedPath) {
        await props.deleteResource?.(resourcePath).catch(() => undefined);
      }
      resourcePath = convertedPath;
    }

    occupiedPaths.add(resourcePath);
    if (!isTiffImageFile(file)) {
      importedFilesRef.current.set(resourcePath, file);
    }

    await ensurePreviewForPath(resourcePath, isTiffImageFile(file) ? undefined : file);

    return {
      resourcePath,
      previewFile: isTiffImageFile(file) ? undefined : file,
    };
  }

  function rewriteConfigResourcePath(fromPath: string, toPath: string): void {
    const rewritten = normalizeEditorConfig(replaceResourcePath(cloneCurrentConfig(), fromPath, toPath));
    if (stringifyConfig(rewritten) === stringifyConfig(configRef.current)) {
      return;
    }

    const previousConfig = cloneCurrentConfig();
    configRef.current = rewritten;
    setConfig(rewritten);
    props.onChange(cloneConfig(rewritten));
    void syncResourceChain(previousConfig, rewritten);
  }

  async function resolvePreviewUrl(
    resourcePath: string,
    importedFile?: File,
  ): Promise<{ path: string; url: string; origin: PreviewOrigin }> {
    if (props.resolveResourceUrl) {
      try {
        return {
          path: resourcePath,
          url: await resolveResourceUrlWithRetry(props.resolveResourceUrl, resourcePath),
          origin: "bridge",
        };
      } catch (error) {
        if (importedFile && props.importResource) {
          const reimported = await props.importResource({
            file: importedFile,
            preferredPath: resourcePath,
          });
          const normalizedPath =
            normalizeRelativeCardResourcePath(reimported.path) ?? resourcePath;
          importedFilesRef.current.set(normalizedPath, importedFile);
          if (normalizedPath !== resourcePath) {
            rewriteConfigResourcePath(resourcePath, normalizedPath);
          }

          try {
            return {
              path: normalizedPath,
              url: await resolveResourceUrlWithRetry(props.resolveResourceUrl, normalizedPath),
              origin: "bridge",
            };
          } catch {
            return {
              path: normalizedPath,
              url: createObjectUrl(importedFile),
              origin: "local",
            };
          }
        }

        if (!importedFile) {
          throw error;
        }
      }
    }

    if (importedFile) {
      return {
        path: resourcePath,
        url: createObjectUrl(importedFile),
        origin: "local",
      };
    }

    return {
      path: resourcePath,
      url: resourcePath,
      origin: "relative",
    };
  }

  async function ensurePreviewForPath(
    rawResourcePath: string,
    importedFile?: File,
  ): Promise<void> {
    const resourcePath = normalizeRelativeCardResourcePath(rawResourcePath);
    if (!resourcePath) {
      return;
    }

    if (previewUrlsRef.current[resourcePath] || resolvingPathsRef.current.has(resourcePath)) {
      return;
    }

    resolvingPathsRef.current.add(resourcePath);
    try {
      const preview = await resolvePreviewUrl(
        resourcePath,
        importedFile ?? importedFilesRef.current.get(resourcePath),
      );
      if (!mountedRef.current) {
        if (preview.origin === "local") {
          URL.revokeObjectURL(preview.url);
        } else if (preview.origin === "bridge") {
          void Promise.resolve(props.releaseResourceUrl?.(preview.path)).catch(() => undefined);
        }
        return;
      }

      const currentPaths = new Set(getInternalResourcePaths(configRef.current));
      if (!currentPaths.has(preview.path)) {
        if (preview.origin === "local") {
          URL.revokeObjectURL(preview.url);
        } else if (preview.origin === "bridge") {
          void Promise.resolve(props.releaseResourceUrl?.(preview.path)).catch(() => undefined);
        }
        return;
      }

      setPreviewUrlForPath(preview.path, preview.url, preview.origin);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitMessages([formatMessage("error.image_not_found", { file: resourcePath }), message]);
    } finally {
      resolvingPathsRef.current.delete(resourcePath);
    }
  }

  async function syncResourceChain(previous: BasecardConfig, next: BasecardConfig): Promise<void> {
    const nextPaths = new Set(getInternalResourcePaths(next));
    const removedPaths = getRemovedInternalResourcePaths(previous, next);

    for (const removedPath of removedPaths) {
      releasePreviewUrl(removedPath);
      if (props.deleteResource) {
        await props.deleteResource(removedPath).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          emitMessages([message]);
        });
      }
    }

    for (const existingPath of Object.keys(previewUrlsRef.current)) {
      if (!nextPaths.has(existingPath)) {
        releasePreviewUrl(existingPath);
      }
    }

    for (const resourcePath of nextPaths) {
      await ensurePreviewForPath(resourcePath);
    }
  }

  async function refreshPreview(image: ImageItem): Promise<void> {
    if (image.source !== "file") {
      return;
    }

    const resourcePath = normalizeRelativeCardResourcePath(image.file_path);
    if (!resourcePath) {
      return;
    }

    releasePreviewUrl(resourcePath);
    emitMessages([]);
    await ensurePreviewForPath(resourcePath, importedFilesRef.current.get(resourcePath));
  }

  function commitConfigUpdate(
    nextInput: BasecardConfig,
    options?: { pushHistory?: boolean },
  ): void {
    const previousConfig = cloneCurrentConfig();
    const nextConfig = normalizeEditorConfig(nextInput);
    if (stringifyConfig(previousConfig) === stringifyConfig(nextConfig)) {
      return;
    }

    if (options?.pushHistory) {
      historyRef.current.undo.push(previousConfig);
      if (historyRef.current.undo.length > HISTORY_LIMIT) {
        historyRef.current.undo.shift();
      }
      historyRef.current.redo = [];
    }

    configRef.current = nextConfig;
    setConfig(nextConfig);

    props.onChange(cloneConfig(nextConfig));
    void syncResourceChain(previousConfig, nextConfig);
  }

  function selectImage(imageId: string | null): void {
    setSelectedImageId(imageId);
    setReplaceUrlInput("");
  }

  function updateImageFields(
    imageId: string,
    patch: Partial<Pick<ImageItem, "alt" | "title">>,
  ): void {
    const nextConfig = cloneCurrentConfig();
    nextConfig.images = nextConfig.images.map((image) => (
      image.id === imageId
        ? {
            ...image,
            ...patch,
          }
        : image
    ));
    commitConfigUpdate(nextConfig, { pushHistory: true });
  }

  function updateLayoutOptions(nextOptions: Partial<LayoutOptions>): void {
    const nextConfig = cloneCurrentConfig();
    nextConfig.layout_options = {
      ...defaultLayoutOptions,
      ...nextConfig.layout_options,
      ...nextOptions,
    };
    commitConfigUpdate(nextConfig, { pushHistory: true });
  }

  function handleUndo(): void {
    const nextConfig = historyRef.current.undo.pop();
    if (!nextConfig) {
      return;
    }

    const currentConfig = cloneCurrentConfig();
    historyRef.current.redo.push(currentConfig);
    configRef.current = cloneConfig(nextConfig);
    setConfig(configRef.current);
    setShowUploader(configRef.current.images.length === 0);
    setSelectedImageId(configRef.current.images[0]?.id ?? null);
    props.onChange(cloneConfig(configRef.current));
    void syncResourceChain(currentConfig, configRef.current);
  }

  function handleRedo(): void {
    const nextConfig = historyRef.current.redo.pop();
    if (!nextConfig) {
      return;
    }

    const currentConfig = cloneCurrentConfig();
    historyRef.current.undo.push(currentConfig);
    configRef.current = cloneConfig(nextConfig);
    setConfig(configRef.current);
    setShowUploader(configRef.current.images.length === 0);
    setSelectedImageId(configRef.current.images[0]?.id ?? null);
    props.onChange(cloneConfig(configRef.current));
    void syncResourceChain(currentConfig, configRef.current);
  }

  async function importFiles(files: readonly File[]): Promise<void> {
    const currentConfig = cloneCurrentConfig();
    const workingFiles = files;
    if (workingFiles.length === 0) {
      return;
    }

    const occupiedPaths = new Set(getInternalResourcePaths(currentConfig));

    const nextMessages: string[] = [];
    const importedImages: ImageItem[] = [];
    setIsUploading(true);
    setUploadProgress(0);

    for (let index = 0; index < workingFiles.length; index += 1) {
      const file = workingFiles[index];
      if (!file) {
        continue;
      }

      try {
        const { resourcePath } = await importFileToCardRoot(file, occupiedPaths);

        importedImages.push({
          id: generateImageId(),
          source: "file",
          file_path: resourcePath,
          alt: "",
          title: "",
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        nextMessages.push(`${file.name}: ${formatMessage("error.upload_failed")} (${message})`);
      } finally {
        setUploadProgress(Math.round(((index + 1) / workingFiles.length) * 100));
      }
    }

    setIsUploading(false);
    setUploadProgress(0);
    emitMessages(nextMessages);

    if (importedImages.length === 0) {
      return;
    }

    const nextConfig = cloneCurrentConfig();
    const previousCount = nextConfig.images.length;
    nextConfig.images = nextConfig.images.concat(importedImages);
    const finalizedConfig = applySmartDefaults(nextConfig, previousCount);
    commitConfigUpdate(finalizedConfig, { pushHistory: true });
    setSelectedImageId(importedImages[0]?.id ?? finalizedConfig.images[0]?.id ?? null);
    setShowUploader(false);
  }

  function handleAddByUrl(): void {
    const trimmedUrl = urlInput.trim();
    if (!trimmedUrl) {
      return;
    }

    if (!validateImageUrl(trimmedUrl)) {
      emitMessages([formatMessage("error.invalid_url")]);
      return;
    }

    const nextConfig = cloneCurrentConfig();
    const previousCount = nextConfig.images.length;
    nextConfig.images = nextConfig.images.concat({
      id: generateImageId(),
      source: "url",
      url: trimmedUrl,
      alt: "",
      title: "",
    });
    const finalizedConfig = applySmartDefaults(nextConfig, previousCount);
    commitConfigUpdate(finalizedConfig, { pushHistory: true });
    setSelectedImageId(finalizedConfig.images[finalizedConfig.images.length - 1]?.id ?? null);
    setUrlInput("");
    setShowUploader(false);
    emitMessages([]);
  }

  function handleRemoveImage(imageId: string): void {
    const nextConfig = cloneCurrentConfig();
    nextConfig.images = nextConfig.images.filter((image) => image.id !== imageId);
    commitConfigUpdate(nextConfig, { pushHistory: true });
    if (selectedImageId === imageId) {
      setSelectedImageId(nextConfig.images[0]?.id ?? null);
      setReplaceUrlInput("");
    }
    if (nextConfig.images.length === 0) {
      setShowUploader(true);
    }
  }

  function handleClearAll(): void {
    const nextConfig = cloneCurrentConfig();
    nextConfig.images = [];
    commitConfigUpdate(nextConfig, { pushHistory: true });
    setSelectedImageId(null);
    setReplaceUrlInput("");
    setShowUploader(true);
  }

  function handleMoveImageToIndex(imageId: string, targetIndex: number): void {
    const nextConfig = cloneCurrentConfig();
    const currentIndex = nextConfig.images.findIndex((image) => image.id === imageId);
    if (currentIndex === -1 || currentIndex === targetIndex) {
      return;
    }

    nextConfig.images = arrayMove(
      nextConfig.images,
      currentIndex,
      clampInsertIndex(targetIndex, nextConfig.images.length - 1),
    );
    commitConfigUpdate(nextConfig, { pushHistory: true });
  }

  async function handleReplaceWithFiles(imageId: string, files: readonly File[]): Promise<void> {
    const file = files[0];
    if (!file) {
      return;
    }

    const currentConfig = cloneCurrentConfig();
    const targetImage = currentConfig.images.find((image) => image.id === imageId);
    if (!targetImage) {
      return;
    }

    const occupiedPaths = new Set(
      getInternalResourcePaths(currentConfig).filter((path) => path !== targetImage.file_path),
    );
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const { resourcePath } = await importFileToCardRoot(file, occupiedPaths);
      const nextConfig = cloneCurrentConfig();
      nextConfig.images = nextConfig.images.map((image) => (
        image.id === imageId
          ? {
              ...image,
              source: "file",
              file_path: resourcePath,
              url: undefined,
            }
          : image
      ));
      commitConfigUpdate(nextConfig, { pushHistory: true });
      setSelectedImageId(imageId);
      setReplaceUrlInput("");
      emitMessages([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emitMessages([`${file.name}: ${formatMessage("error.replace_failed")} (${message})`]);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }

  function handleReplaceWithUrl(imageId: string): void {
    const trimmedUrl = replaceUrlInput.trim();
    if (!trimmedUrl) {
      return;
    }

    if (!validateImageUrl(trimmedUrl)) {
      emitMessages([formatMessage("error.invalid_url")]);
      return;
    }

    const nextConfig = cloneCurrentConfig();
    nextConfig.images = nextConfig.images.map((image) => (
      image.id === imageId
        ? {
            ...image,
            source: "url",
            file_path: undefined,
            url: trimmedUrl,
          }
        : image
    ));
    commitConfigUpdate(nextConfig, { pushHistory: true });
    setSelectedImageId(imageId);
    setReplaceUrlInput("");
    emitMessages([]);
  }

  function setTileRef(imageId: string, node: HTMLDivElement | null): void {
    if (node) {
      tileRefs.current.set(imageId, node);
      return;
    }

    tileRefs.current.delete(imageId);
  }

  function updateDragPreviewPosition(clientX: number, clientY: number): void {
    const session = dragSessionRef.current;
    const node = dragPreviewRef.current;
    if (!session || !node) {
      return;
    }

    dragOverlayPositionRef.current = {
      clientX,
      clientY,
    };
    node.style.transform = `translate3d(${clientX - session.offsetX}px, ${clientY - session.offsetY}px, 0)`;
  }

  function getPreviewIndexFromPointer(clientX: number, clientY: number): number | null {
    const draggingId = draggingImageIdRef.current;
    const session = dragSessionRef.current;
    if (!draggingId || !session) {
      return null;
    }

    const visibleImages = configRef.current.images.filter((image) => image.id !== draggingId);
    const grid = gridRef.current;
    const addTile = addTileRef.current;
    if (addTile) {
      const rect = addTile.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
        return visibleImages.length;
      }
    }

    if (grid) {
      const rect = grid.getBoundingClientRect();
      if (rect.width > 0) {
        const metrics = getGridLayoutMetrics(rect.width);
        const draggedCenterX = clientX - session.offsetX + session.width / 2 - rect.left;
        const draggedCenterY = clientY - session.offsetY + session.height / 2 - rect.top;
        let nearestIndex = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;

        for (let index = 0; index <= visibleImages.length; index += 1) {
          const slot = getGridSlotPosition(index, metrics);
          const centerX = slot.x + metrics.tileSize / 2;
          const centerY = slot.y + metrics.tileSize / 2;
          const distance = Math.hypot(draggedCenterX - centerX, draggedCenterY - centerY);

          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = index;
          }
        }

        return clampInsertIndex(nearestIndex, visibleImages.length);
      }
    }

    let nearestIndex: number | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < visibleImages.length; index += 1) {
      const image = visibleImages[index];
      if (!image) {
        continue;
      }

      const tile = tileRefs.current.get(image.id);
      if (!tile) {
        continue;
      }

      const rect = tile.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const distance = Math.hypot(clientX - centerX, clientY - centerY);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }

    return nearestIndex;
  }

  function handlePointerMove(event: PointerEvent): void {
    const session = dragSessionRef.current;
    if (!session) {
      return;
    }

    const deltaX = event.clientX - session.startX;
    const deltaY = event.clientY - session.startY;

    if (!session.started) {
      if (Math.hypot(deltaX, deltaY) < 6) {
        return;
      }

      session.started = true;
      draggingImageIdRef.current = session.imageId;
      dragPreviewIndexRef.current = session.originIndex;
      setDraggingImageId(session.imageId);
      setDragPreviewIndex(session.originIndex);
      setDragOverlay({
        height: session.height,
        offsetX: session.offsetX,
        offsetY: session.offsetY,
        previewUrl: session.previewUrl,
        width: session.width,
      });
      dragOverlayPositionRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };
    }

    event.preventDefault();
    updateDragPreviewPosition(event.clientX, event.clientY);

    const deleteTray = deleteTrayRef.current;
    const isDeleteTarget =
      deleteTray !== null &&
      (() => {
        const rect = deleteTray.getBoundingClientRect();
        return (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      })();

    setDeleteZoneState(isDeleteTarget);
    if (isDeleteTarget) {
      return;
    }

    const nextIndex = getPreviewIndexFromPointer(event.clientX, event.clientY);
    if (nextIndex !== null && nextIndex !== dragPreviewIndexRef.current) {
      dragPreviewIndexRef.current = nextIndex;
      setDragPreviewIndex(nextIndex);
    }
  }

  function finishPointerDrag(clientX: number, clientY: number): void {
    const session = dragSessionRef.current;
    const previewIndex = dragPreviewIndexRef.current;
    const shouldDelete = deleteZoneOverRef.current;

    dragSessionRef.current = null;
    draggingImageIdRef.current = null;
    dragPreviewIndexRef.current = null;
    dragOverlayPositionRef.current = null;
    setDraggingImageId(null);
    setDragPreviewIndex(null);
    setDragOverlay(null);
    setDeleteZoneState(false);

    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerUp);
    window.removeEventListener("pointercancel", handlePointerCancel);

    if (!session || !session.started) {
      return;
    }

    if (shouldDelete) {
      handleRemoveImage(session.imageId);
      return;
    }

    const nextIndex = previewIndex ?? getPreviewIndexFromPointer(clientX, clientY);
    if (nextIndex !== null && nextIndex !== session.originIndex) {
      handleMoveImageToIndex(session.imageId, nextIndex);
    }
  }

  function handlePointerUp(event: PointerEvent): void {
    finishPointerDrag(event.clientX, event.clientY);
  }

  function handlePointerCancel(): void {
    finishPointerDrag(-1, -1);
  }

  function handleTilePointerDown(imageId: string, event: React.PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0 || event.pointerType === "touch") {
      return;
    }

    event.preventDefault();
    const originIndex = configRef.current.images.findIndex((image) => image.id === imageId);
    if (originIndex === -1) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragSessionRef.current = {
      height: rect.height,
      imageId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originIndex,
      previewUrl:
        configRef.current.images[originIndex]?.source === "url"
          ? configRef.current.images[originIndex]?.url ?? ""
          : previewUrlsRef.current[configRef.current.images[originIndex]?.file_path ?? ""] ?? "",
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      width: rect.width,
    };
    setDeleteZoneState(false);

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
  }

  function handleLayoutTypeChange(layoutType: LayoutType): void {
    if (configRef.current.images.length > 1 && layoutType === "single") {
      return;
    }

    const nextConfig = cloneCurrentConfig();
    nextConfig.layout_type = layoutType;
    commitConfigUpdate(nextConfig, { pushHistory: true });
  }

  function handleAddInputChange(event: React.ChangeEvent<HTMLInputElement>): void {
    const nextFiles = Array.from(event.target.files ?? []);
    event.target.value = "";
    void importFiles(nextFiles);
  }

  function handleKeydown(event: KeyboardEvent): void {
    const activeElement = document.activeElement;
    const inTextField =
      activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

    const isMac = navigator.platform.includes("Mac");
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    if (modKey && event.key.toLowerCase() === "z" && !event.shiftKey && !inTextField) {
      event.preventDefault();
      handleUndo();
      return;
    }

    if (
      ((modKey && event.key.toLowerCase() === "z" && event.shiftKey) ||
        (event.ctrlKey && event.key.toLowerCase() === "y")) &&
      !inTextField
    ) {
      event.preventDefault();
      handleRedo();
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    void syncResourceChain(defaultBasecardConfig, configRef.current);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      mountedRef.current = false;
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      releaseAllPreviewUrls();
    };
  }, []);

  const effectiveLayoutType = getEffectiveLayoutType(config);
  const layoutOptions = {
    ...defaultLayoutOptions,
    ...config.layout_options,
  };
  const hasMultipleImages = config.images.length > 1;
  const spacing = getSpacingMetrics(layoutOptions);
  const layoutCards: LayoutCardDefinition[] = [
    {
      value: "grid",
      title: formatMessage("layout.grid"),
      description: formatMessage("layout.grid_desc"),
      glyph: "▦",
    },
    {
      value: "long-scroll",
      title: formatMessage("layout.long_scroll"),
      description: formatMessage("layout.long_scroll_desc"),
      glyph: "▤",
    },
    {
      value: "horizontal-scroll",
      title: formatMessage("layout.horizontal_scroll"),
      description: formatMessage("layout.horizontal_scroll_desc"),
      glyph: "▥",
    },
  ];
  const draggingIndex =
    draggingImageId !== null
      ? config.images.findIndex((image) => image.id === draggingImageId)
      : -1;
  const visibleImages =
    draggingIndex >= 0
      ? config.images.filter((image) => image.id !== draggingImageId)
      : config.images;
  const gridPreviewIndex =
    draggingIndex >= 0 && dragPreviewIndex !== null
      ? clampInsertIndex(dragPreviewIndex, visibleImages.length)
      : null;
  const gridMetrics = getGridLayoutMetrics(gridWidth);
  const dragPreviewPortalTarget =
    typeof document !== "undefined" ? document.body : null;
  const gridSlots: GridSlot[] = [];
  const selectedImage = config.images.find((image) => image.id === selectedImageId) ?? config.images[0];

  visibleImages.forEach((image, index) => {
    if (gridPreviewIndex === index) {
      gridSlots.push({
        key: `placeholder-${index}`,
        kind: "placeholder",
      });
    }

    gridSlots.push({
      image,
      key: image.id,
      kind: "image",
    });
  });

  if (gridPreviewIndex === visibleImages.length) {
    gridSlots.push({
      key: `placeholder-${visibleImages.length}`,
      kind: "placeholder",
    });
  }

  if (config.images.length > 0) {
    gridSlots.push({
      key: "add-tile",
      kind: "add",
    });
  }
  const gridHeight = getGridHeight(gridSlots.length, gridMetrics);

  return (
    <div className="chips-image-editor">
      <input
        id={addInputId}
        type="file"
        accept={INPUT_ACCEPT_VALUE}
        multiple={true}
        hidden={true}
        onChange={handleAddInputChange}
      />

      <div className="chips-image-editor__body">
        <div className="chips-image-editor__stack">
          {messages.length > 0 ? (
            <div className="chips-image-editor__message-list">
              {messages.map((message, index) => (
                <div
                  key={`${message}-${index}`}
                  className="chips-image-editor__message"
                  data-tone="error"
                >
                  {message}
                </div>
              ))}
            </div>
          ) : null}

          {config.images.length > 0 ? (
            <section className="chips-image-editor__section">
              <div className="chips-image-editor__section-header">
                <div className="chips-image-editor__section-copy">
                  <div className="chips-image-editor__section-title">{formatMessage("layout.title")}</div>
                  <div className="chips-image-editor__section-hint">
                    {!hasMultipleImages ? formatMessage("hint.single_auto") : formatMessage("layout.type")}
                  </div>
                </div>
              </div>

              {hasMultipleImages ? (
                <div className="chips-image-editor__layout-grid">
                  {layoutCards.map((definition) => (
                    <LayoutCard
                      key={definition.value}
                      definition={definition}
                      active={config.layout_type === definition.value}
                      onSelect={handleLayoutTypeChange}
                    />
                  ))}
                </div>
              ) : (
                <div className="chips-image-editor__hint-banner">
                  {formatMessage("hint.single_auto")}
                </div>
              )}

              <div className="chips-image-editor__option-grid">
                {effectiveLayoutType === "single" ? (
                  <>
                    <label className="chips-image-editor__field">
                      <span className="chips-image-editor__field-label">{formatMessage("layout.width_percent")}</span>
                      <input
                        className="chips-image-editor__slider"
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={layoutOptions.single_width_percent}
                        onChange={(event) => {
                          updateLayoutOptions({
                            single_width_percent: Number.parseInt(event.target.value, 10),
                          });
                        }}
                      />
                      <span className="chips-image-editor__section-hint">
                        {layoutOptions.single_width_percent}
                        {formatMessage("common.percent")}
                      </span>
                    </label>
                    <div className="chips-image-editor__field chips-image-editor__field--full">
                      <span className="chips-image-editor__field-label">{formatMessage("layout.alignment")}</span>
                      <div className="chips-image-editor__align-group">
                        {([
                          ["left", formatMessage("layout.align_left"), "≡"],
                          ["center", formatMessage("layout.align_center"), "≣"],
                          ["right", formatMessage("layout.align_right"), "≢"],
                        ] as const).map(([value, label, glyph]) => (
                          <button
                            key={value}
                            type="button"
                            className="chips-image-editor__align-button"
                            data-active={
                              (layoutOptions.single_alignment ?? "center") === value
                                ? "true"
                                : "false"
                            }
                            title={label}
                            onClick={() => {
                              updateLayoutOptions({
                                single_alignment: value as SingleAlignment,
                              });
                            }}
                          >
                            {glyph}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}

                {effectiveLayoutType === "grid" ? (
                  <>
                    <label className="chips-image-editor__field">
                      <span className="chips-image-editor__field-label">{formatMessage("layout.grid_mode")}</span>
                      <select
                        className="chips-image-editor__select"
                        value={layoutOptions.grid_mode}
                        onChange={(event) => {
                          updateLayoutOptions({
                            grid_mode: event.target.value as GridMode,
                          });
                        }}
                      >
                        <option value="2x2">{formatMessage("layout.grid_2x2")}</option>
                        <option value="3x3">{formatMessage("layout.grid_3x3")}</option>
                        <option value="3-column-infinite">{formatMessage("layout.grid_3col_infinite")}</option>
                      </select>
                    </label>
                    <label className="chips-image-editor__field">
                      <span className="chips-image-editor__field-label">{formatMessage("layout.spacing")}</span>
                      <div className="chips-image-editor__choice-grid">
                        <ChoiceButton
                          active={layoutOptions.spacing_mode === "none"}
                          title={formatMessage("layout.spacing_none")}
                          description={formatMessage("layout.spacing_none_desc")}
                          onClick={() => {
                            updateLayoutOptions({
                              spacing_mode: "none",
                            });
                          }}
                        />
                        <ChoiceButton
                          active={layoutOptions.spacing_mode !== "none"}
                          title={formatMessage("layout.spacing_comfortable")}
                          description={formatMessage("layout.spacing_comfortable_desc")}
                          onClick={() => {
                            updateLayoutOptions({
                              spacing_mode: "comfortable",
                            });
                          }}
                        />
                      </div>
                      <span className="chips-image-editor__section-hint">
                        {spacing.spacingMode === "none"
                          ? formatMessage("layout.spacing_none_desc")
                          : formatMessage("layout.spacing_comfortable_desc")}
                      </span>
                    </label>
                  </>
                ) : null}

                {effectiveLayoutType === "long-scroll" ? (
                  <>
                    <label className="chips-image-editor__field">
                      <span className="chips-image-editor__field-label">{formatMessage("layout.spacing")}</span>
                      <div className="chips-image-editor__choice-grid">
                        <ChoiceButton
                          active={layoutOptions.spacing_mode === "none"}
                          title={formatMessage("layout.spacing_none")}
                          description={formatMessage("layout.spacing_none_desc")}
                          onClick={() => {
                            updateLayoutOptions({
                              spacing_mode: "none",
                            });
                          }}
                        />
                        <ChoiceButton
                          active={layoutOptions.spacing_mode !== "none"}
                          title={formatMessage("layout.spacing_comfortable")}
                          description={formatMessage("layout.spacing_comfortable_desc")}
                          onClick={() => {
                            updateLayoutOptions({
                              spacing_mode: "comfortable",
                            });
                          }}
                        />
                      </div>
                    </label>
                  </>
                ) : null}

                {effectiveLayoutType === "horizontal-scroll" ? (
                  <label className="chips-image-editor__field">
                    <span className="chips-image-editor__field-label">{formatMessage("layout.spacing")}</span>
                    <div className="chips-image-editor__choice-grid">
                      <ChoiceButton
                        active={layoutOptions.spacing_mode === "none"}
                        title={formatMessage("layout.spacing_none")}
                        description={formatMessage("layout.spacing_none_desc")}
                        onClick={() => {
                          updateLayoutOptions({
                            spacing_mode: "none",
                          });
                        }}
                      />
                      <ChoiceButton
                        active={layoutOptions.spacing_mode !== "none"}
                        title={formatMessage("layout.spacing_comfortable")}
                        description={formatMessage("layout.spacing_comfortable_desc")}
                        onClick={() => {
                          updateLayoutOptions({
                            spacing_mode: "comfortable",
                          });
                        }}
                      />
                    </div>
                  </label>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="chips-image-editor__section">
            <div className="chips-image-editor__section-header">
              <div className="chips-image-editor__section-copy">
                <div className="chips-image-editor__section-title">
                  {formatMessage("editor.section_image_list")}
                </div>
                <div className="chips-image-editor__section-hint">
                  {config.images.length > 1
                    ? formatMessage("editor.drag_to_sort")
                    : ""}
                </div>
              </div>
              <div className="chips-image-editor__section-actions">
                {config.images.length > 0 ? (
                  <button
                    type="button"
                    className="chips-image-editor__icon-button"
                    aria-label={formatMessage("editor.clear_all")}
                    title={formatMessage("editor.clear_all")}
                    onClick={handleClearAll}
                  >
                    <DeleteOutlined aria-hidden={true} />
                  </button>
                ) : null}
              </div>
            </div>

            {config.images.length === 0 ? (
              <div className="chips-image-editor__empty">{formatMessage("editor.empty_hint")}</div>
            ) : (
              <div className="chips-image-editor__image-grid-shell">
                <div
                  ref={gridRef}
                  className="chips-image-editor__image-grid"
                  style={{
                    height: `${gridHeight}px`,
                    ["--chips-image-grid-tile-size" as string]: `${gridMetrics.tileSize}px`,
                  }}
                >
                  {gridSlots.map((slot, index) => {
                    const position = getGridSlotPosition(index, gridMetrics);
                    const slotStyle: React.CSSProperties = {
                      transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
                    };

                    if (slot.kind === "placeholder") {
                      return (
                        <div
                          key={slot.key}
                          className="chips-image-editor__grid-slot"
                          data-kind="placeholder"
                          style={slotStyle}
                        >
                          <ImagePlaceholderTile />
                        </div>
                      );
                    }

                    if (slot.kind === "add") {
                      return (
                        <div
                          key={slot.key}
                          className="chips-image-editor__grid-slot"
                          data-kind="add"
                          style={slotStyle}
                        >
                          <AddImageTile
                            label={formatMessage("editor.section_add_images")}
                            onClick={() => {
                              setShowUploader(true);
                            }}
                            tileRef={(node) => {
                              addTileRef.current = node;
                            }}
                          />
                        </div>
                      );
                    }

                    const image = slot.image;
                    if (!image) {
                      return null;
                    }

                    return (
                      <div
                        key={slot.key}
                        className="chips-image-editor__grid-slot"
                        data-kind="image"
                        style={slotStyle}
                      >
                        <ImageGridItem
                          image={image}
                          previewUrl={
                            image.source === "url"
                              ? image.url ?? ""
                              : previewUrls[image.file_path ?? ""] ?? ""
                          }
                          placeholderText={formatMessage("image.unavailable")}
                          dragging={draggingImageId === image.id}
                          onPreviewError={(imageItem) => {
                            void refreshPreview(imageItem);
                          }}
                          onSelect={selectImage}
                          onPointerDown={handleTilePointerDown}
                          selected={selectedImage?.id === image.id}
                          tileRef={(node) => {
                            setTileRef(image.id, node);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedImage ? (
              <div className="chips-image-editor__details-form">
                <div className="chips-image-editor__details-header">
                  <div className="chips-image-editor__section-copy">
                    <div className="chips-image-editor__section-title">
                      {formatMessage("editor.image_details_title")}
                    </div>
                    <div className="chips-image-editor__section-hint">
                      {formatMessage("editor.image_details_hint")}
                    </div>
                  </div>
                  <span className="chips-image-editor__details-source">
                    {selectedImage.source === "file"
                      ? formatMessage("editor.source_file")
                      : formatMessage("editor.source_url")}
                  </span>
                </div>

                <div className="chips-image-editor__details-grid">
                  <div className="chips-image-editor__details-field">
                    <span className="chips-image-editor__field-label">
                      {formatMessage("editor.image_title")}
                    </span>
                    <div className="chips-image-editor__details-control">
                      <input
                        className="chips-image-editor__text-input"
                        type="text"
                        value={selectedImage.title ?? ""}
                        placeholder={formatMessage("editor.image_title_placeholder")}
                        onChange={(event) => {
                          updateImageFields(selectedImage.id, {
                            title: event.currentTarget.value,
                          });
                        }}
                      />
                    </div>
                  </div>

                  <div className="chips-image-editor__details-field">
                    <span className="chips-image-editor__field-label">
                      {formatMessage("editor.image_alt")}
                    </span>
                    <div className="chips-image-editor__details-control">
                      <input
                        className="chips-image-editor__text-input"
                        type="text"
                        value={selectedImage.alt ?? ""}
                        placeholder={formatMessage("editor.image_alt_placeholder")}
                        onChange={(event) => {
                          updateImageFields(selectedImage.id, {
                            alt: event.currentTarget.value,
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="chips-image-editor__details-actions">
                  <label className="chips-image-editor__ghost-button">
                    <input
                      type="file"
                      accept={INPUT_ACCEPT_VALUE}
                      hidden={true}
                      onChange={(event) => {
                        const nextFiles = Array.from(event.target.files ?? []);
                        event.currentTarget.value = "";
                        void handleReplaceWithFiles(selectedImage.id, nextFiles);
                      }}
                    />
                    {formatMessage("editor.replace_file")}
                  </label>
                  <input
                    className="chips-image-editor__text-input chips-image-editor__url-field"
                    type="text"
                    value={replaceUrlInput}
                    placeholder={formatMessage("editor.replace_url_placeholder")}
                    onChange={(event) => {
                      setReplaceUrlInput(event.currentTarget.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleReplaceWithUrl(selectedImage.id);
                      }
                    }}
                  />
                  <Button
                    type="default"
                    onClick={() => {
                      handleReplaceWithUrl(selectedImage.id);
                    }}
                  >
                    {formatMessage("editor.replace_by_url")}
                  </Button>
                </div>
              </div>
            ) : null}

            {showUploader || config.images.length === 0 ? (
              <div ref={uploaderRef} className="chips-image-editor__embedded-uploader">
                <div className="chips-image-editor__section-copy">
                  <div className="chips-image-editor__section-title">
                    {formatMessage("editor.section_add_images")}
                  </div>
                  <div className="chips-image-editor__section-hint">
                    {formatMessage("editor.add_panel_hint")}
                  </div>
                </div>

                <label
                  className="chips-image-editor__dropzone"
                  data-state={isUploading ? "uploading" : isDragOver ? "dragover" : "idle"}
                  htmlFor={addInputId}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragOver(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragOver(false);
                    void importFiles(Array.from(event.dataTransfer.files ?? []));
                  }}
                >
                  <span className="chips-image-editor__dropzone-icon" aria-hidden="true">
                    ⤴
                  </span>
                  {isUploading ? (
                    <span className="chips-image-editor__progress">{uploadProgress}%</span>
                  ) : (
                    <>
                      <span className="chips-image-editor__dropzone-title">
                        {formatMessage("editor.upload_hint")}
                      </span>
                      <span className="chips-image-editor__dropzone-description">
                        {formatMessage("editor.upload_sub_hint")}
                      </span>
                    </>
                  )}
                </label>

                <div className="chips-image-editor__divider">{formatMessage("editor.section_or")}</div>

                <div className="chips-image-editor__row">
                  <input
                    className="chips-image-editor__text-input chips-image-editor__url-field"
                    type="text"
                    value={urlInput}
                    placeholder={formatMessage("editor.url_placeholder")}
                    onChange={(event) => {
                      setUrlInput(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleAddByUrl();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="chips-image-editor__action-button"
                    onClick={handleAddByUrl}
                  >
                    {formatMessage("editor.add_by_url")}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      <div
        ref={deleteTrayRef}
        className="chips-image-editor__delete-tray"
        data-active={draggingImageId ? "true" : "false"}
        data-over={isDeleteZoneOver ? "true" : "false"}
      >
        {formatMessage("editor.drag_to_delete")}
      </div>

      {dragPreviewPortalTarget
        ? createPortal(
            <div
              ref={dragPreviewRef}
              className="chips-image-editor__drag-preview"
              data-active={dragOverlay ? "true" : "false"}
              style={
                dragOverlay
                  ? {
                      width: `${dragOverlay.width}px`,
                      height: `${dragOverlay.height}px`,
                    }
                  : undefined
              }
            >
              <div className="chips-image-editor__drag-preview-surface">
                {dragOverlay?.previewUrl ? (
                  <img src={dragOverlay.previewUrl} alt="" draggable={false} />
                ) : (
                  <div className="chips-image-editor__drag-preview-placeholder">
                    {formatMessage("image.unavailable")}
                  </div>
                )}
              </div>
            </div>,
            dragPreviewPortalTarget,
          )
        : null}
    </div>
  );
}

export function createBasecardEditorRoot(props: BasecardEditorProps): HTMLElement {
  const rootElement = document.createElement("div") as EditorRoot;
  rootElement.setAttribute("data-chips-image-editor-root", "true");
  rootElement.style.width = "100%";
  rootElement.style.height = "100%";
  rootElement.style.minHeight = "0";

  const reactRoot: Root = createRoot(rootElement);

  flushSync(() => {
    reactRoot.render(
      <ConfigProvider locale={zhCN} theme={appleTheme}>
        <style>{EDITOR_STYLE_TEXT}</style>
        <ImageCardEditor {...props} />
      </ConfigProvider>,
    );
  });

  rootElement.__chipsDispose = () => {
    reactRoot.unmount();
  };

  return rootElement;
}
