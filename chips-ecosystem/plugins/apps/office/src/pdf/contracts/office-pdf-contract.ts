/// PDF 域契约：由旧仓 `Chips-Office/src/apps/pdf/shared/ipc.ts` 逐字抽取的纯数据类型与常量。
/// 私有 IPC 桥面（PDF_CHANNELS 通道表、PdfApi 接口、AI 通道与请求/结果载荷）按矩阵裁决
/// 废弃不迁移；此处仅保留 pdf 阅读域纯逻辑（标注/绘图/盖章/元数据/文本编辑/图片编辑/
/// 表单值/签名数据）消费的编辑输入契约。字段与语义为迁移原文，详见各块行内注释。

export const VISUAL_SIGNATURE_CONTENT_PREFIX = 'GenOffice visual signature field: '

/** Signature strokes: pad pixel coords, scaled proportionally and y-flipped when placed on the page */
export interface SignatureStrokes {
  paths: number[][]
  width: number
  height: number
}

/** Confirmed signature awaiting placement: hand strokes (Ink) or a bitmap (Stamp) */
export type SignatureData =
  | ({ kind: 'strokes' } & SignatureStrokes)
  | {
      kind: 'image'
      /** base64 PNG, without the data: prefix */
      image: string
      width: number
      height: number
    }

export type MarkupType = 'highlight' | 'underline' | 'strikeout'

/** A text markup to write; quads are 4-point groups in PDF coords (y up) [x1,yTop,x2,yTop,x1,yBottom,x2,yBottom] */
export interface MarkupInput {
  pageIndex: number
  type: MarkupType
  /** rgb normalized to 0-1 */
  color: [number, number, number]
  quads: number[][]
}

/** Reply target: a note (Text) annotation saved in the file. The object number is only a
    lookup hint — pdfium stages that run before pdf-lib may renumber objects — so the
    parent is confirmed by rect + contents at write time. */
export interface NoteReplyTarget {
  objNum: number
  rect: [number, number, number, number]
  contents: string
}

/** Drawing annotations (all coords in PDF user space, y up).
    One union member per kind; a union-literal kind would break TS narrowing. */
interface DrawBase {
  pageIndex: number
  color: [number, number, number]
  width: number
  /** AcroForm field explicitly associated with a visual Ink signature. */
  formFieldName?: string
}

export type DrawingInput =
  | (DrawBase & {
      kind: 'ink'
      /** Each stroke as [x1,y1,x2,y2,...] */
      paths: number[][]
    })
  | (DrawBase & { kind: 'rect'; rect: [number, number, number, number] })
  | (DrawBase & { kind: 'ellipse'; rect: [number, number, number, number] })
  | (DrawBase & { kind: 'line'; from: [number, number]; to: [number, number] })
  | (DrawBase & { kind: 'arrow'; from: [number, number]; to: [number, number] })
  | {
      /** Image signature/stamp placed by the user; written as a Stamp annotation */
      kind: 'image'
      pageIndex: number
      /** base64 PNG, without the data: prefix */
      image: string
      /** PDF user space [x1,y1,x2,y2] */
      rect: [number, number, number, number]
      /** AcroForm field explicitly associated with a visual image signature. */
      formFieldName?: string
    }
  | {
      kind: 'note'
      pageIndex: number
      color: [number, number, number]
      at: [number, number]
      contents: string
      /** Annotation author (/T); omitted → 'GenOffice' */
      author?: string
      /** Creation time (ms since epoch) → /CreationDate and /M; omitted → save time */
      createdMs?: number
      /** Key for parenting replies inside the same request (parents sort before children) */
      localId?: string
      /** This note replies to a note saved in the file */
      replyToSaved?: NoteReplyTarget
      /** This note replies to another note in this request, by its localId */
      replyToLocalId?: string
    }

/**
 * Stamp layer (watermark/header/footer/page numbers all go through it).
 * The renderer rasterizes the bitmap via canvas (with rotation and fonts, bypassing
 * pdf-lib's lack of CJK support); the main process only embeds and positions it.
 */
export interface StampInput {
  pageIndex: number
  /** base64 PNG, without the data: prefix */
  image: string
  /** PDF user space [x1,y1,x2,y2] */
  rect: [number, number, number, number]
  opacity?: number
}

/** Document info; an empty string clears the field */
export interface MetadataInput {
  title?: string
  author?: string
  subject?: string
  keywords?: string
}

/**
 * Content-stream text replacement (pdfium). The renderer only knows pdf.js text items;
 * the main process re-locates the actual text objects by rect intersection and verifies
 * against oldText, because one pdf.js item may span many objects (CJK is often one per glyph).
 */
export interface TextEditInput {
  pageIndex: number
  /** PDF user space [x1,y1,x2,y2] of the run being replaced */
  rect: [number, number, number, number]
  /** Text currently displayed in rect; matching is whitespace-insensitive */
  oldText: string
  /** Replacement; '\n' splits it into stacked lines (one text object per line) */
  newText: string
  /** Original run's font size in PDF pt (fallback sizing for the rebuilt object) */
  fontSize: number
  /** User-chosen size in PDF pt; absent = keep the original run's size */
  newFontSize?: number
  /** User-chosen fill color (0-255 RGB); absent = keep the original run's color */
  newColor?: [number, number, number]
  /** Selection-level fill colors: [start,end) code-unit ranges into newText, ascending
      and non-overlapping. Chars outside every range keep newColor ?? the original run's
      color. The engine splits each rebuilt line into one text object per color.
      Legacy input form — new senders use styleRuns; still accepted by the engine. */
  colorRuns?: { start: number; end: number; color: [number, number, number] }[]
  /** Selection-level style overrides: [start,end) code-unit ranges into newText,
      ascending and non-overlapping. Each present field overrides the whole-edit value
      (newColor / newFont / newFontSize / newBold / newItalic) for the covered range;
      absent fields inherit it. The engine splits each rebuilt line into one text
      object per distinct style, drawing each with its own font face and size.
      Generalizes colorRuns. */
  styleRuns?: {
    start: number
    end: number
    color?: [number, number, number]
    font?: string
    size?: number
    bold?: boolean
    italic?: boolean
  }[]
  /** User-chosen rebuild font (EDIT_FONTS id); absent = keep the original font (embedded
      subset when it covers the replacement, else the same-named installed font, else
      fallback). An explicit id is honored only when the face's cmap covers the whole
      replacement (else fallback) */
  newFont?: string
  /** Baseline origin (PDF user space) for the rebuilt first line. Paragraph edits set
      this to the block's left edge / first baseline — the matched anchor object may be
      an indented or mid-paragraph run. Absent = the anchor object's own position.
      Ignored when the edit resolves to a fragment of a larger run. */
  origin?: [number, number]
  /** Baseline-to-baseline step between '\n' lines in PDF pt (paragraph edits pass the
      block's original leading); absent = fontSize × 1.2. Ignored for fragment matches. */
  lineLeading?: number
  /** Per-'\n'-line horizontal offset from origin.x in PDF pt — centered/right-aligned
      paragraph reflow places each line at its own x. Missing entries mean 0; ignored
      for fragment matches. */
  lineXOffsets?: number[]
  /** Paragraph alignment, renderer-side metadata (preview rendering and draft reopen);
      the engine positions lines purely from origin + lineXOffsets */
  align?: 'left' | 'center' | 'right'
  /** The paragraph editor's logical text as typed (hard line breaks intact),
      renderer-side metadata for reopening the draft — the wrapped newText can't
      tell a soft wrap from a deliberate break. The engine ignores it. */
  blockSource?: string
  /** Bold/italic for the rebuilt run, resolved via font variants: the chosen edit
      font's matching face file, or the original family's matching installed face.
      Degrades silently to the base face when no variant covers the replacement. */
  newBold?: boolean
  newItalic?: boolean
  /** Move the matched run as-is: every matched text object is translated by this
      PDF-user-space delta instead of being rewritten (fonts/kerning/colors survive
      untouched). Requires the match to cover the objects exactly (whole) — moving a
      fragment would drag the surrounding text along, so such edits are skipped.
      newText must be textually equivalent to oldText; nothing is rebuilt. */
  translate?: [number, number]
}

/** A new searchable/selectable text object inserted into a page content stream. */
export interface TextInsertInput {
  pageIndex: number
  /** First-line baseline origin in PDF user space. */
  origin: [number, number]
  /** Text to insert; '\n' creates stacked text objects. */
  text: string
  fontSize: number
  color: [number, number, number]
  font?: string
  bold?: boolean
  italic?: boolean
  lineLeading?: number
  lineXOffsets?: number[]
  align?: 'left' | 'center' | 'right'
  /** Final displayed page rotation; insertion matrix counter-rotates text into screen space. */
  rotate?: number
}

/** Dry-run match result for one pending text edit */

/** Target z-band for a content-stream image: under every text run (above the page
    background) or on top of the page's content */
export type ImageLayer = 'belowText' | 'aboveText'

/**
 * Content-stream image operations (pdfium). Existing images are addressed by their
 * bounds as reported by listPageImages — the main process re-matches the actual object
 * by rect at save time (fail-soft, like text edits), since object indices shift.
 */
export type ImageEditInput =
  | {
      kind: 'insertImage'
      pageIndex: number
      /** base64 PNG, without the data: prefix */
      image: string
      /** PDF user space [x1,y1,x2,y2] footprint */
      rect: [number, number, number, number]
      layer: ImageLayer
      /** Final display rotation of the page (0/90/180/270); the image content is
          counter-rotated so it shows upright on rotated pages */
      rotate?: number
    }
  | {
      kind: 'transformImage'
      pageIndex: number
      /** Bounds of the target image when listed (match key) */
      oldRect: [number, number, number, number]
      /** Final footprint (already width/height-swapped when quarterTurns is odd) */
      rect: [number, number, number, number]
      /** Present = also move the object to this z-band */
      layer?: ImageLayer
      /** Screen-clockwise quarter turns (0-3) applied about the image center.
          2D rotations commute with the page /Rotate mapping, so no adjustment
          for rotated pages is needed */
      quarterTurns?: number
    }
  | {
      kind: 'replaceImage'
      pageIndex: number
      /** Bounds of the target image when listed (match key) */
      oldRect: [number, number, number, number]
      /** Final footprint (drag/resize/rotate after the swap works like a transform) */
      rect: [number, number, number, number]
      /** base64 PNG replacing the image's pixels */
      image: string
      layer?: ImageLayer
      quarterTurns?: number
    }
  | { kind: 'deleteImage'; pageIndex: number; oldRect: [number, number, number, number] }

/** An existing content-stream image on a page */
export interface PageImageRef {
  pageIndex: number
  /** PDF user space [x1,y1,x2,y2] */
  rect: [number, number, number, number]
  /** Painted after the page's first text run (i.e. covers text it overlaps) */
  aboveText: boolean
}

/** Editable metadata for a GenOffice static form fill embedded as a page image. */

export interface StaticFormFillRecord {
  id: string
  kind: 'text' | 'check' | 'cross'
  pageIndex: number
  rect: [number, number, number, number]
  text?: string
  fontSize?: number
  color?: string
  align?: 'left' | 'center' | 'right'
}

/** One OCR line from the system engine: normalized bottom-left boxes relative to
    the submitted image ([x0,y0,x1,y1], 0..1), with optional word-level char boxes. */

export interface FormValueInput {
  name: string
  kind: 'text' | 'checkbox' | 'radio' | 'choice'
  /** For radio: selected exportValue; for choice: selected option; empty string clears selection */
  value?: string
  checked?: boolean
}
