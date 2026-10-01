/**
 * 文档域作用域在册账（工单036 波 C3 自 scope 适配器升格的域内单源）。
 *
 * 权威：`04-资源管理设计` §5.2（作用域注册）、`04.11` §11.3 行 19–20（点位三
 * `managedUri ↔ localPath` 双向换算的消费面分工：路径事实单源在核心 `ScopeRegistry`
 * 的 `Origin`，账本只承载作用域身份与不可替代的挂载输入路径）、
 * `adapters/scope-adapter.ts` 头注（INV-1~INV-6）。
 *
 * @remarks
 - **单一事实账**：`managedUri → 在册账`（normalizeSource 建立 / registerScope 转正 /
 *   unregisterScope 移除）原为 scope 适配器私有；波 C3 起由本类承载——
 *   `IDocumentStoragePort` 正式适配器（`storage-adapter.ts`）在同一账上解析提交目标的
 *   「作用域 + 原生会话」事实，禁第二套簿记（第二账即双份事实源，工单036 波 B2
 *   消除双源的同一口径延展到存储面）。
 * - **路径副索引**：挂载输入路径（canonicalPath，与点位三正向换算返回值同形）→ 账目，
 *   随登记/销账与主账同步——存储适配器以服务交付的 `localPath` 解析目标账目。
 * - **单队列串行**：同键（受管引用）的挂载 / 注销 / 换算 / 提交 / 列举经同一 promise 链
 *   串行化——挂载未落定时核心侧换算必判未命中、提交不得越过在途注销（两拍时序 INV-2
 *   的存储面延伸）；后继任务挂在「吞拒绝」的尾上排队，任一任务失败不阻塞同键后续。
 */

import type { DocumentForm, DocumentKind } from '../contract.js';

/** 单条在册账：normalizeSource 建立、registerScope 转正、unregisterScope 移除。 */
export interface IScopeLedgerEntry {
  readonly managedUri: string;
  readonly scope: string;
  readonly kind: DocumentKind;
  readonly form: DocumentForm;
  readonly canonicalPath: string;
  /** 活绑定（本适配器挂载成功且会话未收口）；`null` = 仅归一在册、未挂载。 */
  mounted: { readonly nativeSession: number; readonly documentId: string } | null;
}

/**
 * 文档域作用域在册账（scope / storage 两正式适配器共用；组合根构造一份随依赖注入）。
 *
 * 写读分面：登记/销账仅 scope 适配器经 {@link DocumentScopeLedger.upsert} /
 * {@link DocumentScopeLedger.forget} 触达（INV-5 禁抢占与两拍注销的账目一致性前提），
 * storage 适配器只读消费。
 */
export class DocumentScopeLedger {
  /** 主账（键 = 受管引用；生命周期与文档记录同驻，注销即删）。 */
  private readonly byManagedUri = new Map<string, IScopeLedgerEntry>();
  /** 路径副索引（键 = 挂载输入路径 / 点位三正向换算返回值同形）。 */
  private readonly byPackageRoot = new Map<string, IScopeLedgerEntry>();
  /** 串行队列（键 = 受管引用；挂载/注销/换算/提交/列举共用，跨端口互斥）。 */
  private readonly queues = new Map<string, Promise<unknown>>();

  /** 主账直读（scope 适配器既有 `ledger.get` 簿记语义的同形窗口）。 */
  lookup(managedUri: string): IScopeLedgerEntry | undefined {
    return this.byManagedUri.get(managedUri);
  }

  /** 同账登记（normalizeSource 建立位）：主账 + 路径副索引同步。 */
  upsert(entry: IScopeLedgerEntry): void {
    this.byManagedUri.set(entry.managedUri, entry);
    this.byPackageRoot.set(entry.canonicalPath, entry);
  }

  /** 同账移除（unregisterScope 销账位）：主账 + 路径副索引同步。 */
  forget(managedUri: string): void {
    const entry = this.byManagedUri.get(managedUri);
    if (entry !== undefined) {
      this.byPackageRoot.delete(entry.canonicalPath);
    }
    this.byManagedUri.delete(managedUri);
  }

  /** 按包根 / 归档文件路径解析在册账（存储适配器消费位；未在册返回 `undefined`）。 */
  findByPackageRoot(localPath: string): IScopeLedgerEntry | undefined {
    return this.byPackageRoot.get(localPath);
  }

  /**
   * 按作用域 ID 解析在册账（资源打开路由的 §4.6 形态探针消费位；未在册返回 `undefined`）。
   *
   * @remarks 同一作用域在册账中至多一条（INV-5 禁抢占：同 scope 重复登记在挂载入口即拒），
   * 线性扫描规模受打开文档数约束，读路径无锁（账目变更只在 scope 适配器串行队列内发生）。
   */
  findByScope(scope: string): IScopeLedgerEntry | undefined {
    for (const entry of this.byManagedUri.values()) {
      if (entry.scope === scope) {
        return entry;
      }
    }
    return undefined;
  }

  /**
   * 同键串行队列。
   *
   * @remarks 后继任务挂在「吞拒绝」的尾上排队：任一任务失败不阻塞同键后续；
   * 本调用自身 rejection 由返回的 promise 呈现（scope 适配器既有 enqueue 语义原样升格）。
   */
  enqueue<T>(key: string, task: () => T | Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.then(task, task);
    const tail = next.catch(() => undefined);
    this.queues.set(key, tail);
    void tail.then(() => {
      if (this.queues.get(key) === tail) {
        this.queues.delete(key);
      }
    });
    return next;
  }
}
