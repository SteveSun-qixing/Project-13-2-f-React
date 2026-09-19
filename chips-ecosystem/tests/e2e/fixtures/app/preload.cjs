/**
 * E2E 骨架自检应用的 preload。
 *
 * 只暴露与《Bridge API 规范》§2.1 同形状的 `window.chips` 三方法，
 * 由 IPC 转发到主进程的自检实现；不暴露任何 Electron / Node 原始对象。
 */

const { contextBridge, ipcRenderer } = require('electron');

const subscribers = new Map();

ipcRenderer.on('harness:event', (_event, eventId, payload) => {
  const handlers = subscribers.get(eventId);
  if (handlers === undefined) {
    return;
  }
  for (const handler of handlers) {
    handler(payload);
  }
});

function unwrap(response) {
  if (response.ok) {
    return response.value;
  }
  const error = new Error(response.error.message);
  error.name = 'ChipsError';
  error.code = response.error.code;
  throw error;
}

function request(capabilityId, input) {
  return ipcRenderer.invoke('harness:request', capabilityId, input).then(unwrap);
}

function subscribe(eventId, handler) {
  const handlers = subscribers.get(eventId) ?? new Set();
  handlers.add(handler);
  subscribers.set(eventId, handlers);
  let disposed = false;
  return {
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      handlers.delete(handler);
      if (handlers.size === 0) {
        subscribers.delete(eventId);
      }
    },
  };
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function resource(uri) {
  let released = false;
  let invalidated = false;
  const invalidateHandlers = new Set();

  function assertUsable() {
    if (released) {
      const error = new Error(`资源句柄已释放：${uri}`);
      error.code = 'RESOURCE_HANDLE_RELEASED';
      throw error;
    }
  }

  async function readBytes() {
    assertUsable();
    const base64 = await ipcRenderer.invoke('harness:resource-read', uri).then(unwrap);
    return base64ToBytes(base64);
  }

  return {
    uri,
    get state() {
      if (released) {
        return 'released';
      }
      return invalidated ? 'invalidated' : 'open';
    },
    async metadata() {
      assertUsable();
      return ipcRenderer.invoke('harness:resource-meta', uri).then(unwrap);
    },
    read() {
      return readBytes();
    },
    async readRange(offset, length) {
      const bytes = await readBytes();
      return bytes.slice(offset, offset + length);
    },
    stream() {
      let position = 0;
      let bytes = null;
      return new ReadableStream({
        async start(controller) {
          bytes = await readBytes();
        },
        pull(controller) {
          if (bytes === null) {
            return undefined;
          }
          if (position >= bytes.byteLength) {
            controller.close();
            return undefined;
          }
          const chunk = bytes.slice(position, position + 65536);
          position += chunk.byteLength;
          controller.enqueue(chunk);
          return undefined;
        },
      });
    },
    release() {
      released = true;
      invalidateHandlers.clear();
    },
    onInvalidate(handler) {
      invalidateHandlers.add(handler);
      let disposed = false;
      return {
        dispose() {
          if (disposed) {
            return;
          }
          disposed = true;
          invalidateHandlers.delete(handler);
        },
      };
    },
  };
}

contextBridge.exposeInMainWorld('chips', { request, subscribe, resource });
