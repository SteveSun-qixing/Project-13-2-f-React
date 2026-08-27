import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Kernel } from '../../packages/kernel/src';
import type { PALAdapter } from '../../packages/pal/src';
import { BoxService, BoxSessionService } from '../../packages/box-service/src';
import { WorkspaceService } from '../../packages/workspace-service/src';
import { CardInfoService } from '../../packages/card-info-service/src';
import { CardService, CardSessionService } from '../../packages/card-service/src';
import { StoreZipService } from '../../packages/zip-service/src';
import { PluginRuntime } from '../../src/runtime';
import { StructuredLogger } from '../../src/shared/logger';
import type { RouteInvocationContext } from '../../src/shared/types';
import { registerHostSchemas } from '../../src/main/services/register-schemas';
import {
  registerHostServices,
  shouldPassAppEntryArgument
} from '../../src/main/services/register-host-services';

interface PalState {
  clipboardText: string;
  clipboardImageBase64: string | null;
  clipboardFiles: string[];
  imageConversions: Array<{ sourceFile: string; outputFile: string; overwrite?: boolean }>;
  videoFrameExtractions: Array<{ videoFile: string; outputFile: string; overwrite?: boolean; options?: unknown }>;
  windowCreateArgs: unknown[];
  surfaces: Map<string, Awaited<ReturnType<PALAdapter['surface']['open']>>>;
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

const createPalState = (): PalState => ({
  clipboardText: '',
  clipboardImageBase64: null,
  clipboardFiles: [],
  imageConversions: [],
  videoFrameExtractions: [],
  windowCreateArgs: [],
  surfaces: new Map(),
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
});

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

  const capabilitySnapshot: Awaited<ReturnType<PALAdapter['environment']['getCapabilities']>> = {
    hostKind: 'desktop',
    platform: process.platform as any,
    facets: {
      surface: {
        supported: true,
        interactive: true,
        supportedKinds: ['window']
      },
      storage: {
        localWorkspace: true,
        sandboxFilePicker: false,
        remoteBacked: false
      },
      selection: {
        openFile: true,
        saveFile: true,
        directory: true,
        multiple: true
      },
      transfer: {
        upload: false,
        download: true,
        share: false,
        externalOpen: true,
        revealInShell: true
      },
      association: {
        fileAssociation: true,
        urlScheme: true,
        shareTarget: false
      },
      device: {
        screen: true,
        power: true,
        network: false
      },
      systemUi: {
        clipboard: true,
        tray: true,
        globalShortcut: true,
        notification: true
      },
      background: {
        keepAlive: true,
        wakeEvents: true
      },
      ipc: {
        namedPipe: true,
        unixSocket: process.platform !== 'win32',
        sharedMemory: true
      },
      offscreenRender: {
        htmlToPdf: true,
        htmlToImage: true,
        videoFrame: true
      }
    }
  } as const;

  const windowManager: PALAdapter['window'] = {
    async create(options) {
      state.windowCreateArgs.push(options);
      return {
        id: 'window-1',
        kind: 'window' as const,
        title: options.title,
        width: options.width,
        height: options.height,
        focused: false,
        state: 'normal' as const,
        url: options.url,
        pluginId: options.pluginId,
        sessionId: options.sessionId,
        chrome: options.chrome
      };
    },
    async focus() { },
    async resize() { },
    async setState() { },
    async getState() {
      return {
        id: 'window-1',
        kind: 'window' as const,
        title: 'Window',
        width: 800,
        height: 600,
        focused: false,
        state: 'normal' as const
      };
    },
    async close() { },
    async list() {
      return [await this.getState('window-1')];
    }
  };

  const storage: PALAdapter['storage'] = {
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
          async close() { }
        };
      },
      async mkdir(inputPath) {
        await fs.mkdir(inputPath, { recursive: true });
      },
      async delete(inputPath, options) {
        const stats = await fs.stat(inputPath);
        if (stats.isDirectory()) {
          await fs.rm(inputPath, { recursive: options?.recursive ?? false });
        } else {
          await fs.unlink(inputPath);
        }
      },
      async move(sourcePath, destPath) {
        await fs.rename(sourcePath, destPath);
      },
      async copy(sourcePath, destPath) {
        const stats = await fs.stat(sourcePath);
        if (stats.isDirectory()) {
          await fs.cp(sourcePath, destPath, { recursive: true });
        } else {
          await fs.copyFile(sourcePath, destPath);
        }
      }
    };

  const selection: PALAdapter['selection'] = {
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
    };

  const clipboard: PALAdapter['clipboard'] = {
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
    };

  const shell: PALAdapter['shell'] = {
      async openPath(targetPath) {
        state.shellOpenPath.push(targetPath);
      },
      async openExternal(url) {
        state.shellOpenExternal.push(url);
      },
      async showItemInFolder(targetPath) {
        state.shellShowInFolder.push(targetPath);
      }
    };

  const transfer: PALAdapter['transfer'] = {
    async openPath(targetPath: string) {
      await shell.openPath(targetPath);
    },
    async openExternal(url: string) {
      await shell.openExternal(url);
    },
    async revealInShell(targetPath: string) {
      await shell.showItemInFolder(targetPath);
    },
    async share() {
      return { shared: false };
    }
  };

  const environment: PALAdapter['environment'] = {
    async getInfo() {
      return {
        hostKind: 'desktop' as const,
        platform: process.platform as any,
        arch: process.arch,
        release: 'test'
      };
    },
    async getCapabilities() {
      return capabilitySnapshot;
    }
  };

  const platform: PALAdapter['platform'] = {
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
    };

  const screen: PALAdapter['screen'] = {
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
    };

  const tray: PALAdapter['tray'] = {
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
    };

  const notification: PALAdapter['notification'] = {
      async show(options) {
        state.notifications.push({ title: options.title, body: options.body });
      }
    };

  const shortcut: PALAdapter['shortcut'] = {
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
    };

  const power: PALAdapter['power'] = {
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
    };

  const device: PALAdapter['device'] = {
    async getPrimaryScreen() {
      return screen.getPrimary();
    },
    async getAllScreens() {
      return screen.getAll();
    },
    async getPowerState() {
      return power.getState();
    }
  };

  const systemUi: PALAdapter['systemUi'] = {
    clipboard,
    tray,
    notification,
    shortcut
  };

  const background: PALAdapter['background'] = {
    async getState() {
      return power.getState();
    },
    async setPreventSleep(prevent: boolean) {
      return power.setPreventSleep(prevent);
    }
  };

  const association: PALAdapter['association'] = {
    async getCapabilities() {
      return capabilitySnapshot.facets.association;
    }
  };

  const surface: PALAdapter['surface'] = {
    async open(request) {
      const created = await windowManager.create({
        title: request.presentation?.title ?? 'Surface',
        width: request.presentation?.width ?? 800,
        height: request.presentation?.height ?? 600,
        resizable: request.presentation?.resizable,
        alwaysOnTop: request.presentation?.alwaysOnTop,
        url:
          request.target.type === 'url'
            ? request.target.url
            : request.target.type === 'plugin'
              ? request.target.url
              : request.target.url,
        pluginId: request.target.type === 'plugin' ? request.target.pluginId : undefined,
        sessionId: request.target.type === 'plugin' ? request.target.sessionId : undefined,
        permissions: request.target.type === 'plugin' ? request.target.permissions : undefined,
        launchParams: request.target.type === 'plugin' ? request.target.launchParams : undefined,
        surfaceContext: request.context,
        chrome: request.presentation?.chrome
      });
      const surfaceState = {
        ...created,
        context: request.context
          ? {
              ...request.context,
              surfaceId: created.id,
              kind: created.kind
            }
          : undefined,
        metadata: request.kind && request.kind !== 'window' ? { requestedKind: request.kind } : undefined
      };
      state.surfaces.set(surfaceState.id, surfaceState);
      return surfaceState;
    },
    async focus(id: string) {
      await windowManager.focus(id);
      const surfaceState = state.surfaces.get(id);
      if (surfaceState) {
        surfaceState.focused = true;
      }
    },
    async resize(id: string, width: number, height: number) {
      await windowManager.resize(id, width, height);
      const surfaceState = state.surfaces.get(id);
      if (surfaceState) {
        surfaceState.width = width;
        surfaceState.height = height;
      }
    },
    async setState(id: string, currentState: 'normal' | 'minimized' | 'maximized' | 'fullscreen' | 'hidden') {
      await windowManager.setState(id, currentState === 'hidden' ? 'normal' : currentState);
      const surfaceState = state.surfaces.get(id);
      if (surfaceState) {
        surfaceState.state = currentState;
      }
    },
    async getState(id: string) {
      const surfaceState = state.surfaces.get(id);
      if (surfaceState) {
        return surfaceState;
      }
      return windowManager.getState(id);
    },
    async close(id: string) {
      await windowManager.close(id);
      state.surfaces.delete(id);
    },
    async list() {
      return [...state.surfaces.values()];
    }
  };

  const offscreenRender: PALAdapter['offscreenRender'] = {
    async renderHtmlToPdf(input) {
      return {
        outputFile: input.outputFile,
        pageCount: 1
      };
    },
    async renderHtmlToImage(input) {
      return {
        outputFile: input.outputFile,
        width: input.options?.width,
        height: input.options?.height,
        format: input.options?.format ?? 'png'
      };
    },
    async extractVideoFrame(input) {
      state.videoFrameExtractions.push({
        videoFile: input.videoFile,
        outputFile: input.outputFile,
        overwrite: input.overwrite,
        options: input.options
      });
      return {
        outputFile: input.outputFile,
        width: input.options?.width ?? 1280,
        height: input.options?.height ?? 720,
        format: input.options?.format ?? 'png',
        mimeType: input.options?.format === 'jpeg' ? 'image/jpeg' : 'image/png',
        frameTimeSeconds: input.options?.timeSeconds ?? 0,
        durationSeconds: 12
      };
    }
  };

  const image: PALAdapter['image'] = {
    async convertTiffToPng(input) {
      state.imageConversions.push({
        sourceFile: input.sourceFile,
        outputFile: input.outputFile,
        overwrite: input.overwrite
      });
      return {
        outputFile: input.outputFile,
        width: 64,
        height: 64,
        format: 'png'
      };
    }
  };

  const ipc: PALAdapter['ipc'] = {
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
    };

  const launcher: PALAdapter['launcher'] = {
    async getDefaultPath(name) {
      return {
        launcherPath: path.join(os.tmpdir(), `${name}.desktop`),
        location: 'desktop'
      };
    },
    async create(options) {
      return {
        pluginId: options.pluginId,
        name: options.name,
        location: 'desktop',
        launcherPath: options.launcherPath ?? path.join(os.tmpdir(), `${options.name}.desktop`),
        executablePath: options.executablePath,
        args: [...options.args],
        iconPath: options.iconPath
      };
    },
    async getRecord(options) {
      return {
        pluginId: options.pluginId,
        name: options.name,
        location: 'desktop',
        launcherPath: options.launcherPath ?? path.join(os.tmpdir(), `${options.name}.desktop`),
        executablePath: '',
        args: []
      };
    },
    async remove(options) {
      return {
        removed: true,
        launcherPath: options.launcherPath ?? path.join(os.tmpdir(), `${options.name}.desktop`),
        location: 'desktop'
      };
    }
  };

  return {
    environment,
    surface,
    storage,
    selection,
    transfer,
    association,
    device,
    systemUi,
    background,
    offscreenRender,
    image,
    launcher,
    window: windowManager,
    fs: storage,
    dialog: selection,
    clipboard,
    shell,
    platform,
    screen,
    tray,
    notification,
    shortcut,
    power,
    ipc
  };
};

const createCardInfoService = (): CardInfoService => {
  const cardService = new CardService();
  return new CardInfoService({
    validate: (cardFile) => cardService.validate(cardFile),
    readMetadata: (cardFile) => cardService.readMetadata(cardFile),
    renderCover: (cardFile) => cardService.renderCover(cardFile)
  });
};

const createBoxSessionService = (): BoxSessionService => {
  return new BoxSessionService(
    {
      pack: async () => {},
      unpack: async () => {},
      inspect: async () => ({
        metadata: {
          chipStandardsVersion: '1.0.0',
          boxId: 'box-1',
          name: 'test',
          createdAt: '2026-01-01T00:00:00.000Z',
          modifiedAt: '2026-01-01T00:00:00.000Z',
          activeLayoutType: 'chips.layout.grid',
        },
        content: { activeLayoutType: 'chips.layout.grid', layoutConfigs: {} },
        entries: [],
        assets: [],
      }),
      layout: {
        readDescriptor: async () => ({ defaultConfig: {} }),
        normalizeConfig: async (_layoutType, config) => config,
      },
      documentInfo: {
        readCardInfo: async () => ({ ready: true }),
        readBoxMetadata: async () => ({ boxId: 'box-1', name: 'test' }),
      },
      createDefaultCoverHtml: (name) => `<!doctype html><html><body>${name}</body></html>`,
    },
    { emit: () => undefined },
  );
};

const createCardSessionService = (): CardSessionService => {
  return new CardSessionService(
    {
      basecard: {
        normalizeConfig: (_cardType, baseCardId, config) => ({ ...config, id: baseCardId }),
        collectResourcePaths: () => [],
        createInitialConfig: (_cardType, baseCardId) => ({ id: baseCardId }),
      },
      collectCoverReferences: () => new Set<string>(),
      createDefaultCoverHtml: (name) => `<!doctype html><html><body>${name}</body></html>`,
    },
    { emit: () => undefined },
  );
};

describe('Host services PAL routing', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-host-pal-'));
  });

  afterEach(async () => {
    await fs.rm(workspace, { recursive: true, force: true });
  });

  it('only passes app-entry.js for default-app style launches', () => {
    expect(shouldPassAppEntryArgument('/Applications/Chips.app/Contents/MacOS/Chips', false)).toBe(false);
    expect(shouldPassAppEntryArgument('/usr/local/bin/node', false)).toBe(true);
    expect(shouldPassAppEntryArgument('/Applications/Electron.app/Contents/MacOS/Electron', true)).toBe(true);
  });

  it('forwards dialog routes to PAL dialog implementation', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });
    const context = createContextFactory();
    const platformRead = ['platform.read'];

    const opened = await kernel.invoke<
      { options: { defaultPath: string; mode: 'file-or-directory'; filters: Array<{ name: string; extensions: string[] }> } },
      { filePaths: string[] | null }
    >(
      'platform.dialogOpenFile',
      {
        options: {
          defaultPath: '/tmp/demo.txt',
          mode: 'file-or-directory',
          filters: [{ name: 'Text', extensions: ['txt'] }]
        }
      },
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
    expect(state.dialogOpenArgs[0]).toEqual({
      defaultPath: '/tmp/demo.txt',
      mode: 'file-or-directory',
      filters: [{ name: 'Text', extensions: ['txt'] }]
    });
    expect(state.dialogSaveArgs).toHaveLength(1);
    expect(state.dialogMessageArgs).toHaveLength(1);
    expect(state.dialogConfirmArgs).toHaveLength(1);
  });

  it('keeps interactive dialog routes open beyond the generic 2 second timeout window', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
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
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
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

  it('routes resource.convertTiffToPng through the PAL image conversion capability', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const sourceFile = path.join(workspace, 'cover.tiff');
    const outputFile = path.join(workspace, 'cover.png');
    await fs.writeFile(sourceFile, Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]));

    const context = createContextFactory();
    const result = await kernel.invoke<
      { resourceId: string; outputFile: string; overwrite?: boolean },
      { outputFile: string; mimeType: 'image/png'; sourceMimeType: 'image/tiff'; width?: number; height?: number }
    >(
      'resource.convertTiffToPng',
      {
        resourceId: sourceFile,
        outputFile,
        overwrite: true
      },
      context(['resource.read', 'file.read', 'file.write'])
    );

    expect(result).toEqual({
      outputFile,
      mimeType: 'image/png',
      sourceMimeType: 'image/tiff',
      width: 64,
      height: 64
    });
    expect(state.imageConversions).toEqual([
      {
        sourceFile,
        outputFile,
        overwrite: true
      }
    ]);
  });

  it('routes resource.extractVideoFrame through the PAL offscreen video frame capability', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const sourceFile = path.join(workspace, 'demo.mp4');
    const outputFile = path.join(workspace, 'demo-poster.png');
    await fs.writeFile(sourceFile, Buffer.from([
      0x00, 0x00, 0x00, 0x18,
      0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6f, 0x6d,
      0x00, 0x00, 0x02, 0x00
    ]));

    const context = createContextFactory();
    const result = await kernel.invoke<
      {
        resourceId: string;
        outputFile: string;
        overwrite?: boolean;
        options?: { timeSeconds?: number; format?: 'png'; width?: number; height?: number; fit?: 'cover' };
      },
      {
        outputFile: string;
        mimeType: 'image/png';
        sourceMimeType: string;
        width: number;
        height: number;
        format: 'png';
        frameTimeSeconds: number;
        durationSeconds?: number;
      }
    >(
      'resource.extractVideoFrame',
      {
        resourceId: sourceFile,
        outputFile,
        overwrite: true,
        options: {
          timeSeconds: 1.5,
          format: 'png',
          width: 640,
          height: 360,
          fit: 'cover'
        }
      },
      context(['resource.read', 'file.read', 'file.write'])
    );

    expect(result).toEqual({
      outputFile,
      mimeType: 'image/png',
      sourceMimeType: 'video/mp4',
      width: 640,
      height: 360,
      format: 'png',
      frameTimeSeconds: 1.5,
      durationSeconds: 12
    });
    expect(state.videoFrameExtractions).toEqual([
      {
        videoFile: sourceFile,
        outputFile,
        overwrite: true,
        options: {
          timeSeconds: 1.5,
          format: 'png',
          width: 640,
          height: 360,
          fit: 'cover'
        }
      }
    ]);
  });

  it('normalizes unsupported video frame source URIs with the video error namespace', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const context = createContextFactory();
    await expect(
      kernel.invoke(
        'resource.extractVideoFrame',
        {
          resourceId: 'https://example.test/demo.mp4',
          outputFile: path.join(workspace, 'demo-poster.png')
        },
        context(['resource.read', 'file.read', 'file.write'])
      )
    ).rejects.toMatchObject({
      code: 'RESOURCE_VIDEO_FRAME_UNSUPPORTED_URI'
    });
    expect(state.videoFrameExtractions).toEqual([]);
  });

  it('injects the current Host workspace into app launch params when opening a plugin window', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const manifestPath = path.join(workspace, 'launchable.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.launchable.plugin',
          version: '1.0.0',
          type: 'app',
          name: 'Launchable Plugin',
          permissions: ['file.read'],
          entry: 'dist/index.html',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: false }
            }
          },
          ui: {
            surface: {
              defaultKind: 'window',
              preferredKinds: {
                desktop: 'window',
                web: 'route',
                mobile: 'fullscreen',
                headless: 'window'
              }
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.html'), '<!doctype html><title>plugin</title>', 'utf-8');
    await runtime.install(manifestPath);
    await runtime.enable('chips.launchable.plugin');

    const context = createContextFactory();
    const launched = await kernel.invoke<
      { pluginId: string; launchParams: Record<string, unknown> },
      { window: { id: string }; session: { sessionId: string; permissions: string[] } }
    >(
      'plugin.launch',
      {
        pluginId: 'chips.launchable.plugin',
        launchParams: {
          source: 'card-box-library'
        }
      },
      context(['plugin.manage'])
    );

    expect(launched.window.id).toBe('window-1');
    expect(launched.session.permissions).toEqual(['file.read']);
    expect(state.windowCreateArgs).toHaveLength(1);
    expect(state.windowCreateArgs[0]).toEqual(
      expect.objectContaining({
        pluginId: 'chips.launchable.plugin',
        surfaceContext: expect.objectContaining({
          pluginId: 'chips.launchable.plugin',
          sessionId: launched.session.sessionId,
          kind: 'window'
        }),
        launchParams: expect.objectContaining({
          source: 'card-box-library',
          workspacePath: workspace
        })
      })
    );
  });

  it('opens app plugins through surface.open with a managed plugin session', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const manifestPath = path.join(workspace, 'surface-launchable.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.surface.launchable.plugin',
          version: '1.0.0',
          type: 'app',
          name: 'Surface Launchable Plugin',
          permissions: ['file.read'],
          entry: 'dist/index.html',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: false }
            }
          },
          ui: {
            launcher: {
              displayName: 'Surface Launchable'
            },
            surface: {
              defaultKind: 'window',
              preferredKinds: {
                desktop: 'window',
                web: 'route',
                mobile: 'fullscreen',
                headless: 'window'
              }
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.html'), '<!doctype html><title>surface-plugin</title>', 'utf-8');
    await runtime.install(manifestPath);
    await runtime.enable('chips.surface.launchable.plugin');

    const emittedEvents: Array<{ name: string; data: unknown }> = [];
    const disposeEvents = kernel.events.on('*', (event) => {
      emittedEvents.push({ name: event.name, data: event.data });
    });
    const context = createContextFactory();
    try {
      const opened = await kernel.invoke<
        {
          request: {
            kind: 'route';
            target: { type: 'plugin'; pluginId: string; launchParams: Record<string, unknown> };
            presentation: { title: string; width: number; height: number; resizable: boolean };
          };
        },
        {
      surface: {
        id: string;
        pluginId?: string;
        sessionId?: string;
        context?: {
          surfaceId?: string;
          sceneId: string;
          pluginId?: string;
          sessionId?: string;
          kind: string;
          presentation: { title?: string; width?: number; height?: number; resizable?: boolean };
          launchParams?: Record<string, unknown>;
        };
        metadata?: Record<string, unknown>;
      };
        }
      >(
        'surface.open',
        {
          request: {
            kind: 'route',
            target: {
              type: 'plugin',
              pluginId: 'chips.surface.launchable.plugin',
              launchParams: {
                source: 'surface.open'
              }
            },
            presentation: {
              title: 'Surface Launch Title',
              width: 1440,
              height: 900,
              resizable: false
            }
          }
        },
        context(['window.control', 'plugin.manage'])
      );

      expect(opened.surface.id).toBe('window-1');
      expect(opened.surface.pluginId).toBe('chips.surface.launchable.plugin');
      expect(opened.surface.sessionId).toBeTruthy();
      expect(opened.surface.context).toEqual(
        expect.objectContaining({
          surfaceId: 'window-1',
          pluginId: 'chips.surface.launchable.plugin',
          sessionId: opened.surface.sessionId,
          kind: 'window',
          presentation: expect.objectContaining({
            title: 'Surface Launch Title',
            width: 1440,
            height: 900,
            resizable: false
          }),
          launchParams: expect.objectContaining({
            source: 'surface.open',
            workspacePath: workspace
          })
        })
      );
      expect(opened.surface.metadata).toEqual(
        expect.objectContaining({
          requestedKind: 'route',
          sceneId: opened.surface.context?.sceneId
        })
      );
      expect(state.windowCreateArgs).toHaveLength(1);
      expect(state.windowCreateArgs[0]).toEqual(
        expect.objectContaining({
          title: 'Surface Launch Title',
          width: 1440,
          height: 900,
          resizable: false,
          pluginId: 'chips.surface.launchable.plugin',
          surfaceContext: expect.objectContaining({
            sceneId: opened.surface.context?.sceneId,
            pluginId: 'chips.surface.launchable.plugin',
            sessionId: opened.surface.sessionId,
            kind: 'route'
          }),
          launchParams: expect.objectContaining({
            source: 'surface.open',
            workspacePath: workspace
          })
        })
      );
      const snapshot = runtime.snapshot();
      expect(snapshot.sessions).toHaveLength(1);
      expect(snapshot.sessions[0]?.sessionId).toBe(opened.surface.sessionId);
      expect(snapshot.sessions[0]?.status).toBe('running');
      expect(emittedEvents.map((event) => event.name)).toEqual(
        expect.arrayContaining(['scene.created', 'scene.active', 'surface.opened', 'window.opened', 'plugin.launched'])
      );
      expect(emittedEvents.find((event) => event.name === 'plugin.launched')?.data).toEqual(
        expect.objectContaining({
          pluginId: 'chips.surface.launchable.plugin',
          sessionId: opened.surface.sessionId,
          sceneId: opened.surface.context?.sceneId,
          surfaceId: opened.surface.id,
          surfaceKind: 'window'
        })
      );

      emittedEvents.length = 0;
      await kernel.invoke('surface.focus', { surfaceId: opened.surface.id }, context(['window.control']));
      await kernel.invoke(
        'surface.resize',
        { surfaceId: opened.surface.id, width: 1200, height: 760 },
        context(['window.control'])
      );
      await kernel.invoke('surface.close', { surfaceId: opened.surface.id }, context(['window.control']));
      expect(emittedEvents.map((event) => event.name)).toEqual(
        expect.arrayContaining(['surface.focused', 'surface.resized', 'surface.closed', 'scene.inactive', 'scene.closed'])
      );
      expect(runtime.snapshot().sessions).toHaveLength(0);
    } finally {
      disposeEvents();
    }
  });

  it('requires plugin.manage when surface.open targets a plugin surface', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const manifestPath = path.join(workspace, 'surface-permission.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.surface.permission.plugin',
          version: '1.0.0',
          type: 'app',
          name: 'Surface Permission Plugin',
          permissions: ['file.read'],
          entry: 'dist/index.html',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: false }
            }
          },
          ui: {
            surface: {
              defaultKind: 'window',
              preferredKinds: {
                desktop: 'window',
                web: 'route',
                mobile: 'fullscreen',
                headless: 'window'
              }
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.html'), '<!doctype html><title>permission-plugin</title>', 'utf-8');
    await runtime.install(manifestPath);
    await runtime.enable('chips.surface.permission.plugin');

    const context = createContextFactory();
    await expect(
      kernel.invoke(
        'surface.open',
        {
          request: {
            target: {
              type: 'plugin',
              pluginId: 'chips.surface.permission.plugin'
            }
          }
        },
        context(['window.control'])
      )
    ).rejects.toMatchObject({
      code: 'PERMISSION_DENIED'
    });

    expect(state.windowCreateArgs).toHaveLength(0);
    expect(runtime.snapshot().sessions).toHaveLength(0);
  });

  it('returns a readable shortcut permission error when macOS launchpad directory is not writable', async () => {
    const state = createPalState();
    const kernel = new Kernel();
    const runtime = new PluginRuntime(workspace, { locale: 'zh-CN', themeId: 'chips-official.default-theme' });
    await runtime.load();
    registerHostSchemas();

    const pal = createPal(state);
    pal.launcher = {
      async getDefaultPath(name) {
        return {
          launcherPath: `/Users/steve/Applications/Chips Apps/${name}.app`,
          location: 'launchpad'
        };
      },
      async create() {
        throw {
          errno: -13,
          code: 'EACCES',
          syscall: 'mkdir',
          path: '/Users/steve/Applications/Chips Apps/Card Viewer.app'
        };
      },
      async getRecord(options) {
        return {
          pluginId: options.pluginId,
          name: options.name,
          location: 'launchpad',
          launcherPath: options.launcherPath ?? `/Users/steve/Applications/Chips Apps/${options.name}.app`,
          executablePath: '',
          args: []
        };
      },
      async remove(options) {
        return {
          removed: true,
          launcherPath: options.launcherPath ?? `/Users/steve/Applications/Chips Apps/${options.name}.app`,
          location: 'launchpad'
        };
      }
    };

    await registerHostServices({
      kernel,
      pal,
      workspacePath: workspace,
      logger: new StructuredLogger(),
      getCardService: () => new CardService(),
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const manifestPath = path.join(workspace, 'shortcut-app.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.shortcut.app',
          version: '1.0.0',
          type: 'app',
          name: 'Card Viewer',
          permissions: ['plugin.read'],
          entry: 'dist/index.html',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: false }
            }
          },
          ui: {
            launcher: {
              displayName: 'Card Viewer'
            },
            surface: {
              defaultKind: 'window',
              preferredKinds: {
                desktop: 'window',
                web: 'route',
                mobile: 'fullscreen',
                headless: 'window'
              }
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.html'), '<!doctype html><title>shortcut</title>', 'utf-8');
    await runtime.install(manifestPath);

    const context = createContextFactory();
    await expect(
      kernel.invoke<{ pluginId: string; replace?: boolean }, { shortcut: { launcherPath: string } }>(
        'plugin.createShortcut',
        {
          pluginId: 'chips.shortcut.app'
        },
        context(['plugin.manage'])
      )
    ).rejects.toMatchObject({
      code: 'PLUGIN_SHORTCUT_PERMISSION_DENIED',
      message: expect.stringContaining('~/Applications/Chips Apps'),
      details: expect.objectContaining({
        lastError: expect.objectContaining({
          pluginId: 'chips.shortcut.app',
          launcherPath: '/Users/steve/Applications/Chips Apps/Card Viewer.app',
          location: 'launchpad',
          cause: expect.objectContaining({
            code: 'EACCES',
            syscall: 'mkdir'
          })
        })
      })
    });
  });

  it('returns a web-renderable icon path from getShortcut while launcher creation keeps the native platform icon', async () => {
    const state = createPalState();
    const kernel = new Kernel();
    const runtime = new PluginRuntime(workspace, { locale: 'zh-CN', themeId: 'chips-official.default-theme' });
    await runtime.load();
    registerHostSchemas();
    const launcherIconCalls: Array<string | undefined> = [];
    const pal = createPal(state);
    pal.environment.getInfo = async () => ({
      hostKind: 'desktop' as const,
      platform: 'darwin' as const,
      arch: 'arm64',
      release: 'test'
    });
    pal.launcher.create = async (options) => {
      launcherIconCalls.push(options.iconPath);
      return {
        pluginId: options.pluginId,
        name: options.name,
        location: 'launchpad' as const,
        launcherPath: options.launcherPath ?? path.join(workspace, 'launcher', `${options.name}.app`),
        executablePath: options.executablePath,
        args: [...options.args],
        iconPath: options.iconPath
      };
    };
    pal.launcher.getRecord = async (options) => ({
      pluginId: options.pluginId,
      name: options.name,
      location: 'launchpad' as const,
      launcherPath: options.launcherPath ?? path.join(workspace, 'launcher', `${options.name}.app`),
      executablePath: '',
      args: []
    });
    await registerHostServices({
      kernel,
      pal,
      workspacePath: workspace,
      logger: new StructuredLogger(),
      getCardService: () => new CardService(),
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const manifestPath = path.join(workspace, 'icon-app.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.icon.app',
          version: '1.0.0',
          type: 'app',
          name: 'Icon App',
          permissions: ['plugin.read'],
          entry: 'dist/index.html',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: false }
            }
          },
          ui: {
            launcher: {
              displayName: 'Icon App',
              icon: 'assets/icons/app-icon.ico'
            },
            surface: {
              defaultKind: 'window',
              preferredKinds: {
                desktop: 'window',
                web: 'route',
                mobile: 'fullscreen',
                headless: 'window'
              }
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await fs.mkdir(path.join(workspace, 'assets/icons'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'assets/icons/app-icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'binary');
    await fs.writeFile(path.join(workspace, 'assets/icons/app-icon.icns'), Buffer.from([0x69, 0x63, 0x6e, 0x73]), 'binary');
    await fs.writeFile(path.join(workspace, 'assets/icons/app-icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf-8');
    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.html'), '<!doctype html><title>icon</title>', 'utf-8');
    await runtime.install(manifestPath);
    const iconDir = path.join(workspace, 'plugins', 'chips.icon.app', 'assets', 'icons');
    await fs.mkdir(iconDir, { recursive: true });
    await fs.writeFile(path.join(iconDir, 'app-icon.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'binary');
    await fs.writeFile(path.join(iconDir, 'app-icon.icns'), Buffer.from([0x69, 0x63, 0x6e, 0x73]), 'binary');
    await fs.writeFile(path.join(iconDir, 'app-icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf-8');

    const context = createContextFactory();
    const readShortcut = await kernel.invoke<
      { pluginId: string },
      { shortcut: { iconPath?: string } }
    >('plugin.getShortcut', { pluginId: 'chips.icon.app' }, context(['plugin.read']));
    expect(readShortcut.shortcut.iconPath).toBe(path.join(workspace, 'plugins', 'chips.icon.app', 'assets', 'icons', 'app-icon.png'));

    const createdShortcut = await kernel.invoke<
      { pluginId: string },
      { shortcut: { iconPath?: string } }
    >('plugin.createShortcut', { pluginId: 'chips.icon.app' }, context(['plugin.manage']));
    expect(createdShortcut.shortcut.iconPath).toBe(path.join(workspace, 'plugins', 'chips.icon.app', 'assets', 'icons', 'app-icon.png'));
    expect(launcherIconCalls).toEqual([path.join(workspace, 'plugins', 'chips.icon.app', 'assets', 'icons', 'app-icon.icns')]);
  });

  it('registers, lists, invokes, updates, and unregisters commands through the Host registry', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });
    const manifestPath = path.join(workspace, 'command-demo.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.demo.app',
          version: '1.0.0',
          type: 'app',
          name: 'Command Demo',
          permissions: ['config.read'],
          entry: 'dist/index.html',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: false }
            }
          },
          ui: {
            surface: {
              defaultKind: 'window',
              preferredKinds: {
                desktop: 'window',
                web: 'route',
                mobile: 'fullscreen',
                headless: 'window'
              }
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.html'), '<!doctype html><title>command-demo</title>', 'utf-8');
    await runtime.install(manifestPath);
    await runtime.enable('chips.demo.app');

    const emittedEvents: Array<{ name: string; data: unknown }> = [];
    const disposeEvents = kernel.events.on('*', (event) => {
      emittedEvents.push({ name: event.name, data: event.data });
    });
    const context = createContextFactory();
    const pluginContext = {
      ...context(['command.read', 'command.write', 'command.invoke', 'config.read']),
      caller: {
        id: 'plugin-preload',
        type: 'plugin' as const,
        pluginId: 'chips.demo.app',
        sessionId: 'session-demo',
        permissions: ['command.read', 'command.write', 'command.invoke', 'config.read']
      }
    };

    try {
      const registered = await kernel.invoke<
        Record<string, unknown>,
        {
          command: {
            commandId: string;
            titleKey: string;
            handlerId: string;
            ownerPluginId?: string;
            ownerSessionId?: string;
            diagnostic: { visible: boolean; enabled: boolean };
          };
        }
      >(
        'command.register',
        {
          commandId: 'chips.demo.open-settings',
          titleKey: 'app.commands.openSettings.title',
          descriptionKey: 'app.commands.openSettings.description',
          ariaLabelKey: 'app.commands.openSettings.ariaLabel',
          icon: { name: 'settings', style: 'rounded' },
          shortcut: { accelerator: 'CommandOrControl+,', platform: 'desktop' },
          scope: { kind: 'app', appId: 'chips.demo.app' },
          permission: ['config.read'],
          enabledWhen: { key: 'mode', equals: 'ready' },
          handlerId: 'open-settings',
          menuPlacement: [{ menuId: 'app', groupId: 'settings', order: 10 }],
          toolbarPlacement: [{ toolbarId: 'main', groupId: 'primary', order: 5 }],
          paletteKeywords: ['settings', 'preferences']
        },
        pluginContext
      );

      expect(registered.command).toEqual(
        expect.objectContaining({
          commandId: 'chips.demo.open-settings',
          titleKey: 'app.commands.openSettings.title',
          handlerId: 'open-settings',
          ownerPluginId: 'chips.demo.app',
          ownerSessionId: 'session-demo',
          diagnostic: expect.objectContaining({
            visible: true,
            enabled: false
          })
        })
      );
      expect(state.shortcuts).not.toContain('CommandOrControl+,');

      const listed = await kernel.invoke<Record<string, unknown>, { commands: unknown[] }>(
        'command.list',
        {
          includeDisabled: true,
          context: { pluginId: 'chips.demo.app', data: { mode: 'ready' } }
        },
        pluginContext
      );
      expect(listed.commands).toHaveLength(1);
      expect(listed.commands[0]).toEqual(
        expect.objectContaining({
          commandId: 'chips.demo.open-settings',
          diagnostic: expect.objectContaining({ enabled: true })
        })
      );

      const invoked = await kernel.invoke<
        {
          commandId: string;
          source: 'toolbar';
          payload: Record<string, unknown>;
          context: { pluginId: string; data: Record<string, unknown> };
        },
        { commandId: string; invocationId: string; dispatched: boolean }
      >(
        'command.invoke',
        {
          commandId: 'chips.demo.open-settings',
          source: 'toolbar',
          payload: { target: 'settings' },
          context: {
            pluginId: 'chips.demo.app',
            data: { mode: 'ready' }
          }
        },
        pluginContext
      );
      expect(invoked).toEqual(
        expect.objectContaining({
          commandId: 'chips.demo.open-settings',
          dispatched: true
        })
      );
      expect(invoked.invocationId).toBeTruthy();
      expect(emittedEvents.map((event) => event.name)).toEqual(
        expect.arrayContaining(['command.registered', 'command.changed', 'command.invoked'])
      );
      expect(emittedEvents.find((event) => event.name === 'command.invoked')?.data).toEqual(
        expect.objectContaining({
          commandId: 'chips.demo.open-settings',
          handlerId: 'open-settings',
          ownerPluginId: 'chips.demo.app',
          ownerSessionId: 'session-demo',
          source: 'toolbar',
          payload: { target: 'settings' }
        })
      );

      const updated = await kernel.invoke<
        { commandId: string; state: { enabled: boolean; disabledReasonKey: string } },
        { command: { commandId: string; state: { enabled?: boolean; disabledReasonKey?: string } } }
      >(
        'command.setState',
        {
          commandId: 'chips.demo.open-settings',
          state: {
            enabled: false,
            disabledReasonKey: 'app.commands.openSettings.disabled'
          }
        },
        pluginContext
      );
      expect(updated.command.state).toEqual(
        expect.objectContaining({
          enabled: false,
          disabledReasonKey: 'app.commands.openSettings.disabled'
        })
      );

      await kernel.invoke('command.unregister', { commandId: 'chips.demo.open-settings' }, pluginContext);
      expect(state.shortcuts).not.toContain('CommandOrControl+,');
      const afterUnregister = await kernel.invoke<Record<string, unknown>, { commands: unknown[] }>(
        'command.list',
        { includeDisabled: true, includeHidden: true },
        pluginContext
      );
      expect(afterUnregister.commands).toEqual([]);
    } finally {
      disposeEvents();
    }
  });

  it('blocks commands without i18n keys or undeclared command permissions', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const manifestPath = path.join(workspace, 'command-owner.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.command.owner',
          version: '1.0.0',
          type: 'app',
          name: 'Command Owner',
          permissions: ['config.read'],
          entry: 'dist/index.html',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: false }
            }
          },
          ui: {
            surface: {
              defaultKind: 'window',
              preferredKinds: {
                desktop: 'window',
                web: 'route',
                mobile: 'fullscreen',
                headless: 'window'
              }
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.html'), '<!doctype html><title>command-owner</title>', 'utf-8');
    await runtime.install(manifestPath);
    await runtime.enable('chips.command.owner');

    const context = createContextFactory();
    const pluginContext = {
      ...context(['command.write', 'command.invoke', 'config.read']),
      caller: {
        id: 'plugin-preload',
        type: 'plugin' as const,
        pluginId: 'chips.command.owner',
        sessionId: 'session-command-owner',
        permissions: ['command.write', 'command.invoke', 'config.read']
      }
    };

    await expect(
      kernel.invoke(
        'command.register',
        {
          commandId: 'chips.command.owner.bad-title',
          title: 'Open Settings',
          handlerId: 'open-settings'
        },
        pluginContext
      )
    ).rejects.toMatchObject({
      code: 'SCHEMA_VALIDATION_FAILED',
      details: expect.arrayContaining([expect.stringContaining('title is not allowed')])
    });

    await expect(
      kernel.invoke(
        'command.register',
        {
          commandId: 'chips.command.owner.secret',
          titleKey: 'app.commands.secret.title',
          handlerId: 'secret',
          permission: ['file.write']
        },
        pluginContext
      )
    ).rejects.toMatchObject({
      code: 'COMMAND_PERMISSION_UNDECLARED'
    });
  });

  it('cleans plugin session commands when the owning surface closes', async () => {
    const state = createPalState();
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
      getCardInfoService: () => createCardInfoService(),
      getCardSessionService: () => createCardSessionService(),
      getBoxService: () => new BoxService(),
      getBoxSessionService: () => createBoxSessionService(),
      getWorkspaceService: () => new WorkspaceService(),
      getZipService: () => new StoreZipService(),
      runtime
    });

    const manifestPath = path.join(workspace, 'command-surface.plugin.json');
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        {
          id: 'chips.command.surface',
          version: '1.0.0',
          type: 'app',
          name: 'Command Surface',
          permissions: ['config.read'],
          entry: 'dist/index.html',
          runtime: {
            targets: {
              desktop: { supported: true },
              web: { supported: false },
              mobile: { supported: false },
              headless: { supported: false }
            }
          },
          ui: {
            surface: {
              defaultKind: 'window',
              preferredKinds: {
                desktop: 'window',
                web: 'route',
                mobile: 'fullscreen',
                headless: 'window'
              }
            }
          }
        },
        null,
        2
      ),
      'utf-8'
    );
    await fs.mkdir(path.join(workspace, 'dist'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'dist/index.html'), '<!doctype html><title>command-surface</title>', 'utf-8');
    await runtime.install(manifestPath);
    await runtime.enable('chips.command.surface');

    const context = createContextFactory();
    const opened = await kernel.invoke<
      { request: { target: { type: 'plugin'; pluginId: string } } },
      { surface: { id: string; sessionId?: string } }
    >(
      'surface.open',
      {
        request: {
          target: {
            type: 'plugin',
            pluginId: 'chips.command.surface'
          }
        }
      },
      context(['window.control', 'plugin.manage'])
    );
    const pluginContext = {
      ...context(['command.read', 'command.write', 'command.invoke', 'config.read']),
      caller: {
        id: 'plugin-preload',
        type: 'plugin' as const,
        pluginId: 'chips.command.surface',
        sessionId: opened.surface.sessionId,
        permissions: ['command.read', 'command.write', 'command.invoke', 'config.read']
      }
    };

    await kernel.invoke(
      'command.register',
      {
        commandId: 'chips.command.surface.refresh',
        titleKey: 'app.commands.refresh.title',
        handlerId: 'refresh',
        shortcut: { accelerator: 'CommandOrControl+R' },
        permission: ['config.read']
      },
      pluginContext
    );
    expect(state.shortcuts).not.toContain('CommandOrControl+R');

    await kernel.invoke('surface.close', { surfaceId: opened.surface.id }, context(['window.control']));
    const commands = await kernel.invoke<Record<string, unknown>, { commands: unknown[] }>(
      'command.list',
      { includeDisabled: true, includeHidden: true },
      context(['command.read'])
    );
    expect(commands.commands).toEqual([]);
    expect(state.shortcuts).not.toContain('CommandOrControl+R');
    expect(runtime.snapshot().sessions).toHaveLength(0);
  });
});
