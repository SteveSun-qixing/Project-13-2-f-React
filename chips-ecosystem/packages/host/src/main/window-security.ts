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
 * 判断窗口加载地址是否合法。
 *
 * 规则：只允许 `chips-resource://` 规范 URI（平台页与插件页统一经资源协议加载）；
 * 禁止 `file://`、裸 `http(s)://` 与任意本地路径（`06-资源协议规范` §10 约束 1）。
 */
export function isAllowedWindowLoadUrl(url: string): boolean {
  const result = parseResourceUri(url);
  return result.ok;
}
