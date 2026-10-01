/// PDF 视觉层待落编辑的纯数据形状：旧仓这些类型定义在重写面组件
/// （DrawLayer.tsx / ImageEditLayer.tsx / text-edit-preview.tsx）内，域状态模块
/// （edit-state.ts）反向依赖组件类型。迁移时按矩阵「UI 重写、逻辑迁移」裁决把四个
/// 纯数据形状逐字回收到域契约层，组件重写臂改为消费本模块；字段与语义为迁移原文。
import type {
  DrawingInput,
  ImageEditInput,
  StaticFormFillRecord,
  TextEditInput,
  TextInsertInput,
} from './office-pdf-contract'
import type { DocFontStyle } from '../domain/doc-font'

export interface LocalDrawing {
  id: string
  input: DrawingInput
  /** Present when this drawing is the visual value placed into an AcroForm /Sig widget. */
  formWidgetId?: string
}

export interface LocalImageEdit {
  id: string
  input: ImageEditInput
  /** Ghost PNG (base64) of a transformed existing image; null while loading/unavailable */
  png?: string | null
  /** Z-band the existing image had before this op (labels the layer toggle) */
  origAbove?: boolean
  /** Editable source metadata when this image is a static form fill. */
  staticFill?: StaticFormFillRecord
  /** Pre-transparency pixels of the op's current bytes: transparency presets re-bake
      from this so they set an absolute level instead of compounding. Cleared by any
      other pixel edit (flip/crop/cutout/replace/insert-rotate). */
  opacityBase?: string
}

export interface LocalTextEdit {
  id: string
  input: TextEditInput
  /** Matched run's ink bounds from validation (PDF user space). The edit rect is a pdf.js
      layout box; glyph ink can poke out of it, so the preview covers this instead */
  cover?: [number, number, number, number]
  /** The run's base ink (display-only, from the draft's probe): the pending preview
      shows the document's real color when the edit doesn't change it */
  baseInk?: string
  /** Local look-alike of the run's own font (display-only, from the PostScript
      name): the pending preview reads like the document. Never sent to the engine. */
  baseFont?: DocFontStyle
  /** Accumulated block-move delta (PDF user space). Renderer metadata only: the preview
      and hover box draw at rect + moveBy while input.rect stays at the original position
      (it is the save-time match key). The engine-side position rides in input.translate
      (pure moves) or the shifted input.origin (moved rebuild edits). */
  moveBy?: [number, number]
}

export interface LocalTextInsert {
  id: string
  input: TextInsertInput
}
