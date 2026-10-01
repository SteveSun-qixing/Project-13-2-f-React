/// 演示域动作契约：由旧仓 `Chips-Office/src/apps/slide/shared/ipc.ts` 逐字抽取的纯数据类型。
/// 该文件整体按矩阵裁决废弃（私有 IPC 桥面 + vendor Op 面）；此处仅保留演示域纯逻辑
/// （动画时序 / 文本超链接编码）消费的形状动画与链接目标契约，其余 1600 行通道表与
/// vendor Op 契约归 renderer 重写臂按新契约重建。字段与语义为迁移原文。

/** Run-hyperlink target: external url, or an in-deck slide jump ("slide:N", 0-based). */
export type LinkTargetOp = { kind: 'url'; url: string } | { kind: 'slide'; slideIndex: number }

// ── Shape animations (the "Animations" tab) ──────────────────────────

export type AnimEffectKind =
  | 'appear'
  | 'fade'
  | 'flyIn'
  | 'wipe'
  | 'wipeDown'
  | 'splitIn'
  | 'bounce'
  | 'flipIn'
  | 'zoom' // entrance
  | 'pulse'
  | 'spin'
  | 'grow'
  | 'teeter' // emphasis
  | 'disappear'
  | 'fadeOut'
  | 'flyOut'
  | 'wipeOut'
  | 'shrink'
  | 'zoomOut' // exit
  | 'motionPath' // motion path (move along a path)

export type AnimTrigger = 'onClick' | 'withPrev' | 'afterPrev'

/** One animation (list order = play order); sourceId locates the target element. */
export interface AnimationItem {
  sourceId: string
  /** Target element display name (shown in the animation pane, filled by the main process) */
  targetName: string
  effect: AnimEffectKind
  trigger: AnimTrigger
  durationMs: number
  delayMs: number
  /** Path when effect='motionPath' (SVG subset M/L/C/Z, coordinates 0..1 relative to slide width/height) */
  motionPath?: string
  /** Per-paragraph animation: 0-based paragraph number; default = the whole shape */
  paragraph?: number
}
