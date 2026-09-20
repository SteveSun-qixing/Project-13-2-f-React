/**
 * 平台窗口入口注册表（构建产物路径与装载 URI 的单一事实源）。
 *
 * 权威：`05-渲染引擎设计` §3.1（渲染进程安全基线与入口装载）、§9.1（帧入口 URL 携带一次性
 * 握手令牌 fragment）、`17-跨端Shell与平台抽象设计` §3.2（壳页与脚本经
 * `chips-resource://platform/*` 装载）、`06-资源协议规范` §9.5（`platform` 保留作用域）。
 *
 * @remarks
 * - 本模块是「壳入口清单」的唯一登记处：`vite.renderer.config.ts` 的输入清单、
 *   `scripts/copy-renderer-html.mjs` 的 HTML 复制清单与渲染侧常量化为同一份路径；
 *   三方一致性由 `tests/host-entry-registry.test.ts` 锁定，任一侧漂移即红。
 * - 窗口装载 URI 必须是 `chips-resource://` 规范 URI（`window-security.isAllowedWindowLoadUrl`）；
 *   规范 URI 禁止 query 与 fragment（`06-资源协议规范` §2 语法），因此入口页在打开时不携带
 *   文档参数——窗口的文档绑定由主进程编排方（`card-window-orchestrator.ts`）登记。
 * - 帧入口（iframe 子帧）例外：`CardFrameHost` 按 §9.1 在 URL 上追加一次性握手令牌
 *   fragment；fragment 不参与资源协议的路径解析，仅子帧脚本可读。
 */

/** 入口相对 `dist/renderer` 根的 HTML 路径。 */
export const PLATFORM_ENTRY_HTML = {
  /** 壳自检页（窗口壳的默认启动页）。 */
  shell: 'shell.html',
  /** 卡片窗口入口（应用窗口壳：RenderHost 组合根）。 */
  card: 'entries/card.html',
  /** 平台帧运行时入口（渲染帧 iframe 子页，帧协议子帧侧）。 */
  frame: 'entries/frame.html',
} as const;

/** 入口类型标识。 */
export type PlatformEntryName = keyof typeof PLATFORM_ENTRY_HTML;

/** `chips-resource://platform/<html>` 形态的窗口装载 URI（规范形态，无 query / fragment）。 */
export const PLATFORM_ENTRY_URLS: Readonly<Record<PlatformEntryName, string>> = Object.freeze({
  shell: `chips-resource://platform/${PLATFORM_ENTRY_HTML.shell}`,
  card: `chips-resource://platform/${PLATFORM_ENTRY_HTML.card}`,
  frame: `chips-resource://platform/${PLATFORM_ENTRY_HTML.frame}`,
} as const);

/** 卡片窗口装载 URI（`CardWindowOrchestrator` 唯一允许加载的入口）。 */
export const CARD_WINDOW_ENTRY_URL: string = PLATFORM_ENTRY_URLS.card;

/** 平台帧运行时入口 URL（`IRenderFrameEnvironment.frameEntryUrl` 的生产取值）。 */
export const FRAME_ENTRY_URL: string = PLATFORM_ENTRY_URLS.frame;
