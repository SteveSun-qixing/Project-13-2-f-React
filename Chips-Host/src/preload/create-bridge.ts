import type { Kernel } from '../../packages/kernel/src';
import type { RouteInvocationContext } from '../shared/types';
import { createId, now } from '../shared/utils';
import { BridgeTransport, type ChipsBridge } from '../../packages/bridge-api/src';
import { loadElectronModule } from '../main/electron/electron-loader';
import {
  CHIPS_IPC_ERROR_PREFIX,
  CHIPS_CLIPBOARD_CHANNEL_PREFIX,
  CHIPS_DIALOG_CHANNEL_PREFIX,
  CHIPS_EMIT_CHANNEL,
  CHIPS_EVENT_CHANNEL_PREFIX,
  CHIPS_INVOKE_CHANNEL,
  CHIPS_PLATFORM_CHANNEL_PREFIX,
  CHIPS_PLUGIN_CHANNEL_PREFIX,
  CHIPS_SHELL_CHANNEL_PREFIX,
  CHIPS_WINDOW_CHANNEL_PREFIX
} from '../main/ipc/chips-ipc';
import type { StandardError } from '../shared/types';

export interface BridgeContextOptions {
  callerId?: string;
  callerType?: RouteInvocationContext['caller']['type'];
  pluginId?: string;
  permissions?: string[];
}

export const HOST_INTERNAL_PERMISSIONS = [
  'file.manage',
  'file.read',
  'file.write',
  'resource.read',
  'config.read',
  'config.write',
  'theme.read',
  'theme.write',
  'i18n.read',
  'i18n.write',
  'plugin.read',
  'window.control',
  'plugin.manage',
  'module.manage',
  'platform.read',
  'platform.external',
  'log.read',
  'log.write',
  'credential.manage',
  'card.read',
  'card.write',
  'box.pack',
  'box.read',
  'zip.manage',
  'serializer.use',
  'control.read',
  'control.write'
] as const;

const sanitizePermissions = (permissions: string[] | undefined): string[] => {
  if (!permissions) {
    return [];
  }
  return permissions.map((item) => item.trim()).filter((item) => item.length > 0);
};

const ACTION_CHANNEL_MAP: Record<string, string> = {
  'window.open': `${CHIPS_WINDOW_CHANNEL_PREFIX}open`,
  'window.focus': `${CHIPS_WINDOW_CHANNEL_PREFIX}focus`,
  'window.resize': `${CHIPS_WINDOW_CHANNEL_PREFIX}resize`,
  'window.setState': `${CHIPS_WINDOW_CHANNEL_PREFIX}setState`,
  'window.getState': `${CHIPS_WINDOW_CHANNEL_PREFIX}getState`,
  'window.close': `${CHIPS_WINDOW_CHANNEL_PREFIX}close`,
  'platform.dialogOpenFile': `${CHIPS_DIALOG_CHANNEL_PREFIX}openFile`,
  'platform.dialogSaveFile': `${CHIPS_DIALOG_CHANNEL_PREFIX}saveFile`,
  'platform.dialogShowMessage': `${CHIPS_DIALOG_CHANNEL_PREFIX}showMessage`,
  'platform.dialogShowConfirm': `${CHIPS_DIALOG_CHANNEL_PREFIX}showConfirm`,
  'plugin.install': `${CHIPS_PLUGIN_CHANNEL_PREFIX}install`,
  'plugin.enable': `${CHIPS_PLUGIN_CHANNEL_PREFIX}enable`,
  'plugin.disable': `${CHIPS_PLUGIN_CHANNEL_PREFIX}disable`,
  'plugin.uninstall': `${CHIPS_PLUGIN_CHANNEL_PREFIX}uninstall`,
  'plugin.query': `${CHIPS_PLUGIN_CHANNEL_PREFIX}query`,
  'platform.clipboardRead': `${CHIPS_CLIPBOARD_CHANNEL_PREFIX}read`,
  'platform.clipboardWrite': `${CHIPS_CLIPBOARD_CHANNEL_PREFIX}write`,
  'platform.shellOpenPath': `${CHIPS_SHELL_CHANNEL_PREFIX}openPath`,
  'platform.shellOpenExternal': `${CHIPS_SHELL_CHANNEL_PREFIX}openExternal`,
  'platform.shellShowItemInFolder': `${CHIPS_SHELL_CHANNEL_PREFIX}showItemInFolder`,
  'platform.getInfo': `${CHIPS_PLATFORM_CHANNEL_PREFIX}getInfo`,
  'platform.getCapabilities': `${CHIPS_PLATFORM_CHANNEL_PREFIX}getCapabilities`,
  'platform.getScreenInfo': `${CHIPS_PLATFORM_CHANNEL_PREFIX}getScreenInfo`,
  'platform.listScreens': `${CHIPS_PLATFORM_CHANNEL_PREFIX}listScreens`
};

const buildContext = (options?: BridgeContextOptions): RouteInvocationContext => {
  const callerType = options?.callerType ?? 'plugin';
  return {
    requestId: createId(),
    caller: {
      id: options?.callerId ?? 'renderer-preload',
      type: callerType,
      pluginId: callerType === 'plugin' ? options?.pluginId : undefined,
      permissions: sanitizePermissions(options?.permissions)
    },
    timestamp: now()
  };
};

const decodeIpcError = (error: unknown): StandardError | null => {
  if (!(error instanceof Error)) {
    return null;
  }

  if (!error.message.startsWith(CHIPS_IPC_ERROR_PREFIX)) {
    return null;
  }

  const payload = error.message.slice(CHIPS_IPC_ERROR_PREFIX.length);
  try {
    const parsed = JSON.parse(payload) as StandardError;
    if (typeof parsed.code === 'string' && typeof parsed.message === 'string') {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
};

export const createBridgeForKernel = (kernel: Kernel | null, options?: BridgeContextOptions): BridgeTransport => {
  const electron = loadElectronModule();
  if (electron?.ipcRenderer) {
    return new BridgeTransport(
      async <T>(action: string, payload: unknown) => {
        try {
          const context = buildContext(options);
          const channel = ACTION_CHANNEL_MAP[action] ?? CHIPS_INVOKE_CHANNEL;
          const request =
            channel === CHIPS_INVOKE_CHANNEL
              ? {
                  action,
                  payload,
                  context
                }
              : {
                  payload,
                  context
                };
          const result = await electron.ipcRenderer!.invoke(channel, request);
          return result as T;
        } catch (error) {
          const decoded = decodeIpcError(error);
          if (decoded) {
            throw decoded;
          }
          throw error;
        }
      },
      {
        eventAdapter: {
          on: (event, handler) => {
            const channel = `${CHIPS_EVENT_CHANNEL_PREFIX}${event}`;
            const listener = (_event: unknown, data: unknown) => {
              handler(data);
            };
            electron.ipcRenderer!.on(channel, listener);
            return () => {
              electron.ipcRenderer!.removeListener(channel, listener);
            };
          },
          once: (event, handler) => {
            const channel = `${CHIPS_EVENT_CHANNEL_PREFIX}${event}`;
            electron.ipcRenderer!.once(channel, (_event: unknown, data: unknown) => {
              handler(data);
            });
          },
          emit: (event, data) => {
            electron.ipcRenderer!.send(CHIPS_EMIT_CHANNEL, { event, data });
          }
        }
      }
    );
  }

  if (!kernel) {
    throw new Error('Kernel instance is required when Electron ipcRenderer is not available');
  }

  return new BridgeTransport(async (action, payload) => {
    return kernel.invoke(action, payload, buildContext(options));
  });
};

type ExposedPlatformBridge = ChipsBridge['platform'] & {
  getPathForFile(file: unknown): string;
  getLaunchContext(): {
    pluginId?: string;
    sessionId?: string;
    launchParams: Record<string, unknown>;
  };
};

const createExposedPlatformBridge = (
  platform: ChipsBridge['platform'],
  launchContext?: { pluginId?: string; sessionId?: string; launchParams?: Record<string, unknown> }
): ExposedPlatformBridge => {
  return {
    ...platform,
    getPathForFile(file: unknown): string {
      const electron = loadElectronModule();
      if (!electron?.webUtils?.getPathForFile) {
        return '';
      }

      try {
        return electron.webUtils.getPathForFile(file);
      } catch {
        return '';
      }
    },
    getLaunchContext() {
      return {
        pluginId: launchContext?.pluginId,
        sessionId: launchContext?.sessionId,
        launchParams: launchContext?.launchParams ? { ...launchContext.launchParams } : {}
      };
    }
  };
};

export const exposeBridgeToMainWorld = (
  bridge: BridgeTransport,
  name = 'chips',
  launchContext?: { pluginId?: string; sessionId?: string; launchParams?: Record<string, unknown> }
): void => {
  const exposed: ChipsBridge & { platform: ExposedPlatformBridge } = {
    invoke: bridge.invoke.bind(bridge),
    on: bridge.on.bind(bridge),
    once: bridge.once.bind(bridge),
    emit: bridge.emit.bind(bridge),
    window: bridge.window,
    dialog: bridge.dialog,
    plugin: bridge.plugin,
    clipboard: bridge.clipboard,
    shell: bridge.shell,
    platform: createExposedPlatformBridge(bridge.platform, launchContext),
    notification: bridge.notification,
    tray: bridge.tray,
    shortcut: bridge.shortcut,
    ipc: bridge.ipc
  };
  const electron = loadElectronModule();
  if (electron?.contextBridge) {
    electron.contextBridge.exposeInMainWorld(name, exposed);
    return;
  }

  const target = globalThis as Record<string, unknown>;
  target[name] = exposed;
};

export const createAndExposeBridgeForKernel = (
  kernel: Kernel | null,
  options?: BridgeContextOptions & {
    exposeName?: string;
    launchContext?: { pluginId?: string; sessionId?: string; launchParams?: Record<string, unknown> };
  }
): BridgeTransport => {
  const bridge = createBridgeForKernel(kernel, options);
  exposeBridgeToMainWorld(bridge, options?.exposeName ?? 'chips', options?.launchContext);
  return bridge;
};
