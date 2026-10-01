import type { IPalShellOpenPort, PortCallContext } from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import type { ElectronShellLike } from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/** `shell:openExternal` 允许的 scheme 集合。 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/**
 * 创建 macOS 外部打开端口。
 *
 * 权威：`04-能力契约规范` §7.8、`14-资源打开与默认处理器契约` §4.6（`openPath` 平台内部降级臂）。
 *
 * @param shell Electron `shell` 模块切片。
 * @returns `shell:openExternal` / `openPath` 端口实现。
 *
 * @remarks
 * - `openExternal` 端口做系统级 scheme 白名单兜底（`http` / `https` / `mailto`），
 *   其余返回 `SHELL_SCHEME_DENIED`；域名限定值判定仍在核心（SB-6）。
 * - `openExternal` / `openPath` 失败返回 `SHELL_OPEN_FAILED`。
 */
export function createMacShellOpenPort(shell: ElectronShellLike): IPalShellOpenPort {
  return {
    async openExternal(url: string, call?: PortCallContext): Promise<void> {
      assertCallActive(call);
      const scheme = readScheme(url);
      if (scheme === null || !ALLOWED_SCHEMES.has(scheme)) {
        throw new PalPortError(PAL_ERROR_CODES.SHELL_SCHEME_DENIED, undefined, {
          details: { scheme: scheme ?? null },
        });
      }
      try {
        await shell.openExternal(url);
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.SHELL_OPEN_FAILED, undefined, { cause: error });
      }
    },
    async openPath(path: string, call?: PortCallContext): Promise<void> {
      assertCallActive(call);
      let failure: string;
      try {
        failure = await shell.openPath(path);
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.SHELL_OPEN_FAILED, undefined, { cause: error });
      }
      if (typeof failure === 'string' && failure.length > 0) {
        throw new PalPortError(PAL_ERROR_CODES.SHELL_OPEN_FAILED, undefined, { details: { reason: failure } });
      }
    },
  };
}

/** 读取 URL scheme（小写，含冒号）；无法解析时返回 `null`。 */
function readScheme(url: string): string | null {
  const match = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url);
  return match?.[1] === undefined ? null : `${match[1].toLowerCase()}:`;
}
