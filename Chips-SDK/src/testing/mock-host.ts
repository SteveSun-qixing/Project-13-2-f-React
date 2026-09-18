import { createClient } from "../core/client";
import type { ChipsBridge } from "../core/bridge-adapter";
import type {
  Client,
  ClientConfig,
  EventsApi,
} from "../types/client";
import { createError, normalizeStandardError, type StandardError } from "../types/errors";
import type {
  ThemeChangedPayload,
  ThemeContractView,
  ThemeDiagnosticSummary,
  ThemeMeta,
  ThemeState,
} from "../api/theme";
import type { LanguageChangedPayload } from "../api/i18n";
import type {
  CommandChangedEvent,
  CommandDefinitionInput,
  CommandInvokedEvent,
  CommandInvokeResult,
  CommandQueryOptions,
  CommandRegisteredEvent,
  CommandSetStateOptions,
  CommandState,
  CommandUnregisteredEvent,
  CommandView,
  CommandSource,
} from "../api/command";
import type { CliTaskRecord } from "../api/cli-task";
import type {
  PlatformCapabilitySnapshot,
  PlatformInfo,
  PlatformLaunchContext,
  PlatformPowerState,
  PlatformScreenInfo,
  PlatformTrayState,
} from "../api/platform";
import type {
  SurfaceContext,
  SurfaceKind,
  SurfaceOpenRequest,
  SurfaceState,
  SurfaceStateKind,
} from "../api/surface";
import type {
  ControlPlaneDiagnoseResult,
  ControlPlaneHealthResult,
  ControlPlaneMetrics,
} from "../api/control-plane";

export interface MockChipsHostCall {
  action: string;
  payload: unknown;
  timestamp: number;
}

export interface MockChipsHostState {
  theme: ThemeState;
  themes: ThemeMeta[];
  themeCss: string;
  themeTokens: Record<string, unknown>;
  themeContract: ThemeContractView;
  locale: string;
  locales: string[];
  translations: Record<string, string> | Record<string, Record<string, string>>;
  launchContext: PlatformLaunchContext;
  surfaces: SurfaceState[];
  commands: CommandView[];
  cliTasks: CliTaskRecord[];
  diagnostics: ControlPlaneDiagnoseResult;
  metrics: ControlPlaneMetrics;
  permissions: string[];
  platformInfo: PlatformInfo;
  platformCapabilities: PlatformCapabilitySnapshot;
  screen: PlatformScreenInfo;
  power: PlatformPowerState;
  tray: PlatformTrayState;
}

export interface MockActionContext {
  action: string;
  payload: unknown;
  call: MockChipsHostCall;
  host: MockChipsHost;
}

export type MockActionHandler = (
  payload: unknown,
  context: MockActionContext,
) => unknown | Promise<unknown>;

export type MockActionFault =
  | StandardError
  | Error
  | ((payload: unknown, context: MockActionContext) => unknown | Promise<unknown>);

export interface MockChipsHostOptions {
  theme?: Partial<ThemeState> & { themeId?: string };
  themes?: ThemeMeta[];
  themeCss?: string;
  themeTokens?: Record<string, unknown>;
  themeContract?: Partial<ThemeContractView>;
  locale?: string;
  locales?: string[];
  translations?: Record<string, string> | Record<string, Record<string, string>>;
  launchContext?: Partial<PlatformLaunchContext>;
  surfaceContext?: Partial<SurfaceContext>;
  permissions?: string[];
  diagnostics?: Partial<ControlPlaneDiagnoseResult>;
  metrics?: ControlPlaneMetrics;
  platformInfo?: Partial<PlatformInfo>;
  platformCapabilities?: Partial<PlatformCapabilitySnapshot>;
  screen?: Partial<PlatformScreenInfo>;
  power?: Partial<PlatformPowerState>;
  tray?: Partial<PlatformTrayState>;
  actions?: Record<string, MockActionHandler>;
  faults?: Record<string, MockActionFault>;
  delays?: Record<string, number>;
}

export interface MockBridgeTarget {
  window?: {
    chips?: ChipsBridge;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface MockChipsHost {
  readonly calls: MockChipsHostCall[];
  readonly state: MockChipsHostState;
  readonly events: EventsApi;
  emit<T>(event: string, payload: T): Promise<void>;
  transport(action: string, payload: unknown): Promise<unknown>;
  createBridge(): ChipsBridge;
  installBridge(target?: MockBridgeTarget): () => void;
  createClient(config?: ClientConfig): MockChipsClient;
  setActionHandler(action: string, handler: MockActionHandler): void;
  clearActionHandler(action: string): void;
  setFault(action: string, fault: MockActionFault): void;
  clearFault(action: string): void;
  setPermissionDenied(
    action: string,
    required: string | string[],
    granted?: string[],
    options?: { message?: string; messageKey?: string; pluginId?: string },
  ): void;
  setDelay(action: string, delayMs: number): void;
  clearDelay(action: string): void;
  resetCalls(): void;
}

export type MockChipsClient = Client & {
  readonly mockHost: MockChipsHost;
  readonly calls: MockChipsHostCall[];
  readonly state: MockChipsHostState;
  restoreBridge(): void;
};

export interface MockChipsClientOptions extends MockChipsHostOptions {
  clientConfig?: ClientConfig;
  installBridge?: boolean;
  bridgeTarget?: MockBridgeTarget;
}

export function createMockThemeDiagnosticSummary(
  overrides: Partial<ThemeDiagnosticSummary> = {},
): ThemeDiagnosticSummary {
  return {
    total: 0,
    blocking: 0,
    bySeverity: {
      info: 0,
      warning: 0,
      error: 0,
    },
    byCode: {},
    status: "complete",
    ...overrides,
  };
}

export function createMockSurfaceContext(
  overrides: Partial<SurfaceContext> = {},
): SurfaceContext {
  return {
    sceneId: overrides.sceneId ?? "test-scene",
    surfaceId: overrides.surfaceId ?? "test-surface",
    pluginId: overrides.pluginId ?? "com.chips.test-plugin",
    sessionId: overrides.sessionId ?? "test-session",
    kind: overrides.kind ?? "window",
    presentation: {
      title: "Test Surface",
      width: 960,
      height: 640,
      ...overrides.presentation,
    },
    launchParams: {
      ...overrides.launchParams,
    },
    documentContext: overrides.documentContext,
    commandContext: overrides.commandContext,
  };
}

export function createMockLaunchContext(
  overrides: Partial<PlatformLaunchContext> = {},
): PlatformLaunchContext {
  const surfaceContext = overrides.surfaceContext ?? createMockSurfaceContext();
  return {
    pluginId: overrides.pluginId ?? surfaceContext.pluginId,
    sessionId: overrides.sessionId ?? surfaceContext.sessionId,
    sceneId: overrides.sceneId ?? surfaceContext.sceneId,
    surfaceId: overrides.surfaceId ?? surfaceContext.surfaceId,
    kind: overrides.kind ?? surfaceContext.kind,
    presentation: overrides.presentation ?? surfaceContext.presentation,
    surfaceContext,
    launchParams: {
      ...overrides.launchParams,
    },
  };
}

export function createMockPermissionDeniedError(
  action: string,
  required: string | string[],
  granted: string[] = [],
  options: { message?: string; messageKey?: string; pluginId?: string } = {},
): StandardError {
  const requiredList = Array.isArray(required) ? required : [required];
  return createError(
    "PERMISSION_DENIED",
    options.message ?? `Permission denied for ${action}.`,
    {
      action,
      required: requiredList,
      granted,
    },
    false,
    {
      messageKey: options.messageKey ?? "chips.error.permissionDenied",
      permission: {
        action,
        required: requiredList,
        granted,
        messageKey: options.messageKey ?? "chips.error.permissionDenied",
        pluginId: options.pluginId,
      },
    },
  );
}

export function createMockChipsHost(options: MockChipsHostOptions = {}): MockChipsHost {
  const calls: MockChipsHostCall[] = [];
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const actionHandlers = new Map<string, MockActionHandler>();
  const faults = new Map<string, MockActionFault>();
  const delays = new Map<string, number>();
  let surfaceSeed = 0;
  let invocationSeed = 0;
  let cliTaskSeed = 0;

  const theme: ThemeState = {
    themeId: options.theme?.themeId ?? "chips-official.default-theme",
    displayName: options.theme?.displayName ?? "薯片官方 · 默认主题",
    version: options.theme?.version ?? "1.0.0",
    parentTheme: options.theme?.parentTheme,
  };
  const defaultSurfaceContext = createMockSurfaceContext({
    ...options.surfaceContext,
    launchParams: {
      ...options.surfaceContext?.launchParams,
    },
  });
  const launchContext = createMockLaunchContext({
    surfaceContext: defaultSurfaceContext,
    ...options.launchContext,
  });

  const state: MockChipsHostState = {
    theme,
    themes: options.themes ?? [
      {
        id: theme.themeId,
        displayName: theme.displayName,
        version: theme.version,
        isDefault: true,
      },
      {
        id: "chips-official.default-dark-theme",
        displayName: "薯片官方 · 默认深色主题",
        version: "1.0.0",
        isDefault: false,
        parentTheme: theme.themeId,
      },
    ],
    themeCss: options.themeCss ?? ":root { --chips-sys-color-surface: #ffffff; }",
    themeTokens: options.themeTokens ?? {},
    themeContract: createDefaultThemeContract(theme, options.themeContract),
    locale: options.locale ?? "zh-CN",
    locales: options.locales ?? ["zh-CN", "en-US"],
    translations: options.translations ?? {},
    launchContext,
    surfaces: [
      createSurfaceStateFromContext(defaultSurfaceContext),
    ],
    commands: [],
    cliTasks: [],
    diagnostics: {
      routeCount: 0,
      serviceCount: 0,
      config: {},
      runtimeSnapshot: {},
      topFailureRoutes: [],
      ...options.diagnostics,
    },
    metrics: options.metrics ?? {},
    permissions: options.permissions ?? [],
    platformInfo: {
      hostKind: "headless",
      platform: "server",
      arch: "test",
      release: "0.0.0",
      ...options.platformInfo,
    },
    platformCapabilities: createDefaultPlatformCapabilities(options.platformCapabilities),
    screen: {
      id: "screen-test",
      width: 1440,
      height: 900,
      scaleFactor: 2,
      x: 0,
      y: 0,
      primary: true,
      ...options.screen,
    },
    power: {
      idleSeconds: 0,
      preventSleep: false,
      ...options.power,
    },
    tray: {
      active: false,
      ...options.tray,
    },
  };

  for (const [action, handler] of Object.entries(options.actions ?? {})) {
    actionHandlers.set(action, handler);
  }
  for (const [action, fault] of Object.entries(options.faults ?? {})) {
    faults.set(action, fault);
  }
  for (const [action, delayMs] of Object.entries(options.delays ?? {})) {
    delays.set(action, delayMs);
  }

  const events: EventsApi = {
    on<T>(event: string, handler: (payload: T) => void): () => void {
      const set = listeners.get(event) ?? new Set<(payload: unknown) => void>();
      const wrapped = (payload: unknown) => handler(payload as T);
      set.add(wrapped);
      listeners.set(event, set);
      return () => {
        const handlers = listeners.get(event);
        if (!handlers) return;
        handlers.delete(wrapped);
        if (handlers.size === 0) {
          listeners.delete(event);
        }
      };
    },
    once<T>(event: string, handler: (payload: T) => void): () => void {
      const off = events.on<T>(event, (payload) => {
        off();
        handler(payload);
      });
      return off;
    },
    async emit<T>(event: string, payload: T): Promise<void> {
      const handlers = listeners.get(event);
      if (!handlers) return;
      for (const handler of [...handlers]) {
        handler(payload);
      }
    },
  };

  const host: MockChipsHost = {
    calls,
    state,
    events,
    emit(event, payload) {
      return events.emit(event, payload);
    },
    async transport(action, payload) {
      const call = {
        action,
        payload,
        timestamp: Date.now(),
      };
      calls.push(call);
      const context: MockActionContext = { action, payload, call, host };

      const delayMs = delays.get(action);
      if (typeof delayMs === "number" && delayMs > 0) {
        await delay(delayMs);
      }

      const fault = faults.get(action);
      if (fault) {
        throw await resolveFault(fault, payload, context);
      }

      const customHandler = actionHandlers.get(action);
      if (customHandler) {
        return customHandler(payload, context);
      }

      return handleDefaultAction(action, payload, host, {
        nextSurfaceId() {
          surfaceSeed += 1;
          return `surface-${surfaceSeed}`;
        },
        nextInvocationId() {
          invocationSeed += 1;
          return `invocation-${invocationSeed}`;
        },
        nextCliTaskId() {
          cliTaskSeed += 1;
          return `cli-task-${cliTaskSeed}`;
        },
      });
    },
    createBridge() {
      const bridge: ChipsBridge = {
        invoke(action, payload = {}) {
          return host.transport(action, payload);
        },
        invokeScoped(action, payload) {
          return host.transport(action, payload);
        },
        on: events.on,
        once: events.once,
        emit: events.emit,
        emitScoped(event, payload) {
          return events.emit(event, payload);
        },
        platform: {
          getPathForFile(file: unknown) {
            if (file && typeof file === "object" && "path" in file) {
              const value = (file as { path?: unknown }).path;
              return typeof value === "string" ? value : "";
            }
            return "";
          },
          getLaunchContext() {
            return state.launchContext;
          },
        },
      };
      return bridge;
    },
    installBridge(target: MockBridgeTarget = globalThis as unknown as MockBridgeTarget) {
      const hadWindow = Object.prototype.hasOwnProperty.call(target, "window");
      const previousWindow = target.window;
      const previousChips = target.window?.chips;
      const windowObject = target.window ?? {};
      windowObject.chips = host.createBridge();
      target.window = windowObject;

      return () => {
        if (!hadWindow) {
          delete target.window;
          return;
        }
        if (previousWindow) {
          previousWindow.chips = previousChips;
          target.window = previousWindow;
        }
      };
    },
    createClient(config: ClientConfig = {}) {
      const restoreBridge = host.installBridge();
      const client = createClient({
        environment: "plugin",
        ...config,
      }) as MockChipsClient;
      return attachMockHost(client, host, restoreBridge);
    },
    setActionHandler(action, handler) {
      actionHandlers.set(action, handler);
    },
    clearActionHandler(action) {
      actionHandlers.delete(action);
    },
    setFault(action, fault) {
      faults.set(action, fault);
    },
    clearFault(action) {
      faults.delete(action);
    },
    setPermissionDenied(action, required, granted = [], faultOptions = {}) {
      faults.set(action, createMockPermissionDeniedError(action, required, granted, faultOptions));
    },
    setDelay(action, delayMs) {
      delays.set(action, delayMs);
    },
    clearDelay(action) {
      delays.delete(action);
    },
    resetCalls() {
      calls.splice(0, calls.length);
    },
  };

  return host;
}

export function createMockChipsClient(options: MockChipsClientOptions = {}): MockChipsClient {
  const {
    clientConfig,
    installBridge = true,
    bridgeTarget,
    ...hostOptions
  } = options;
  const host = createMockChipsHost(hostOptions);
  const restoreBridge = installBridge ? host.installBridge(bridgeTarget) : () => undefined;
  const config: ClientConfig = installBridge
    ? { environment: "plugin", ...clientConfig }
    : { environment: "node", transport: host.transport, ...clientConfig };
  const client = createClient(config) as MockChipsClient;
  return attachMockHost(client, host, restoreBridge);
}

function attachMockHost(
  client: Client,
  host: MockChipsHost,
  restoreBridge: () => void,
): MockChipsClient {
  return Object.assign(client, {
    mockHost: host,
    calls: host.calls,
    state: host.state,
    restoreBridge,
  });
}

function createDefaultThemeContract(
  theme: ThemeState,
  overrides: Partial<ThemeContractView> = {},
): ThemeContractView {
  const summary = createMockThemeDiagnosticSummary();
  return {
    schemaVersion: "1.0.0",
    themeId: theme.themeId,
    themeVersion: theme.version,
    contractVersion: "1.0.0",
    components: [],
    summary,
    ...overrides,
  };
}

function createDefaultPlatformCapabilities(
  overrides: Partial<PlatformCapabilitySnapshot> = {},
): PlatformCapabilitySnapshot {
  return {
    hostKind: "headless",
    platform: "server",
    facets: {
      surface: {
        supported: true,
        interactive: false,
        supportedKinds: ["window", "tab", "route", "modal", "sheet", "fullscreen"],
      },
      storage: {
        localWorkspace: true,
        sandboxFilePicker: false,
        remoteBacked: false,
      },
      selection: {
        openFile: true,
        saveFile: true,
        directory: true,
        multiple: true,
      },
      transfer: {
        upload: false,
        download: true,
        share: true,
        externalOpen: true,
        revealInShell: true,
      },
      association: {
        fileAssociation: true,
        urlScheme: true,
        shareTarget: false,
      },
      device: {
        screen: true,
        power: true,
        network: false,
      },
      systemUi: {
        clipboard: true,
        tray: true,
        globalShortcut: true,
        notification: true,
      },
      background: {
        keepAlive: false,
        wakeEvents: false,
      },
      ipc: {
        namedPipe: true,
        unixSocket: true,
        sharedMemory: false,
      },
      offscreenRender: {
        htmlToPdf: false,
        htmlToImage: false,
        videoFrame: false,
      },
    },
    ...overrides,
  };
}

function createSurfaceStateFromContext(context: SurfaceContext): SurfaceState {
  return {
    id: context.surfaceId ?? "test-surface",
    kind: context.kind,
    title: context.presentation.title,
    width: context.presentation.width,
    height: context.presentation.height,
    focused: true,
    state: "normal",
    pluginId: context.pluginId,
    sessionId: context.sessionId,
    chrome: context.presentation.chrome,
    context,
  };
}

async function resolveFault(
  fault: MockActionFault,
  payload: unknown,
  context: MockActionContext,
): Promise<unknown> {
  if (typeof fault === "function") {
    return fault(payload, context);
  }
  return fault;
}

async function delay(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

function handleDefaultAction(
  action: string,
  payload: unknown,
  host: MockChipsHost,
  ids: {
    nextSurfaceId(): string;
    nextInvocationId(): string;
    nextCliTaskId(): string;
  },
): unknown | Promise<unknown> {
  switch (action) {
    case "office.document.create":
      return mockOfficeCreate(payload, host);
    case "office.document.open":
      return mockOfficeOpen(payload, host);
    case "office.document.read":
      return mockOfficeRead(payload, host);
    case "office.document.write":
      return mockOfficeWrite(payload, host);
    case "office.document.get":
      return mockOfficeGet(payload, host);
    case "office.document.persist":
      return mockOfficePersist(payload, host);
    case "office.document.close":
      return mockOfficeClose(payload, host);
    case "theme.list":
      return { themes: host.state.themes };
    case "theme.apply":
      return applyTheme(payload, host);
    case "theme.getCurrent":
      return host.state.theme;
    case "theme.getAllCss":
      return { css: host.state.themeCss, themeId: host.state.theme.themeId };
    case "theme.resolve":
      return {
        resolved: normalizeThemeChain(payload, host),
        tokens: host.state.themeTokens,
        diagnostics: [],
        summary: createMockThemeDiagnosticSummary(),
      };
    case "theme.contract.get":
      return host.state.themeContract;
    case "i18n.getCurrent":
      return { locale: host.state.locale };
    case "i18n.setCurrent":
      return setLocale(payload, host);
    case "i18n.translate":
      return { text: translate(payload, host) };
    case "i18n.listLocales":
      return { locales: host.state.locales };
    case "surface.open":
      return openSurface(payload, host, ids.nextSurfaceId);
    case "surface.focus":
      return updateSurface(payload, host, (surface) => ({ ...surface, focused: true }));
    case "surface.resize":
      return updateSurface(payload, host, (surface, record) => ({
        ...surface,
        width: typeof record.width === "number" ? record.width : surface.width,
        height: typeof record.height === "number" ? record.height : surface.height,
      }));
    case "surface.setState":
      return updateSurface(payload, host, (surface, record) => ({
        ...surface,
        state: isSurfaceState(record.state) ? record.state : surface.state,
      }));
    case "surface.getState":
      return { state: requireSurface(payload, host) };
    case "surface.close":
      return closeSurface(payload, host);
    case "surface.list":
      return { surfaces: host.state.surfaces };
    case "command.register":
      return registerCommand(payload, host);
    case "command.unregister":
      return unregisterCommand(payload, host);
    case "command.get":
      return { command: getCommand(payload, host) };
    case "command.list":
      return { commands: listCommands(payload, host) };
    case "command.invoke":
      return invokeCommand(payload, host, ids.nextInvocationId);
    case "command.setState":
      return setCommandState(payload, host);
    case "cli.task.create":
      return createCliTask(payload, host, ids.nextCliTaskId);
    case "cli.task.bindInvocation":
      return bindCliTaskInvocation(payload, host);
    case "cli.task.get":
      return { task: requireCliTask(payload, host) };
    case "cli.task.progress":
      return updateCliTaskProgress(payload, host);
    case "cli.task.complete":
      return completeCliTask(payload, host);
    case "cli.task.fail":
      return failCliTask(payload, host);
    case "cli.task.cancel":
      return cancelCliTask(payload, host);
    case "platform.getInfo":
      return { info: host.state.platformInfo };
    case "platform.getCapabilities":
      return { capabilities: host.state.platformCapabilities };
    case "platform.getScreenInfo":
      return { screen: host.state.screen };
    case "platform.listScreens":
      return { screens: [host.state.screen] };
    case "platform.powerGetState":
      return { state: host.state.power };
    case "platform.powerSetPreventSleep":
      return setPreventSleep(payload, host);
    case "platform.traySet":
      return setTray(payload, host);
    case "platform.trayClear":
      host.state.tray = { active: false };
      return host.emit("platform.tray.changed", host.state.tray).then(() => ({ ack: true }));
    case "platform.trayGetState":
      return { tray: host.state.tray };
    case "platform.dialogOpenFile":
      return { filePaths: null };
    case "platform.dialogSaveFile":
      return { filePath: null };
    case "platform.dialogShowMessage":
      return { response: 0 };
    case "platform.dialogShowConfirm":
      return { confirmed: true };
    case "control-plane.health":
      return {
        status: "ok",
        report: host.state.diagnostics,
      } satisfies ControlPlaneHealthResult;
    case "control-plane.check":
      return { services: {} };
    case "control-plane.metrics":
      return { metrics: host.state.metrics };
    case "control-plane.diagnose":
      return { diagnose: host.state.diagnostics };
    default:
      throw createError(
        "SERVICE_NOT_FOUND",
        `Mock Host action is not registered: ${action}`,
        { action },
        false,
      );
  }
}

interface MockOfficeSession {
  document: Record<string, unknown>;
  bytes: Uint8Array;
}

const mockOfficeSessions = new WeakMap<object, Map<string, MockOfficeSession>>();

function officeSessions(host: MockChipsHost): Map<string, MockOfficeSession> {
  const current = mockOfficeSessions.get(host);
  if (current) return current;
  const created = new Map<string, MockOfficeSession>();
  mockOfficeSessions.set(host, created);
  return created;
}

function mockOfficeBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  if (Array.isArray(value)) return Uint8Array.from(value as number[]);
  if (value && typeof value === "object" && "data" in value) {
    return mockOfficeBytes((value as { data?: unknown }).data);
  }
  return new Uint8Array();
}

function mockOfficeDescriptor(input: {
  sessionId: string;
  filePath: string;
  fileName: string;
  format: string;
  bytes: Uint8Array;
  revision?: number;
  status?: string;
}): Record<string, unknown> {
  const mimeType = input.format === "pdf"
    ? "application/pdf"
    : input.format === "pptx"
      ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      : input.format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const now = new Date().toISOString();
  return {
    sessionId: input.sessionId,
    documentId: `mock-${input.sessionId}`,
    filePath: input.filePath,
    fileName: input.fileName,
    format: input.format,
    mimeType,
    size: input.bytes.byteLength,
    revision: input.revision ?? 0,
    status: input.status ?? "clean",
    createdAt: now,
    updatedAt: now,
  };
}

function mockOfficeRequire(payload: unknown, host: MockChipsHost): MockOfficeSession {
  const sessionId = String(toRecord(payload).sessionId ?? "");
  const session = officeSessions(host).get(sessionId);
  if (!session) throw createError("SESSION_NOT_FOUND", `Mock Office session not found: ${sessionId}`);
  return session;
}

function mockOfficeCreate(payload: unknown, host: MockChipsHost): { document: Record<string, unknown> } {
  const record = toRecord(payload);
  const format = String(record.format ?? "binary");
  const sessionId = `office-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const fileName = String(record.fileName ?? `未命名文档.${format}`);
  const filePath = `/workspace/documents/${fileName}`;
  const bytes = mockOfficeBytes(record.initialBytes);
  const document = mockOfficeDescriptor({ sessionId, filePath, fileName, format, bytes });
  officeSessions(host).set(sessionId, { document, bytes });
  return { document };
}

function mockOfficeOpen(payload: unknown, host: MockChipsHost): { document: Record<string, unknown> } {
  const record = toRecord(payload);
  const filePath = String(record.filePath ?? "");
  const fileName = filePath.split(/[\\/]/).pop() || filePath;
  const format = String(record.format ?? "binary");
  const sessionId = `office-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const bytes = new Uint8Array();
  const document = mockOfficeDescriptor({ sessionId, filePath, fileName, format, bytes });
  officeSessions(host).set(sessionId, { document, bytes });
  return { document };
}

function mockOfficeRead(payload: unknown, host: MockChipsHost): { document: Record<string, unknown>; bytes: Uint8Array } {
  const session = mockOfficeRequire(payload, host);
  return { document: { ...session.document }, bytes: Uint8Array.from(session.bytes) };
}

function mockOfficeWrite(payload: unknown, host: MockChipsHost): { document: Record<string, unknown> } {
  const session = mockOfficeRequire(payload, host);
  session.bytes = mockOfficeBytes(toRecord(payload).bytes);
  session.document = { ...session.document, size: session.bytes.byteLength, revision: Number(session.document.revision ?? 0) + 1, status: "dirty", updatedAt: new Date().toISOString() };
  return { document: { ...session.document } };
}

function mockOfficeGet(payload: unknown, host: MockChipsHost): { document: Record<string, unknown> } {
  const session = mockOfficeRequire(payload, host);
  return { document: { ...session.document } };
}

function mockOfficePersist(payload: unknown, host: MockChipsHost): { document: Record<string, unknown> } {
  const session = mockOfficeRequire(payload, host);
  const filePath = String(toRecord(payload).filePath ?? session.document.filePath ?? "");
  const fileName = filePath.split(/[\\/]/).pop() || session.document.fileName;
  session.document = { ...session.document, filePath, fileName, status: "clean", updatedAt: new Date().toISOString() };
  return { document: { ...session.document } };
}

function mockOfficeClose(payload: unknown, host: MockChipsHost): { ack: true } {
  const sessionId = String(toRecord(payload).sessionId ?? "");
  officeSessions(host).delete(sessionId);
  return { ack: true };
}

function applyTheme(payload: unknown, host: MockChipsHost): Promise<{ ack: true }> {
  const record = toRecord(payload);
  const nextThemeId = typeof record.id === "string" ? record.id : undefined;
  if (!nextThemeId) {
    throw createError("INVALID_ARGUMENT", "theme.apply: id is required.");
  }

  const previousThemeId = host.state.theme.themeId;
  const meta = host.state.themes.find((item) => item.id === nextThemeId);
  host.state.theme = {
    themeId: nextThemeId,
    displayName: meta?.displayName ?? nextThemeId,
    version: meta?.version ?? host.state.theme.version,
    parentTheme: meta?.parentTheme,
  };
  host.state.themeContract = {
    ...host.state.themeContract,
    themeId: host.state.theme.themeId,
    themeVersion: host.state.theme.version,
  };
  const payloadOut: ThemeChangedPayload = {
    previousThemeId,
    themeId: host.state.theme.themeId,
    themeVersion: host.state.theme.version,
    timestamp: Date.now(),
    diagnosticsSummary: createMockThemeDiagnosticSummary(),
  };
  return host.emit("theme.changed", payloadOut).then(() => ({ ack: true }));
}

function normalizeThemeChain(payload: unknown, host: MockChipsHost) {
  const record = toRecord(payload);
  const chain = Array.isArray(record.chain) ? record.chain : [host.state.theme.themeId];
  return chain
    .filter((id): id is string => typeof id === "string" && id.length > 0)
    .map((id, index) => {
      const meta = host.state.themes.find((item) => item.id === id);
      return {
        id,
        displayName: meta?.displayName ?? id,
        version: meta?.version ?? host.state.theme.version,
        order: index,
      };
    });
}

function setLocale(payload: unknown, host: MockChipsHost): Promise<{ ack: true }> {
  const record = toRecord(payload);
  const locale = typeof record.locale === "string" ? record.locale : undefined;
  if (!locale) {
    throw createError("INVALID_ARGUMENT", "i18n.setCurrent: locale is required.");
  }
  host.state.locale = locale;
  if (!host.state.locales.includes(locale)) {
    host.state.locales = [...host.state.locales, locale];
  }
  const event: LanguageChangedPayload = { locale };
  return host.emit("language.changed", event).then(() => ({ ack: true }));
}

function translate(payload: unknown, host: MockChipsHost): string {
  const record = toRecord(payload);
  const key = typeof record.key === "string" ? record.key : "";
  const translations = host.state.translations;
  const localeMap = translations[host.state.locale as keyof typeof translations];
  if (localeMap && typeof localeMap === "object") {
    const text = (localeMap as Record<string, string>)[key];
    if (typeof text === "string") return text;
  }
  const flatText = (translations as Record<string, string>)[key];
  return typeof flatText === "string" ? flatText : key;
}

function openSurface(
  payload: unknown,
  host: MockChipsHost,
  nextSurfaceId: () => string,
): { surface: SurfaceState } {
  const record = toRecord(payload);
  const request = toRecord(record.request) as unknown as Partial<SurfaceOpenRequest>;
  const kind = isSurfaceKind(request.kind) ? request.kind : "window";
  const surfaceId = nextSurfaceId();
  const context = request.context ?? createMockSurfaceContext({
    surfaceId,
    kind,
    pluginId: request.target?.type === "plugin" ? request.target.pluginId : undefined,
    presentation: request.presentation,
    launchParams: request.target?.type === "plugin" ? request.target.launchParams : undefined,
  });
  const surface: SurfaceState = {
    id: surfaceId,
    kind,
    title: request.presentation?.title ?? context.presentation.title,
    width: request.presentation?.width ?? context.presentation.width,
    height: request.presentation?.height ?? context.presentation.height,
    focused: true,
    state: "normal",
    url: request.target?.type === "url" ? request.target.url : request.target?.url,
    pluginId: request.target?.type === "plugin" ? request.target.pluginId : context.pluginId,
    sessionId: request.target?.type === "plugin" ? request.target.sessionId : context.sessionId,
    chrome: request.presentation?.chrome ?? context.presentation.chrome,
    context,
  };
  host.state.surfaces = [...host.state.surfaces, surface];
  return { surface };
}

function updateSurface(
  payload: unknown,
  host: MockChipsHost,
  update: (surface: SurfaceState, payload: Record<string, unknown>) => SurfaceState,
): { ack: true } {
  const record = toRecord(payload);
  const surface = requireSurface(record, host);
  const next = update(surface, record);
  host.state.surfaces = host.state.surfaces.map((item) => (item.id === surface.id ? next : item));
  return { ack: true };
}

function requireSurface(payload: unknown, host: MockChipsHost): SurfaceState {
  const record = toRecord(payload);
  const surfaceId = typeof record.surfaceId === "string" ? record.surfaceId : undefined;
  const surface = host.state.surfaces.find((item) => item.id === surfaceId);
  if (!surface) {
    throw createError("SURFACE_NOT_FOUND", `Surface not found: ${surfaceId ?? "<missing>"}`, {
      surfaceId,
    });
  }
  return surface;
}

function closeSurface(payload: unknown, host: MockChipsHost): { ack: true } {
  const surface = requireSurface(payload, host);
  host.state.surfaces = host.state.surfaces.filter((item) => item.id !== surface.id);
  return { ack: true };
}

function registerCommand(payload: unknown, host: MockChipsHost): Promise<{ command: CommandView }> {
  const command = toCommandView(payload);
  host.state.commands = [
    ...host.state.commands.filter((item) => item.commandId !== command.commandId),
    command,
  ];
  const registered: CommandRegisteredEvent = {
    commandId: command.commandId,
    command,
    registeredAt: command.registeredAt,
  };
  const changed: CommandChangedEvent = {
    commandId: command.commandId,
    command,
    change: "registered",
  };
  return host.emit("command.registered", registered)
    .then(() => host.emit("command.changed", changed))
    .then(() => ({ command }));
}

function unregisterCommand(payload: unknown, host: MockChipsHost): Promise<{ ack: true }> {
  const record = toRecord(payload);
  const commandId = typeof record.commandId === "string" ? record.commandId : "";
  host.state.commands = host.state.commands.filter((command) => command.commandId !== commandId);
  const unregistered: CommandUnregisteredEvent = { commandId, reason: "unregistered" };
  const changed: CommandChangedEvent = { commandId, change: "unregistered" };
  return host.emit("command.unregistered", unregistered)
    .then(() => host.emit("command.changed", changed))
    .then(() => ({ ack: true }));
}

function getCommand(payload: unknown, host: MockChipsHost): CommandView | undefined {
  const record = toRecord(payload);
  const commandId = typeof record.commandId === "string" ? record.commandId : undefined;
  return host.state.commands.find((command) => command.commandId === commandId);
}

function listCommands(payload: unknown, host: MockChipsHost): CommandView[] {
  const query = toRecord(payload) as CommandQueryOptions;
  return host.state.commands.filter((command) => {
    if (query.ownerPluginId && command.ownerPluginId !== query.ownerPluginId) return false;
    if (!query.includeDisabled && command.diagnostic.enabled === false) return false;
    if (!query.includeHidden && command.diagnostic.visible === false) return false;
    return true;
  });
}

function invokeCommand(
  payload: unknown,
  host: MockChipsHost,
  nextInvocationId: () => string,
): Promise<CommandInvokeResult> {
  const record = toRecord(payload);
  const commandId = typeof record.commandId === "string" ? record.commandId : "";
  const command = host.state.commands.find((item) => item.commandId === commandId);
  if (!command) {
    throw createError("COMMAND_NOT_FOUND", `Command not found: ${commandId}`, { commandId });
  }
  const invocationId = nextInvocationId();
  const result: CommandInvokeResult = {
    commandId,
    invocationId,
    dispatched: true,
    command,
  };
  const event: CommandInvokedEvent = {
    commandId,
    invocationId,
    source: isCommandSource(record.source) ? record.source : undefined,
    payload: isRecord(record.payload) ? record.payload : {},
    command,
    handlerId: command.handlerId,
    ownerPluginId: command.ownerPluginId,
    ownerSessionId: command.ownerSessionId,
    context: isRecord(record.context) ? record.context : undefined,
    result,
  };
  return host.emit("command.invoked", event).then(() => result);
}

function setCommandState(payload: unknown, host: MockChipsHost): Promise<{ command?: CommandView }> {
  const record = toRecord(payload);
  const commandId = typeof record.commandId === "string" ? record.commandId : "";
  const command = host.state.commands.find((item) => item.commandId === commandId);
  if (!command) {
    return Promise.resolve({});
  }
  const state = isRecord(record.state) ? (record.state as CommandState) : {};
  const options = isRecord(record.options) ? (record.options as CommandSetStateOptions) : undefined;
  const next: CommandView = {
    ...command,
    state: {
      ...command.state,
      ...state,
    },
    diagnostic: {
      visible: state.visible ?? command.diagnostic.visible,
      enabled: state.enabled ?? command.diagnostic.enabled,
      checked: state.checked ?? command.diagnostic.checked,
      hiddenReasonKey: state.hiddenReasonKey ?? command.diagnostic.hiddenReasonKey,
      disabledReasonKey: state.disabledReasonKey ?? command.diagnostic.disabledReasonKey,
    },
    updatedAt: Date.now(),
  };
  host.state.commands = host.state.commands.map((item) => (item.commandId === commandId ? next : item));
  const changed: CommandChangedEvent = {
    commandId,
    command: next,
    state,
    change: "state",
    source: options?.context?.source as CommandSource | undefined,
  };
  return host.emit("command.changed", changed).then(() => ({ command: next }));
}

function createCliTask(
  payload: unknown,
  host: MockChipsHost,
  nextCliTaskId: () => string,
): Promise<{ task: CliTaskRecord }> {
  const record = toRecord(payload);
  const pluginId = typeof record.pluginId === "string" ? record.pluginId : "";
  const commandId = typeof record.commandId === "string" ? record.commandId : "";
  if (!pluginId || !commandId) {
    throw createError("INVALID_ARGUMENT", "cli.task.create: pluginId and commandId are required.");
  }
  const now = Date.now();
  const task: CliTaskRecord = {
    taskId: nextCliTaskId(),
    pluginId,
    commandId,
    commandPath: Array.isArray(record.commandPath)
      ? record.commandPath.filter((item): item is string => typeof item === "string")
      : undefined,
    surfaceId: typeof record.surfaceId === "string" ? record.surfaceId : undefined,
    sessionId: typeof record.sessionId === "string" ? record.sessionId : undefined,
    status: "running",
    createdAt: now,
    updatedAt: now,
  };
  host.state.cliTasks = [...host.state.cliTasks, task];
  return host.emit("cli.task.created", task).then(() => ({ task }));
}

function bindCliTaskInvocation(payload: unknown, host: MockChipsHost): Promise<{ task: CliTaskRecord }> {
  const record = toRecord(payload);
  const task = requireCliTask(record, host);
  const next: CliTaskRecord = {
    ...task,
    invocationId: typeof record.invocationId === "string" ? record.invocationId : task.invocationId,
    surfaceId: typeof record.surfaceId === "string" ? record.surfaceId : task.surfaceId,
    sessionId: typeof record.sessionId === "string" ? record.sessionId : task.sessionId,
    updatedAt: Date.now(),
  };
  replaceCliTask(host, next);
  return host.emit("cli.task.changed", next).then(() => ({ task: next }));
}

function requireCliTask(payload: unknown, host: MockChipsHost): CliTaskRecord {
  const record = toRecord(payload);
  const taskId = typeof record.taskId === "string" ? record.taskId : "";
  const task = host.state.cliTasks.find((item) => item.taskId === taskId);
  if (!task) {
    throw createError("CLI_TASK_NOT_FOUND", `CLI task not found: ${taskId || "<missing>"}`, { taskId });
  }
  return task;
}

function updateCliTaskProgress(payload: unknown, host: MockChipsHost): Promise<{ task: CliTaskRecord }> {
  const record = toRecord(payload);
  const task = requireCliTask(record, host);
  const next: CliTaskRecord = {
    ...task,
    progress: isRecord(record.progress) ? record.progress : {},
    updatedAt: Date.now(),
  };
  replaceCliTask(host, next);
  return host.emit("cli.task.progress", next).then(() => ({ task: next }));
}

function completeCliTask(payload: unknown, host: MockChipsHost): Promise<{ task: CliTaskRecord }> {
  const record = toRecord(payload);
  const task = requireCliTask(record, host);
  const next: CliTaskRecord = {
    ...task,
    status: "completed",
    output: record.output,
    updatedAt: Date.now(),
  };
  replaceCliTask(host, next);
  return host.emit("cli.task.completed", next).then(() => ({ task: next }));
}

function failCliTask(payload: unknown, host: MockChipsHost): Promise<{ task: CliTaskRecord }> {
  const record = toRecord(payload);
  const task = requireCliTask(record, host);
  const next: CliTaskRecord = {
    ...task,
    status: "failed",
    error: normalizeStandardError(record.error, "CLI task failed.", "CLI_TASK_FAILED"),
    updatedAt: Date.now(),
  };
  replaceCliTask(host, next);
  return host.emit("cli.task.failed", next).then(() => ({ task: next }));
}

function cancelCliTask(payload: unknown, host: MockChipsHost): Promise<{ task: CliTaskRecord }> {
  const task = requireCliTask(payload, host);
  const next: CliTaskRecord = {
    ...task,
    status: "cancelled",
    updatedAt: Date.now(),
  };
  replaceCliTask(host, next);
  return host.emit("cli.task.cancelled", next).then(() => ({ task: next }));
}

function replaceCliTask(host: MockChipsHost, task: CliTaskRecord): void {
  host.state.cliTasks = host.state.cliTasks.map((item) => (item.taskId === task.taskId ? task : item));
}

function setPreventSleep(payload: unknown, host: MockChipsHost): { preventSleep: boolean } {
  const record = toRecord(payload);
  host.state.power = {
    ...host.state.power,
    preventSleep: record.prevent === true,
  };
  return { preventSleep: host.state.power.preventSleep };
}

function setTray(payload: unknown, host: MockChipsHost): Promise<{ tray: PlatformTrayState }> {
  const record = toRecord(payload);
  const options = isRecord(record.options) ? record.options : {};
  host.state.tray = {
    ...options,
    active: true,
  };
  return host.emit("platform.tray.changed", host.state.tray).then(() => ({ tray: host.state.tray }));
}

function toCommandView(payload: unknown): CommandView {
  const definition = toRecord(payload) as unknown as CommandDefinitionInput;
  const now = Date.now();
  return {
    ...definition,
    diagnostic: {
      visible: true,
      enabled: true,
      checked: false,
    },
    registeredAt: now,
    updatedAt: now,
  };
}

function isSurfaceKind(value: unknown): value is SurfaceKind {
  return ["window", "tab", "route", "modal", "sheet", "fullscreen"].includes(String(value));
}

function isSurfaceState(value: unknown): value is SurfaceStateKind {
  return ["normal", "minimized", "maximized", "fullscreen", "hidden"].includes(String(value));
}

function isCommandSource(value: unknown): value is CommandSource {
  return ["menu", "toolbar", "shortcut", "palette", "context-menu", "api", "cli"].includes(String(value));
}

function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
