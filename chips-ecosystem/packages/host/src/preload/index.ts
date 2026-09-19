/**
 * preload 入口：把 Bridge 三方法挂载到 `window.chips`。
 *
 * 权威：`01-Bridge-API规范` §2.2（`contextBridge.exposeInMainWorld('chips', …)`）、
 * `ADR-002` §IPC 通信、`17-跨端Shell与平台抽象设计` §3.3 SB-4（只暴露 `IChipsBridge` 方法面）。
 *
 * @remarks
 * - 只暴露 `request` / `subscribe` / `resource` 三个方法；不暴露 `ipcRenderer` / `process` /
 *   `require` 等原始对象（R2、SB-4）。
 * - 该入口在 Electron 沙箱 preload 中运行；不得引入 `node:*` 与渲染层模块。
 */

import { contextBridge, ipcRenderer } from 'electron';

import { createPreloadBridge } from './bridge.js';
import { createElectronPreloadTransport } from './transport.js';

const bridge = createPreloadBridge({
  transport: createElectronPreloadTransport(ipcRenderer),
});

contextBridge.exposeInMainWorld('chips', {
  request: (capabilityId: string, input?: unknown): Promise<unknown> => bridge.request(capabilityId, input),
  subscribe: (eventId: string, handler: (payload: unknown) => void) => bridge.subscribe(eventId, handler),
  resource: (uri: string) => bridge.resource(uri),
});

window.addEventListener('unload', () => {
  bridge.dispose();
});
