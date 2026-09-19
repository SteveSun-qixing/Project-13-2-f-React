/**
 * 本地产物引擎：`plugin create` / `pack` / `validate` 的 CLI 侧实现
 * （[插件包格式] §7.1；[SDK API 规范] §8.1）。
 */

import { cliError } from '../errors.js';
import type { ICliArtifactsApi } from '../client/types.js';
import type { IFileSystemPort } from '../args/filesystem.js';
import {
  createDocumentedPermissionCatalog,
  type IPermissionCatalog,
} from './permission-catalog.js';
import { packCpk } from './cpk-pack.js';
import { validateCpk } from './cpk-validate.js';
import { resolveScaffoldProvider, writeScaffoldPlan, type IScaffoldProvider } from './scaffold.js';

/** 构造选项。 */
export interface ILocalArtifactsOptions {
  readonly fileSystem?: IFileSystemPort;
  readonly catalog?: IPermissionCatalog;
  /** 显式注入的脚手架生成器；缺省动态解析 `@chips/sdk/scaffold`。 */
  readonly scaffoldProvider?: IScaffoldProvider;
  /** 信任根注册表：keyId → Ed25519 公钥（SPKI PEM）。 */
  readonly trustRoots?: Readonly<Record<string, string>>;
}

/** 构造本地产物引擎。 */
export function createLocalArtifacts(options: ILocalArtifactsOptions = {}): ICliArtifactsApi {
  const catalog = options.catalog ?? createDocumentedPermissionCatalog();
  return {
    async create(input) {
      const provider = options.scaffoldProvider ?? (await resolveScaffoldProvider());
      if (provider === undefined) {
        throw cliError(
          'CLI_TARGET_UNAVAILABLE',
          'SDK 脚手架不可用：@chips/sdk/scaffold 未构建或未安装',
          {
            method: 'artifacts.create',
            hint: '请先构建 @chips/sdk，或通过 createLocalArtifacts 注入 scaffoldProvider',
          }
        );
      }
      const plan = provider.createPlan({
        role: input.role,
        pluginId: input.pluginId,
        name: input.name,
        targetDir: input.dir,
      });
      const written = writeScaffoldPlan(input.fileSystem, plan);
      return {
        pluginId: input.pluginId,
        role: input.role,
        targetDir: written.targetDir,
        files: written.files,
      };
    },
    pack: (input) =>
      toPortTask(() =>
        packCpk({
          fileSystem: input.fileSystem,
          dir: input.dir,
          ...(input.out === undefined ? {} : { out: input.out }),
          sign: input.sign,
          ...(input.keyId === undefined ? {} : { keyId: input.keyId }),
          ...(input.signingKeyFile === undefined ? {} : { signingKeyFile: input.signingKeyFile }),
          catalog,
        })
      ),
    validate: (input) =>
      toPortTask(() =>
        validateCpk({
          fileSystem: input.fileSystem,
          path: input.path,
          source: input.source,
          catalog,
          ...(input.platformVersion === undefined
            ? {}
            : { platformVersion: input.platformVersion }),
          ...(options.trustRoots === undefined ? {} : { trustRoots: options.trustRoots }),
        })
      ),
  };
}

/**
 * 同步引擎 → 异步端口契约：`packCpk` / `validateCpk` 按 `ICliArtifactsApi` 的调用时序在调用点
 * 同步执行完毕，引擎抛出的错误一律以拒绝形态透出（与 `async` 包装等价），调用方无需区分来源。
 */
function toPortTask<T>(engine: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    resolve(engine());
  });
}
