import type { FastifyPluginAsync } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { hostIntegration, type WebPluginSessionView, type WebResourceOpenRequest, type WebThemeRuntimeView } from '../services/host-integration.js';

function injectPluginRuntime(html: string, sessionId: string): string {
  const baseTag = `<base href="/api/v1/host/plugin-sessions/${encodeURIComponent(sessionId)}/">`;
  const themeTag = `<link rel="stylesheet" href="/api/v1/host/plugin-sessions/${encodeURIComponent(sessionId)}/theme.css">`;
  const scriptTag = `<script src="/api/v1/host/plugin-sessions/${encodeURIComponent(sessionId)}/bootstrap.js"></script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${baseTag}\n    ${themeTag}\n    ${scriptTag}`);
  }

  return `${baseTag}\n${themeTag}\n${scriptTag}\n${html}`;
}

function resolveContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.avif':
      return 'image/avif';
    case '.ico':
      return 'image/x-icon';
    case '.woff':
      return 'font/woff';
    case '.woff2':
      return 'font/woff2';
    case '.ttf':
      return 'font/ttf';
    case '.otf':
      return 'font/otf';
    default:
      return 'application/octet-stream';
  }
}

const CPX_LENGTH_PATTERN = /(-?(?:\d+\.?\d*|\.\d+))cpx\b/g;

function formatCssNumber(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) < 0.000000005) {
    return '0';
  }

  return value.toFixed(8).replace(/\.?0+$/, '');
}

function convertCpxToViewportLength(value: string, baseWidth = 1024): string {
  return value.replace(CPX_LENGTH_PATTERN, (match, numeric: string) => {
    const cpxValue = Number(numeric);
    if (!Number.isFinite(cpxValue)) {
      return match;
    }
    return `${formatCssNumber(cpxValue * (100 / baseWidth))}vw`;
  });
}

function normalizeThemeCssForBrowser(cssText: string): string {
  let result = '';
  let segmentStart = 0;
  let index = 0;

  const readQuotedRange = (startIndex: number): number => {
    const quote = cssText[startIndex];
    let cursor = startIndex + 1;
    while (cursor < cssText.length) {
      const char = cssText[cursor];
      if (char === '\\') {
        cursor += 2;
        continue;
      }
      cursor += 1;
      if (char === quote) {
        break;
      }
    }
    return cursor;
  };

  const readCommentRange = (startIndex: number): number => {
    const endIndex = cssText.indexOf('*/', startIndex + 2);
    return endIndex >= 0 ? endIndex + 2 : cssText.length;
  };

  const readUrlRange = (startIndex: number): number => {
    let cursor = startIndex + 4;
    while (cursor < cssText.length) {
      const char = cssText[cursor];
      if (char === '"' || char === "'") {
        cursor = readQuotedRange(cursor);
        continue;
      }
      if (char === '\\') {
        cursor += 2;
        continue;
      }
      cursor += 1;
      if (char === ')') {
        break;
      }
    }
    return cursor;
  };

  while (index < cssText.length) {
    const char = cssText[index];
    let protectedEnd: number | null = null;

    if (char === '"' || char === "'") {
      protectedEnd = readQuotedRange(index);
    } else if (char === '/' && cssText[index + 1] === '*') {
      protectedEnd = readCommentRange(index);
    } else if (cssText.slice(index, index + 4).toLowerCase() === 'url(') {
      protectedEnd = readUrlRange(index);
    }

    if (protectedEnd !== null) {
      result += convertCpxToViewportLength(cssText.slice(segmentStart, index));
      result += cssText.slice(index, protectedEnd);
      index = protectedEnd;
      segmentStart = index;
      continue;
    }

    index += 1;
  }

  result += convertCpxToViewportLength(cssText.slice(segmentStart));
  return result;
}

function normalizeThemeTokenValueForBrowser(value: unknown): unknown {
  return typeof value === 'string' ? convertCpxToViewportLength(value) : value;
}

function normalizeThemeRuntimeForBrowser(themeRuntime: WebThemeRuntimeView): WebThemeRuntimeView {
  return {
    ...themeRuntime,
    css: normalizeThemeCssForBrowser(themeRuntime.css),
    tokens: Object.fromEntries(
      Object.entries(themeRuntime.tokens).map(([key, value]) => [key, normalizeThemeTokenValueForBrowser(value)]),
    ),
  };
}

function createThemeStylesheet(inputThemeRuntime: WebThemeRuntimeView): string {
  const themeRuntime = normalizeThemeRuntimeForBrowser(inputThemeRuntime);
  const variables = Object.entries(themeRuntime.tokens)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => `  --${key.replaceAll('.', '-')}: ${String(value)};`);
  const rootBlock = [
    ':root {',
    `  color-scheme: light;`,
    ...variables,
    '}',
  ].join('\n');

  return [rootBlock, themeRuntime.css].filter((block) => block.trim().length > 0).join('\n\n');
}

function createBootstrapScript(session: WebPluginSessionView, inputThemeRuntime: WebThemeRuntimeView): string {
  const launchContext = {
    pluginId: session.pluginId,
    sessionId: session.sessionId,
    launchParams: session.launchParams,
  };
  const themeRuntime = normalizeThemeRuntimeForBrowser(inputThemeRuntime);

  return `
(function () {
  const sessionId = ${JSON.stringify(session.sessionId)};
  const launchContext = ${JSON.stringify(launchContext)};
  const themeRuntime = ${JSON.stringify(themeRuntime)};
  const themeSnapshot = {
    themeId: themeRuntime.themeId,
    displayName: themeRuntime.displayName,
    version: themeRuntime.version,
    ...(themeRuntime.parentTheme ? { parentTheme: themeRuntime.parentTheme } : {}),
  };
  const locale = "zh-CN";
  const pending = new Map();
  const listeners = new Map();
  const localFiles = new Map();
  const localObjectUrls = new Map();
  const commands = new Map();
  let requestCounter = 0;
  let commandInvocationCounter = 0;

  function createRequestId() {
    requestCounter += 1;
    return sessionId + ":" + String(requestCounter);
  }

  function emit(eventName, payload) {
    const handlers = listeners.get(eventName);
    if (!handlers) {
      return;
    }
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (error) {
        console.error("[chips-web-shell] event handler failed", error);
      }
    }
  }

  function on(eventName, handler) {
    const handlers = listeners.get(eventName) || new Set();
    handlers.add(handler);
    listeners.set(eventName, handlers);
    return function unsubscribe() {
      const current = listeners.get(eventName);
      if (!current) {
        return;
      }
      current.delete(handler);
      if (current.size === 0) {
        listeners.delete(eventName);
      }
    };
  }

  function once(eventName, handler) {
    const unsubscribe = on(eventName, function wrapped(payload) {
      unsubscribe();
      handler(payload);
    });
  }

  function readRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  }

  function cloneRecord(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function syncThemeToDocument() {
    document.documentElement.setAttribute("data-chips-theme-id", themeRuntime.themeId);
    document.documentElement.setAttribute("data-chips-theme-version", themeRuntime.version);
  }

  function createCommandDiagnostic(state) {
    return {
      visible: state && state.visible === false ? false : true,
      enabled: state && state.enabled === false ? false : true,
      checked: Boolean(state && state.checked === true),
      ...(state && typeof state.hiddenReasonKey === "string" ? { hiddenReasonKey: state.hiddenReasonKey } : {}),
      ...(state && typeof state.disabledReasonKey === "string" ? { disabledReasonKey: state.disabledReasonKey } : {}),
    };
  }

  function toCommandView(definition, state) {
    const commandState = cloneRecord(state || definition.state || {});
    const timestamp = Date.now();
    return {
      ...cloneRecord(definition),
      state: commandState,
      ownerPluginId: launchContext.pluginId,
      ownerSessionId: sessionId,
      registeredAt: definition.registeredAt || timestamp,
      updatedAt: timestamp,
      diagnostic: createCommandDiagnostic(commandState),
    };
  }

  function getCommand(commandId) {
    const normalized = typeof commandId === "string" ? commandId.trim() : "";
    if (!normalized) {
      throw new Error("commandId is required");
    }
    return commands.get(normalized);
  }

  function emitCommandEvent(eventName, payload) {
    emit(eventName, payload);
  }

  function registerCommand(payload) {
    const definition = readRecord(payload);
    const commandId = typeof definition?.commandId === "string" ? definition.commandId.trim() : "";
    if (!definition || !commandId) {
      throw new Error("command.register: commandId is required");
    }
    const command = toCommandView({
      ...definition,
      commandId,
      registeredAt: Date.now(),
    });
    commands.set(commandId, command);
    emitCommandEvent("command.registered", {
      commandId,
      command,
      ownerPluginId: launchContext.pluginId,
      ownerSessionId: sessionId,
      registeredAt: command.registeredAt,
    });
    emitCommandEvent("command.changed", {
      commandId,
      command,
      change: "registered",
      ownerPluginId: launchContext.pluginId,
      ownerSessionId: sessionId,
      source: "api",
    });
    return { command };
  }

  function unregisterCommand(payload) {
    const commandId = typeof payload?.commandId === "string" ? payload.commandId.trim() : "";
    if (!commandId) {
      throw new Error("command.unregister: commandId is required");
    }
    commands.delete(commandId);
    emitCommandEvent("command.unregistered", {
      commandId,
      ownerPluginId: launchContext.pluginId,
      ownerSessionId: sessionId,
      reason: "api",
    });
    emitCommandEvent("command.changed", {
      commandId,
      change: "unregistered",
      ownerPluginId: launchContext.pluginId,
      ownerSessionId: sessionId,
      source: "api",
    });
    return { ack: true };
  }

  function setCommandState(payload) {
    const commandId = typeof payload?.commandId === "string" ? payload.commandId.trim() : "";
    if (!commandId) {
      throw new Error("command.setState: commandId is required");
    }
    const current = getCommand(commandId);
    if (!current) {
      return { command: undefined };
    }
    const nextState = {
      ...(readRecord(current.state) || {}),
      ...(readRecord(payload.state) || {}),
    };
    const command = toCommandView(current, nextState);
    commands.set(commandId, command);
    emitCommandEvent("command.changed", {
      commandId,
      command,
      state: nextState,
      change: "state",
      ownerPluginId: launchContext.pluginId,
      ownerSessionId: sessionId,
      source: "api",
    });
    return { command };
  }

  function invokeCommand(payload) {
    const commandId = typeof payload?.commandId === "string" ? payload.commandId.trim() : "";
    if (!commandId) {
      throw new Error("command.invoke: commandId is required");
    }
    const command = getCommand(commandId);
    if (!command) {
      throw new Error("command.invoke: command not found");
    }
    commandInvocationCounter += 1;
    const event = {
      commandId,
      invocationId: sessionId + ":command:" + String(commandInvocationCounter),
      source: typeof payload.source === "string" ? payload.source : "api",
      payload: readRecord(payload.payload) || {},
      command,
      handlerId: command.handlerId,
      ownerPluginId: launchContext.pluginId,
      ownerSessionId: sessionId,
      context: readRecord(payload.context) || undefined,
    };
    emitCommandEvent("command.invoked", event);
    return {
      commandId,
      invocationId: event.invocationId,
      dispatched: true,
      command,
    };
  }

  function postToParent(message) {
    if (!window.parent || window.parent === window) {
      throw new Error("chips web shell parent window is missing");
    }
    window.parent.postMessage(message, window.location.origin);
  }

  function sanitizeFileName(fileName) {
    return String(fileName || "file").replace(/[^a-zA-Z0-9._-]+/g, "-");
  }

  function storeLocalFile(file) {
    const token = "chips-web-file://" + crypto.randomUUID() + "/" + sanitizeFileName(file && file.name ? file.name : "file");
    localFiles.set(token, file);
    return token;
  }

  async function openBrowserFileDialog() {
    return await new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,.card,.box";
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.addEventListener("change", () => {
        const files = Array.from(input.files || []);
        input.remove();
        resolve(files.map((file) => storeLocalFile(file)));
      }, { once: true });
      input.click();
    });
  }

  function resolveLocalResourceUri(resourceId) {
    if (resourceId.startsWith("http://") || resourceId.startsWith("https://") || resourceId.startsWith("data:") || resourceId.startsWith("blob:")) {
      return resourceId;
    }
    if (resourceId.startsWith("/")) {
      return new URL(resourceId, window.location.origin).toString();
    }
    if (!resourceId.startsWith("chips-web-file://")) {
      return null;
    }

    const file = localFiles.get(resourceId);
    if (!file) {
      throw new Error("local file handle not found");
    }

    const existingUrl = localObjectUrls.get(resourceId);
    if (existingUrl) {
      return existingUrl;
    }

    const objectUrl = URL.createObjectURL(file);
    localObjectUrls.set(resourceId, objectUrl);
    return objectUrl;
  }

  function readLocalFile(resourceId) {
    if (!resourceId.startsWith("chips-web-file://")) {
      return null;
    }

    const file = localFiles.get(resourceId);
    if (!file) {
      throw new Error("local file handle not found");
    }
    return file;
  }

  function arrayBufferToBinaryPayload(buffer) {
    return { data: Array.from(new Uint8Array(buffer)) };
  }

  async function readResourceBinaryPayload(resourceId) {
    const normalizedResourceId = typeof resourceId === "string" ? resourceId.trim() : "";
    if (!normalizedResourceId) {
      throw new Error("resourceId is required");
    }

    const file = readLocalFile(normalizedResourceId);
    if (file) {
      return arrayBufferToBinaryPayload(await file.arrayBuffer());
    }

    const uri = resolveLocalResourceUri(normalizedResourceId);
    if (!uri) {
      throw new Error("unsupported web resource id");
    }

    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error("resource fetch failed: " + String(response.status));
    }
    return arrayBufferToBinaryPayload(await response.arrayBuffer());
  }

  async function readResourceMetadataPayload(resourceId) {
    const normalizedResourceId = typeof resourceId === "string" ? resourceId.trim() : "";
    if (!normalizedResourceId) {
      throw new Error("resourceId is required");
    }

    const file = readLocalFile(normalizedResourceId);
    if (file) {
      return {
        metadata: {
          path: normalizedResourceId,
          fileName: file.name || undefined,
          mimeType: file.type || undefined,
          size: typeof file.size === "number" ? file.size : undefined,
          isFile: true,
          isDirectory: false,
          mtimeMs: typeof file.lastModified === "number" ? file.lastModified : undefined,
        },
      };
    }

    const uri = resolveLocalResourceUri(normalizedResourceId);
    if (!uri) {
      throw new Error("unsupported web resource id");
    }

    const response = await fetch(uri, { method: "HEAD" });
    if (!response.ok) {
      throw new Error("resource metadata fetch failed: " + String(response.status));
    }
    const sizeText = response.headers.get("content-length");
    const size = sizeText ? Number(sizeText) : undefined;
    return {
      metadata: {
        path: normalizedResourceId,
        mimeType: response.headers.get("content-type") || undefined,
        size: Number.isFinite(size) ? size : undefined,
        isFile: true,
        isDirectory: false,
      },
    };
  }

  async function handleLocalInvoke(action, payload) {
    if (action === "platform.getInfo") {
      return {
        info: {
          hostKind: "web",
          platform: "web",
          arch: "browser",
          release: "web",
        },
      };
    }

    if (action === "platform.getCapabilities") {
      return {
        capabilities: {
          hostKind: "web",
          platform: "web",
          facets: {
            surface: { supported: true, interactive: true, supportedKinds: ["route", "tab", "modal"] },
            storage: { localWorkspace: false, sandboxFilePicker: true, remoteBacked: true },
            selection: { openFile: true, saveFile: false, directory: false, multiple: true },
            transfer: { upload: true, download: true, share: true, externalOpen: true, revealInShell: false },
            association: { fileAssociation: false, urlScheme: false, shareTarget: true },
            device: { screen: true, power: false, network: true },
            systemUi: { clipboard: true, tray: false, globalShortcut: false, notification: true },
            background: { keepAlive: false, wakeEvents: false },
            ipc: { namedPipe: false, unixSocket: false, sharedMemory: false },
            offscreenRender: { htmlToPdf: false, htmlToImage: false },
          },
        },
      };
    }

    if (action === "theme.getCurrent") {
      return themeSnapshot;
    }

    if (action === "theme.getAllCss") {
      return {
        css: themeRuntime.css || "",
        themeId: themeRuntime.themeId,
      };
    }

    if (action === "theme.resolve") {
      return {
        resolved: Array.isArray(themeRuntime.resolved) ? themeRuntime.resolved : [],
        tokens: themeRuntime.tokens || {},
        diagnostics: Array.isArray(themeRuntime.diagnostics) ? themeRuntime.diagnostics : [],
        summary: themeRuntime.summary,
      };
    }

    if (action === "i18n.getCurrent") {
      return { locale };
    }

    if (action === "resource.resolve") {
      const resourceId = payload && typeof payload === "object" ? payload.resourceId : undefined;
      if (typeof resourceId !== "string" || resourceId.trim().length === 0) {
        throw new Error("resourceId is required");
      }
      const uri = resolveLocalResourceUri(resourceId.trim());
      if (!uri) {
        throw new Error("unsupported web resource id");
      }
      return { uri };
    }

    if (action === "resource.readBinary") {
      const resourceId = payload && typeof payload === "object" ? payload.resourceId : undefined;
      return await readResourceBinaryPayload(resourceId);
    }

    if (action === "resource.readMetadata") {
      const resourceId = payload && typeof payload === "object" ? payload.resourceId : undefined;
      return await readResourceMetadataPayload(resourceId);
    }

    if (action === "command.register") {
      return registerCommand(payload);
    }

    if (action === "command.unregister") {
      return unregisterCommand(payload || {});
    }

    if (action === "command.get") {
      const command = getCommand(payload && payload.commandId);
      return { command };
    }

    if (action === "command.list") {
      return { commands: Array.from(commands.values()) };
    }

    if (action === "command.invoke") {
      return invokeCommand(payload || {});
    }

    if (action === "command.setState") {
      return setCommandState(payload || {});
    }

    if (action === "platform.dialogOpenFile") {
      const filePaths = await openBrowserFileDialog();
      return { filePaths };
    }

    if (action === "platform.dialogSaveFile") {
      return { filePath: null };
    }

    if (action === "platform.dialogShowMessage") {
      const message = payload && typeof payload === "object" && payload.options && typeof payload.options === "object"
        ? payload.options.message
        : "";
      window.alert(typeof message === "string" ? message : "");
      return { response: 0 };
    }

    if (action === "platform.dialogShowConfirm") {
      const message = payload && typeof payload === "object" && payload.options && typeof payload.options === "object"
        ? payload.options.message
        : "";
      return { confirmed: window.confirm(typeof message === "string" ? message : "") };
    }

    if (action === "platform.notificationShow") {
      return { ack: true };
    }

    return null;
  }

  async function invokeRemote(action, payload) {
    const requestId = createRequestId();
    return await new Promise((resolve, reject) => {
      pending.set(requestId, { resolve, reject });
      postToParent({
        type: "chips.web-shell:invoke",
        sessionId,
        requestId,
        action,
        payload,
      });
    });
  }

  async function invoke(action, payload) {
    const local = await handleLocalInvoke(action, payload);
    if (local !== null) {
      return local;
    }
    return await invokeRemote(action, payload);
  }

  async function emitToHost(eventName, payload) {
    postToParent({
      type: "chips.web-shell:emit",
      sessionId,
      event: eventName,
      payload,
    });
  }

  window.addEventListener("message", function handleMessage(event) {
    if (event.origin !== window.location.origin) {
      return;
    }

    const data = event.data;
    if (!data || typeof data !== "object" || data.sessionId !== sessionId) {
      return;
    }

    if (data.type === "chips.web-shell:result") {
      const pendingRequest = pending.get(data.requestId);
      if (!pendingRequest) {
        return;
      }
      pending.delete(data.requestId);
      if (data.error) {
        const error = new Error(data.error.message || "Bridge invoke failed");
        if (data.error && typeof data.error === "object") {
          Object.assign(error, data.error);
        }
        pendingRequest.reject(error);
        return;
      }
      pendingRequest.resolve(data.result);
      return;
    }

    if (data.type === "chips.web-shell:event") {
      emit(data.event, data.payload);
    }
  });

  document.documentElement.lang = locale;
  syncThemeToDocument();

  window.chips = {
    invoke,
    on,
    once,
    emit: emitToHost,
    window: {},
    surface: {},
    transfer: {},
    association: {},
    platform: {
      getLaunchContext: function () {
        return launchContext;
      },
      getPathForFile: function (file) {
        if (!(file instanceof File)) {
          return "";
        }
        return storeLocalFile(file);
      },
    },
  };
})();
`.trimStart();
}

const hostRuntimeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/host/plugin-sessions',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const body = request.body as { pluginId?: unknown; launchParams?: unknown };
      const pluginId = typeof body?.pluginId === 'string' ? body.pluginId.trim() : '';
      if (!pluginId) {
        throw new Error('pluginId is required');
      }

      const session = await hostIntegration.openWebPluginSession({
        pluginId,
        launchParams: body?.launchParams && typeof body.launchParams === 'object' && !Array.isArray(body.launchParams)
          ? body.launchParams as Record<string, unknown>
          : {},
      });

      return { data: session };
    },
  );

  fastify.get(
    '/api/v1/host/plugin-sessions/:sessionId',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const { sessionId } = request.params as { sessionId: string };
      return { data: hostIntegration.getWebPluginSession(sessionId) };
    },
  );

  fastify.delete(
    '/api/v1/host/plugin-sessions/:sessionId',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      hostIntegration.closeWebPluginSession(sessionId);
      return reply.status(204).send();
    },
  );

  fastify.post(
    '/api/v1/host/resource-open-plan',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request) => {
      const body = request.body as WebResourceOpenRequest;
      const plan = await hostIntegration.resolveWebResourceOpenPlan(body);
      return { data: plan };
    },
  );

  fastify.get(
    '/api/v1/host/plugin-sessions/:sessionId/entry',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const entry = hostIntegration.getWebPluginEntry(sessionId);
      const html = await fs.readFile(entry.entryPath, 'utf-8');
      reply.type('text/html; charset=utf-8');
      reply.header('Cache-Control', 'no-store');
      return injectPluginRuntime(html, sessionId);
    },
  );

  fastify.get(
    '/api/v1/host/plugin-sessions/:sessionId/bootstrap.js',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = hostIntegration.getWebPluginSession(sessionId);
      const themeRuntime = await hostIntegration.getWebThemeRuntime();
      reply.type('application/javascript; charset=utf-8');
      reply.header('Cache-Control', 'no-store');
      return createBootstrapScript(session, themeRuntime);
    },
  );

  fastify.get(
    '/api/v1/host/plugin-sessions/:sessionId/theme.css',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      hostIntegration.getWebPluginSession(sessionId);
      const themeRuntime = await hostIntegration.getWebThemeRuntime();
      reply.type('text/css; charset=utf-8');
      reply.header('Cache-Control', 'no-store');
      return createThemeStylesheet(themeRuntime);
    },
  );

  fastify.get(
    '/api/v1/host/theme-assets/:themeId/*',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const params = request.params as { themeId: string; '*': string };
      const assetPath = params['*'] ?? '';
      const resolvedPath = hostIntegration.resolveWebThemeAssetPath(params.themeId, assetPath);
      const file = await fs.readFile(resolvedPath);
      reply.type(resolveContentType(resolvedPath));
      reply.header('Cache-Control', 'public, max-age=300');
      return reply.send(file);
    },
  );

  fastify.get(
    '/api/v1/host/plugin-sessions/:sessionId/assets/*',
    { preHandler: [fastify.optionalAuthenticate] },
    async (request, reply) => {
      const params = request.params as { sessionId: string; '*': string };
      const assetPath = params['*'] ?? '';
      const resolvedPath = hostIntegration.resolveWebPluginAssetPath(params.sessionId, assetPath);
      const file = await fs.readFile(resolvedPath);
      reply.type(resolveContentType(resolvedPath));
      reply.header('Cache-Control', 'public, max-age=300');
      return reply.send(file);
    },
  );
};

export default hostRuntimeRoutes;
