import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { createError } from '../../../src/shared/errors';
import {
  createThemeCssVariableDeclarations,
  normalizeThemeCssForBrowser
} from '../../../src/shared/theme-css-units';
import { createId } from '../../../src/shared/utils';
import type { PluginRecord, PluginRuntime } from '../../../src/runtime';
import type { CardInfoField, CardReadInfoResult } from '../../card-info-service/src';
import type { ThemeSnapshot } from '../../unified-rendering/src';
import type { ZipEntryMeta } from '../../zip-service/src';
import { StoreZipService } from '../../zip-service/src';

const BOX_ID_PATTERN = /^[0-9A-Za-z]{10}$/;
const SUPPORTED_URL_SCHEMES = new Set(['file:', 'http:', 'https:', 'webdav:']);
const URL_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const BOX_MIME_TYPE = 'application/vnd.chips.box+zip';
const CARD_MIME_TYPE = 'application/vnd.chips.card+zip';

const isEmbeddedEntryUrl = (value: string): boolean => {
  return !URL_SCHEME_PATTERN.test(value);
};

type BoxTag = string | string[];
type EntryDetailField = 'documentInfo' | 'coverDescriptor' | 'previewDescriptor' | 'runtimeProps' | 'status';
type EntryResourceKind = 'cover' | 'preview' | 'documentFile' | 'custom';
type PrefetchTarget = 'cover' | 'preview' | 'documentInfo';

export interface BoxValidationResult {
  valid: boolean;
  errors: string[];
}

export interface BoxMetadata {
  chipStandardsVersion: string;
  boxId: string;
  name: string;
  createdAt: string;
  modifiedAt: string;
  activeLayoutType: string;
  coverRatio?: string;
  description?: string;
  tags?: BoxTag[];
  coverAsset?: string;
  owner?: string;
  source?: Record<string, unknown>;
}

export interface BoxEntrySnapshot {
  entryId: string;
  url: string;
  enabled: boolean;
  snapshot: {
    documentId?: string;
    title?: string;
    summary?: string;
    tags?: BoxTag[];
    cover?: {
      mode: 'asset' | 'runtime' | 'none';
      assetPath?: string;
      mimeType?: string;
      width?: number;
      height?: number;
    };
    lastKnownModifiedAt?: string;
    contentType?: string;
  };
  layoutHints?: {
    sortKey?: string | number;
    aspectRatio?: number;
    group?: string;
    priority?: number;
  };
}

export interface BoxLayoutConfig {
  schemaVersion?: string;
  props?: Record<string, unknown>;
  assetRefs?: string[];
  [key: string]: unknown;
}

export interface BoxContent {
  activeLayoutType: string;
  layoutConfigs: Record<string, BoxLayoutConfig>;
}

export interface BoxInspection {
  metadata: BoxMetadata;
  content: BoxContent;
  entries: BoxEntrySnapshot[];
  assets: string[];
}

export interface BoxEntryQuery {
  cursor?: string;
  limit?: number;
  filter?: Record<string, unknown>;
  sort?: {
    key: string;
    direction: 'asc' | 'desc';
  };
}

export interface BoxEntryPage {
  items: BoxEntrySnapshot[];
  total: number;
  nextCursor?: string;
}

export interface BoxSessionInfo {
  boxId: string;
  boxFile: string;
  name: string;
  activeLayoutType: string;
  availableLayouts: string[];
  coverRatio?: string;
  tags?: BoxTag[];
  coverAsset?: string;
  capabilities: {
    listEntries: true;
    readEntryDetail: true;
    renderEntryCover: true;
    resolveEntryResource: true;
    readBoxAsset: true;
    prefetchEntries: true;
    openEntry: true;
  };
}

export interface BoxOpenViewResult {
  sessionId: string;
  box: BoxSessionInfo;
  initialView: BoxEntryPage;
}

export interface BoxEntryOpenResult {
  mode: 'document-window' | 'external';
  documentType?: 'card' | 'box';
  windowId?: string;
  pluginId?: string;
  url?: string;
}

export interface BoxCoverView {
  title: string;
  coverUrl: string;
  mimeType: 'text/html';
  ratio?: string;
}

export interface BoxEntryCoverView {
  title: string;
  coverUrl: string;
  mimeType: string;
  ratio?: string;
}

export interface ResolvedRuntimeResource {
  resourceUrl: string;
  mimeType: string;
  cacheKey?: string;
  expiresAt?: string;
  width?: number;
  height?: number;
}

export interface BoxReadEntryDetailResult {
  items: Array<{
    entryId: string;
    detail: Record<string, unknown>;
  }>;
}

export interface BoxServiceReadEntryDetailOptions {
  ownerKey: string;
  readCardInfo?: (cardFile: string, fields?: CardInfoField[]) => Promise<CardReadInfoResult>;
}

export interface BoxServiceResolveEntryResourceOptions extends BoxServiceReadEntryDetailOptions {
  openCardFile?: (cardFile: string) => Promise<BoxEntryOpenResult>;
  openBoxFile?: (boxFile: string) => Promise<BoxEntryOpenResult>;
  openExternalUrl?: (url: string) => Promise<void>;
}

export interface BoxOpenViewOptions {
  ownerKey: string;
  layoutType?: string;
  initialQuery?: BoxEntryQuery;
}

export interface BoxLayoutDescriptorSummary {
  pluginId: string;
  layoutType: string;
  displayName: string;
  description?: string;
  icon?: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
}

export interface BoxLayoutValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export interface BoxLayoutFrameRenderOptions {
  layoutType: string;
  sessionId: string;
  box: BoxSessionInfo;
  initialView: BoxEntryPage;
  config: Record<string, unknown>;
  locale?: string;
  theme?: ThemeSnapshot;
  themeCssText?: string;
}

export interface BoxLayoutEditorRenderOptions {
  layoutType: string;
  entries: BoxEntrySnapshot[];
  initialConfig: Record<string, unknown>;
  locale?: string;
  theme?: ThemeSnapshot;
  themeCssText?: string;
}

export interface RenderedBoxLayoutFrameView {
  title: string;
  documentUrl: string;
  sessionId: string;
  layoutType: string;
  pluginId: string;
}

export interface RenderedBoxLayoutEditorView {
  title: string;
  documentUrl: string;
  sessionId: string;
  layoutType: string;
  pluginId: string;
}

export interface BoxServiceOptions {
  runtime?: Pick<PluginRuntime, 'query'>;
  workspaceRoot?: string;
  managedDocumentScheme?: string;
}

interface NormalizedBoxPackage {
  metadata: BoxMetadata;
  content: BoxContent;
  entries: BoxEntrySnapshot[];
  assets: string[];
}

interface LoadedArchivePackage extends NormalizedBoxPackage {
  zipEntries: Set<string>;
}

interface BoxSessionRecord {
  sessionId: string;
  ownerKey: string;
  createdAt: number;
  extractedDir: string;
  boxFile: string;
  metadata: BoxMetadata;
  content: BoxContent;
  entries: BoxEntrySnapshot[];
  entryMap: Map<string, BoxEntrySnapshot>;
  activeLayoutType: string;
  availableLayouts: string[];
  resourceCache: Map<string, ResolvedRuntimeResource>;
}

interface RenderSessionEntry {
  rootDir: string;
  createdAt: number;
}

interface LayoutPluginModule {
  layoutDefinition?: {
    pluginId?: string;
    layoutType: string;
    displayName?: string;
    description?: string;
    icon?: Record<string, unknown>;
    createDefaultConfig(): Record<string, unknown>;
    normalizeConfig(input: Record<string, unknown>): Record<string, unknown>;
    validateConfig(config: Record<string, unknown>): BoxLayoutValidationResult;
    getInitialQuery?(config: Record<string, unknown>): BoxEntryQuery | undefined;
    renderView(ctx: {
      container: unknown;
      sessionId: string;
      box: BoxSessionInfo;
      initialView: BoxEntryPage;
      config: Record<string, unknown>;
      runtime: {
        listEntries(query?: BoxEntryQuery): Promise<BoxEntryPage>;
        readEntryDetail(request: { entryIds: string[]; fields: EntryDetailField[] }): Promise<Array<{ entryId: string; detail: Record<string, unknown> }>>;
        renderEntryCover(entryId: string): Promise<BoxEntryCoverView>;
        resolveEntryResource(request: {
          entryId: string;
          resource: {
            kind: EntryResourceKind;
            key?: string;
            sizeHint?: { width?: number; height?: number };
          };
        }): Promise<ResolvedRuntimeResource>;
        readBoxAsset(assetPath: string): Promise<ResolvedRuntimeResource>;
        prefetchEntries(request: { entryIds: string[]; targets: PrefetchTarget[] }): Promise<void>;
        openEntry(entryId: string): Promise<BoxEntryOpenResult>;
      };
      locale?: string;
    }): unknown;
    renderEditor?(ctx: {
      container: unknown;
      entries: BoxEntrySnapshot[];
      initialConfig: Record<string, unknown>;
      onChange(next: Record<string, unknown>): void;
      readBoxAsset?(assetPath: string): Promise<ResolvedRuntimeResource>;
      importBoxAsset?(input: { file: File; preferredPath?: string }): Promise<{ assetPath: string }>;
      deleteBoxAsset?(assetPath: string): Promise<void>;
      locale?: string;
    }): unknown;
  };
}

interface RenderableLayoutPluginRecord extends PluginRecord {
  manifest: PluginRecord['manifest'] & {
    entry: string;
    layout?: {
      layoutType?: string;
      displayName?: string;
    };
  };
}

interface EntryLocator {
  scheme: string;
  url: string;
  filePath?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const asFiniteNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const toRatioString = (width?: number, height?: number): string | undefined => {
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  return `${width}:${height}`;
};

const normalizeTags = (value: unknown, field: string): BoxTag[] | undefined => {
  if (typeof value === 'undefined') {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw createError('BOX_SCHEMA_INVALID', `${field} must be an array.`);
  }

  const normalized = value.map((item) => {
    if (typeof item === 'string' && item.trim().length > 0) {
      return item.trim();
    }
    if (Array.isArray(item) && item.every((member) => typeof member === 'string' && member.trim().length > 0)) {
      return item.map((member) => member.trim());
    }
    throw createError('BOX_SCHEMA_INVALID', `${field} must contain string tags or string arrays.`);
  });

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeAssetPath = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw createError('BOX_SCHEMA_INVALID', `${field} must be a non-empty string.`);
  }

  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized.startsWith('assets/')) {
    throw createError('BOX_SCHEMA_INVALID', `${field} must start with assets/.`, { value });
  }

  const segments = normalized.split('/').filter((segment) => segment.length > 0);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw createError('BOX_SCHEMA_INVALID', `${field} contains invalid path traversal.`, { value });
  }

  return segments.join('/');
};

const ensureIsoUtc = (value: string, field: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw createError('BOX_SCHEMA_INVALID', `${field} must be a valid ISO 8601 UTC string.`, { value });
  }
  return value;
};

const ensureBase62Id = (value: string, field: string): string => {
  if (!BOX_ID_PATTERN.test(value)) {
    throw createError('BOX_SCHEMA_INVALID', `${field} must be a 10-character Base62 identifier.`, { value });
  }
  return value;
};

const parseYamlRecord = (text: string, filePath: string): Record<string, unknown> => {
  const parsed = yaml.parse(text) as unknown;
  if (!isRecord(parsed)) {
    throw createError('BOX_SCHEMA_INVALID', `YAML root must be an object: ${filePath}`, { filePath });
  }
  return parsed;
};

const sortObjectKeys = <T>(values: T[]): T[] => {
  return [...values].sort((left, right) => String(left).localeCompare(String(right)));
};

const collectDirectoryFiles = async (rootDir: string): Promise<string[]> => {
  const files: string[] = [];
  const stack = [rootDir];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');
      files.push(relativePath);
    }
  }

  return sortObjectKeys(files);
};

const resolvePageCursor = (value: string | undefined): number => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 0;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const resolvePageLimit = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 24;
  }
  return Math.max(1, Math.min(200, Math.floor(value)));
};

const compareValues = (left: unknown, right: unknown): number => {
  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }
  return String(left ?? '').localeCompare(String(right ?? ''));
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const escapeInlineJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

const createDocumentScriptNonce = (): string => crypto.randomBytes(18).toString('base64');

const encodeManagedUrlPath = (value: string): string =>
  value
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const decodeManagedUrlPathSegments = (value: string): string[] | null => {
  try {
    return value
      .split('/')
      .filter((segment) => segment.length > 0)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return null;
  }
};

const normalizeManagedRelativePath = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\\/g, '/').trim();
  if (!normalized) {
    return null;
  }

  const segments = normalized
    .replace(/^\/+/, '')
    .replace(/^\.?\//, '')
    .split('/')
    .filter((segment) => segment.length > 0 && segment !== '.');

  if (segments.length === 0 || segments.some((segment) => segment === '..')) {
    return null;
  }

  return segments.join('/');
};

const normalizeManagedDocumentScheme = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().replace(/:$/, '').toLowerCase();
  if (!normalized || !/^[a-z][a-z0-9+.-]*$/i.test(normalized)) {
    return undefined;
  }

  return normalized;
};

const isPathWithinRoot = (rootDir: string, absolutePath: string): boolean => {
  const relative = path.relative(path.resolve(rootDir), path.resolve(absolutePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const createBoxLayoutThemeVariablesCss = (theme: ThemeSnapshot): string => {
  const declarations = createThemeCssVariableDeclarations(theme.tokens ?? {});

  if (declarations.length === 0) {
    return ':root {}';
  }

  return [
    ':root {',
    ...declarations,
    '}',
  ].join('\n');
};

const joinBoxLayoutStyleBlocks = (...blocks: Array<string | undefined>): string => {
  return blocks
    .map((block) => normalizeThemeCssForBrowser(block?.trim() ?? ''))
    .filter((block) => block.length > 0)
    .join('\n\n');
};

const createBoxLayoutThemeCss = (theme: ThemeSnapshot, themeCssText?: string): string => {
  return joinBoxLayoutStyleBlocks(
    themeCssText,
    createBoxLayoutThemeVariablesCss(theme),
    [
      'html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; background: transparent; }',
      'body { min-width: 0; color: var(--chips-sys-color-on-surface, #111111); }',
      '#chips-box-layout-root { width: 100%; min-height: 100%; box-sizing: border-box; }',
    ].join('\n')
  );
};

const createBoxLayoutEditorThemeCss = (theme: ThemeSnapshot, themeCssText?: string): string => {
  return joinBoxLayoutStyleBlocks(
    themeCssText,
    createBoxLayoutThemeVariablesCss(theme),
    [
      'html, body { margin: 0; padding: 0; width: 100%; height: 100%; min-height: 100%; background: transparent; }',
      'body { min-width: 0; min-height: 0; color: var(--chips-sys-color-on-surface, #111111); overflow: hidden; }',
      '#chips-box-layout-editor-root { width: 100%; height: 100%; min-height: 0; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; }',
    ].join('\n')
  );
};

const createBoxLayoutViewDocument = (options: {
  title: string;
  pluginId: string;
  layoutType: string;
  pluginBundleCode: string;
  sessionId: string;
  box: BoxSessionInfo;
  initialView: BoxEntryPage;
  config: Record<string, unknown>;
  locale?: string;
  themeCssText: string;
  managedDocumentScheme?: string;
}): string => {
  const {
    title,
    pluginId,
    layoutType,
    pluginBundleCode,
    sessionId,
    box,
    initialView,
    config,
    locale,
    themeCssText,
    managedDocumentScheme,
  } = options;
  const scriptNonce = createDocumentScriptNonce();
  const allowedManagedProtocol = normalizeManagedDocumentScheme(managedDocumentScheme);
  const managedSource = allowedManagedProtocol ? `${allowedManagedProtocol}:` : '';

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; connect-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; font-src data: file:${managedSource ? ` ${managedSource}` : ''}; media-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; child-src about: file: http: https: blob:${managedSource ? ` ${managedSource}` : ''}; frame-src about: file: http: https: blob:${managedSource ? ` ${managedSource}` : ''}; object-src 'none';" />`,
    `  <title>${escapeHtml(title)}</title>`,
    `  <style>${themeCssText}</style>`,
    '</head>',
    `<body data-layout-type="${escapeHtml(layoutType)}" data-plugin-id="${escapeHtml(pluginId)}" data-session-id="${escapeHtml(sessionId)}">`,
    '  <div id="chips-box-layout-root"></div>',
    `  <script nonce="${scriptNonce}">`,
    pluginBundleCode,
    '  </script>',
    `  <script nonce="${scriptNonce}">`,
    '    (() => {',
    `      const sessionId = ${JSON.stringify(sessionId)};`,
    `      const box = ${escapeInlineJson(box)};`,
    `      const initialView = ${escapeInlineJson(initialView)};`,
    `      const config = ${escapeInlineJson(config)};`,
    `      const locale = ${JSON.stringify(locale ?? '')};`,
    `      const layoutType = ${JSON.stringify(layoutType)};`,
    `      const pluginId = ${JSON.stringify(pluginId)};`,
    '      const container = document.getElementById("chips-box-layout-root");',
    '      const emit = (type, payload) => {',
    "        window.parent?.postMessage({ type, payload }, '*');",
    '      };',
    '      let resizeScheduled = false;',
    '      let pendingResizeReason = "initial";',
    '      const getLayoutHeight = () => Math.max(',
    '        240,',
    '        document.documentElement?.scrollHeight ?? 0,',
    '        document.body?.scrollHeight ?? 0,',
    '        document.documentElement?.offsetHeight ?? 0,',
    '        document.body?.offsetHeight ?? 0,',
    '        container?.scrollHeight ?? 0,',
    '        container?.offsetHeight ?? 0',
    '      );',
    '      const emitLayoutResize = (reason) => {',
    '        emit("chips.box-layout:resize", {',
    '          sessionId,',
    '          layoutType,',
    '          pluginId,',
    '          height: Math.max(240, Math.ceil(getLayoutHeight())),',
    '          reason,',
    '        });',
    '      };',
    '      const scheduleLayoutResize = (reason) => {',
    '        pendingResizeReason = reason;',
    '        if (resizeScheduled) {',
    '          return;',
    '        }',
    '        resizeScheduled = true;',
    '        const schedule = typeof window.requestAnimationFrame === "function"',
    '          ? window.requestAnimationFrame.bind(window)',
    '          : (callback) => window.setTimeout(callback, 0);',
    '        schedule(() => {',
    '          resizeScheduled = false;',
    '          emitLayoutResize(pendingResizeReason);',
    '        });',
    '      };',
    '      const observeLayoutResize = () => {',
    '        window.addEventListener("resize", () => scheduleLayoutResize("viewport-resize"));',
    '        if (!("ResizeObserver" in window)) {',
    '          return;',
    '        }',
    '        const observer = new ResizeObserver(() => scheduleLayoutResize("content-resize"));',
    '        if (container) { observer.observe(container); }',
    '        if (document.body) { observer.observe(document.body); }',
    '        if (document.documentElement) { observer.observe(document.documentElement); }',
    '      };',
    '      let requestCounter = 0;',
    '      const pendingRequests = new Map();',
    '      const nextRequestId = (action) => `${action}-${Date.now()}-${++requestCounter}`;',
    '      const requestRuntime = (action, payload) => {',
    '        return new Promise((resolve, reject) => {',
    '          const requestId = nextRequestId(action);',
    '          const timer = window.setTimeout(() => {',
    '            pendingRequests.delete(requestId);',
    "            reject(new Error(`Box layout runtime request timed out: ${action}`));",
    '          }, 30000);',
    '          pendingRequests.set(requestId, { resolve, reject, timer });',
    "          emit('chips.box-layout:runtime-request', { requestId, action, sessionId, layoutType, pluginId, ...payload });",
    '        });',
    '      };',
    '      window.addEventListener("message", (event) => {',
    '        const data = event.data;',
    '        if (!data || typeof data !== "object" || data.type !== "chips.box-layout:runtime-response") {',
    '          return;',
    '        }',
    '        const payload = data.payload ?? {};',
    '        const requestId = typeof payload.requestId === "string" ? payload.requestId : "";',
    '        if (!requestId) {',
    '          return;',
    '        }',
    '        const pending = pendingRequests.get(requestId);',
    '        if (!pending) {',
    '          return;',
    '        }',
    '        window.clearTimeout(pending.timer);',
    '        pendingRequests.delete(requestId);',
    '        if (payload.ok === false) {',
    '          pending.reject(new Error(typeof payload.message === "string" ? payload.message : "Box layout runtime request failed."));',
    '          return;',
    '        }',
    '        pending.resolve(payload.result);',
    '      });',
    '      const runtime = {',
    '        listEntries(query) {',
    "          return requestRuntime('listEntries', { query });",
    '        },',
    '        readEntryDetail(request) {',
    "          return requestRuntime('readEntryDetail', { request });",
    '        },',
    '        renderEntryCover(entryId) {',
    "          return requestRuntime('renderEntryCover', { entryId });",
    '        },',
    '        resolveEntryResource(request) {',
    "          return requestRuntime('resolveEntryResource', { request });",
    '        },',
    '        readBoxAsset(assetPath) {',
    "          return requestRuntime('readBoxAsset', { assetPath });",
    '        },',
    '        prefetchEntries(request) {',
    "          return requestRuntime('prefetchEntries', { request });",
    '        },',
    '        openEntry(entryId) {',
    "          return requestRuntime('openEntry', { entryId });",
    '        },',
    '      };',
    '      try {',
    '        const plugin = globalThis.ChipsBoxLayoutPlugin || {};',
    '        const definition = plugin.layoutDefinition;',
    '        if (!definition || typeof definition.renderView !== "function") {',
    "          throw new Error('Layout plugin does not export layoutDefinition.renderView.');",
    '        }',
    '        definition.renderView({',
    '          container,',
    '          sessionId,',
    '          box,',
    '          initialView,',
    '          config,',
    '          runtime,',
    '          locale: locale || undefined,',
    '        });',
    "        emit('chips.box-layout:ready', { sessionId, layoutType, pluginId });",
    '        observeLayoutResize();',
    '        scheduleLayoutResize("ready");',
    '      } catch (error) {',
    '        const message = error instanceof Error ? error.message : String(error);',
    "        emit('chips.box-layout:error', { sessionId, layoutType, pluginId, code: 'BOX_LAYOUT_RENDER_FAILED', message });",
    '        if (container) {',
    '          const pre = document.createElement("pre");',
    '          pre.textContent = message;',
    '          pre.style.margin = "0";',
    '          pre.style.padding = "20px";',
    '          pre.style.whiteSpace = "pre-wrap";',
    '          pre.style.color = "var(--chips-sys-color-error, #ff3b30)";',
    '          container.replaceChildren(pre);',
    '        }',
    '        scheduleLayoutResize("error");',
    '      }',
    '    })();',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n');
};

const createBoxLayoutEditorDocument = (options: {
  title: string;
  pluginId: string;
  layoutType: string;
  pluginBundleCode: string;
  entries: BoxEntrySnapshot[];
  initialConfig: Record<string, unknown>;
  locale?: string;
  themeCssText: string;
  managedDocumentScheme?: string;
}): string => {
  const {
    title,
    pluginId,
    layoutType,
    pluginBundleCode,
    entries,
    initialConfig,
    locale,
    themeCssText,
    managedDocumentScheme,
  } = options;
  const scriptNonce = createDocumentScriptNonce();
  const allowedManagedProtocol = normalizeManagedDocumentScheme(managedDocumentScheme);
  const managedSource = allowedManagedProtocol ? `${allowedManagedProtocol}:` : '';

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; connect-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; font-src data: file:${managedSource ? ` ${managedSource}` : ''}; media-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; child-src about: file: http: https: blob:${managedSource ? ` ${managedSource}` : ''}; frame-src about: file: http: https: blob:${managedSource ? ` ${managedSource}` : ''}; object-src 'none';" />`,
    `  <title>${escapeHtml(title)}</title>`,
    `  <style>${themeCssText}</style>`,
    '</head>',
    `<body data-layout-type="${escapeHtml(layoutType)}" data-plugin-id="${escapeHtml(pluginId)}">`,
    '  <div id="chips-box-layout-editor-root"></div>',
    `  <script nonce="${scriptNonce}">`,
    pluginBundleCode,
    '  </script>',
    `  <script nonce="${scriptNonce}">`,
    '    (() => {',
    `      const entries = ${escapeInlineJson(entries)};`,
    `      const initialConfig = ${escapeInlineJson(initialConfig)};`,
    `      const locale = ${JSON.stringify(locale ?? '')};`,
    `      const layoutType = ${JSON.stringify(layoutType)};`,
    `      const pluginId = ${JSON.stringify(pluginId)};`,
    '      const container = document.getElementById("chips-box-layout-editor-root");',
    '      const emit = (type, payload) => {',
    "        window.parent?.postMessage({ type, payload }, '*');",
    '      };',
    '      let requestCounter = 0;',
    '      const pendingRequests = new Map();',
    '      const nextRequestId = (action) => `${action}-${Date.now()}-${++requestCounter}`;',
    '      const requestAssets = (action, payload) => {',
    '        return new Promise((resolve, reject) => {',
    '          const requestId = nextRequestId(action);',
    '          const timer = window.setTimeout(() => {',
    '            pendingRequests.delete(requestId);',
    "            reject(new Error(`Box layout editor asset request timed out: ${action}`));",
    '          }, 30000);',
    '          pendingRequests.set(requestId, { resolve, reject, timer });',
    "          emit('chips.box-layout-editor:asset-request', { requestId, action, layoutType, pluginId, ...payload });",
    '        });',
    '      };',
    '      window.addEventListener("message", (event) => {',
    '        const data = event.data;',
    '        if (!data || typeof data !== "object" || data.type !== "chips.box-layout-editor:asset-response") {',
    '          return;',
    '        }',
    '        const payload = data.payload ?? {};',
    '        const requestId = typeof payload.requestId === "string" ? payload.requestId : "";',
    '        if (!requestId) {',
    '          return;',
    '        }',
    '        const pending = pendingRequests.get(requestId);',
    '        if (!pending) {',
    '          return;',
    '        }',
    '        window.clearTimeout(pending.timer);',
    '        pendingRequests.delete(requestId);',
    '        if (payload.ok === false) {',
    '          pending.reject(new Error(typeof payload.message === "string" ? payload.message : "Box layout editor asset request failed."));',
    '          return;',
    '        }',
    '        pending.resolve(payload.result);',
    '      });',
    '      try {',
    '        const plugin = globalThis.ChipsBoxLayoutPlugin || {};',
    '        const definition = plugin.layoutDefinition;',
    '        if (!definition || typeof definition.renderEditor !== "function") {',
    "          throw new Error('Layout plugin does not export layoutDefinition.renderEditor.');",
    '        }',
    '        definition.renderEditor({',
    '          container,',
    '          entries,',
    '          initialConfig,',
    '          locale: locale || undefined,',
    '          onChange(next) {',
    "            emit('chips.box-layout-editor:change', { layoutType, pluginId, config: next });",
    '          },',
    '          readBoxAsset(assetPath) {',
    "            return requestAssets('readBoxAsset', { assetPath });",
    '          },',
    '          importBoxAsset(input) {',
    "            return requestAssets('importBoxAsset', { preferredPath: input?.preferredPath, file: input?.file });",
    '          },',
    '          deleteBoxAsset(assetPath) {',
    "            return requestAssets('deleteBoxAsset', { assetPath });",
    '          },',
    '        });',
    "        emit('chips.box-layout-editor:ready', { layoutType, pluginId });",
    '      } catch (error) {',
    '        const message = error instanceof Error ? error.message : String(error);',
    "        emit('chips.box-layout-editor:error', { layoutType, pluginId, code: 'BOX_LAYOUT_EDITOR_RENDER_FAILED', message });",
    '        if (container) {',
    '          const pre = document.createElement("pre");',
    '          pre.textContent = message;',
    '          pre.style.margin = "0";',
    '          pre.style.padding = "20px";',
    '          pre.style.whiteSpace = "pre-wrap";',
    '          pre.style.color = "var(--chips-sys-color-error, #ff3b30)";',
    '          container.replaceChildren(pre);',
    '        }',
    '      }',
    '    })();',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n');
};

export class BoxService {
  private readonly sessions = new Map<string, BoxSessionRecord>();
  private readonly extractedCoverRoots = new Map<string, string>();
  private readonly boxCoverRootTokenByRootDir = new Map<string, string>();
  private readonly boxCoverRootDirByToken = new Map<string, string>();
  private readonly runtime?: Pick<PluginRuntime, 'query'>;
  private readonly workspaceRoot: string;
  private readonly managedDocumentScheme?: string;
  private readonly moduleCache = new Map<string, Promise<LayoutPluginModule>>();
  private readonly browserBundleCache = new Map<string, Promise<string>>();
  private readonly renderSessionCache = new Map<string, RenderSessionEntry>();

  public constructor(
    private readonly zip = new StoreZipService(),
    options: BoxServiceOptions = {},
  ) {
    this.runtime = options.runtime;
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.managedDocumentScheme = normalizeManagedDocumentScheme(options.managedDocumentScheme);
  }

  public async pack(boxDir: string, outputPath: string): Promise<string> {
    await this.loadDirectoryPackage(boxDir);
    await this.zip.compress(boxDir, outputPath);
    return outputPath;
  }

  public async unpack(boxFile: string, outputDir: string): Promise<string> {
    const validation = await this.validate(boxFile);
    if (!validation.valid) {
      throw createError('BOX_UNPACK_FAILED', 'Box format validation failed.', validation.errors);
    }
    await this.zip.extract(boxFile, outputDir);
    return outputDir;
  }

  public async inspect(boxFile: string): Promise<BoxInspection> {
    const loaded = await this.loadArchivePackage(boxFile);
    return {
      metadata: loaded.metadata,
      content: loaded.content,
      entries: loaded.entries,
      assets: loaded.assets
    };
  }

  public async validate(boxFile: string): Promise<BoxValidationResult> {
    try {
      await this.loadArchivePackage(boxFile);
      return {
        valid: true,
        errors: []
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        const details = (error as { details?: unknown }).details;
        if (Array.isArray(details) && details.every((item) => typeof item === 'string')) {
          return {
            valid: false,
            errors: details
          };
        }
        return {
          valid: false,
          errors: [(error as { message: string }).message]
        };
      }
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  public async readMetadata(boxFile: string): Promise<BoxMetadata> {
    const loaded = await this.loadArchivePackage(boxFile);
    return loaded.metadata;
  }

  public async renderCover(boxFile: string): Promise<BoxCoverView> {
    const loaded = await this.loadArchivePackage(boxFile);
    const extractedRoot = await this.getOrCreateExtractedCoverRoot(boxFile);
    return {
      title: loaded.metadata.name,
      coverUrl: this.createBoxCoverRootFileUrl(extractedRoot, '.box/cover.html'),
      mimeType: 'text/html',
      ratio: loaded.metadata.coverRatio
    };
  }

  public async listLayoutDescriptors(): Promise<BoxLayoutDescriptorSummary[]> {
    const plugins = this.queryLayoutPlugins();
    const descriptors = await Promise.all(
      plugins.map(async (plugin) => {
        const descriptor = await this.loadLayoutDescriptor(plugin);
        return this.toLayoutDescriptorSummary(descriptor, plugin);
      }),
    );

    return descriptors.sort((left, right) => left.displayName.localeCompare(right.displayName, 'zh-CN'));
  }

  public async readLayoutDescriptor(layoutType: string): Promise<BoxLayoutDescriptorSummary> {
    const plugin = this.resolveLayoutPlugin(layoutType);
    const descriptor = await this.loadLayoutDescriptor(plugin);
    return this.toLayoutDescriptorSummary(descriptor, plugin);
  }

  public async normalizeLayoutConfig(layoutType: string, config: Record<string, unknown>): Promise<Record<string, unknown>> {
    const descriptor = await this.loadLayoutDescriptor(this.resolveLayoutPlugin(layoutType));
    return descriptor.normalizeConfig({ ...(config ?? {}) });
  }

  public async validateLayoutConfig(layoutType: string, config: Record<string, unknown>): Promise<BoxLayoutValidationResult> {
    const descriptor = await this.loadLayoutDescriptor(this.resolveLayoutPlugin(layoutType));
    const normalized = descriptor.normalizeConfig({ ...(config ?? {}) });
    return descriptor.validateConfig(normalized);
  }

  public async getLayoutInitialQuery(
    layoutType: string,
    config: Record<string, unknown>,
  ): Promise<BoxEntryQuery | undefined> {
    const descriptor = await this.loadLayoutDescriptor(this.resolveLayoutPlugin(layoutType));
    const normalized = descriptor.normalizeConfig({ ...(config ?? {}) });
    return descriptor.getInitialQuery?.(normalized);
  }

  public async renderLayoutFrame(options: BoxLayoutFrameRenderOptions): Promise<RenderedBoxLayoutFrameView> {
    const normalizedLayoutType = asString(options.layoutType)?.trim();
    if (!normalizedLayoutType) {
      throw createError('INVALID_ARGUMENT', 'layoutType is required for box layout render.');
    }

    const theme = options.theme;
    if (!theme) {
      throw createError('THEME_NOT_FOUND', 'Box layout render requires a resolved theme snapshot.');
    }

    const plugin = this.resolveLayoutPlugin(normalizedLayoutType);
    const descriptor = await this.loadLayoutDescriptor(plugin);
    const normalizedConfig = descriptor.normalizeConfig({ ...(options.config ?? {}) });
    const pluginBundleCode = await this.bundleLayoutPluginForBrowser(plugin);
    const title = options.box.name || descriptor.displayName || normalizedLayoutType;
    const body = createBoxLayoutViewDocument({
      title,
      pluginId: plugin.manifest.id,
      layoutType: descriptor.layoutType,
      pluginBundleCode,
      sessionId: options.sessionId,
      box: options.box,
      initialView: options.initialView,
      config: normalizedConfig,
      locale: options.locale,
      themeCssText: createBoxLayoutThemeCss(theme, options.themeCssText),
      managedDocumentScheme: this.managedDocumentScheme,
    });
    const persistedSession = await this.persistRenderSession('box-layout');
    const indexPath = path.join(persistedSession.rootDir, 'index.html');
    await fs.writeFile(indexPath, body, 'utf-8');

    return {
      title,
      documentUrl: this.createRenderSessionDocumentUrl(persistedSession.sessionId, indexPath),
      sessionId: persistedSession.sessionId,
      layoutType: descriptor.layoutType,
      pluginId: plugin.manifest.id,
    };
  }

  public async renderLayoutEditor(options: BoxLayoutEditorRenderOptions): Promise<RenderedBoxLayoutEditorView> {
    const normalizedLayoutType = asString(options.layoutType)?.trim();
    if (!normalizedLayoutType) {
      throw createError('INVALID_ARGUMENT', 'layoutType is required for box layout editor render.');
    }

    const theme = options.theme;
    if (!theme) {
      throw createError('THEME_NOT_FOUND', 'Box layout editor render requires a resolved theme snapshot.');
    }

    const plugin = this.resolveLayoutPlugin(normalizedLayoutType);
    const descriptor = await this.loadLayoutDescriptor(plugin);
    if (typeof descriptor.renderEditor !== 'function') {
      throw createError('BOX_LAYOUT_EDITOR_NOT_SUPPORTED', `Layout plugin does not provide an editor: ${normalizedLayoutType}`, {
        layoutType: normalizedLayoutType,
      });
    }

    const normalizedConfig = descriptor.normalizeConfig({ ...(options.initialConfig ?? {}) });
    const pluginBundleCode = await this.bundleLayoutPluginForBrowser(plugin);
    const title = `${descriptor.displayName || normalizedLayoutType} Editor`;
    const body = createBoxLayoutEditorDocument({
      title,
      pluginId: plugin.manifest.id,
      layoutType: descriptor.layoutType,
      pluginBundleCode,
      entries: options.entries,
      initialConfig: normalizedConfig,
      locale: options.locale,
      themeCssText: createBoxLayoutEditorThemeCss(theme, options.themeCssText),
      managedDocumentScheme: this.managedDocumentScheme,
    });
    const persistedSession = await this.persistRenderSession('box-layout-editor');
    const indexPath = path.join(persistedSession.rootDir, 'index.html');
    await fs.writeFile(indexPath, body, 'utf-8');

    return {
      title,
      documentUrl: this.createRenderSessionDocumentUrl(persistedSession.sessionId, indexPath),
      sessionId: persistedSession.sessionId,
      layoutType: descriptor.layoutType,
      pluginId: plugin.manifest.id,
    };
  }

  public async releaseRenderSession(sessionId: string): Promise<void> {
    const normalizedSessionId = asString(sessionId)?.trim();
    if (!normalizedSessionId) {
      throw createError('INVALID_ARGUMENT', 'sessionId is required for render session release.');
    }

    const session = this.renderSessionCache.get(normalizedSessionId);
    if (!session) {
      return;
    }

    this.renderSessionCache.delete(normalizedSessionId);
    await fs.rm(session.rootDir, { recursive: true, force: true });
  }

  public async openView(boxFile: string, options: BoxOpenViewOptions): Promise<BoxOpenViewResult> {
    const loaded = await this.loadArchivePackage(boxFile);
    const extractedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-box-view-'));
    try {
      await this.zip.extract(boxFile, extractedDir);
      const requestedLayoutType = asString(options.layoutType);
      const activeLayoutType = requestedLayoutType ?? loaded.content.activeLayoutType;
      const availableLayouts = sortObjectKeys([...new Set([activeLayoutType, ...Object.keys(loaded.content.layoutConfigs)])]);
      const sessionId = createId();
      const session: BoxSessionRecord = {
        sessionId,
        ownerKey: options.ownerKey,
        createdAt: Date.now(),
        extractedDir,
        boxFile,
        metadata: loaded.metadata,
        content: loaded.content,
        entries: loaded.entries,
        entryMap: new Map(loaded.entries.map((entry) => [entry.entryId, entry])),
        activeLayoutType,
        availableLayouts,
        resourceCache: new Map()
      };
      this.sessions.set(sessionId, session);

      return {
        sessionId,
        box: this.toSessionInfo(session),
        initialView: this.listEntriesInternal(session, options.initialQuery)
      };
    } catch (error) {
      await fs.rm(extractedDir, { recursive: true, force: true });
      throw createError('BOX_OPEN_FAILED', 'Failed to open box view session.', {
        boxFile,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  public async listEntries(sessionId: string, ownerKey: string, query?: BoxEntryQuery): Promise<BoxEntryPage> {
    const session = this.requireSession(sessionId, ownerKey);
    return this.listEntriesInternal(session, query);
  }

  public async readEntryDetail(
    sessionId: string,
    entryIds: string[],
    fields: EntryDetailField[],
    options: BoxServiceReadEntryDetailOptions
  ): Promise<BoxReadEntryDetailResult> {
    const session = this.requireSession(sessionId, options.ownerKey);
    const uniqueFields = [...new Set(fields)];

    const items = await Promise.all(
      entryIds.map(async (entryId) => {
        const entry = session.entryMap.get(entryId);
        if (!entry) {
          throw createError('BOX_ENTRY_NOT_FOUND', `Box entry not found: ${entryId}`, { sessionId, entryId });
        }

        const detail: Record<string, unknown> = {};
        const locator = this.resolveEntryLocator(entry.url, session.extractedDir);

        for (const field of uniqueFields) {
          if (field === 'status') {
            detail.status = await this.readEntryStatus(locator);
            continue;
          }

          if (field === 'documentInfo') {
            detail.documentInfo = await this.readDocumentInfo(entry, locator, options);
            continue;
          }

          if (field === 'coverDescriptor') {
            detail.coverDescriptor = entry.snapshot.cover
              ? {
                  ...entry.snapshot.cover
                }
              : { mode: 'none' };
            continue;
          }

          if (field === 'previewDescriptor') {
            detail.previewDescriptor =
              entry.snapshot.cover?.mode === 'asset'
                ? {
                    mode: 'asset',
                    assetPath: entry.snapshot.cover.assetPath,
                    mimeType: entry.snapshot.cover.mimeType,
                    width: entry.snapshot.cover.width,
                    height: entry.snapshot.cover.height
                  }
                : {
                    mode: entry.snapshot.cover?.mode ?? 'none'
                  };
            continue;
          }

          detail.runtimeProps = {
            scheme: locator.scheme.replace(/:$/, ''),
            url: entry.url,
            enabled: entry.enabled,
            isLocalFile: locator.scheme === 'file:'
          };
        }

        return {
          entryId,
          detail
        };
      })
    );

    return { items };
  }

  public async resolveEntryResource(
    sessionId: string,
    entryId: string,
    resource: {
      kind: EntryResourceKind;
      key?: string;
      sizeHint?: {
        width?: number;
        height?: number;
      };
    },
    options: BoxServiceResolveEntryResourceOptions
  ): Promise<ResolvedRuntimeResource> {
    const session = this.requireSession(sessionId, options.ownerKey);
    const entry = session.entryMap.get(entryId);
    if (!entry) {
      throw createError('BOX_ENTRY_NOT_FOUND', `Box entry not found: ${entryId}`, { sessionId, entryId });
    }

    const cacheKey = `${entryId}:${resource.kind}:${resource.key ?? ''}`;
    const cached = session.resourceCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    let resolved: ResolvedRuntimeResource;
    if (resource.kind === 'cover' || resource.kind === 'preview') {
      const cover = entry.snapshot.cover;
      if (cover?.mode === 'asset' && cover.assetPath) {
        resolved = await this.readBoxAsset(sessionId, cover.assetPath, options.ownerKey);
        if (cover.mimeType) {
          resolved = {
            ...resolved,
            mimeType: cover.mimeType,
            width: cover.width,
            height: cover.height
          };
        }
      } else {
        const locator = this.resolveEntryLocator(entry.url, session.extractedDir);
        const documentKind = this.resolveDocumentKind(entry, locator);
        if (locator.scheme === 'file:' && locator.filePath && documentKind === 'box') {
          const coverView = await this.renderCover(locator.filePath);
          resolved = {
            resourceUrl: coverView.coverUrl,
            mimeType: coverView.mimeType,
            cacheKey
          };
        } else if (locator.scheme === 'file:' && locator.filePath && options.readCardInfo) {
          const info = await options.readCardInfo(locator.filePath, ['status', 'cover']);
          if (info.info.status?.state !== 'ready' || !info.info.cover) {
            throw createError('BOX_RESOURCE_NOT_FOUND', `Entry cover resource missing: ${entryId}`, { sessionId, entryId });
          }
          resolved = {
            resourceUrl: info.info.cover.resourceUrl,
            mimeType: info.info.cover.mimeType,
            cacheKey
          };
        } else {
          throw createError('BOX_RESOURCE_NOT_FOUND', `Entry ${resource.kind} resource is unavailable.`, {
            sessionId,
            entryId,
            kind: resource.kind
          });
        }
      }
    } else if (resource.kind === 'documentFile') {
      const locator = this.resolveEntryLocator(entry.url, session.extractedDir);
      if (locator.scheme === 'file:' && locator.filePath) {
        const exists = await this.pathExists(locator.filePath);
        if (!exists) {
          throw createError('BOX_RESOURCE_NOT_FOUND', `Document file is missing: ${entryId}`, { sessionId, entryId });
        }
        resolved = {
          resourceUrl: pathToFileURL(locator.filePath).href,
          mimeType: this.mimeTypeForDocumentFile(locator.filePath, entry.snapshot.contentType),
          cacheKey
        };
      } else {
        resolved = {
          resourceUrl: entry.url,
          mimeType: this.mimeTypeForDocumentFile(entry.url, entry.snapshot.contentType),
          cacheKey
        };
      }
    } else {
      if (!resource.key) {
        throw createError('BOX_RESOURCE_NOT_FOUND', 'Custom box resource requires a non-empty key.', {
          sessionId,
          entryId
        });
      }
      resolved = await this.readBoxAsset(sessionId, resource.key, options.ownerKey);
    }

    session.resourceCache.set(cacheKey, resolved);
    return resolved;
  }

  public async renderEntryCover(
    sessionId: string,
    entryId: string,
    options: Pick<BoxServiceReadEntryDetailOptions, 'ownerKey' | 'readCardInfo'>
  ): Promise<BoxEntryCoverView> {
    const session = this.requireSession(sessionId, options.ownerKey);
    const entry = session.entryMap.get(entryId);
    if (!entry) {
      throw createError('BOX_ENTRY_NOT_FOUND', `Box entry not found: ${entryId}`, { sessionId, entryId });
    }

    const fallbackTitle = entry.snapshot.title ?? entry.snapshot.documentId ?? entry.entryId;
    const cover = entry.snapshot.cover;
    if (cover?.mode === 'asset' && cover.assetPath) {
      const asset = await this.readBoxAsset(sessionId, cover.assetPath, options.ownerKey);
      return {
        title: fallbackTitle,
        coverUrl: asset.resourceUrl,
        mimeType: cover.mimeType ?? asset.mimeType,
        ratio: toRatioString(cover.width, cover.height)
      };
    }

    const locator = this.resolveEntryLocator(entry.url, session.extractedDir);
    if (locator.scheme === 'file:' && locator.filePath) {
      const documentKind = this.resolveDocumentKind(entry, locator);
      if (documentKind === 'box') {
        const view = await this.renderCover(locator.filePath);
        return {
          title: view.title || fallbackTitle,
          coverUrl: view.coverUrl,
          mimeType: view.mimeType,
          ratio: view.ratio
        };
      }
      if (!options.readCardInfo) {
        throw createError('BOX_RESOURCE_NOT_FOUND', `Entry cover resource missing: ${entryId}`, { sessionId, entryId });
      }
      const info = await options.readCardInfo(locator.filePath, ['status', 'cover', 'metadata']);
      if (info.info.status?.state !== 'ready' || !info.info.cover) {
        throw createError('BOX_RESOURCE_NOT_FOUND', `Entry cover resource missing: ${entryId}`, { sessionId, entryId });
      }

      return {
        title: info.info.cover.title || info.info.metadata?.name || fallbackTitle,
        coverUrl: info.info.cover.resourceUrl,
        mimeType: info.info.cover.mimeType,
        ratio: info.info.cover.ratio ?? info.info.metadata?.coverRatio
      };
    }

    throw createError('BOX_RESOURCE_NOT_FOUND', 'Current box entry does not provide a renderable cover view.', {
      sessionId,
      entryId,
      url: entry.url
    });
  }

  public async openEntry(
    sessionId: string,
    entryId: string,
    options: Pick<BoxServiceResolveEntryResourceOptions, 'ownerKey' | 'openCardFile' | 'openBoxFile' | 'openExternalUrl'>
  ): Promise<BoxEntryOpenResult> {
    const session = this.requireSession(sessionId, options.ownerKey);
    const entry = session.entryMap.get(entryId);
    if (!entry) {
      throw createError('BOX_ENTRY_NOT_FOUND', `Box entry not found: ${entryId}`, { sessionId, entryId });
    }

    const locator = this.resolveEntryLocator(entry.url, session.extractedDir);
    if (locator.scheme === 'file:' && locator.filePath) {
      const exists = await this.pathExists(locator.filePath);
      if (!exists) {
        throw createError('BOX_RESOURCE_NOT_FOUND', `Document file is missing: ${entryId}`, { sessionId, entryId });
      }
      const documentKind = this.resolveDocumentKind(entry, locator);
      if (documentKind === 'box') {
        if (!options.openBoxFile) {
          throw createError('BOX_OPEN_FAILED', 'Current Host cannot open local box files for this box session.', {
            sessionId,
            entryId
          });
        }
        return options.openBoxFile(locator.filePath);
      }
      if (!options.openCardFile) {
        throw createError('BOX_OPEN_FAILED', 'Current Host cannot open local card files for this box session.', {
          sessionId,
          entryId
        });
      }
      return options.openCardFile(locator.filePath);
    }

    if (!options.openExternalUrl) {
      throw createError('BOX_OPEN_FAILED', 'Current Host cannot open external URLs for this box session.', {
        sessionId,
        entryId,
        url: entry.url
      });
    }

    await options.openExternalUrl(entry.url);
    return {
      mode: 'external',
      url: entry.url
    };
  }

  public async readBoxAsset(sessionId: string, assetPath: string, ownerKey: string): Promise<ResolvedRuntimeResource> {
    const session = this.requireSession(sessionId, ownerKey);
    const normalizedAssetPath = normalizeAssetPath(assetPath, 'assetPath');
    const absolutePath = path.join(session.extractedDir, normalizedAssetPath);
    const relative = path.relative(session.extractedDir, absolutePath);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw createError('BOX_ASSET_NOT_FOUND', `Box asset is outside package root: ${normalizedAssetPath}`, {
        sessionId,
        assetPath
      });
    }

    const exists = await this.pathExists(absolutePath);
    if (!exists) {
      throw createError('BOX_ASSET_NOT_FOUND', `Box asset not found: ${normalizedAssetPath}`, {
        sessionId,
        assetPath: normalizedAssetPath
      });
    }

    return {
      resourceUrl: this.createBoxSessionFileUrl(session, absolutePath),
      mimeType: this.mimeTypeForPath(normalizedAssetPath),
      cacheKey: `box-asset:${normalizedAssetPath}`
    };
  }

  public async prefetchEntries(
    sessionId: string,
    entryIds: string[],
    targets: PrefetchTarget[],
    options: BoxServiceResolveEntryResourceOptions
  ): Promise<{ ack: true }> {
    const session = this.requireSession(sessionId, options.ownerKey);
    const uniqueEntryIds = [...new Set(entryIds)];
    const uniqueTargets = [...new Set(targets)];

    for (const entryId of uniqueEntryIds) {
      if (!session.entryMap.has(entryId)) {
        throw createError('BOX_ENTRY_NOT_FOUND', `Box entry not found: ${entryId}`, { sessionId, entryId });
      }
    }

    const detailFields: EntryDetailField[] = [];
    if (uniqueTargets.includes('documentInfo')) {
      detailFields.push('documentInfo');
    }
    if (detailFields.length > 0) {
      await this.readEntryDetail(sessionId, uniqueEntryIds, detailFields, options);
    }

    for (const entryId of uniqueEntryIds) {
      if (uniqueTargets.includes('cover')) {
        await this.resolveEntryResource(
          sessionId,
          entryId,
          {
            kind: 'cover'
          },
          options
        ).catch(() => undefined);
      }
      if (uniqueTargets.includes('preview')) {
        await this.resolveEntryResource(
          sessionId,
          entryId,
          {
            kind: 'preview'
          },
          options
        ).catch(() => undefined);
      }
    }

    return { ack: true };
  }

  public async closeView(sessionId: string, ownerKey: string): Promise<{ ack: true }> {
    const session = this.requireSession(sessionId, ownerKey);
    this.sessions.delete(sessionId);
    await fs.rm(session.extractedDir, { recursive: true, force: true });
    return { ack: true };
  }

  private async loadArchivePackage(boxFile: string): Promise<LoadedArchivePackage> {
    const stats = await fs.stat(boxFile).catch(() => null);
    if (!stats?.isFile()) {
      throw createError('BOX_NOT_FOUND', `Box file not found: ${boxFile}`, { boxFile });
    }

    const entries = await this.zip.list(boxFile);
    const entrySet = new Set(entries.map((entry) => entry.path));
    const validationErrors = this.validateZipEntries(entries);
    if (validationErrors.length > 0) {
      throw createError('BOX_FORMAT_INVALID', 'Box format validation failed.', validationErrors);
    }

    const [metadataRaw, structureRaw, contentRaw] = await Promise.all([
      this.zip.readEntry(boxFile, '.box/metadata.yaml').then((buffer) => parseYamlRecord(buffer.toString('utf-8'), '.box/metadata.yaml')),
      this.zip.readEntry(boxFile, '.box/structure.yaml').then((buffer) => parseYamlRecord(buffer.toString('utf-8'), '.box/structure.yaml')),
      this.zip.readEntry(boxFile, '.box/content.yaml').then((buffer) => parseYamlRecord(buffer.toString('utf-8'), '.box/content.yaml'))
    ]);

    const normalized = this.normalizePackage(metadataRaw, structureRaw, contentRaw, entrySet);
    return {
      ...normalized,
      zipEntries: entrySet
    };
  }

  private async loadDirectoryPackage(boxDir: string): Promise<NormalizedBoxPackage> {
    const stats = await fs.stat(boxDir).catch(() => null);
    if (!stats?.isDirectory()) {
      throw createError('BOX_PACK_FAILED', `Box directory not found: ${boxDir}`, { boxDir });
    }

    const files = await collectDirectoryFiles(boxDir);
    const fileSet = new Set(files);
    for (const requiredPath of ['.box/metadata.yaml', '.box/structure.yaml', '.box/content.yaml', '.box/cover.html']) {
      if (!fileSet.has(requiredPath)) {
        throw createError('BOX_SCHEMA_INVALID', `Missing required path: ${requiredPath}`, { boxDir, requiredPath });
      }
    }

    const [metadataRaw, structureRaw, contentRaw] = await Promise.all([
      fs.readFile(path.join(boxDir, '.box/metadata.yaml'), 'utf-8').then((text) => parseYamlRecord(text, '.box/metadata.yaml')),
      fs.readFile(path.join(boxDir, '.box/structure.yaml'), 'utf-8').then((text) => parseYamlRecord(text, '.box/structure.yaml')),
      fs.readFile(path.join(boxDir, '.box/content.yaml'), 'utf-8').then((text) => parseYamlRecord(text, '.box/content.yaml'))
    ]);

    return this.normalizePackage(metadataRaw, structureRaw, contentRaw, fileSet);
  }

  private validateZipEntries(entries: ZipEntryMeta[]): string[] {
    const names = new Set(entries.map((entry) => entry.path));
    const errors: string[] = [];

    for (const requiredPath of ['.box/metadata.yaml', '.box/structure.yaml', '.box/content.yaml', '.box/cover.html']) {
      if (!names.has(requiredPath)) {
        errors.push(`Missing required path: ${requiredPath}`);
      }
    }

    for (const entry of entries) {
      if (entry.compressedSize !== entry.size) {
        errors.push(`ZIP entry must use store mode: ${entry.path}`);
      }
      if (entry.path.toLowerCase().endsWith('.box')) {
        errors.push(`Box package cannot embed box files: ${entry.path}`);
      }
    }

    return errors;
  }

  private normalizePackage(
    metadataRaw: Record<string, unknown>,
    structureRaw: Record<string, unknown>,
    contentRaw: Record<string, unknown>,
    knownFiles: Set<string>
  ): NormalizedBoxPackage {
    if ('box_type' in metadataRaw) {
      throw createError('BOX_SCHEMA_INVALID', 'metadata.yaml cannot contain legacy box_type.');
    }

    const metadata = this.normalizeMetadata(metadataRaw, knownFiles);
    const content = this.normalizeContent(contentRaw, knownFiles);
    const entries = this.normalizeEntries(structureRaw, knownFiles);

    if (metadata.activeLayoutType !== content.activeLayoutType) {
      throw createError('BOX_SCHEMA_INVALID', 'metadata.active_layout_type must equal content.active_layout_type.', {
        metadata: metadata.activeLayoutType,
        content: content.activeLayoutType
      });
    }

    const assets = sortObjectKeys(
      [...knownFiles].filter((filePath) => filePath.startsWith('assets/') && !filePath.endsWith('/'))
    );

    return {
      metadata,
      content,
      entries,
      assets
    };
  }

  private normalizeMetadata(raw: Record<string, unknown>, knownFiles: Set<string>): BoxMetadata {
    const chipStandardsVersion = asString(raw.chip_standards_version);
    const boxId = asString(raw.box_id);
    const name = asString(raw.name);
    const createdAt = asString(raw.created_at);
    const modifiedAt = asString(raw.modified_at);
    const activeLayoutType = asString(raw.active_layout_type);

    if (!chipStandardsVersion || !boxId || !name || !createdAt || !modifiedAt || !activeLayoutType) {
      throw createError('BOX_SCHEMA_INVALID', 'metadata.yaml is missing required fields.');
    }

    const metadata: BoxMetadata = {
      chipStandardsVersion,
      boxId: ensureBase62Id(boxId, 'metadata.box_id'),
      name,
      createdAt: ensureIsoUtc(createdAt, 'metadata.created_at'),
      modifiedAt: ensureIsoUtc(modifiedAt, 'metadata.modified_at'),
      activeLayoutType
    };

    const description = asString(raw.description);
    if (description) {
      metadata.description = description;
    }

    const coverRatio = asString(raw.cover_ratio);
    if (coverRatio) {
      metadata.coverRatio = coverRatio;
    }

    const tags = normalizeTags(raw.tags, 'metadata.tags');
    if (tags) {
      metadata.tags = tags;
    }

    const coverAssetValue = raw.cover_asset;
    if (typeof coverAssetValue !== 'undefined') {
      const normalizedCoverAsset = normalizeAssetPath(coverAssetValue, 'metadata.cover_asset');
      if (!knownFiles.has(normalizedCoverAsset)) {
        throw createError('BOX_SCHEMA_INVALID', `metadata.cover_asset does not exist: ${normalizedCoverAsset}`);
      }
      metadata.coverAsset = normalizedCoverAsset;
    }

    const owner = asString(raw.owner);
    if (owner) {
      metadata.owner = owner;
    }

    if (typeof raw.source !== 'undefined') {
      if (!isRecord(raw.source)) {
        throw createError('BOX_SCHEMA_INVALID', 'metadata.source must be an object.');
      }
      metadata.source = raw.source;
    }

    return metadata;
  }

  private normalizeContent(raw: Record<string, unknown>, knownFiles: Set<string>): BoxContent {
    const activeLayoutType = asString(raw.active_layout_type);
    if (!activeLayoutType) {
      throw createError('BOX_SCHEMA_INVALID', 'content.active_layout_type is required.');
    }

    const rawLayoutConfigs = raw.layout_configs;
    if (!isRecord(rawLayoutConfigs)) {
      throw createError('BOX_SCHEMA_INVALID', 'content.layout_configs must be an object.');
    }

    const layoutConfigs: Record<string, BoxLayoutConfig> = {};
    for (const [layoutType, configValue] of Object.entries(rawLayoutConfigs)) {
      if (!isRecord(configValue)) {
        throw createError('BOX_SCHEMA_INVALID', `layout config must be an object: ${layoutType}`);
      }
      const layoutConfig: BoxLayoutConfig = {};
      const schemaVersion = asString(configValue.schema_version);
      if (schemaVersion) {
        layoutConfig.schemaVersion = schemaVersion;
      }
      if (typeof configValue.props !== 'undefined') {
        if (!isRecord(configValue.props)) {
          throw createError('BOX_SCHEMA_INVALID', `layout_configs.${layoutType}.props must be an object.`);
        }
        layoutConfig.props = configValue.props;
      }
      if (typeof configValue.asset_refs !== 'undefined') {
        if (!Array.isArray(configValue.asset_refs)) {
          throw createError('BOX_SCHEMA_INVALID', `layout_configs.${layoutType}.asset_refs must be an array.`);
        }
        layoutConfig.assetRefs = configValue.asset_refs.map((item, index) => {
          const normalizedAssetPath = normalizeAssetPath(item, `layout_configs.${layoutType}.asset_refs[${index}]`);
          if (!knownFiles.has(normalizedAssetPath)) {
            throw createError('BOX_SCHEMA_INVALID', `layout asset reference not found: ${normalizedAssetPath}`);
          }
          return normalizedAssetPath;
        });
      }

      for (const [key, value] of Object.entries(configValue)) {
        if (key === 'schema_version' || key === 'props' || key === 'asset_refs') {
          continue;
        }
        layoutConfig[key] = value;
      }
      layoutConfigs[layoutType] = layoutConfig;
    }

    return {
      activeLayoutType,
      layoutConfigs
    };
  }

  private normalizeEntries(raw: Record<string, unknown>, knownFiles: Set<string>): BoxEntrySnapshot[] {
    if ('cards' in raw) {
      throw createError('BOX_SCHEMA_INVALID', 'structure.yaml cannot contain legacy cards field.');
    }
    const rawEntries = raw.entries;
    if (!Array.isArray(rawEntries)) {
      throw createError('BOX_SCHEMA_INVALID', 'structure.entries must be an array.');
    }

    const normalizedEntries: BoxEntrySnapshot[] = [];
    const seenEntryIds = new Set<string>();

    for (const [index, item] of rawEntries.entries()) {
      if (!isRecord(item)) {
        throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}] must be an object.`);
      }
      if ('internal' in item || 'external' in item || 'location' in item || 'path' in item) {
        throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}] contains legacy location fields.`);
      }

      const entryId = asString(item.entry_id);
      const url = asString(item.url);
      if (!entryId || !url || typeof item.enabled !== 'boolean') {
        throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}] is missing required fields.`);
      }
      const normalizedEntryId = ensureBase62Id(entryId, `structure.entries[${index}].entry_id`);
      if (seenEntryIds.has(normalizedEntryId)) {
        throw createError('BOX_SCHEMA_INVALID', `Duplicate box entry id: ${normalizedEntryId}`);
      }
      seenEntryIds.add(normalizedEntryId);
      this.assertSupportedUrl(url, `structure.entries[${index}].url`, knownFiles);

      const snapshot = this.normalizeEntrySnapshot(item.snapshot, knownFiles, index);
      if (isEmbeddedEntryUrl(url) && snapshot.contentType === 'chips/box') {
        throw createError(
          'BOX_SCHEMA_INVALID',
          `structure.entries[${index}] embedded entries cannot reference box documents.`
        );
      }
      const layoutHints = this.normalizeLayoutHints(item.layout_hints, index);

      normalizedEntries.push({
        entryId: normalizedEntryId,
        url,
        enabled: item.enabled,
        snapshot,
        layoutHints
      });
    }

    return normalizedEntries;
  }

  private normalizeEntrySnapshot(
    value: unknown,
    knownFiles: Set<string>,
    index: number
  ): BoxEntrySnapshot['snapshot'] {
    if (typeof value === 'undefined') {
      return {};
    }
    if (!isRecord(value)) {
      throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}].snapshot must be an object.`);
    }

    const snapshot: BoxEntrySnapshot['snapshot'] = {};
    if ('card_id' in value) {
      throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}].snapshot.card_id is no longer supported.`);
    }
    const documentId = asString(value.document_id);
    if (documentId) {
      snapshot.documentId = documentId;
    }
    const title = asString(value.title);
    if (title) {
      snapshot.title = title;
    }
    const summary = asString(value.summary);
    if (summary) {
      snapshot.summary = summary;
    }
    const tags = normalizeTags(value.tags, `structure.entries[${index}].snapshot.tags`);
    if (tags) {
      snapshot.tags = tags;
    }
    if (typeof value.cover !== 'undefined') {
      if (!isRecord(value.cover)) {
        throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}].snapshot.cover must be an object.`);
      }
      const mode = asString(value.cover.mode);
      if (mode !== 'asset' && mode !== 'runtime' && mode !== 'none') {
        throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}].snapshot.cover.mode is invalid.`);
      }
      const cover: NonNullable<BoxEntrySnapshot['snapshot']['cover']> = {
        mode
      };
      if (mode === 'asset') {
        const assetPath = normalizeAssetPath(value.cover.asset_path, `structure.entries[${index}].snapshot.cover.asset_path`);
        if (!knownFiles.has(assetPath)) {
          throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}].snapshot.cover.asset_path not found.`);
        }
        cover.assetPath = assetPath;
      }
      const mimeType = asString(value.cover.mime_type);
      if (mimeType) {
        cover.mimeType = mimeType;
      }
      const width = asFiniteNumber(value.cover.width);
      if (typeof width !== 'undefined') {
        cover.width = width;
      }
      const height = asFiniteNumber(value.cover.height);
      if (typeof height !== 'undefined') {
        cover.height = height;
      }
      snapshot.cover = cover;
    }
    const lastKnownModifiedAt = asString(value.last_known_modified_at);
    if (lastKnownModifiedAt) {
      snapshot.lastKnownModifiedAt = ensureIsoUtc(
        lastKnownModifiedAt,
        `structure.entries[${index}].snapshot.last_known_modified_at`
      );
    }
    const contentType = asString(value.content_type);
    if (contentType) {
      snapshot.contentType = contentType;
    }

    return snapshot;
  }

  private normalizeLayoutHints(value: unknown, index: number): BoxEntrySnapshot['layoutHints'] | undefined {
    if (typeof value === 'undefined') {
      return undefined;
    }
    if (!isRecord(value)) {
      throw createError('BOX_SCHEMA_INVALID', `structure.entries[${index}].layout_hints must be an object.`);
    }

    const layoutHints: NonNullable<BoxEntrySnapshot['layoutHints']> = {};
    const sortKeyValue = value.sort_key;
    if (typeof sortKeyValue === 'string' || typeof sortKeyValue === 'number') {
      layoutHints.sortKey = sortKeyValue;
    }
    const aspectRatio = asFiniteNumber(value.aspect_ratio);
    if (typeof aspectRatio !== 'undefined') {
      layoutHints.aspectRatio = aspectRatio;
    }
    const group = asString(value.group);
    if (group) {
      layoutHints.group = group;
    }
    const priority = asFiniteNumber(value.priority);
    if (typeof priority !== 'undefined') {
      layoutHints.priority = priority;
    }

    return Object.keys(layoutHints).length > 0 ? layoutHints : undefined;
  }

  private assertSupportedUrl(value: string, field: string, knownFiles: Set<string>): void {
    if (isEmbeddedEntryUrl(value)) {
      this.assertEmbeddedEntryPath(value, field, knownFiles);
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw createError('BOX_SCHEMA_INVALID', `${field} must be an absolute URL.`, { value });
    }

    if (!SUPPORTED_URL_SCHEMES.has(parsed.protocol)) {
      throw createError('BOX_URL_SCHEME_UNSUPPORTED', `${field} uses unsupported URL scheme.`, { value });
    }
    if (parsed.username || parsed.password) {
      throw createError('BOX_SCHEMA_INVALID', `${field} must not embed credentials.`, { value });
    }
  }

  private assertEmbeddedEntryPath(value: string, field: string, knownFiles: Set<string>): void {
    const normalized = this.normalizeEmbeddedRelativePath(value, field);
    if (!knownFiles.has(normalized)) {
      throw createError(
        'BOX_SCHEMA_INVALID',
        `${field} embedded document is missing in the box package: ${normalized}`,
        { value }
      );
    }
  }

  private normalizeEmbeddedRelativePath(value: string, field: string): string {
    const normalized = value.replace(/\\/g, '/').trim();
    if (!normalized) {
      throw createError('BOX_SCHEMA_INVALID', `${field} must be a non-empty embedded path.`, { value });
    }
    if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized)) {
      throw createError('BOX_SCHEMA_INVALID', `${field} embedded path must be relative.`, { value });
    }
    if (!normalized.toLowerCase().endsWith('.card')) {
      throw createError('BOX_SCHEMA_INVALID', `${field} embedded path must reference a .card file.`, { value });
    }
    const segments = normalized.split('/');
    if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
      throw createError('BOX_SCHEMA_INVALID', `${field} embedded path contains invalid path segments.`, { value });
    }
    return normalized;
  }

  private requireSession(sessionId: string, ownerKey: string): BoxSessionRecord {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw createError('BOX_VIEW_SESSION_NOT_FOUND', `Box view session not found: ${sessionId}`, { sessionId });
    }
    if (session.ownerKey !== ownerKey) {
      throw createError('BOX_LAYOUT_ACCESS_DENIED', 'Current caller cannot access this box session.', {
        sessionId
      });
    }
    return session;
  }

  private toSessionInfo(session: BoxSessionRecord): BoxSessionInfo {
    return {
      boxId: session.metadata.boxId,
      boxFile: session.boxFile,
      name: session.metadata.name,
      activeLayoutType: session.activeLayoutType,
      availableLayouts: session.availableLayouts,
      coverRatio: session.metadata.coverRatio,
      tags: session.metadata.tags,
      coverAsset: session.metadata.coverAsset,
      capabilities: {
        listEntries: true,
        readEntryDetail: true,
        renderEntryCover: true,
        resolveEntryResource: true,
        readBoxAsset: true,
        prefetchEntries: true,
        openEntry: true
      }
    };
  }

  private listEntriesInternal(session: BoxSessionRecord, query?: BoxEntryQuery): BoxEntryPage {
    const filtered = this.applyEntryQuery(session.entries, query);
    const offset = resolvePageCursor(query?.cursor);
    const limit = resolvePageLimit(query?.limit);
    const pageItems = filtered.slice(offset, offset + limit);
    const nextOffset = offset + pageItems.length;

    return {
      items: pageItems,
      total: filtered.length,
      nextCursor: nextOffset < filtered.length ? String(nextOffset) : undefined
    };
  }

  private applyEntryQuery(entries: BoxEntrySnapshot[], query?: BoxEntryQuery): BoxEntrySnapshot[] {
    let working = [...entries];

    const filter = query?.filter;
    if (filter) {
      if (typeof filter.enabled === 'boolean') {
        working = working.filter((entry) => entry.enabled === filter.enabled);
      }
      const group = asString(filter.group);
      if (group) {
        working = working.filter((entry) => entry.layoutHints?.group === group);
      }
      const text = asString(filter.text);
      if (text) {
        const lowered = text.toLowerCase();
        working = working.filter((entry) => {
          const haystack = [entry.snapshot.title, entry.snapshot.summary, entry.url, entry.entryId]
            .filter((item): item is string => typeof item === 'string')
            .join(' ')
            .toLowerCase();
          return haystack.includes(lowered);
        });
      }
      const tags = Array.isArray(filter.tags) ? filter.tags.filter((item): item is string => typeof item === 'string') : [];
      if (tags.length > 0) {
        working = working.filter((entry) => {
          const flattened = (entry.snapshot.tags ?? []).flatMap((item) => (Array.isArray(item) ? item : [item]));
          return tags.every((tag) => flattened.includes(tag));
        });
      }
    }

    const sort = query?.sort;
    if (!sort?.key) {
      return working;
    }

    const direction = sort.direction === 'desc' ? -1 : 1;
    working.sort((left, right) => {
      const compared = compareValues(this.resolveSortValue(left, sort.key), this.resolveSortValue(right, sort.key));
      if (compared !== 0) {
        return compared * direction;
      }
      return left.entryId.localeCompare(right.entryId);
    });
    return working;
  }

  private resolveSortValue(entry: BoxEntrySnapshot, key: string): unknown {
    if (key === 'entryId') {
      return entry.entryId;
    }
    if (key === 'title') {
      return entry.snapshot.title ?? '';
    }
    if (key === 'sortKey' || key === 'layoutHints.sortKey') {
      return entry.layoutHints?.sortKey ?? '';
    }
    if (key === 'priority' || key === 'layoutHints.priority') {
      return entry.layoutHints?.priority ?? 0;
    }
    if (key === 'lastKnownModifiedAt' || key === 'snapshot.lastKnownModifiedAt') {
      return entry.snapshot.lastKnownModifiedAt ?? '';
    }

    if (key.startsWith('snapshot.')) {
      return (entry.snapshot as Record<string, unknown>)[key.slice('snapshot.'.length)];
    }
    if (key.startsWith('layoutHints.')) {
      return (entry.layoutHints as Record<string, unknown> | undefined)?.[key.slice('layoutHints.'.length)];
    }
    return '';
  }

  private resolveEntryLocator(url: string, extractedDir?: string): EntryLocator {
    if (isEmbeddedEntryUrl(url)) {
      if (!extractedDir) {
        throw createError('BOX_RESOLVE_FAILED', `Embedded entry URL requires a box view session: ${url}`, { url });
      }
      const filePath = path.join(extractedDir, url);
      if (!isPathWithinRoot(extractedDir, filePath)) {
        throw createError('BOX_RESOLVE_FAILED', `Embedded entry path escapes the box package: ${url}`, { url });
      }
      return {
        scheme: 'file:',
        url,
        filePath
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw createError('BOX_RESOLVE_FAILED', `Invalid entry URL: ${url}`, { url });
    }

    if (!SUPPORTED_URL_SCHEMES.has(parsed.protocol)) {
      throw createError('BOX_URL_SCHEME_UNSUPPORTED', `Unsupported box entry URL scheme: ${parsed.protocol}`, { url });
    }

    if (parsed.protocol === 'file:') {
      return {
        scheme: parsed.protocol,
        url,
        filePath: fileURLToPath(parsed)
      };
    }
    return {
      scheme: parsed.protocol,
      url
    };
  }

  private resolveDocumentKind(entry: BoxEntrySnapshot, locator: EntryLocator): 'card' | 'box' {
    if (entry.snapshot.contentType === 'chips/box') {
      return 'box';
    }
    if (entry.snapshot.contentType === 'chips/card') {
      return 'card';
    }
    const pathLike = locator.filePath ?? locator.url;
    return path.extname(pathLike).toLowerCase() === '.box' ? 'box' : 'card';
  }

  private async readDocumentInfo(
    entry: BoxEntrySnapshot,
    locator: EntryLocator,
    options: BoxServiceReadEntryDetailOptions
  ): Promise<Record<string, unknown>> {
    if (locator.scheme !== 'file:' || !locator.filePath) {
      return {
        kind: 'remote',
        status: {
          state: 'invalid',
          exists: false,
          valid: false
        }
      };
    }

    const documentKind = this.resolveDocumentKind(entry, locator);
    if (documentKind === 'box') {
      return this.readBoxDocumentInfo(locator.filePath);
    }

    if (!options.readCardInfo) {
      return {
        kind: 'card',
        status: {
          state: 'missing',
          exists: false,
          valid: false
        }
      };
    }

    return {
      kind: 'card',
      ...(await options.readCardInfo(locator.filePath, ['status', 'metadata', 'cover'])).info
    };
  }

  private async readBoxDocumentInfo(boxFile: string): Promise<Record<string, unknown>> {
    const loaded = await this.loadArchivePackage(boxFile);
    const cover = await this.renderCover(boxFile);
    return {
      kind: 'box',
      status: {
        state: 'ready',
        exists: true,
        valid: true
      },
      metadata: {
        boxId: loaded.metadata.boxId,
        name: loaded.metadata.name,
        createdAt: loaded.metadata.createdAt,
        modifiedAt: loaded.metadata.modifiedAt,
        activeLayoutType: loaded.metadata.activeLayoutType,
        coverRatio: loaded.metadata.coverRatio,
        tags: loaded.metadata.tags
      },
      cover: {
        title: cover.title,
        resourceUrl: cover.coverUrl,
        mimeType: cover.mimeType,
        ratio: cover.ratio
      }
    };
  }

  private async getOrCreateExtractedCoverRoot(boxFile: string): Promise<string> {
    const normalizedBoxFile = path.resolve(boxFile);
    const cached = this.extractedCoverRoots.get(normalizedBoxFile);
    if (cached && await fs.stat(cached).then((stats) => stats.isDirectory()).catch(() => false)) {
      return cached;
    }

    const extractedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-box-cover-'));
    await this.zip.extract(normalizedBoxFile, extractedDir);
    this.extractedCoverRoots.set(normalizedBoxFile, extractedDir);
    return extractedDir;
  }

  private async readEntryStatus(locator: EntryLocator): Promise<Record<string, unknown>> {
    if (locator.scheme === 'file:' && locator.filePath) {
      const exists = await this.pathExists(locator.filePath);
      return {
        state: exists ? 'ready' : 'missing',
        scheme: 'file',
        url: locator.url
      };
    }

    return {
      state: 'remote',
      scheme: locator.scheme.replace(/:$/, ''),
      url: locator.url
    };
  }

  public resolveManagedDocumentFilePath(requestUrl: string): string | null {
    const managedScheme = this.managedDocumentScheme;
    if (!managedScheme) {
      return null;
    }

    let parsed: URL;
    try {
      parsed = new URL(requestUrl);
    } catch {
      return null;
    }

    if (parsed.protocol !== `${managedScheme}:`) {
      return null;
    }

    const pathSegments = decodeManagedUrlPathSegments(parsed.pathname);
    if (!pathSegments || pathSegments.length < 2) {
      return null;
    }

    const identifier = pathSegments[0];
    const relativePath = normalizeManagedRelativePath(pathSegments.slice(1).join('/'));
    if (!identifier || !relativePath) {
      return null;
    }

    if (parsed.hostname === 'session') {
      const session = this.renderSessionCache.get(identifier);
      if (!session) {
        return null;
      }

      const absolutePath = path.resolve(session.rootDir, relativePath);
      return isPathWithinRoot(session.rootDir, absolutePath) ? absolutePath : null;
    }

    if (parsed.hostname === 'box-session') {
      const session = this.sessions.get(identifier);
      if (!session) {
        return null;
      }

      const absolutePath = path.resolve(session.extractedDir, relativePath);
      return isPathWithinRoot(session.extractedDir, absolutePath) ? absolutePath : null;
    }

    if (parsed.hostname === 'box-cover') {
      const rootDir = this.boxCoverRootDirByToken.get(identifier);
      if (!rootDir) {
        return null;
      }

      const absolutePath = path.resolve(rootDir, relativePath);
      return isPathWithinRoot(rootDir, absolutePath) ? absolutePath : null;
    }

    return null;
  }

  private queryLayoutPlugins(): RenderableLayoutPluginRecord[] {
    const plugins = this.runtime?.query({ type: 'layout' }) ?? [];
    return plugins.filter(
      (record): record is RenderableLayoutPluginRecord =>
        Boolean(
          record.enabled
          && typeof record.manifest.entry === 'string'
          && record.manifest.entry.length > 0
          && typeof record.manifest.layout?.layoutType === 'string'
          && record.manifest.layout.layoutType.length > 0,
        ),
    );
  }

  private resolveLayoutPlugin(layoutType: string): RenderableLayoutPluginRecord {
    const normalizedLayoutType = layoutType.trim().toLowerCase();
    const plugin = this.queryLayoutPlugins().find(
      (record) => (record.manifest.layout?.layoutType ?? '').trim().toLowerCase() === normalizedLayoutType,
    );
    if (!plugin) {
      throw createError('BOX_LAYOUT_PLUGIN_NOT_FOUND', `No enabled layout plugin can render ${layoutType}.`, {
        layoutType,
      });
    }
    return plugin;
  }

  private async loadLayoutDescriptor(
    plugin: RenderableLayoutPluginRecord,
  ): Promise<NonNullable<LayoutPluginModule['layoutDefinition']>> {
    const module = await this.loadPluginModule(plugin);
    const descriptor = module.layoutDefinition;
    if (!descriptor) {
      throw createError('BOX_LAYOUT_PLUGIN_INVALID', `Layout plugin does not export layoutDefinition: ${plugin.manifest.id}`, {
        pluginId: plugin.manifest.id,
      });
    }
    if (descriptor.layoutType !== plugin.manifest.layout?.layoutType) {
      throw createError('BOX_LAYOUT_PLUGIN_INVALID', `Layout plugin layoutType does not match manifest: ${plugin.manifest.id}`, {
        pluginId: plugin.manifest.id,
        manifestLayoutType: plugin.manifest.layout?.layoutType,
        runtimeLayoutType: descriptor.layoutType,
      });
    }
    if (typeof descriptor.createDefaultConfig !== 'function'
      || typeof descriptor.normalizeConfig !== 'function'
      || typeof descriptor.validateConfig !== 'function'
      || typeof descriptor.renderView !== 'function') {
      throw createError('BOX_LAYOUT_PLUGIN_INVALID', `Layout plugin contract is incomplete: ${plugin.manifest.id}`, {
        pluginId: plugin.manifest.id,
      });
    }
    return descriptor;
  }

  private toLayoutDescriptorSummary(
    descriptor: NonNullable<LayoutPluginModule['layoutDefinition']>,
    plugin: RenderableLayoutPluginRecord,
  ): BoxLayoutDescriptorSummary {
    return {
      pluginId: descriptor.pluginId || plugin.manifest.id,
      layoutType: descriptor.layoutType,
      displayName: descriptor.displayName || plugin.manifest.layout?.displayName || plugin.manifest.name,
      description: descriptor.description || plugin.manifest.description,
      icon: descriptor.icon,
      defaultConfig: descriptor.normalizeConfig(descriptor.createDefaultConfig()),
    };
  }

  private async loadPluginModule(plugin: RenderableLayoutPluginRecord): Promise<LayoutPluginModule> {
    const entryPath = await this.resolvePluginEntryPath(plugin);
    const cacheKey = `${plugin.manifest.id}:${entryPath}`;
    const cached = this.moduleCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = (async () => {
      try {
        if (entryPath.endsWith('.mjs')) {
          return (await import(pathToFileURL(entryPath).href)) as LayoutPluginModule;
        }
        if (entryPath.endsWith('.js') || entryPath.endsWith('.ts')) {
          const bundled = await this.bundlePluginEntry(entryPath, plugin.installPath);
          if (bundled) {
            return bundled;
          }
        }
        const required = require(entryPath) as LayoutPluginModule;
        if (required && Object.keys(required).length > 0) {
          return required;
        }
      } catch (error) {
        const fallback = await this.bundlePluginEntry(entryPath, plugin.installPath);
        if (fallback) {
          return fallback;
        }
        throw error;
      }

      const fallback = await this.bundlePluginEntry(entryPath, plugin.installPath);
      if (fallback) {
        return fallback;
      }
      throw createError('BOX_LAYOUT_PLUGIN_LOAD_FAILED', `Failed to load layout plugin entry ${entryPath}.`, {
        pluginId: plugin.manifest.id,
        entryPath,
      });
    })();

    this.moduleCache.set(cacheKey, pending);
    return pending;
  }

  private async bundleLayoutPluginForBrowser(plugin: RenderableLayoutPluginRecord): Promise<string> {
    const entryPath = await this.resolvePluginEntryPath(plugin);
    const cacheKey = `${plugin.manifest.id}:${entryPath}:browser`;
    const cached = this.browserBundleCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = (async () => {
      const { build } = require('esbuild') as {
        build: (options: Record<string, unknown>) => Promise<{ outputFiles?: Array<{ text: string }> }>;
      };

      const result = await build({
        entryPoints: [entryPath],
        bundle: true,
        platform: 'browser',
        format: 'iife',
        globalName: 'ChipsBoxLayoutPlugin',
        write: false,
        absWorkingDir: plugin.installPath,
        logLevel: 'silent',
      });

      const code = result.outputFiles?.[0]?.text;
      if (!code) {
        throw createError('BOX_LAYOUT_PLUGIN_BUNDLE_FAILED', `Failed to bundle layout plugin ${plugin.manifest.id}.`, {
          pluginId: plugin.manifest.id,
          entryPath,
        });
      }

      return code;
    })();

    this.browserBundleCache.set(cacheKey, pending);
    return pending;
  }

  private async resolvePluginEntryPath(plugin: RenderableLayoutPluginRecord): Promise<string> {
    const declaredEntryPath = path.resolve(plugin.installPath, plugin.manifest.entry);
    const declaredStats = await this.safeStat(declaredEntryPath);
    if (declaredStats?.isFile()) {
      return declaredEntryPath;
    }

    const sourceOverride = await this.findWorkspaceSourceEntry(plugin.manifest.id);
    if (sourceOverride) {
      return sourceOverride;
    }

    throw createError('BOX_LAYOUT_PLUGIN_ENTRY_NOT_FOUND', `Layout plugin entry is missing: ${plugin.manifest.entry}`, {
      pluginId: plugin.manifest.id,
      entry: plugin.manifest.entry,
    });
  }

  private async findWorkspaceSourceEntry(pluginId: string): Promise<string | undefined> {
    const candidates = [
      path.join(this.workspaceRoot, 'Chips-BoxLayoutPlugin/grid-BLP'),
      path.join(this.workspaceRoot, 'Chips-Scaffold', 'chips-scaffold-boxlayout', 'templates', 'boxlayout-standard'),
    ];

    for (const root of candidates) {
      const rootStats = await this.safeStat(root);
      if (!rootStats?.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(root, 'manifest.yaml');
      const manifestStats = await this.safeStat(manifestPath);
      if (!manifestStats?.isFile()) {
        continue;
      }

      const manifest = yaml.parse(await fs.readFile(manifestPath, 'utf-8')) as Record<string, unknown> | null;
      if (!manifest || typeof manifest !== 'object') {
        continue;
      }
      if (asString(manifest.id) !== pluginId) {
        continue;
      }

      const entryPath = asString(manifest.entry);
      if (!entryPath) {
        continue;
      }

      const absoluteEntryPath = path.resolve(path.dirname(manifestPath), entryPath);
      const sourceStats = await this.safeStat(absoluteEntryPath);
      if (sourceStats?.isFile()) {
        return absoluteEntryPath;
      }
    }

    return undefined;
  }

  private async bundlePluginEntry(entryPath: string, pluginRoot: string): Promise<LayoutPluginModule | undefined> {
    try {
      const { build } = require('esbuild') as {
        build: (options: Record<string, unknown>) => Promise<{ outputFiles?: Array<{ text: string }> }>;
      };
      const result = await build({
        entryPoints: [entryPath],
        bundle: true,
        platform: 'browser',
        format: 'cjs',
        write: false,
        absWorkingDir: pluginRoot,
        logLevel: 'silent',
      });
      const code = result.outputFiles?.[0]?.text;
      if (!code) {
        return undefined;
      }

      const exportsObject: Record<string, unknown> = {};
      const moduleObject = { exports: exportsObject } as { exports: Record<string, unknown> };
      const factory = new Function('require', 'module', 'exports', code) as (
        requireFn: NodeRequire,
        moduleFn: { exports: Record<string, unknown> },
        exportsFn: Record<string, unknown>,
      ) => void;
      factory(require, moduleObject, exportsObject);
      return moduleObject.exports as LayoutPluginModule;
    } catch {
      return undefined;
    }
  }

  private async persistRenderSession(kind: string): Promise<{ sessionId: string; rootDir: string }> {
    const sessionId = `${kind}-${createId()}`;
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), `chips-${kind}-`));
    this.renderSessionCache.set(sessionId, {
      rootDir,
      createdAt: Date.now(),
    });
    return { sessionId, rootDir };
  }

  private async safeStat(filePath: string): Promise<import('node:fs').Stats | undefined> {
    try {
      return await fs.stat(filePath);
    } catch {
      return undefined;
    }
  }

  private createRenderSessionDocumentUrl(sessionId: string, absolutePath: string): string {
    if (!this.managedDocumentScheme) {
      return pathToFileURL(absolutePath).href;
    }

    const session = this.renderSessionCache.get(sessionId);
    if (!session) {
      return pathToFileURL(absolutePath).href;
    }

    const relativePath = normalizeManagedRelativePath(
      path.relative(session.rootDir, absolutePath).split(path.sep).join('/'),
    );
    if (!relativePath) {
      return pathToFileURL(absolutePath).href;
    }

    return `${this.managedDocumentScheme}://session/${encodeURIComponent(sessionId)}/${encodeManagedUrlPath(relativePath)}`;
  }

  private createBoxSessionFileUrl(session: BoxSessionRecord, absolutePath: string): string {
    if (!this.managedDocumentScheme) {
      return pathToFileURL(absolutePath).href;
    }

    const relativePath = normalizeManagedRelativePath(
      path.relative(session.extractedDir, absolutePath).split(path.sep).join('/'),
    );
    if (!relativePath) {
      return pathToFileURL(absolutePath).href;
    }

    return `${this.managedDocumentScheme}://box-session/${encodeURIComponent(session.sessionId)}/${encodeManagedUrlPath(relativePath)}`;
  }

  private createBoxCoverRootFileUrl(rootDir: string, relativePath: string): string {
    const normalizedRootDir = path.resolve(rootDir);
    const normalizedRelativePath = normalizeManagedRelativePath(relativePath);
    if (!normalizedRelativePath) {
      return pathToFileURL(path.resolve(normalizedRootDir, relativePath)).href;
    }

    if (!this.managedDocumentScheme) {
      return pathToFileURL(path.resolve(normalizedRootDir, normalizedRelativePath)).href;
    }

    const token = this.getOrCreateBoxCoverRootToken(normalizedRootDir);
    return `${this.managedDocumentScheme}://box-cover/${encodeURIComponent(token)}/${encodeManagedUrlPath(normalizedRelativePath)}`;
  }

  private getOrCreateBoxCoverRootToken(rootDir: string): string {
    const normalizedRootDir = path.resolve(rootDir);
    const cachedToken = this.boxCoverRootTokenByRootDir.get(normalizedRootDir);
    if (cachedToken) {
      return cachedToken;
    }

    const token = createId();
    this.boxCoverRootTokenByRootDir.set(normalizedRootDir, token);
    this.boxCoverRootDirByToken.set(token, normalizedRootDir);
    return token;
  }

  private async pathExists(targetPath: string): Promise<boolean> {
    const stats = await fs.stat(targetPath).catch(() => null);
    return Boolean(stats?.isFile());
  }

  private mimeTypeForDocumentFile(pathLike: string, contentType?: string): string {
    if (contentType === 'chips/box') {
      return BOX_MIME_TYPE;
    }
    if (contentType === 'chips/card') {
      return CARD_MIME_TYPE;
    }
    const extension = path.extname(pathLike).toLowerCase();
    if (extension === '.box') {
      return BOX_MIME_TYPE;
    }
    if (extension === '.card') {
      return CARD_MIME_TYPE;
    }
    return CARD_MIME_TYPE;
  }

  private mimeTypeForPath(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.png') {
      return 'image/png';
    }
    if (extension === '.jpg' || extension === '.jpeg') {
      return 'image/jpeg';
    }
    if (extension === '.webp') {
      return 'image/webp';
    }
    if (extension === '.svg') {
      return 'image/svg+xml';
    }
    if (extension === '.json') {
      return 'application/json';
    }
    if (extension === '.html') {
      return 'text/html';
    }
    if (extension === '.css') {
      return 'text/css';
    }
    if (extension === '.txt' || extension === '.md') {
      return 'text/plain';
    }
    if (extension === '.box') {
      return BOX_MIME_TYPE;
    }
    if (extension === '.card') {
      return CARD_MIME_TYPE;
    }
    return 'application/octet-stream';
  }
}
