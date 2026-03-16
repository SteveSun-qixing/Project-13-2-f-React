import { describe, expect, it, vi } from 'vitest';
import { useConfig, useFile, useI18n, usePlugin, useTheme, useWindow } from '../../src/renderer/hooks';
import type { RuntimeClient } from '../../src/renderer/runtime-client';

const createRuntime = () => {
  const invoke = vi.fn(async (action: string, payload: unknown) => ({ action, payload }));
  return {
    runtime: { invoke } as unknown as RuntimeClient,
    invoke
  };
};

describe('renderer hooks', () => {
  it('maps useWindow/usePlugin/useConfig calls to runtime actions', async () => {
    const { runtime, invoke } = createRuntime();

    const windowClient = useWindow(runtime);
    const pluginClient = usePlugin(runtime);
    const configClient = useConfig(runtime);

    await windowClient.open({ title: 'Demo', width: 800, height: 600 });
    await windowClient.focus('w1');
    await pluginClient.list({ type: 'app' });
    await pluginClient.get('chips.demo');
    await pluginClient.getSelf();
    await pluginClient.getCardPlugin('base.richtext');
    await pluginClient.getLayoutPlugin('grid-layout');
    await pluginClient.install('/tmp/demo.plugin.json');
    await pluginClient.query({ type: 'app' });
    await configClient.set('editor.autoSave', true);
    await configClient.batchSet({ a: 1 });
    await configClient.reset();

    expect(invoke).toHaveBeenCalledWith('window.open', {
      config: { title: 'Demo', width: 800, height: 600 }
    });
    expect(invoke).toHaveBeenCalledWith('window.focus', { windowId: 'w1' });
    expect(invoke).toHaveBeenCalledWith('plugin.list', { type: 'app' });
    expect(invoke).toHaveBeenCalledWith('plugin.get', { pluginId: 'chips.demo' });
    expect(invoke).toHaveBeenCalledWith('plugin.getSelf', {});
    expect(invoke).toHaveBeenCalledWith('plugin.getCardPlugin', { cardType: 'base.richtext' });
    expect(invoke).toHaveBeenCalledWith('plugin.getLayoutPlugin', { layoutType: 'grid-layout' });
    expect(invoke).toHaveBeenCalledWith('plugin.install', { manifestPath: '/tmp/demo.plugin.json' });
    expect(invoke).toHaveBeenCalledWith('plugin.query', { type: 'app' });
    expect(invoke).toHaveBeenCalledWith('config.set', { key: 'editor.autoSave', value: true });
    expect(invoke).toHaveBeenCalledWith('config.batchSet', { entries: { a: 1 } });
    expect(invoke).toHaveBeenCalledWith('config.reset', {});
  });

  it('keeps existing useTheme/useI18n/useFile behavior', async () => {
    const { runtime, invoke } = createRuntime();

    const theme = useTheme(runtime);
    const i18n = useI18n(runtime);
    const file = useFile(runtime);

    await theme.getAllCss();
    await i18n.translate('system.ready', { name: 'chips' });
    await file.read('/tmp/a.txt');

    expect(invoke).toHaveBeenCalledWith('theme.getAllCss', {});
    expect(invoke).toHaveBeenCalledWith('i18n.translate', {
      key: 'system.ready',
      params: { name: 'chips' }
    });
    expect(invoke).toHaveBeenCalledWith('file.read', {
      path: '/tmp/a.txt',
      options: undefined
    });
  });
});
