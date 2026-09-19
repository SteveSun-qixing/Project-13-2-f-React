/** `EmbeddedDocumentFrame` 属性：受控文档帧（图片模式与 HTML 模式区域）。 */
export interface EmbeddedDocumentFrameProps {
  /** 帧标题（无障碍名称）；缺省为“嵌入式文档”。 */
  title?: string;
  /** 资源 URL；与 `srcDoc` 二选一（同时给出时以 `src` 为准）。 */
  src?: string;
  /** 内联 HTML 文档；与 `src` 二选一。 */
  srcDoc?: string;
  /** 固定宽高比（如 `16:9`）；`autoHeight` 时忽略。 */
  ratio?: string;
  /** 按内容高度自适应：向 `srcDoc` 注入高度上报脚本并按上报值显示。 */
  autoHeight?: boolean;
  /** `autoHeight` 的高度上限系数：上限 = 系数 × 容器宽度；缺省不设上限。 */
  maxHeightFactor?: number;
  /** 区域标识：写入 `data-chips-embedded-frame` 属性，供宿主定位与样式挂载。 */
  scope?: string;
  /** 所在表面 ID：写入 `data-chips-surface-id` 属性。 */
  surfaceId?: string;
  /** iframe 沙箱属性；渲染帧沙箱基线只允许 `allow-scripts`，其他取值一律按其收口。 */
  sandbox?: string;
  /** 用户点击帧内内容时回调，用于编辑态激活所在区域。 */
  onActivate?: () => void;
  /** 帧加载完成回调。 */
  onFrameReady?: () => void;
  /** 帧加载失败回调。 */
  onFrameError?: () => void;
}
