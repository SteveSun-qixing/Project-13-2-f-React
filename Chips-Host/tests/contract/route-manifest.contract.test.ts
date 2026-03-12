import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HostApplication } from '../../src/main/core/host-application';

let workspace: string;
let app: HostApplication;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-contract-test-'));
  app = new HostApplication({ workspacePath: workspace });
  await app.start();
});

afterEach(async () => {
  await app.stop();
  await fs.rm(workspace, { recursive: true, force: true });
});

describe('route manifest contract', () => {
  it('contains required route actions for host services', async () => {
    const required = [
      'file.read',
      'file.write',
      'file.stat',
      'file.list',
      'file.watch',
      'file.exists',
      'file.mkdir',
      'file.delete',
      'file.copy',
      'file.move',
      'resource.resolve',
      'resource.readMetadata',
      'resource.readBinary',
      'config.get',
      'config.set',
      'config.batchSet',
      'config.reset',
      'theme.list',
      'theme.apply',
      'theme.getCurrent',
      'theme.getAllCss',
      'theme.resolve',
      'theme.contract.get',
      'i18n.getCurrent',
      'i18n.setCurrent',
      'i18n.translate',
      'i18n.listLocales',
      'window.open',
      'window.focus',
      'window.resize',
      'window.setState',
      'window.getState',
      'window.close',
      'plugin.list',
      'plugin.get',
      'plugin.getSelf',
      'plugin.getCardPlugin',
      'plugin.getLayoutPlugin',
      'plugin.install',
      'plugin.enable',
      'plugin.disable',
      'plugin.uninstall',
      'plugin.launch',
      'plugin.getShortcut',
      'plugin.createShortcut',
      'plugin.removeShortcut',
      'plugin.query',
      'plugin.init',
      'plugin.handshake.complete',
      'module.mount',
      'module.unmount',
      'module.query',
      'module.list',
      'platform.getInfo',
      'platform.getCapabilities',
      'platform.getScreenInfo',
      'platform.listScreens',
      'platform.openExternal',
      'platform.dialogOpenFile',
      'platform.dialogSaveFile',
      'platform.dialogShowMessage',
      'platform.dialogShowConfirm',
      'platform.clipboardRead',
      'platform.clipboardWrite',
      'platform.shellOpenPath',
      'platform.shellOpenExternal',
      'platform.shellShowItemInFolder',
      'platform.notificationShow',
      'platform.traySet',
      'platform.trayClear',
      'platform.trayGetState',
      'platform.shortcutRegister',
      'platform.shortcutUnregister',
      'platform.shortcutIsRegistered',
      'platform.shortcutList',
      'platform.shortcutClear',
      'platform.powerGetState',
      'platform.powerSetPreventSleep',
      'platform.ipcCreateChannel',
      'platform.ipcSend',
      'platform.ipcReceive',
      'platform.ipcCloseChannel',
      'platform.ipcListChannels',
      'log.write',
      'log.query',
      'log.export',
      'credential.get',
      'credential.set',
      'credential.delete',
      'credential.rotate',
      'card.parse',
      'card.getBaseCard',
      'card.render',
      'card.renderBaseCardEditor',
      'card.validate',
      'card.updateBaseCard',
      'box.pack',
      'box.unpack',
      'box.inspect',
      'zip.compress',
      'zip.extract',
      'zip.list',
      'serializer.encode',
      'serializer.decode',
      'serializer.validate',
      'control-plane.health',
      'control-plane.check',
      'control-plane.metrics',
      'control-plane.diagnose'
    ];

    const manifest = app.kernel.getRouteManifest();
    for (const route of required) {
      expect(manifest).toContain(route);
    }
  });

  it('writes route-manifest.json in workspace', async () => {
    const filePath = path.join(workspace, 'route-manifest.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const manifest = JSON.parse(content) as string[];
    expect(manifest.length).toBeGreaterThan(60);
    expect(manifest).toContain('control-plane.health');
  });
});
