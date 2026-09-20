/**
 * 卡片 / 帧窗口编排（主进程窗口编排域，金链路刀4 / 集成缝 3）。
 *
 * 权威：`05-渲染引擎设计` §3.1（渲染进程结构与安全基线）、§6.2/§9.1（卡片帧宿主与帧入口
 * 装载时序）、§9.3（帧生命周期消息清单）；`17-跨端Shell与平台抽象设计` §2.4（窗口创建经壳的
 * 唯一窗口通道）、`04-能力契约规范` §7.4（`windowId` 为 `webContents.id`）。
 *
 * @remarks
 * - 唯一窗口通道：全部窗口创建经 {@link ShellWindowManager.createWindow}（其下为
 *   `window-port` 的 `ShellWindowFactory` 切片），本模块不开第二套窗口通道、不直接触碰
 *   `BrowserWindow`。
 * - 生命周期：创建 → 装载（`chips-resource://platform/entries/card.html` 规范 URI，无
 *   query / fragment）→ 绑定（`windowId ↔ source` 登记）→ 销毁（经 `webContents`
 *   destroyed 事件自动解绑）。窗口的会话绑定、协议处理器与核心会话清理由既有
 *   `WebContentsBinder` / `WindowRegistry` 链路承载，本模块只做卡片域语义。
 * - 单窗口单文档：同一 `source` 至多一个存活卡片窗口；重复打开前置（`show`）而非新建。
 * - 文档绑定投递（主进程登记表 → 卡片窗口渲染侧的装载输入）是已登记集成缝：
 *   `document:*` 能力接线在途（#99），本波只编码冻结契约面并在开发日志留痕，不留假通路。
 */

import { ChipsError } from '@chips/bridge';

import { parseResourceUri } from '../protocol/resource-uri.js';
import type { DiagnosticsSink } from '../shared/diagnostics.js';
import type { WindowRegistry } from './window-registry.js';
import { CARD_WINDOW_ENTRY_URL } from './window-entries.js';
import type { ShellWindowManager } from './window-manager.js';

/** 卡片窗口打开输入。 */
export interface ICardWindowOpenInput {
  /** 文档来源引用（`04-文件格式规范` 的引用形式；`chips-resource://` 形态做资源 URI 语法闸）。 */
  readonly source: string;
  /** 窗口标题；缺省 `薯片 · 卡片`。 */
  readonly title?: string;
  /** 内容宽度；缺省 480。 */
  readonly width?: number;
  /** 内容高度；缺省 720。 */
  readonly height?: number;
}

/** 一张已打开卡片窗口的编排记录。 */
export interface ICardWindowRecord {
  /** 窗口 ID（`webContents.id`）。 */
  readonly windowId: number;
  /** 绑定的文档来源引用。 */
  readonly source: string;
  /** 装载入口 URI（恒为卡片窗口入口）。 */
  readonly entryUrl: string;
  /** 绑定时间（Unix epoch 毫秒）。 */
  readonly openedAt: number;
}

/** 编排器依赖。 */
export interface ICardWindowOrchestratorDeps {
  /** 壳窗口管理器（唯一窗口创建通道）。 */
  readonly windowManager: ShellWindowManager;
  /** 窗口注册表（存活与句柄判定）。 */
  readonly registry: WindowRegistry;
  /** 诊断口。 */
  readonly diagnostics: DiagnosticsSink;
  /** 时钟（测试注入）。 */
  readonly now?: () => number;
}

/** 来源引用最大长度（防御超长输入进入标题与登记表）。 */
const SOURCE_MAX_LENGTH = 4096;

/**
 * 卡片 / 帧窗口编排器：应用窗口的卡片域生命周期服务。
 */
export class CardWindowOrchestrator {
  private readonly deps: ICardWindowOrchestratorDeps;
  private readonly now: () => number;
  private readonly byWindowId = new Map<number, ICardWindowRecord>();
  private readonly windowIdBySource = new Map<string, number>();

  constructor(deps: ICardWindowOrchestratorDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
  }

  /** 当前存活的卡片窗口记录（打开序）。 */
  list(): readonly ICardWindowRecord[] {
    return [...this.byWindowId.values()];
  }

  /** 按来源引用解析存活卡片窗口；未打开为 `null`。 */
  find(source: string): ICardWindowRecord | null {
    const windowId = this.windowIdBySource.get(source);
    return windowId === undefined ? null : (this.byWindowId.get(windowId) ?? null);
  }

  /** 按窗口 ID 解析绑定的来源引用；非卡片窗口为 `null`。 */
  sourceOf(windowId: number): string | null {
    return this.byWindowId.get(windowId)?.source ?? null;
  }

  /**
   * 打开（或前置）一张卡片窗口。
   *
   * @param input 打开输入。
   * @returns 卡片窗口编排记录（新建或已存活的聚焦目标）。
   * @throws {ChipsError} 来源引用非法（空 / 含空白 / 超长 / `chips-resource://` 形态语法违约）时抛出；
   *   窗口创建或装载失败时透传窗口管理器的启动错误。
   */
  async open(input: ICardWindowOpenInput): Promise<ICardWindowRecord> {
    this.assertSource(input.source);
    const existing = this.find(input.source);
    if (existing !== null) {
      this.focus(existing.windowId);
      return existing;
    }
    const created = await this.deps.windowManager.createWindow({
      title: input.title ?? '薯片 · 卡片',
      width: input.width ?? 480,
      height: input.height ?? 720,
      url: CARD_WINDOW_ENTRY_URL,
    });
    const binding: ICardWindowRecord = {
      windowId: created.windowId,
      source: input.source,
      entryUrl: CARD_WINDOW_ENTRY_URL,
      openedAt: this.now(),
    };
    this.byWindowId.set(binding.windowId, binding);
    this.windowIdBySource.set(binding.source, binding.windowId);
    created.webContents.onDestroyed(() => {
      this.forget(binding);
    });
    return binding;
  }

  /**
   * 关闭一张卡片窗口（`window.close()`；销毁事件完成解绑）。
   *
   * @param windowId 卡片窗口 ID。
   * @returns 是否发起了关闭；窗口未登记或已不可达为 `false`。
   */
  close(windowId: number): boolean {
    const binding = this.byWindowId.get(windowId);
    if (binding === undefined) {
      return false;
    }
    const record = this.deps.registry.get(windowId);
    if (record === undefined || record.webContents.isDestroyed()) {
      this.forget(binding);
      return false;
    }
    try {
      if (record.window !== null) {
        record.window.close();
      } else {
        record.webContents.close();
      }
    } catch (error) {
      this.deps.diagnostics.error('window', '卡片窗口关闭失败', {
        windowId,
        reason: error instanceof Error ? error.message : typeof error,
      });
      return false;
    }
    return true;
  }

  /**
   * 前置一张卡片窗口（`window.show()`；Electron 对已显示窗口执行前置）。
   *
   * @param windowId 卡片窗口 ID。
   * @returns 是否成功前置；窗口未登记或已不可达为 `false`。
   */
  focus(windowId: number): boolean {
    if (!this.byWindowId.has(windowId)) {
      return false;
    }
    const record = this.deps.registry.get(windowId);
    if (record === undefined || record.webContents.isDestroyed()) {
      return false;
    }
    if (record.window === null) {
      this.deps.diagnostics.warn('window', '卡片窗口无壳侧句柄，无法前置', { windowId });
      return false;
    }
    try {
      record.window.show();
    } catch (error) {
      this.deps.diagnostics.warn('window', '卡片窗口前置失败', {
        windowId,
        reason: error instanceof Error ? error.message : typeof error,
      });
      return false;
    }
    return true;
  }

  /** 解绑（幂等；仅当映射仍指向该记录时删除，防止销毁竞态误删新绑定）。 */
  private forget(binding: ICardWindowRecord): void {
    if (this.byWindowId.get(binding.windowId) === binding) {
      this.byWindowId.delete(binding.windowId);
    }
    if (this.windowIdBySource.get(binding.source) === binding.windowId) {
      this.windowIdBySource.delete(binding.source);
    }
  }

  /** 来源引用校验：非空、无空白、不超长；`chips-resource://` 形态做资源 URI 语法闸。 */
  private assertSource(source: string): void {
    if (typeof source !== 'string' || source.trim().length === 0) {
      throw new ChipsError({
        code: 'BRIDGE_INVALID_INPUT',
        message: '卡片窗口打开失败：文档来源引用不能为空',
        retryable: false,
      });
    }
    if (source.length > SOURCE_MAX_LENGTH || /\s/.test(source)) {
      throw new ChipsError({
        code: 'BRIDGE_INVALID_INPUT',
        message: '卡片窗口打开失败：文档来源引用含空白或超长',
        retryable: false,
      });
    }
    // `chips-resource://` 形态按资源 URI 语法闸校验；其余形态（本地路径引用等）
    // 的合法性判定在文档服务（`document:open` 输入校验），编排器不越权解释。
    if (source.toLowerCase().startsWith('chips-resource://') && !parseResourceUri(source).ok) {
      throw new ChipsError({
        code: 'BRIDGE_INVALID_INPUT',
        message: '卡片窗口打开失败：文档来源引用不是合法的资源 URI',
        retryable: false,
      });
    }
  }
}
