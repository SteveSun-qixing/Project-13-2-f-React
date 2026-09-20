/**
 * `.cpk` 安装：临时目录写入 → 全量校验 → 原子重命名落盘（《03-插件架构设计》§4.2、
 * 《03-插件包格式》§5.2[5]）。
 *
 * 权威：`01-架构设计/01-子系统设计/03.04-插件架构设计-四、生命周期流程` §4.2（安装流程
 * [1]~[7]：校验 → 版本与冲突检查 → 原子落盘 → 写注册表/发布事件）、
 * `03.05/03.06`（包校验与签名）、`04-文件格式规范/03-插件包格式` §五。
 *
 * @remarks
 * - 落盘顺序（§4.2[6]）：全部成员先写入临时目录（与 `pluginsRoot` 同卷，保证 `rename`
 *   原子性），五阶段校验与版本冲突检查全部通过后才 `rename` 到 `pluginsRoot/<id>/<version>/`；
 *   任一步失败清理临时目录，**不留半成品、不产生注册表记录**（§4.2 规则）。
 * - 版本与冲突检查（§4.2[4]）：同 ID 重复安装（更新、降级、同版本）一律拒绝——同 ID 更新
 *   必须走 §6.2 蓝绿替换流程，普通安装路径不承接；契约面无独立「降级」错误码
 *   （`03-插件包格式` §八 11 码不含，`KERNEL_*` 亦无同名码，裁决登记开发日志），
 *   统一落 `KERNEL_INVALID_TRANSITION`（确定性拒绝），`details` 携带既有/ incoming 版本。
 * - 安装期撤销（`06.02-06` §二：撤销 = keyId 从信任根表移除）：签名阶段通过的 keyId 在
 *   落盘前与**两张信任根表**逐一对照（验签表 + 撤销核查表，缺省同表），任一表未登记即
 *   `CPK_SIGNATURE_INVALID`（不发明新码）。
 * - 安装只登记权限申请，不产生授权：`grantedPermissions` 恒为空集合，授权快照在首次
 *   启用时由装载器生成（《03-插件架构设计》§4.2 规则、§4.3[2]）。
 * - 注册表写入与 `plugin:installed` 事件由 `lifecycle.ts`（阶段五）承接；本模块只交付
 *   落盘后的记录投影，调用方须在注册表写入失败时移除已落盘目录（不留半成品）。
 */

import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { CPK_ERROR_CODES, LIFECYCLE_ERROR_CODES } from './codes.js';
import { LoaderError, throwCpkError } from './errors.js';
import { validateCpkPackage, type ICpkValidationResult } from './validate.js';
import type { ICpkPackage } from './provider.js';
import type { ITrustRootRegistry } from './trust-roots.js';
import type { IPermissionCatalog } from './manifest.js';
import type { IPluginRecord, IPersistedPluginEntry, PluginSource } from './types.js';

/** 安装选项。 */
export interface IInstallCpkOptions {
  /** 插件落盘根目录（`pluginsRoot`；目标形如 `<pluginsRoot>/<id>/<version>/`）。 */
  readonly pluginsRoot: string;
  /** 来源渠道（《03-插件包格式》§6.3）。 */
  readonly source: PluginSource;
  /** 验签用信任根注册表。 */
  readonly trustRoots: ITrustRootRegistry;
  /**
   * 安装期撤销核查的第二张信任根表（缺省与 `trustRoots` 同表）。
   * 撤销 = keyId 不在表；两表对照逐表断言，任一未登记即拒绝。
   */
  readonly revocationRoots?: ITrustRootRegistry;
  /** 当前宿主平台版本（`engines.chips` 门禁）。 */
  readonly hostVersion: string;
  /** 权限登记目录（缺省用宿主内置表）。 */
  readonly catalog?: IPermissionCatalog;
  /** 已安装版本查询（同 ID 冲突检查；返回 undefined 视为未安装）。 */
  readonly installedVersionOf?: (id: string) => string | undefined;
  /** 临时目录根（缺省 `<pluginsRoot>/.cpk-install-tmp`）。 */
  readonly tempRoot?: string;
  /** 时钟；缺省系统时间。 */
  readonly now?: () => Date;
}

/** 安装结果（记录投影与校验详情）。 */
export interface IInstallCpkResult {
  /** 注册表记录（`state: installed`、`grantedPermissions: []`）。 */
  readonly record: IPluginRecord;
  /** 持久化条目（`registry.json` 形态；启用偏好由调用方决定）。 */
  readonly persisted: IPersistedPluginEntry;
  /** 五阶段校验结果。 */
  readonly validation: ICpkValidationResult;
}

/**
 * 安装一个 `.cpk` 包（§4.2 流程 [1]~[6]；[7] 写注册表与事件由调用方承接）。
 *
 * @param pkg Provider 产出的包内容（归档态或目录态）。
 * @param options 安装选项。
 * @returns 注册表记录投影与校验详情。
 * @throws {LoaderError} 校验任一阶段失败（登记 `CPK_*` 码）、同 ID 重复安装
 *   （`KERNEL_INVALID_TRANSITION`）、安装期撤销核查未通过（`CPK_SIGNATURE_INVALID`）；
 *   失败不落盘、不留临时目录。
 */
export async function installCpkPackage(
  pkg: ICpkPackage,
  options: IInstallCpkOptions,
): Promise<IInstallCpkResult> {
  // [1]~[3]/[5] 全量校验（archive → layout → manifest → signature → hash）。
  const validation = validateCpkPackage({
    pkg,
    source: options.source,
    trustRoots: options.trustRoots,
    hostVersion: options.hostVersion,
    ...(options.catalog === undefined ? {} : { catalog: options.catalog }),
  });
  const manifest = validation.manifest;

  // [4] 版本与冲突检查：同 ID 重复安装（更新/降级/同版本）一律拒绝（§4.2[4]）。
  const existingVersion = options.installedVersionOf?.(manifest.id);
  if (existingVersion !== undefined) {
    throw new LoaderError(LIFECYCLE_ERROR_CODES.invalidTransition, {
      message:
        `插件 ${manifest.id} 已安装（${existingVersion}）；同 ID 更新须经蓝绿替换流程、` +
        `降级与同版本重复安装默认拒绝（《03-插件架构设计》§4.2[4]）`,
      details: {
        pluginId: manifest.id,
        existingVersion,
        incomingVersion: manifest.version,
        rule: '03.04 §4.2[4]',
      },
    });
  }

  // 安装期撤销：签名 keyId 与两张信任根表逐一对照（06.02-06 §二）。
  const keyId = validation.signature.keyId;
  if (keyId !== undefined) {
    const tables: readonly { readonly name: string; readonly registry: ITrustRootRegistry }[] = [
      { name: 'trustRoots', registry: options.trustRoots },
      { name: 'revocationRoots', registry: options.revocationRoots ?? options.trustRoots },
    ];
    for (const table of tables) {
      if (table.registry.find(keyId) === undefined) {
        throwCpkError(
          CPK_ERROR_CODES.signatureInvalid,
          `安装期信任根撤销核查未通过：keyId 不在 ${table.name} 表`,
          { stage: 'signature', keyId, table: table.name },
        );
      }
    }
  }

  // [6] 原子落盘：临时目录写入 → rename 进插件目录。
  const pluginsRoot = options.pluginsRoot.replace(/[/\\]+$/, '');
  const tempRoot = options.tempRoot ?? join(pluginsRoot, '.cpk-install-tmp');
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(join(tempRoot, 'install-'));
  try {
    for (const [memberPath, data] of pkg.members) {
      const absolute = join(tempDir, ...memberPath.split('/'));
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, data);
    }
    // 落盘布局：《03-插件架构设计》§4.2[6] —— `pluginsRoot/<id>/<version>/`；
    // ID 为反向域名整体目录名（清单校验已保证文法，不含路径分隔符）。
    const target = join(pluginsRoot, manifest.id, manifest.version);
    if (!target.startsWith(pluginsRoot + '/') || target === pluginsRoot) {
      // 防御性收口：manifest 校验已保证 ID 文法，此分支不可达；守住 rename 目标必在根内。
      throwCpkError(CPK_ERROR_CODES.pathUnsafe, `落盘目标越界：${manifest.id}`, {
        stage: 'layout',
        pluginId: manifest.id,
      });
    }
    await mkdir(dirname(target), { recursive: true });
    try {
      await rename(tempDir, target);
    } catch (error) {
      throwCpkError(
        CPK_ERROR_CODES.layoutInvalid,
        `落盘目标不可用（目录已存在或重命名失败）：${target}`,
        {
          stage: 'layout',
          target,
          cause: error instanceof Error ? error.message : String(error),
        },
      );
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  // [7] 前置：构造记录投影（注册表写入与事件发布由调用方承接）。
  const target = join(pluginsRoot, manifest.id, manifest.version);
  const clock = options.now !== undefined ? options.now() : new Date();
  const installedAt = clock.toISOString();
  const record: IPluginRecord = {
    id: manifest.id,
    version: manifest.version,
    role: manifest.role,
    state: 'installed',
    source: options.source,
    path: target,
    hash: validation.installHash,
    dependencies: manifest.dependencies,
    permissions: manifest.permissions,
    grantedPermissions: [],
    installedAt,
  };
  const persisted: IPersistedPluginEntry = {
    id: manifest.id,
    version: manifest.version,
    role: manifest.role,
    source: options.source,
    path: target,
    hash: validation.installHash,
    dependencies: manifest.dependencies,
    permissions: manifest.permissions,
    grantedPermissions: [],
    installedAt,
    enabled: false,
  };
  return { record, persisted, validation };
}

/** 安装失败后的落盘清理（注册表写入失败时调用；幂等）。 */
export async function removeInstalledPluginDirectory(
  pluginsRoot: string,
  id: string,
  version: string,
): Promise<void> {
  const target = join(pluginsRoot.replace(/[/\\]+$/, ''), id, version);
  await rm(target, { recursive: true, force: true });
}
