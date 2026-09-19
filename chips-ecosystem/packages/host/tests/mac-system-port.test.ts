import { release } from 'node:os';
import { describe, expect, it } from 'vitest';

import { DIRECTORY_VARIABLE_NAMES } from '../src/platform/contracts/index.js';
import { PAL_ERROR_CODES } from '../src/platform/errors.js';
import {
  DIRECTORY_PATH_NAMES,
  createMacSystemPort,
  resolveSystemInfoPlatform,
} from '../src/platform/mac/system-port.js';
import { createMockElectron, MockApp } from './helpers/electron-mock.js';

describe('resolveSystemInfoPlatform', () => {
  it('should expose the plugin-visible darwin platform id', () => {
    expect(resolveSystemInfoPlatform()).toBe('darwin');
  });
});

describe('DIRECTORY_PATH_NAMES', () => {
  it('should cover every directory variable', () => {
    expect(Object.keys(DIRECTORY_PATH_NAMES).sort()).toEqual([...DIRECTORY_VARIABLE_NAMES].sort());
    expect(DIRECTORY_PATH_NAMES.userData).toBe('userData');
    expect(DIRECTORY_PATH_NAMES.temp).toBe('temp');
  });
});

describe('createMacSystemPort', () => {
  it('should return the full system snapshot with resolved paths', async () => {
    const app = new MockApp();
    const port = createMacSystemPort({
      app,
      arch: 'arm64',
      getSystemVersion: () => '15.1.0',
    });

    const info = await port.getInfo();
    expect(info.platform).toBe('darwin');
    expect(info.osVersion).toBe('15.1.0');
    expect(info.arch).toBe('arm64');
    expect(info.appVersion).toBe('0.1.0-test');
    expect(info.locale).toBe('zh-CN');
    expect(Object.keys(info.paths)).toHaveLength(9);
    expect(info.paths.userDocuments).toBe('/Users/tester/Documents');
    expect(info.paths.temp).toBe('/var/folders/chips-test');
  });

  it('should fall back to the kernel release for the OS version', async () => {
    const port = createMacSystemPort({ app: new MockApp(), arch: 'x64' });
    const info = await port.getInfo();
    expect(info.osVersion).toBe(release());
  });

  it('should fail with SYSTEM_INFO_UNAVAILABLE on empty paths', async () => {
    const app = new MockApp();
    app.emptyPathName = 'documents';
    await expect(createMacSystemPort({ app }).getInfo()).rejects.toMatchObject({
      code: PAL_ERROR_CODES.SYSTEM_INFO_UNAVAILABLE,
      retryable: true,
    });
  });

  it('should fail with SYSTEM_INFO_UNAVAILABLE when the app module throws', async () => {
    const app = new MockApp();
    app.failGetPath = true;
    await expect(createMacSystemPort({ app }).getInfo()).rejects.toMatchObject({
      code: PAL_ERROR_CODES.SYSTEM_INFO_UNAVAILABLE,
    });
  });

  it('should reject aborted calls', async () => {
    const controller = new AbortController();
    controller.abort();
    const port = createMacSystemPort({ app: new MockApp() });
    await expect(port.getInfo({ signal: controller.signal })).rejects.toMatchObject({
      code: PAL_ERROR_CODES.BRIDGE_CANCELLED,
    });
  });

  it('should integrate with the macOS PAL host info', async () => {
    const mock = createMockElectron();
    const port = createMacSystemPort({
      app: mock.app,
      arch: 'arm64',
      getSystemVersion: () => '15.1.0',
    });
    const info = await port.getInfo();
    expect(info.arch).toBe('arm64');
    expect(info.platform).toBe('darwin');
  });
});
