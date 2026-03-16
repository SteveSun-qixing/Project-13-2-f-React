import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import yaml from 'yaml';
import { createError } from '../../../src/shared/errors';
import type { PluginRecord, PluginRuntime } from '../../../src/runtime';
import { parseYamlLite } from '../../../src/shared/yaml-lite';
import { createId } from '../../../src/shared/utils';
import type { RenderConsistencyResult, RenderNodeDiagnostic, RenderTarget, RenderViewport, ThemeSnapshot } from '../../unified-rendering/src';
import { StoreZipService } from '../../zip-service/src';

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
  mode?: 'view' | 'preview';
  interactionPolicy?: 'native' | 'delegate';
}

export interface CardEditorRenderOptions {
  cardType: string;
  initialConfig?: Record<string, unknown>;
  baseCardId?: string;
  cardRootDir?: string;
  theme?: ThemeSnapshot;
  themeCssText?: string;
}

export interface BasecardSessionOpenOptions {
  cardType: string;
  baseCardId?: string;
  sourceConfig?: Record<string, unknown>;
  cardRootDir?: string;
}

export interface BasecardValidationIssue {
  path: string;
  message: string;
  code?: string;
}

export interface BasecardValidationResult {
  valid: boolean;
  issues: BasecardValidationIssue[];
}

export interface BasecardSessionView {
  sessionId: string;
  pluginId: string;
  cardType: string;
  baseCardId: string;
  displayName: string;
  normalizedConfig: Record<string, unknown>;
  validation: BasecardValidationResult;
  referencedResources: string[];
  commitDebounceMs: number;
  supportsEditor: boolean;
}

export interface RenderedBasecardSessionView {
  title: string;
  body: string;
  sessionId: string;
  pluginId: string;
  cardType: string;
  baseCardId: string;
}

export interface RenderedBasecardSessionEditorView extends RenderedBasecardSessionView {
  normalizedConfig: Record<string, unknown>;
  validation: BasecardValidationResult;
  referencedResources: string[];
}

export interface RenderedCardView {
  title: string;
  body: string;
  contentFiles: string[];
  target: RenderTarget;
  semanticHash: string;
  diagnostics: RenderNodeDiagnostic[];
  consistency?: RenderConsistencyResult;
}

export interface RenderedCardEditorView {
  title: string;
  body: string;
  cardType: string;
  pluginId: string;
  baseCardId?: string;
}

export interface RenderedCardCoverView {
  title: string;
  coverUrl: string;
  ratio?: string;
}

export interface CardServiceOptions {
  runtime?: Pick<PluginRuntime, 'query'>;
  workspaceRoot?: string;
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
  error?: FrameErrorPayload;
}

interface PersistentCardRootCacheEntry {
  rootDir: string;
  sourceMtimeMs: number;
  sourceSize: number;
}

interface BaseCardPluginModule {
  getBasecardDescriptor?: () => {
    cardType?: string;
    displayName?: string;
    commitDebounceMs?: number;
  };
  createInitialBasecardConfig?: (baseCardId: string) => unknown;
  normalizeBasecardConfig?: (input: unknown, baseCardId: string) => unknown;
  validateBasecardConfig?: (config: unknown) => {
    valid?: boolean;
    issues?: Array<{ path?: string; message?: string; code?: string }>;
  };
  collectReferencedResources?: (config: unknown) => unknown;
  renderBasecardView?: (ctx: { container: unknown; config: unknown; themeCssText?: string }) => unknown;
  renderBasecardEditor?: (ctx: {
    container: unknown;
    initialConfig: unknown;
    onChange: (next: unknown) => void;
    resolveResourceUrl?: (resourcePath: string) => Promise<unknown>;
    releaseResourceUrl?: (resourcePath: string) => Promise<unknown> | unknown;
    importResource?: (input: { file: File; preferredPath?: string }) => Promise<unknown>;
    deleteResource?: (resourcePath: string) => Promise<unknown>;
  }) => unknown;
}

interface BasecardRuntimeDescriptor {
  cardType: string;
  displayName: string;
  commitDebounceMs: number;
}

interface ResolvedBasecardPluginRuntime {
  plugin: RenderablePluginRecord;
  module: BaseCardPluginModule;
  descriptor: BasecardRuntimeDescriptor;
}

interface BasecardSessionRecord {
  sessionId: string;
  plugin: RenderablePluginRecord;
  module: BaseCardPluginModule;
  descriptor: BasecardRuntimeDescriptor;
  pluginId: string;
  cardType: string;
  baseCardId: string;
  normalizedConfig: Record<string, unknown>;
  validation: BasecardValidationResult;
  referencedResources: string[];
  cardRootDir?: string;
  resourceBaseUrl?: string;
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

const cloneRecord = (value: Record<string, unknown>): Record<string, unknown> => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

const toBasecardValidationResult = (input: unknown): BasecardValidationResult => {
  if (!input || typeof input !== 'object') {
    return { valid: true, issues: [] };
  }

  const record = input as { valid?: unknown; issues?: unknown };
  const issues = Array.isArray(record.issues)
    ? record.issues
        .map((issue) => {
          if (!issue || typeof issue !== 'object') {
            return null;
          }
          const entry = issue as { path?: unknown; message?: unknown; code?: unknown };
          return {
            path: typeof entry.path === 'string' ? entry.path : '',
            message: typeof entry.message === 'string' ? entry.message : '',
            code: typeof entry.code === 'string' ? entry.code : undefined,
          } satisfies BasecardValidationIssue;
        })
        .filter((issue) => Boolean(issue && issue.message))
        .map((issue) => issue as BasecardValidationIssue)
    : [];

  return {
    valid: record.valid === false ? false : issues.length === 0,
    issues,
  };
};

const normalizeReferencedResources = (input: unknown): string[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized = new Set<string>();
  for (const item of input) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }
    normalized.add(trimmed.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '').replace(/\/{2,}/g, '/'));
  }
  return [...normalized].sort((left, right) => left.localeCompare(right));
};

const toResourceBaseUrl = (cardRootDir: string | undefined): string | undefined => {
  if (!cardRootDir) {
    return undefined;
  }

  const absoluteRoot = path.resolve(cardRootDir);
  return pathToFileURL(absoluteRoot.endsWith(path.sep) ? absoluteRoot : `${absoluteRoot}${path.sep}`).href;
};

type CompositeInteractionPolicy = 'native' | 'delegate';

const createChildInteractionBridgeScript = (
  interactionPolicy: CompositeInteractionPolicy
): string => {
  return [
    `      const interactionPolicy = ${JSON.stringify(interactionPolicy)};`,
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

const isSafeUrlProtocol = (value: string): boolean => {
  const lowered = value.trim().toLowerCase();
  return !(
    lowered.startsWith('javascript:') ||
    lowered.startsWith('data:') ||
    lowered.startsWith('vbscript:')
  );
};

const resolveResourceUrl = (rawValue: string, baseDir: string, cardRoot: string): string => {
  const value = rawValue.trim();
  if (!value || !isSafeUrlProtocol(value)) {
    return '';
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//') || value.startsWith('#')) {
    return value;
  }

  const absolutePath = value.startsWith('/')
    ? path.resolve(cardRoot, `.${value}`)
    : path.resolve(baseDir, value);
  return pathToFileURL(absolutePath).href;
};

const loadHtmlFromRichTextConfig = async (config: Record<string, unknown>, file: ParsedContentFile, cardRoot: string): Promise<string> => {
  const contentSource = asString(config.content_source) ?? 'inline';
  let html = '';

  if (typeof config.body === 'string') {
    html = config.body;
  } else if (contentSource === 'file') {
    const relativePath = asString(config.content_file);
    if (!relativePath) {
      throw createError('CARD_SCHEMA_INVALID', 'Rich text card is missing content_file.', {
        nodeId: file.id,
        filePath: file.path
      });
    }
    const absolutePath = path.resolve(cardRoot, relativePath);
    html = await fs.readFile(absolutePath, 'utf-8');
  } else {
    html = typeof config.content_text === 'string' ? config.content_text : '';
  }

  const jsdom = require('jsdom') as { JSDOM: new (html?: string) => { window: any } };
  const dom = new jsdom.JSDOM(`<!doctype html><html><body>${html}</body></html>`);
  try {
    const { document } = dom.window;
    for (const element of Array.from(document.querySelectorAll('[src]')) as Array<any>) {
      const src = element.getAttribute('src');
      if (!src) {
        continue;
      }
      const next = resolveResourceUrl(src, path.dirname(file.absolutePath), cardRoot);
      if (next) {
        element.setAttribute('src', next);
      } else {
        element.removeAttribute('src');
      }
    }

    for (const element of Array.from(document.querySelectorAll('[href]')) as Array<any>) {
      const href = element.getAttribute('href');
      if (!href) {
        continue;
      }
      const next = resolveResourceUrl(href, path.dirname(file.absolutePath), cardRoot);
      if (next) {
        element.setAttribute('href', next);
      } else {
        element.removeAttribute('href');
      }
    }

    return document.body.innerHTML;
  } finally {
    dom.window.close();
  }
};

const createThemeVariablesCss = (theme: ThemeSnapshot): string => {
  const declarations = Object.entries(theme.tokens)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => `  --${key.replaceAll('.', '-')}: ${String(value)};`);

  if (declarations.length === 0) {
    return ':root {}';
  }

  return [':root {', ...declarations, '}'].join('\n');
};

const joinStyleBlocks = (...blocks: Array<string | undefined>): string => {
  return blocks.map((block) => block?.trim() ?? '').filter((block) => block.length > 0).join('\n\n');
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
      '.chips-basecard__body a { color: var(--chips-sys-color-primary, #2563eb); }',
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
      '  background: color-mix(in srgb, var(--chips-sys-color-primary, #2563eb) 8%, var(--chips-sys-color-surface, #ffffff));',
      '}',
      '.chips-basecard-editor__errors {',
      '  border-radius: 12px;',
      '  padding: 12px 14px;',
      '  background: color-mix(in srgb, var(--chips-sys-color-error, #d92d20) 10%, var(--chips-sys-color-surface, #ffffff));',
      '  color: var(--chips-sys-color-error, #d92d20);',
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
      '.chips-composite { width: 100%; max-width: none; margin: 0; padding: 28px 22px 40px; box-sizing: border-box; }',
      '.chips-composite__header { margin-bottom: 18px; }',
      '.chips-composite__title { margin: 0; font-size: 30px; line-height: 1.2; color: var(--chips-sys-color-on-surface, #111111); }',
      '.chips-composite__meta { margin-top: 8px; font-size: 12px; color: color-mix(in srgb, var(--chips-sys-color-on-surface, #111111) 68%, white 32%); }',
      '.chips-composite__stack { display: grid; gap: 16px; }',
      '.chips-composite__node {',
      '  background: var(--chips-comp-card-shell-root-surface, var(--chips-sys-color-surface, #ffffff));',
      '  border: 1px solid var(--chips-comp-card-shell-border-color, rgba(17, 17, 17, 0.16));',
      '  border-radius: 18px;',
      '  overflow: hidden;',
      '  box-shadow: 0 10px 30px rgba(17, 17, 17, 0.08);',
      '}',
      'body[data-mode="preview"] .chips-composite__node[data-state="ready"],',
      'body[data-mode="preview"] .chips-composite__node[data-state="degraded"] {',
      '  cursor: pointer;',
      '  transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;',
      '}',
      'body[data-mode="preview"] .chips-composite__node[data-state="ready"]:hover,',
      'body[data-mode="preview"] .chips-composite__node[data-state="degraded"]:hover {',
      '  transform: translateY(-1px);',
      '  border-color: color-mix(in srgb, var(--chips-sys-color-primary, #2563eb) 52%, var(--chips-comp-card-shell-border-color, rgba(17, 17, 17, 0.16)) 48%);',
      '  box-shadow: 0 16px 36px rgba(17, 17, 17, 0.12);',
      '}',
      '.chips-composite__frame { display: block; width: 100%; min-height: 96px; border: 0; background: transparent; }',
      '.chips-composite__degraded { padding: 22px 24px; color: color-mix(in srgb, var(--chips-sys-color-on-surface, #111111) 72%, white 28%); }',
      '.chips-composite__degraded strong { display: block; margin-bottom: 8px; color: var(--chips-sys-color-on-surface, #111111); }',
      '.chips-composite__degraded p { margin: 0; }',
      '.chips-composite__meta code {',
      '  padding: 2px 6px;',
      '  border-radius: 999px;',
      '  background: color-mix(in srgb, var(--chips-sys-color-primary, #2563eb) 12%, white 88%);',
      '  color: var(--chips-sys-color-primary, #2563eb);',
      '}'
    ].join('\n')
  );
};

const createChildFrameDocument = (
  nodeId: string,
  cardType: string,
  title: string,
  contentHtml: string,
  interactionPolicy: CompositeInteractionPolicy,
  resourceBaseUrl?: string
): string => {
  const safeNodeId = JSON.stringify(nodeId);
  const contentTitle = title || cardType;

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src file: http: https: data: blob:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data: file:;" />',
    `  <title>${escapeHtml(contentTitle)}</title>`,
    ...(resourceBaseUrl ? [`  <base href="${escapeHtml(resourceBaseUrl)}" />`] : []),
    '</head>',
    `<body data-node-id="${escapeHtml(nodeId)}" data-card-type="${escapeHtml(cardType)}" data-interaction-policy="${escapeHtml(interactionPolicy)}">`,
    contentHtml,
    '  <script>',
    '    (() => {',
    `      const nodeId = ${safeNodeId};`,
    `      const cardType = ${JSON.stringify(cardType)};`,
    '      const emitHeight = () => {',
    '        const height = Math.max(',
    '          64,',
    '          document.documentElement?.scrollHeight ?? 0,',
    '          document.body?.scrollHeight ?? 0,',
    '          document.documentElement?.offsetHeight ?? 0,',
    '          document.body?.offsetHeight ?? 0',
    '        );',
    "        window.parent?.postMessage({ type: 'chips.basecard:height', payload: { nodeId, cardType, height } }, '*');",
    '      };',
    '      const emitSelect = (source) => {',
    "        window.parent?.postMessage({ type: 'chips.basecard:select', payload: { nodeId, cardType, source } }, '*');",
    '      };',
    '      const emitReady = () => {',
    "        window.parent?.postMessage({ type: 'chips.basecard:ready', payload: { nodeId, cardType } }, '*');",
    '      };',
    "      window.addEventListener('load', () => {",
    '        emitReady();',
    '        emitHeight();',
    '        window.setTimeout(emitHeight, 50);',
    '        window.setTimeout(emitHeight, 200);',
    '      });',
    "      document.addEventListener('pointerdown', () => emitSelect('pointer'), { capture: true });",
    "      if ('ResizeObserver' in window && document.body) {",
    '        const observer = new ResizeObserver(() => emitHeight());',
    '        observer.observe(document.body);',
    '      }',
    createChildInteractionBridgeScript(interactionPolicy),
    '    })();',
    '  </script>',
    '</body>',
    '</html>'
  ].join('\n');
};

const createEditorFrameDocument = (options: {
  sessionId?: string;
  cardType: string;
  title: string;
  pluginBundleCode: string;
  initialConfig: Record<string, unknown>;
  normalizedConfig: Record<string, unknown>;
  validation: BasecardValidationResult;
  referencedResources: string[];
  pluginId: string;
  baseCardId?: string;
  themeCssText: string;
  resourceBaseUrl?: string;
}): string => {
  const {
    sessionId,
    cardType,
    title,
    pluginBundleCode,
    initialConfig,
    normalizedConfig,
    validation,
    referencedResources,
    pluginId,
    baseCardId,
    themeCssText,
    resourceBaseUrl
  } = options;

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src file: http: https: data: blob:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data: file:;" />',
    `  <title>${escapeHtml(title)}</title>`,
    `  <style>${themeCssText}</style>`,
    ...(resourceBaseUrl ? [`  <base href="${escapeHtml(resourceBaseUrl)}" />`] : []),
    '</head>',
    `<body data-card-type="${escapeHtml(cardType)}" data-plugin-id="${escapeHtml(pluginId)}" data-base-card-id="${escapeHtml(baseCardId ?? '')}">`,
    '  <div id="chips-basecard-editor-root"></div>',
    '  <script>',
    pluginBundleCode,
    '  </script>',
    '  <script>',
    '    (() => {',
    `      const initialConfig = ${escapeInlineJson(initialConfig)};`,
    `      const normalizedInitialConfig = ${escapeInlineJson(normalizedConfig)};`,
    `      const initialValidation = ${escapeInlineJson(validation)};`,
    `      const initialReferencedResources = ${escapeInlineJson(referencedResources)};`,
    `      const sessionId = ${JSON.stringify(sessionId ?? '')};`,
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
    '            reject(new Error(`Basecard editor resource request timed out: ${action}`));',
    '          }, 30000);',
    '          pendingResourceRequests.set(requestId, { resolve, reject, timer });',
    '          emit("chips.basecard:resource-request", {',
    '            requestId,',
    '            action,',
    '            sessionId,',
    '            baseCardId,',
    '            cardType,',
    '            pluginId,',
    '            ...payload,',
    '          });',
    '        });',
    '      };',
    '      window.addEventListener("message", (event) => {',
    '        if (event.source !== window.parent) {',
    '          return;',
    '        }',
    '        const data = event.data;',
    '        if (!data || typeof data !== "object" || data.type !== "chips.basecard:resource-response") {',
    '          return;',
    '        }',
    '        const payload = data.payload || {};',
    '        const requestId = typeof payload.requestId === "string" ? payload.requestId : "";',
    '        const pending = pendingResourceRequests.get(requestId);',
    '        if (!pending) {',
    '          return;',
    '        }',
    '        window.clearTimeout(pending.timer);',
    '        pendingResourceRequests.delete(requestId);',
    '        if (payload.ok === false) {',
    '          const message = typeof payload.message === "string" && payload.message.length > 0',
    '            ? payload.message',
    '            : "Basecard editor resource request failed.";',
    '          pending.reject(new Error(message));',
    '          return;',
    '        }',
    '        pending.resolve(payload.result);',
    '      });',
    '      const releaseResourceUrl = (resourcePath) => {',
    '        emit("chips.basecard:resource-release", {',
    '          sessionId,',
    '          baseCardId,',
    '          cardType,',
    '          pluginId,',
    '          resourcePath,',
    '        });',
    '      };',
    '      const normalizeConfig = (value) => {',
    '        const plugin = globalThis.ChipsBasecardPlugin || {};',
    '        if (typeof plugin.normalizeBasecardConfig === "function") {',
    '          return plugin.normalizeBasecardConfig(value, baseCardId);',
    '        }',
    '        return value && typeof value === "object" ? value : {};',
    '      };',
    '      const validateConfig = (value) => {',
    '        const plugin = globalThis.ChipsBasecardPlugin || {};',
    '        if (typeof plugin.validateBasecardConfig === "function") {',
    '          return plugin.validateBasecardConfig(value) || { valid: true, issues: [] };',
    '        }',
    '        return { valid: true, issues: [] };',
    '      };',
    '      const collectReferencedResources = (value) => {',
    '        const plugin = globalThis.ChipsBasecardPlugin || {};',
    '        if (typeof plugin.collectReferencedResources === "function") {',
    '          const resources = plugin.collectReferencedResources(value);',
    '          return Array.isArray(resources) ? resources : [];',
    '        }',
    '        return [];',
    '      };',
    '      const emitAuthoritativeChange = (rawConfig) => {',
    '        const authoritativeConfig = normalizeConfig(rawConfig);',
    '        const authoritativeValidation = validateConfig(authoritativeConfig);',
    '        const authoritativeResources = collectReferencedResources(authoritativeConfig);',
    '        emit("chips.basecard:change", {',
    '          sessionId,',
    '          baseCardId,',
    '          cardType,',
    '          pluginId,',
    '          normalizedConfig: authoritativeConfig,',
    '          validation: authoritativeValidation,',
    '          referencedResources: authoritativeResources,',
    '        });',
    '      };',
    '      const emitHeight = () => {',
    '        const height = Math.max(',
    '          240,',
    '          document.documentElement?.scrollHeight ?? 0,',
    '          document.body?.scrollHeight ?? 0,',
    '          document.documentElement?.offsetHeight ?? 0,',
    '          document.body?.offsetHeight ?? 0',
    '        );',
    "        emit('chips.basecard:height', { sessionId, baseCardId, cardType, height });",
    '      };',
    '      try {',
    '        const plugin = globalThis.ChipsBasecardPlugin || {};',
    '        if (typeof plugin.renderBasecardEditor !== "function") {',
    "          throw new Error('Plugin does not export renderBasecardEditor.');",
    '        }',
    '        plugin.renderBasecardEditor({',
    '          container,',
    '          initialConfig,',
    '          resolveResourceUrl(resourcePath) {',
    '            return requestResource("resolve", { resourcePath });',
    '          },',
    '          releaseResourceUrl,',
    '          importResource(input) {',
    '            return requestResource("import", { preferredPath: input?.preferredPath, file: input?.file });',
    '          },',
    '          deleteResource(resourcePath) {',
    '            return requestResource("delete", { resourcePath });',
    '          },',
    '          onChange(next) {',
    '            emitAuthoritativeChange(next);',
    '            window.setTimeout(emitHeight, 0);',
    '          }',
    '        });',
    '        emit("chips.basecard:ready", {',
    '          sessionId,',
    '          baseCardId,',
    '          cardType,',
    '          pluginId,',
    '          normalizedConfig: normalizedInitialConfig,',
    '          validation: initialValidation,',
    '          referencedResources: initialReferencedResources,',
    '        });',
    '        emitHeight();',
    "        if ('ResizeObserver' in window && document.body) {",
    '          const observer = new ResizeObserver(() => emitHeight());',
    '          observer.observe(document.body);',
    '        }',
    '      } catch (error) {',
    '        const message = error instanceof Error ? error.message : String(error);',
    "        emit('chips.basecard:error', { sessionId, baseCardId, cardType, pluginId, code: 'CARD_EDITOR_RENDER_FAILED', message });",
    '        const pre = document.createElement("pre");',
    '        pre.textContent = message;',
    '        pre.style.margin = "0";',
    '        pre.style.padding = "20px";',
    '        pre.style.whiteSpace = "pre-wrap";',
    '        pre.style.color = "var(--chips-sys-color-error, #d92d20)";',
    '        container?.replaceChildren(pre);',
    '        emitHeight();',
    '      }',
    '    })();',
    '  </script>',
    '</body>',
    '</html>'
  ].join('\n');
};

const createCardEditorFrameDocument = (options: {
  cardType: string;
  title: string;
  pluginBundleCode: string;
  initialConfig: Record<string, unknown>;
  pluginId: string;
  baseCardId?: string;
  themeCssText: string;
  resourceBaseUrl?: string;
}): string => {
  const {
    cardType,
    title,
    pluginBundleCode,
    initialConfig,
    pluginId,
    baseCardId,
    themeCssText,
    resourceBaseUrl,
  } = options;

  return [
    '<!doctype html>',
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src file: http: https: data: blob:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data: file:;" />',
    `  <title>${escapeHtml(title)}</title>`,
    `  <style>${themeCssText}</style>`,
    ...(resourceBaseUrl ? [`  <base href="${escapeHtml(resourceBaseUrl)}" />`] : []),
    '</head>',
    `<body data-card-type="${escapeHtml(cardType)}" data-plugin-id="${escapeHtml(pluginId)}" data-base-card-id="${escapeHtml(baseCardId ?? '')}">`,
    '  <div id="chips-basecard-editor-root"></div>',
    '  <script>',
    pluginBundleCode,
    '  </script>',
    '  <script>',
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
    '          deleteResource(resourcePath) {',
    "            return requestResource('delete', { resourcePath });",
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
    '        pre.style.color = "var(--chips-sys-color-error, #d92d20)";',
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
  nodes: RenderedBaseCardNode[],
  mode: 'view' | 'preview',
  interactionPolicy: CompositeInteractionPolicy
): string => {
  const nodeMarkup = nodes
    .map((node) => {
      if (node.frameHtml) {
        return [
          `<section class="chips-composite__node" data-node-id="${escapeHtml(node.nodeId)}" data-card-type="${escapeHtml(node.cardType)}" data-plugin-id="${escapeHtml(node.pluginId ?? '')}" data-state="ready">`,
          `  <iframe class="chips-composite__frame" data-node-id="${escapeHtml(node.nodeId)}" title="${escapeHtml(node.title || node.cardType)}" loading="lazy" sandbox="allow-scripts allow-popups" srcdoc="${escapeHtml(node.frameHtml)}"></iframe>`,
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
    '<html lang="zh-CN">',
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src file: http: https: data:; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; font-src data: file:; child-src \'self\' blob:; frame-src \'self\' blob:;" />',
    `  <title>${escapeHtml(title)}</title>`,
    `  <style>${createCompositeThemeCss(theme, themeCssText)}</style>`,
    '</head>',
    `<body data-target="${escapeHtml(target)}" data-card-id="${escapeHtml(cardId)}" data-semantic-hash="${escapeHtml(semanticHash)}" data-mode="${escapeHtml(mode)}" data-interaction-policy="${escapeHtml(interactionPolicy)}">`,
    '  <main class="chips-composite">',
    '    <header class="chips-composite__header">',
    `      <h1 class="chips-composite__title">${escapeHtml(title)}</h1>`,
    `      <div class="chips-composite__meta">target=<code>${escapeHtml(target)}</code> nodes=<code>${String(nodes.length)}</code></div>`,
    '    </header>',
    `    <section class="chips-composite__stack">${nodeMarkup}</section>`,
    '  </main>',
    `  <script id="__chips-node-errors" type="application/json">${escapeInlineJson(nodeErrors)}</script>`,
    '  <script>',
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
    "        emit('chips.composite:resize', {",
    '          height: Math.max(240, Math.ceil(getCompositeHeight())),',
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
    '        scheduleCompositeResize("node-load");',
    '        if (remaining === 0 && !readySent) {',
    '          readySent = true;',
    "          emit('chips.composite:ready', { nodeCount: frameList.length });",
    '          scheduleCompositeResize("ready");',
    '        }',
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
    '          const node = nodeById.get(nodeId);',
    '          if (node) {',
    '            node.dataset.state = "degraded";',
    '          }',
    '          if (nodeId) {',
    '            failedNodeIds.add(nodeId);',
    '          }',
    "          const payload = { nodeId, code: 'IFRAME_LOAD_FAILED', message: 'Base card iframe failed to load.', stage: 'render-commit' };",
    '          if (nodeId) {',
    '            failedNodePayloads.set(nodeId, payload);',
    '          }',
    "          emit('chips.composite:node-error', payload);",
    '          emitFatalIfAllNodesFailed();',
    '          if (frame.dataset.loaded === "true") {',
    '            return;',
    '          }',
    '          frame.dataset.loaded = "true";',
    '          markFrameSettled();',
    '        });',
    '      }',
    '      if (frameList.length === 0 && !readySent) {',
    '        readySent = true;',
    "        emit('chips.composite:ready', { nodeCount: 0 });",
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
    '          frame.style.height = `${Math.max(96, Math.ceil(height))}px`;',
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
    "          emit('chips.composite:ready', { nodeCount: frameList.length, fallback: true });",
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
  stage: 'render-commit',
  code,
  message,
  details
});

export class CardService {
  private readonly runtime?: Pick<PluginRuntime, 'query'>;
  private readonly workspaceRoot: string;
  private readonly moduleCache = new Map<string, Promise<BaseCardPluginModule>>();
  private readonly browserBundleCache = new Map<string, Promise<string>>();
  private readonly persistentCardRootCache = new Map<string, PersistentCardRootCacheEntry>();
  private readonly basecardSessions = new Map<string, BasecardSessionRecord>();

  public constructor(
    options: CardServiceOptions = {},
    private readonly zip = new StoreZipService()
  ) {
    this.runtime = options.runtime;
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
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
      const target = options?.target ?? 'card-iframe';
      const mode = options?.mode ?? 'view';
      const interactionPolicy = options?.interactionPolicy ?? 'native';
      const theme = options?.theme;
      if (!theme) {
        throw createError('THEME_NOT_FOUND', 'Card render requires a resolved theme snapshot.');
      }
      const themeCssText = options?.themeCssText;
      const renderedNodes: RenderedBaseCardNode[] = [];

      for (const node of structureNodes) {
        renderedNodes.push(await this.renderStructureNode(node, ctx, theme, themeCssText, diagnostics, interactionPolicy));
      }

      const semanticModel = {
        cardId,
        title,
        target,
        themeId: theme.id,
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
      const body = createCompositeDocument(cardId, title, target, semanticHash, theme, themeCssText, renderedNodes, mode, interactionPolicy);

      return {
        title,
        body,
        contentFiles: ctx.contentFiles,
        target,
        semanticHash,
        diagnostics,
        consistency: options?.verifyConsistency ? createConsistencySnapshot(semanticHash) : undefined
      };
    });
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
      const coverUrl = pathToFileURL(path.resolve(coverPath)).href;

      return {
        title,
        coverUrl,
        ratio,
      };
    } finally {
      await resolvedRoot.cleanup?.();
    }
  }

  public async openBasecardSession(options: BasecardSessionOpenOptions): Promise<BasecardSessionView> {
    const prepared = await this.prepareBasecardSession(options);
    const sessionId = createId();

    this.basecardSessions.set(sessionId, {
      sessionId,
      plugin: prepared.plugin,
      module: prepared.module,
      descriptor: prepared.descriptor,
      pluginId: prepared.plugin.manifest.id,
      cardType: prepared.cardType,
      baseCardId: prepared.baseCardId,
      normalizedConfig: cloneRecord(prepared.normalizedConfig),
      validation: prepared.validation,
      referencedResources: [...prepared.referencedResources],
      cardRootDir: prepared.cardRootDir,
      resourceBaseUrl: prepared.resourceBaseUrl,
    });

    return {
      sessionId,
      pluginId: prepared.plugin.manifest.id,
      cardType: prepared.cardType,
      baseCardId: prepared.baseCardId,
      displayName: prepared.descriptor.displayName,
      normalizedConfig: cloneRecord(prepared.normalizedConfig),
      validation: prepared.validation,
      referencedResources: [...prepared.referencedResources],
      commitDebounceMs: prepared.descriptor.commitDebounceMs,
      supportsEditor: typeof prepared.module.renderBasecardEditor === 'function',
    };
  }

  public async renderBasecardSessionView(
    sessionId: string,
    theme: ThemeSnapshot,
    themeCssText?: string,
    interactionPolicy: CompositeInteractionPolicy = 'native'
  ): Promise<RenderedBasecardSessionView> {
    const session = this.requireBasecardSession(sessionId);
    const title = `${session.descriptor.displayName}`;
    const contentHtml = await this.renderBasecardHtml(
      session.plugin,
      session.normalizedConfig,
      theme,
      themeCssText
    );

    return {
      title,
      body: createChildFrameDocument(
        session.baseCardId,
        session.cardType,
        title,
        contentHtml,
        interactionPolicy,
        session.resourceBaseUrl,
      ),
      sessionId,
      pluginId: session.pluginId,
      cardType: session.cardType,
      baseCardId: session.baseCardId,
    };
  }

  public async renderBasecardSessionEditor(
    sessionId: string,
    theme: ThemeSnapshot,
    themeCssText?: string,
  ): Promise<RenderedBasecardSessionEditorView> {
    const session = this.requireBasecardSession(sessionId);
    if (typeof session.module.renderBasecardEditor !== 'function') {
      throw createError('CARD_PLUGIN_EDITOR_UNAVAILABLE', `Plugin ${session.pluginId} does not provide a basecard editor.`, {
        pluginId: session.pluginId,
        cardType: session.cardType,
      });
    }

    const pluginBundleCode = await this.bundlePluginForBrowser(session.plugin);
    const title = `${session.descriptor.displayName} Editor`;

    return {
      title,
      body: createEditorFrameDocument({
        sessionId,
        cardType: session.cardType,
        title,
        pluginBundleCode,
        initialConfig: cloneRecord(session.normalizedConfig),
        normalizedConfig: cloneRecord(session.normalizedConfig),
        validation: session.validation,
        referencedResources: [...session.referencedResources],
        pluginId: session.pluginId,
        baseCardId: session.baseCardId,
        themeCssText: createBasecardEditorThemeCss(theme, themeCssText),
        resourceBaseUrl: session.resourceBaseUrl,
      }),
      sessionId,
      pluginId: session.pluginId,
      cardType: session.cardType,
      baseCardId: session.baseCardId,
      normalizedConfig: cloneRecord(session.normalizedConfig),
      validation: session.validation,
      referencedResources: [...session.referencedResources],
    };
  }

  public closeBasecardSession(sessionId: string): { closed: boolean } {
    return { closed: this.basecardSessions.delete(sessionId) };
  }

  public async renderEditor(options: CardEditorRenderOptions): Promise<RenderedCardEditorView> {
    const theme = options.theme;
    if (!theme) {
      throw createError('THEME_NOT_FOUND', 'Card editor render requires a resolved theme snapshot.');
    }

    const prepared = await this.prepareBasecardSession({
      cardType: options.cardType,
      baseCardId: options.baseCardId,
      sourceConfig: options.initialConfig,
      cardRootDir: options.cardRootDir,
    });
    if (typeof prepared.module.renderBasecardEditor !== 'function') {
      throw createError('CARD_PLUGIN_EDITOR_UNAVAILABLE', `Plugin ${prepared.plugin.manifest.id} does not provide a basecard editor.`, {
        pluginId: prepared.plugin.manifest.id,
        cardType: prepared.cardType,
      });
    }

    const pluginBundleCode = await this.bundlePluginForBrowser(prepared.plugin);
    const title = `${prepared.descriptor.displayName} Editor`;

    return {
      title,
      body: createCardEditorFrameDocument({
        cardType: prepared.cardType,
        title,
        pluginBundleCode,
        initialConfig: cloneRecord(prepared.normalizedConfig),
        pluginId: prepared.plugin.manifest.id,
        baseCardId: prepared.baseCardId,
        themeCssText: createBasecardEditorThemeCss(theme, options.themeCssText),
        resourceBaseUrl: prepared.resourceBaseUrl,
      }),
      cardType: prepared.cardType,
      pluginId: prepared.plugin.manifest.id,
      baseCardId: prepared.baseCardId,
    };
  }

  private async renderStructureNode(
    node: StructureNode,
    ctx: CardPackageContext,
    theme: ThemeSnapshot,
    themeCssText: string | undefined,
    diagnostics: RenderNodeDiagnostic[],
    interactionPolicy: CompositeInteractionPolicy
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
      const session = await this.prepareBasecardSession({
        cardType,
        baseCardId: node.id,
        sourceConfig: content.parsed,
        cardRootDir: ctx.rootDir,
      });
      const title = asString(asRecord(session.normalizedConfig).title) ?? node.id;
      const contentHtml = await this.renderBasecardHtml(plugin, session.normalizedConfig, theme, themeCssText);
      if (!contentHtml.trim()) {
        throw createError('CARD_PLUGIN_EMPTY_RENDER', `Plugin ${plugin.manifest.id} returned empty content.`, {
          nodeId: node.id,
          cardType
        });
      }

      return {
        nodeId: node.id,
        cardType: session.cardType,
        title,
        pluginId: plugin.manifest.id,
        frameHtml: createChildFrameDocument(
          node.id,
          session.cardType,
          title,
          contentHtml,
          interactionPolicy,
          session.resourceBaseUrl,
        )
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

  private resolveCardPlugin(cardType: string): RenderablePluginRecord | undefined {
    const normalizedCardType = cardType.trim();
    if (!normalizedCardType) {
      return undefined;
    }

    const plugins = this.runtime?.query({ type: 'card' }) ?? [];

    return plugins
      .filter(
        (record): record is RenderablePluginRecord =>
          Boolean(record.enabled && typeof record.manifest.entry === 'string' && record.manifest.entry.length > 0)
      )
      .find((record) => {
        const capabilities = new Set(record.manifest.capabilities ?? []);
        return capabilities.has(normalizedCardType);
      });
  }

  private requireBasecardSession(sessionId: string): BasecardSessionRecord {
    const trimmed = sessionId.trim();
    const session = this.basecardSessions.get(trimmed);
    if (!session) {
      throw createError('BASECARD_SESSION_NOT_FOUND', `Basecard session is not active: ${sessionId}`, {
        sessionId,
      });
    }
    return session;
  }

  private async resolveBasecardPluginRuntime(cardType: string): Promise<ResolvedBasecardPluginRuntime> {
    const plugin = this.resolveCardPlugin(cardType);
    if (!plugin) {
      throw createError('CARD_PLUGIN_NOT_FOUND', `No enabled base card plugin can render ${cardType}.`, {
        cardType,
      });
    }

    const module = await this.loadPluginModule(plugin);
    const descriptor = this.resolveBasecardDescriptor(module, plugin, cardType);
    return { plugin, module, descriptor };
  }

  private resolveBasecardDescriptor(
    module: BaseCardPluginModule,
    plugin: RenderablePluginRecord,
    requestedCardType: string,
  ): BasecardRuntimeDescriptor {
    if (typeof module.getBasecardDescriptor !== 'function') {
      throw createError('CARD_PLUGIN_CONTRACT_INVALID', `Plugin ${plugin.manifest.id} does not export getBasecardDescriptor.`, {
        pluginId: plugin.manifest.id,
        entry: plugin.manifest.entry,
      });
    }

    const rawDescriptor = module.getBasecardDescriptor();
    const cardType = typeof rawDescriptor?.cardType === 'string' && rawDescriptor.cardType.trim()
      ? rawDescriptor.cardType.trim()
      : requestedCardType.trim();
    if (requestedCardType.trim().length > 0 && cardType !== requestedCardType.trim()) {
      throw createError(
        'CARD_PLUGIN_CONTRACT_INVALID',
        `Plugin ${plugin.manifest.id} descriptor cardType must exactly match requested cardType.`,
        {
          pluginId: plugin.manifest.id,
          requestedCardType,
          descriptorCardType: cardType,
        },
      );
    }
    const displayName = typeof rawDescriptor?.displayName === 'string' && rawDescriptor.displayName.trim()
      ? rawDescriptor.displayName.trim()
      : cardType;

    return {
      cardType,
      displayName,
      commitDebounceMs:
        typeof rawDescriptor?.commitDebounceMs === 'number' && Number.isFinite(rawDescriptor.commitDebounceMs)
          ? Math.max(0, Math.round(rawDescriptor.commitDebounceMs))
          : 260,
    };
  }

  private async prepareBasecardSession(
    options: BasecardSessionOpenOptions,
  ): Promise<{
    plugin: RenderablePluginRecord;
    module: BaseCardPluginModule;
    descriptor: BasecardRuntimeDescriptor;
    cardType: string;
    baseCardId: string;
    normalizedConfig: Record<string, unknown>;
    validation: BasecardValidationResult;
    referencedResources: string[];
    cardRootDir?: string;
    resourceBaseUrl?: string;
  }> {
    const trimmedCardType = options.cardType.trim();
    if (!trimmedCardType) {
      throw createError('INVALID_ARGUMENT', 'cardType is required for basecard session.');
    }

    const { plugin, module, descriptor } = await this.resolveBasecardPluginRuntime(trimmedCardType);
    if (typeof module.normalizeBasecardConfig !== 'function') {
      throw createError('CARD_PLUGIN_CONTRACT_INVALID', `Plugin ${plugin.manifest.id} does not export normalizeBasecardConfig.`, {
        pluginId: plugin.manifest.id,
        entry: plugin.manifest.entry,
      });
    }
    if (typeof module.validateBasecardConfig !== 'function') {
      throw createError('CARD_PLUGIN_CONTRACT_INVALID', `Plugin ${plugin.manifest.id} does not export validateBasecardConfig.`, {
        pluginId: plugin.manifest.id,
        entry: plugin.manifest.entry,
      });
    }
    if (typeof module.collectReferencedResources !== 'function') {
      throw createError('CARD_PLUGIN_CONTRACT_INVALID', `Plugin ${plugin.manifest.id} does not export collectReferencedResources.`, {
        pluginId: plugin.manifest.id,
        entry: plugin.manifest.entry,
      });
    }

    const baseCardId = asString(options.baseCardId)
      ?? asString(options.sourceConfig?.id)
      ?? createId();

    let sourceConfig = options.sourceConfig ?? {};
    if ((!sourceConfig || Object.keys(sourceConfig).length === 0) && typeof module.createInitialBasecardConfig === 'function') {
      const created = module.createInitialBasecardConfig(baseCardId);
      if (created && typeof created === 'object' && !Array.isArray(created)) {
        sourceConfig = created as Record<string, unknown>;
      }
    }

    const rawNormalized = module.normalizeBasecardConfig(sourceConfig, baseCardId);
    const normalizedConfig =
      rawNormalized && typeof rawNormalized === 'object' && !Array.isArray(rawNormalized)
        ? cloneRecord(rawNormalized as Record<string, unknown>)
        : { id: baseCardId };
    const validation = toBasecardValidationResult(module.validateBasecardConfig(normalizedConfig));
    const referencedResources = normalizeReferencedResources(module.collectReferencedResources(normalizedConfig));
    const cardRootDir = asString(options.cardRootDir) ? path.resolve(options.cardRootDir as string) : undefined;

    return {
      plugin,
      module,
      descriptor,
      cardType: descriptor.cardType,
      baseCardId,
      normalizedConfig,
      validation,
      referencedResources,
      cardRootDir,
      resourceBaseUrl: toResourceBaseUrl(cardRootDir),
    };
  }

  private async renderBasecardHtml(
    plugin: RenderablePluginRecord,
    config: Record<string, unknown>,
    theme: ThemeSnapshot,
    themeCssText: string | undefined
  ): Promise<string> {
    const module = await this.loadPluginModule(plugin);
    if (typeof module.renderBasecardView !== 'function') {
      throw createError('CARD_PLUGIN_INVALID', `Plugin ${plugin.manifest.id} does not export renderBasecardView.`, {
        pluginId: plugin.manifest.id,
        entry: plugin.manifest.entry
      });
    }

    const jsdom = require('jsdom') as { JSDOM: new (html?: string, options?: { url?: string }) => { window: any } };
    const dom = new jsdom.JSDOM('<!doctype html><html><body><div id="chips-basecard-root"></div></body></html>', {
      url: 'file:///'
    });
    const win = dom.window;
    const container = win.document.getElementById('chips-basecard-root');
    if (!container) {
      dom.window.close();
      throw createError('CARD_RENDER_CONTAINER_MISSING', 'Failed to allocate base card render container.');
    }

    const previousDescriptors = new Map<string, PropertyDescriptor | undefined>();
    const overrideGlobal = (key: string, value: unknown): void => {
      previousDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
      Object.defineProperty(globalThis, key, {
        configurable: true,
        writable: true,
        value
      });
    };

    overrideGlobal('window', win);
    overrideGlobal('document', win.document);
    overrideGlobal('navigator', win.navigator);
    overrideGlobal('HTMLElement', win.HTMLElement);
    overrideGlobal('Node', win.Node);
    overrideGlobal('Element', win.Element);
    overrideGlobal('NodeFilter', win.NodeFilter);

    try {
      module.renderBasecardView({
        container,
        config,
        themeCssText: createBasecardThemeCss(theme, themeCssText)
      });
      return container.innerHTML;
    } finally {
      for (const [key, descriptor] of previousDescriptors.entries()) {
        if (typeof descriptor === 'undefined') {
          delete (globalThis as Record<string, unknown>)[key];
        } else {
          Object.defineProperty(globalThis, key, descriptor);
        }
      }
      dom.window.close();
    }
  }

  private async loadPluginModule(plugin: RenderablePluginRecord): Promise<BaseCardPluginModule> {
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

  private async withExtractedCard<T>(cardFile: string, task: (ctx: CardPackageContext) => Promise<T>): Promise<T> {
    const check = await this.validate(cardFile);
    if (!check.valid) {
      throw createError('CARD_SCHEMA_INVALID', 'Card format validation failed', check.errors);
    }

    const resolvedRoot = await this.resolveCardRoot(cardFile);
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

      await fs.rm(cached.rootDir, { recursive: true, force: true });
      this.persistentCardRootCache.delete(cardFile);
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-card-cover-'));
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
}
