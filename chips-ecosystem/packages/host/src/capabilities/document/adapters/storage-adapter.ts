/**
 * `IDocumentStoragePort` 的正式资源管理器适配器（工单036 波 C3；工单 §五.1「受控
 * 提交路径」收口判据的本体——`document:save` 终闸的写路径唯一承载）。
 *
 * 权威：`04-资源管理设计` §4.8（受控提交路径：临时物 + fsync + 提交日志 + 原子替换 +
 * 失败回滚；prepare–commit 两相）、`04.11` §11.3（资源域 C3 补登两导出：
 * `resourceCommitChangeset` / `resourceRebuildArchive`）、`11-文档服务设计` §5.1/§5.5
 * （保存变更集与摘要口径）、RFC §6.1 消费面（本端口「持本地路径面」入参经点位三
 * **反向**换算收敛为受管引用后走受管面）。
 *
 * @remarks
 * - **受控提交链唯一写路径（工单036 红线）**：目录态一臂直调 `resourceCommitChangeset`
 *   （chips-resource 包级 changeset 两相提交：prepare 相 staging + 意图账 fsync →
 *   publish 相纯元数据动作，WriteCoordinator 多键一次交锁）；归档态一臂直调
 *   `resourceRebuildArchive`（临时整包写出 + 意图账 + publish 相 `rename` 原子换代）。
 *   **禁绕开受控提交链直写文件**——本适配器零 `node:fs` 写面（读面同样经受管
 *   `resourceListDirectory` / `resourceOpen` 走资源域）。
 * - **崩溃恢复走 journal 挂载扫描（C2a-1 单通道）**：本适配器零恢复代码——目录域
 *   `attach_root` 全树扫描与归档域槽位定向扫描随挂载动作（scope 适配器
 *   `registerScope`）自动承载，意图账是唯一意图权威；重复执行恢复幂等收敛。
 * - **目标解析（共享在册账）**：入参 `localPath` 由文档服务经点位三正向口现取
 *   （端口头注冻结形），适配器经共享账本（`scope-ledger.ts`）按挂载输入路径解析
 *   目标「作用域 + 原生会话」，再以点位三反向换算（`resourceManagedUriOfPath`）
 *   **反向直读核验**挂载可解析性——未在册 / 未挂载 / 换算未命中一律 fail-closed
 *   `RESOURCE_NOT_FOUND`（禁以陈旧账供路径、禁猜测会话，scope 适配器同款判据），
 *   绝不在错误消息里回显真实文件系统路径。
 * - **受管读面**：`listMembers` 经 `resourceListDirectory` 递归列举（核心列举面按
 *   `.` 前缀在册过滤平台保留临时物）+ `resourceOpen`/`resourceReadChunk` 逐成员
 *   取字节（摘要复算输入）；`readFileBytes` 对归档态包根整体流式读取。句柄
 *   `finally` 释放（泄漏守卫）。
 * - **串行化**：提交/列举/读取与挂载/注销同键（受管引用）共用账本队列，提交不得
 *   越过在途注销（两拍时序的存储面延伸）。
 * - **错误面**：登记码 `RESOURCE_*` 原样透传（`asDocumentCapabilityError`），不造
 *   第二套语义；保存链路失败由服务归口 `DOCUMENT_SAVE_FAILED`（`details.cause`）。
 *   取消预检命中以已登记 `DOCUMENT_PARSE_CANCELLED`（§8.2，可重试）拒绝。
 */

import type { DiagnosticsSink } from '../../../shared/diagnostics.js';
import type { IDocumentCommitRequest, IDocumentStoragePort, IPackageMemberBytes } from '../ports.js';
import { asDocumentCapabilityError, DocumentCapabilityError } from '../errors.js';
import type { DocumentScopeLedger } from './scope-ledger.js';
import type { INativeResourceModule } from './native-resource-module.js';

/** 取消预检登记码（解析域 §8.2 在册，服务侧归口 `DOCUMENT_SAVE_FAILED.cause`）。 */
const CANCELLED_CODE = 'DOCUMENT_PARSE_CANCELLED';

/** 受管引用协议头（《06-资源协议规范》§2.1 authority 段 = scope）。 */
const MANAGED_URI_PREFIX = 'chips-resource://';

/** 受管读面分块尺寸（1 MiB；`resourceReadChunk` 背压承载，不送入即不推进）。 */
const READ_CHUNK_BYTES = 1024 * 1024;

/** 存储适配器依赖。 */
export interface IDocumentStorageAdapterDeps {
  /** §11.3 资源域类型化消费面（含波 C3 补登两名；组合根经装载闸交付）。 */
  readonly native: INativeResourceModule;
  /** 文档域作用域在册账（scope 适配器同一实例；写读分面，本适配器只读）。 */
  readonly ledger: DocumentScopeLedger;
  /** 宿主诊断口（挂载漂移的 fail-closed 留痕）。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 已解析的提交/读取目标（账本事实 + 反向直读核验通过）。 */
interface IResolvedTarget {
  readonly scope: string;
  readonly nativeSession: number;
  /** 作用域基址形（`chips-resource://<scope>/`，受管面的合法寻址形）。 */
  readonly scopeRootUri: string;
  readonly form: 'directory' | 'archive';
}

/** 目标解析三段（账本命中 → 活绑定在位 → 反向直读核验），任一失位即 fail-closed。 */
async function resolveTarget(deps: IDocumentStorageAdapterDeps, localPath: string): Promise<IResolvedTarget> {
  const entry = deps.ledger.findByPackageRoot(localPath);
  if (entry === undefined) {
    throw new DocumentCapabilityError('RESOURCE_NOT_FOUND', {
      message: '提交目标未经文档作用域适配器挂载（无在册作用域可供寻址）',
    });
  }
  const mounted = entry.mounted;
  if (mounted === null) {
    throw new DocumentCapabilityError('RESOURCE_NOT_FOUND', {
      message: '提交目标仅归一在册、活绑定未建立（无会话可提交）',
    });
  }
  const scopeRootUri = `${MANAGED_URI_PREFIX}${entry.scope}/`;
  let reverse: string | null;
  try {
    reverse = await deps.native.resourceManagedUriOfPath(localPath, mounted.nativeSession);
  } catch (error: unknown) {
    // 换算口本身失败（非未命中形）：登记码原样上浮，不吞、不回退账本供路径。
    throw asDocumentCapabilityError(error);
  }
  if (reverse !== scopeRootUri) {
    // 未命中（null，不区分成因、零存在性泄露）或命中他域 = 挂载漂移：留痕 + fail-closed，
    // 不回退 TS 账本供路径（scope 适配器 `assertLiveMountResolvable` 同款判据）。
    deps.diagnostics?.error('document', '存储提交目标的反向换算与在册账作用域不一致（fail-closed，不回退账本供路径）', {
      scope: entry.scope,
      managedUri: entry.managedUri,
      documentId: mounted.documentId,
      verdict: reverse === null ? '换算未命中' : '换算指向他作用域',
    });
    throw new DocumentCapabilityError('RESOURCE_NOT_FOUND', {
      message: '提交目标挂载已不可经资源管理器换算（作用域漂移或已失效）',
    });
  }
  return { scope: entry.scope, nativeSession: mounted.nativeSession, scopeRootUri, form: entry.form };
}

/** 整包读取（`resourceOpen` → 分块拉取 → `finally` 释放，泄漏守卫）。 */
async function readWholeResource(
  native: INativeResourceModule,
  uri: string,
  nativeSession: number,
): Promise<Uint8Array> {
  const opened = await native.resourceOpen(uri, nativeSession);
  try {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const chunk = await native.resourceReadChunk(opened.handleId, READ_CHUNK_BYTES);
      if (chunk === null) {
        break;
      }
      chunks.push(chunk);
      total += chunk.byteLength;
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    try {
      native.resourceRelease(opened.handleId);
    } catch {
      // 静默：调用方各自保有原始结果；未释放句柄随会话注销级联回收（§11.2）。
    }
  }
}

/**
 * 构造 `IDocumentStoragePort` 正式适配器（工单036 波 C3）。
 *
 * 簿记模型：零私有可变状态——目标解析唯一经共享在册账 + 核心反向换算，
 * 提交/列举/读取与挂载/注销同键串行（账本队列）。
 */
export function createDocumentStorageAdapter(deps: IDocumentStorageAdapterDeps): IDocumentStoragePort {
  const { native, ledger } = deps;

  async function doCommit(request: IDocumentCommitRequest): Promise<void> {
    if (request.signal.aborted) {
      throw new DocumentCapabilityError(CANCELLED_CODE, {
        message: '文档保存已取消',
        retryable: true,
      });
    }
    const target = await resolveTarget(deps, request.localPath);
    const members = request.members.map((member) => ({ path: member.packagePath, bytes: member.bytes }));
    const removals = [...request.removals];
    try {
      if (target.form === 'directory') {
        // 目录态：包级 changeset 两相提交（prepare→publish，写锁覆盖全程）。
        await native.resourceCommitChangeset(target.nativeSession, target.scope, members, removals);
      } else {
        // 归档态：整包换代（保存时刻即本次调用时刻，全部条目统一时间戳，《11.05》§5.4；
        // 端口形状冻结无时钟位，保存拍=本臂执行拍）。
        await native.resourceRebuildArchive(target.nativeSession, target.scope, members, removals, Date.now());
      }
    } catch (error: unknown) {
      // 提交失败的登记码（`RESOURCE_*`）经归一单点原样透传（端口头注口径），服务侧
      // 归口 `DOCUMENT_SAVE_FAILED`（`details.cause`）；不吞并、不改写、不降级。
      throw asDocumentCapabilityError(error);
    }
  }

  async function doListMembers(localPath: string): Promise<readonly IPackageMemberBytes[]> {
    const target = await resolveTarget(deps, localPath);
    if (target.form !== 'directory') {
      throw new DocumentCapabilityError('RESOURCE_NOT_SUPPORTED', {
        message: '包成员列举只承载目录态包根（归档态摘要走整包读取）',
      });
    }
    const members: IPackageMemberBytes[] = [];
    // 受管面递归列举：核心列举面按 `.` 前缀在册过滤平台保留临时物（journal 夹具
    // 残迹不在成员集内）；成员路径以包根相对形累计（`content/<id>.yaml` 同构）。
    const walk = async (relativePrefix: string): Promise<void> => {
      const entries = await native.resourceListDirectory(
        `${target.scopeRootUri}${relativePrefix}`,
        target.nativeSession,
      );
      for (const entry of entries) {
        if (entry.isDirectory) {
          await walk(`${relativePrefix}${entry.name}/`);
          continue;
        }
        const bytes = await readWholeResource(
          native,
          `${target.scopeRootUri}${relativePrefix}${entry.name}`,
          target.nativeSession,
        );
        members.push({ packagePath: `${relativePrefix}${entry.name}`, bytes });
      }
    };
    await walk('');
    return members;
  }

  async function doReadFileBytes(localPath: string): Promise<Uint8Array> {
    const target = await resolveTarget(deps, localPath);
    if (target.form !== 'archive') {
      throw new DocumentCapabilityError('RESOURCE_NOT_SUPPORTED', {
        message: '整包字节读取只承载归档态包根（目录态摘要走成员列举）',
      });
    }
    return await readWholeResource(native, target.scopeRootUri, target.nativeSession);
  }

  return {
    commit(request: IDocumentCommitRequest): Promise<void> {
      // 与挂载/注销同键串行：提交不得越过在途注销（两拍时序的存储面延伸）。
      const target = ledger.findByPackageRoot(request.localPath);
      const key = target === undefined ? `storage:${request.localPath}` : target.managedUri;
      return ledger.enqueue(key, () => doCommit(request));
    },
    listMembers(localPath: string): Promise<readonly IPackageMemberBytes[]> {
      const target = ledger.findByPackageRoot(localPath);
      const key = target === undefined ? `storage:${localPath}` : target.managedUri;
      return ledger.enqueue(key, () => doListMembers(localPath));
    },
    readFileBytes(localPath: string): Promise<Uint8Array> {
      const target = ledger.findByPackageRoot(localPath);
      const key = target === undefined ? `storage:${localPath}` : target.managedUri;
      return ledger.enqueue(key, () => doReadFileBytes(localPath));
    },
  };
}
