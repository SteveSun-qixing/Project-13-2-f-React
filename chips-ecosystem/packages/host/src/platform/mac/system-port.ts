import { release } from 'node:os';
import type {
  DirectoryVariableName,
  IPalSystemPort,
  PortCallContext,
  SystemInfo,
  SystemInfoPlatformId,
} from '../contracts/index.js';
import { DIRECTORY_VARIABLE_NAMES } from '../contracts/index.js';
import { assertCallActive } from '../call-guard.js';
import type { ElectronAppLike, ElectronPathName } from '../electron/electron-api.js';
import { PAL_ERROR_CODES, PalPortError } from '../errors.js';

/** macOS 系统端口所需依赖。 */
export interface MacSystemPortDependencies {
  /** Electron `app` 模块切片。 */
  readonly app: ElectronAppLike;
  /** 进程架构（默认 `process.arch`）。 */
  readonly arch?: string;
  /** Electron `process.getSystemVersion()`（Electron 扩展）；缺省时回退 `os.release()`。 */
  readonly getSystemVersion?: () => string;
}

/** 目录变量名到 Electron `app.getPath` 目录名的映射。 */
export const DIRECTORY_PATH_NAMES: Readonly<Record<DirectoryVariableName, ElectronPathName>> = {
  userHome: 'home',
  userDocuments: 'documents',
  userDownloads: 'downloads',
  userDesktop: 'desktop',
  userPictures: 'pictures',
  userMusic: 'music',
  userVideos: 'videos',
  userData: 'userData',
  temp: 'temp',
};

/**
 * 创建 macOS 系统信息端口。
 *
 * 权威：`04-能力契约规范` §7.14、`17-跨端Shell与平台抽象设计` §3.4。
 *
 * @param dependencies 注入依赖（真实 Electron `app` 或测试 mock）。
 * @returns `system:info` 端口实现。
 */
export function createMacSystemPort(dependencies: MacSystemPortDependencies): IPalSystemPort {
  const { app } = dependencies;
  const arch = dependencies.arch ?? process.arch;
  const getSystemVersion = dependencies.getSystemVersion;

  return {
    async getInfo(call?: PortCallContext): Promise<SystemInfo> {
      assertCallActive(call);
      try {
        const osVersion = typeof getSystemVersion === 'function' ? getSystemVersion() : release();
        const appVersion = app.getVersion();
        const locale = app.getLocale();
        const paths = {} as Record<DirectoryVariableName, string>;
        for (const variable of DIRECTORY_VARIABLE_NAMES) {
          const value = app.getPath(DIRECTORY_PATH_NAMES[variable]);
          if (typeof value !== 'string' || value.length === 0) {
            throw new Error(`empty path for ${variable}`);
          }
          paths[variable] = value;
        }
        return Promise.resolve({
          platform: resolveSystemInfoPlatform(),
          osVersion,
          arch,
          appVersion,
          locale,
          paths,
        });
      } catch (error) {
        throw new PalPortError(PAL_ERROR_CODES.SYSTEM_INFO_UNAVAILABLE, undefined, {
          cause: error,
        });
      }
    },
  };
}

/**
 * 把内部平台标识映射为插件可见的平台标识。
 *
 * @returns `darwin`（macOS）。
 *
 * @remarks
 * 内部 `PlatformId` 按 17 号文档 §4.2 取 `macos`；`system:info.platform` 按能力契约
 * §7.14 取 Node/Electron 口径 `darwin`。
 */
export function resolveSystemInfoPlatform(): SystemInfoPlatformId {
  return 'darwin';
}
