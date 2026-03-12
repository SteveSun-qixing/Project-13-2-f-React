import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Kernel } from '../../packages/kernel/src';
import type { PALAdapter } from '../../packages/pal/src';
import { registerHostSchemas } from '../../src/main/services/register-schemas';
import { registerHostServices } from '../../src/main/services/register-host-services';
import { StructuredLogger } from '../../src/shared/logger';
import type { RouteInvocationContext } from '../../src/shared/types';
import { PluginRuntime } from '../../src/runtime';
import type { CardService } from '../../packages/card-service/src';
import type { BoxService } from '../../packages/box-service/src';
import type { StoreZipService } from '../../packages/zip-service/src';

const createContext = (permissions: string[]): RouteInvocationContext => ({
  requestId: `req-${Date.now()}`,
  timestamp: Date.now(),
  caller: {
    id: 'service-activation-test',
    type: 'plugin',
    permissions
  }
});

const createPal = (): PALAdapter => ({
  window: {
    async create(options) {
      return {
        id: 'window-1',
        title: options.title,
        width: options.width,
        height: options.height,
        focused: false,
        state: 'normal',
        url: options.url,
        pluginId: options.pluginId,
        sessionId: options.sessionId
      };
    },
    async focus() {},
    async resize() {},
    async setState() {},
    async getState() {
      return {
        id: 'window-1',
        title: 'window',
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
    async readFile() {
      return Buffer.from('');
    },
    async writeFile() {},
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
        async close() {}
      };
    },
    async exists() {
      return false;
    },
    async mkdir() {},
    async delete() {},
    async copy() {},
    async move() {}
  },
  dialog: {
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
  },
  clipboard: {
    async read() {
      return '';
    },
    async write() {}
  },
  shell: {
    async openPath() {},
    async openExternal() {},
    async showItemInFolder() {}
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
      return ['window', 'file'];
    }
  },
  screen: {
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
  },
  tray: {
    async set() {
      return { active: true };
    },
    async clear() {},
    async getState() {
      return { active: false };
    }
  },
  notification: {
    async show() {}
  },
  shortcut: {
    async register() {
      return true;
    },
    async unregister() {},
    async isRegistered() {
      return false;
    },
    async list() {
      return [];
    },
    async clear() {}
  },
  launcher: {
    async getDefaultPath(name) {
      return {
        launcherPath: `/virtual/${name}.lnk`,
        location: 'desktop'
      };
    },
    async create(options) {
      return {
        pluginId: options.pluginId,
        name: options.name,
        location: 'desktop',
        launcherPath: options.launcherPath ?? `/virtual/${options.name}.lnk`,
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
        launcherPath: options.launcherPath ?? `/virtual/${options.name}.lnk`,
        executablePath: '',
        args: []
      };
    },
    async remove(options) {
      return {
        removed: true,
        launcherPath: options.launcherPath ?? `/virtual/${options.name}.lnk`,
        location: 'desktop'
      };
    }
  },
  power: {
    async getState() {
      return {
        idleSeconds: 0,
        preventSleep: false
      };
    },
    async setPreventSleep(prevent) {
      return prevent;
    }
  },
  ipc: {
    async createChannel(options) {
      return {
        channelId: 'ipc-1',
        name: options.name,
        transport: options.transport
      };
    },
    async send() {},
    async receive() {
      return {
        channelId: 'ipc-1',
        transport: 'shared-memory',
        payload: Buffer.from(''),
        receivedAt: Date.now()
      };
    },
    async closeChannel() {},
    async listChannels() {
      return [];
    }
  }
});

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
    const defaultTheme = await runtime.install(path.resolve(process.cwd(), '../ThemePack/Chips-default/manifest.yaml'));
    await runtime.enable(defaultTheme.manifest.id);
    registerHostSchemas();

    let cardCreated = 0;
    let boxCreated = 0;
    let zipCreated = 0;
    const cardRenderCalls: Array<{ cardFile: string; options?: Record<string, unknown> }> = [];
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
      inspect: async () => ({ files: [] as string[] })
    } as unknown as BoxService;
    const fakeZipService = {
      compress: async () => {},
      extract: async () => {},
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

    const permissionAll = ['config.read', 'card.read', 'box.read', 'zip.manage'];
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
  });
});
