import type { PortCallContext } from './call.js';

/**
 * 外部打开端口；对应 `shell:openExternal`。
 *
 * 权威：`04-能力契约规范` §7.8。
 *
 * @remarks
 * 仅放行 `http` / `https` / `mailto`；其余 scheme 返回 `SHELL_SCHEME_DENIED`（SB-6 不做二次放宽）。
 * 打开失败返回 `SHELL_OPEN_FAILED`。
 */
export interface IPalShellOpenPort {
  /** 用系统默认程序打开外部 URL。 */
  openExternal(url: string, call?: PortCallContext): Promise<void>;
}
