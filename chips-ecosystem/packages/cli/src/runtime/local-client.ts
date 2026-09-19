/**
 * 本地客户端：无平台承载环境时的 `CliClient` 组装。
 *
 * - 本地产物引擎（`plugin create` / `pack` / `validate`）为完整实现，离线可用；
 * - 平台操作与 `cli.command.*` / `cli.task.*` 路由在承载适配器缺失时返回
 *   `CLI_TARGET_UNAVAILABLE`（[CLI 完整参考] §2.5），不虚构协议、不静默降级。
 */

import { cliError } from '../errors.js';
import type {
  ICliAppLaunchOperations,
  ICliClient,
  ICliInvoker,
  ICliPlatformOperations,
  ICliDevHostOperations,
} from '../client/types.js';
import { createServiceRouterClient } from '../client/service-router.js';
import { createLocalArtifacts, type ILocalArtifactsOptions } from '../artifacts/index.js';

/** 组装选项。 */
export interface ILocalClientOptions extends ILocalArtifactsOptions {
  /** 承载适配器注入点；平台发行包 / 宿主提供。 */
  readonly invoker?: ICliInvoker;
  readonly platform?: ICliPlatformOperations;
  readonly apps?: ICliAppLaunchOperations;
  readonly devHost?: ICliDevHostOperations;
}

/** 组装本地客户端。 */
export function createLocalClient(options: ILocalClientOptions = {}): ICliClient {
  const artifacts = createLocalArtifacts(options);
  const invoker: ICliInvoker = options.invoker ?? {
    // 无承载环境：`ICliInvoker.request` 的契约是 Promise，缺省实现以拒绝形态透出错误。
    request: (id: string): Promise<never> =>
      Promise.reject(
        cliError('CLI_TARGET_UNAVAILABLE', `缺少平台承载环境：无法调用 ${id}`, {
          route: id,
          hint: '请在平台发行包内运行 chips，或通过 createServiceRouterClient 注入承载适配器',
        })
      ),
  };
  return createServiceRouterClient({
    invoker,
    artifacts,
    ...(options.platform === undefined ? {} : { platform: options.platform }),
    ...(options.apps === undefined ? {} : { apps: options.apps }),
    ...(options.devHost === undefined ? {} : { devHost: options.devHost }),
  });
}
