/**
 * 生产承载装配（工单039 波 3：`chips` 正式 bin 的承载链路装配位）。
 *
 * 装配链（《17-CLI承载链路契约》字段级条款逐一对应）：
 * - `userdataRoot` = `resolveDefaultUserdataRoot`（§2.2 跨平台发行布局在 CLI 面的唯一实现点，
 *   挂账①落点；禁止第二份散落推导，端点派生仍恒经 `@chips/bridge` `deriveCarrierEndpoints`）；
 * - carrier invoker = `createCarrierInvoker` + 按需启动缺省臂（§5.2 Q6(c)：解析锚点为
 *   本发行形态的正式入口 `dist/bin.js` realpath，工作区形态必然解析不出 → 现行 3 回退，
 *   §5.2-5 禁漂移条款）；
 * - `userdataRoot` 解析不出（平台必需环境根缺失）时按无承载定性：回退到 `createLocalClient`
 *   缺省静态拒绝 invoker（`CLI_TARGET_UNAVAILABLE`，发现阶段经 `run.ts` 既有链收口），
 *   不伪造根、不猜宿主安装位置；
 * - bin 生命周期：`client.dispose` 收口 carrier 会话（《17》§3.6 一次调用一次连接，
 *   用后即别）；拉起后宿主的存续/退出不入 v1（§5.2-6），本模块不加看护、不留悬挂 socket。
 *
 * dev/user 两入口共用本装配（Q8(a)/§5.5 并轨：开发宿主 = 同一 carrier 协议的工作区实例，
 * `devHost` 缺省臂在 `service-router.ts` 内经同一 invoker 触达，无第二套 dev 端点）。
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';

import type { ICliClient } from '../client/types.js';
import {
  createCarrierInvoker,
  createDefaultHostLauncherConfig,
  resolveDefaultUserdataRoot,
  type ICarrierInvoker,
  type ICarrierLaunchConfig,
} from '../client/carrier/index.js';
import type { IFileSystemPort } from '../args/filesystem.js';
import type { IPidProbe } from '../client/carrier/discovery.js';
import type { CarrierSocketFactory } from '../client/carrier/transport.js';
import { createLocalClient, type ILocalClientOptions } from './local-client.js';

/** 生产装配选项：本地产物引擎选项之外，承载链路面全部注入化（测试/e2e 等形驱动）。 */
export interface IProductionClientOptions extends ILocalClientOptions {
  /** 环境变量视图（缺省 `process.env`）。 */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** 平台标识（缺省 `process.platform`；命名避开 `ILocalClientOptions.platform` 适配器位）。 */
  readonly hostPlatform?: NodeJS.Platform;
  /** `userData` 根显式覆盖（发行装配缺省走 §2.2 布局解析）。 */
  readonly userdataRoot?: string;
  /** CLI 正式入口文件（§5.2-2 解析锚点；缺省为本发行布局 `dist/bin.js`）。 */
  readonly cliEntryFile?: string;
  /** 按需启动配置覆盖（缺省 `createDefaultHostLauncherConfig`）。 */
  readonly launch?: ICarrierLaunchConfig;
  /** 文件端口注入位（透传 carrier 客户端）。 */
  readonly fileSystem?: IFileSystemPort;
  /** 进程判据探针注入位（透传 carrier 客户端）。 */
  readonly pidProbe?: IPidProbe;
  /** 端点连接工厂注入位（透传 carrier 客户端）。 */
  readonly connect?: CarrierSocketFactory;
}

/**
 * 组装生产客户端：carrier 承载在场时以正式装配链接（含 §5.2 按需启动臂），
 * 否则回退本地缺省（无承载定性）。
 */
export function createProductionClient(options: IProductionClientOptions = {}): ICliClient {
  const env = options.env ?? process.env;
  const hostPlatform = options.hostPlatform ?? process.platform;
  const userdataRoot = options.userdataRoot ?? resolveDefaultUserdataRoot(hostPlatform, env);
  if (userdataRoot === null) {
    // 平台必需环境根缺失：无承载定性（§5.4），不伪造根、不猜宿主安装位置（§5.2-5）。
    return createLocalClient(options);
  }
  const carrier: ICarrierInvoker = createCarrierInvoker({
    userdataRoot,
    env,
    ...(options.fileSystem === undefined ? {} : { fileSystem: options.fileSystem }),
    ...(options.pidProbe === undefined ? {} : { pidProbe: options.pidProbe }),
    ...(options.connect === undefined ? {} : { connect: options.connect }),
    launch:
      options.launch ??
      createDefaultHostLauncherConfig(options.cliEntryFile ?? defaultCliEntryFile()),
  });
  const client = createLocalClient({
    ...options,
    invoker: carrier,
  });
  return { ...client, dispose: (): void => carrier.dispose() };
}

/** 发行形态解析锚点：本模块编译落 `dist/runtime/`，bin 在册位置为同级 `dist/bin.js`。 */
function defaultCliEntryFile(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(moduleDir, '..', 'bin.js');
}
