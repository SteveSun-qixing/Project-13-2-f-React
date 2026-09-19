import { describe, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
}));

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mocks.exposeInMainWorld },
  ipcRenderer: { invoke: mocks.invoke, on: mocks.on, removeListener: mocks.removeListener },
}));

vi.stubGlobal('window', { addEventListener: mocks.addEventListener });

describe('debug', () => {
  it('shows request payload', async () => {
    mocks.invoke.mockResolvedValue({ requestId: 'r1', ok: true, result: { platform: 'darwin' } });
    await import('../src/preload/index.js');
    const surface = mocks.exposeInMainWorld.mock.calls[0]?.[1] as {
      request: (capabilityId: string, input?: unknown) => Promise<unknown>;
    };
    const outcome = await surface.request('system:info').then(
      (value) => `resolved:${JSON.stringify(value)}`,
      (error) => `rejected:${error instanceof Error ? error.message : String(error)}`,
    );
    console.error('DEBUG-OUTCOME', outcome);
    console.error('DEBUG-CALLS', JSON.stringify(mocks.invoke.mock.calls));
  });
});
