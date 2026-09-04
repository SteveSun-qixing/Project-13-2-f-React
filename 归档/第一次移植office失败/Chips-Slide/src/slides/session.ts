/**
 * 本地文档会话 —— GenOffice Slides 主进程（slides-main.ts 持有 OpenedPptx 会话 +
 * op 执行器 + 快照历史）的渲染进程内等价物。
 *
 * 架构变化：原版解析/保存引擎跑在 Electron 主进程，渲染进程经 IPC 调用 op；
 * 移植后 pptx-engine / pptx-render 全部进入渲染进程，React 组件直接调用本会话：
 *   open(bytes)       → openPptx 解析出 OpenedPptx
 *   applyOp(txn)      → 快照历史 + runTxn 执行 op 事务，失败整体回滚
 *   rebuild(slideIdx) → buildRenderSlide 重出 RenderTree（纯数据渲染列表）
 *   save()            → savePptx 打补丁式保存（未修改页逐字节透传）+ commitSaved
 */
import {
  commitSaved,
  materializeSlide,
  openPptx,
  savePptx,
  type OpenedPptx,
  type SlideElement,
} from '@genoffice/pptx-engine'
import {
  buildRenderSlide,
  type RenderSlide,
} from '@genoffice/pptx-render'
import { SessionHistory } from './history'
import { makeMediaResolver } from './render/media-resolver'
import { runTxn, type Op, type TxnRequest, type TxnResult } from './ops'

/** 会话元信息：来源路径/名称在保存与界面标题中使用。 */
export interface SessionMeta {
  path: string | null
  fileName: string | null
}

export class SlidesDocumentSession {
  private opened: OpenedPptx
  private history: SessionHistory
  private fitWidthPx = 960
  private dirty = false
  private meta: SessionMeta

  private constructor(opened: OpenedPptx, meta: SessionMeta) {
    this.opened = opened
    this.meta = meta
    this.history = new SessionHistory(opened)
  }

  /** 打开一份 pptx 字节流（来源路径仅用于另存为默认名与界面展示）。 */
  static async open(bytes: Uint8Array, path: string | null): Promise<SlidesDocumentSession> {
    const opened = await openPptx(bytes)
    return new SlidesDocumentSession(opened, {
      path,
      fileName: path ? path.split(/[\\/]/).pop() ?? null : null,
    })
  }

  get metaInfo(): SessionMeta {
    return this.meta
  }

  /** 更新当前文档的保存目标（另存为成功后调用）。 */
  setMeta(path: string | null, fileName?: string | null): void {
    this.meta = {
      path,
      fileName: fileName ?? (path ? path.split(/[\\/]/).pop() ?? null : null),
    }
  }

  get deckSize(): { cx: number; cy: number } {
    return { ...this.opened.deck.size }
  }

  get slideCount(): number {
    return this.opened.deck.slides.length
  }

  get isDirty(): boolean {
    return (
      this.dirty ||
      this.opened.deck.slides.some(
        (s) =>
          s.structureDirty ||
          s.elements.some((el) => el.dirty || el.dirtyTransform || el.dirtyFill || el.dirtyStroke),
      )
    )
  }

  setFitWidth(fitWidthPx: number): void {
    this.fitWidthPx = fitWidthPx
  }

  get fitWidth(): number {
    return this.fitWidthPx
  }

  /** 读取一页的元素模型（工具栏读取选中元素的字体/填充等属性用）。 */
  getElement(slideIndex: number, sourceId: string): SlideElement | null {
    const slide = this.opened.deck.slides[slideIndex]
    return slide?.elements.find((el) => el.id === sourceId) ?? null
  }

  /** 重建单页 RenderTree（编辑后由界面调用）。 */
  rebuild(slideIndex: number): RenderSlide | null {
    const slide = this.opened.deck.slides[slideIndex]
    if (!slide) return null
    return buildRenderSlide(slide, this.opened.deck.size, {
      fitWidthPx: this.fitWidthPx,
      media: makeMediaResolver(this.opened, slide.path),
      slideNo: slideIndex + 1,
    })
  }

  /** 重出全部页面。 */
  rebuildAll(): RenderSlide[] {
    return this.opened.deck.slides.map((slide, i) =>
      buildRenderSlide(slide, this.opened.deck.size, {
        fitWidthPx: this.fitWidthPx,
        media: makeMediaResolver(this.opened, slide.path),
        slideNo: i + 1,
      }),
    )
  }

  /** 结构变更（增删页/表格结构/主题等）后：烘焙字节并整页重出。 */
  rebuildWithReparse(slideIndex: number): RenderSlide | null {
    const fresh = materializeSlide(this.opened, slideIndex)
    if (!fresh) return null
    return buildRenderSlide(fresh, this.opened.deck.size, {
      fitWidthPx: this.fitWidthPx,
      media: makeMediaResolver(this.opened, fresh.path),
      slideNo: slideIndex + 1,
    })
  }

  /**
   * 执行一个 op 事务：先 dry-run 校验（无效请求不得污染历史），通过后压入快照
   * 历史再执行；执行失败由执行器回滚模型并弹出刚压入的快照。
   */
  applyTxn(req: TxnRequest): TxnResult {
    const plan = runTxn(this.opened, { ...req, dryRun: true })
    const invalid = plan.failures?.length ?? 0
    if ((req.isolation ?? 'atomic') === 'atomic' ? invalid > 0 : invalid >= req.ops.length) {
      return plan
    }
    this.history.push()
    const result = runTxn(this.opened, req)
    if (!result.applied) {
      this.history.pop()
      return result
    }
    this.dirty = true
    return result
  }

  /** 重建单页 RenderTree（编辑后由界面调用）。 */
  getRenderSlide(slideIndex: number): RenderSlide | null {
    return this.rebuild(slideIndex)
  }

  /** 单 op 便捷入口：等价于单元素事务的 applyTxn。 */
  applyOp(op: Op): TxnResult {
    return this.applyTxn({ ops: [op] })
  }

  undo(): boolean {
    const ok = this.history.undo()
    if (ok) this.dirty = true
    return ok
  }

  redo(): boolean {
    const ok = this.history.redo()
    if (ok) this.dirty = true
    return ok
  }

  get canUndo(): boolean {
    return this.history.canUndo
  }

  get canRedo(): boolean {
    return this.history.canRedo
  }

  /**
   * 保存：打补丁式重建 zip —— 未修改的页逐字节透传，修改过的页仅重写该页 XML。
   * 成功后 commitSaved 烘焙补丁（等价于重新打开后的状态）。
   */
  async save(): Promise<Uint8Array> {
    const bytes = await savePptx(this.opened)
    commitSaved(this.opened)
    this.dirty = false
    return bytes
  }
}
