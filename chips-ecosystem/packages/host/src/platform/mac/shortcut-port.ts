import type { IPalShortcutPort, PortCallContext } from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import type { ElectronShortcutLike } from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/** Electron 加速键合法修饰符（大小写不敏感）。 */
const ACCELERATOR_MODIFIERS = new Set([
  'command',
  'cmd',
  'control',
  'ctrl',
  'commandorcontrol',
  'cmdorctrl',
  'alt',
  'option',
  'altgr',
  'shift',
  'super',
  'meta',
]);

/** Electron 加速键合法命名键（大小写不敏感，另有单字符键与标点）。 */
const ACCELERATOR_NAMED_KEYS = new Set([
  'plus',
  'space',
  'tab',
  'capslock',
  'numlock',
  'scrolllock',
  'backspace',
  'delete',
  'insert',
  'return',
  'enter',
  'up',
  'down',
  'left',
  'right',
  'home',
  'end',
  'pageup',
  'pagedown',
  'escape',
  'esc',
  'volumeup',
  'volumedown',
  'volumemute',
  'medianexttrack',
  'mediaprevioustrack',
  'mediastop',
  'mediaplaypause',
  'printscreen',
]);

/** Electron 加速键合法标点。 */
const ACCELERATOR_PUNCTUATION = new Set([
  ')',
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ':',
  ';',
  ',',
  '.',
  '/',
  '<',
  '>',
  '?',
  '[',
  ']',
  '\\',
  '|',
  '{',
  '}',
  '~',
  '"',
  "'",
  '=',
  '-',
  '_',
]);

/**
 * 判断字符串是否为合法的 Electron 加速键文法。
 *
 * @param accelerator 待校验的快捷键（如 `CommandOrControl+S`）。
 * @returns 文法合法时为 `true`。
 */
export function isValidAccelerator(accelerator: string): boolean {
  if (typeof accelerator !== 'string' || accelerator.length === 0) {
    return false;
  }
  const tokens = accelerator.split('+');
  if (tokens.some((token) => token.length === 0)) {
    return false;
  }
  const key = tokens[tokens.length - 1];
  if (key === undefined || !isAcceleratorKey(key)) {
    return false;
  }
  const seenModifiers = new Set<string>();
  for (const modifier of tokens.slice(0, -1)) {
    const normalized = modifier.toLowerCase();
    if (!ACCELERATOR_MODIFIERS.has(normalized) || seenModifiers.has(normalized)) {
      return false;
    }
    seenModifiers.add(normalized);
  }
  return true;
}

/** 判断键名是否合法。 */
function isAcceleratorKey(key: string): boolean {
  if (/^[A-Za-z0-9]$/.test(key)) {
    return true;
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(key)) {
    return true;
  }
  return ACCELERATOR_NAMED_KEYS.has(key.toLowerCase()) || ACCELERATOR_PUNCTUATION.has(key);
}

/**
 * 创建 macOS 全局快捷键端口。
 *
 * 权威：`04-能力契约规范` §7.9。
 *
 * @param globalShortcut Electron `globalShortcut` 模块切片。
 * @returns `shortcut:*` 端口实现。
 */
export function createMacShortcutPort(globalShortcut: ElectronShortcutLike): IPalShortcutPort {
  const registrations = new Map<string, { accelerator: string; onTrigger: () => void }>();

  const release = (shortcutId: string): void => {
    const existing = registrations.get(shortcutId);
    if (existing === undefined) {
      return;
    }
    registrations.delete(shortcutId);
    try {
      globalShortcut.unregister(existing.accelerator);
    } catch {
      // 进程退出或系统已释放；注销保持幂等语义。
    }
  };

  return {
    async register(
      shortcutId: string,
      accelerator: string,
      onTrigger: () => void,
      call?: PortCallContext,
    ): Promise<void> {
      assertCallActive(call);
      if (shortcutId.length === 0 || !isValidAccelerator(accelerator)) {
        throw new PalPortError(PAL_ERROR_CODES.SHORTCUT_ACCELERATOR_INVALID);
      }

      release(shortcutId);

      if (globalShortcut.isRegistered(accelerator)) {
        throw new PalPortError(PAL_ERROR_CODES.SHORTCUT_CONFLICT, undefined, {
          details: { accelerator },
        });
      }

      let registered = false;
      try {
        registered = globalShortcut.register(accelerator, onTrigger);
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.SHORTCUT_REGISTER_FAILED, undefined, { cause: error });
      }
      if (!registered) {
        throw new PalPortError(PAL_ERROR_CODES.SHORTCUT_REGISTER_FAILED, undefined, {
          details: { accelerator },
        });
      }
      registrations.set(shortcutId, { accelerator, onTrigger });
      return Promise.resolve();
    },

    async unregister(shortcutId: string, call?: PortCallContext): Promise<void> {
      assertCallActive(call);
      release(shortcutId);
      return Promise.resolve();
    },
  };
}
