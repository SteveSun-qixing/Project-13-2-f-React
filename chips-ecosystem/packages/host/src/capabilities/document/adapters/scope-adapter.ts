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
 * - **写位现状（工单053 波 C）**：目录态挂载按 §11.3 行 16 以 `writable = true` 登记
 *   （挂载 policy 面，非权限注入）；会话权限集仍为空（绑定层无授权注入导出），
 *   受控写链路的授权注入归工单053 波 C，本波不注入、不伪造。
 */

import { statSync } from 'node:fs';
import { basename, extname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { DiagnosticsSink } from '../../../shared/diagnostics.js';
import type { DocumentForm, DocumentKind, IDocumentCapabilityContext } from '../contract.js';
import { asDocumentCapabilityError, DocumentCapabilityError } from '../errors.js';
import {
  DOCUMENT_SCOPE_OWNER,
  canonicalizeDocumentPath,
  deriveDocumentScopeFromCanonical,
} from '../scope-derivation.js';
import type { IDocumentScopePort, IDocumentScopeRegistration, IResolvedDocumentSource } from '../ports.js';
import type { INativeResourceModule } from './native-resource-module.js';

/** 会话种类判别字面量（绑定层 `parse_session_kind` 三值之一，document 域挂载用）。 */
const DOCUMENT_SESSION_KIND = 'document';

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

/** 单条在册账：normalizeSource 建立、registerScope 转正、unregisterScope 移除。 */
interface IScopeLedgerEntry {
  readonly managedUri: string;
  readonly scope: string;
  readonly kind: DocumentKind;
  readonly form: DocumentForm;
  readonly canonicalPath: string;
  /** 活绑定（本适配器挂载成功且会话未收口）；`null` = 仅归一在册、未挂载。 */
  mounted: { readonly nativeSession: number; readonly documentId: string } | null;
}

/** 适配器依赖。 */
export interface IDocumentScopeAdapterDeps {
  /** §11.3 资源域类型化消费面（组合根经 `loadNativeResourceBinding` 交付）。 */
  readonly native: INativeResourceModule;
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
 * 簿记模型：`managedUri → 在册账`（normalize 建立 / register 转正 / unregister 移除），
 * 同一 key 的 register/unregister 经 promise 链串行化，杜绝并发双挂载竞态。
 */
export function createDocumentScopeAdapter(deps: IDocumentScopeAdapterDeps): IDocumentScopePort {
  const { native, diagnostics } = deps;
  /** 在册账（scope 生命周期与文档记录同驻，注销即删；应用退出全量收口归 β 接线臂）。 */
  const ledger = new Map<string, IScopeLedgerEntry>();
  /** 串行队列：key = managedUri，register/unregister 共用，保证两拍与挂载互斥。 */
  const queues = new Map<string, Promise<unknown>>();

  function enqueue<T>(key: string, task: () => T | Promise<T>): Promise<T> {
    const previous = queues.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    // 后继任务挂在「吞拒绝」的尾上排队：任一任务失败不阻塞同键后续；本调用自身 rejection 由 next 呈现。
    const tail = next.catch(() => undefined);
    queues.set(key, tail);
    void tail.then(() => {
      if (queues.get(key) === tail) {
        queues.delete(key);
      }
    });
    return next;
  }

  /** 释放臂兜底：仅归一在册（未挂载）即直接销账；已挂载账目保留给 unregisterScope。 */
  function forgetUnmounted(entry: IScopeLedgerEntry): void {
    if (entry.mounted === null && ledger.get(entry.managedUri) === entry) {
      ledger.delete(entry.managedUri);
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
    return enqueue(`normalize:${source}`, async (): Promise<IResolvedDocumentSource> => {
      if (typeof source !== 'string' || source.length === 0) {
        throw new DocumentCapabilityError('RESOURCE_INVALID_URI', { message: '文档来源不能为空' });
      }
      if (source.startsWith(MANAGED_URI_PREFIX)) {
        // 受管引用回查：仅受理本适配器在册的键（会话键与受管引用同源）；
        // 远端物化/他域作用域直读通道未开（本波拒收，不猜内容）。
        const entry = ledger.get(source);
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
      const existing = ledger.get(managedUri);
      if (existing !== undefined) {
        // 同物理根再归一：账目在位即复用（活绑定由 registerScope 幂等臂放行）；
        // 已挂载者先经反向直读核验（点位三消费分叉的「命中反查复用」臂）。
        await assertLiveMountResolvable(existing);
        return { managedUri, localPath: existing.canonicalPath, form: existing.form };
      }
      ledger.set(managedUri, { managedUri, scope, kind, form, canonicalPath, mounted: null });
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
    const entry = ledger.get(managedUri);
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

  async function doRegisterScope(input: {
    readonly documentId: string;
    readonly managedUri: string;
    readonly kind: DocumentKind;
  }): Promise<IDocumentScopeRegistration> {
    const entry = ledger.get(input.managedUri);
    if (entry === undefined) {
      throw new DocumentCapabilityError('RESOURCE_INVALID_URI', {
        message: '作用域注册缺少归一前置（managedUri 未经 normalizeSource 归一）',
      });
    }
    if (entry.mounted !== null) {
      // 幂等复用臂（窄形）：本适配器活绑定在位 → 同 owner（构造恒等）核对账本三一致，
      // 回执既有活绑定的同一原生会话（INV-1：记录面数值会话与在册账同源，不分叉）。
      if (entry.mounted.documentId === input.documentId && entry.kind === input.kind) {
        return { nativeSession: entry.mounted.nativeSession };
      }
      throw new DocumentCapabilityError('RESOURCE_ALREADY_EXISTS', {
        message: '同一受管引用已绑定不同文档标识或种类（真冲突，禁抢占）',
      });
    }
    const nativeSession = native.resourceOpenSession(DOCUMENT_SESSION_KIND, DOCUMENT_SCOPE_OWNER);
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
    entry.mounted = { nativeSession, documentId: input.documentId };
    return { nativeSession };
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
    const entry = ledger.get(input.managedUri);
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
    if (ledger.get(entry.managedUri) === entry) {
      ledger.delete(entry.managedUri);
    }
  }

  return {
    normalizeSource,
    registerScope(input: {
      readonly documentId: string;
      readonly managedUri: string;
      readonly kind: DocumentKind;
    }): Promise<IDocumentScopeRegistration> {
      return enqueue(`scope:${input.managedUri}`, () => doRegisterScope(input));
    },
    unregisterScope(input: { readonly documentId: string; readonly managedUri: string }): Promise<void> {
      return enqueue(`scope:${input.managedUri}`, () => doUnregisterScope(input));
    },
    localPathOf(managedUri: string, nativeSession: number): Promise<string> {
      // 与挂载/注销同键串行：换算不得越过在途挂载（未登记的作用域在核心侧必判未命中）。
      return enqueue(`scope:${managedUri}`, () => doLocalPathOf(managedUri, nativeSession));
    },
    scopeRootOf(managedUri: string): string | null {
      const entry = ledger.get(managedUri);
      return entry === undefined ? null : managedUriOfScopeRoot(entry.scope);
    },
  };
}
