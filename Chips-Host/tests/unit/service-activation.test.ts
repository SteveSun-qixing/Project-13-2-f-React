import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Kernel } from '../../packages/kernel/src';
import type { PALAdapter } from '../../packages/pal/src';
import { CardInfoService } from '../../packages/card-info-service/src';
import { registerHostSchemas } from '../../src/main/services/register-schemas';
import { registerHostServices } from '../../src/main/services/register-host-services';
import { StructuredLogger } from '../../src/shared/logger';
import type { RouteInvocationContext } from '../../src/shared/types';
import { PluginRuntime } from '../../src/runtime';
import type { CardService } from '../../packages/card-service/src';
import type { BoxService } from '../../packages/box-service/src';
import type { StoreZipService } from '../../packages/zip-service/src';

const createCardInfoService = (cardService: CardService): CardInfoService => {
  return new CardInfoService({
    validate: (cardFile) => cardService.validate(cardFile),
    readMetadata: (cardFile) => cardService.readMetadata(cardFile),
    renderCover: (cardFile) => cardService.renderCover(cardFile)
  });
};

const createContext = (permissions: string[]): RouteInvocationContext => ({
  requestId: `req-${Date.now()}`,
  timestamp: Date.now(),
  caller: {
    id: 'service-activation-test',
    type: 'plugin',
    permissions
  }
});

const createPal = (): PALAdapter => {
  const capabilitySnapshot: Awaited<ReturnType<PALAdapter['environment']['getCapabilities']>> = {
    hostKind: 'desktop',
    platform: process.platform as any,
    facets: {
      surface: { supported: true, interactive: true, supportedKinds: ['window'] },
      storage: { localWorkspace: true, sandboxFilePicker: false, remoteBacked: false },
      selection: { openFile: true, saveFile: true, directory: true, multiple: true },
      transfer: { upload: false, download: true, share: false, externalOpen: true, revealInShell: true },
      association: { fileAssociation: true, urlScheme: true, shareTarget: false },
      device: { screen: true, power: true, network: false },
      systemUi: { clipboard: true, tray: true, globalShortcut: true, notification: true },
      background: { keepAlive: true, wakeEvents: true },
      ipc: { namedPipe: true, unixSocket: process.platform !== 'win32', sharedMemory: true },
      offscreenRender: { htmlToPdf: true, htmlToImage: true, videoFrame: true }
    }
  } as const;

  const windowManager: PALAdapter['window'] = {
    async create(options) {
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
        sessionId: options.sessionId
      };
    },
    async focus() { },
    async resize() { },
    async setState() { },
    async getState() {
      return {
        id: 'window-1',
        kind: 'window' as const,
        title: 'window',
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
    normalize: (inputPath: string) => path.normalize(inputPath),
    async readFile() {
      return Buffer.from('');
    },
    async writeFile() { },
    async stat() {
      return {
        isFile: true,
        isDirectory: false,
        size: 0,
        mtimeMs: Date.now()
      };
    },
    async list() {
      return [];
    },
    async watch() {
      return {
        id: 'watch-1',
        async close() { }
      };
    },
    async mkdir() { },
    async delete() { },
    async move() { },
    async copy() { }
  };

  const selection: PALAdapter['selection'] = {
    async openFile() {
      return null;
    },
    async saveFile() {
      return null;
    },
    async showMessage() {
      return 0;
    },
    async showConfirm() {
      return true;
    }
  };

  const clipboard: PALAdapter['clipboard'] = {
    async read() {
      return '';
    },
    async write() { }
  };

  const shell: PALAdapter['shell'] = {
    async openPath() { },
    async openExternal() { },
    async showItemInFolder() { }
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
      return ['window', 'file'];
    }
  };

  const screen: PALAdapter['screen'] = {
    async getPrimary() {
      return {
        id: 'screen-1',
        width: 1920,
        height: 1080,
        scaleFactor: 1,
        x: 0,
        y: 0,
        primary: true
      };
    },
    async getAll() {
      return [
        {
          id: 'screen-1',
          width: 1920,
          height: 1080,
          scaleFactor: 1,
          x: 0,
          y: 0,
          primary: true
        }
      ];
    }
  };

  const tray: PALAdapter['tray'] = {
    async set() {
      return { active: true };
    },
    async clear() { },
    async getState() {
      return { active: false };
    }
  };

  const notification: PALAdapter['notification'] = {
    async show() { }
  };

  const shortcut: PALAdapter['shortcut'] = {
    async register() {
      return true;
    },
    async unregister() { },
    async isRegistered() {
      return false;
    },
    async list() {
      return [];
    },
    async clear() { }
  };

  const power: PALAdapter['power'] = {
    async getState() {
      return {
        idleSeconds: 0,
        preventSleep: false
      };
    },
    async setPreventSleep(prevent: boolean) {
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
    async open(request: Parameters<PALAdapter['surface']['open']>[0]) {
      return windowManager.create({
        title: request.presentation?.title ?? 'Surface',
        width: request.presentation?.width ?? 800,
        height: request.presentation?.height ?? 600,
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
        chrome: request.presentation?.chrome
      });
    },
    async focus(id: string) {
      await windowManager.focus(id);
    },
    async resize(id: string, width: number, height: number) {
      await windowManager.resize(id, width, height);
    },
    async setState(id: string, nextState: 'normal' | 'minimized' | 'maximized' | 'fullscreen' | 'hidden') {
      await windowManager.setState(id, nextState === 'hidden' ? 'normal' : nextState);
    },
    async getState(id: string) {
      return windowManager.getState(id);
    },
    async close(id: string) {
      await windowManager.close(id);
    },
    async list() {
      return windowManager.list();
    }
  };

  const offscreenRender: PALAdapter['offscreenRender'] = {
    async renderHtmlToPdf(input: { outputFile: string }) {
      return {
        outputFile: input.outputFile,
        pageCount: 1
      };
    },
    async renderHtmlToImage(input: { outputFile: string; options?: { width?: number; height?: number; format?: 'png' | 'jpeg' | 'webp' } }) {
      return {
        outputFile: input.outputFile,
        width: input.options?.width,
        height: input.options?.height,
        format: input.options?.format ?? 'png'
      };
    },
    async extractVideoFrame(input) {
      return {
        outputFile: input.outputFile,
        width: input.options?.width ?? 1280,
        height: input.options?.height ?? 720,
        format: input.options?.format ?? 'png',
        mimeType: input.options?.format === 'jpeg' ? 'image/jpeg' : 'image/png',
        frameTimeSeconds: input.options?.timeSeconds ?? 0
      };
    }
  };

  const image: PALAdapter['image'] = {
    async convertTiffToPng(input) {
      return {
        outputFile: input.outputFile,
        width: 1,
        height: 1,
        format: 'png'
      };
    }
  };

  const ipc: PALAdapter['ipc'] = {
    async createChannel(options: { name: string; transport: 'named-pipe' | 'unix-socket' | 'shared-memory' }) {
      return {
        channelId: 'ipc-1',
        name: options.name,
        transport: options.transport
      };
    },
    async send() { },
    async receive() {
      return {
        channelId: 'ipc-1',
        transport: 'shared-memory' as const,
        payload: Buffer.from(''),
        receivedAt: Date.now()
      };
    },
    async closeChannel() { },
    async listChannels() {
      return [];
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

describe('Service activation and lazy heavy service creation', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'chips-activation-'));
  });

  afterEach(async () => {
    await fs.rm(workspace, { recursive: true, force: true });
  });

  it('activates each service once and lazily instantiates card/box/zip services', async () => {
    const kernel = new Kernel();
    const runtime = new PluginRuntime(workspace, {
      locale: 'zh-CN',
      themeId: 'chips-official.default-theme'
    });
    await runtime.load();
    registerHostSchemas();

    let cardCreated = 0;
    let boxCreated = 0;
    let zipCreated = 0;
    const cardRenderCalls: Array<{ cardFile: string; options?: Record<string, unknown> }> = [];
    const boxLayoutFrameCalls: Array<Record<string, unknown>> = [];
    const boxLayoutEditorCalls: Array<Record<string, unknown>> = [];
    let cardService: CardService | undefined;
    let boxService: BoxService | undefined;
    let zipService: StoreZipService | undefined;

    const fakeCardService = {
      parse: async () => ({ node: 'card-ast' }),
      render: async (cardFile: string, options?: Record<string, unknown>) => {
        cardRenderCalls.push({ cardFile, options });
        return { node: 'card-view' };
      },
      validate: async () => ({ valid: true, errors: [] as string[] })
    } as unknown as CardService;
    const fakeBoxService = {
      pack: async (_boxDir: string, outputPath: string) => outputPath,
      unpack: async (_boxFile: string, outputDir: string) => outputDir,
      inspect: async () => ({ files: [] as string[] }),
      renderLayoutFrame: async (options: Record<string, unknown>) => {
        boxLayoutFrameCalls.push(options);
        return {
          title: 'box-view',
          layoutType: options.layoutType,
          pluginId: options.layoutType,
          documentUrl: 'chips-render://session/box-view/index.html',
          sessionId: 'render-session-view'
        };
      },
      renderLayoutEditor: async (options: Record<string, unknown>) => {
        boxLayoutEditorCalls.push(options);
        return {
          title: 'box-editor',
          layoutType: options.layoutType,
          pluginId: options.layoutType,
          documentUrl: 'chips-render://session/box-editor/index.html',
          sessionId: 'render-session-editor'
        };
      }
    } as unknown as BoxService;
    const fakeZipService = {
      compress: async () => { },
      extract: async () => { },
      list: async () => [] as string[]
    } as unknown as StoreZipService;

    await registerHostServices({
      kernel,
      pal: createPal(),
      workspacePath: workspace,
      logger: new StructuredLogger(),
      getCardService: () => {
        if (!cardService) {
          cardService = fakeCardService;
          cardCreated += 1;
        }
        return cardService;
      },
      getCardInfoService: () => createCardInfoService((cardService ?? fakeCardService) as CardService),
      getCardSessionService: () => {
        throw new Error('card session service should not be created during activation test');
      },
      getBoxSessionService: () => {
        throw new Error('box session service should not be created during activation test');
      },
      getWorkspaceService: () => {
        throw new Error('workspace service should not be created during activation test');
      },
      getBoxService: () => {
        if (!boxService) {
          boxService = fakeBoxService;
          boxCreated += 1;
        }
        return boxService;
      },
      getZipService: () => {
        if (!zipService) {
          zipService = fakeZipService;
          zipCreated += 1;
        }
        return zipService;
      },
      runtime
    });

    const activated: string[] = [];
    const off = kernel.events.on('service.activated', (event) => {
      const payload = event.data as { service?: string };
      if (payload.service) {
        activated.push(payload.service);
      }
    });

    const permissionAll = ['config.read', 'card.read', 'box.read', 'box.write', 'zip.manage'];
    expect(cardCreated).toBe(0);
    expect(boxCreated).toBe(0);
    expect(zipCreated).toBe(0);

    await kernel.invoke('config.get', { key: 'ui.language' }, createContext(permissionAll));
    await kernel.invoke('config.get', { key: 'ui.language' }, createContext(permissionAll));
    await kernel.invoke('card.parse', { cardFile: '/tmp/demo.card' }, createContext(permissionAll));
    await kernel.invoke(
      'card.render',
      {
        cardFile: '/tmp/demo.card',
        options: {
          target: 'offscreen-render',
          verifyConsistency: true
        }
      },
      createContext(permissionAll)
    );
    await kernel.invoke('box.inspect', { boxFile: '/tmp/demo.box' }, createContext(permissionAll));
    await kernel.invoke(
      'box.renderLayoutFrame',
      {
        layoutType: 'chips.layout.grid',
        sessionId: 'box-session',
        box: { name: 'demo box', activeLayoutType: 'chips.layout.grid' },
        initialView: { total: 0, items: [] },
        config: {}
      },
      createContext(permissionAll)
    );
    await kernel.invoke(
      'box.renderLayoutEditor',
      {
        layoutType: 'chips.layout.grid',
        entries: [],
        initialConfig: {}
      },
      createContext(permissionAll)
    );
    await kernel.invoke('zip.list', { zipPath: '/tmp/demo.zip' }, createContext(permissionAll));
    off();

    expect(cardCreated).toBe(1);
    expect(boxCreated).toBe(1);
    expect(zipCreated).toBe(1);
    expect(activated.filter((item) => item === 'config')).toHaveLength(1);
    expect(activated.filter((item) => item === 'card')).toHaveLength(1);
    expect(activated.filter((item) => item === 'box')).toHaveLength(1);
    expect(activated.filter((item) => item === 'zip')).toHaveLength(1);
    expect(cardRenderCalls).toHaveLength(1);
    expect(cardRenderCalls[0]).toMatchObject({
      cardFile: '/tmp/demo.card',
      options: {
        target: 'offscreen-render',
        verifyConsistency: true
      }
    });
    expect(boxLayoutFrameCalls).toHaveLength(1);
    expect(boxLayoutEditorCalls).toHaveLength(1);
    for (const call of [...boxLayoutFrameCalls, ...boxLayoutEditorCalls]) {
      expect(call.themeCssText).toBe('');
      expect(call.theme).toMatchObject({
        id: 'chips-official.default-theme'
      });
    }
  });
});
