import { release } from 'node:os';
import { describe, expect, it } from 'vitest';

import {
  PAL_FACETS,
  PAL_FACET_PORT_KEYS,
  type IPalCapabilityMatrix,
  type IPalHost,
  type IPalPorts,
} from '../src/platform/contracts/index.js';
import { PalBootstrapError, isPalBootstrapError } from '../src/platform/errors.js';
import {
  assemblePalHost,
  buildCapabilityMatrix,
  validateCapabilityMatrix,
  validatePalHost,
} from '../src/platform/matrix.js';
import { createElectronApi } from '../src/platform/electron/electron-api.js';
import { loadElectronModule } from '../src/platform/electron/load-electron.js';
import { createMacPalHost } from '../src/platform/mac/index.js';
import { createMockElectron, MockBrowserWindow } from './helpers/electron-mock.js';

const DARWIN_APP_VERSION = '0.1.0-test';

/** 全量 mock 的 macOS PAL 宿主。 */
function createFullHost(): ReturnType<typeof createMacPalHost> {
  const mock = createMockElectron();
  return createMacPalHost(mock.buildApi(), {
    hostPlatform: 'darwin',
    getSystemVersion: () => '15.0.0',
    arch: 'arm64',
    runCommand: { run: async () => ({ stdout: '', stderr: '', exitCode: 0 }) },
  });
}

describe('buildCapabilityMatrix', () => {
  it('should mark a facet as available only when its port exists', () => {
    const matrix = buildCapabilityMatrix({
      storage: {} as IPalPorts['storage'],
      window: {} as NonNullable<IPalPorts['window']>,
      system: {} as NonNullable<IPalPorts['system']>,
    });

    expect(matrix.window).toBe(true);
    expect(matrix.systemInfo).toBe(true);
    for (const facet of PAL_FACETS) {
      if (facet !== 'window' && facet !== 'systemInfo') {
        expect(matrix[facet]).toBe(false);
      }
    }
  });

  it('should map every facet to a port key in IPalPorts', () => {
    const ports: Partial<IPalPorts> = {};
    for (const facet of PAL_FACETS) {
      expect(PAL_FACET_PORT_KEYS[facet]).toBeDefined();
    }
    expect(buildCapabilityMatrix(ports).window).toBe(false);
  });
});

describe('validateCapabilityMatrix', () => {
  const emptyMatrix = buildCapabilityMatrix({});

  it('should pass when the matrix matches the ports exactly', () => {
    const ports: Partial<IPalPorts> = { storage: {} as IPalPorts['storage'] };
    expect(() => validateCapabilityMatrix(emptyMatrix, ports)).not.toThrow();
  });

  it('should throw when a declared facet has no port implementation', () => {
    const matrix: IPalCapabilityMatrix = { ...emptyMatrix, window: true };
    expect(() => validateCapabilityMatrix(matrix, {})).toThrow(PalBootstrapError);
    try {
      validateCapabilityMatrix(matrix, {});
    } catch (error) {
      expect(isPalBootstrapError(error)).toBe(true);
      if (isPalBootstrapError(error)) {
        expect(error.details).toMatchObject({
          facet: 'window',
          portKey: 'window',
          declared: true,
          present: false,
        });
      }
    }
  });

  it('should throw when a port exists but the facet is declared unavailable', () => {
    const ports: Partial<IPalPorts> = { dialog: {} as NonNullable<IPalPorts['dialog']> };
    expect(() => validateCapabilityMatrix(emptyMatrix, ports)).toThrow(PalBootstrapError);
  });
});

describe('assemblePalHost / validatePalHost', () => {
  const info = {
    shell: 'desktop' as const,
    platform: 'macos' as const,
    osVersion: '15.0.0',
    arch: 'arm64',
    appVersion: '0.1.0',
    locale: 'zh-CN',
    paths: {},
  };

  it('should reject a port set without the mandatory storage port', () => {
    expect(() => assemblePalHost(info, buildCapabilityMatrix({}), {})).toThrow(/storage/);
  });

  it('should return a host when matrix and ports are consistent', () => {
    const host = assemblePalHost(info, buildCapabilityMatrix({}), {
      storage: {} as IPalPorts['storage'],
    });
    expect(host.info).toBe(info);
    expect(host.ports.storage).toBeDefined();
  });

  it('should reject an externally built host with inconsistent matrix', () => {
    const host: IPalHost = {
      info,
      matrix: { ...buildCapabilityMatrix({}), window: true },
      ports: { storage: {} as IPalPorts['storage'] },
    };
    expect(() => validatePalHost(host)).toThrow(PalBootstrapError);
  });

  it('should reject an externally built host without storage', () => {
    const host = {
      info,
      matrix: buildCapabilityMatrix({}),
      ports: {},
    } as IPalHost;
    expect(() => validatePalHost(host)).toThrow(PalBootstrapError);
  });
});

describe('createElectronApi', () => {
  it('should reject non-object modules', () => {
    expect(() => createElectronApi(null)).toThrow(PalBootstrapError);
    expect(() => createElectronApi('electron')).toThrow(PalBootstrapError);
    expect(() => createElectronApi(42)).toThrow(PalBootstrapError);
  });

  it('should require the app module with its three methods', () => {
    expect(() => createElectronApi({})).toThrow(/app/);
    expect(() => createElectronApi({ app: { getVersion: () => '1' } })).toThrow(/getLocale/);
    expect(() => createElectronApi({ app: { getVersion: () => '1', getLocale: () => 'zh-CN' } })).toThrow(/getPath/);
  });

  it('should reject a provided module with an invalid shape', () => {
    const mock = createMockElectron();
    expect(() => createElectronApi({ app: mock.app, dialog: {} })).toThrow(/dialog/);
    expect(() => createElectronApi({ app: mock.app, clipboard: { readText: () => '' } })).toThrow(/clipboard/);
    expect(() => createElectronApi({ app: mock.app, Menu: {} })).toThrow(/Menu/);
    expect(() => createElectronApi({ app: mock.app, dialog: 'nope' })).toThrow(/dialog/);
    expect(() => createElectronApi({ app: mock.app, Tray: { not: 'callable' } })).toThrow(/Tray/);
  });

  it('should accept the full mock and omit absent optional modules', () => {
    const mock = createMockElectron();
    const api = createElectronApi(mock.buildApi());
    expect(api.app).toBe(mock.app);
    expect(api.dialog).toBeDefined();

    const partial = createElectronApi(mock.buildApi({ omit: ['net', 'shell', 'Tray'] }));
    expect(partial.net).toBeUndefined();
    expect(partial.shell).toBeUndefined();
    expect(partial.Tray).toBeUndefined();
  });
});

describe('loadElectronModule', () => {
  it('should return null when not running inside Electron', () => {
    expect(loadElectronModule()).toBeNull();
  });
});

describe('createMacPalHost', () => {
  it('should assemble a fully available host from a complete Electron module', () => {
    const host = createFullHost();
    for (const facet of PAL_FACETS) {
      expect(host.matrix[facet]).toBe(true);
    }
    expect(host.info.shell).toBe('desktop');
    expect(host.info.platform).toBe('macos');
    expect(host.info.osVersion).toBe('15.0.0');
    expect(host.info.arch).toBe('arm64');
    expect(host.info.appVersion).toBe(DARWIN_APP_VERSION);
    expect(host.info.locale).toBe('zh-CN');
    expect(Object.keys(host.info.paths)).toHaveLength(9);
    expect(host.ports.window).toBeDefined();
    expect(host.ports.system).toBeDefined();
  });

  it('should report exactly the facets whose Electron modules exist', () => {
    const mock = createMockElectron();
    const host = createMacPalHost(
      mock.buildApi({
        omit: ['Tray', 'nativeImage', 'net', 'shell', 'powerMonitor', 'powerSaveBlocker'],
      }),
      { hostPlatform: 'darwin', getSystemVersion: () => '15.0.0', arch: 'arm64' },
    );

    expect(host.matrix.tray).toBe(false);
    expect(host.ports.tray).toBeUndefined();
    expect(host.matrix.transfer).toBe(false);
    expect(host.matrix.http).toBe(false);
    expect(host.matrix.shellOpen).toBe(false);
    expect(host.matrix.power).toBe(false);
    expect(host.matrix.window).toBe(true);
    expect(host.matrix.systemInfo).toBe(true);
  });

  it('should report tray as unavailable when nativeImage is missing', () => {
    const mock = createMockElectron();
    const host = createMacPalHost(mock.buildApi({ omit: ['nativeImage'] }), {
      hostPlatform: 'darwin',
      getSystemVersion: () => '15.0.0',
      arch: 'arm64',
    });
    expect(host.matrix.tray).toBe(false);
    expect(host.ports.tray).toBeUndefined();
  });

  it('should refuse to construct on non-macOS platforms', () => {
    const mock = createMockElectron();
    expect(() => createMacPalHost(mock.buildApi(), { hostPlatform: 'win32' })).toThrow(/macOS/);
  });

  it('should fall back to the kernel release and process arch', () => {
    const mock = createMockElectron();
    const host = createMacPalHost(mock.buildApi(), { hostPlatform: 'darwin' });
    expect(host.info.arch).toBe(process.arch);
    expect(host.info.osVersion).toBe(release());
  });

  it('should pass shell window options and the default tray icon through', async () => {
    const mock = createMockElectron();
    const host = createMacPalHost(mock.buildApi(), {
      hostPlatform: 'darwin',
      getSystemVersion: () => '15.0.0',
      arch: 'arm64',
      trayDefaultIconPath: '/icons/default.png',
      windowOptions: () => ({ webPreferences: { preload: '/app/preload.js' } }),
      progressIntervalMs: 0,
      networkLimits: { maxRedirects: 3 },
    });

    await host.ports.tray?.set({});
    expect(mock.nativeImage.createdPaths).toEqual(['/icons/default.png']);

    await host.ports.window?.create({
      title: '壳窗口',
      width: 800,
      height: 600,
      url: 'chips-resource://platform/index.html',
    });
    expect(MockBrowserWindow.windows[0]?.options.webPreferences?.preload).toBe('/app/preload.js');
  });

  it('should fail bootstrap when the Electron module is malformed', () => {
    expect(() => createMacPalHost({}, { hostPlatform: 'darwin' })).toThrow(PalBootstrapError);
  });

  it('should fail bootstrap when shell info cannot be read', () => {
    const mock = createMockElectron();
    mock.app.failGetPath = true;
    expect(() => createMacPalHost(mock.buildApi(), { hostPlatform: 'darwin' })).toThrow(PalBootstrapError);
  });

  it('should dispose tray resources idempotently', async () => {
    const mock = createMockElectron();
    const host = createMacPalHost(mock.buildApi(), {
      hostPlatform: 'darwin',
      getSystemVersion: () => '15.0.0',
      arch: 'arm64',
    });
    await host.ports.tray?.set({ iconPath: '/icons/tray.png' });
    expect(mock.tray.instances).toHaveLength(1);

    host.dispose();
    host.dispose();
    expect(mock.tray.instances[0]?.destroyed).toBe(true);
  });

  it('should expose a working window port through the host', async () => {
    const host = createFullHost();
    const created = await host.ports.window?.create({
      title: '测试窗口',
      width: 800,
      height: 600,
      url: 'chips-resource://platform/index.html',
    });
    expect(created?.windowId).toBeGreaterThan(0);
    expect(MockBrowserWindow.windows).toHaveLength(1);
  });
});
