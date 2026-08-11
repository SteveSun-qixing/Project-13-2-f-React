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
      'resource.resolve',
      'resource.open',
      'resource.readMetadata',
      'resource.readBinary',
      'resource.convertTiffToPng',
      'resource.extractVideoFrame',
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
      'command.register',
      'command.unregister',
      'command.get',
      'command.list',
      'command.setState',
      'command.invoke',
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
      'plugin.query',
      'plugin.init',
      'plugin.handshake.complete',
      'cli.command.list',
      'cli.command.get',
      'cli.command.resolve',
      'cli.task.create',
      'cli.task.bindInvocation',
      'cli.task.get',
      'cli.task.progress',
      'cli.task.complete',
      'cli.task.fail',
      'cli.task.cancel',
      'module.listProviders',
      'module.resolve',
      'module.invoke',
      'module.job.get',
      'module.job.cancel',
      'platform.getInfo',
      'platform.getCapabilities',
      'platform.getScreenInfo',
      'platform.listScreens',
      'platform.renderHtmlToPdf',
      'platform.renderHtmlToImage',
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
      'card.readInfo',
      'card.render',
      'card.renderEditor',
      'card.open',
      'card.validate',
      'box.pack',
      'box.unpack',
      'box.inspect',
      'box.validate',
      'box.readMetadata',
      'box.openView',
      'box.listEntries',
      'box.readEntryDetail',
      'box.renderEntryCover',
      'box.renderEntryDocument',
      'box.releaseEntryDocument',
      'box.openEntry',
      'box.resolveEntryResource',
      'box.readBoxAsset',
      'box.prefetchEntries',
      'box.closeView',
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

  it('writes descriptor route manifest metadata in workspace', async () => {
    const filePath = path.join(workspace, 'route-descriptor-manifest.json');
    const content = await fs.readFile(filePath, 'utf-8');
    const manifest = JSON.parse(content) as {
      routes: Record<string, {
        action: string;
        schemaIn: string;
        schemaOut: string;
        permission: string[];
        timeoutMs: number;
        idempotent: boolean;
        retries: number;
      }>;
    };

    expect(Object.keys(manifest.routes).length).toBeGreaterThan(60);
    expect(manifest.routes['control-plane.health']).toEqual({
      action: 'control-plane.health',
      schemaIn: 'schemas/control-plane.health.request.json',
      schemaOut: 'schemas/control-plane.health.response.json',
      permission: ['control.read'],
      timeoutMs: 2000,
      idempotent: true,
      retries: 0
    });
  });

  it('matches the SDK public route manifest', async () => {
    const sdkManifestPath = path.resolve(__dirname, '../../../Chips-SDK/src/contracts/route-manifest.json');
    const sdkManifest = JSON.parse(await fs.readFile(sdkManifestPath, 'utf-8')) as {
      routes: Record<string, {
        action: string;
        schemaIn: string;
        schemaOut: string;
        permission: string[];
        timeoutMs: number;
        idempotent: boolean;
        retries: number;
      }>;
    };
    const hostRoutes = app.kernel.getRouteManifest().slice().sort();
    const sdkRoutes = Object.keys(sdkManifest.routes).sort();

    expect(sdkRoutes).toEqual(hostRoutes);
  });

  it('matches the SDK public route descriptor metadata', async () => {
    const sdkManifestPath = path.resolve(__dirname, '../../../Chips-SDK/src/contracts/route-manifest.json');
    const sdkManifest = JSON.parse(await fs.readFile(sdkManifestPath, 'utf-8')) as {
      routes: Record<string, {
        action: string;
        schemaIn: string;
        schemaOut: string;
        permission: string[];
        timeoutMs: number;
        idempotent: boolean;
        retries: number;
      }>;
    };

    expect(sdkManifest.routes).toEqual(app.kernel.getRouteDescriptorManifest());
  });
});
