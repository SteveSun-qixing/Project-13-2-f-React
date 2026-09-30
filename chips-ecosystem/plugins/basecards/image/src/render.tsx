import type { ReactElement } from 'react';
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
import { ImageView } from './view';
import { ImageEditorView, isEditorConfigComplete } from './editor';
import { CARD_TYPE_ID, readConfig } from './config';
import type { IImageConfig } from './config';

/**
 * 渲染入口（08-基础卡片插件接口 §2.5）：承载 `renderView` / `renderEditor`，
 * 构建为 `render.js`；React 与 `@chips/ui` 外部化为平台 vendor 引用。
 */

// ---------- 查看态：renderView ----------

const viewMounts = new WeakMap<HTMLElement, Dispose>();

/**
 * 查看态渲染：把一个节点视图渲染到容器（08 §2.4.1）。
 *
 * 同一容器可能被多次调用（视图更新）：每次调用先释放上一次效果并覆盖内容；
 * 返回的释放句柄幂等。
 */
function renderView(basecard: BaseCardView, container: HTMLElement): Dispose {
  viewMounts.get(container)?.();
  container.replaceChildren();
  const root: Root = createRoot(container);
  flushSync(() => {
    root.render(<ImageView config={basecard.content['config']} />);
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

interface IImageEditorBoundaryProps {
  config: IImageConfig;
  onChange: (next: IImageConfig) => void;
}

/** 会话键隔离的编辑器面板：会话基线前进时整体重挂载（以 revision 为键）。 */
function ImageEditorBoundary(props: IImageEditorBoundaryProps): ReactElement {
  return <ImageEditorView {...props} />;
}

/**
 * 基础卡片编辑器句柄（08 §4.1、§4.2）。
 *
 * 回流唯一时序（08 §4.3 规则 1）：`getChange()` → 编辑链路校验 → `document:write` →
 * 渲染会话 `update(view, revision)` → `markCommitted(revision)`；
 * 编辑器不负责保存，`dispose()` 丢弃待提交变更且不发布事件（08 §4.3 规则 9）。
 */
class ImageEditor implements IBaseCardEditor {
  public state: EditorState = 'active';
  private base: IImageConfig;
  private revision: number;
  private pending: BaseCardChange | null = null;
  private dirty = false;
  private readonly host: HTMLElement;
  private readonly root: Root;
  private readonly changeHandlers = new Set<(payload: IBaseCardEditorEventMap['change']) => void>();
  private readonly dirtyHandlers = new Set<(payload: IBaseCardEditorEventMap['dirty']) => void>();

  public constructor(basecard: BaseCardView, container: HTMLElement) {
    this.base = readConfig(basecard.content['config']);
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
      this.base = readConfig(committed.content['config']);
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
    this.base = readConfig(basecard.content['config']);
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
    this.host.querySelector<HTMLInputElement>('input')?.focus();
  }
  public dispose(): void {
    if (this.state === 'disposed') {
      return;
    }
    this.root.unmount();
    this.changeHandlers.clear();
    this.dirtyHandlers.clear();
    this.pending = null;
    this.dirty = false;
    this.state = 'disposed';
  }

  private mount(): void {
    flushSync(() => {
      this.root.render(
        <ImageEditorBoundary
          key={this.revision}
          config={this.base}
          onChange={this.handleConfigChange}
        />
      );
    });
  }
  private readonly handleConfigChange = (next: IImageConfig): void => {
    if (this.state !== 'active' || !isEditorConfigComplete(next)) {
      return;
    }
    const change: BaseCardChange = {
      kind: 'replace',
      content: {
        card_type: CARD_TYPE_ID,
        config: { ...next },
      },
    };
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
 */
function renderEditor(basecard: BaseCardView, container: HTMLElement): IBaseCardEditor {
  return new ImageEditor(basecard, container);
}

/** 渲染入口：默认导出 IBaseCardPlugin 渲染面实现，由平台装载；validateConfig 直发于 ./config 与 ./main。 */
export const renderPlugin: Pick<IBaseCardPlugin, 'renderView' | 'renderEditor'> = {
  renderView,
  renderEditor,
};

export { renderView, renderEditor };

export default renderPlugin;
