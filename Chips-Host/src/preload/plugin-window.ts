import {
  createAndExposeBridgeForKernel,
  type BridgeContextOptions,
  type PlatformLaunchContext
} from './create-bridge';
import type { SurfaceContext, SurfaceKind, SurfacePresentation } from '../../packages/pal/src';
import {
  normalizeThemeCssForBrowser,
  normalizeThemeTokenValueForBrowser
} from '../shared/theme-css-units';
import { bootCommandShortcutRuntime } from './command-shortcuts';

const CHIPS_BRIDGE_CONTEXT_ARG_PREFIX = '--chips-bridge-context=';

interface ParsedBridgeContext {
  bridge: BridgeContextOptions;
  launchContext: PlatformLaunchContext;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

const surfaceKinds: SurfaceKind[] = ['window', 'tab', 'route', 'modal', 'sheet', 'fullscreen'];

const normalizeLaunchParams = (value: unknown): Record<string, unknown> => {
  return isRecord(value) ? { ...value } : {};
};

const normalizeSurfacePresentation = (value: unknown): SurfacePresentation | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  return { ...value } as SurfacePresentation;
};

const normalizeSurfaceContext = (value: unknown): SurfaceContext | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const sceneId = typeof value.sceneId === 'string' ? value.sceneId : undefined;
  const kind = typeof value.kind === 'string' && surfaceKinds.includes(value.kind as SurfaceKind)
    ? value.kind as SurfaceKind
    : undefined;
  const presentation = normalizeSurfacePresentation(value.presentation);
  if (!sceneId || !kind || !presentation) {
    return undefined;
  }

  const commandContext = isRecord(value.commandContext)
    ? {
        commandId:
          typeof value.commandContext.commandId === 'string'
            ? value.commandContext.commandId
            : '',
        source:
          typeof value.commandContext.source === 'string'
            ? value.commandContext.source
            : undefined,
        payload: normalizeLaunchParams(value.commandContext.payload),
        taskId:
          typeof value.commandContext.taskId === 'string'
            ? value.commandContext.taskId
            : undefined
      }
    : undefined;

  return {
    surfaceId: typeof value.surfaceId === 'string' ? value.surfaceId : undefined,
    sceneId,
    pluginId: typeof value.pluginId === 'string' ? value.pluginId : undefined,
    sessionId: typeof value.sessionId === 'string' ? value.sessionId : undefined,
    kind,
    presentation,
    launchParams: normalizeLaunchParams(value.launchParams),
    documentContext: isRecord(value.documentContext)
      ? {
          documentId:
            typeof value.documentContext.documentId === 'string'
              ? value.documentContext.documentId
              : '',
          title:
            typeof value.documentContext.title === 'string'
              ? value.documentContext.title
              : undefined,
          url:
            typeof value.documentContext.url === 'string'
              ? value.documentContext.url
              : undefined
        }
      : undefined,
    commandContext: commandContext?.commandId ? commandContext : undefined
  };
};

const parseBridgeContext = (): ParsedBridgeContext => {
  const targetArg = process.argv.find((value) => value.startsWith(CHIPS_BRIDGE_CONTEXT_ARG_PREFIX));
  if (!targetArg) {
    return {
      bridge: {
        callerId: 'plugin-preload',
        callerType: 'plugin',
        permissions: []
      },
      launchContext: {
        launchParams: {}
      }
    };
  }

  try {
    const encoded = targetArg.slice(CHIPS_BRIDGE_CONTEXT_ARG_PREFIX.length);
    const decoded = Buffer.from(encoded, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded) as {
      pluginId?: unknown;
      sessionId?: unknown;
      permissions?: unknown;
      launchParams?: unknown;
      surfaceContext?: unknown;
    };
    const surfaceContext = normalizeSurfaceContext(parsed.surfaceContext);
    const launchParams = normalizeLaunchParams(parsed.launchParams);

    return {
      bridge: {
        callerId: 'plugin-preload',
        callerType: 'plugin',
        pluginId: typeof parsed.pluginId === 'string' ? parsed.pluginId : undefined,
        sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined,
        permissions: Array.isArray(parsed.permissions)
          ? parsed.permissions.filter((item): item is string => typeof item === 'string')
          : []
      },
      launchContext: {
        pluginId: typeof parsed.pluginId === 'string' ? parsed.pluginId : undefined,
        sessionId: typeof parsed.sessionId === 'string' ? parsed.sessionId : undefined,
        sceneId: surfaceContext?.sceneId,
        surfaceId: surfaceContext?.surfaceId,
        kind: surfaceContext?.kind,
        presentation: surfaceContext?.presentation,
        surfaceContext,
        launchParams
      }
    };
  } catch {
    return {
      bridge: {
        callerId: 'plugin-preload',
        callerType: 'plugin',
        permissions: []
      },
      launchContext: {
        launchParams: {}
      }
    };
  }
};

const THEME_STYLE_ELEMENT_ID = 'chips-plugin-theme-style';
const THEME_ID_ATTRIBUTE = 'data-chips-theme-id';
const THEME_VERSION_ATTRIBUTE = 'data-chips-theme-version';

const getDomGlobals = (): { document?: any; window?: any } => {
  return globalThis as { document?: any; window?: any };
};

const applyThemeVariables = (target: any, variables: Record<string, unknown>): void => {
  for (const [tokenKey, tokenValue] of Object.entries(variables)) {
    if (typeof tokenValue !== 'string' && typeof tokenValue !== 'number') {
      continue;
    }
    const browserValue = normalizeThemeTokenValueForBrowser(tokenValue);
    target.style.setProperty(`--${tokenKey.replaceAll('.', '-')}`, String(browserValue));
  }
};

const ensureThemeStyleElement = (documentRef: any): any => {
  const existing = documentRef.getElementById(THEME_STYLE_ELEMENT_ID);
  if (existing && typeof existing.tagName === 'string' && existing.tagName.toLowerCase() === 'style') {
    return existing;
  }

  const styleEl = documentRef.createElement('style');
  styleEl.id = THEME_STYLE_ELEMENT_ID;
  documentRef.head.appendChild(styleEl);
  return styleEl;
};

const parsedBridgeContext = parseBridgeContext();
const bridge = createAndExposeBridgeForKernel(null, {
  ...parsedBridgeContext.bridge,
  launchContext: parsedBridgeContext.launchContext
});
bootCommandShortcutRuntime(bridge, parsedBridgeContext.launchContext);

const syncThemeToDocument = async (): Promise<void> => {
  const { document, window } = getDomGlobals();
  if (!document || !window) {
    return;
  }

  const [current, cssResult, resolved] = await Promise.all([
    bridge.invoke<{ themeId: string; displayName: string; version: string }>('theme.getCurrent', {}),
    bridge.invoke<{ css: string; themeId: string }>('theme.getAllCss', {}),
    bridge.invoke<{
      resolved: Array<{ id: string; displayName: string; version: string; order: number }>;
      tokens: Record<string, unknown>;
      diagnostics?: unknown[];
      summary?: unknown;
    }>('theme.resolve', { chain: [] })
  ]);

  const root = document.documentElement;
  const styleEl = ensureThemeStyleElement(document);
  styleEl.textContent = normalizeThemeCssForBrowser(cssResult.css);
  root.setAttribute(THEME_ID_ATTRIBUTE, current.themeId);
  root.setAttribute(THEME_VERSION_ATTRIBUTE, current.version);
  applyThemeVariables(root, resolved.tokens);
};

const bootThemeRuntime = (): void => {
  const { document, window } = getDomGlobals();
  if (!document || !window) {
    return;
  }

  // 主题系统已废弃（task030 卸担计划）：插件不再消费主题 CSS。
  // 无 theme.read 权限的插件（新体系插件均不声明）跳过主题注入，避免权限拒绝噪音。
  if (!parsedBridgeContext.bridge.permissions?.includes('theme.read')) {
    return;
  }

  let refreshPromise: Promise<void> | null = null;

  const refresh = () => {
    if (!refreshPromise) {
      refreshPromise = syncThemeToDocument().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  };

  const onReady = () => {
    void refresh();
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', onReady, { once: true });
  } else {
    onReady();
  }

  bridge.on('theme.changed', () => {
    void refresh();
  });
};

bootThemeRuntime();
