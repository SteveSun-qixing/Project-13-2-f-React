import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type {
  BaseCardChange,
  BaseCardView,
  Dispose,
  EditorState,
  IBaseCardEditor,
  IBaseCardEditorEventMap,
  IBaseCardPlugin,
  ISubscription,
} from '@chips/sdk';
import { RichTextView } from './view';
import { RichTextEditorView, buildEditorChange } from './editor';
import type { IRichTextDraft } from './editor';
import { readContent } from './config';
import {
  focusRichTextEditor,
  insertTextIntoRichTextEditor,
  replaceRichTextDocument,
} from './milkdown/engine';
import type { MilkdownEditor } from './milkdown/engine';

/**
 * 渲染入口（08-基础卡片插件接口 §2.5）：承载 `renderView` / `renderEditor`，
 * 构建为 `render.js`；React 与 `@chips/ui` 外部化为平台 vendor 引用，Milkdown
 * （RA-11）随包构建进入渲染面。
 *
 * 容器生命周期：同一容器多次调用时先释放上一次挂载并覆盖内容；返回的释放句柄幂等
 * （§2.4.1 规则 3~5）。
 */

// ---------- 查看态：renderView ----------

const viewMounts = new WeakMap<HTMLElement, Dispose>();

/**
 * 查看态渲染：把一个节点视图渲染到容器（08 §2.4.1）。
 *
 * @param basecard - 只读节点渲染视图
 * @param container - 帧运行时为该节点提供的独立容器
 * @returns 释放本次挂载的幂等句柄
 */
function renderView(basecard: BaseCardView, container: HTMLElement): Dispose {
  viewMounts.get(container)?.();
  container.replaceChildren();
  const root: Root = createRoot(container);
  flushSync(() => {
    root.render(<RichTextView content={basecard.content} />);
  });
  let released = false;
  const dispose = (): void => {
    if (released) {
      return;
    }
    released = true;
    root.unmount();
    if (viewMounts.get(container) === dispose) {
      viewMounts.delete(container);
    }
  };
  viewMounts.set(container, dispose);
  return dispose;
}

// ---------- 编辑态：renderEditor ----------

/**
 * 基础卡片编辑器句柄（08 §4.1、§4.2）。
 *
 * 编辑引擎 = Milkdown（用户裁决 2026-10-01 第 3 项；RA-11）：ProseMirror 实例经
 * `./milkdown/engine` 唯一装配点挂载，序列化回流经草稿通道进入本句柄。
 *
 * 回流唯一时序（08 §4.3 规则 1）：`getChange()` → 编辑链路校验 → `document:write` →
 * 渲染会话 `update(view, revision)` → `markCommitted(revision)`；
 * 编辑器不负责保存（不写文件），`dispose()` 丢弃待提交变更且不发布事件（08 §4.3 规则 9）。
 */
class RichTextEditor implements IBaseCardEditor {
  public state: EditorState = 'active';
  private readonly contentSource: 'inline' | 'file';
  private base: Record<string, unknown>;
  private revision: number;
  private pending: BaseCardChange | null = null;
  private dirty = false;
  private milkdown: MilkdownEditor | null = null;
  private readonly host: HTMLElement;
  private readonly root: Root;
  private readonly changeHandlers = new Set<(payload: IBaseCardEditorEventMap['change']) => void>();
  private readonly dirtyHandlers = new Set<(payload: IBaseCardEditorEventMap['dirty']) => void>();

  public constructor(basecard: BaseCardView, container: HTMLElement) {
    this.base = { ...basecard.content };
    this.contentSource = readContent(basecard.content).content_source;
    this.revision = basecard.revision;
    this.host = container;
    container.replaceChildren();
    this.root = createRoot(container);
    this.mount();
  }
  public isDirty(): boolean {
    return this.pending !== null;
  }
  public getChange(): BaseCardChange | null {
    return this.pending;
  }
  public markCommitted(revision: number): void {
    if (this.state === 'disposed' || revision <= this.revision) {
      return;
    }
    const committed = this.pending;
    this.revision = revision;
    if (committed !== null && committed.kind === 'replace') {
      this.base = { ...committed.content };
    }
    if (this.pending === committed) {
      this.pending = null;
      this.setDirty(false);
    }
  }
  public update(basecard: BaseCardView, revision: number): void {
    if (this.state === 'disposed' || revision <= this.revision) {
      return;
    }
    this.revision = revision;
    this.base = { ...basecard.content };
    this.pending = null;
    this.setDirty(false);
    this.mount();
  }
  public subscribe<TEvent extends keyof IBaseCardEditorEventMap>(
    event: TEvent,
    handler: (payload: IBaseCardEditorEventMap[TEvent]) => void
  ): ISubscription {
    if (this.state === 'disposed') {
      return { dispose: (): void => undefined };
    }
    if (event === 'change') {
      const typed = handler as (payload: IBaseCardEditorEventMap['change']) => void;
      this.changeHandlers.add(typed);
      return {
        dispose: (): void => {
          this.changeHandlers.delete(typed);
        },
      };
    }
    const typed = handler as (payload: IBaseCardEditorEventMap['dirty']) => void;
    this.dirtyHandlers.add(typed);
    return {
      dispose: (): void => {
        this.dirtyHandlers.delete(typed);
      },
    };
  }
  public focus(): void {
    if (this.state !== 'active') {
      return;
    }
    if (this.milkdown !== null) {
      focusRichTextEditor(this.milkdown);
      return;
    }
    // 引擎仍在异步装载时的兜底：编辑面已挂载即可聚焦，装载完成前为空操作。
    this.host.querySelector<HTMLElement>('.ProseMirror')?.focus();
  }
  public dispose(): void {
    if (this.state === 'disposed') {
      return;
    }
    this.milkdown = null;
    this.root.unmount();
    this.changeHandlers.clear();
    this.dirtyHandlers.clear();
    this.pending = null;
    this.dirty = false;
    this.state = 'disposed';
  }

  /**
   * 程序化编辑入口（宿主驱动/测试面）：在首个文本块选择处插入文本；
   * 与键入同一事务路径（transaction → state → listener 序列化 → 草稿 → 待提交变更）。
   */
  public insertText(text: string): void {
    if (this.state !== 'active' || this.milkdown === null) {
      return;
    }
    insertTextIntoRichTextEditor(this.milkdown, text);
  }

  /**
   * 程序化全文替换（宿主驱动/测试面）：以 Markdown 源文整体替换文档，
   * 与 `update()` 基线替换同构，经同一事务路径触发序列化回流。
   */
  public replaceDocument(markdown: string): void {
    if (this.state !== 'active' || this.milkdown === null) {
      return;
    }
    replaceRichTextDocument(this.milkdown, markdown);
  }

  private mount(): void {
    flushSync(() => {
      this.root.render(
        <RichTextEditorView
          key={this.revision}
          content={this.base}
          contentSource={this.contentSource}
          onDraftChange={this.handleDraftChange}
          onMilkdownReady={this.handleMilkdownReady}
        />
      );
    });
  }
  private readonly handleMilkdownReady = (editor: MilkdownEditor): void => {
    if (this.state !== 'active') {
      return;
    }
    this.milkdown = editor;
  };
  private readonly handleDraftChange = (draft: IRichTextDraft): void => {
    if (this.state !== 'active') {
      return;
    }
    const change = buildEditorChange(this.base, this.contentSource, draft);
    if (change === null) {
      return;
    }
    const wasDirty = this.pending !== null;
    this.pending = change;
    if (!wasDirty) {
      this.setDirty(true);
    }
    for (const handler of this.changeHandlers) {
      handler({ change });
    }
  };
  private setDirty(next: boolean): void {
    if (this.dirty === next) {
      return;
    }
    this.dirty = next;
    for (const handler of this.dirtyHandlers) {
      handler({ isDirty: next });
    }
  }
}

/**
 * 编辑态渲染：在容器内挂载节点编辑器并返回编辑句柄（08 §2.4.2）。
 *
 * @param basecard - 只读节点渲染视图
 * @param container - 编辑链路的就近渲染容器挂载点
 * @returns 编辑会话句柄
 */
function renderEditor(basecard: BaseCardView, container: HTMLElement): IBaseCardEditor {
  return new RichTextEditor(basecard, container);
}

/** 渲染入口：默认导出 IBaseCardPlugin 渲染面实现，由平台装载；validateConfig 直发于 ./config 与 ./main。 */
export const renderPlugin: Pick<IBaseCardPlugin, 'renderView' | 'renderEditor'> = {
  renderView,
  renderEditor,
};

export { renderView, renderEditor };

export default renderPlugin;
