/**
 * `IDocumentScopePort` 的正式资源管理器适配器（工单036 波 A2b-α，任务 #217；
 * `native-resource-module.ts` 头注登记的「A2b 接线」即本文件与
 * `production-wiring.ts` 的 `resourcePorts` 注入缝；波 B2 任务 #241 在本适配器落
 * 点位三 `managedUri ↔ localPath` 的宿主消费臂——正向取回、反向直读核验与作用域根查询）。
 *
 * 权威：`04-资源管理设计` §5.2（作用域注册）、`04.11` §11.3（挂载/注销导出、点位三
 * `managedUri ↔ localPath` 双向换算导出行 19–20 与 scope 派生）、
 * `06-资源协议规范` §2.6/§3.2/§3.3（受管引用语法、注销时机表、`chips-resource://<scope>/` 基址口径）、
 * #213 §2.1(g) 六阶段时序表（INV-1~INV-6）。
 *
 * @remarks
 * - **native 会话自持与回执（INV-1，波 A2b-β 已接源头）**：`resourceOpenSession` 返回的
 *   `nativeSession` 由本适配器在挂载时自行打开、在册账留存、注销时经两拍收口释放，并经
 *   `registerScope` 回执 {@link IDocumentScopeRegistration} 显式交付文档服务落记录面——
 *   **不以伪造 id 为前提**。记录面该字段的历史形态（`session-store.ts` 的 TS 单调计数器）
 *   已随 β 删除：假 id 触达原生侧会话表恒 `None`，归属闸恒 `PERMISSION_DENIED`，
 *   两拍注销与任何按会话归属的资源调用形同虚设（#213 附带发现）。
 * - **两拍时序（INV-2/INV-6）**：`unregisterScope` 内部 ① `resourceUnregisterScope(scope, session)`
 *   → ② `resourceCloseSession(session)`，次序倒置即自造 JS 面不可恢复的孤儿常驻 scope
 *   （挂载持久于进程、`close_session` 不自动脱绑，#213 §2.1(d)/§2.1(g)）；
 *   注销入口全仓唯一即本成员（禁第二注销形）。调用位已在册（β）：`session-store.ts` 的
 *   `releaseSessionsOf` 经 `releaseScope` 依赖位、`service.ts` 的 `rollbackFreshRecord` 经端口本成员。
 * - **目标作用域注册生命周期（W5 T-ws，工单036 残段收尾波）**：`ensureTargetScope` /
 *   `releaseTargetScope` 为「非打开文档的作用域注册」正式臂——export 目标/暂存物与
 *   create 落点在受控提交前必须经 `ensureTargetScope` 在册挂载（storage 适配器
 *   `resolveTarget` 对未挂载目标 fail-closed）。三态语义与归一前置判据见
 *   `doEnsureTargetScope` 头注；新注册的活绑定落 `DOCUMENT_TARGET_SCOPE_BINDING_ID`
 *   哨兵（`scope-derivation.ts` 单源，与真实文档标识结构性不相交），create 落地后文档记录
 *   经 `registerScope` 幂等臂的**接管分支**以真实 documentId 接管同一活绑定（INV-1 同会话
 *   不分叉）；`releaseTargetScope` 仅释哨兵绑定（哨兵归属闸），两拍收口全量收敛到
 *   `doUnregisterScope` 同一通道（INV-6 零第二注销实现）。挂载机械单源 =
 *   `mountLedgerEntry`（registerScope 与 ensureTargetScope 共用，open → grant → mount
 *   → 回执核验 → 转正，失败收口链逐字保留）。保留区判定不落本适配器：平台暂存物合法
 *   落在保留前缀下，用户落点的 `WORKSPACE_RESERVED_PATH` 闸在能力服务层经
 *   `scope-reserved-paths.ts`（scope 域单源）执行。
 * - **幂等臂＝窄形（M0 核证在册，`/tmp/w217_state.md`；点位三随波 B 已落位，本注记按实读翻正）**：
 *   `RESOURCE_ALREADY_EXISTS` 是幂等信号不是错误（RFC `:107`、《04.11》:207-208）；但
 *   未绑定会话对 Document scope 读臂恒拒（`permission.rs` document() 臂 + 绑定层空权限集，
 *   `native/src/resource.rs:802`），且核心反向换算对**绑定集为空**的会话一律 `None`
 *   （`manager.rs:1052` 首闸），故「他人已登记同一 scope」的宽形复用在 JS 面拿不到任何证据
 *   ⇒ 本适配器仅当**自身在册账**（TS 侧 normalize→register 簿记；挂载期路径事实已随波 B2
 *   收敛到点位三取回，见下「点位三消费臂」）
 *   命中同 managedUri 的**活绑定**（本适配器挂载且会话在位）时复用放行；不在册一律视为
 *   真冲突，**打开失败收口**（透传 `RESOURCE_ALREADY_EXISTS`）。**禁抢占他人 scope**（INV-5：
 *   冲突臂绝不先注销后挂载）；owner/kind/origin 一致性按 M0 处置降级为账本核对
 *   （kind/canonicalPath/documentId 三项；owner 由 `DOCUMENT_SCOPE_OWNER` 常量构造恒等）。
 *   点位五 D2 注记：grant 拍只注入 `resources:write` 基串（读臂零注入、`<scope>` 限定形零注入，
 *   裁定J §三.3），上述 M0 窄形判据不因此改变。
 * - **点位三消费臂（工单036 波 B2，本适配器为宿主侧唯一真接位）**：
 *   ① 正向 `localPathOf(managedUri, nativeSession)` 直调 `resourceLocalPathOf`（§11.3 行 19），
 *   在册账只供**作用域身份**、路径事实由核心 `ScopeRegistry` 的 `Origin` 单源给出——文档服务
 *   自此不在记录面缓存 `localPath`；② 命中已有挂载的再归一经反向 `resourceManagedUriOfPath`
 *   （§11.3 行 20）**反向直读核验**，未命中（`null`）与命中他域同为账本漂移 ⇒ fail-closed
 *   `RESOURCE_NOT_FOUND` + 审计留痕，绝不回退 TS 账本供路径、绝不在跨层消息里回显真实路径；
 *   ③ `scopeRootOf` 以挂载回执核验过的 `scope` 合形，取代调用方的词法切片。
 *   账本仍承载的两项**不可替代**事实：挂载前的归一路径（`canonicalizeDocumentPath` 产物，
 *   此刻核心侧尚无登记、换算口必判未命中）与挂载输入路径本身。
 * - **失败码口径（裁决I-②）**：挂载链对宿主机路径零产生 `RESOURCE_PATH_INVALID`；
 *   真实落码 `RESOURCE_NOT_FOUND`（directory.rs:107-114、archive.rs:131-134）/
 *   `RESOURCE_ALREADY_EXISTS` / `RESOURCE_PERMISSION_DENIED` 等，原样透传不造第二套语义。
 * - **第 6 阶段判定式（#213 §2.1(g)）**：注销返回 OK / `RESOURCE_NOT_FOUND` 均为已达；
 *   `RESOURCE_PERMISSION_DENIED` **不得静默**——审计留痕 + 「疑似孤儿」告警后如实抛出，
 *   **禁转而 closeSession 掩盖**（会话仍持有即保留在册账，留人工/后续波处置）。
 * - **禁裸路径直读（《06.03》:45）**：`normalizeSource` 是本地来源进入文档链路的唯一归一点
 *   （realpath 规范化 + 派生 scope + 受管引用合形），下游只消费 `managedUri`（记录存续期的
 *   本地路径经本适配器的点位三正向口 `localPathOf` 现取，见「点位三消费臂」）；远端方案
 *   （http/https/webdav）物化通道未开（本波诚实拒收
 *   `RESOURCE_UNSUPPORTED_SCHEME`）。
 * - **grant 消费拍（工单053 点位五 D2，RFC 裁定J §七已接线）**：目录态挂载按 §11.3 行 16 以
 *   `writable = true` 登记（挂载 policy 面）；会话建立即经第 56 导出
 *   `resourceGrantSession`（§11.3 行 21，D1 任务 #244 落位）注入 `resources:write`——
 *   `resourceOpenSession` 成功返回后紧邻同拍调用、先于挂载二态分叉，「活会话无权限」窗口
 *   收敛为零拍；不做按 `writable`/归档态分叉的条件 grant（T8 锁其不变性，归档只读由
 *   挂载 policy 面单点强制，与权限面正交）。grant 被拒（任何码）与挂载失败同处理：
 *   `closeSessionQuietly` 回收已开会话 + 如实抛出，**禁吞禁降级静默继续**。
 */

import { statSync } from 'node:fs';
import { basename, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DiagnosticsSink } from '../../../shared/diagnostics.js';
import {
  DOCUMENT_PERMISSION_IDS,
  type DocumentForm,
  type DocumentKind,
  type IDocumentCapabilityContext,
} from '../contract.js';
import { asDocumentCapabilityError, DocumentCapabilityError } from '../errors.js';
import {
  DOCUMENT_SCOPE_OWNER,
  DOCUMENT_TARGET_SCOPE_BINDING_ID,
  canonicalizeDocumentPath,
  deriveDocumentScopeFromCanonical,
} from '../scope-derivation.js';
import type {
  IDocumentScopePort,
  IDocumentScopeRegistration,
  IDocumentTargetScopeAssurance,
  IResolvedDocumentSource,
} from '../ports.js';
import type { INativeResourceModule } from './native-resource-module.js';
import { DocumentScopeLedger, type IScopeLedgerEntry } from './scope-ledger.js';

/** 会话种类判别字面量（绑定层 `parse_session_kind` 三值之一，document 域挂载用）。 */
const DOCUMENT_SESSION_KIND = 'document';

/**
 * 文档会话建立即注入的权限全集（工单053 点位五 D2，RFC 裁定J §七「权限字面量单源」行）。
 *
 * @remarks
 * - 宿主文档域自持常量单源：字面量唯一落点复用 `contract.ts` 的
 *   `DOCUMENT_PERMISSION_IDS.resourcesWrite`（文档域既有权限 ID 常量），本数组是
 *   grant 消费拍的注入形；禁经 SDK/Bridge 面转发第二定义位（AGENTS 架构红线）。
 * - 跨语言等值权威 = `crates/chips-resource/src/permission.rs:23`
 *   （`PERMISSION_RESOURCES_WRITE = "resources:write"`，Document 写臂只认此精确串，
 *   裁定J §三.3：`<scope>` 限定形不扩 Document 写臂——属《06.04》§4.3 矩阵协议变更，另走 RFC）。
 *   值锁与「文档域内字面量零第二落点」存在性锁见 `tests/document-scope-adapter.test.ts`。
 */
const DOCUMENT_SESSION_GRANT_PERMISSIONS: readonly string[] = [DOCUMENT_PERMISSION_IDS.resourcesWrite];

/** 受管引用协议头（《06.02》§2.1 authority 段 = scope）。 */
const MANAGED_URI_PREFIX = 'chips-resource://';

/**
 * 作用域基址形合形（`chips-resource://<scope>/`，《06-资源协议规范》§3.3 基址口径）。
 *
 * @remarks 本函数是适配器内**唯一**的受管引用合形点，输入一律是已登记（并经挂载回执
 * 核验）的 `scope` 事实，不是任意字符串切片。点位三的两次换算都以此形为输入/比对基准：
 * 正向 `resourceLocalPathOf(基址形, session)`（§11.3 行 19「目录态作用域基址形返回包根」、
 * 归档态恒返回归档文件路径），反向 `resourceManagedUriOfPath(物理根, session)` 的规范产物
 * （核心 `managed_uri_of_path` 对包根/归档文件命中的相对段为空 ⇒ 产物即基址形）。
 */
function managedUriOfScopeRoot(scope: string): string {
  return `${MANAGED_URI_PREFIX}${scope}/`;
}

/** 单条在册账形状改由域内单源承载（`scope-ledger.ts`，波 C3 storage 适配器共用）。 */
export type { IScopeLedgerEntry } from './scope-ledger.js';

/** 适配器依赖。 */
export interface IDocumentScopeAdapterDeps {
  /** §11.3 资源域类型化消费面（组合根经 `loadNativeResourceBinding` 交付）。 */
  readonly native: INativeResourceModule;
  /**
   * 文档域作用域在册账（波 C3 升格为域内单源：storage 适配器在同一账上解析
   * 提交目标的「作用域 + 原生会话」事实，禁第二套簿记）。
   */
  readonly ledger: DocumentScopeLedger;
  /** 宿主诊断口（「疑似孤儿」审计与注销异常留痕）。 */
  readonly diagnostics?: DiagnosticsSink;
}

/** 包名扩展名 → 来源形判别键（`.card` / `.box`，其余拒收）。 */
function kindFromPackageName(packageName: string): DocumentKind | null {
  const extension = extname(packageName).toLowerCase();
  if (extension === '.card') {
    return 'card';
  }
  if (extension === '.box') {
    return 'box';
  }
  return null;
}

/** 磁盘实形探测来源形态（canonical 路径已在 realpath 步确认存在）。 */
function formOfCanonicalPath(canonicalPath: string): DocumentForm | null {
  try {
    const stats = statSync(canonicalPath);
    if (stats.isDirectory()) {
      return 'directory';
    }
    if (stats.isFile()) {
      return 'archive';
    }
    return null;
  } catch {
    return null;
  }
}

/** `file://` URL → 绝对路径（win32 盘符形态由 `fileURLToPath` 归一）。 */
function absolutePathFromInput(source: string): string | null {
  if (source.startsWith('file://')) {
    try {
      return fileURLToPath(source);
    } catch {
      return null;
    }
  }
  if (isAbsolute(source)) {
    return source;
  }
  return null;
}

/** 提取抛出值的登记码（无码/异形码返回 `null`）。 */
function codeOf(error: unknown): string | null {
  const normalized = asDocumentCapabilityError(error);
  return normalized instanceof DocumentCapabilityError ? normalized.code : null;
}

/**
 * 构造 `IDocumentScopePort` 正式适配器。
 *
 * 簿记模型：在册账由 {@link DocumentScopeLedger} 单源承载（本适配器写、storage
 * 适配器读），同键（受管引用）的挂载/注销/换算与存储面提交/列举经同一队列串行化，
 * 杜绝并发双挂载竞态与「提交越过在途注销」。
 */
export function createDocumentScopeAdapter(deps: IDocumentScopeAdapterDeps): IDocumentScopePort {
  const { native, ledger, diagnostics } = deps;

  /** 释放臂兜底：仅归一在册（未挂载）即直接销账；已挂载账目保留给 unregisterScope。 */
  function forgetUnmounted(entry: IScopeLedgerEntry): void {
    if (entry.mounted === null && ledger.lookup(entry.managedUri) === entry) {
      ledger.forget(entry.managedUri);
    }
  }

  /**
   * 命中已有挂载时的**反向直读核验**（点位三反向，`04.11` §11.3 行 20；RFC §6.1 消费面
   * 「命中已有挂载：反向直读」）。
   *
   * @remarks
   * - 活绑定在位 ⇒ 本次查询用的是**该挂载自己的原生会话**（作用域已随 `attach_scope` 绑定），
   *   换算口在绑定集内按 Origin 最长前缀匹配，命中的规范产物即本作用域基址形——一次调用即
   *   把「在册账声称的挂载仍然可解析」这一事实从 TS 账本断言升格为资源管理器单源证据。
   * - **未命中（`null`）分支**：核心对「路径不存在 / 会话已收口 / 作用域已被别处注销 /
   *   他会话作用域」一律返回 `null`、不报错、不区分成因（零信息泄露口径即体现在返回类型，
   *   `crates/chips-resource/src/manager.rs:1052` 头注），本适配器据此只能判「换算口不可信
   *   本账」——fail-closed 抛 `RESOURCE_NOT_FOUND`（在册码，零新码），**绝不回退到 TS 账本
   *   供路径**（回退即保留双份事实源），也绝不在消息里回显真实文件系统路径（同 §11.3 行 19
   *   错误面 `target` 仅作用域根不回显路径的口径）。
   * - 命中但指向**别的**作用域（基址形不等）同判为账本漂移（同一物理根被别的 scope 覆盖），
   *   处置形与 `null` 一致：留痕 + fail-closed，不猜、不抢占（INV-5）。
   */
  async function assertLiveMountResolvable(entry: IScopeLedgerEntry): Promise<void> {
    const mounted = entry.mounted;
    if (mounted === null) {
      // 仅归一在册、尚未挂载：此刻核心侧没有该作用域的登记事实，反向换算必为 `null`
      // （未绑定会话对 Document scope 读臂恒拒，#217 M0 核证），无可核验面 —— 归一事实
      // 由本账承担，挂载后的一切路径事实改经 `localPathOf`（点位三正向）。
      return;
    }
    let reverse: string | null;
    try {
      reverse = await native.resourceManagedUriOfPath(entry.canonicalPath, mounted.nativeSession);
    } catch (error: unknown) {
      // 换算口本身失败（非未命中形）：登记码原样上浮，不吞、不回退账本供路径。
      throw asDocumentCapabilityError(error);
    }
    const scopeRoot = managedUriOfScopeRoot(entry.scope);
    if (reverse === scopeRoot) {
      return;
    }
    diagnostics?.error('document', '在册挂载的反向换算与账本作用域不一致（fail-closed，不回退 TS 账本供路径）', {
      scope: entry.scope,
      managedUri: entry.managedUri,
      documentId: mounted.documentId,
      // `null` = 未命中（不区分成因、不泄露存在性）；非 null 不等 = 命中他域。两者同为账本漂移。
      verdict: reverse === null ? '换算未命中' : '换算指向他作用域',
    });
    throw new DocumentCapabilityError('RESOURCE_NOT_FOUND', {
      message: '在册挂载已不可经资源管理器换算（作用域漂移或已失效），拒以陈旧账供路径',
    });
  }

  function normalizeSource(source: string, ctx: IDocumentCapabilityContext): Promise<IResolvedDocumentSource> {
    void ctx;
    return ledger.enqueue(`normalize:${source}`, async (): Promise<IResolvedDocumentSource> => {
      if (typeof source !== 'string' || source.length === 0) {
        throw new DocumentCapabilityError('RESOURCE_INVALID_URI', { message: '文档来源不能为空' });
      }
      if (source.startsWith(MANAGED_URI_PREFIX)) {
        // 受管引用回查：仅受理本适配器在册的键（会话键与受管引用同源）；
        // 远端物化/他域作用域直读通道未开（本波拒收，不猜内容）。
        const entry = ledger.lookup(source);
        if (entry === undefined) {
          throw new DocumentCapabilityError('RESOURCE_NOT_FOUND', {
            message: '受管引用未在本作用域适配器在册（文档须先经本地来源打开）',
          });
        }
        // 命中已有挂载 → 反向直读核验（点位三）。
        await assertLiveMountResolvable(entry);
        return { managedUri: entry.managedUri, localPath: entry.canonicalPath, form: entry.form };
      }
      if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(source) && !source.startsWith('file://')) {
        throw new DocumentCapabilityError('RESOURCE_UNSUPPORTED_SCHEME', {
          message: '本波文档链路仅受理本地来源（远端物化通道未开）',
        });
      }
      const absolute = absolutePathFromInput(source);
      if (absolute === null) {
        throw new DocumentCapabilityError('RESOURCE_INVALID_URI', {
          message: '文档来源必须是 file:// URL 或绝对路径（禁裸相对路径直读）',
        });
      }
      const canonicalPath = canonicalizeDocumentPath(absolute);
      const kind = kindFromPackageName(basename(canonicalPath));
      if (kind === null) {
        throw new DocumentCapabilityError('RESOURCE_NOT_SUPPORTED', {
          message: '文档包名必须以 .card / .box 扩展名标识来源形',
        });
      }
      const form = formOfCanonicalPath(canonicalPath);
      if (form === null) {
        throw new DocumentCapabilityError('RESOURCE_NOT_SUPPORTED', {
          message: '文档来源须为目录态工作副本或归档态单文件',
        });
      }
      const scope = deriveDocumentScopeFromCanonical(canonicalPath, kind);
      const managedUri = `${MANAGED_URI_PREFIX}${scope}/${encodeURIComponent(basename(canonicalPath))}`;
      const existing = ledger.lookup(managedUri);
      if (existing !== undefined) {
        // 同物理根再归一：账目在位即复用（活绑定由 registerScope 幂等臂放行）；
        // 已挂载者先经反向直读核验（点位三消费分叉的「命中反查复用」臂）。
        await assertLiveMountResolvable(existing);
        return { managedUri, localPath: existing.canonicalPath, form: existing.form };
      }
      ledger.upsert({ managedUri, scope, kind, form, canonicalPath, mounted: null });
      return { managedUri, localPath: canonicalPath, form };
    });
  }

  /**
   * 点位三正向取回（`04.11` §11.3 行 19）：在册账只供**作用域身份**，路径由核心单源换算。
   *
   * 输入取作用域基址形（`managedUriOfScopeRoot`）——目录态包根与归档态归档文件路径都由
   * 该形直达；以含产物段的记录键直译会落进包根之下（`Origin::Directory` 分支
   * `resolve_within_root(root, virtual_path)`），故键与换算形在此显式分离。
   */
  async function doLocalPathOf(managedUri: string, nativeSession: number): Promise<string> {
    const entry = ledger.lookup(managedUri);
    if (entry === undefined) {
      throw new DocumentCapabilityError('RESOURCE_NOT_FOUND', {
        message: '受管引用未在本作用域适配器在册（无登记作用域可供换算）',
      });
    }
    return await native
      .resourceLocalPathOf(managedUriOfScopeRoot(entry.scope), nativeSession)
      .catch((error: unknown): never => {
        // 换算失败的登记码原样上浮（`RESOURCE_*` 族，端口头注口径），不造第二套语义、不回退账本值。
        throw asDocumentCapabilityError(error);
      });
  }

  /**
   * 挂载机械单源（open → grant → mount → 回执核验 → 在册账转正）：registerScope 与
   * ensureTargetScope（W5 T-ws 目标注册臂）共用的唯一挂载通道；grant 拍、失败收口链
   * （关会话 + 销账 + 登记码透传）与 ALREADY_EXISTS 真冲突判定（INV-5 禁抢占）逐字保留，
   * 禁任何调用方绕开本通道自拼挂载序列。
   */
  async function mountLedgerEntry(entry: IScopeLedgerEntry, documentId: string): Promise<number> {
    const nativeSession = native.resourceOpenSession(DOCUMENT_SESSION_KIND, DOCUMENT_SCOPE_OWNER);
    // grant 拍（RFC 裁定J §七时序行）：open 成功返回后紧邻同拍注入写权限、先于挂载二态分叉，
    // 「活会话无权限」窗口收敛为零拍；幂等静默形（§三.1）令重放安全，不做条件 grant 分叉（T8）。
    try {
      native.resourceGrantSession(nativeSession, DOCUMENT_SESSION_GRANT_PERMISSIONS);
    } catch (error: unknown) {
      // grant 被拒（任何码）＝与挂载失败同处理：回收已开会话 + 如实抛出（禁吞、禁降级静默
      // 继续、禁以任何掩盖形改口）；登记码经 `asDocumentCapabilityError` 原样透传，
      // 消息面零真实文件系统路径（本文件既有口径，绑定层 target 仅会话坐标）。
      closeSessionQuietly(nativeSession);
      forgetUnmounted(entry);
      throw asDocumentCapabilityError(error);
    }
    let mountedScope: string;
    try {
      mountedScope =
        entry.form === 'directory'
          ? await native.resourceMountDirectory(
              nativeSession,
              entry.scope,
              entry.canonicalPath,
              DOCUMENT_SCOPE_OWNER,
              true,
            )
          : await native.resourceMountArchive(nativeSession, entry.scope, entry.canonicalPath, DOCUMENT_SCOPE_OWNER);
    } catch (error: unknown) {
      // 挂载失败核心全量回滚（无半挂载）：先开的会话必须收口，禁留悬空会话。
      closeSessionQuietly(nativeSession);
      const code = codeOf(error);
      if (code === 'RESOURCE_ALREADY_EXISTS') {
        // M0 窄形：不在本适配器在册账的 ALREADY_EXISTS 一律真冲突（他进程/他适配器/
        // 孤儿形态）——打开失败收口，绝不先注销后挂载（INV-5 禁抢占）。
        forgetUnmounted(entry);
        throw new DocumentCapabilityError('RESOURCE_ALREADY_EXISTS', {
          message: '文档作用域已被外部登记（幂等复用不可达，打开失败收口）',
        });
      }
      forgetUnmounted(entry);
      throw asDocumentCapabilityError(error);
    }
    if (mountedScope !== entry.scope) {
      closeSessionQuietly(nativeSession);
      forgetUnmounted(entry);
      throw new DocumentCapabilityError('RESOURCE_INTERNAL', {
        message: '挂载返回作用域与派生值不一致（构造性漂移，fail-closed）',
      });
    }
    entry.mounted = { nativeSession, documentId };
    return nativeSession;
  }

  async function doRegisterScope(input: {
    readonly documentId: string;
    readonly managedUri: string;
    readonly kind: DocumentKind;
  }): Promise<IDocumentScopeRegistration> {
    const entry = ledger.lookup(input.managedUri);
    if (entry === undefined) {
      throw new DocumentCapabilityError('RESOURCE_INVALID_URI', {
        message: '作用域注册缺少归一前置（managedUri 未经 normalizeSource 归一）',
      });
    }
    if (entry.mounted !== null) {
      // 幂等复用臂（窄形）：本适配器活绑定在位 → 同 owner（构造恒等）核对账本三一致，
      // 回执既有活绑定的同一原生会话（INV-1：记录面数值会话与在册账同源，不分叉）。
      if (entry.kind === input.kind) {
        if (entry.mounted.documentId === input.documentId) {
          return { nativeSession: entry.mounted.nativeSession };
        }
        if (entry.mounted.documentId === DOCUMENT_TARGET_SCOPE_BINDING_ID) {
          // 目标注册接管臂（W5 T-ws）：create 落地后文档记录以真实 documentId 接管
          // ensureTargetScope 建立的哨兵绑定——同一活绑定、同一原生会话（INV-1 不分叉），
          // 在册账 documentId 位翻正为真实标识；此后释放归文档记录生命周期
          // （session-store releaseSessionsOf / rollbackFreshRecord 既有接线），目标释放臂
          // 哨兵归属闸自此拒绝代释。哨兵与真实文档标识结构性不相交
          // （scope-derivation.ts 头注：base62 无点号），判别非词法猜测。
          entry.mounted = { nativeSession: entry.mounted.nativeSession, documentId: input.documentId };
          return { nativeSession: entry.mounted.nativeSession };
        }
      }
      throw new DocumentCapabilityError('RESOURCE_ALREADY_EXISTS', {
        message: '同一受管引用已绑定不同文档标识或种类（真冲突，禁抢占）',
      });
    }
    return { nativeSession: await mountLedgerEntry(entry, input.documentId) };
  }

  function closeSessionQuietly(nativeSession: number): void {
    try {
      native.resourceCloseSession(nativeSession);
    } catch (error: unknown) {
      diagnostics?.error('document', '文档挂载失败收口时会话关闭异常（留痕不改写失败结论）', {
        nativeSession,
        cause: codeOf(error) ?? 'unknown',
      });
    }
  }

  async function doUnregisterScope(input: { readonly documentId: string; readonly managedUri: string }): Promise<void> {
    const entry = ledger.lookup(input.managedUri);
    if (entry === undefined) {
      // 未在册 = 本适配器从未建立该作用域（重复注销/未挂载文档）：按第 6 阶段 NOT_FOUND
      // 已达口径收口，禁造第二注销通道。
      return;
    }
    if (entry.mounted === null) {
      forgetUnmounted(entry);
      return;
    }
    const { nativeSession, documentId } = entry.mounted;
    try {
      // 拍①：注销作用域（级联失效句柄/流/缓存，§11.2 口径）。
      await native.resourceUnregisterScope(entry.scope, nativeSession);
    } catch (error: unknown) {
      const code = codeOf(error);
      if (code === 'RESOURCE_NOT_FOUND') {
        // 已被别处注销：注销已达，继续拍②收口会话。
      } else {
        if (code === 'RESOURCE_PERMISSION_DENIED') {
          // 疑似孤儿在册 scope（本适配器账目在位而归属闸拒）：审计 + 告警，
          // **禁转而 closeSession 掩盖**——会话保留、账目保留、如实抛出。
          diagnostics?.error('document', '疑似孤儿文档作用域：注销被归属闸拒绝，会话与在册账保留待处置', {
            scope: entry.scope,
            documentId,
            managedUri: entry.managedUri,
          });
        }
        throw asDocumentCapabilityError(error);
      }
    }
    // 拍②：释放原生会话（两拍次序即 INV-2；永不在注销之前关闭）。
    native.resourceCloseSession(nativeSession);
    if (ledger.lookup(entry.managedUri) === entry) {
      ledger.forget(entry.managedUri);
    }
  }

  /**
   * 目标作用域注册臂本体（W5 T-ws，工单036 残段收尾波）：非打开文档的作用域注册——
   * export 目标/暂存物、create 落点在受控提交前必须经本臂在册并挂载
   * （storage-adapter `resolveTarget` 对未挂载目标 fail-closed）。
   *
   * @remarks
   * - **归一前置不放宽**：未在册一律 `RESOURCE_INVALID_URI`（禁跳册直挂）——本域唯一
   *   归一入口是 `normalizeSource`（落点存在性判据由其承载：落点不存在即
   *   `RESOURCE_NOT_FOUND`，本臂不触文件系统创建面、不自建归一通道）。
   * - **三态**：①未注册（在册未挂载）→ 经 {@link mountLedgerEntry} 注册，活绑定落
   *   `DOCUMENT_TARGET_SCOPE_BINDING_ID` 哨兵，`existedBefore: false`；②已注册（哨兵或
   *   文档记录活绑定在位）→ 反向直读核验（点位三）后复用同一会话，`existedBefore: true`；
   *   ③种类与在册账不符 → `RESOURCE_ALREADY_EXISTS`（真冲突，INV-5 禁抢占）。
   * - **不做保留区判定**：平台暂存物（`.chips-export-<随机>` 等）合法地落在保留前缀下
   *   （13.04 §4.2 规则 8、13.06 §6.3.3），本臂判保留区即自锁导出链；用户落点的
   *   `WORKSPACE_RESERVED_PATH` 闸在能力服务层经 `isReservedPath`（scope 域单源）执行。
   * - `localPath` 经点位三正向口现取（不入返回面缓存，与端口 `localPathOf` 同源同判据）。
   */
  async function doEnsureTargetScope(managedUri: string, kind: DocumentKind): Promise<IDocumentTargetScopeAssurance> {
    const entry = ledger.lookup(managedUri);
    if (entry === undefined) {
      throw new DocumentCapabilityError('RESOURCE_INVALID_URI', {
        message: '目标作用域注册缺少归一前置（managedUri 未经 normalizeSource 归一，禁跳册直挂）',
      });
    }
    if (entry.kind !== kind) {
      throw new DocumentCapabilityError('RESOURCE_ALREADY_EXISTS', {
        message: '目标受管引用已按不同种类在册（种类冲突，禁抢占）',
      });
    }
    if (entry.mounted !== null) {
      await assertLiveMountResolvable(entry);
      const localPath = await doLocalPathOf(managedUri, entry.mounted.nativeSession);
      return { nativeSession: entry.mounted.nativeSession, localPath, form: entry.form, existedBefore: true };
    }
    const nativeSession = await mountLedgerEntry(entry, DOCUMENT_TARGET_SCOPE_BINDING_ID);
    const localPath = await doLocalPathOf(managedUri, nativeSession);
    return { nativeSession, localPath, form: entry.form, existedBefore: false };
  }

  /**
   * 目标作用域释放臂本体（W5 T-ws）：export 用完即释、create 失败回滚的正式出口。
   *
   * @remarks
   * - **哨兵归属闸**：仅哨兵绑定可经本臂释放；已由文档记录接管（真实 `documentId` 在位）
   *   的活绑定归文档记录生命周期所有（06-资源协议规范 §3.2 注销时机表），如实
   *   `RESOURCE_PERMISSION_DENIED` 拒绝——账目与会话保留，禁代释、禁掩盖。
   * - 未在册 / 仅归一未挂载 = 释放已达（幂等静默收口，同 unregisterScope 的 NOT_FOUND
   *   已达口径）；挂载在册的释放全量收敛到 {@link doUnregisterScope} 同一通道——两拍次序
   *   （INV-2）与第 6 阶段判定式（NOT_FOUND 已达 / PERMISSION_DENIED 疑似孤儿不掩盖）
   *   零第二实现（INV-6 注销入口唯一）。
   */
  function doReleaseTargetScope(managedUri: string): Promise<void> {
    const entry = ledger.lookup(managedUri);
    if (entry === undefined) {
      return Promise.resolve();
    }
    if (entry.mounted === null) {
      forgetUnmounted(entry);
      return Promise.resolve();
    }
    if (entry.mounted.documentId !== DOCUMENT_TARGET_SCOPE_BINDING_ID) {
      return Promise.reject(
        new DocumentCapabilityError('RESOURCE_PERMISSION_DENIED', {
          message: '目标作用域已由文档记录接管（禁经目标释放臂注销他属活绑定）',
        }),
      );
    }
    return doUnregisterScope({ documentId: entry.mounted.documentId, managedUri });
  }

  return {
    normalizeSource,
    registerScope(input: {
      readonly documentId: string;
      readonly managedUri: string;
      readonly kind: DocumentKind;
    }): Promise<IDocumentScopeRegistration> {
      return ledger.enqueue(input.managedUri, () => doRegisterScope(input));
    },
    unregisterScope(input: { readonly documentId: string; readonly managedUri: string }): Promise<void> {
      return ledger.enqueue(input.managedUri, () => doUnregisterScope(input));
    },
    ensureTargetScope(managedUri: string, kind: DocumentKind): Promise<IDocumentTargetScopeAssurance> {
      // 与挂载/注销/换算同键串行：目标注册不得越过在途注销，反之亦然（账本队列互斥）。
      return ledger.enqueue(managedUri, () => doEnsureTargetScope(managedUri, kind));
    },
    releaseTargetScope(managedUri: string): Promise<void> {
      // 与挂载/注销/提交同键串行：释放不得与在途挂载/提交交错（两拍时序的队列面延伸）。
      return ledger.enqueue(managedUri, () => doReleaseTargetScope(managedUri));
    },
    localPathOf(managedUri: string, nativeSession: number): Promise<string> {
      // 与挂载/注销同键串行：换算不得越过在途挂载（未登记的作用域在核心侧必判未命中）。
      return ledger.enqueue(managedUri, () => doLocalPathOf(managedUri, nativeSession));
    },
    scopeRootOf(managedUri: string): string | null {
      const entry = ledger.lookup(managedUri);
      return entry === undefined ? null : managedUriOfScopeRoot(entry.scope);
    },
  };
}
