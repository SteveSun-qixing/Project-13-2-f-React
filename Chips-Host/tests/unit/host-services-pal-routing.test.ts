import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Kernel } from '../../packages/kernel/src';
import type { PALAdapter } from '../../packages/pal/src';
import { BoxService } from '../../packages/box-service/src';
import { CardService } from '../../packages/card-service/src';
import { StoreZipService } from '../../packages/zip-service/src';
import { PluginRuntime } from '../../src/runtime';
import { StructuredLogger } from '../../src/shared/logger';
import type { RouteInvocationContext } from '../../src/shared/types';
import { registerHostSchemas } from '../../src/main/services/register-schemas';
import { registerHostServices } from '../../src/main/services/register-host-services';

interface PalState {
  clipboardText: string;
  clipboardImageBase64: string | null;
  clipboardFiles: string[];
  dialogOpenArgs: unknown[];
  dialogSaveArgs: unknown[];
  dialogMessageArgs: unknown[];
  dialogConfirmArgs: unknown[];
  shellOpenPath: string[];
  shellOpenExternal: string[];
  shellShowInFolder: string[];
  notifications: Array<{ title: string; body: string }>;
  trayActive: boolean;
  shortcuts: string[];
  preventSleep: boolean;
  ipcChannels: Map<string, { name: string; transport: 'named-pipe' | 'unix-socket' | 'shared-memory'; queue: Buffer[] }>;
}

const createContextFactory = () => {
  let sequence = 0;
  return (permissions: string[]): RouteInvocationContext => {
    sequence += 1;
    return {
      requestId: `req-${sequence}`,
      timestamp: Date.now(),
      caller: {
        id: 'unit-test',
        type: 'service',
        permissions
      }
    };
  };
};

const createPal = (state: PalState): PALAdapter => {
  let ipcSequence = 0;
  const launchers = new Map<string, { pluginId: string; name: string; launcherPath: string; executablePath: string; args: string[]; iconPath?: string }>();

  return {
    window: {
      async create(options) {
        return {
          id: 'window-1',
          title: options.title,
          width: options.width,
          height: options.height,
          focused: false,
          state: 'normal'
        };
      },
      async focus() {},
      async resize() {},
      async setState() {},
      async getState() {
        return {
          id: 'window-1',
          title: 'Window',
          width: 800,
          height: 600,
          focused: false,
          state: 'normal'
        };
      },
      async close() {}
    },
    fs: {
      normalize: (inputPath) => path.normalize(inputPath),
      async readFile(inputPath, options) {
        if (options?.encoding) {
          return fs.readFile(inputPath, { encoding: options.encoding });
        }
        return fs.readFile(inputPath);
      },
      async writeFile(inputPath, data) {
        await fs.mkdir(path.dirname(inputPath), { recursive: true });
        await fs.writeFile(inputPath, data);
      },
      async stat(inputPath) {
        const stats = await fs.stat(inputPath);
        return {
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          size: stats.size,
          mtimeMs: stats.mtimeMs
        };
      },
      async list(inputPath) {
        return fs.readdir(inputPath);
      },
      async watch(_inputPath, _onEvent) {
        return {
          id: 'watch-1',
          async close() {}
        };
      },
      async exists(inputPath) {
        try {
          await fs.access(inputPath);
          return true;
        } catch {
          return false;
        }
      },
      async mkdir(inputPath, options) {
        await fs.mkdir(inputPath, { recursive: options?.recursive ?? true });
      },
      async delete(inputPath, options) {
        await fs.rm(inputPath, { recursive: options?.recursive ?? true, force: false });
      },
      async copy(source, destination, options) {
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.cp(source, destination, {
          recursive: true,
          force: options?.overwrite ?? true,
          errorOnExist: !(options?.overwrite ?? true),
        });
      },
      async move(source, destination, options) {
        try {
          await fs.access(destination);
          if (options?.overwrite ?? true) {
            await fs.rm(destination, { recursive: true, force: true });
          }
        } catch {}
        if (options?.overwrite === false) {
          try {
            await fs.access(destination);
            throw new Error(`Destination already exists: ${destination}`);
          } catch (error) {
            if (!(error instanceof Error) || !error.message.startsWith("Destination already exists:")) {
              // ignore access failures
            } else {
              throw error;
            }
          }
        }
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.rename(source, destination);
      }
    },
    dialog: {
      async openFile(options) {
        state.dialogOpenArgs.push(options ?? null);
        return ['/virtual/opened.txt'];
      },
      async saveFile(options) {
        state.dialogSaveArgs.push(options ?? null);
        return '/virtual/saved.txt';
      },
      async showMessage(options) {
        state.dialogMessageArgs.push(options);
        return 0;
      },
      async showConfirm(options) {
        state.dialogConfirmArgs.push(options);
        return true;
      }
    },
    clipboard: {
      async read(format = 'text') {
        if (format === 'image') {
          return {
            base64: state.clipboardImageBase64 ?? '',
            mimeType: 'image/png'
          };
        }
        if (format === 'files') {
          return [...state.clipboardFiles];
        }
        return state.clipboardText;
      },
      async write(data, format = 'text') {
        if (format === 'image' && typeof data === 'object' && data && 'base64' in data) {
          state.clipboardImageBase64 = String((data as { base64: unknown }).base64);
          return;
        }
        if (format === 'files' && Array.isArray(data)) {
          state.clipboardFiles = data.map((item) => String(item));
          return;
        }
        state.clipboardText = String(data);
      }
    },
    shell: {
      async openPath(targetPath) {
        state.shellOpenPath.push(targetPath);
      },
      async openExternal(url) {
        state.shellOpenExternal.push(url);
      },
      async showItemInFolder(targetPath) {
        state.shellShowInFolder.push(targetPath);
      }
    },
    platform: {
      async getInfo() {
        return {
          platform: process.platform,
          arch: process.arch,
          release: 'test'
        };
      },
      async getCapabilities() {
        return ['dialog', 'clipboard', 'shell', 'tray', 'notification', 'shortcut', 'power'];
      }
    },
    screen: {
      async getPrimary() {
        return {
          id: 'screen-1',
          width: 2560,
          height: 1440,
          scaleFactor: 2,
          x: 0,
          y: 0,
          primary: true
        };
      },
      async getAll() {
        return [
          {
            id: 'screen-1',
            width: 2560,
            height: 1440,
            scaleFactor: 2,
            x: 0,
            y: 0,
            primary: true
          }
        ];
      }
    },
    tray: {
      async set() {
        state.trayActive = true;
        return { active: true };
      },
      async clear() {
        state.trayActive = false;
      },
      async getState() {
        return { active: state.trayActive };
      }
    },
    notification: {
      async show(options) {
        state.notifications.push({ title: options.title, body: options.body });
      }
    },
    shortcut: {
      async register(accelerator) {
        if (!state.shortcuts.includes(accelerator)) {
          state.shortcuts.push(accelerator);
        }
        return true;
      },
      async unregister(accelerator) {
        state.shortcuts = state.shortcuts.filter((item) => item !== accelerator);
      },
      async isRegistered(accelerator) {
        return state.shortcuts.includes(accelerator);
      },
      async list() {
        return [...state.shortcuts];
      },
      async clear() {
        state.shortcuts = [];
      }
    },
    launcher: {
      async getDefaultPath(name) {
        const launcherPath = path.join(os.tmpdir(), 'chips-pal-launchers', `${name}.lnk`);
        return {
          launcherPath,
          location: 'desktop' as const
        };
      },
      async create(options) {
        const launcherPath = options.launcherPath ?? path.join(os.tmpdir(), 'chips-pal-launchers', `${options.name}.lnk`);
        await fs.mkdir(path.dirname(launcherPath), { recursive: true });
        await fs.writeFile(launcherPath, 'launcher', 'utf-8');
        const record = {
          pluginId: options.pluginId,
          name: options.name,
          location: 'desktop' as const,
          launcherPath,
          executablePath: options.executablePath,
          args: [...options.args],
          iconPath: options.iconPath
        };
        launchers.set(record.launcherPath, {
          pluginId: options.pluginId,
          name: options.name,
          launcherPath: record.launcherPath,
          executablePath: options.executablePath,
          args: [...options.args],
          iconPath: options.iconPath
        });
        return record;
      },
      async getRecord(options) {
        const launcherPath = options.launcherPath ?? path.join(os.tmpdir(), 'chips-pal-launchers', `${options.name}.lnk`);
        const existing = launchers.get(launcherPath);
        return {
          pluginId: existing?.pluginId ?? options.pluginId,
          name: existing?.name ?? options.name,
          location: 'desktop',
          launcherPath,
          executablePath: existing?.executablePath ?? '',
          args: existing?.args ?? [],
          iconPath: existing?.iconPath
        };
      },
      async remove(options) {
        const launcherPath = options.launcherPath ?? path.join(os.tmpdir(), 'chips-pal-launchers', `${options.name}.lnk`);
        const removed = launchers.delete(launcherPath);
        await fs.rm(launcherPath, { force: true });
        return {
          removed,
          launcherPath,
          location: 'desktop'
        };
      }
    },
    power: {
      async getState() {
        return {
          idleSeconds: 0,
          preventSleep: state.preventSleep
        };
      },
      async setPreventSleep(prevent) {
        state.preventSleep = prevent;
        return prevent;
      }
    },
    ipc: {
      async createChannel(options) {
        ipcSequence += 1;
        const channelId = `ipc-${ipcSequence}`;
        state.ipcChannels.set(channelId, {
          name: options.name,
          transport: options.transport,
          queue: []
        });
        return {
          channelId,
          name: options.name,
          transport: options.transport
        };
      },
      async send(channelId, payload) {
        const channel = state.ipcChannels.get(channelId);
        if (!channel) {
          throw new Error(`Missing channel: ${channelId}`);
        }
        channel.queue.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload, 'utf-8'));
      },
      async receive(channelId) {
        const channel = state.ipcChannels.get(channelId);
        if (!channel) {
          throw new Error(`Missing channel: ${channelId}`);
        }
        return {
          channelId,
          transport: channel.transport,
          payload: channel.queue.shift() ?? Buffer.from(''),
          receivedAt: Date.now()
        };
      },
      async closeChannel(channelId) {
        state.ipcChannels.delete(channelId);
      },
      async listChannels() {
        return [...state.ipcChannels.entries()].map(([channelId, channel]) => ({
          channelId,
          name: channel.name,
          transport: channel.transport
        }));
      }
    }
  };
};

describe('Host services PAL routing', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-host-pal-'));
  });

  afterEach(async () => {
    await fs.rm(workspace, { recursive: true, force: true });
  });

  it('forwards dialog routes to PAL dialog implementation', async () => {
    const state: PalState = {
      clipboardText: '',
      clipboardImageBase64: null,
      clipboardFiles: [],
      dialogOpenArgs: [],
      dialogSaveArgs: [],
      dialogMessageArgs: [],
      dialogConfirmArgs: [],
      shellOpenPath: [],
      shellOpenExternal: [],
      shellShowInFolder: [],
      notifications: [],
      trayActive: false,
      shortcuts: [],
      preventSleep: false,
      ipcChannels: new Map()
    };
    const kernel = new Kernel();
    const runtime = new PluginRuntime(workspace, { locale: 'zh-CN', themeId: 'chips-official.default-theme' });
    await runtime.load();
    registerHostSchemas();
    await registerHostServices({
      kernel,
      pal: createPal(state),
      workspacePath: workspace,
      logger: new StructuredLogger(),
      getCardService: () => new CardService(),
      getBoxService: () => new BoxService(),
      getZipService: () => new StoreZipService(),
      runtime
    });
    const context = createContextFactory();
    const platformRead = ['platform.read'];

    const opened = await kernel.invoke<{ options: { defaultPath: string } }, { filePaths: string[] | null }>(
      'platform.dialogOpenFile',
      { options: { defaultPath: '/tmp/demo.txt' } },
      context(platformRead)
    );
    const saved = await kernel.invoke<{ options: { defaultPath: string } }, { filePath: string | null }>(
      'platform.dialogSaveFile',
      { options: { defaultPath: '/tmp/output.txt' } },
      context(platformRead)
    );
    const message = await kernel.invoke<{ options: { message: string } }, { response: number }>(
      'platform.dialogShowMessage',
      { options: { message: 'hello' } },
      context(platformRead)
    );
    const confirm = await kernel.invoke<{ options: { message: string } }, { confirmed: boolean }>(
      'platform.dialogShowConfirm',
      { options: { message: 'ok?' } },
      context(platformRead)
    );

    expect(opened.filePaths).toEqual(['/virtual/opened.txt']);
    expect(saved.filePath).toBe('/virtual/saved.txt');
    expect(message.response).toBe(0);
    expect(confirm.confirmed).toBe(true);
    expect(state.dialogOpenArgs).toHaveLength(1);
    expect(state.dialogSaveArgs).toHaveLength(1);
    expect(state.dialogMessageArgs).toHaveLength(1);
    expect(state.dialogConfirmArgs).toHaveLength(1);
  });

  it('forwards extended file routes to PAL fs implementation', async () => {
    const state: PalState = {
      clipboardText: '',
      clipboardImageBase64: null,
      clipboardFiles: [],
      dialogOpenArgs: [],
      dialogSaveArgs: [],
      dialogMessageArgs: [],
      dialogConfirmArgs: [],
      shellOpenPath: [],
      shellOpenExternal: [],
      shellShowInFolder: [],
      notifications: [],
      trayActive: false,
      shortcuts: [],
      preventSleep: false,
      ipcChannels: new Map()
    };
    const kernel = new Kernel();
    const runtime = new PluginRuntime(workspace, { locale: 'zh-CN', themeId: 'chips-official.default-theme' });
    await runtime.load();
    registerHostSchemas();
    await registerHostServices({
      kernel,
      pal: createPal(state),
      workspacePath: workspace,
      logger: new StructuredLogger(),
      getCardService: () => new CardService(),
      getBoxService: () => new BoxService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const context = createContextFactory();
    const fileRead = ['file.read'];
    const fileManage = ['file.manage'];
    const sourceDir = path.join(workspace, 'source-dir');
    const sourceFile = path.join(sourceDir, 'demo.txt');
    const copiedFile = path.join(workspace, 'copies', 'demo.txt');
    const movedFile = path.join(workspace, 'moved', 'demo.txt');
    const createdDir = path.join(workspace, 'created');

    await fs.mkdir(sourceDir, { recursive: true });
    await fs.writeFile(sourceFile, 'demo', 'utf-8');

    await expect(kernel.invoke('file.exists', { path: sourceFile }, context(fileRead))).resolves.toEqual({ exists: true });
    await expect(
      kernel.invoke('file.mkdir', { path: createdDir, options: { recursive: true } }, context(fileManage))
    ).resolves.toEqual({ ack: true });
    await expect(
      kernel.invoke('file.copy', { source: sourceFile, destination: copiedFile }, context(fileManage))
    ).resolves.toEqual({ ack: true });
    await expect(
      kernel.invoke('file.move', { source: copiedFile, destination: movedFile }, context(fileManage))
    ).resolves.toEqual({ ack: true });
    await expect(
      kernel.invoke('file.delete', { path: movedFile }, context(fileManage))
    ).resolves.toEqual({ ack: true });

    await expect(fs.access(createdDir)).resolves.toBeUndefined();
    await expect(fs.readFile(sourceFile, 'utf-8')).resolves.toBe('demo');
    await expect(fs.access(copiedFile)).rejects.toBeDefined();
    await expect(fs.access(movedFile)).rejects.toBeDefined();
  });

  it('keeps interactive dialog routes open beyond the generic 2 second timeout window', async () => {
    const state: PalState = {
      clipboardText: '',
      clipboardImageBase64: null,
      clipboardFiles: [],
      dialogOpenArgs: [],
      dialogSaveArgs: [],
      dialogMessageArgs: [],
      dialogConfirmArgs: [],
      shellOpenPath: [],
      shellOpenExternal: [],
      shellShowInFolder: [],
      notifications: [],
      trayActive: false,
      shortcuts: [],
      preventSleep: false,
      ipcChannels: new Map()
    };
    const kernel = new Kernel();
    const runtime = new PluginRuntime(workspace, { locale: 'zh-CN', themeId: 'chips-official.default-theme' });
    await runtime.load();
    registerHostSchemas();

    const pal = createPal(state);
    pal.dialog.openFile = async (options) => {
      state.dialogOpenArgs.push(options ?? null);
      await new Promise((resolve) => setTimeout(resolve, 2_100));
      return ['/virtual/slow-opened.txt'];
    };
    pal.dialog.showConfirm = async (options) => {
      state.dialogConfirmArgs.push(options);
      await new Promise((resolve) => setTimeout(resolve, 2_100));
      return true;
    };

    await registerHostServices({
      kernel,
      pal,
      workspacePath: workspace,
      logger: new StructuredLogger(),
      getCardService: () => new CardService(),
      getBoxService: () => new BoxService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const context = createContextFactory();
    const platformRead = ['platform.read'];

    await expect(
      kernel.invoke<{ options: { title: string } }, { filePaths: string[] | null }>(
        'platform.dialogOpenFile',
        { options: { title: 'slow picker' } },
        context(platformRead)
      )
    ).resolves.toEqual({ filePaths: ['/virtual/slow-opened.txt'] });

    await expect(
      kernel.invoke<{ options: { message: string } }, { confirmed: boolean }>(
        'platform.dialogShowConfirm',
        { options: { message: 'confirm after wait' } },
        context(platformRead)
      )
    ).resolves.toEqual({ confirmed: true });
  });

  it('forwards clipboard and shell routes to PAL clipboard/shell implementation', async () => {
    const state: PalState = {
      clipboardText: '',
      clipboardImageBase64: null,
      clipboardFiles: [],
      dialogOpenArgs: [],
      dialogSaveArgs: [],
      dialogMessageArgs: [],
      dialogConfirmArgs: [],
      shellOpenPath: [],
      shellOpenExternal: [],
      shellShowInFolder: [],
      notifications: [],
      trayActive: false,
      shortcuts: [],
      preventSleep: false,
      ipcChannels: new Map()
    };
    const kernel = new Kernel();
    const runtime = new PluginRuntime(workspace, { locale: 'zh-CN', themeId: 'chips-official.default-theme' });
    await runtime.load();
    registerHostSchemas();
    await registerHostServices({
      kernel,
      pal: createPal(state),
      workspacePath: workspace,
      logger: new StructuredLogger(),
      getCardService: () => new CardService(),
      getBoxService: () => new BoxService(),
      getZipService: () => new StoreZipService(),
      runtime
    });
    const context = createContextFactory();
    const platformRead = ['platform.read'];
    const platformExternal = ['platform.external'];

    await kernel.invoke('platform.clipboardWrite', { data: 'chips-data', format: 'text' }, context(platformRead));
    const readBack = await kernel.invoke<{ format: 'text' }, { data: string }>(
      'platform.clipboardRead',
      { format: 'text' },
      context(platformRead)
    );
    await kernel.invoke(
      'platform.clipboardWrite',
      { data: { base64: Buffer.from('image-data').toString('base64') }, format: 'image' },
      context(platformRead)
    );
    await kernel.invoke(
      'platform.clipboardWrite',
      { data: ['/tmp/chips/a.txt', '/tmp/chips/b.txt'], format: 'files' },
      context(platformRead)
    );
    const fileClipboard = await kernel.invoke<{ format: 'files' }, { data: string[] }>(
      'platform.clipboardRead',
      { format: 'files' },
      context(platformRead)
    );

    await kernel.invoke('platform.shellOpenPath', { path: '/tmp/chips/a.txt' }, context(platformExternal));
    await kernel.invoke('platform.shellOpenExternal', { url: 'https://chips.example' }, context(platformExternal));
    await kernel.invoke('platform.shellShowItemInFolder', { path: '/tmp/chips/a.txt' }, context(platformExternal));
    await kernel.invoke('platform.openExternal', { url: 'https://chips.example/platform' }, context(platformExternal));
    const primaryScreen = await kernel.invoke<Record<string, unknown>, { screen: { id: string } }>(
      'platform.getScreenInfo',
      {},
      context(platformRead)
    );
    const allScreens = await kernel.invoke<Record<string, unknown>, { screens: Array<{ id: string }> }>(
      'platform.listScreens',
      {},
      context(platformRead)
    );
    await kernel.invoke('platform.notificationShow', { options: { title: 'chips', body: 'ready' } }, context(platformRead));
    await kernel.invoke('platform.traySet', { options: { tooltip: 'chips' } }, context(platformExternal));
    await kernel.invoke('platform.shortcutRegister', { accelerator: 'CommandOrControl+Shift+N' }, context(platformExternal));
    await kernel.invoke('platform.powerSetPreventSleep', { prevent: true }, context(platformExternal));
    const createdChannel = await kernel.invoke<
      { name: string; transport: 'shared-memory' },
      { channel: { channelId: string } }
    >('platform.ipcCreateChannel', { name: 'chips-test', transport: 'shared-memory' }, context(platformExternal));
    await kernel.invoke(
      'platform.ipcSend',
      { channelId: createdChannel.channel.channelId, payload: Buffer.from('hello-ipc').toString('base64'), encoding: 'base64' },
      context(platformExternal)
    );
    const received = await kernel.invoke<
      { channelId: string },
      { message: { payload: string; encoding: string; transport: string } }
    >('platform.ipcReceive', { channelId: createdChannel.channel.channelId }, context(platformRead));
    const listed = await kernel.invoke<Record<string, unknown>, { channels: Array<{ channelId: string }> }>(
      'platform.ipcListChannels',
      {},
      context(platformRead)
    );
    await kernel.invoke('platform.ipcCloseChannel', { channelId: createdChannel.channel.channelId }, context(platformExternal));

    expect(readBack.data).toBe('chips-data');
    expect(fileClipboard.data).toEqual(['/tmp/chips/a.txt', '/tmp/chips/b.txt']);
    expect(state.shellOpenPath).toEqual(['/tmp/chips/a.txt']);
    expect(state.shellShowInFolder).toEqual(['/tmp/chips/a.txt']);
    expect(state.shellOpenExternal).toEqual(['https://chips.example', 'https://chips.example/platform']);
    expect(primaryScreen.screen.id).toBe('screen-1');
    expect(allScreens.screens).toHaveLength(1);
    expect(state.notifications).toEqual([{ title: 'chips', body: 'ready' }]);
    expect(state.trayActive).toBe(true);
    expect(state.shortcuts).toContain('CommandOrControl+Shift+N');
    expect(state.preventSleep).toBe(true);
    expect(Buffer.from(received.message.payload, 'base64').toString('utf-8')).toBe('hello-ipc');
    expect(received.message.encoding).toBe('base64');
    expect(received.message.transport).toBe('shared-memory');
    expect(listed.channels.map((item) => item.channelId)).toContain(createdChannel.channel.channelId);
  });

  it('creates plugin shortcuts and launches app plugins through formal routes', async () => {
    const state: PalState = {
      clipboardText: '',
      clipboardImageBase64: null,
      clipboardFiles: [],
      dialogOpenArgs: [],
      dialogSaveArgs: [],
      dialogMessageArgs: [],
      dialogConfirmArgs: [],
      shellOpenPath: [],
      shellOpenExternal: [],
      shellShowInFolder: [],
      notifications: [],
      trayActive: false,
      shortcuts: [],
      preventSleep: false,
      ipcChannels: new Map()
    };
    const pluginRoot = path.join(workspace, 'launch-plugin');
    await fs.mkdir(path.join(pluginRoot, 'dist'), { recursive: true });
    await fs.mkdir(path.join(pluginRoot, 'assets', 'icons'), { recursive: true });
    await fs.writeFile(path.join(pluginRoot, 'dist', 'index.html'), '<!doctype html><title>Launch App</title>', 'utf-8');
    await fs.writeFile(path.join(pluginRoot, 'assets', 'icons', 'app-icon.ico'), 'icon-binary', 'utf-8');
    await fs.writeFile(path.join(pluginRoot, 'assets', 'icons', 'app-icon.icns'), 'icon-binary-icns', 'utf-8');
    await fs.writeFile(
      path.join(pluginRoot, 'manifest.yaml'),
      [
        'id: chips.launch.app',
        'version: 1.0.0',
        'type: app',
        'name: Launch App',
        'entry: dist/index.html',
        'ui:',
        '  launcher:',
        '    displayName: Launch App',
        '    icon: assets/icons/app-icon.ico',
        'permissions:',
        '  - plugin.manage',
        ''
      ].join('\n'),
      'utf-8'
    );

    const kernel = new Kernel();
    const runtime = new PluginRuntime(workspace, { locale: 'zh-CN', themeId: 'chips-official.default-theme' });
    await runtime.load();
    registerHostSchemas();
    await registerHostServices({
      kernel,
      pal: createPal(state),
      workspacePath: workspace,
      logger: new StructuredLogger(),
      getCardService: () => new CardService(),
      getBoxService: () => new BoxService(),
      getZipService: () => new StoreZipService(),
      runtime
    });
    const context = createContextFactory();
    const manageContext = context(['plugin.manage', 'plugin.read']);

    const installed = await kernel.invoke<{ manifestPath: string }, { pluginId: string }>(
      'plugin.install',
      { manifestPath: path.join(pluginRoot, 'manifest.yaml') },
      manageContext
    );
    await kernel.invoke('plugin.enable', { pluginId: installed.pluginId }, manageContext);

    const createdShortcut = await kernel.invoke<
      { pluginId: string; replace?: boolean },
      { shortcut: { exists: boolean; launcherPath: string; iconPath?: string } }
    >('plugin.createShortcut', { pluginId: installed.pluginId }, manageContext);
    const queriedShortcut = await kernel.invoke<
      { pluginId: string },
      { shortcut: { exists: boolean; launcherPath: string } }
    >('plugin.getShortcut', { pluginId: installed.pluginId }, context(['plugin.read']));
    const launched = await kernel.invoke<
      { pluginId: string; launchParams: Record<string, unknown> },
      { window: { id: string }; session: { sessionId: string } }
    >(
      'plugin.launch',
      {
        pluginId: installed.pluginId,
        launchParams: {
          targetPath: '/tmp/demo.card',
          trigger: 'unit-test'
        }
      },
      manageContext
    );

    expect(createdShortcut.shortcut.exists).toBe(true);
    expect(createdShortcut.shortcut.launcherPath).toContain('Launch App');
    expect(createdShortcut.shortcut.iconPath).toContain(path.join('assets', 'icons'));
    expect(createdShortcut.shortcut.iconPath).toMatch(
      process.platform === 'darwin' ? /app-icon\.icns$/ : /app-icon\.ico$/
    );
    expect(queriedShortcut.shortcut.exists).toBe(true);
    expect(launched.window.id).toBe('window-1');
    expect(launched.session.sessionId).toBeTypeOf('string');
  });
});
