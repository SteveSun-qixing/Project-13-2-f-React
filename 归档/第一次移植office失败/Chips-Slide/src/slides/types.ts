/**
 * 幻灯片编辑协议类型 — 移植自 GenOffice Slides 的 shared/ipc.ts 中与编辑操作相关的
 * 纯数据契约（原版经由 Electron IPC 传输；本移植后所有 op 在渲染进程内的本地会话直接执行，
 * 类型契约保持不变）。
 */

/** 元素超链接目标：外部 URL 或站内页跳转。 */
export type LinkTargetOp = { kind: 'url'; url: string } | { kind: 'slide'; slideIndex: number }

/** 一个富文本 run（由编辑器产出，带独立格式）。 */
export interface EditRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  fontSize?: number
  fontFamily?: string
  color?: string
  /** 删除线（与 bold/italic/underline 同为布尔开关） */
  strike?: boolean
  /** 上下标基线百分比（正数 = 上标；0 = 无，用于显式取消） */
  baseline?: number
  /** 超链接。undefined = 保留原 run 的链接；null = 明确移除 */
  link?: LinkTargetOp | null
  /** 来源模型 run 下标（原段落 runs 的索引） */
  srcRun?: number
}

/** 一个段落（含对齐方式）。 */
export interface EditParagraph {
  runs: EditRun[]
  align?: 'left' | 'center' | 'right' | 'justify'
  /** 缩进层级 0..8 */
  level?: number
  /** 来源模型段落下标（拆分/合并段落时回溯继承项目符号、行距等格式） */
  srcPara?: number
  /** 本次编辑会话中显式修改的段落级格式（缺省 = 保留原值） */
  bullet?: 'char' | 'number' | 'none'
  bulletChar?: string
  lineSpacingPct?: number
  spaceBeforePt?: number
  spaceAfterPt?: number
}

/** 渐变填充（UI 双色 + 方向；radial = 径向）。 */
export interface GradientFillSpec {
  gradient: {
    from: string
    to: string
    /** 完整 stop 列表（存在时覆盖 from/to）；颜色可带 #RRGGBBAA 透明度 */
    stops?: Array<{ pos: number; color: string }>
    angleDeg?: number
    /** path 渐变的遗留别名：'circle' */
    radial?: boolean
    /** path 渐变类型（PPT：radial/rectangular/path）；缺省为线性 */
    path?: 'circle' | 'rect' | 'shape'
    /** path 渐变焦点（0..1；默认中心 0.5/0.5） */
    center?: { x: number; y: number }
  }
}
