import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PluginRuntime } from '../../src/runtime';
import {
  discoverBuiltInPluginDefinitions,
  ensureBuiltInPluginShortcuts,
  ensureBuiltInPlugins,
  type BuiltInPluginDefinition
} from '../../src/main/core/built-in-plugins';

let workspace: string;
let builtInRoot: string;
let runtime: PluginRuntime;

const settingsPlugin = {
  id: 'com.chips.eco-settings-panel',
  manifestRelativePath: 'com.chips.eco-settings-panel/manifest.yaml',
  autoEnable: true,
  createShortcut: true,
  launchOnFirstInstall: true
} satisfies BuiltInPluginDefinition;

const defaultTheme = {
  id: 'theme.theme.chips-official-default-theme',
  manifestRelativePath: 'theme.theme.chips-official-default-theme/manifest.yaml',
  autoEnable: true
} satisfies BuiltInPluginDefinition;

const photoViewerPlugin = {
  id: 'com.chips.photo-viewer',
  manifestRelativePath: 'com.chips.photo-viewer/manifest.yaml',
  autoEnable: true,
  required: false
} satisfies BuiltInPluginDefinition;

const createBuiltInTheme = async (): Promise<void> => {
  const pluginDir = path.join(builtInRoot, defaultTheme.id);
  await fs.mkdir(path.join(pluginDir, 'dist'), { recursive: true });
  await fs.mkdir(path.join(pluginDir, 'contracts'), { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'manifest.yaml'),
    [
      'schemaVersion: "1.0.0"',
      `id: "${defaultTheme.id}"`,
      'name: "Default Theme"',
      'version: "1.0.0"',
      'type: "theme"',
      'publisher: "chips"',
      'description: "Built-in theme"',
      'permissions:',
      '  - "theme.read"',
      'entry:',
      '  tokens: "dist/tokens.json"',
      '  themeCss: "dist/theme.css"',
      'themeId: "chips-official.default-theme"',
      'displayName: "Default Theme"',
      'isDefault: true',
      'parentTheme: ""',
      'ui:',
      '  layout:',
      '    owner: page',
      '    unit: cpx',
      '    baseWidth: 1024',
      '    contract: contracts/theme-interface.contract.json',
      '    minFunctionalSet: contracts/theme-min-functional-set.json'
    ].join('\n'),
    'utf-8'
  );
  await fs.writeFile(path.join(pluginDir, 'dist', 'tokens.json'), '{"ref":{},"sys":{},"comp":{},"motion":{},"layout":{}}', 'utf-8');
  await fs.writeFile(path.join(pluginDir, 'dist', 'theme.css'), ':root { --chips-color: #111; }\n', 'utf-8');
  await fs.writeFile(path.join(pluginDir, 'contracts', 'theme-interface.contract.json'), '{}', 'utf-8');
  await fs.writeFile(path.join(pluginDir, 'contracts', 'theme-min-functional-set.json'), '{}', 'utf-8');
};

const createBuiltInSettingsPanel = async (): Promise<void> => {
  const pluginDir = path.join(builtInRoot, settingsPlugin.id);
  await fs.mkdir(path.join(pluginDir, 'dist'), { recursive: true });
  await fs.mkdir(path.join(pluginDir, 'assets', 'icons'), { recursive: true });
  await fs.writeFile(
    path.join(pluginDir, 'manifest.yaml'),
    [
      `id: "${settingsPlugin.id}"`,
      'name: "Settings Panel"',
      'version: "1.0.0"',
      'type: "app"',
      'description: "Built-in settings panel"',
      'permissions:',
      '  - "plugin.read"',
      '  - "plugin.manage"',
      'entry: dist/index.html',
      'runtime:',
      '  targets:',
      '    desktop:',
      '      supported: true',
      '    web:',
      '      supported: false',
      '    mobile:',
      '      supported: false',
      '    headless:',
      '      supported: false',
      'ui:',
      '  launcher:',
      '    displayName: Settings Panel',
      '    icon: assets/icons/app-icon.ico',
      '  surface:',
      '    defaultKind: window',
      '    preferredKinds:',
      '      desktop: window',
      '      web: route',
      '      mobile: fullscreen',
      '      headless: window'
    ].join('\n'),
    'utf-8'
  );
  await fs.writeFile(path.join(pluginDir, 'dist', 'index.html'), '<!doctype html><html><body>settings</body></html>', 'utf-8');
  await fs.writeFile(path.join(pluginDir, 'assets', 'icons', 'app-icon.ico'), 'icon', 'utf-8');
};

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-builtins-workspace-'));
  builtInRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-builtins-root-'));
  runtime = new PluginRuntime(workspace, {
    locale: 'zh-CN',
    themeId: 'chips-official.default-theme'
  });
  await runtime.load();
  await createBuiltInTheme();
  await createBuiltInSettingsPanel();
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
  await fs.rm(builtInRoot, { recursive: true, force: true });
});

describe('built-in plugin bootstrap', () => {
  it('installs, enables, and schedules first-run launch for bundled plugins', async () => {
    const summary = await ensureBuiltInPlugins({
      runtime,
      pluginRoots: [builtInRoot],
      plugins: [defaultTheme, settingsPlugin]
    });

    expect(summary.installedPluginIds).toEqual([
      'theme.theme.chips-official-default-theme',
      'com.chips.eco-settings-panel'
    ]);
    expect(summary.enabledPluginIds).toEqual([
      'theme.theme.chips-official-default-theme',
      'com.chips.eco-settings-panel'
    ]);
    expect(summary.shortcutPluginIds).toEqual(['com.chips.eco-settings-panel']);
    expect(summary.launchPluginId).toBe('com.chips.eco-settings-panel');

    const installed = runtime.query();
    expect(installed).toHaveLength(2);
    expect(installed.every((record) => record.enabled)).toBe(true);
  });

  it('creates shortcuts only when missing', async () => {
    const invoke = vi.fn(async (action: string) => {
      if (action === 'plugin.getShortcut') {
        return { shortcut: { exists: false } };
      }
      return { shortcut: { exists: true } };
    });

    const created = await ensureBuiltInPluginShortcuts(
      { invoke } as unknown as { invoke<T>(action: string, payload?: unknown): Promise<T> },
      ['com.chips.eco-settings-panel']
    );

    expect(created).toEqual(['com.chips.eco-settings-panel']);
    expect(invoke).toHaveBeenNthCalledWith(1, 'plugin.getShortcut', {
      pluginId: 'com.chips.eco-settings-panel'
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'plugin.createShortcut', {
      pluginId: 'com.chips.eco-settings-panel',
      replace: false
    });
  });

  it('skips optional built-in plugins when the bundle is not shipped', async () => {
    const summary = await ensureBuiltInPlugins({
      runtime,
      pluginRoots: [builtInRoot],
      plugins: [defaultTheme, settingsPlugin, photoViewerPlugin]
    });

    expect(summary.installedPluginIds).toEqual([
      'theme.theme.chips-official-default-theme',
      'com.chips.eco-settings-panel'
    ]);
    expect(summary.enabledPluginIds).toEqual([
      'theme.theme.chips-official-default-theme',
      'com.chips.eco-settings-panel'
    ]);
    expect(summary.shortcutPluginIds).toEqual(['com.chips.eco-settings-panel']);
    expect(runtime.query().some((record) => record.manifest.id === 'com.chips.photo-viewer')).toBe(false);
  });

  it('discovers built-in plugin definitions from plugin roots', async () => {
    const discovered = await discoverBuiltInPluginDefinitions([builtInRoot]);

    expect(discovered).toEqual([
      expect.objectContaining({
        id: 'com.chips.eco-settings-panel',
        manifestRelativePath: 'com.chips.eco-settings-panel/manifest.yaml',
        autoEnable: true,
        createShortcut: true,
        launchOnFirstInstall: true
      }),
      expect.objectContaining({
        id: 'theme.theme.chips-official-default-theme',
        manifestRelativePath: 'theme.theme.chips-official-default-theme/manifest.yaml',
        autoEnable: true
      })
    ]);
  });

  it('installs and enables every discovered built-in plugin', async () => {
    const summary = await ensureBuiltInPlugins({
      runtime,
      pluginRoots: [builtInRoot]
    });

    expect(summary.installedPluginIds).toEqual([
      'com.chips.eco-settings-panel',
      'theme.theme.chips-official-default-theme'
    ]);
    expect(summary.enabledPluginIds).toEqual([
      'com.chips.eco-settings-panel',
      'theme.theme.chips-official-default-theme'
    ]);
    expect(summary.shortcutPluginIds).toEqual(['com.chips.eco-settings-panel']);
    expect(summary.launchPluginId).toBe('com.chips.eco-settings-panel');
    expect(runtime.query()).toHaveLength(2);
  });
});
