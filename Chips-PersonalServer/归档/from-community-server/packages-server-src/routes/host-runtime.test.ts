import Fastify from 'fastify';
import { JSDOM } from 'jsdom';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const hostIntegrationMock = {
  getWebPluginSession: vi.fn(),
  getWebPluginEntry: vi.fn(),
  getWebThemeRuntime: vi.fn(),
  resolveWebThemeAssetPath: vi.fn(),
};

vi.mock('../services/host-integration', () => ({
  hostIntegration: hostIntegrationMock,
}));

async function buildHostRuntimeApp() {
  const { default: hostRuntimeRoutes } = await import('./host-runtime');
  const app = Fastify();
  app.decorate('optionalAuthenticate', async () => {});
  await app.register(hostRuntimeRoutes);
  return app;
}

describe('host runtime web bootstrap', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  function mockThemeRuntime() {
    hostIntegrationMock.getWebThemeRuntime.mockResolvedValue({
      themeId: 'chips-official.default-theme',
      displayName: '薯片官方 · 默认主题',
      version: '1.0.0',
      css: [
        '@font-face {',
        '  font-family: "Material Symbols Rounded";',
        '  src: url("/api/v1/host/theme-assets/chips-official.default-theme/dist/icons/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.woff2") format("woff2");',
        '}',
        '[data-scope="icon"][data-part="root"] { font-family: "Material Symbols Rounded"; width: 24cpx; }',
      ].join('\n'),
      tokens: {
        'chips.layout.gap.md': '12cpx',
        'chips.sys.icon.wght': 400,
      },
      resolved: [
        {
          id: 'chips-official.default-theme',
          displayName: '薯片官方 · 默认主题',
          version: '1.0.0',
          order: 0,
        },
      ],
      diagnostics: [],
      summary: {
        ok: true,
      },
    });
  }

  it('injects base, theme stylesheet, and bootstrap into web plugin entries', async () => {
    const app = await buildHostRuntimeApp();
    const tempDir = mkdtempSync(join(tmpdir(), 'ccps-host-runtime-entry-'));
    const entryPath = join(tempDir, 'index.html');
    writeFileSync(
      entryPath,
      '<!doctype html><html><head><title>Plugin</title><link rel="stylesheet" href="./assets/app.css"></head><body></body></html>',
      'utf-8',
    );
    hostIntegrationMock.getWebPluginEntry.mockReturnValue({
      sessionId: 'session-entry-test',
      pluginId: 'com.chips.music-player',
      title: '音乐播放器',
      launchParams: {},
      permissions: [],
      entryPath,
      entryDir: tempDir,
    });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/host/plugin-sessions/session-entry-test/entry',
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('<base href="/api/v1/host/plugin-sessions/session-entry-test/">');
      expect(response.body).toContain('<link rel="stylesheet" href="/api/v1/host/plugin-sessions/session-entry-test/theme.css">');
      expect(response.body).toContain('<script src="/api/v1/host/plugin-sessions/session-entry-test/bootstrap.js"></script>');
      expect(response.body.indexOf('/theme.css')).toBeLessThan(response.body.indexOf('./assets/app.css'));
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      await app.close();
    }
  });

  it('provides a session-local command registry for web-hosted plugins', async () => {
    const app = await buildHostRuntimeApp();
    mockThemeRuntime();
    hostIntegrationMock.getWebPluginSession.mockReturnValue({
      sessionId: 'session-command-test',
      pluginId: 'com.chips.music-player',
      title: '音乐播放器',
      launchParams: {},
      permissions: ['command.read', 'command.write', 'command.invoke'],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/host/plugin-sessions/session-command-test/bootstrap.js',
    });

    expect(response.statusCode).toBe(200);

    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      runScripts: 'outside-only',
      url: 'http://localhost:5173/api/v1/host/plugin-sessions/session-command-test/entry',
    });
    dom.window.eval(response.body);

    const chips = (dom.window as unknown as { chips: { invoke: (action: string, payload?: unknown) => Promise<unknown>; on: (event: string, handler: (payload: unknown) => void) => () => void } }).chips;
    const registeredEvents: unknown[] = [];
    const changedEvents: unknown[] = [];
    const invokedEvents: unknown[] = [];

    chips.on('command.registered', (event) => registeredEvents.push(event));
    chips.on('command.changed', (event) => changedEvents.push(event));
    chips.on('command.invoked', (event) => invokedEvents.push(event));

    const registered = await chips.invoke('command.register', {
      commandId: 'com.chips.music-player.toggle-playback',
      titleKey: 'music-player.commands.togglePlayback.title',
      handlerId: 'toggle-playback',
      state: {
        enabled: true,
        visible: true,
      },
    }) as { command: { commandId: string; ownerPluginId: string; ownerSessionId: string; diagnostic: { enabled: boolean; visible: boolean } } };

    expect(registered.command).toMatchObject({
      commandId: 'com.chips.music-player.toggle-playback',
      ownerPluginId: 'com.chips.music-player',
      ownerSessionId: 'session-command-test',
      diagnostic: {
        enabled: true,
        visible: true,
      },
    });

    const updated = await chips.invoke('command.setState', {
      commandId: 'com.chips.music-player.toggle-playback',
      state: {
        enabled: false,
        disabledReasonKey: 'music-player.commands.disabled.noTrack',
      },
    }) as { command: { state: { enabled: boolean; disabledReasonKey: string }; diagnostic: { enabled: boolean; disabledReasonKey: string } } };

    expect(updated.command.state).toMatchObject({
      enabled: false,
      disabledReasonKey: 'music-player.commands.disabled.noTrack',
    });
    expect(updated.command.diagnostic).toMatchObject({
      enabled: false,
      disabledReasonKey: 'music-player.commands.disabled.noTrack',
    });

    const list = await chips.invoke('command.list') as { commands: Array<{ commandId: string }> };
    expect(list.commands.map((command) => command.commandId)).toEqual(['com.chips.music-player.toggle-playback']);

    const invokeResult = await chips.invoke('command.invoke', {
      commandId: 'com.chips.music-player.toggle-playback',
      source: 'toolbar',
      payload: {
        source: 'unit-test',
      },
    }) as { dispatched: boolean; commandId: string };

    expect(invokeResult).toMatchObject({
      commandId: 'com.chips.music-player.toggle-playback',
      dispatched: true,
    });
    expect(invokedEvents).toHaveLength(1);
    expect(invokedEvents[0]).toMatchObject({
      commandId: 'com.chips.music-player.toggle-playback',
      handlerId: 'toggle-playback',
      source: 'toolbar',
      ownerSessionId: 'session-command-test',
    });
    expect(registeredEvents).toHaveLength(1);
    expect(changedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ change: 'registered' }),
        expect.objectContaining({ change: 'state' }),
      ]),
    );

    await chips.invoke('command.unregister', {
      commandId: 'com.chips.music-player.toggle-playback',
    });
    const emptyList = await chips.invoke('command.list') as { commands: unknown[] };
    expect(emptyList.commands).toEqual([]);

    await app.close();
  });

  it('provides web resource binary and metadata reads for resource-backed plugins', async () => {
    const app = await buildHostRuntimeApp();
    mockThemeRuntime();
    hostIntegrationMock.getWebPluginSession.mockReturnValue({
      sessionId: 'session-resource-test',
      pluginId: 'com.chips.music-player',
      title: '音乐播放器',
      launchParams: {},
      permissions: ['resource.read'],
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/host/plugin-sessions/session-resource-test/bootstrap.js',
    });

    expect(response.statusCode).toBe(200);

    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      runScripts: 'outside-only',
      url: 'http://localhost:5173/api/v1/host/plugin-sessions/session-resource-test/entry',
    });
    const remoteBytes = new Uint8Array([0x5b, 0x30, 0x30, 0x3a, 0x30, 0x31, 0x5d]);
    const fetchMock = vi.fn(async (_url: string, init?: { method?: string }) => ({
      ok: true,
      status: 200,
      headers: {
        get(name: string) {
          const normalizedName = name.toLowerCase();
          if (normalizedName === 'content-type') {
            return 'text/plain; charset=utf-8';
          }
          if (normalizedName === 'content-length') {
            return String(remoteBytes.byteLength);
          }
          return null;
        },
      },
      arrayBuffer: async () => remoteBytes.buffer.slice(0),
      method: init?.method,
    }));

    (dom.window as unknown as { fetch: typeof fetchMock }).fetch = fetchMock;
    dom.window.eval(response.body);

    const chips = (dom.window as unknown as { chips: { invoke: (action: string, payload?: unknown) => Promise<unknown> } }).chips;
    const resourceId = 'https://file.example/cards/lyrics/demo.lrc';

    await expect(chips.invoke('resource.resolve', { resourceId })).resolves.toEqual({
      uri: resourceId,
    });

    await expect(chips.invoke('resource.resolve', {
      resourceId: '/api/v1/cards/card-1/render-cache/cache-v1/assets/content/videos/demo.mp4',
    })).resolves.toEqual({
      uri: 'http://localhost:5173/api/v1/cards/card-1/render-cache/cache-v1/assets/content/videos/demo.mp4',
    });

    await expect(chips.invoke('resource.readBinary', { resourceId })).resolves.toEqual({
      data: Array.from(remoteBytes),
    });

    await expect(chips.invoke('resource.readMetadata', { resourceId })).resolves.toEqual({
      metadata: {
        path: resourceId,
        mimeType: 'text/plain; charset=utf-8',
        size: remoteBytes.byteLength,
        isFile: true,
        isDirectory: false,
      },
    });

    expect(fetchMock).toHaveBeenCalledWith(resourceId);
    expect(fetchMock).toHaveBeenCalledWith(resourceId, { method: 'HEAD' });

    await app.close();
  });

  it('serves active theme CSS and exposes theme runtime APIs for web-hosted plugins', async () => {
    const app = await buildHostRuntimeApp();
    mockThemeRuntime();
    hostIntegrationMock.getWebPluginSession.mockReturnValue({
      sessionId: 'session-theme-test',
      pluginId: 'com.chips.music-player',
      title: '音乐播放器',
      launchParams: {},
      permissions: ['theme.read'],
    });

    const themeCssResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/host/plugin-sessions/session-theme-test/theme.css',
    });

    expect(themeCssResponse.statusCode).toBe(200);
    expect(themeCssResponse.headers['content-type']).toContain('text/css');
    expect(themeCssResponse.body).toContain('Material Symbols Rounded');
    expect(themeCssResponse.body).toContain('/api/v1/host/theme-assets/chips-official.default-theme/');
    expect(themeCssResponse.body).toContain('width: 2.34375vw');
    expect(themeCssResponse.body).toContain('--chips-layout-gap-md: 1.171875vw');

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/host/plugin-sessions/session-theme-test/bootstrap.js',
    });

    expect(response.statusCode).toBe(200);

    const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
      runScripts: 'outside-only',
      url: 'http://localhost:5173/api/v1/host/plugin-sessions/session-theme-test/entry',
    });
    dom.window.eval(response.body);

    expect(dom.window.document.documentElement.getAttribute('data-chips-theme-id')).toBe('chips-official.default-theme');

    const chips = (dom.window as unknown as { chips: { invoke: (action: string, payload?: unknown) => Promise<unknown> } }).chips;
    await expect(chips.invoke('theme.getCurrent')).resolves.toMatchObject({
      themeId: 'chips-official.default-theme',
      displayName: '薯片官方 · 默认主题',
      version: '1.0.0',
    });
    await expect(chips.invoke('theme.getAllCss')).resolves.toMatchObject({
      themeId: 'chips-official.default-theme',
      css: expect.stringContaining('Material Symbols Rounded'),
    });
    await expect(chips.invoke('theme.resolve', { chain: [] })).resolves.toMatchObject({
      tokens: {
        'chips.layout.gap.md': '1.171875vw',
        'chips.sys.icon.wght': 400,
      },
      resolved: [
        {
          id: 'chips-official.default-theme',
        },
      ],
    });

    await app.close();
  });

  it('serves scoped theme font assets with the correct web content type', async () => {
    const app = await buildHostRuntimeApp();
    const tempDir = mkdtempSync(join(tmpdir(), 'ccps-host-runtime-theme-asset-'));
    const fontPath = join(tempDir, 'MaterialSymbolsRounded.woff2');
    const fontBytes = Buffer.from([0x77, 0x4f, 0x46, 0x32]);
    writeFileSync(fontPath, fontBytes);
    hostIntegrationMock.resolveWebThemeAssetPath.mockReturnValue(fontPath);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/host/theme-assets/chips-official.default-theme/dist/icons/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.woff2',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('font/woff2');
      expect(response.rawPayload).toEqual(fontBytes);
      expect(hostIntegrationMock.resolveWebThemeAssetPath).toHaveBeenCalledWith(
        'chips-official.default-theme',
        'dist/icons/variablefont/MaterialSymbolsRounded[FILL,GRAD,opsz,wght].woff2',
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
      await app.close();
    }
  });
});
