import type * as NodeModule from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireMock = vi.fn();

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeModule>();
  return {
    ...actual,
    createRequire: () => requireMock,
  };
});

const { loadElectronModule } = await import('../src/platform/electron/load-electron.js');

describe('loadElectronModule', () => {
  afterEach(() => {
    requireMock.mockReset();
  });

  it('should return the Electron module when the shape is valid', () => {
    const electron = { app: { getVersion: () => '1.0.0' } };
    requireMock.mockReturnValue(electron);
    expect(loadElectronModule()).toBe(electron);
  });

  it('should return null for non-object modules', () => {
    requireMock.mockReturnValue('/path/to/electron');
    expect(loadElectronModule()).toBeNull();

    requireMock.mockReturnValue(null);
    expect(loadElectronModule()).toBeNull();
  });

  it('should return null when the app module is missing', () => {
    requireMock.mockReturnValue({});
    expect(loadElectronModule()).toBeNull();

    requireMock.mockReturnValue({ app: 'nope' });
    expect(loadElectronModule()).toBeNull();
  });

  it('should return null when require throws', () => {
    requireMock.mockImplementation(() => {
      throw new Error('not resolvable');
    });
    expect(loadElectronModule()).toBeNull();
  });
});
