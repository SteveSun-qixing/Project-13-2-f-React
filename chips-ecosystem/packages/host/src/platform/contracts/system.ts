import type { PortCallContext } from './call.js';

/**
 * 对插件可见的平台标识；与能力契约 `system:info.platform` 取值一致。
 *
 * 权威：`04-能力契约规范` §7.14。
 */
export type SystemInfoPlatformId = 'darwin' | 'win32' | 'linux' | 'android' | 'ios';

/**
 * 平台目录变量名（不含 `${}` 包装）；变量语义见 `08-权限系统设计` §7.3。
 */
export const DIRECTORY_VARIABLE_NAMES = [
  'userHome',
  'userDocuments',
  'userDownloads',
  'userDesktop',
  'userPictures',
  'userMusic',
  'userVideos',
  'userData',
  'temp',
] as const;

/** 目录变量名。 */
export type DirectoryVariableName = (typeof DIRECTORY_VARIABLE_NAMES)[number];

/** 系统信息；与能力契约 `system:info` 输出一致。 */
export interface SystemInfo {
  /** 平台标识（插件可见值）。 */
  readonly platform: SystemInfoPlatformId;
  /** 操作系统版本。 */
  readonly osVersion: string;
  /** CPU 架构。 */
  readonly arch: string;
  /** 平台应用版本。 */
  readonly appVersion: string;
  /** 当前区域设置（BCP 47）。 */
  readonly locale: string;
  /** 目录变量解析结果（键为目录变量名）。 */
  readonly paths: Readonly<Record<DirectoryVariableName, string>>;
}

/**
 * 系统信息端口；对应 `system:info`。
 *
 * 权威：`04-能力契约规范` §7.14、`17-跨端Shell与平台抽象设计` §3.4。
 *
 * @remarks
 * 只返回只读信息；任一必需信息读取失败返回 `SYSTEM_INFO_UNAVAILABLE`，不返回残缺快照。
 */
export interface IPalSystemPort {
  /** 读取系统信息与目录变量解析结果。 */
  getInfo(call?: PortCallContext): Promise<SystemInfo>;
}
