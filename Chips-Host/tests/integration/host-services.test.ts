import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HostApplication } from '../../src/main/core/host-application';
import { openAssociatedFile } from '../../src/main/core/file-association';
import { StoreZipService } from '../../packages/zip-service/src';
import { RuntimeClient } from '../../src/renderer/runtime-client';
import { PluginRuntime } from '../../src/runtime';

let workspace: string;
let app: HostApplication;
let runtime: RuntimeClient;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-host-it-'));
  const bootstrapRuntime = new PluginRuntime(workspace, {
    locale: 'zh-CN',
    themeId: 'chips-official.default-theme'
  });
  await bootstrapRuntime.load();
  const defaultTheme = await bootstrapRuntime.install(path.resolve(process.cwd(), '../ThemePack/Chips-default/manifest.yaml'));
  await bootstrapRuntime.enable(defaultTheme.manifest.id);
  app = new HostApplication({ workspacePath: workspace });
  await app.start();
  runtime = new RuntimeClient(app.createBridge(), {
    defaultTimeout: 5000,
    maxRetries: 1,
    retryDelay: 10,
    retryBackoff: 2,
    enableRetry: true
  });
});

afterEach(async () => {
  await app.stop();
  await fs.rm(workspace, { recursive: true, force: true });
});

describe('Host services integration', () => {
  it('reads and writes configuration through routes', async () => {
    await runtime.invoke('config.set', { key: 'ui.language', value: 'zh-CN' });
    const result = await runtime.invoke<{ value: string }>('config.get', { key: 'ui.language' });
    expect(result.value).toBe('zh-CN');
  });

  it('resolves layered config precedence by scope', async () => {
    await runtime.invoke('config.set', { key: 'chips.layer.key', value: 'system', scope: 'system' });
    await runtime.invoke('config.set', { key: 'chips.layer.key', value: 'workspace', scope: 'workspace' });
    const workspaceValue = await runtime.invoke<{ value: string }>('config.get', { key: 'chips.layer.key' });
    expect(workspaceValue.value).toBe('workspace');

    await runtime.invoke('config.set', { key: 'chips.layer.key', value: 'user', scope: 'user' });
    const userValue = await runtime.invoke<{ value: string }>('config.get', { key: 'chips.layer.key' });
    expect(userValue.value).toBe('user');

    await runtime.invoke('config.reset', { key: 'chips.layer.key', scope: 'user' });
    const fallbackWorkspace = await runtime.invoke<{ value: string }>('config.get', { key: 'chips.layer.key' });
    expect(fallbackWorkspace.value).toBe('workspace');

    await runtime.invoke('config.reset', { key: 'chips.layer.key', scope: 'workspace' });
    const fallbackSystem = await runtime.invoke<{ value: string }>('config.get', { key: 'chips.layer.key' });
    expect(fallbackSystem.value).toBe('system');
  });

  it('lists and applies themes', async () => {
    const list = await runtime.invoke<{ themes: Array<{ id: string }> }>('theme.list', {});
    expect(list.themes.length).toBeGreaterThan(0);

    await runtime.invoke('theme.apply', { id: list.themes[0]!.id });
    const current = await runtime.invoke<{ themeId: string }>('theme.getCurrent', {});
    expect(current.themeId).toBe(list.themes[0]!.id);
  });

  it('only exposes enabled themes to theme service', async () => {
    const darkInstall = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath: path.resolve(process.cwd(), '../ThemePack/Chips-theme-default-dark/manifest.yaml')
    });

    const beforeEnable = await runtime.invoke<{ themes: Array<{ id: string }> }>('theme.list', {});
    expect(beforeEnable.themes.some((theme) => theme.id === 'chips-official.default-dark-theme')).toBe(false);

    await runtime.invoke('plugin.enable', { pluginId: darkInstall.pluginId });
    const afterEnable = await runtime.invoke<{ themes: Array<{ id: string }> }>('theme.list', {});
    expect(afterEnable.themes.some((theme) => theme.id === 'chips-official.default-dark-theme')).toBe(true);
  });

  it('resolves theme token chain and enforces max depth', async () => {
    const resolved = await runtime.invoke<{
      resolved: Array<{ id: string; displayName: string; order: number }>;
      tokens: Record<string, unknown>;
    }>('theme.resolve', {
      chain: ['chips-official.default-theme']
    });
    expect(resolved.resolved.length).toBeGreaterThan(0);
    expect(resolved.resolved[0]?.id).toBe('chips-official.default-theme');
    expect(resolved.resolved[0]?.order).toBe(0);
    expect(Object.keys(resolved.tokens).length).toBeGreaterThan(0);

    await expect(
      runtime.invoke('theme.resolve', {
        chain: ['a', 'b', 'c', 'd', 'e', 'f', 'g']
      })
    ).rejects.toMatchObject({ code: 'THEME_CHAIN_TOO_DEEP' });
  });

  it('supports i18n translation and locale switching', async () => {
    await runtime.invoke('i18n.setCurrent', { locale: 'en-US' });
    const translated = await runtime.invoke<{ text: string }>('i18n.translate', { key: 'system.ready' });
    expect(translated.text).toBe('System ready');
  });

  it('returns structured file entries from file.list', async () => {
    const cardsDir = path.join(workspace, 'cards');
    const cardPath = path.join(cardsDir, 'demo.card');
    await fs.mkdir(cardsDir, { recursive: true });
    await fs.writeFile(cardPath, 'demo', 'utf-8');

    const rootListed = await runtime.invoke<{
      entries: Array<{ path: string; isFile: boolean; isDirectory: boolean }>;
    }>('file.list', { dir: workspace });
    const nestedListed = await runtime.invoke<{
      entries: Array<{ path: string; isFile: boolean; isDirectory: boolean }>;
    }>('file.list', { dir: cardsDir });

    expect(rootListed.entries).toContainEqual(
      expect.objectContaining({
        path: cardsDir,
        isDirectory: true,
        isFile: false
      })
    );
    expect(nestedListed.entries).toContainEqual(
      expect.objectContaining({
        path: cardPath,
        isFile: true,
        isDirectory: false
      })
    );
  });

  it('renders card through unified rendering target options', async () => {
    const install = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath: path.resolve(process.cwd(), '../Chips-BaseCardPlugin/richtext-BCP/manifest.yaml')
    });
    await runtime.invoke('plugin.enable', { pluginId: install.pluginId });

    const source = path.join(workspace, 'render-card-source');
    await fs.mkdir(path.join(source, '.card'), { recursive: true });
    await fs.mkdir(path.join(source, 'content'), { recursive: true });
    await fs.writeFile(path.join(source, '.card/metadata.yaml'), 'card_id: card.render.demo\nname: Render Demo\n', 'utf-8');
    await fs.writeFile(
      path.join(source, '.card/structure.yaml'),
      'structure:\n  - id: "intro"\n    type: "base.richtext"\n',
      'utf-8'
    );
    await fs.writeFile(path.join(source, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
    await fs.writeFile(
      path.join(source, 'content/intro.yaml'),
      'card_type: "base.richtext"\ncontent_source: "inline"\ncontent_text: |\n  <h1>Render Intro</h1>\n  <p>Rendered through host service.</p>\n',
      'utf-8'
    );

    const cardFile = path.join(workspace, 'render-demo.card');
    const zip = new StoreZipService();
    await zip.compress(source, cardFile);

    const rendered = await runtime.invoke<{
      view: {
        target: string;
        body: string;
        semanticHash: string;
        consistency?: { consistent: boolean };
      };
    }>('card.render', {
      cardFile,
      options: {
        target: 'offscreen-render',
        verifyConsistency: true
      }
    });

    expect(rendered.view.target).toBe('offscreen-render');
    expect(rendered.view.body).toContain('data-target="offscreen-render"');
    expect(rendered.view.body).toContain('Render Intro');
    expect(rendered.view.body).toContain('Rendered through host service.');
    expect(rendered.view.semanticHash.length).toBeGreaterThan(10);
    expect(rendered.view.consistency?.consistent).toBe(true);
  }, 30_000);

  it('rejects invalid card.render options target by schema', async () => {
    await expect(
      runtime.invoke('card.render', {
        cardFile: '/tmp/invalid.card',
        options: {
          target: 'invalid-target'
        }
      })
    ).rejects.toMatchObject({ code: 'SCHEMA_VALIDATION_FAILED' });
  });

  it('creates window records via window service', async () => {
    const opened = await runtime.invoke<{ window: { id: string; chrome?: { backgroundColor?: string } } }>('window.open', {
      config: {
        title: 'Demo',
        width: 800,
        height: 600,
        chrome: {
          backgroundColor: '#ffffff'
        }
      }
    });
    expect(opened.window.id).toBeTypeOf('string');
    expect(opened.window.chrome?.backgroundColor).toBe('#ffffff');

    const focused = await runtime.invoke('window.focus', { windowId: opened.window.id });
    expect(focused).toMatchObject({ ack: true });
  });

  it('fills themed window background color when caller does not provide one', async () => {
    const opened = await runtime.invoke<{ window: { chrome?: { backgroundColor?: string } } }>('window.open', {
      config: {
        title: 'Theme Window',
        width: 640,
        height: 480
      }
    });

    expect(opened.window.chrome?.backgroundColor).toBeTypeOf('string');
    expect(opened.window.chrome?.backgroundColor?.length).toBeGreaterThan(0);
  });

  it('writes and queries logs', async () => {
    await runtime.invoke('log.write', { level: 'info', message: 'integration-log' });
    const result = await runtime.invoke<{ entries: Array<{ message: string }> }>('log.query', {});
    expect(result.entries.some((entry) => entry.message === 'integration-log')).toBe(true);
  });

  it('persists encrypted credentials across host restart', async () => {
    await runtime.invoke('credential.set', { ref: 'chips.api.token', value: 'secret-token' });
    const stored = await fs.readFile(path.join(workspace, 'credentials.enc.json'), 'utf-8');
    expect(stored.includes('secret-token')).toBe(false);

    await app.stop();
    app = new HostApplication({ workspacePath: workspace });
    await app.start();
    runtime = new RuntimeClient(app.createBridge(), {
      defaultTimeout: 5000,
      maxRetries: 1,
      retryDelay: 10,
      retryBackoff: 2,
      enableRetry: true
    });

    const restored = await runtime.invoke<{ value: string | null }>('credential.get', { ref: 'chips.api.token' });
    expect(restored.value).toBe('secret-token');
  });

  it('returns control-plane health report', async () => {
    const report = await runtime.invoke<{ status: string; report: { routes: number; services: number } }>('control-plane.health', {});
    expect(report.status).toBe('ok');
    expect(report.report.services).toBe(17);
    expect(report.report.routes).toBeGreaterThan(30);
  });

  it('supports plugin runtime handshake flow', async () => {
    const manifestPath = path.join(workspace, 'runtime.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify({
        id: 'chips.runtime.plugin',
        version: '1.0.0',
        type: 'app',
        name: 'Runtime Plugin',
        permissions: ['file.read']
      })
    );

    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath });
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });
    const init = await runtime.invoke<{ session: { sessionId: string; sessionNonce: string } }>('plugin.init', {
      pluginId: installed.pluginId
    });
    const completed = await runtime.invoke<{ session: { status: string } }>('plugin.handshake.complete', {
      sessionId: init.session.sessionId,
      nonce: init.session.sessionNonce
    });
    expect(completed.session.status).toBe('running');
  });

  it('mounts enabled module plugins through the formal module service', async () => {
    const moduleProjectDir = path.join(workspace, 'markdown-module');
    await fs.mkdir(path.join(moduleProjectDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(moduleProjectDir, 'manifest.yaml'),
      [
        'id: chips.module.markdown-renderer',
        'version: "1.0.0"',
        'type: module',
        'name: Markdown Renderer Module',
        'description: Shared markdown rendering module',
        'permissions: []',
        'capabilities:',
        '  - markdown-renderer',
        'entry: dist/index.mjs'
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(
      path.join(moduleProjectDir, 'dist/index.mjs'),
      'export const createMarkdownRenderer = () => "markdown-renderer";\n',
      'utf-8'
    );

    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath: path.join(moduleProjectDir, 'manifest.yaml')
    });
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });

    const mounted = await runtime.invoke<{
      module: {
        slot: string;
        moduleId: string;
        entry?: string;
        capabilities: string[];
        active: boolean;
      };
    }>('module.mount', {
      slot: 'preview.main',
      moduleId: installed.pluginId
    });

    expect(mounted.module).toMatchObject({
      slot: 'preview.main',
      moduleId: 'chips.module.markdown-renderer',
      entry: 'dist/index.mjs',
      active: true
    });
    expect(mounted.module.capabilities).toContain('markdown-renderer');

    const queried = await runtime.invoke<{
      module: {
        slot: string;
        moduleId: string;
        active: boolean;
      } | null;
    }>('module.query', { slot: 'preview.main' });
    expect(queried.module).toMatchObject({
      slot: 'preview.main',
      moduleId: 'chips.module.markdown-renderer',
      active: true
    });

    const listed = await runtime.invoke<{
      modules: Array<{
        slot: string;
        moduleId: string;
      }>;
    }>('module.list', {});
    expect(listed.modules).toContainEqual(
      expect.objectContaining({
        slot: 'preview.main',
        moduleId: 'chips.module.markdown-renderer'
      })
    );

    await runtime.invoke('module.unmount', { slot: 'preview.main' });
    const afterUnmount = await runtime.invoke<{ module: null }>('module.query', { slot: 'preview.main' });
    expect(afterUnmount.module).toBeNull();
  });

  it('installs plugin from .cpk package', async () => {
    const packageDir = path.join(workspace, 'demo-cpk-plugin');
    await fs.mkdir(path.join(packageDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(packageDir, 'manifest.yaml'),
      [
        'id: chips.runtime.cpk',
        'version: "1.0.0"',
        'type: app',
        'name: Runtime CPK Plugin',
        'permissions:',
        '  - file.read',
        'entry: dist/main.js'
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(path.join(packageDir, 'dist/main.js'), 'module.exports = {};', 'utf-8');

    const cpkPath = path.join(workspace, 'chips.runtime.cpk.cpk');
    const zip = new StoreZipService();
    await zip.compress(packageDir, cpkPath);

    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath: cpkPath });
    expect(installed.pluginId).toBe('chips.runtime.cpk');

    const queried = await runtime.invoke<{
      plugins: Array<{ id: string; manifestPath: string; name: string; version: string; enabled: boolean }>;
    }>('plugin.query', {});
    expect(queried.plugins).toContainEqual(
      expect.objectContaining({
        id: 'chips.runtime.cpk',
        name: 'Runtime CPK Plugin',
        version: '1.0.0',
        enabled: false
      })
    );
  });

  it('exposes plugin governance metadata through list/get/query', async () => {
    const darkInstall = await runtime.invoke<{ pluginId: string }>('plugin.install', {
      manifestPath: path.resolve(process.cwd(), '../ThemePack/Chips-theme-default-dark/manifest.yaml')
    });

    const listed = await runtime.invoke<{
      plugins: Array<{
        id: string;
        name: string;
        version: string;
        type: string;
        theme?: {
          themeId: string;
          displayName: string;
          isDefault: boolean;
        };
      }>;
    }>('plugin.list', { type: 'theme' });
    expect(listed.plugins).toContainEqual(
      expect.objectContaining({
        id: darkInstall.pluginId,
        name: '薯片官方 · 暗夜主题',
        version: '1.0.0',
        type: 'theme',
        theme: expect.objectContaining({
          themeId: 'chips-official.default-dark-theme',
          displayName: '薯片官方 · 暗夜主题',
          isDefault: false
        })
      })
    );

    const queried = await runtime.invoke<{
      plugins: Array<{
        id: string;
        enabled: boolean;
        theme?: {
          themeId: string;
          displayName: string;
        };
      }>;
    }>('plugin.query', { type: 'theme' });
    expect(queried.plugins).toContainEqual(
      expect.objectContaining({
        id: darkInstall.pluginId,
        enabled: false,
        theme: expect.objectContaining({
          themeId: 'chips-official.default-dark-theme',
          displayName: '薯片官方 · 暗夜主题'
        })
      })
    );

    const fetched = await runtime.invoke<{
      plugin: {
        id: string;
        name: string;
        theme?: {
          themeId: string;
        };
      };
    }>('plugin.get', { pluginId: darkInstall.pluginId });
    expect(fetched.plugin).toMatchObject({
      id: darkInstall.pluginId,
      name: '薯片官方 · 暗夜主题',
      theme: {
        themeId: 'chips-official.default-dark-theme'
      }
    });
  });

  it('uses plugin handler when opening associated card file', async () => {
    const pluginDir = path.join(workspace, 'card-handler-plugin');
    await fs.mkdir(path.join(pluginDir, 'dist'), { recursive: true });
    await fs.writeFile(
      path.join(pluginDir, 'manifest.yaml'),
      [
        'id: chips.card.handler',
        'version: "1.0.0"',
        'type: app',
        'name: Card Handler',
        'permissions:',
        '  - file.read',
        'ui:',
        '  window:',
        '    chrome:',
        '      backgroundColor: "#ffffff"',
        '      titleBarStyle: hidden',
        '      titleBarOverlay:',
        '        color: "#ffffff00"',
        '        symbolColor: "#667085"',
        '        height: 44',
        'capabilities:',
        '  - file-handler:.card',
        'entry: dist/index.html'
      ].join('\n'),
      'utf-8'
    );
    await fs.writeFile(path.join(pluginDir, 'dist/index.html'), '<html><body>card handler</body></html>', 'utf-8');

    const zip = new StoreZipService();
    const cpkPath = path.join(workspace, 'chips.card.handler.cpk');
    await zip.compress(pluginDir, cpkPath);
    const installed = await runtime.invoke<{ pluginId: string }>('plugin.install', { manifestPath: cpkPath });
    await runtime.invoke('plugin.enable', { pluginId: installed.pluginId });

    const cardSourceDir = path.join(workspace, 'card-open-source');
    await fs.mkdir(path.join(cardSourceDir, '.card'), { recursive: true });
    await fs.writeFile(path.join(cardSourceDir, '.card/metadata.yaml'), 'id: test.card\nname: Test Card\n', 'utf-8');
    await fs.writeFile(path.join(cardSourceDir, '.card/structure.yaml'), 'cards: []\n', 'utf-8');
    await fs.writeFile(path.join(cardSourceDir, '.card/cover.html'), '<h1>cover</h1>', 'utf-8');
    const cardFile = path.join(workspace, 'associated.card');
    await zip.compress(cardSourceDir, cardFile);

    const result = await openAssociatedFile(runtime, cardFile);
    expect(result.mode).toBe('card');
    expect(result.pluginId).toBe('chips.card.handler');
    expect(result.windowId).toBeTypeOf('string');

    const queried = await runtime.invoke<{
      plugins: Array<{
        id: string;
        ui?: {
          window?: {
            chrome?: {
              titleBarStyle?: string;
              backgroundColor?: string;
            };
          };
        };
      }>;
    }>('plugin.query', { type: 'app' });
    const handler = queried.plugins.find((plugin) => plugin.id === 'chips.card.handler');
    expect(handler?.ui?.window?.chrome?.backgroundColor).toBe('#ffffff');
    expect(handler?.ui?.window?.chrome?.titleBarStyle).toBe('hidden');
  });
});
