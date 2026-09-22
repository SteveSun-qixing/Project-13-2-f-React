/**
 * 窗口安全基线与加载地址白名单。
 *
 * 权威：`ADR-002` §安全配置、`17-跨端Shell与平台抽象设计` §3.3 SB-8 / SL-10、
 * `05-渲染引擎设计` §4.3（CSP）、`06-资源协议规范` §9.5。
 */

import { parseResourceUri } from '../protocol/resource-uri.js';

/** 窗口安全基线；不可被调用方覆盖。 */
export const WINDOW_SECURITY_BASELINE = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  webviewTag: false,
} as const;

/** 主窗口 CSP（`05-渲染引擎设计` §4.3）。 */
export const MAIN_WINDOW_CSP = [
  "default-src 'self'",
  "script-src 'self' chips-resource:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: chips-resource:",
  "font-src 'self' chips-resource:",
  "media-src 'self' chips-resource:",
  'frame-src chips-resource:',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** 壳自检页 CSP（`shell.html` 内联声明之外的运行时口径；文档同 §4.3 主窗口）。 */
export const SHELL_WINDOW_CSP = MAIN_WINDOW_CSP;

/**
 * 渲染帧 CSP（帧文档 `entries/frame.html` 携带的权威口径；§4.3 渲染帧形唯一交付面）。
 *
 * @remarks
 * - 与主窗口形的逐值差即收紧清单（任务 #190 N-3，比照工单043-A4「显式钉死」母型）：
 *   `default-src` 收 `'none'`、`script-src` 去 `'self'`、`style-src`/`img-src`/`base-uri`
 *   源集切换为 `chips-resource:` 口径、`connect-src 'none'` 整条补入（帧内没有网络直连、
 *   外部资源统一经资源代理——05.04 §4.3 规则与 08.04 §1.4 在册约束）。
 * - `frame-src` 取 §4.3 规则的**卡片帧臂** `'none'`：host 当前生产面唯一活帧形即卡片帧
 *   （`render-engine` 以 role `'card'` 构造 `CardFrameHost`），条目帧为叶帧不建子帧
 *   （§4.5）。布局帧臂 `frame-src chips-resource:` 的按帧种类下发机制归箱子渲染波次
 *   （§4.1 单一帧文档源与逐帧种类 CSP 的落地形态需《05.04》两臂区分随动，#190 勘查登记）。
 */
export const RENDER_FRAME_CSP = [
  "default-src 'none'",
  'script-src chips-resource:',
  "style-src chips-resource: 'unsafe-inline'",
  'img-src chips-resource: data:',
  'media-src chips-resource:',
  'font-src chips-resource:',
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  'base-uri chips-resource:',
  "form-action 'none'",
].join('; ');

/** 渲染帧 CSP 指令 → 权威形源集（§4.3 渲染帧块逐值在册；顺序与词数一并钉死）。 */
const RENDER_FRAME_CSP_DIRECTIVES: Readonly<Record<string, string>> = Object.freeze({
  'default-src': "'none'",
  'script-src': 'chips-resource:',
  'style-src': "chips-resource: 'unsafe-inline'",
  'img-src': 'chips-resource: data:',
  'media-src': 'chips-resource:',
  'font-src': 'chips-resource:',
  'connect-src': "'none'",
  'frame-src': "'none'",
  'object-src': "'none'",
  'base-uri': 'chips-resource:',
  'form-action': "'none'",
});

/** 把 CSP 文本解析为「指令名（小写）→ 源集文本（空白归一）」映射；重复指令视为漂移。 */
function parseCspDirectives(csp: string): Map<string, string> {
  const directives = new Map<string, string>();
  for (const raw of csp.split(';')) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const spaceIndex = trimmed.search(/\s/);
    const name = (spaceIndex < 0 ? trimmed : trimmed.slice(0, spaceIndex)).toLowerCase();
    const sources =
      spaceIndex < 0
        ? ''
        : trimmed
            .slice(spaceIndex + 1)
            .trim()
            .replace(/\s+/g, ' ');
    if (directives.has(name)) {
      directives.set(name, '\u0000重复指令\u0000');
      continue;
    }
    directives.set(name, sources);
  }
  return directives;
}

/**
 * 渲染帧 CSP 安全硬闸（A4 母型：缺位、放宽、漂移、追加指令任一破防即抛错拒交付）。
 *
 * @param csp 待校验的 CSP 文本（帧文档 `meta` 声明或常量形态）。
 * @throws {Error} 指令缺失、源集与 §4.3 渲染帧权威形不符、出现权威形之外的指令或重复指令时抛出。
 */
export function assertSecureRenderFrameCsp(csp: string): void {
  const directives = parseCspDirectives(csp);
  for (const [name, expected] of Object.entries(RENDER_FRAME_CSP_DIRECTIVES)) {
    const actual = directives.get(name);
    if (actual === undefined) {
      throw new Error(`渲染帧 CSP 被放宽：缺少权威指令 ${name}（权威形源集 ${expected}）`);
    }
    if (actual !== expected) {
      throw new Error(`渲染帧 CSP 被放宽：${name} 必须为 ${expected}，实为 ${actual.length === 0 ? '（空）' : actual}`);
    }
    directives.delete(name);
  }
  for (const leftover of directives.keys()) {
    throw new Error(`渲染帧 CSP 携带权威形之外的指令 ${leftover}（变更需评审，禁止随手追加）`);
  }
}

// 构造期硬闸：唯一交付面常量自身必须逐字过闸（与 `createSecureWindowWebPreferences`
// 「构造 + 断言一体」同型——常量在模块装载即钉，测试面锁 frame.html 声明与之一致）。
assertSecureRenderFrameCsp(RENDER_FRAME_CSP);

/** 构造 webPreferences 的输入。 */
export interface WindowPreferencesInput {
  /** preload 脚本绝对路径。 */
  readonly preload: string;
  /** 会话 partition；壳为每个窗口分配独立 partition（协议路径会话解析依据）。 */
  readonly partition?: string;
  /** 附加命令行参数（供渲染进程诊断使用；不得携带敏感信息）。 */
  readonly additionalArguments?: readonly string[];
}

/**
 * 构造满足安全基线的 `webPreferences`。
 *
 * @param input preload 路径与 partition。
 * @throws {Error} preload 路径为空时抛出。
 */
export function buildWindowWebPreferences(input: WindowPreferencesInput): Readonly<Record<string, unknown>> {
  if (input.preload.length === 0) {
    throw new Error('窗口 webPreferences 缺少 preload 路径');
  }
  const preferences: Record<string, unknown> = {
    ...WINDOW_SECURITY_BASELINE,
    preload: input.preload,
  };
  if (input.partition !== undefined) {
    preferences.partition = input.partition;
  }
  if (input.additionalArguments !== undefined) {
    preferences.additionalArguments = [...input.additionalArguments];
  }
  return Object.freeze(preferences);
}

/**
 * 校验 webPreferences 是否仍满足安全基线。
 *
 * @param preferences 待校验配置。
 * @throws {Error} 任一基线项被覆盖或放宽时抛出。
 */
export function assertSecureWebPreferences(preferences: Readonly<Record<string, unknown>>): void {
  for (const [key, expected] of Object.entries(WINDOW_SECURITY_BASELINE)) {
    if (preferences[key] !== expected) {
      throw new Error(`窗口安全基线被破坏：${key} 必须为 ${String(expected)}`);
    }
  }
}

/**
 * 窗口 `webPreferences` 唯一构造工厂：构造 + 基线硬闸一体交付（工单043-A4 裁定）。
 *
 * @remarks
 * - `sandbox` / `contextIsolation` / `nodeIntegration` 等全部基线项由
 *   {@link WINDOW_SECURITY_BASELINE} **显式钉死为安全值**（逐字写死，不依赖 Electron
 *   任何版本的默认值）；构造产物恒过 {@link assertSecureWebPreferences}，两道闸任何
 *  一道破防即抛错拒交付——壳窗口（`window-manager.ts`）与 PAL 窗口
 *   （`app-launch.ts` / `self-check.ts`）的全部构造点统一走本工厂，无旁路。
 * @param input preload 路径与 partition。
 * @returns 满足安全基线的冻结 `webPreferences`。
 * @throws {Error} preload 缺位或基线校验不过时抛出。
 */
export function createSecureWindowWebPreferences(input: WindowPreferencesInput): Readonly<Record<string, unknown>> {
  const preferences = buildWindowWebPreferences(input);
  assertSecureWebPreferences(preferences);
  return preferences;
}

/**
 * 判断窗口加载地址是否合法。
 *
 * 规则：只允许 `chips-resource://` 规范 URI（平台页与插件页统一经资源协议加载）；
 * 禁止 `file://`、裸 `http(s)://` 与任意本地路径（`06-资源协议规范` §10 约束 1）。
 */
export function isAllowedWindowLoadUrl(url: string): boolean {
  const result = parseResourceUri(url);
  return result.ok;
}
