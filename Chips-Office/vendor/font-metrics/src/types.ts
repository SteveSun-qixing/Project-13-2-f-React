/**
 * 字体垂直度量类型（自 GenOffice packages/font-metrics 原样抽取）。
 *
 * Node 实现整体保留在 ./node/ 下（读系统字体文件），浏览器构建不包含；
 * 未来若 Host 提供字体度量服务，实现可直接复用。
 */

export interface FaceVerticalMetrics {
  unitsPerEm: number
  hheaAscender: number
  hheaDescender: number
  hheaLineGap: number
  typoAscender: number | null
  typoDescender: number | null
  typoLineGap: number | null
  winAscent: number | null
  winDescent: number | null
  /** OS/2 fsSelection bit 7 (USE_TYPO_METRICS) */
  useTypoMetrics: boolean
}
