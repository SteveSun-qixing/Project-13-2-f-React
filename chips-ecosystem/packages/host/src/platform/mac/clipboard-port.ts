import type { IPalClipboardPort, PortCallContext } from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import type { ElectronClipboardLike } from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/**
 * 创建 macOS 剪贴板端口。
 *
 * 权威：`04-能力契约规范` §7.6。
 *
 * @param clipboard Electron `clipboard` 模块切片。
 * @returns `clipboard:*` 端口实现。
 *
 * @remarks
 * - 系统空字符串归一为 `null`（Electron 无法区分"无文本"与"空文本"）。
 * - 读取与写入失败返回 `CLIPBOARD_UNAVAILABLE`；端口不写日志、不落盘。
 */
export function createMacClipboardPort(clipboard: ElectronClipboardLike): IPalClipboardPort {
  return {
    async readText(call?: PortCallContext): Promise<string | null> {
      assertCallActive(call);
      try {
        const text = clipboard.readText();
        return Promise.resolve(text.length === 0 ? null : text);
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.CLIPBOARD_UNAVAILABLE, undefined, { cause: error });
      }
    },

    async writeText(text: string, call?: PortCallContext): Promise<void> {
      assertCallActive(call);
      try {
        clipboard.writeText(text);
        return Promise.resolve();
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.CLIPBOARD_UNAVAILABLE, undefined, { cause: error });
      }
    },
  };
}
