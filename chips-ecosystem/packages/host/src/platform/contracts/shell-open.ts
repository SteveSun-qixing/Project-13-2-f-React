import type { PortCallContext } from './call.js';

/**
 * 外部打开端口；对应 `shell:openExternal` 与资源打开路由的 `shell` 降级臂（平台内部调用）。
 *
 * 权威：`04-能力契约规范` §7.8、`14-资源打开与默认处理器契约` §4.6
 * （`mode: 'shell'` 由平台内部完成系统调用，不经 `shell:openExternal` 能力、不要求调用方权限）。
 *
 * @remarks
 * `openExternal` 仅放行 `http` / `https` / `mailto`；其余 scheme 返回 `SHELL_SCHEME_DENIED`
 * （SB-6 不做二次放宽）。打开失败返回 `SHELL_OPEN_FAILED`。
 */
export interface IPalShellOpenPort {
  /** 用系统默认程序打开外部 URL。 */
  openExternal(url: string, call?: PortCallContext): Promise<void>;
  /**
   * 用操作系统默认程序打开本地路径（`14` §4.6 `mode: 'shell'` 的平台内部降级臂；
   * 仅由资源打开路由在未命中降级时调用，不经任何能力面暴露）。
   * 路径不存在或系统打开失败返回 `SHELL_OPEN_FAILED`。
   */
  openPath(path: string, call?: PortCallContext): Promise<void>;
}
