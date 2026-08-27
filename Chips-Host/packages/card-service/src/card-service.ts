import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { createError } from '../../../src/shared/errors';
import type { PluginRecord, PluginRuntime } from '../../../src/runtime';
import { parseYamlLite } from '../../../src/shared/yaml-lite';
import {
  createThemeCssVariableDeclarations,
  normalizeThemeCssForBrowser
} from '../../../src/shared/theme-css-units';
import { createId, normalizeRelativeResourcePath } from '../../../src/shared';
import { CardPacker } from '../../card-packer/src';
import { evaluateRenderQualityGate } from '../../unified-rendering/src';
import type {
  RenderConsistencyResult,
  RenderNodeDiagnostic,
  RenderQualityGateResult,
  RenderTarget,
  RenderViewport,
  ThemeSnapshot
} from '../../unified-rendering/src';
import { StoreZipService, type ZipEntryPlan } from '../../zip-service/src';

export interface CardAst {
  metadata: Record<string, unknown>;
  structure: Record<string, unknown>;
  contentFiles: string[];
}

export interface CardRenderOptions {
  target?: RenderTarget;
  viewport?: Partial<RenderViewport>;
  theme?: ThemeSnapshot;
  themeCssText?: string;
  verifyConsistency?: boolean;
  locale?: string;
  mode?: 'view' | 'preview';
  interactionPolicy?: 'native' | 'delegate';
  resourceBaseUrl?: string;
}

export interface CardEditorRenderOptions {
  cardType: string;
  initialConfig?: Record<string, unknown>;
  baseCardId?: string;
  theme?: ThemeSnapshot;
  themeCssText?: string;
}

export interface CardBasecardRenderOptions {
  baseCardId: string;
  cardType: string;
  config: Record<string, unknown>;
  title?: string;
  resourceBaseUrl?: string;
  theme?: ThemeSnapshot;
  themeCssText?: string;
  locale?: string;
  interactionPolicy?: 'native' | 'delegate';
}

export interface RenderedCardView {
  title: string;
  body: string;
  documentUrl: string;
  sessionId: string;
  contentFiles: string[];
  target: RenderTarget;
  semanticHash: string;
  diagnostics: RenderNodeDiagnostic[];
  qualityGate: RenderQualityGateResult;
  consistency?: RenderConsistencyResult;
}

export interface RenderedCardEditorView {
  title: string;
  body: string;
  documentUrl: string;
  sessionId: string;
  cardType: string;
  pluginId: string;
  baseCardId?: string;
}

export interface RenderedCardCoverView {
  title: string;
  coverUrl: string;
  ratio?: string;
}

export interface RenderedBasecardView {
  title: string;
  body: string;
  cardType: string;
  pluginId: string;
  baseCardId: string;
}

export interface CardServiceOptions {
  runtime?: Pick<PluginRuntime, 'query'>;
  workspaceRoot?: string;
  managedDocumentScheme?: string;
}

interface CardPackageContext {
  rootDir: string;
  metadata: Record<string, unknown>;
  structure: Record<string, unknown>;
  contentFiles: string[];
  contentByNodeId: Map<string, ParsedContentFile>;
}

interface StructureNode {
  id: string;
  type: string;
}

interface ParsedContentFile {
  id: string;
  path: string;
  absolutePath: string;
  raw: string;
  parsed: Record<string, unknown>;
}

interface FrameErrorPayload {
  nodeId: string;
  code: string;
  message: string;
  stage?: string;
  details?: unknown;
}

interface RenderedBaseCardNode {
  nodeId: string;
  cardType: string;
  title: string;
  pluginId?: string;
  frameHtml?: string;
  frameSrc?: string;
  error?: FrameErrorPayload;
}

interface PersistentCardRootCacheEntry {
  rootDir: string;
  sourceMtimeMs: number;
  sourceSize: number;
}

interface RenderSessionEntry {
  rootDir: string;
  createdAt: number;
}

interface BaseCardPluginModule {
  basecardDefinition?: {
    normalizeConfig?(baseCardId: string, config: Record<string, unknown>): Record<string, unknown>;
    validateConfig?(config: Record<string, unknown>): { valid: boolean; errors: Record<string, string> };
    collectResourcePaths?(config: Record<string, unknown>): string[];
    createInitialConfig?(baseCardId: string): Record<string, unknown>;
  };
  renderBasecardView?: (ctx: {
    container: unknown;
    config: unknown;
    themeCssText?: string;
    resolveResourceUrl?: (resourcePath: string) => Promise<string>;
    releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
    openResource?: (input: {
      resourceId: string;
      mimeType?: string;
      title?: string;
      fileName?: string;
      payload?: Record<string, unknown>;
    }) => void;
  }) => unknown;
  renderBasecardEditor?: (ctx: {
    container: unknown;
    initialConfig: unknown;
    onChange: (next: unknown) => void;
    resolveResourceUrl?: (resourcePath: string) => Promise<string>;
    releaseResourceUrl?: (resourcePath: string) => Promise<void> | void;
    importResource?: (input: { file: File; preferredPath?: string }) => Promise<{ path: string }>;
    importArchiveBundle?: (input: {
      file: File;
      preferredRootDir?: string;
      entryFile?: string;
    }) => Promise<{ rootDir: string; entryFile: string; resourcePaths: string[] }>;
    deleteResource?: (resourcePath: string) => Promise<void>;
    convertTiffToPng?: (input: {
      resourcePath: string;
      outputPath: string;
      overwrite?: boolean;
    }) => Promise<{
      path: string;
      mimeType: 'image/png';
      sourceMimeType: 'image/tiff';
      width?: number;
      height?: number;
    }>;
  }) => unknown;
}

interface RenderablePluginRecord extends PluginRecord {
  manifest: PluginRecord['manifest'] & { entry: string };
}

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

const sanitizeRenderFileSegment = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || fallback;
};

const createRenderFileName = (prefix: string, value: string, index: number): string => {
  const label = sanitizeRenderFileSegment(value, `${prefix}-${index + 1}`);
  const hash = crypto.createHash('sha256').update(`${prefix}:${value}:${index}`).digest('hex').slice(0, 10);
  return `${String(index + 1).padStart(3, '0')}-${label}-${hash}.html`;
};

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

const isPathWithinRoot = (rootDir: string, absolutePath: string): boolean => {
  const relative = path.relative(path.resolve(rootDir), path.resolve(absolutePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
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

type CompositeInteractionPolicy = 'native' | 'delegate';

const createChildInteractionBridgeScript = (
  cardType: string,
  interactionPolicy: CompositeInteractionPolicy
): string => {
  return [
    `      const interactionPolicy = ${JSON.stringify(interactionPolicy)};`,
    `      const cardType = ${JSON.stringify(cardType)};`,
    '      const delegateInteractions = interactionPolicy === "delegate";',
    '      const normalizeZoomDelta = (raw) => {',
    '        const value = Number(raw);',
    '        if (!Number.isFinite(value)) {',
    '          return 0;',
    '        }',
    '        return Math.max(-0.45, Math.min(0.45, value));',
    '      };',
    '      const emitInteraction = (payload) => {',
    '        if (!delegateInteractions) {',
    '          return;',
    '        }',
    '        window.parent?.postMessage({',
    '          type: "chips.basecard:interaction",',
    '          payload: {',
    '            nodeId,',
    '            cardType,',
    '            ...payload,',
    '          },',
    '        }, "*");',
    '      };',
    '      let singleTouchPoint = null;',
    '      let multiTouchState = null;',
    '      const getTouchPoint = (touch) => ({ x: Number(touch?.clientX) || 0, y: Number(touch?.clientY) || 0 });',
    '      const getTouchCenter = (first, second) => ({',
    '        x: ((Number(first?.clientX) || 0) + (Number(second?.clientX) || 0)) / 2,',
    '        y: ((Number(first?.clientY) || 0) + (Number(second?.clientY) || 0)) / 2,',
    '      });',
    '      const getTouchDistance = (first, second) => Math.hypot(',
    '        (Number(first?.clientX) || 0) - (Number(second?.clientX) || 0),',
    '        (Number(first?.clientY) || 0) - (Number(second?.clientY) || 0)',
    '      );',
    '      if (delegateInteractions) {',
    '        document.documentElement.style.touchAction = "none";',
    '        document.body.style.touchAction = "none";',
    '        document.documentElement.style.overscrollBehavior = "none";',
    '        document.body.style.overscrollBehavior = "none";',
    '        document.addEventListener("wheel", (event) => {',
    '          const isZoomIntent = event.ctrlKey || event.metaKey || Math.abs(Number(event.deltaZ) || 0) > 0;',
    '          emitInteraction({',
    '            device: "wheel",',
    '            intent: isZoomIntent ? "zoom" : "scroll",',
    '            deltaX: Number(event.deltaX) || 0,',
    '            deltaY: Number(event.deltaY) || 0,',
    '            zoomDelta: isZoomIntent ? normalizeZoomDelta((Number(event.deltaY) || 0) * -0.0025) : undefined,',
    '            clientX: Number(event.clientX) || 0,',
    '            clientY: Number(event.clientY) || 0,',
    '            pointerCount: isZoomIntent ? 2 : 1,',
    '          });',
    '          if (event.cancelable) {',
    '            event.preventDefault();',
    '          }',
    '        }, { passive: false, capture: true });',
    '        document.addEventListener("touchstart", (event) => {',
    '          if (event.touches.length === 1) {',
    '            singleTouchPoint = getTouchPoint(event.touches[0]);',
    '            multiTouchState = null;',
    '            return;',
    '          }',
    '          if (event.touches.length >= 2) {',
    '            const center = getTouchCenter(event.touches[0], event.touches[1]);',
    '            multiTouchState = {',
    '              centerX: center.x,',
    '              centerY: center.y,',
    '              distance: getTouchDistance(event.touches[0], event.touches[1]),',
    '            };',
    '            singleTouchPoint = null;',
    '          }',
    '        }, { passive: false, capture: true });',
    '        document.addEventListener("touchmove", (event) => {',
    '          if (event.touches.length === 1) {',
    '            const nextPoint = getTouchPoint(event.touches[0]);',
    '            if (singleTouchPoint) {',
    '              const deltaX = singleTouchPoint.x - nextPoint.x;',
    '              const deltaY = singleTouchPoint.y - nextPoint.y;',
    '              if (deltaX !== 0 || deltaY !== 0) {',
    '                emitInteraction({',
    '                  device: "touch",',
    '                  intent: "scroll",',
    '                  deltaX,',
    '                  deltaY,',
    '                  clientX: nextPoint.x,',
    '                  clientY: nextPoint.y,',
    '                  pointerCount: 1,',
    '                });',
    '              }',
    '            }',
    '            singleTouchPoint = nextPoint;',
    '            multiTouchState = null;',
    '            if (event.cancelable) {',
    '              event.preventDefault();',
    '            }',
    '            return;',
    '          }',
    '          if (event.touches.length >= 2) {',
    '            const center = getTouchCenter(event.touches[0], event.touches[1]);',
    '            const distance = getTouchDistance(event.touches[0], event.touches[1]);',
    '            if (multiTouchState) {',
    '              const zoomDelta = normalizeZoomDelta(distance / Math.max(multiTouchState.distance, 1) - 1);',
    '              const deltaX = multiTouchState.centerX - center.x;',
    '              const deltaY = multiTouchState.centerY - center.y;',
    '              if (Math.abs(zoomDelta) > 0.015) {',
    '                emitInteraction({',
    '                  device: "touch",',
    '                  intent: "zoom",',
    '                  deltaX: 0,',
    '                  deltaY: 0,',
    '                  zoomDelta,',
    '                  clientX: center.x,',
    '                  clientY: center.y,',
    '                  pointerCount: 2,',
    '                });',
    '              } else if (deltaX !== 0 || deltaY !== 0) {',
    '                emitInteraction({',
    '                  device: "touch",',
    '                  intent: "scroll",',
    '                  deltaX,',
    '                  deltaY,',
    '                  clientX: center.x,',
    '                  clientY: center.y,',
    '                  pointerCount: 2,',
    '                });',
    '              }',
    '            }',
    '            multiTouchState = {',
    '              centerX: center.x,',
    '              centerY: center.y,',
    '              distance,',
    '            };',
    '            singleTouchPoint = null;',
    '            if (event.cancelable) {',
    '              event.preventDefault();',
    '            }',
    '          }',
    '        }, { passive: false, capture: true });',
    '        document.addEventListener("touchend", (event) => {',
    '          if (event.touches.length === 0) {',
    '            singleTouchPoint = null;',
    '            multiTouchState = null;',
    '            return;',
    '          }',
    '          if (event.touches.length === 1) {',
    '            singleTouchPoint = getTouchPoint(event.touches[0]);',
    '            multiTouchState = null;',
    '          }',
    '        }, { passive: false, capture: true });',
    '        document.addEventListener("touchcancel", () => {',
    '          singleTouchPoint = null;',
    '          multiTouchState = null;',
    '        }, { passive: false, capture: true });',
    '      }',
  ].join('\n');
};

const createCompositeInteractionBridgeScript = (
  cardId: string,
  interactionPolicy: CompositeInteractionPolicy
): string => {
  return [
    `      const cardId = ${JSON.stringify(cardId)};`,
    `      const interactionPolicy = ${JSON.stringify(interactionPolicy)};`,
    '      const delegateInteractions = interactionPolicy === "delegate";',
    '      const normalizeZoomDelta = (raw) => {',
    '        const value = Number(raw);',
    '        if (!Number.isFinite(value)) {',
    '          return 0;',
    '        }',
    '        return Math.max(-0.45, Math.min(0.45, value));',
    '      };',
    '      const emitCompositeInteraction = (payload) => {',
    '        if (!delegateInteractions) {',
    '          return;',
    '        }',
    '        emit("chips.composite:interaction", {',
    '          cardId,',
    '          ...payload,',
    '        });',
    '      };',
    '      const resolveShellInteractionSource = (target) => {',
    '        const node = typeof target?.closest === "function"',
    '          ? target.closest(".chips-composite__node")',
    '          : null;',
    '        if (node && node.dataset?.state === "degraded") {',
    '          return {',
    '            source: "degraded-node",',
    '            nodeId: node.dataset.nodeId ?? "",',
    '            cardType: node.dataset.cardType ?? "",',
    '          };',
    '        }',
    '        return {',
    '          source: "composite-shell",',
    '          nodeId: node?.dataset?.nodeId ?? "",',
    '          cardType: node?.dataset?.cardType ?? "",',
    '        };',
    '      };',
    '      let singleTouchPoint = null;',
    '      let multiTouchState = null;',
    '      const getTouchPoint = (touch) => ({ x: Number(touch?.clientX) || 0, y: Number(touch?.clientY) || 0 });',
    '      const getTouchCenter = (first, second) => ({',
    '        x: ((Number(first?.clientX) || 0) + (Number(second?.clientX) || 0)) / 2,',
    '        y: ((Number(first?.clientY) || 0) + (Number(second?.clientY) || 0)) / 2,',
    '      });',
    '      const getTouchDistance = (first, second) => Math.hypot(',
    '        (Number(first?.clientX) || 0) - (Number(second?.clientX) || 0),',
    '        (Number(first?.clientY) || 0) - (Number(second?.clientY) || 0)',
    '      );',
    '      if (delegateInteractions) {',
    '        document.documentElement.style.touchAction = "none";',
    '        document.body.style.touchAction = "none";',
    '        document.documentElement.style.overscrollBehavior = "none";',
    '        document.body.style.overscrollBehavior = "none";',
    '        document.addEventListener("wheel", (event) => {',
    '          const sourceInfo = resolveShellInteractionSource(event.target);',
    '          const isZoomIntent = event.ctrlKey || event.metaKey || Math.abs(Number(event.deltaZ) || 0) > 0;',
    '          emitCompositeInteraction({',
    '            ...sourceInfo,',
    '            device: "wheel",',
    '            intent: isZoomIntent ? "zoom" : "scroll",',
    '            deltaX: Number(event.deltaX) || 0,',
    '            deltaY: Number(event.deltaY) || 0,',
    '            zoomDelta: isZoomIntent ? normalizeZoomDelta((Number(event.deltaY) || 0) * -0.0025) : undefined,',
    '            clientX: Number(event.clientX) || 0,',
    '            clientY: Number(event.clientY) || 0,',
    '            pointerCount: isZoomIntent ? 2 : 1,',
    '          });',
    '          if (event.cancelable) {',
    '            event.preventDefault();',
    '          }',
    '        }, { passive: false, capture: true });',
    '        document.addEventListener("touchstart", (event) => {',
    '          if (event.touches.length === 1) {',
    '            singleTouchPoint = getTouchPoint(event.touches[0]);',
    '            multiTouchState = null;',
    '            return;',
    '          }',
    '          if (event.touches.length >= 2) {',
    '            const center = getTouchCenter(event.touches[0], event.touches[1]);',
    '            multiTouchState = {',
    '              centerX: center.x,',
    '              centerY: center.y,',
    '              distance: getTouchDistance(event.touches[0], event.touches[1]),',
    '            };',
    '            singleTouchPoint = null;',
    '          }',
    '        }, { passive: false, capture: true });',
    '        document.addEventListener("touchmove", (event) => {',
    '          const sourceInfo = resolveShellInteractionSource(event.target);',
    '          if (event.touches.length === 1) {',
    '            const nextPoint = getTouchPoint(event.touches[0]);',
    '            if (singleTouchPoint) {',
    '              const deltaX = singleTouchPoint.x - nextPoint.x;',
    '              const deltaY = singleTouchPoint.y - nextPoint.y;',
    '              if (deltaX !== 0 || deltaY !== 0) {',
    '                emitCompositeInteraction({',
    '                  ...sourceInfo,',
    '                  device: "touch",',
    '                  intent: "scroll",',
    '                  deltaX,',
    '                  deltaY,',
    '                  clientX: nextPoint.x,',
    '                  clientY: nextPoint.y,',
    '                  pointerCount: 1,',
    '                });',
    '              }',
    '            }',
    '            singleTouchPoint = nextPoint;',
    '            multiTouchState = null;',
    '            if (event.cancelable) {',
    '              event.preventDefault();',
    '            }',
    '            return;',
    '          }',
    '          if (event.touches.length >= 2) {',
    '            const center = getTouchCenter(event.touches[0], event.touches[1]);',
    '            const distance = getTouchDistance(event.touches[0], event.touches[1]);',
    '            if (multiTouchState) {',
    '              const zoomDelta = normalizeZoomDelta(distance / Math.max(multiTouchState.distance, 1) - 1);',
    '              const deltaX = multiTouchState.centerX - center.x;',
    '              const deltaY = multiTouchState.centerY - center.y;',
    '              if (Math.abs(zoomDelta) > 0.015) {',
    '                emitCompositeInteraction({',
    '                  ...sourceInfo,',
    '                  device: "touch",',
    '                  intent: "zoom",',
    '                  deltaX: 0,',
    '                  deltaY: 0,',
    '                  zoomDelta,',
    '                  clientX: center.x,',
    '                  clientY: center.y,',
    '                  pointerCount: 2,',
    '                });',
    '              } else if (deltaX !== 0 || deltaY !== 0) {',
    '                emitCompositeInteraction({',
    '                  ...sourceInfo,',
    '                  device: "touch",',
    '                  intent: "scroll",',
    '                  deltaX,',
    '                  deltaY,',
    '                  clientX: center.x,',
    '                  clientY: center.y,',
    '                  pointerCount: 2,',
    '                });',
    '              }',
    '            }',
    '            multiTouchState = {',
    '              centerX: center.x,',
    '              centerY: center.y,',
    '              distance,',
    '            };',
    '            singleTouchPoint = null;',
    '            if (event.cancelable) {',
    '              event.preventDefault();',
    '            }',
    '          }',
    '        }, { passive: false, capture: true });',
    '        document.addEventListener("touchend", (event) => {',
    '          if (event.touches.length === 0) {',
    '            singleTouchPoint = null;',
    '            multiTouchState = null;',
    '            return;',
    '          }',
    '          if (event.touches.length === 1) {',
    '            singleTouchPoint = getTouchPoint(event.touches[0]);',
    '            multiTouchState = null;',
    '          }',
    '        }, { passive: false, capture: true });',
    '        document.addEventListener("touchcancel", () => {',
    '          singleTouchPoint = null;',
    '          multiTouchState = null;',
    '        }, { passive: false, capture: true });',
    '      }',
  ].join('\n');
};

const createConsistencySnapshot = (semanticHash: string): RenderConsistencyResult => ({
  consistent: true,
  hashByTarget: {
    'app-root': semanticHash,
    'card-iframe': semanticHash,
    'module-slot': semanticHash,
    'offscreen-render': semanticHash
  },
  mismatches: []
});

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
};

const parseCardYamlRecord = (raw: string, filePath: string): Record<string, unknown> => {
  try {
    return asRecord(yaml.parse(raw));
  } catch (error) {
    throw createError('CARD_SCHEMA_INVALID', `Failed to parse card YAML: ${filePath}`, {
      filePath,
      cause: error instanceof Error ? error.message : String(error),
    });
  }
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const normalizeRichTextRuntimeConfig = (
  config: Record<string, unknown>,
  fallbackId: string,
  locale: string
): Record<string, unknown> => {
  const id = asString(config.id) ?? fallbackId;
  const theme = asString(config.theme) ?? '';
  const contentSource = asString(config.content_source) === 'file' ? 'file' : 'inline';

  if (contentSource === 'file') {
    return {
      id,
      card_type: 'RichTextCard',
      theme,
      locale,
      content_format: 'markdown',
      content_source: 'file',
      content_file: asString(config.content_file) ?? ''
    };
  }

  return {
    id,
    card_type: 'RichTextCard',
    theme,
    locale,
    content_format: 'markdown',
    content_source: 'inline',
    content_text: typeof config.content_text === 'string' ? config.content_text : ''
  };
};

const createThemeVariablesCss = (theme: ThemeSnapshot): string => {
  const declarations = createThemeCssVariableDeclarations(theme.tokens);

  if (declarations.length === 0) {
    return ':root {}';
  }

  return [':root {', ...declarations, '}'].join('\n');
};

const joinStyleBlocks = (...blocks: Array<string | undefined>): string => {
  return blocks
    .map((block) => normalizeThemeCssForBrowser(block?.trim() ?? ''))
    .filter((block) => block.length > 0)
    .join('\n\n');
};

const createBasecardThemeCss = (theme: ThemeSnapshot, themeCssText?: string): string => {
  return joinStyleBlocks(
    themeCssText,
    createThemeVariablesCss(theme),
    [
      'html, body { margin: 0; padding: 0; background: transparent; }',
      'body {',
      '  font: 15px/1.7 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  color: var(--chips-sys-color-on-surface, #111111);',
      '}',
      '.chips-basecard {',
      '  box-sizing: border-box;',
      '  width: 100%;',
      '  background: var(--chips-comp-card-shell-root-surface, var(--chips-sys-color-surface, #ffffff));',
      '  padding: 22px 24px;',
      '}',
      '.chips-basecard__body { color: var(--chips-sys-color-on-surface, #111111); }',
      '.chips-basecard__body > :first-child { margin-top: 0; }',
      '.chips-basecard__body > :last-child { margin-bottom: 0; }',
      '.chips-basecard__body a { color: var(--chips-sys-color-primary, #0a84ff); }',
      '.chips-basecard__body img { max-width: 100%; height: auto; border-radius: 10px; }',
      '.chips-basecard__body blockquote {',
      '  margin: 16px 0;',
      '  padding: 0 0 0 16px;',
      '  border-left: 3px solid var(--chips-comp-card-shell-border-color, rgba(17, 17, 17, 0.16));',
      '}',
      '.chips-basecard__body hr {',
      '  border: none;',
      '  border-top: 1px solid var(--chips-comp-card-shell-border-color, rgba(17, 17, 17, 0.16));',
      '  margin: 18px 0;',
      '}',
      '.chips-basecard__body code {',
      '  padding: 1px 6px;',
      '  border-radius: 6px;',
      '  background: rgba(0, 0, 0, 0.05);',
      '}',
      '.chips-basecard__body pre {',
      '  overflow: auto;',
      '  padding: 14px;',
      '  border-radius: 10px;',
      '  background: rgba(0, 0, 0, 0.05);',
      '}'
    ].join('\n')
  );
};

const createBasecardEditorThemeCss = (theme: ThemeSnapshot, themeCssText?: string): string => {
  return joinStyleBlocks(
    themeCssText,
    createThemeVariablesCss(theme),
    [
      'html, body { margin: 0; padding: 0; width: 100%; height: 100%; min-height: 0; overflow: hidden; background: transparent; }',
      'body {',
      '  font: 14px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  color: var(--chips-sys-color-on-surface, #111111);',
      '  background: var(--chips-sys-color-surface, #ffffff);',
      '}',
      '#chips-basecard-editor-root { width: 100%; height: 100%; min-height: 0; box-sizing: border-box; display: flex; overflow: hidden; }',
      '.chips-basecard-editor {',
      '  box-sizing: border-box;',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 12px;',
      '  width: 100%;',
      '  height: 100%;',
      '  min-height: 0;',
      '  overflow: hidden;',
      '  padding: 14px 16px 16px;',
      '  background: var(--chips-sys-color-surface, #ffffff);',
      '}',
      '.chips-basecard-editor__toolbar-shell { flex: 0 0 auto; width: 100%; }',
      '.chips-basecard-editor__toolbar-panel {',
      '  display: flex;',
      '  flex-direction: column;',
      '  gap: 10px;',
      '  width: 100%;',
      '  min-height: 56px;',
      '  padding: 10px 12px;',
      '  border: 1px solid var(--chips-comp-card-shell-border-color, rgba(17, 17, 17, 0.16));',
      '  border-radius: 18px;',
      '  background: var(--chips-comp-card-shell-root-surface, var(--chips-sys-color-surface, #ffffff));',
      '  box-shadow: 0 8px 22px rgba(17, 17, 17, 0.08);',
      '}',
      '.chips-basecard-editor__toolbar-header { display: flex; align-items: center; justify-content: flex-end; min-height: 32px; }',
      '.chips-basecard-editor__toolbar-content { display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: flex-start; width: 100%; }',
      '.chips-basecard-editor[data-toolbar-state="collapsed"] .chips-basecard-editor__toolbar-panel { min-height: 44px; padding: 6px 10px; border-radius: 16px; }',
      '.chips-basecard-editor[data-toolbar-state="collapsed"] .chips-basecard-editor__toolbar-content { display: none; }',
      '.chips-basecard-editor__richtext,',
      '.chips-basecard-editor__surface,',
      '.chips-basecard-editor__toolbar-toggle,',
      '.chips-basecard-editor__toolbar-button,',
      '.chips-basecard-editor__toolbar-select,',
      '.chips-basecard-editor__toolbar-color {',
      '  font: inherit;',
      '  color: inherit;',
      '  background: var(--chips-comp-card-shell-root-surface, var(--chips-sys-color-surface, #ffffff));',
      '  border: 1px solid var(--chips-comp-card-shell-border-color, rgba(17, 17, 17, 0.16));',
      '  border-radius: 12px;',
      '}',
      '.chips-basecard-editor__toolbar-toggle {',
      '  min-height: 32px;',
      '  padding: 0 10px;',
      '  border-radius: 999px;',
      '  cursor: pointer;',
      '}',
      '.chips-basecard-editor__toolbar-group { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }',
      '.chips-basecard-editor__surface-frame { flex: 1; min-height: 0; width: 100%; overflow: hidden; }',
      '.chips-basecard-editor__surface { width: 100%; height: 100%; min-height: 0; overflow: auto; }',
      '.chips-basecard-editor__richtext { min-height: 100%; padding: 20px 24px 56px; outline: none; }',
      '.chips-basecard-editor__toolbar-button {',
      '  min-width: 36px;',
      '  min-height: 36px;',
      '  padding: 0 10px;',
      '  cursor: pointer;',
      '}',
      '.chips-basecard-editor__toolbar-button:hover {',
      '  background: color-mix(in srgb, var(--chips-sys-color-primary, #0a84ff) 8%, var(--chips-sys-color-surface, #ffffff));',
      '}',
      '.chips-basecard-editor__errors {',
      '  border-radius: 12px;',
      '  padding: 12px 14px;',
      '  background: color-mix(in srgb, var(--chips-sys-color-error, #ff3b30) 10%, var(--chips-sys-color-surface, #ffffff));',
      '  color: var(--chips-sys-color-error, #ff3b30);',
      '}'
    ].join('\n')
  );
};

const createCompositeThemeCss = (theme: ThemeSnapshot, themeCssText?: string): string => {
  return joinStyleBlocks(
    themeCssText,
    createThemeVariablesCss(theme),
    [
      'html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }',
      'body {',
      '  background: var(--chips-sys-color-surface, #ffffff);',
      '  color: var(--chips-sys-color-on-surface, #111111);',
      '  font: 15px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;',
      '  overflow-x: hidden;',
      '}',
      '.chips-composite { width: 100%; max-width: none; margin: 0; padding: 0; box-sizing: border-box; }',
      '.chips-composite__stack { display: grid; gap: 16px; }',
      '.chips-composite__node { min-width: 0; }',
      'body[data-mode="preview"] .chips-composite__node[data-state="ready"],',
      'body[data-mode="preview"] .chips-composite__node[data-state="degraded"] {',
      '  cursor: pointer;',
      '}',
      '.chips-composite__frame { display: block; width: 100%; min-height: 96px; border: 0; background: transparent; }',
      '.chips-composite__degraded { padding: 22px 24px; color: color-mix(in srgb, var(--chips-sys-color-on-surface, #111111) 72%, white 28%); }',
      '.chips-composite__degraded strong { display: block; margin-bottom: 8px; color: var(--chips-sys-color-on-surface, #111111); }',
      '.chips-composite__degraded p { margin: 0; }'
    ].join('\n')
  );
};

const createBasecardFrameDocument = (options: {
  baseCardId: string;
  cardType: string;
  title: string;
  pluginId: string;
  pluginBundleCode: string;
  config: Record<string, unknown>;
  themeCssText: string;
  locale?: string;
  interactionPolicy: CompositeInteractionPolicy;
  resourceBaseUrl?: string;
  managedDocumentScheme?: string;
}): string => {
  const {
    baseCardId,
    cardType,
    title,
    pluginId,
    pluginBundleCode,
    config,
    themeCssText,
    locale,
    interactionPolicy,
    resourceBaseUrl,
    managedDocumentScheme,
  } = options;
  const contentTitle = title || cardType;
  const documentLocale = asString(locale) ?? 'zh-CN';
  const scriptNonce = createDocumentScriptNonce();
  const allowedManagedProtocol = normalizeManagedDocumentScheme(managedDocumentScheme);
  const managedSource = allowedManagedProtocol ? `${allowedManagedProtocol}:` : '';

  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(documentLocale)}">`,
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; connect-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; font-src data: file: http: https:${managedSource ? ` ${managedSource}` : ''}; media-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; child-src about: file: http: https: blob:${managedSource ? ` ${managedSource}` : ''}; frame-src about: file: http: https: blob:${managedSource ? ` ${managedSource}` : ''}; object-src 'none';" />`,
    ...(resourceBaseUrl ? [`  <base href="${escapeHtml(resourceBaseUrl)}" />`] : []),
    `  <title>${escapeHtml(contentTitle)}</title>`,
    '  <style>',
    '    html, body {',
    '      margin: 0;',
    '      padding: 0;',
    '      width: 100%;',
    '      min-height: 100%;',
    '      background: transparent !important;',
    '    }',
    '    body {',
    '      overflow: hidden;',
    '    }',
    '    #chips-basecard-root {',
    '      width: 100%;',
    '      min-height: 0;',
    '      box-sizing: border-box;',
    '    }',
    '    [data-chips-basecard-frame-root="true"] {',
    '      width: 100%;',
    '      min-height: 0;',
    '      box-sizing: border-box;',
    '    }',
    '  </style>',
    '</head>',
    `<body data-node-id="${escapeHtml(baseCardId)}" data-card-type="${escapeHtml(cardType)}" data-plugin-id="${escapeHtml(pluginId)}" data-interaction-policy="${escapeHtml(interactionPolicy)}">`,
    '  <div id="chips-basecard-root" data-chips-basecard-frame-root="true"></div>',
    `  <script nonce="${scriptNonce}">`,
    pluginBundleCode,
    '  </script>',
    `  <script nonce="${scriptNonce}">`,
    '    (() => {',
    `      const nodeId = ${JSON.stringify(baseCardId)};`,
    `      const baseCardType = ${JSON.stringify(cardType)};`,
    `      const pluginId = ${JSON.stringify(pluginId)};`,
    `      const config = ${escapeInlineJson(config)};`,
    `      const themeCssText = ${escapeInlineJson(themeCssText)};`,
    `      const resourceBaseUrl = ${JSON.stringify(resourceBaseUrl ?? '')};`,
    '      const container = document.getElementById("chips-basecard-root");',
    '      const emit = (type, payload) => {',
    "        window.parent?.postMessage({ type, payload }, '*');",
    '      };',
    '      const normalizeRelativeResourcePath = (resourcePath) => {',
    '        if (typeof resourcePath !== "string") {',
    '          return null;',
    '        }',
    '        const normalized = resourcePath.replace(/\\\\/g, "/").trim();',
    '        if (!normalized) {',
    '          return null;',
    '        }',
    '        const segments = normalized',
    '          .replace(/^\\.?\\//, "")',
    '          .split("/")',
    '          .filter((segment) => segment.length > 0 && segment !== ".");',
    '        if (segments.length === 0 || segments.some((segment) => segment === "..")) {',
    '          return null;',
    '        }',
    '        return segments.join("/");',
    '      };',
    '      const resolveRuntimeResourceBaseUrl = () => {',
    '        if (!resourceBaseUrl) {',
    '          return "";',
    '        }',
    '        try {',
    '          return new URL(resourceBaseUrl, window.location.href).toString();',
    '        } catch {',
    '          return "";',
    '        }',
    '      };',
    '      const resolveResourceUrl = async (resourcePath) => {',
    '        const normalizedResourcePath = normalizeRelativeResourcePath(resourcePath);',
    '        if (!normalizedResourcePath) {',
    '          throw new Error(`Invalid base card resource path: ${String(resourcePath)}`);',
    '        }',
    '        const runtimeResourceBaseUrl = resolveRuntimeResourceBaseUrl();',
    '        if (runtimeResourceBaseUrl) {',
    '          return new URL(normalizedResourcePath, runtimeResourceBaseUrl).toString();',
    '        }',
    '        return normalizedResourcePath;',
    '      };',
    '      const releaseResourceUrl = () => undefined;',
    '      const resolveOpenResourceId = (resourceId) => {',
    '        const normalizedResourceId = typeof resourceId === "string" ? resourceId.trim() : "";',
    '        if (!normalizedResourceId) {',
    '          return "";',
    '        }',
    '        try {',
    '          return new URL(normalizedResourceId).toString();',
    '        } catch {',
    '          const normalizedResourcePath = normalizeRelativeResourcePath(normalizedResourceId);',
    '          if (!normalizedResourcePath) {',
    '            return normalizedResourceId;',
    '          }',
    '          const runtimeResourceBaseUrl = resolveRuntimeResourceBaseUrl();',
    '          if (runtimeResourceBaseUrl) {',
    '            try {',
    '              return new URL(normalizedResourcePath, runtimeResourceBaseUrl).toString();',
    '            } catch {',
    '              return normalizedResourceId;',
    '            }',
    '          }',
    '          return normalizedResourcePath;',
    '        }',
    '      };',
    '      const openResource = (input) => {',
    '        if (!input || typeof input !== "object") {',
    '          return;',
    '        }',
    '        if (typeof input.resourceId !== "string" || input.resourceId.trim().length === 0) {',
    '          return;',
    '        }',
    '        const resourceId = resolveOpenResourceId(input.resourceId);',
    '        if (!resourceId) {',
    '          return;',
    '        }',
    '        const structuredPayload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)',
    '          ? input.payload',
    '          : undefined;',
    "        emit('chips.basecard:resource-open', {",
    '          nodeId,',
    '          resourceId,',
    '          mimeType: typeof input.mimeType === "string" ? input.mimeType : undefined,',
    '          title: typeof input.title === "string" ? input.title : undefined,',
    '          fileName: typeof input.fileName === "string" ? input.fileName : undefined,',
    '          payload: structuredPayload,',
    "          intent: 'view',",
    '        });',
    '      };',
    '      let pendingHeightTask = 0;',
    '      const emitHeight = () => {',
    '        const height = Math.max(',
    '          64,',
    '          document.documentElement?.scrollHeight ?? 0,',
    '          document.body?.scrollHeight ?? 0,',
    '          document.documentElement?.offsetHeight ?? 0,',
    '          document.body?.offsetHeight ?? 0,',
    '          container?.scrollHeight ?? 0,',
    '          container?.offsetHeight ?? 0',
    '        );',
    "        emit('chips.basecard:height', { nodeId, height });",
    '      };',
    '      const scheduleEmitHeight = () => {',
    '        if (pendingHeightTask) {',
    '          return;',
    '        }',
    '        const schedule = typeof window.requestAnimationFrame === "function"',
    '          ? window.requestAnimationFrame.bind(window)',
    '          : (callback) => window.setTimeout(callback, 0);',
    '        pendingHeightTask = schedule(() => {',
    '          pendingHeightTask = 0;',
    '          emitHeight();',
    '        });',
    '      };',
    '      const emitSelect = (source) => {',
    "        emit('chips.basecard:select', { nodeId, source });",
    '      };',
    "      window.addEventListener('load', () => {",
    '        emitHeight();',
    '        window.setTimeout(scheduleEmitHeight, 50);',
    '        window.setTimeout(scheduleEmitHeight, 200);',
    '      });',
    "      window.addEventListener('resize', scheduleEmitHeight);",
    "      document.addEventListener('pointerdown', () => emitSelect('pointer'), { capture: true });",
    "      if ('ResizeObserver' in window) {",
    '        const observer = new ResizeObserver(() => scheduleEmitHeight());',
    '        if (container) {',
    '          observer.observe(container);',
    '        }',
    '        if (document.body) {',
    '          observer.observe(document.body);',
    '        }',
    '        if (document.documentElement) {',
    '          observer.observe(document.documentElement);',
    '        }',
    '      }',
    createChildInteractionBridgeScript(cardType, interactionPolicy),
    '      try {',
    '        const plugin = globalThis.ChipsBasecardPlugin || {};',
    '        if (typeof plugin.renderBasecardView !== "function") {',
    "          throw new Error('Plugin does not export renderBasecardView.');",
    '        }',
    '        plugin.renderBasecardView({',
    '          container,',
    '          config,',
    '          themeCssText,',
    '          resolveResourceUrl,',
    '          releaseResourceUrl,',
    '          openResource,',
    '        });',
    '        scheduleEmitHeight();',
    '      } catch (error) {',
    '        const message = error instanceof Error ? error.message : String(error);',
    '        if (container) {',
    '          const pre = document.createElement("pre");',
    '          pre.textContent = message;',
    '          pre.style.margin = "0";',
    '          pre.style.padding = "20px";',
    '          pre.style.whiteSpace = "pre-wrap";',
    '          pre.style.color = "var(--chips-sys-color-error, #ff3b30)";',
    '          container.replaceChildren(pre);',
    '        }',
    "        emit('chips.basecard:error', {",
    '          nodeId,',
    "          code: 'CARD_NODE_RENDER_FAILED',",
    '          message,',
    "          stage: 'render-commit',",
    '          details: { cardType: baseCardType, pluginId },',
    '        });',
    '        scheduleEmitHeight();',
    '      }',
    '    })();',
    '  </script>',
    '</body>',
    '</html>',
  ].join('\n');
};

const createEditorFrameDocument = (options: {
  cardType: string;
  title: string;
  pluginBundleCode: string;
  initialConfig: Record<string, unknown>;
  pluginId: string;
  baseCardId?: string;
  themeCssText: string;
  managedDocumentScheme?: string;
}): string => {
  const {
    cardType,
    title,
    pluginBundleCode,
    initialConfig,
    pluginId,
    baseCardId,
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
    `  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; connect-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; font-src data: file: http: https:${managedSource ? ` ${managedSource}` : ''}; media-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; child-src about: file: http: https: blob:${managedSource ? ` ${managedSource}` : ''}; frame-src about: file: http: https: blob:${managedSource ? ` ${managedSource}` : ''}; object-src 'none';" />`,
    `  <title>${escapeHtml(title)}</title>`,
    `  <style>${themeCssText}</style>`,
    '</head>',
    `<body data-card-type="${escapeHtml(cardType)}" data-plugin-id="${escapeHtml(pluginId)}" data-base-card-id="${escapeHtml(baseCardId ?? '')}">`,
    '  <div id="chips-basecard-editor-root"></div>',
    `  <script nonce="${scriptNonce}">`,
    pluginBundleCode,
    '  </script>',
    `  <script nonce="${scriptNonce}">`,
    '    (() => {',
    `      const initialConfig = ${escapeInlineJson(initialConfig)};`,
    `      const cardType = ${JSON.stringify(cardType)};`,
    `      const pluginId = ${JSON.stringify(pluginId)};`,
    `      const baseCardId = ${JSON.stringify(baseCardId ?? '')};`,
    '      const container = document.getElementById("chips-basecard-editor-root");',
    '      const emit = (type, payload) => {',
    "        window.parent?.postMessage({ type, payload }, '*');",
    '      };',
    '      let resourceRequestCounter = 0;',
    '      const pendingResourceRequests = new Map();',
    '      const nextResourceRequestId = (action) => `${action}-${Date.now()}-${++resourceRequestCounter}`;',
    '      const requestResource = (action, payload) => {',
    '        return new Promise((resolve, reject) => {',
    '          const requestId = nextResourceRequestId(action);',
    '          const timer = window.setTimeout(() => {',
    '            pendingResourceRequests.delete(requestId);',
    '            reject(new Error(`Card editor resource request timed out: ${action}`));',
    '          }, 30000);',
    '          pendingResourceRequests.set(requestId, { resolve, reject, timer });',
    "          emit('chips.card-editor:resource-request', { requestId, action, baseCardId, cardType, pluginId, ...payload });",
    '        });',
    '      };',
    '      window.addEventListener("message", (event) => {',
    '        const data = event.data;',
    '        if (!data || typeof data !== "object") {',
    '          return;',
    '        }',
    '        if (data.type !== "chips.card-editor:resource-response") {',
    '          return;',
    '        }',
    '        const payload = data.payload ?? {};',
    '        const requestId = typeof payload.requestId === "string" ? payload.requestId : "";',
    '        if (!requestId) {',
    '          return;',
    '        }',
    '        const pending = pendingResourceRequests.get(requestId);',
    '        if (!pending) {',
    '          return;',
    '        }',
    '        window.clearTimeout(pending.timer);',
    '        pendingResourceRequests.delete(requestId);',
    '        if (payload.ok === false) {',
    '          const message = typeof payload.message === "string" && payload.message.length > 0',
    '            ? payload.message',
    '            : "Card editor resource request failed.";',
    '          pending.reject(new Error(message));',
    '          return;',
    '        }',
    '        pending.resolve(payload.result);',
    '      });',
    '      const releaseResourceUrl = (resourcePath) => {',
    "        emit('chips.card-editor:resource-release', { baseCardId, cardType, pluginId, resourcePath });",
    '      };',
    '      const emitHeight = () => {',
    '        const height = Math.max(',
    '          240,',
    '          document.documentElement?.scrollHeight ?? 0,',
    '          document.body?.scrollHeight ?? 0,',
    '          document.documentElement?.offsetHeight ?? 0,',
    '          document.body?.offsetHeight ?? 0',
    '        );',
    "        emit('chips.card-editor:resize', { baseCardId, height });",
    '      };',
    '      try {',
    '        const plugin = globalThis.ChipsBasecardPlugin || {};',
    '        if (typeof plugin.renderBasecardEditor !== "function") {',
    "          throw new Error('Plugin does not export renderBasecardEditor.');",
    '        }',
    '        plugin.renderBasecardEditor({',
    '          container,',
    '          initialConfig,',
    '          onChange(next) {',
    "            emit('chips.card-editor:change', { baseCardId, cardType, pluginId, config: next });",
    '            window.setTimeout(emitHeight, 0);',
    '          },',
    '          resolveResourceUrl(resourcePath) {',
    "            return requestResource('resolve', { resourcePath });",
    '          },',
    '          releaseResourceUrl,',
    '          importResource(input) {',
    "            return requestResource('import', { preferredPath: input?.preferredPath, file: input?.file });",
    '          },',
    '          importArchiveBundle(input) {',
    "            return requestResource('importArchiveBundle', { preferredRootDir: input?.preferredRootDir, entryFile: input?.entryFile, file: input?.file });",
    '          },',
    '          deleteResource(resourcePath) {',
    "            return requestResource('delete', { resourcePath });",
    '          },',
    '          convertTiffToPng(input) {',
    "            return requestResource('convertTiffToPng', { resourcePath: input?.resourcePath, outputPath: input?.outputPath, overwrite: input?.overwrite });",
    '          },',
    '        });',
    "        emit('chips.card-editor:ready', { baseCardId, cardType, pluginId });",
    '        emitHeight();',
    "        if ('ResizeObserver' in window && document.body) {",
    '          const observer = new ResizeObserver(() => emitHeight());',
    '          observer.observe(document.body);',
    '        }',
    '      } catch (error) {',
    '        const message = error instanceof Error ? error.message : String(error);',
    "        emit('chips.card-editor:error', { baseCardId, cardType, pluginId, code: 'CARD_EDITOR_RENDER_FAILED', message });",
    '        const pre = document.createElement("pre");',
    '        pre.textContent = message;',
    '        pre.style.margin = "0";',
    '        pre.style.padding = "20px";',
    '        pre.style.whiteSpace = "pre-wrap";',
    '        pre.style.color = "var(--chips-sys-color-error, #ff3b30)";',
    '        container?.replaceChildren(pre);',
    '        emitHeight();',
    '      }',
    '    })();',
    '  </script>',
    '</body>',
    '</html>'
  ].join('\n');
};

const createCompositeDocument = (
  cardId: string,
  title: string,
  target: RenderTarget,
  semanticHash: string,
  theme: ThemeSnapshot,
  themeCssText: string | undefined,
  locale: string,
  nodes: RenderedBaseCardNode[],
  mode: 'view' | 'preview',
  interactionPolicy: CompositeInteractionPolicy,
  managedDocumentScheme?: string,
  resourceBaseUrl?: string,
): string => {
  const scriptNonce = createDocumentScriptNonce();
  const allowedManagedProtocol = normalizeManagedDocumentScheme(managedDocumentScheme);
  const managedSource = allowedManagedProtocol ? `${allowedManagedProtocol}:` : '';
  const nodeMarkup = nodes
    .map((node) => {
      if (node.frameSrc) {
        const frameLoading = target === 'offscreen-render' ? 'eager' : 'lazy';
        return [
          `<section class="chips-composite__node" data-node-id="${escapeHtml(node.nodeId)}" data-card-type="${escapeHtml(node.cardType)}" data-plugin-id="${escapeHtml(node.pluginId ?? '')}" data-state="ready">`,
          `  <iframe class="chips-composite__frame" data-node-id="${escapeHtml(node.nodeId)}" title="${escapeHtml(node.title || node.cardType)}" loading="${frameLoading}" sandbox="allow-scripts allow-popups" src="${escapeHtml(node.frameSrc)}"></iframe>`,
          '</section>'
        ].join('\n');
      }

      const message = node.error?.message ?? 'Base card failed to render.';
      return [
        `<section class="chips-composite__node" data-node-id="${escapeHtml(node.nodeId)}" data-card-type="${escapeHtml(node.cardType)}" data-plugin-id="${escapeHtml(node.pluginId ?? '')}" data-state="degraded">`,
        '  <div class="chips-composite__degraded">',
        `    <strong>${escapeHtml(node.title || node.cardType || node.nodeId)}</strong>`,
        `    <p>${escapeHtml(message)}</p>`,
        '  </div>',
        '</section>'
      ].join('\n');
    })
    .join('\n');

  const nodeErrors = nodes
    .filter((node) => node.error)
    .map((node) => node.error) as FrameErrorPayload[];

  return [
    '<!doctype html>',
    `<html lang="${escapeHtml(locale)}">`,
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src file: http: https: data: blob:${managedSource ? ` ${managedSource}` : ''}; style-src 'unsafe-inline'; script-src 'nonce-${scriptNonce}'; font-src data: file: http: https:${managedSource ? ` ${managedSource}` : ''}; child-src 'self' file: http: https:${managedSource ? ` ${managedSource}` : ''}; frame-src 'self' file: http: https:${managedSource ? ` ${managedSource}` : ''}; object-src 'none';" />`,
    `  <title>${escapeHtml(title)}</title>`,
    `  <style>${createCompositeThemeCss(theme, themeCssText)}</style>`,
    '</head>',
    `<body data-target="${escapeHtml(target)}" data-card-id="${escapeHtml(cardId)}" data-semantic-hash="${escapeHtml(semanticHash)}" data-mode="${escapeHtml(mode)}" data-interaction-policy="${escapeHtml(interactionPolicy)}">`,
    '  <main class="chips-composite">',
    `    <section class="chips-composite__stack">${nodeMarkup}</section>`,
    '  </main>',
    `  <script id="__chips-node-errors" type="application/json" nonce="${scriptNonce}">${escapeInlineJson(nodeErrors)}</script>`,
    `  <script nonce="${scriptNonce}">`,
    '    (() => {',
    '      const frameList = Array.from(document.querySelectorAll(".chips-composite__frame"));',
    '      const frameByNodeId = new Map(frameList.map((frame) => [frame.dataset.nodeId ?? "", frame]));',
    '      const nodeById = new Map(Array.from(document.querySelectorAll(".chips-composite__node")).map((node) => [node.dataset.nodeId ?? "", node]));',
    '      const errorPayload = JSON.parse(document.getElementById("__chips-node-errors")?.textContent ?? "[]");',
    '      const totalNodeCount = nodeById.size;',
      '      const failedNodePayloads = new Map(errorPayload.map((payload) => [typeof payload?.nodeId === "string" ? payload.nodeId : "", payload]).filter(([nodeId]) => Boolean(nodeId)));',
    '      const failedNodeIds = new Set(failedNodePayloads.keys());',
    '      const isPreviewMode = document.body.dataset.mode === "preview";',
    '      let remaining = frameList.length;',
    '      let readySent = false;',
    '      let fatalSent = false;',
    '      let resizeScheduled = false;',
    '      let pendingResizeReason = "initial";',
    '      const emit = (type, payload) => {',
    "        window.parent?.postMessage({ type, payload }, '*');",
    '      };',
    '      const compositeDataset = document.body?.dataset;',
    '      if (compositeDataset) {',
    '        compositeDataset.chipsCompositeReady = frameList.length === 0 ? "true" : "false";',
    '        compositeDataset.chipsCompositeNodeCount = String(totalNodeCount);',
    '        compositeDataset.chipsCompositePendingFrameCount = String(remaining);',
    '      }',
    '      const markCompositeResize = (reason, height) => {',
    '        if (!compositeDataset) {',
    '          return;',
    '        }',
    '        compositeDataset.chipsCompositeLastResizeAt = String(Date.now());',
    '        compositeDataset.chipsCompositeLastResizeReason = reason;',
    '        compositeDataset.chipsCompositeLastHeight = String(Math.max(240, Math.ceil(height)));',
    '      };',
    '      const markCompositeReady = (payload) => {',
    '        if (!compositeDataset) {',
    '          return;',
    '        }',
    '        compositeDataset.chipsCompositeReady = "true";',
    '        compositeDataset.chipsCompositeReadyAt = String(Date.now());',
    '        compositeDataset.chipsCompositePendingFrameCount = String(Math.max(0, remaining));',
    '        compositeDataset.chipsCompositeReadyFallback = payload?.fallback === true ? "true" : "false";',
    '      };',
    '      const markFrameRenderReady = (frame, status, height) => {',
    '        if (!frame?.dataset) {',
    '          return;',
    '        }',
    '        frame.dataset.renderReady = "true";',
    '        frame.dataset.renderReadyAt = String(Date.now());',
    '        frame.dataset.renderStatus = status;',
    '        if (Number.isFinite(height)) {',
    '          frame.dataset.renderHeight = String(Math.max(96, Math.ceil(height)));',
    '        }',
    '      };',
    createCompositeInteractionBridgeScript(cardId, interactionPolicy),
    '      const getCompositeHeight = () => {',
    '        const stack = document.querySelector(".chips-composite__stack");',
    '        const main = document.querySelector(".chips-composite");',
    '        return Math.max(',
    '          240,',
    '          document.documentElement?.scrollHeight ?? 0,',
    '          document.body?.scrollHeight ?? 0,',
    '          document.documentElement?.offsetHeight ?? 0,',
    '          document.body?.offsetHeight ?? 0,',
    '          stack?.scrollHeight ?? 0,',
    '          main?.scrollHeight ?? 0',
    '        );',
    '      };',
    '      const emitCompositeResize = (reason) => {',
    '        const nextHeight = Math.max(240, Math.ceil(getCompositeHeight()));',
    '        markCompositeResize(reason, nextHeight);',
    "        emit('chips.composite:resize', {",
    '          height: nextHeight,',
    '          nodeCount: totalNodeCount,',
    '          reason,',
    '        });',
    '      };',
    '      const scheduleCompositeResize = (reason) => {',
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
    '          emitCompositeResize(pendingResizeReason);',
    '        });',
    '      };',
    '      const emitFatalIfAllNodesFailed = () => {',
    '        if (fatalSent || totalNodeCount === 0 || failedNodeIds.size !== totalNodeCount) {',
    '          return;',
    '        }',
    '        fatalSent = true;',
    "        emit('chips.composite:fatal-error', { code: 'CARD_RENDER_FAILED', message: 'Composite card failed to render all nodes.', details: Array.from(failedNodePayloads.values()) });",
    '      };',
    '      const emitNodeSelect = (nodeId, source = "composite") => {',
    '        if (!isPreviewMode || !nodeId) {',
    '          return;',
    '        }',
    '        const node = nodeById.get(nodeId);',
    '        if (!node) {',
    '          return;',
    '        }',
    '        emit("chips.composite:node-select", {',
    '          nodeId,',
    '          cardType: node.dataset.cardType ?? "",',
    '          pluginId: node.dataset.pluginId || undefined,',
    '          state: node.dataset.state ?? "ready",',
    '          source,',
    '        });',
    '      };',
    '      const markFrameSettled = () => {',
    '        remaining = Math.max(0, remaining - 1);',
    '        if (compositeDataset) {',
    '          compositeDataset.chipsCompositePendingFrameCount = String(remaining);',
    '        }',
    '        scheduleCompositeResize("node-load");',
    '        if (remaining === 0 && !readySent) {',
    '          readySent = true;',
    '          const payload = { nodeCount: frameList.length };',
    '          markCompositeReady(payload);',
    "          emit('chips.composite:ready', payload);",
    '          scheduleCompositeResize("ready");',
    '        }',
    '      };',
    '      const handleFrameFailure = (frame, payload, status = "load-error") => {',
    '        const nodeId = typeof payload?.nodeId === "string" ? payload.nodeId : frame?.dataset?.nodeId ?? "";',
    '        const node = nodeById.get(nodeId);',
    '        if (node) {',
    '          node.dataset.state = "degraded";',
    '        }',
    '        if (nodeId) {',
    '          failedNodeIds.add(nodeId);',
    '          failedNodePayloads.set(nodeId, payload);',
    '        }',
    '        markFrameRenderReady(frame, status);',
    "        emit('chips.composite:node-error', payload);",
    '        emitFatalIfAllNodesFailed();',
    '        if (frame.dataset.loaded === "true") {',
    '          return;',
    '        }',
    '        frame.dataset.loaded = "true";',
    '        markFrameSettled();',
    '      };',
    '      for (const payload of errorPayload) {',
    "        emit('chips.composite:node-error', payload);",
    '      }',
    '      emitFatalIfAllNodesFailed();',
    '      scheduleCompositeResize("initial");',
    '      for (const frame of frameList) {',
    '        frame.addEventListener("load", () => {',
    '          if (frame.dataset.loaded === "true") {',
    '            return;',
    '          }',
    '          frame.dataset.loaded = "true";',
    '          markFrameSettled();',
    '        });',
    '        frame.addEventListener("error", () => {',
    '          const nodeId = frame.dataset.nodeId ?? "";',
    "          const payload = { nodeId, code: 'IFRAME_LOAD_FAILED', message: 'Base card iframe failed to load.', stage: 'render-commit' };",
    '          handleFrameFailure(frame, payload, "load-error");',
    '        });',
    '      }',
    '      if (frameList.length === 0 && !readySent) {',
    '        readySent = true;',
    '        const payload = { nodeCount: 0 };',
    '        markCompositeReady(payload);',
    "        emit('chips.composite:ready', payload);",
    '        scheduleCompositeResize("ready");',
    '      }',
    '      if (isPreviewMode) {',
    '        for (const node of nodeById.values()) {',
    '          if (node.dataset.state === "degraded") {',
    '            node.addEventListener("click", () => {',
    '              emitNodeSelect(node.dataset.nodeId ?? "", "degraded");',
    '            });',
    '          }',
    '        }',
    '      }',
    '      window.addEventListener("message", (event) => {',
    '        const data = event.data;',
    '        if (!data || typeof data !== "object") {',
    '          return;',
    '        }',
    '        if (data.type === "chips.basecard:error") {',
    '          const payload = data.payload ?? {};',
    '          const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "";',
    '          if (!nodeId) {',
    '            return;',
    '          }',
    '          const node = nodeById.get(nodeId);',
    '          if (node) {',
    '            node.dataset.state = "degraded";',
    '          }',
    '          const frame = frameByNodeId.get(nodeId);',
    '          if (frame) {',
    '            markFrameRenderReady(frame, "degraded");',
    '          }',
    '          failedNodeIds.add(nodeId);',
    '          failedNodePayloads.set(nodeId, payload);',
    "          emit('chips.composite:node-error', payload);",
    '          emitFatalIfAllNodesFailed();',
    '          scheduleCompositeResize("node-height");',
    '          return;',
    '        }',
    '        if (data.type === "chips.basecard:height") {',
    '          const payload = data.payload ?? {};',
    '          const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "";',
    '          const height = Number(payload.height);',
    '          if (!nodeId || !Number.isFinite(height)) {',
    '            return;',
    '          }',
    '          const frame = frameByNodeId.get(nodeId);',
    '          if (!frame) {',
    '            return;',
    '          }',
    '          const nextHeight = Math.max(96, Math.ceil(height));',
    '          frame.style.height = `${nextHeight}px`;',
    '          markFrameRenderReady(frame, "ready", nextHeight);',
    '          scheduleCompositeResize("node-height");',
    '          return;',
    '        }',
    '        if (data.type === "chips.basecard:interaction") {',
    '          if (!delegateInteractions) {',
    '            return;',
    '          }',
    '          const payload = data.payload ?? {};',
    '          const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "";',
    '          const frame = frameByNodeId.get(nodeId);',
    '          if (!frame) {',
    '            return;',
    '          }',
    '          if (frame.contentWindow && event.source && event.source !== frame.contentWindow) {',
    '            return;',
    '          }',
    '          const node = nodeById.get(nodeId);',
    '          const rect = typeof frame.getBoundingClientRect === "function"',
    '            ? frame.getBoundingClientRect()',
    '            : { left: 0, top: 0 };',
    '          emitCompositeInteraction({',
    '            nodeId,',
    '            cardType: typeof payload.cardType === "string" ? payload.cardType : (node?.dataset?.cardType ?? ""),',
    '            source: "basecard-frame",',
    '            device: payload.device === "touch" ? "touch" : "wheel",',
    '            intent: payload.intent === "zoom" ? "zoom" : "scroll",',
    '            deltaX: Number(payload.deltaX) || 0,',
    '            deltaY: Number(payload.deltaY) || 0,',
    '            zoomDelta: payload.intent === "zoom" ? normalizeZoomDelta(payload.zoomDelta) : undefined,',
    '            clientX: Math.max(0, (Number(payload.clientX) || 0) + (Number(rect.left) || 0)),',
    '            clientY: Math.max(0, (Number(payload.clientY) || 0) + (Number(rect.top) || 0)),',
    '            pointerCount: Math.max(1, Number(payload.pointerCount) || 1),',
    '          });',
    '          return;',
    '        }',
    '        if (data.type === "chips.basecard:select") {',
    '          const payload = data.payload ?? {};',
    '          const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "";',
    '          const source = typeof payload.source === "string" ? payload.source : "basecard";',
    '          emitNodeSelect(nodeId, source);',
    '          return;',
    '        }',
    '        if (data.type === "chips.basecard:resource-open") {',
    '          const payload = data.payload ?? {};',
    '          const nodeId = typeof payload.nodeId === "string" ? payload.nodeId : "";',
    '          const resourceId = typeof payload.resourceId === "string" ? payload.resourceId : "";',
    '          if (!nodeId || !resourceId) {',
    '            return;',
    '          }',
    '          const frame = frameByNodeId.get(nodeId);',
    '          if (!frame) {',
    '            return;',
    '          }',
    '          if (frame.contentWindow && event.source && event.source !== frame.contentWindow) {',
    '            return;',
    '          }',
    '          const node = nodeById.get(nodeId);',
    '          const structuredPayload = payload.payload && typeof payload.payload === "object" && !Array.isArray(payload.payload)',
    '            ? payload.payload',
    '            : undefined;',
    '          emit("chips.composite:resource-open", {',
    '            nodeId,',
    '            cardType: node?.dataset?.cardType ?? "",',
    '            pluginId: node?.dataset?.pluginId || undefined,',
    '            intent: typeof payload.intent === "string" ? payload.intent : "view",',
    '            resourceId,',
    '            mimeType: typeof payload.mimeType === "string" ? payload.mimeType : undefined,',
    '            title: typeof payload.title === "string" ? payload.title : undefined,',
    '            fileName: typeof payload.fileName === "string" ? payload.fileName : undefined,',
    '            payload: structuredPayload,',
    '          });',
    '        }',
    '      });',
    "      if ('ResizeObserver' in window) {",
    '        const observer = new ResizeObserver(() => {',
    '          scheduleCompositeResize("resize-observer");',
    '        });',
    '        if (document.body) {',
    '          observer.observe(document.body);',
    '        }',
    '        if (document.documentElement) {',
    '          observer.observe(document.documentElement);',
    '        }',
    '      }',
    '      window.setTimeout(() => {',
    '        if (!readySent) {',
    '          readySent = true;',
    '          const payload = { nodeCount: frameList.length, fallback: true };',
    '          markCompositeReady(payload);',
    '          for (const frame of frameList) {',
    '            if (frame.dataset.loaded === "true" && frame.dataset.renderReady !== "true") {',
    '              markFrameRenderReady(frame, "fallback");',
    '            }',
    '          }',
    "          emit('chips.composite:ready', payload);",
    '          scheduleCompositeResize("ready");',
    '        }',
    '      }, 1500);',
    '    })();',
    '  </script>',
    '</body>',
    '</html>'
  ].join('\n');
};

const parseStructureNodes = (structure: Record<string, unknown>, contentByNodeId: Map<string, ParsedContentFile>): StructureNode[] => {
  const rawNodes = Array.isArray(structure.structure)
    ? structure.structure
    : Array.isArray(structure.cards)
      ? structure.cards
      : [];

  const nodes = rawNodes
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const content = contentByNodeId.get(entry);
        return {
          id: entry,
          type: asString(content?.parsed.card_type) ?? ''
        };
      }

      const record = asRecord(entry);
      const id = asString(record.id) ?? `node-${index + 1}`;
      const content = contentByNodeId.get(id);
      return {
        id,
        type: asString(record.type) ?? asString(content?.parsed.card_type) ?? ''
      };
    })
    .filter((entry) => entry.id.length > 0);

  if (nodes.length > 0) {
    return nodes;
  }

  return [...contentByNodeId.values()].map((file) => ({
    id: file.id,
    type: asString(file.parsed.card_type) ?? ''
  }));
};

const createDiagnostic = (
  nodeId: string,
  code: string,
  message: string,
  details?: unknown
): RenderNodeDiagnostic => ({
  nodeId,
  path: `card.nodes.${nodeId}`,
  stage: 'render-commit',
  severity: 'P1',
  code,
  message,
  suggestion: 'Check the card node content, plugin registration, and render output for this node.',
  qualityGateBlocking: true,
  details
});

export class CardService {
  private readonly runtime?: Pick<PluginRuntime, 'query'>;
  private readonly workspaceRoot: string;
  private readonly managedDocumentScheme?: string;
  private readonly moduleCache = new Map<string, Promise<BaseCardPluginModule>>();
  private readonly browserBundleCache = new Map<string, Promise<string>>();
  private readonly persistentCardRootCache = new Map<string, PersistentCardRootCacheEntry>();
  private readonly renderSessionCache = new Map<string, RenderSessionEntry>();
  private readonly cardRootTokenByRootDir = new Map<string, string>();
  private readonly cardRootDirByToken = new Map<string, string>();
  private readonly packer: CardPacker;

  public constructor(
    options: CardServiceOptions = {},
    private readonly zip = new StoreZipService()
  ) {
    this.runtime = options.runtime;
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.managedDocumentScheme = normalizeManagedDocumentScheme(options.managedDocumentScheme);
    this.packer = new CardPacker(this.zip);
  }

  public async pack(cardDir: string, outputPath: string, options?: { entryPlan?: ZipEntryPlan[] }): Promise<string> {
    return this.packer.pack(cardDir, outputPath, { entryPlan: options?.entryPlan });
  }

  public async unpack(cardFile: string, outputDir: string): Promise<string> {
    return this.packer.unpack(cardFile, outputDir);
  }

  public async readMetadata(cardFile: string): Promise<Record<string, unknown>> {
    return this.packer.readMetadata(cardFile);
  }

  public async validate(cardFile: string): Promise<{ valid: boolean; errors: string[] }> {
    const cardStats = await this.safeStat(cardFile);
    if (cardStats?.isDirectory()) {
      const required = ['.card/metadata.yaml', '.card/structure.yaml', '.card/cover.html'];
      const errors: string[] = [];
      for (const requiredPath of required) {
        const absolutePath = path.join(cardFile, requiredPath);
        const exists = await this.safeStat(absolutePath);
        if (!exists?.isFile()) {
          errors.push(requiredPath);
        }
      }
      return {
        valid: errors.length === 0,
        errors
      };
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-card-'));
    try {
      await this.zip.extract(cardFile, tempDir);
      const required = ['.card/metadata.yaml', '.card/structure.yaml', '.card/cover.html'];
      const entries = await this.zip.list(cardFile);
      const names = new Set(entries.map((entry) => entry.path));
      const errors = required.filter((requiredPath) => !names.has(requiredPath));
      return {
        valid: errors.length === 0,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        errors: [String(error)]
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  public async parse(cardFile: string): Promise<CardAst> {
    return this.withExtractedCard(cardFile, async (ctx) => ({
      metadata: ctx.metadata,
      structure: ctx.structure,
      contentFiles: ctx.contentFiles
    }));
  }

  public async render(cardFile: string, options?: CardRenderOptions): Promise<RenderedCardView> {
    return this.withExtractedCard(cardFile, async (ctx) => {
      const diagnostics: RenderNodeDiagnostic[] = [];
      const structureNodes = parseStructureNodes(ctx.structure, ctx.contentByNodeId);
      const title = asString(ctx.metadata.name) ?? 'Untitled Card';
      const cardId = asString(ctx.metadata.card_id) ?? asString(ctx.metadata.id) ?? createId();
      const locale = asString(options?.locale) ?? 'zh-CN';
      const target = options?.target ?? 'card-iframe';
      const mode = options?.mode ?? 'view';
      const interactionPolicy = options?.interactionPolicy ?? 'native';
      const resourceBaseUrl = options?.resourceBaseUrl ?? this.createCardRootBaseUrl(ctx.rootDir);
      const theme = options?.theme;
      if (!theme) {
        throw createError('THEME_NOT_FOUND', 'Card render requires a resolved theme snapshot.');
      }
      const themeCssText = options?.themeCssText;
      const renderedNodes: RenderedBaseCardNode[] = [];

      for (const node of structureNodes) {
        renderedNodes.push(
          await this.renderStructureNode(
            node, 
            ctx, 
            theme, 
            themeCssText, 
            locale, 
            diagnostics, 
            interactionPolicy,
            resourceBaseUrl
          )
        );
      }

      const semanticModel = {
        cardId,
        title,
        target,
        themeId: theme.id,
        locale,
        contentFiles: ctx.contentFiles,
        nodes: renderedNodes.map((node) => ({
          nodeId: node.nodeId,
          cardType: node.cardType,
          title: node.title,
          pluginId: node.pluginId ?? null,
          state: node.error ? 'degraded' : 'ready'
        }))
      };
      const semanticHash = crypto.createHash('sha256').update(JSON.stringify(semanticModel)).digest('hex');
      const persistedSession = await this.persistCompositeRenderSession(renderedNodes);
      const body = createCompositeDocument(
        cardId,
        title,
        target,
        semanticHash,
        theme,
        themeCssText,
        locale,
        persistedSession.nodes,
        mode,
        interactionPolicy,
        this.managedDocumentScheme,
        resourceBaseUrl,
      );
      const indexPath = path.join(persistedSession.rootDir, 'index.html');
      await fs.writeFile(indexPath, body, 'utf-8');

      return {
        title,
        body,
        documentUrl: this.createRenderSessionDocumentUrl(persistedSession.sessionId, indexPath),
        sessionId: persistedSession.sessionId,
        contentFiles: ctx.contentFiles,
        target,
        semanticHash,
        diagnostics,
        qualityGate: evaluateRenderQualityGate(diagnostics),
        consistency: options?.verifyConsistency ? createConsistencySnapshot(semanticHash) : undefined
      };
    }, { persistArchive: true });
  }

  public async renderCover(cardFile: string): Promise<RenderedCardCoverView> {
    const check = await this.validate(cardFile);
    if (!check.valid) {
      throw createError('CARD_SCHEMA_INVALID', 'Card format validation failed', check.errors);
    }

    const resolvedRoot = await this.resolveCardRoot(cardFile, { persistArchive: true });
    try {
      const metadataPath = path.join(resolvedRoot.rootDir, '.card/metadata.yaml');
      const coverPath = path.join(resolvedRoot.rootDir, '.card/cover.html');
      const metadata = parseCardYamlRecord(await fs.readFile(metadataPath, 'utf-8'), metadataPath);
      const title = asString(metadata.name) ?? 'Untitled Card';
      const ratio = asString(metadata.cover_ratio);
      const coverUrl = this.createCardRootFileUrl(resolvedRoot.rootDir, '.card/cover.html');

      return {
        title,
        coverUrl,
        ratio,
      };
    } finally {
      await resolvedRoot.cleanup?.();
    }
  }

  public async renderBasecard(options: CardBasecardRenderOptions): Promise<RenderedBasecardView> {
    const baseCardId = options.baseCardId.trim();
    if (!baseCardId) {
      throw createError('INVALID_ARGUMENT', 'baseCardId is required for base card render.');
    }

    const cardType = options.cardType.trim();
    if (!cardType) {
      throw createError('INVALID_ARGUMENT', 'cardType is required for base card render.');
    }

    const theme = options.theme;
    if (!theme) {
      throw createError('THEME_NOT_FOUND', 'Base card render requires a resolved theme snapshot.');
    }

    const plugin = this.resolveCardPlugin(cardType);
    if (!plugin) {
      throw createError('CARD_PLUGIN_NOT_FOUND', `No enabled base card plugin can render ${cardType}.`, {
        cardType,
      });
    }

    const pluginBundleCode = await this.bundlePluginForBrowser(plugin);
    const title = asString(options.title)?.trim() || cardType;

    return {
      title,
      body: createBasecardFrameDocument({
        baseCardId,
        cardType,
        title,
        pluginId: plugin.manifest.id,
        pluginBundleCode,
        config: { ...options.config },
        themeCssText: createBasecardThemeCss(theme, options.themeCssText),
        locale: options.locale,
        interactionPolicy: options.interactionPolicy ?? 'native',
        resourceBaseUrl: options.resourceBaseUrl,
        managedDocumentScheme: this.managedDocumentScheme,
      }),
      cardType,
      pluginId: plugin.manifest.id,
      baseCardId,
    };
  }

  public async renderEditor(options: CardEditorRenderOptions): Promise<RenderedCardEditorView> {
    const cardType = options.cardType.trim();
    if (!cardType) {
      throw createError('INVALID_ARGUMENT', 'cardType is required for card editor render.');
    }

    const theme = options.theme;
    if (!theme) {
      throw createError('THEME_NOT_FOUND', 'Card editor render requires a resolved theme snapshot.');
    }

    const plugin = this.resolveCardPlugin(cardType);
    if (!plugin) {
      throw createError('CARD_PLUGIN_NOT_FOUND', `No enabled base card plugin can edit ${cardType}.`, {
        cardType
      });
    }

    const initialConfig = this.normalizeEditorInitialConfig(cardType, options.initialConfig);
    const pluginBundleCode = await this.bundlePluginForBrowser(plugin);
    const baseCardId = asString(options.baseCardId) ?? asString(initialConfig.id);
    const title = `${cardType} Editor`;
    const body = createEditorFrameDocument({
      cardType,
      title,
      pluginBundleCode,
      initialConfig,
      pluginId: plugin.manifest.id,
      baseCardId,
      themeCssText: createBasecardEditorThemeCss(theme, options.themeCssText),
      managedDocumentScheme: this.managedDocumentScheme,
    });
    const persistedSession = await this.persistDocumentSession('editor');
    const indexPath = path.join(persistedSession.rootDir, 'index.html');
    await fs.writeFile(indexPath, body, 'utf-8');

    return {
      title,
      body,
      documentUrl: this.createRenderSessionDocumentUrl(persistedSession.sessionId, indexPath),
      sessionId: persistedSession.sessionId,
      cardType,
      pluginId: plugin.manifest.id,
      baseCardId
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

  /**
   * 把卡片根目录内的相对资源路径解析为可加载 URL。
   * Electron 环境优先返回 chips-render://card-root/<token>/<path>（标准协议，支持相对资源解析与沙箱 iframe 内加载），
   * 非 Electron 环境回退为 file: URL。
   */
  public resolveCardRootResourceUrl(cardRootDir: string, resourcePath: string): string {
    return this.createCardRootFileUrl(cardRootDir, resourcePath);
  }

  public resolveDocumentFilePath(requestUrl: string): string | null {    let parsed: URL;
    try {
      parsed = new URL(requestUrl);
    } catch {
      return null;
    }

    if (parsed.protocol === 'file:') {
      try {
        return fileURLToPath(parsed);
      } catch {
        return null;
      }
    }

    return this.resolveManagedDocumentFilePath(requestUrl);
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

    if (parsed.hostname === 'card-root') {
      const rootDir = this.cardRootDirByToken.get(identifier);
      if (!rootDir) {
        return null;
      }

      const absolutePath = path.resolve(rootDir, relativePath);
      return isPathWithinRoot(rootDir, absolutePath) ? absolutePath : null;
    }

    return null;
  }

  private async renderStructureNode(
    node: StructureNode,
    ctx: CardPackageContext,
    theme: ThemeSnapshot,
    themeCssText: string | undefined,
    locale: string,
    diagnostics: RenderNodeDiagnostic[],
    interactionPolicy: CompositeInteractionPolicy,
    resourceBaseUrl: string
  ): Promise<RenderedBaseCardNode> {
    const content = ctx.contentByNodeId.get(node.id);
    const cardType = node.type || asString(content?.parsed.card_type) || 'UnknownCard';

    if (!content) {
      const error = {
        nodeId: node.id,
        code: 'CARD_CONTENT_MISSING',
        message: `Content file is missing for node ${node.id}.`,
        stage: 'render-commit',
        details: { nodeId: node.id }
      } satisfies FrameErrorPayload;
      diagnostics.push(createDiagnostic(node.id, error.code, error.message, error.details));
      return {
        nodeId: node.id,
        cardType,
        title: node.id,
        error
      };
    }

    const plugin = this.resolveCardPlugin(cardType);
    if (!plugin) {
      const error = {
        nodeId: node.id,
        code: 'CARD_PLUGIN_NOT_FOUND',
        message: `No enabled base card plugin can render ${cardType}.`,
        stage: 'render-commit',
        details: { cardType }
      } satisfies FrameErrorPayload;
      diagnostics.push(createDiagnostic(node.id, error.code, error.message, error.details));
      return {
        nodeId: node.id,
        cardType,
        title: node.id,
        error
      };
    }

    try {
      const config = await this.normalizeNodeConfig(plugin, content, ctx.rootDir, locale);
      const title = asString(asRecord(config).title) ?? node.id;
      const view = await this.renderBasecard({
        baseCardId: node.id,
        cardType,
        config,
        title,
        resourceBaseUrl,
        theme,
        themeCssText,
        locale,
        interactionPolicy,
      });

      return {
        nodeId: node.id,
        cardType,
        title: view.title,
        pluginId: view.pluginId,
        frameHtml: view.body,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const details = error && typeof error === 'object' ? error : { error: String(error) };
      diagnostics.push(createDiagnostic(node.id, 'CARD_NODE_RENDER_FAILED', message, details));
      return {
        nodeId: node.id,
        cardType,
        title: node.id,
        pluginId: plugin.manifest.id,
        error: {
          nodeId: node.id,
          code: 'CARD_NODE_RENDER_FAILED',
          message,
          stage: 'render-commit',
          details
        }
      };
    }
  }

  public resolveCardPlugin(cardType: string): RenderablePluginRecord | undefined {
    const plugins = this.runtime?.query({ type: 'card' }) ?? [];
    const candidates = this.buildCardTypeCandidates(cardType);

    return plugins
      .filter(
        (record): record is RenderablePluginRecord =>
          Boolean(record.enabled && typeof record.manifest.entry === 'string' && record.manifest.entry.length > 0)
      )
      .find((record) => {
        const capabilities = new Set(record.manifest.capabilities ?? []);
        return candidates.some((candidate) => capabilities.has(candidate));
      });
  }

  public buildCardTypeCandidates(cardType: string): string[] {
    const trimmed = cardType.trim();
    const compact = trimmed.replace(/\s+/g, '');
    const stripped = compact.replace(/Card$/i, '');
    const normalized = stripped.replace(/[^A-Za-z0-9]+/g, '');
    const lower = normalized.toLowerCase();

    const candidates = new Set<string>();
    if (trimmed) {
      candidates.add(trimmed);
      candidates.add(trimmed.toLowerCase());
    }
    if (compact) {
      candidates.add(compact);
      candidates.add(compact.toLowerCase());
    }
    if (stripped) {
      candidates.add(stripped);
      candidates.add(stripped.toLowerCase());
    }
    if (lower) {
      candidates.add(`base.${lower}`);
    }

    return [...candidates];
  }

  private async normalizeNodeConfig(
    plugin: RenderablePluginRecord,
    file: ParsedContentFile,
    _cardRoot: string,
    locale?: string
  ): Promise<Record<string, unknown>> {
    const rawConfig: Record<string, unknown> = {
      ...file.parsed,
      id: asString(file.parsed.id) ?? file.id
    };
    const effectiveLocale = asString(locale) ?? asString(rawConfig.locale) ?? 'zh-CN';

    if (plugin.manifest.id === 'chips.basecard.richtext') {
      return normalizeRichTextRuntimeConfig(rawConfig, file.id, effectiveLocale);
    }

    return {
      ...rawConfig,
      locale: effectiveLocale
    };
  }

  private normalizeEditorInitialConfig(
    cardType: string,
    input: Record<string, unknown> | undefined
  ): Record<string, unknown> {
    const rawConfig = {
      ...(input ?? {})
    };

    if (
      cardType === 'RichTextCard' ||
      cardType === 'base.richtext' ||
      asString(rawConfig.card_type) === 'RichTextCard'
    ) {
      return normalizeRichTextRuntimeConfig(
        rawConfig,
        asString(rawConfig.id) ?? createId(),
        asString(rawConfig.locale) ?? 'zh-CN'
      );
    }

    return rawConfig;
  }

  public async loadPluginModule(plugin: RenderablePluginRecord): Promise<BaseCardPluginModule> {
    const entryPath = await this.resolvePluginEntryPath(plugin);
    const cacheKey = `${plugin.manifest.id}:${entryPath}`;
    const cached = this.moduleCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const pending = (async () => {
      try {
        if (entryPath.endsWith('.mjs')) {
          return (await import(pathToFileURL(entryPath).href)) as BaseCardPluginModule;
        }
        if (entryPath.endsWith('.js') || entryPath.endsWith('.ts')) {
          const bundled = await this.bundlePluginEntry(entryPath, plugin.installPath);
          if (bundled) {
            return bundled;
          }
        }
        const required = require(entryPath) as BaseCardPluginModule;
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
      throw createError('CARD_PLUGIN_LOAD_FAILED', `Failed to load plugin entry ${entryPath}.`, {
        pluginId: plugin.manifest.id,
        entryPath
      });
    })();

    this.moduleCache.set(cacheKey, pending);
    return pending;
  }

  private async bundlePluginForBrowser(plugin: RenderablePluginRecord): Promise<string> {
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
        globalName: 'ChipsBasecardPlugin',
        write: false,
        absWorkingDir: plugin.installPath,
        logLevel: 'silent'
      });

      const code = result.outputFiles?.[0]?.text;
      if (!code) {
        throw createError('CARD_PLUGIN_BUNDLE_FAILED', `Failed to bundle plugin ${plugin.manifest.id} for browser runtime.`, {
          pluginId: plugin.manifest.id,
          entryPath
        });
      }

      return code;
    })();

    this.browserBundleCache.set(cacheKey, pending);
    return pending;
  }

  private async resolvePluginEntryPath(plugin: RenderablePluginRecord): Promise<string> {
    const declaredEntryPath = path.resolve(plugin.installPath, plugin.manifest.entry);
    const declaredStats = await this.safeStat(declaredEntryPath);
    if (declaredStats?.isFile()) {
      return declaredEntryPath;
    }

    const sourceOverride = await this.findWorkspaceSourceEntry(plugin.manifest.id);
    if (sourceOverride) {
      return sourceOverride;
    }

    throw createError('CARD_PLUGIN_ENTRY_NOT_FOUND', `Plugin entry is missing: ${plugin.manifest.entry}`, {
      pluginId: plugin.manifest.id,
      entry: plugin.manifest.entry
    });
  }

  private async findWorkspaceSourceEntry(pluginId: string): Promise<string | undefined> {
    const candidates = [
      path.join(this.workspaceRoot, 'Chips-BaseCardPlugin'),
      path.join(this.workspaceRoot, 'Chips-Scaffold', 'Chips-BaseCardPlugin')
    ];

    for (const root of candidates) {
      const rootStats = await this.safeStat(root);
      if (!rootStats?.isDirectory()) {
        continue;
      }
      const entries = await fs.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }
        const manifestPath = path.join(root, entry.name, 'manifest.yaml');
        const manifestStats = await this.safeStat(manifestPath);
        if (!manifestStats?.isFile()) {
          continue;
        }
        const manifest = asRecord(parseYamlLite(await fs.readFile(manifestPath, 'utf-8')));
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
    }

    return undefined;
  }

  private async bundlePluginEntry(entryPath: string, pluginRoot: string): Promise<BaseCardPluginModule | undefined> {
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
        logLevel: 'silent'
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
        exportsFn: Record<string, unknown>
      ) => void;
      factory(require, moduleObject, exportsObject);
      return moduleObject.exports as BaseCardPluginModule;
    } catch {
      return undefined;
    }
  }

  private async withExtractedCard<T>(
    cardFile: string,
    task: (ctx: CardPackageContext) => Promise<T>,
    options: { persistArchive?: boolean } = {},
  ): Promise<T> {
    const check = await this.validate(cardFile);
    if (!check.valid) {
      throw createError('CARD_SCHEMA_INVALID', 'Card format validation failed', check.errors);
    }

    const resolvedRoot = await this.resolveCardRoot(cardFile, options);
    try {
      const metadataPath = path.join(resolvedRoot.rootDir, '.card/metadata.yaml');
      const structurePath = path.join(resolvedRoot.rootDir, '.card/structure.yaml');
      const metadata = parseCardYamlRecord(await fs.readFile(metadataPath, 'utf-8'), metadataPath);
      const structure = parseCardYamlRecord(await fs.readFile(structurePath, 'utf-8'), structurePath);
      const contentFiles = await this.readFiles(path.join(resolvedRoot.rootDir, 'content'));
      const contentByNodeId = await this.readContentFiles(resolvedRoot.rootDir, contentFiles);

      return await task({
        rootDir: resolvedRoot.rootDir,
        metadata,
        structure,
        contentFiles,
        contentByNodeId
      });
    } finally {
      await resolvedRoot.cleanup?.();
    }
  }

  private async persistDocumentSession(kind: 'card' | 'editor'): Promise<{ sessionId: string; rootDir: string }> {
    const sessionId = `${kind}-render-${createId()}`;
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), `chips-${kind}-render-`));
    this.renderSessionCache.set(sessionId, {
      rootDir,
      createdAt: Date.now(),
    });
    return { sessionId, rootDir };
  }

  private async persistCompositeRenderSession(
    nodes: RenderedBaseCardNode[],
  ): Promise<{ sessionId: string; rootDir: string; nodes: RenderedBaseCardNode[] }> {
    const session = await this.persistDocumentSession('card');
    const nodesRoot = path.join(session.rootDir, 'nodes');
    await fs.mkdir(nodesRoot, { recursive: true });

    const persistedNodes = await Promise.all(
      nodes.map(async (node, index) => {
        if (!node.frameHtml) {
          return node;
        }

        const fileName = createRenderFileName('basecard', node.nodeId || node.cardType, index);
        const absolutePath = path.join(nodesRoot, fileName);
        await fs.writeFile(absolutePath, node.frameHtml, 'utf-8');

        return {
          ...node,
          frameSrc: `./nodes/${fileName}`,
        } satisfies RenderedBaseCardNode;
      }),
    );

    return {
      ...session,
      nodes: persistedNodes,
    };
  }

  private async resolveCardRoot(
    cardFile: string,
    options: { persistArchive?: boolean } = {},
  ): Promise<{ rootDir: string; cleanup?: () => Promise<void> }> {
    const fileStats = await this.safeStat(cardFile);
    if (fileStats?.isDirectory()) {
      return { rootDir: cardFile };
    }

    if (options.persistArchive) {
      return this.resolvePersistentCardRoot(path.resolve(cardFile), fileStats);
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-card-parse-'));
    await this.zip.extract(cardFile, tempDir);
    return {
      rootDir: tempDir,
      cleanup: async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    };
  }

  private async resolvePersistentCardRoot(
    cardFile: string,
    fileStats?: import('node:fs').Stats,
  ): Promise<{ rootDir: string }> {
    const stats = fileStats ?? await this.safeStat(cardFile);
    if (!stats?.isFile()) {
      throw createError('CARD_FILE_NOT_FOUND', `Card file does not exist: ${cardFile}`);
    }

    const cached = this.persistentCardRootCache.get(cardFile);
    if (cached) {
      const cachedRootStats = await this.safeStat(cached.rootDir);
      if (
        cachedRootStats?.isDirectory() &&
        cached.sourceMtimeMs === stats.mtimeMs &&
        cached.sourceSize === stats.size
      ) {
        return { rootDir: cached.rootDir };
      }

      this.unregisterCardRoot(cached.rootDir);
      await fs.rm(cached.rootDir, { recursive: true, force: true });
      this.persistentCardRootCache.delete(cardFile);
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-card-runtime-'));
    await this.zip.extract(cardFile, tempDir);
    this.persistentCardRootCache.set(cardFile, {
      rootDir: tempDir,
      sourceMtimeMs: stats.mtimeMs,
      sourceSize: stats.size,
    });

    return { rootDir: tempDir };
  }

  private async readContentFiles(rootDir: string, contentFiles: string[]): Promise<Map<string, ParsedContentFile>> {
    const result = new Map<string, ParsedContentFile>();
    for (const relativePath of contentFiles) {
      const absolutePath = path.join(rootDir, 'content', relativePath);
      const raw = await fs.readFile(absolutePath, 'utf-8');
      result.set(path.basename(relativePath, path.extname(relativePath)), {
        id: path.basename(relativePath, path.extname(relativePath)),
        path: relativePath,
        absolutePath,
        raw,
        parsed: parseCardYamlRecord(raw, absolutePath)
      });
    }
    return result;
  }

  private async readFiles(root: string): Promise<string[]> {
    try {
      const files: string[] = [];
      const stack = [root];
      while (stack.length > 0) {
        const current = stack.pop();
        if (!current) {
          continue;
        }

        const entries = await fs.readdir(current, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(current, entry.name);
          if (entry.isDirectory()) {
            stack.push(full);
          } else {
            files.push(path.relative(root, full).split(path.sep).join('/'));
          }
        }
      }
      files.sort();
      return files;
    } catch {
      return [];
    }
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

    const relativePath = normalizeManagedRelativePath(path.relative(session.rootDir, absolutePath).split(path.sep).join('/'));
    if (!relativePath) {
      return pathToFileURL(absolutePath).href;
    }

    return `${this.managedDocumentScheme}://session/${encodeURIComponent(sessionId)}/${encodeManagedUrlPath(relativePath)}`;
  }

  private createCardRootBaseUrl(rootDir: string): string {
    const normalizedRootDir = path.resolve(rootDir);
    if (!this.managedDocumentScheme) {
      return pathToFileURL(`${normalizedRootDir}${path.sep}`).href;
    }

    const token = this.getOrCreateCardRootToken(normalizedRootDir);
    return `${this.managedDocumentScheme}://card-root/${encodeURIComponent(token)}/`;
  }

  private createCardRootFileUrl(rootDir: string, relativePath: string): string {
    const normalizedRootDir = path.resolve(rootDir);
    const normalizedRelativePath = normalizeManagedRelativePath(relativePath);
    if (!normalizedRelativePath) {
      return pathToFileURL(path.resolve(normalizedRootDir, relativePath)).href;
    }

    if (!this.managedDocumentScheme) {
      return pathToFileURL(path.resolve(normalizedRootDir, normalizedRelativePath)).href;
    }

    const token = this.getOrCreateCardRootToken(normalizedRootDir);
    return `${this.managedDocumentScheme}://card-root/${encodeURIComponent(token)}/${encodeManagedUrlPath(normalizedRelativePath)}`;
  }

  private getOrCreateCardRootToken(rootDir: string): string {
    const normalizedRootDir = path.resolve(rootDir);
    const cachedToken = this.cardRootTokenByRootDir.get(normalizedRootDir);
    if (cachedToken) {
      return cachedToken;
    }

    const token = createId();
    this.cardRootTokenByRootDir.set(normalizedRootDir, token);
    this.cardRootDirByToken.set(token, normalizedRootDir);
    return token;
  }

  private unregisterCardRoot(rootDir: string): void {
    const normalizedRootDir = path.resolve(rootDir);
    const token = this.cardRootTokenByRootDir.get(normalizedRootDir);
    if (!token) {
      return;
    }

    this.cardRootTokenByRootDir.delete(normalizedRootDir);
    this.cardRootDirByToken.delete(token);
  }
}
