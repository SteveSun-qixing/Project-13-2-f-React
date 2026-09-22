/**
 * 窗口导航拦截位：新窗口请求全拒 + 导航地址白名单（工单043-A4 §四.6 裁定「补最小拦截位」）。
 *
 * 权威：`02-Bridge三层设计` §7.4（会话与窗口绑定统一入口）、`06-资源协议规范` §10 约束 1
 * （窗口只经 `chips-resource://` 加载，禁 `file://` 与裸 `http(s)://`）、
 * `17-跨端Shell与平台抽象设计` §3.3 SB-8 / SL-10。
 *
 * @remarks
 * - **挂接位唯一**：{@link attachWindowNavigationGuards} 只在 `WebContentsBinder.bind` 内调用。
 *   所有窗口（壳自建窗口与内核经 PAL 端口创建的窗口）统一经
 *   `app.on('web-contents-created')` 进入绑定器（该模块头注既有裁定），故每个窗口内容
 *   恰好挂接一次，无第二处、无旁路。
 * - `setWindowOpenHandler`：任何渲染进程发起的新窗口请求一律回 `{ action: 'deny' }` 并记
 *   `warn` 诊断——窗口创建只有主进程通道一条路。
 * - `will-navigate`：地址过 {@link isAllowedWindowLoadUrl}（唯一合法 scheme
 *   `chips-resource://`）放行，其余 `preventDefault` 并记 `warn` 诊断。
 * - 切片缺位即跳过：真实 Electron 路径由 `electron-adapter.ts` 恒供两法（缺原始方法即抛
 *   `HostStartupError`），因此缺位只出现在测试替身面；挂接抛错由绑定器 fail-closed 关窗。
 */

import type { DiagnosticsSink } from '../shared/diagnostics.js';
import { isAllowedWindowLoadUrl } from './window-security.js';
import type { ShellWebContents, ShellWindowOpenDisposition } from './shell-api.js';

/** 本模块诊断 scope。 */
export const NAVIGATION_GUARD_DIAGNOSTIC_SCOPE = 'navigation';

/**
 * 为窗口内容挂接导航拦截位（新窗口全拒 + 导航白名单）。
 *
 * @param webContents 窗口内容切片。
 * @param diagnostics 诊断口（拦截事件留痕，含 `windowId` 与被拦地址）。
 */
export function attachWindowNavigationGuards(webContents: ShellWebContents, diagnostics: DiagnosticsSink): void {
  if (typeof webContents.setWindowOpenHandler !== 'function' || typeof webContents.onWillNavigate !== 'function') {
    return;
  }
  const windowId = webContents.id;
  const dispositionFor = (url: string): ShellWindowOpenDisposition => {
    diagnostics.warn(NAVIGATION_GUARD_DIAGNOSTIC_SCOPE, '拒绝渲染进程发起的新窗口请求', {
      windowId,
      url,
      reason: 'window-open-denied',
    });
    return { action: 'deny' };
  };
  webContents.setWindowOpenHandler((details) => dispositionFor(details.url));
  webContents.onWillNavigate((event, url) => {
    if (isAllowedWindowLoadUrl(url)) {
      return;
    }
    event.preventDefault();
    diagnostics.warn(NAVIGATION_GUARD_DIAGNOSTIC_SCOPE, '拦截非白名单窗口导航', {
      windowId,
      url,
      reason: 'navigation-not-allowed',
    });
  });
}
